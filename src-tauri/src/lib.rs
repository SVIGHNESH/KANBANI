mod db;

use db::{Board, BoardData, Card, Column};
use rusqlite::Connection;
use std::sync::Mutex;
use tauri::{Manager, State};

struct AppState {
    conn: Mutex<Connection>,
}

type CmdResult<T> = Result<T, String>;

fn map_err<E: std::fmt::Display>(e: E) -> String {
    e.to_string()
}

#[tauri::command]
fn list_boards(state: State<AppState>) -> CmdResult<Vec<Board>> {
    let conn = state.conn.lock().unwrap();
    db::list_boards(&conn).map_err(map_err)
}

#[tauri::command]
fn create_board(state: State<AppState>, name: String) -> CmdResult<Board> {
    let conn = state.conn.lock().unwrap();
    db::create_board(&conn, &name).map_err(map_err)
}

#[tauri::command]
fn rename_board(state: State<AppState>, id: i64, name: String) -> CmdResult<()> {
    let conn = state.conn.lock().unwrap();
    db::rename_board(&conn, id, &name).map_err(map_err)
}

#[tauri::command]
fn delete_board(state: State<AppState>, id: i64) -> CmdResult<()> {
    let conn = state.conn.lock().unwrap();
    db::delete_board(&conn, id).map_err(map_err)
}

#[tauri::command]
fn get_board(state: State<AppState>, board_id: i64) -> CmdResult<BoardData> {
    let conn = state.conn.lock().unwrap();
    db::get_board(&conn, board_id).map_err(map_err)
}

#[tauri::command]
fn create_column(state: State<AppState>, board_id: i64, name: String) -> CmdResult<Column> {
    let conn = state.conn.lock().unwrap();
    db::create_column(&conn, board_id, &name).map_err(map_err)
}

#[tauri::command]
fn rename_column(state: State<AppState>, id: i64, name: String) -> CmdResult<()> {
    let conn = state.conn.lock().unwrap();
    db::rename_column(&conn, id, &name).map_err(map_err)
}

#[tauri::command]
fn delete_column(state: State<AppState>, id: i64) -> CmdResult<()> {
    let conn = state.conn.lock().unwrap();
    db::delete_column(&conn, id).map_err(map_err)
}

#[tauri::command]
fn create_card(state: State<AppState>, column_id: i64, title: String) -> CmdResult<Card> {
    let conn = state.conn.lock().unwrap();
    db::create_card(&conn, column_id, &title).map_err(map_err)
}

#[tauri::command]
fn update_card(
    state: State<AppState>,
    id: i64,
    title: String,
    description: String,
) -> CmdResult<()> {
    let conn = state.conn.lock().unwrap();
    db::update_card(&conn, id, &title, &description).map_err(map_err)
}

#[tauri::command]
fn delete_card(state: State<AppState>, id: i64) -> CmdResult<()> {
    let conn = state.conn.lock().unwrap();
    db::delete_card(&conn, id).map_err(map_err)
}

#[tauri::command]
fn move_card(
    state: State<AppState>,
    card_id: i64,
    to_column_id: i64,
    ordered_ids: Vec<i64>,
) -> CmdResult<()> {
    let mut conn = state.conn.lock().unwrap();
    db::move_card(&mut conn, card_id, to_column_id, ordered_ids).map_err(map_err)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let dir = app.path().app_data_dir().expect("no app data dir");
            std::fs::create_dir_all(&dir).expect("failed to create app data dir");
            let conn = Connection::open(dir.join("kanban.db")).expect("failed to open database");
            db::init(&conn).expect("failed to initialize database");
            app.manage(AppState {
                conn: Mutex::new(conn),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_boards,
            create_board,
            rename_board,
            delete_board,
            get_board,
            create_column,
            rename_column,
            delete_column,
            create_card,
            update_card,
            delete_card,
            move_card
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
