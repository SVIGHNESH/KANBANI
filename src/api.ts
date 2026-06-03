import { invoke } from "@tauri-apps/api/core";
import type { Board, BoardData, Card, Column } from "./types";

export const api = {
  listBoards: () => invoke<Board[]>("list_boards"),
  createBoard: (name: string) => invoke<Board>("create_board", { name }),
  renameBoard: (id: number, name: string) =>
    invoke<void>("rename_board", { id, name }),
  deleteBoard: (id: number) => invoke<void>("delete_board", { id }),

  getBoard: (boardId: number) => invoke<BoardData>("get_board", { boardId }),

  createColumn: (boardId: number, name: string) =>
    invoke<Column>("create_column", { boardId, name }),
  renameColumn: (id: number, name: string) =>
    invoke<void>("rename_column", { id, name }),
  deleteColumn: (id: number) => invoke<void>("delete_column", { id }),

  createCard: (columnId: number, title: string) =>
    invoke<Card>("create_card", { columnId, title }),
  updateCard: (id: number, title: string, description: string) =>
    invoke<void>("update_card", { id, title, description }),
  deleteCard: (id: number) => invoke<void>("delete_card", { id }),
  moveCard: (cardId: number, toColumnId: number, orderedIds: number[]) =>
    invoke<void>("move_card", { cardId, toColumnId, orderedIds }),
};
