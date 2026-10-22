//! Python sidecar supervision and typed request forwarding.
//! Methods are allow-listed here; the frontend can never choose a command line.

use serde_json::{json, Value};
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::mpsc::{channel, Sender};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_dialog::DialogExt;

const ALLOWED: &[&str] = &[
    "hello",
    "preflight",
    "settings.get",
    "profiles.prepare",
    "profiles.finish",
    "profiles.cancel",
    "plan",
    "library.scan",
    "library.table",
    "stats.run",
    "report.run",
    "compare.run",
    "lifecycle.plan",
    "lifecycle.analyze",
    "run.start",
    "run.pause",
    "run.resume",
    "run.stop",
    "run.status",
];

/// Reachable only through native commands that first obtain a user-chosen path.
const INTERNAL: &[&str] = &["export.write", "settings.set_project_root"];

type Pending = Arc<Mutex<HashMap<u64, Sender<Value>>>>;

struct Running {
    child: Child,
    stdin: ChildStdin,
}

#[derive(Default)]
pub struct Engine {
    inner: Mutex<Option<Running>>,
    pending: Pending,
    next_id: Mutex<u64>,
}

fn sidecar_command(app: &AppHandle) -> Result<Command, String> {
    // Dev: BROWSERLAB_PYTHON points at the project venv. Packaged: the bundled frozen sidecar.
    if let Ok(python) = std::env::var("BROWSERLAB_PYTHON") {
        let mut c = Command::new(python);
        c.args(["-m", "browserlab.rpc"]);
        return Ok(c);
    }
    let exe = app
        .path()
        .resource_dir()
        .map_err(|e| e.to_string())?
        .join("engine/browserlab-engine/browserlab-engine");
    if !exe.is_file() {
        return Err(format!("bundled engine missing at {}", exe.display()));
    }
    Ok(Command::new(exe))
}

fn spawn(app: &AppHandle, pending: &Pending) -> Result<Running, String> {
    let mut child = sidecar_command(app)?
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("cannot start engine: {e}"))?;
    let stdin = child.stdin.take().ok_or("no stdin")?;
    let stdout = child.stdout.take().ok_or("no stdout")?;
    let (app, pending) = (app.clone(), pending.clone());
    std::thread::spawn(move || {
        for line in BufReader::new(stdout).lines().map_while(Result::ok) {
            let Ok(v) = serde_json::from_str::<Value>(&line) else {
                continue;
            };
            match v.get("id").and_then(Value::as_u64) {
                Some(id) => {
                    if let Some(tx) = pending.lock().unwrap().remove(&id) {
                        let _ = tx.send(v);
                    }
                }
                None => {
                    let _ = app.emit("engine-event", v);
                }
            }
        }
        // Sidecar exited: fail all waiters so the UI never hangs.
        for (_, tx) in pending.lock().unwrap().drain() {
            let _ = tx.send(json!({"error": {"code": "engine_exit", "message": "engine exited"}}));
        }
    });
    Ok(Running { child, stdin })
}

#[tauri::command]
pub fn engine_call(
    app: AppHandle,
    state: State<Engine>,
    method: String,
    params: Value,
) -> Result<Value, String> {
    if !ALLOWED.contains(&method.as_str()) {
        return Err(format!("method not allowed: {method}"));
    }
    call_engine(&app, &state, &method, params)
}

fn call_engine(
    app: &AppHandle,
    state: &Engine,
    method: &str,
    params: Value,
) -> Result<Value, String> {
    debug_assert!(ALLOWED.contains(&method) || INTERNAL.contains(&method));
    if !params.is_object() {
        return Err("params must be an object".into());
    }
    let id = {
        let mut n = state.next_id.lock().unwrap();
        *n += 1;
        *n
    };
    let (tx, rx) = channel();
    state.pending.lock().unwrap().insert(id, tx);
    {
        let mut guard = state.inner.lock().unwrap();
        let dead = match guard.as_mut() {
            Some(r) => r.child.try_wait().map(|s| s.is_some()).unwrap_or(true),
            None => true,
        };
        if dead {
            *guard = Some(spawn(app, &state.pending)?);
        }
        let r = guard.as_mut().unwrap();
        let req = json!({"id": id, "method": method, "params": params});
        writeln!(r.stdin, "{req}")
            .and_then(|_| r.stdin.flush())
            .map_err(|e| e.to_string())?;
    }
    let resp = rx
        .recv_timeout(Duration::from_secs(30))
        .map_err(|_| "engine timeout".to_string())?;
    if let Some(err) = resp.get("error") {
        return Err(err.to_string());
    }
    Ok(resp.get("result").cloned().unwrap_or(Value::Null))
}

/// Save an export: the destination comes from the native save dialog, never from the webview.
#[tauri::command]
pub async fn export_save(
    app: AppHandle,
    state: State<'_, Engine>,
    format: String,
    id: String,
    suite: String,
    images: Vec<String>,
) -> Result<Value, String> {
    let (ext, name) = match format.as_str() {
        "csv_trials" => ("csv", "trials"),
        "csv_conditions" => ("csv", "conditions"),
        "xlsx" => ("xlsx", "report"),
        "json" => ("json", "results"),
        "pdf" => ("pdf", "report"),
        "png" => ("png", "chart"),
        _ => return Err(format!("unknown format: {format}")),
    };
    let picked = app
        .dialog()
        .file()
        .add_filter(ext, &[ext])
        .set_file_name(format!("{id}-{name}.{ext}"))
        .blocking_save_file();
    let Some(path) = picked else {
        return Ok(json!({"cancelled": true}));
    };
    let path = path.into_path().map_err(|e| e.to_string())?;
    let params =
        json!({"format": format, "id": id, "suite": suite, "images": images, "path": path});
    call_engine(&app, &state, "export.write", params)
}

/// Choose the project folder via the native dialog; the path never comes from the webview.
#[tauri::command]
pub async fn settings_choose_folder(
    app: AppHandle,
    state: State<'_, Engine>,
) -> Result<Value, String> {
    let Some(picked) = app.dialog().file().blocking_pick_folder() else {
        return Ok(json!({"cancelled": true}));
    };
    let path = picked.into_path().map_err(|e| e.to_string())?;
    call_engine(
        &app,
        &state,
        "settings.set_project_root",
        json!({ "path": path }),
    )
}
