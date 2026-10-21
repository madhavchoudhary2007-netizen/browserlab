mod engine;

fn main() {
    tauri::Builder::default()
        .manage(engine::Engine::default())
        .invoke_handler(tauri::generate_handler![engine::engine_call])
        .run(tauri::generate_context!())
        .expect("error while running BrowserLab");
}
