export interface Board {
  id: number;
  name: string;
  position: number;
}

export interface Column {
  id: number;
  board_id: number;
  name: string;
  position: number;
}

export interface Card {
  id: number;
  column_id: number;
  title: string;
  description: string;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface ColumnWithCards extends Column {
  cards: Card[];
}

export interface BoardData {
  board: Board;
  columns: ColumnWithCards[];
}
