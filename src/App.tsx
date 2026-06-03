import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { api } from "./api";
import type { Board, Card, ColumnWithCards } from "./types";
import "./App.css";

/* ------------------------------- App shell ------------------------------- */

function useZoom() {
  const ZOOM_KEY = "kanbani.zoom";
  const MIN = 0.5;
  const MAX = 2.0;
  const STEP = 0.1;

  const [zoom, setZoom] = useState<number>(() => {
    const saved = parseFloat(localStorage.getItem(ZOOM_KEY) || "1");
    return Number.isFinite(saved) ? saved : 1;
  });

  useEffect(() => {
    const clamped = Math.min(MAX, Math.max(MIN, zoom));
    // WebKit (Tauri's webview) supports the non-standard `zoom` property,
    // which scales layout cleanly without breaking sizing like transform does.
    (document.documentElement.style as any).zoom = String(clamped);
    localStorage.setItem(ZOOM_KEY, String(clamped));
  }, [zoom]);

  useEffect(() => {
    const round = (n: number) => Math.round(n * 100) / 100;
    const inc = () => setZoom((z) => Math.min(MAX, round(z + STEP)));
    const dec = () => setZoom((z) => Math.max(MIN, round(z - STEP)));
    const reset = () => setZoom(1);

    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        inc();
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        dec();
      } else if (e.key === "0") {
        e.preventDefault();
        reset();
      }
    };
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      if (e.deltaY < 0) inc();
      else if (e.deltaY > 0) dec();
    };

    window.addEventListener("keydown", onKey);
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("wheel", onWheel);
    };
  }, []);

  return zoom;
}

export default function App() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [activeBoardId, setActiveBoardId] = useState<number | null>(null);
  const zoom = useZoom();

  async function refreshBoards(selectId?: number) {
    const list = await api.listBoards();
    setBoards(list);
    if (selectId !== undefined) setActiveBoardId(selectId);
    else if (activeBoardId === null && list.length) setActiveBoardId(list[0].id);
    else if (list.length === 0) setActiveBoardId(null);
  }

  useEffect(() => {
    refreshBoards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addBoard() {
    const name = prompt("New board name", "Untitled board");
    if (!name?.trim()) return;
    const b = await api.createBoard(name.trim());
    await refreshBoards(b.id);
  }

  async function removeBoard(id: number) {
    if (!confirm("Delete this board and all its cards?")) return;
    await api.deleteBoard(id);
    if (activeBoardId === id) setActiveBoardId(null);
    await refreshBoards();
  }

  async function renameBoard(b: Board) {
    const name = prompt("Rename board", b.name);
    if (!name?.trim()) return;
    await api.renameBoard(b.id, name.trim());
    await refreshBoards();
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">◫</span>
          <span className="brand-name">KANBANI</span>
        </div>
        <div className="sidebar-section-label">Boards</div>
        <nav className="board-list">
          {boards.map((b) => (
            <button
              key={b.id}
              className={"board-item" + (b.id === activeBoardId ? " active" : "")}
              onClick={() => setActiveBoardId(b.id)}
              onDoubleClick={() => renameBoard(b)}
              title="Double-click to rename"
            >
              <span className="board-item-name">{b.name}</span>
              <span
                className="board-item-del"
                onClick={(e) => {
                  e.stopPropagation();
                  removeBoard(b.id);
                }}
                title="Delete board"
              >
                ×
              </span>
            </button>
          ))}
          {boards.length === 0 && (
            <div className="sidebar-empty">No boards yet</div>
          )}
        </nav>
        <button className="new-board-btn" onClick={addBoard}>
          + New board
        </button>
        <div className="zoom-bar" title="Ctrl + / Ctrl - / Ctrl 0, or Ctrl+scroll">
          <span className="zoom-label">Zoom</span>
          <span className="zoom-value">{Math.round(zoom * 100)}%</span>
        </div>
        <div className="sidebar-foot">
          Stored locally · SQLite
          <br />
          Created by Vighnesh Shukla
        </div>
      </aside>

      <main className="main">
        {activeBoardId === null ? (
          <EmptyState onCreate={addBoard} />
        ) : (
          <BoardView key={activeBoardId} boardId={activeBoardId} />
        )}
      </main>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="empty-state">
      <div className="empty-glyph">◫</div>
      <h2>Welcome to KANBANI</h2>
      <p>Create your first board to start organizing your work.</p>
      <button className="primary-btn" onClick={onCreate}>
        + Create a board
      </button>
    </div>
  );
}

/* ------------------------------- Board view ------------------------------ */

function BoardView({ boardId }: { boardId: number }) {
  const [boardName, setBoardName] = useState("");
  const [columns, setColumns] = useState<ColumnWithCards[]>([]);
  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [editing, setEditing] = useState<Card | null>(null);

  async function load() {
    const data = await api.getBoard(boardId);
    setBoardName(data.board.name);
    setColumns(data.columns);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const allCards = useMemo(() => columns.flatMap((c) => c.cards), [columns]);

  function findColumnOfCard(cardId: number): ColumnWithCards | undefined {
    return columns.find((c) => c.cards.some((card) => card.id === cardId));
  }

  function onDragStart(e: DragStartEvent) {
    const id = Number(e.active.id);
    setActiveCard(allCards.find((c) => c.id === id) ?? null);
  }

  function onDragOver(e: DragOverEvent) {
    const { active, over } = e;
    if (!over) return;
    const activeId = Number(active.id);
    const overId = over.id;

    const from = findColumnOfCard(activeId);
    if (!from) return;

    // Destination column: a column droppable ("col-N") or the column of a card.
    let toColId: number;
    if (typeof overId === "string" && overId.startsWith("col-")) {
      toColId = Number(overId.slice(4));
    } else {
      const overCol = findColumnOfCard(Number(overId));
      if (!overCol) return;
      toColId = overCol.id;
    }
    if (from.id === toColId) return;

    setColumns((prev) => {
      const next = prev.map((c) => ({ ...c, cards: [...c.cards] }));
      const src = next.find((c) => c.id === from.id)!;
      const dst = next.find((c) => c.id === toColId)!;
      const idx = src.cards.findIndex((c) => c.id === activeId);
      if (idx === -1) return prev;
      const [moved] = src.cards.splice(idx, 1);
      moved.column_id = toColId;
      let insertAt = dst.cards.length;
      const overIdx = dst.cards.findIndex((c) => c.id === Number(overId));
      if (overIdx !== -1) insertAt = overIdx;
      dst.cards.splice(insertAt, 0, moved);
      return next;
    });
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setActiveCard(null);
    if (!over) return;
    const activeId = Number(active.id);
    const dstCol = findColumnOfCard(activeId);
    if (!dstCol) return;
    const overId = over.id;

    setColumns((prev) => {
      const next = prev.map((c) => ({ ...c, cards: [...c.cards] }));
      const col = next.find((c) => c.id === dstCol.id)!;
      const oldIdx = col.cards.findIndex((c) => c.id === activeId);
      let newIdx = oldIdx;
      if (typeof overId !== "string" || !overId.startsWith("col-")) {
        const oi = col.cards.findIndex((c) => c.id === Number(overId));
        if (oi !== -1) newIdx = oi;
      }
      if (oldIdx !== newIdx && oldIdx !== -1) {
        col.cards = arrayMove(col.cards, oldIdx, newIdx);
      }
      api.moveCard(
        activeId,
        col.id,
        col.cards.map((c) => c.id)
      );
      return next;
    });
  }

  async function addCard(columnId: number) {
    const title = prompt("Card title");
    if (!title?.trim()) return;
    await api.createCard(columnId, title.trim());
    await load();
  }

  async function addColumn() {
    const name = prompt("Column name", "New column");
    if (!name?.trim()) return;
    await api.createColumn(boardId, name.trim());
    await load();
  }

  async function renameColumn(id: number, current: string) {
    const name = prompt("Rename column", current);
    if (!name?.trim()) return;
    await api.renameColumn(id, name.trim());
    await load();
  }

  async function deleteColumn(id: number) {
    if (!confirm("Delete this column and its cards?")) return;
    await api.deleteColumn(id);
    await load();
  }

  return (
    <>
      <header className="board-header">
        <h1>{boardName}</h1>
        <button className="ghost-btn" onClick={addColumn}>
          + Add column
        </button>
      </header>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
      >
        <div className="board">
          {columns.map((col) => (
            <ColumnView
              key={col.id}
              column={col}
              onAddCard={() => addCard(col.id)}
              onRename={() => renameColumn(col.id, col.name)}
              onDelete={() => deleteColumn(col.id)}
              onEditCard={setEditing}
            />
          ))}
          {columns.length === 0 && (
            <div className="board-empty">No columns. Add one to get started.</div>
          )}
        </div>

        <DragOverlay>
          {activeCard ? <CardFace card={activeCard} dragging /> : null}
        </DragOverlay>
      </DndContext>

      {editing && (
        <CardModal
          card={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await load();
          }}
          onDeleted={async () => {
            setEditing(null);
            await load();
          }}
        />
      )}
    </>
  );
}

/* -------------------------------- Column --------------------------------- */

function ColumnView({
  column,
  onAddCard,
  onRename,
  onDelete,
  onEditCard,
}: {
  column: ColumnWithCards;
  onAddCard: () => void;
  onRename: () => void;
  onDelete: () => void;
  onEditCard: (c: Card) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col-${column.id}` });
  return (
    <section className={"column" + (isOver ? " over" : "")}>
      <div className="column-head">
        <div
          className="column-title"
          onDoubleClick={onRename}
          title="Double-click to rename"
        >
          {column.name}
          <span className="count">{column.cards.length}</span>
        </div>
        <button className="column-del" onClick={onDelete} title="Delete column">
          ×
        </button>
      </div>

      <SortableContext
        items={column.cards.map((c) => c.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="card-list" ref={setNodeRef}>
          {column.cards.map((card) => (
            <SortableCard
              key={card.id}
              card={card}
              onClick={() => onEditCard(card)}
            />
          ))}
        </div>
      </SortableContext>

      <button className="add-card-btn" onClick={onAddCard}>
        + Add card
      </button>
    </section>
  );
}

/* --------------------------------- Card ---------------------------------- */

function SortableCard({ card, onClick }: { card: Card; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
    >
      <CardFace card={card} />
    </div>
  );
}

function CardFace({ card, dragging }: { card: Card; dragging?: boolean }) {
  return (
    <div className={"card" + (dragging ? " card-dragging" : "")}>
      <div className="card-title">{card.title}</div>
      {card.description && <div className="card-desc">{card.description}</div>}
    </div>
  );
}

/* ------------------------------ Card editor ------------------------------ */

function CardModal({
  card,
  onClose,
  onSaved,
  onDeleted,
}: {
  card: Card;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const [title, setTitle] = useState(card.title);
  const [desc, setDesc] = useState(card.description);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  async function save() {
    if (!title.trim()) return;
    await api.updateCard(card.id, title.trim(), desc);
    onSaved();
  }

  async function del() {
    if (!confirm("Delete this card?")) return;
    await api.deleteCard(card.id);
    onDeleted();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <input
          ref={titleRef}
          className="modal-title-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Card title"
        />
        <textarea
          className="modal-desc-input"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="Add a more detailed description…"
          rows={8}
        />
        <div className="modal-meta">
          Created {card.created_at} · Updated {card.updated_at}
        </div>
        <div className="modal-actions">
          <button className="danger-btn" onClick={del}>
            Delete
          </button>
          <div className="spacer" />
          <button className="ghost-btn" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-btn" onClick={save}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
