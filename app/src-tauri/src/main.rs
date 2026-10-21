mod engine;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(engine::Engine::default())
        .invoke_handler(tauri::generate_handler![
            engine::engine_call,
            engine::export_save
        ])
        .run(tauri::generate_context!())
        .expect("error while running BrowserLab");
}
