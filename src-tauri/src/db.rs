use rusqlite::Connection;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
pub struct Board {
    pub id: i64,
    pub name: String,
    pub position: i64,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct Column {
    pub id: i64,
    pub board_id: i64,
    pub name: String,
    pub position: i64,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct Card {
    pub id: i64,
    pub column_id: i64,
    pub title: String,
    pub description: String,
    pub position: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Serialize, Deserialize)]
pub struct ColumnWithCards {
    #[serde(flatten)]
    pub column: Column,
    pub cards: Vec<Card>,
}

#[derive(Serialize, Deserialize)]
pub struct BoardData {
    pub board: Board,
    pub columns: Vec<ColumnWithCards>,
}

pub fn init(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(
        r#"
        PRAGMA foreign_keys = ON;
        CREATE TABLE IF NOT EXISTS boards (
            id       INTEGER PRIMARY KEY AUTOINCREMENT,
            name     TEXT NOT NULL,
            position INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS columns (
            id       INTEGER PRIMARY KEY AUTOINCREMENT,
            board_id INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
            name     TEXT NOT NULL,
            position INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS cards (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            column_id   INTEGER NOT NULL REFERENCES columns(id) ON DELETE CASCADE,
            title       TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            position    INTEGER NOT NULL DEFAULT 0,
            created_at  TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
        );
        "#,
    )?;
    Ok(())
}

pub fn list_boards(conn: &Connection) -> rusqlite::Result<Vec<Board>> {
    let mut stmt =
        conn.prepare("SELECT id, name, position FROM boards ORDER BY position, id")?;
    let rows = stmt.query_map([], |r| {
        Ok(Board {
            id: r.get(0)?,
            name: r.get(1)?,
            position: r.get(2)?,
        })
    })?;
    rows.collect()
}

pub fn create_board(conn: &Connection, name: &str) -> rusqlite::Result<Board> {
    let position: i64 = conn
        .query_row("SELECT COALESCE(MAX(position) + 1, 0) FROM boards", [], |r| r.get(0))?;
    conn.execute(
        "INSERT INTO boards (name, position) VALUES (?1, ?2)",
        rusqlite::params![name, position],
    )?;
    let id = conn.last_insert_rowid();
    // seed default columns
    for (i, col) in ["To Do", "In Progress", "Done"].iter().enumerate() {
        conn.execute(
            "INSERT INTO columns (board_id, name, position) VALUES (?1, ?2, ?3)",
            rusqlite::params![id, col, i as i64],
        )?;
    }
    Ok(Board {
        id,
        name: name.to_string(),
        position,
    })
}

pub fn rename_board(conn: &Connection, id: i64, name: &str) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE boards SET name = ?2 WHERE id = ?1",
        rusqlite::params![id, name],
    )?;
    Ok(())
}

pub fn delete_board(conn: &Connection, id: i64) -> rusqlite::Result<()> {
    conn.execute("PRAGMA foreign_keys = ON", [])?;
    conn.execute("DELETE FROM boards WHERE id = ?1", rusqlite::params![id])?;
    Ok(())
}

pub fn get_board(conn: &Connection, board_id: i64) -> rusqlite::Result<BoardData> {
    let board = conn.query_row(
        "SELECT id, name, position FROM boards WHERE id = ?1",
        rusqlite::params![board_id],
        |r| {
            Ok(Board {
                id: r.get(0)?,
                name: r.get(1)?,
                position: r.get(2)?,
            })
        },
    )?;

    let mut col_stmt = conn.prepare(
        "SELECT id, board_id, name, position FROM columns WHERE board_id = ?1 ORDER BY position, id",
    )?;
    let columns: Vec<Column> = col_stmt
        .query_map(rusqlite::params![board_id], |r| {
            Ok(Column {
                id: r.get(0)?,
                board_id: r.get(1)?,
                name: r.get(2)?,
                position: r.get(3)?,
            })
        })?
        .collect::<rusqlite::Result<_>>()?;

    let mut card_stmt = conn.prepare(
        "SELECT id, column_id, title, description, position, created_at, updated_at
         FROM cards WHERE column_id = ?1 ORDER BY position, id",
    )?;

    let mut result = Vec::with_capacity(columns.len());
    for column in columns {
        let cards: Vec<Card> = card_stmt
            .query_map(rusqlite::params![column.id], |r| {
                Ok(Card {
                    id: r.get(0)?,
                    column_id: r.get(1)?,
                    title: r.get(2)?,
                    description: r.get(3)?,
                    position: r.get(4)?,
                    created_at: r.get(5)?,
                    updated_at: r.get(6)?,
                })
            })?
            .collect::<rusqlite::Result<_>>()?;
        result.push(ColumnWithCards { column, cards });
    }

    Ok(BoardData {
        board,
        columns: result,
    })
}

pub fn create_column(conn: &Connection, board_id: i64, name: &str) -> rusqlite::Result<Column> {
    let position: i64 = conn.query_row(
        "SELECT COALESCE(MAX(position) + 1, 0) FROM columns WHERE board_id = ?1",
        rusqlite::params![board_id],
        |r| r.get(0),
    )?;
    conn.execute(
        "INSERT INTO columns (board_id, name, position) VALUES (?1, ?2, ?3)",
        rusqlite::params![board_id, name, position],
    )?;
    Ok(Column {
        id: conn.last_insert_rowid(),
        board_id,
        name: name.to_string(),
        position,
    })
}

pub fn rename_column(conn: &Connection, id: i64, name: &str) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE columns SET name = ?2 WHERE id = ?1",
        rusqlite::params![id, name],
    )?;
    Ok(())
}

pub fn delete_column(conn: &Connection, id: i64) -> rusqlite::Result<()> {
    conn.execute("PRAGMA foreign_keys = ON", [])?;
    conn.execute("DELETE FROM columns WHERE id = ?1", rusqlite::params![id])?;
    Ok(())
}

pub fn create_card(conn: &Connection, column_id: i64, title: &str) -> rusqlite::Result<Card> {
    let position: i64 = conn.query_row(
        "SELECT COALESCE(MAX(position) + 1, 0) FROM cards WHERE column_id = ?1",
        rusqlite::params![column_id],
        |r| r.get(0),
    )?;
    conn.execute(
        "INSERT INTO cards (column_id, title, position) VALUES (?1, ?2, ?3)",
        rusqlite::params![column_id, title, position],
    )?;
    let id = conn.last_insert_rowid();
    conn.query_row(
        "SELECT id, column_id, title, description, position, created_at, updated_at
         FROM cards WHERE id = ?1",
        rusqlite::params![id],
        |r| {
            Ok(Card {
                id: r.get(0)?,
                column_id: r.get(1)?,
                title: r.get(2)?,
                description: r.get(3)?,
                position: r.get(4)?,
                created_at: r.get(5)?,
                updated_at: r.get(6)?,
            })
        },
    )
}

pub fn update_card(
    conn: &Connection,
    id: i64,
    title: &str,
    description: &str,
) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE cards SET title = ?2, description = ?3, updated_at = datetime('now') WHERE id = ?1",
        rusqlite::params![id, title, description],
    )?;
    Ok(())
}

pub fn delete_card(conn: &Connection, id: i64) -> rusqlite::Result<()> {
    conn.execute("DELETE FROM cards WHERE id = ?1", rusqlite::params![id])?;
    Ok(())
}

/// Move a card to `to_column_id` and apply the new full ordering of that column.
/// `ordered_ids` is the destination column's card ids in their new order.
pub fn move_card(
    conn: &mut Connection,
    card_id: i64,
    to_column_id: i64,
    ordered_ids: Vec<i64>,
) -> rusqlite::Result<()> {
    let tx = conn.transaction()?;
    tx.execute(
        "UPDATE cards SET column_id = ?2, updated_at = datetime('now') WHERE id = ?1",
        rusqlite::params![card_id, to_column_id],
    )?;
    for (i, cid) in ordered_ids.iter().enumerate() {
        tx.execute(
            "UPDATE cards SET position = ?2 WHERE id = ?1",
            rusqlite::params![cid, i as i64],
        )?;
    }
    tx.commit()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn data_survives_reopen_and_move_persists() {
        let dir = std::env::temp_dir().join("kanban_test_db_xyz");
        let _ = std::fs::remove_file(&dir);
        let path = &dir;

        // Session 1: create board, a card in first column, move it to second column.
        let (b_id, c1, c2, card_id) = {
            let mut conn = Connection::open(path).unwrap();
            init(&conn).unwrap();
            let board = create_board(&conn, "Work").unwrap();
            let data = get_board(&conn, board.id).unwrap();
            let col1 = data.columns[0].column.id;
            let col2 = data.columns[1].column.id;
            let card = create_card(&conn, col1, "Ship it").unwrap();
            move_card(&mut conn, card.id, col2, vec![card.id]).unwrap();
            (board.id, col1, col2, card.id)
        }; // connection dropped here — simulates app close

        let _ = c1;

        // Session 2: reopen the same file and verify state persisted.
        let conn = Connection::open(path).unwrap();
        init(&conn).unwrap();
        let data = get_board(&conn, b_id).unwrap();
        let target = data.columns.iter().find(|c| c.column.id == c2).unwrap();
        assert_eq!(target.cards.len(), 1, "card should persist after reopen");
        assert_eq!(target.cards[0].id, card_id);
        assert_eq!(target.cards[0].title, "Ship it");

        std::fs::remove_file(path).ok();
    }
}
