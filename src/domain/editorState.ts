import { applyAction, type ActionContext, type RoomAction } from "./reducer";
import { createRoomDocument, type RoomDocument } from "./room";

/**
 * Editor state = the current document, its undo history, the current selection
 * and the locally saved layout variants. Canvas gestures and WebMCP tool calls
 * both dispatch through `editorReducer`, so an agent's edit is undoable in the
 * same stack as a drag.
 */

export const MAX_HISTORY = 100;

export interface LayoutVariant {
  id: string;
  name: string;
  createdAt: number;
  document: RoomDocument;
}

export interface EditorState {
  present: RoomDocument;
  past: RoomDocument[];
  future: RoomDocument[];
  selection: string[];
  variants: LayoutVariant[];
  activeVariantId: string | null;
  /** True while a drag or resize is mid-flight, so it stays one undo step. */
  gestureActive: boolean;
}

export type EditorAction =
  | { kind: "document"; action: RoomAction; transient?: boolean }
  | { kind: "end_gesture" }
  | { kind: "undo" }
  | { kind: "redo" }
  | { kind: "reset" }
  | { kind: "select"; ids: string[] }
  | { kind: "save_variant"; name: string }
  | { kind: "activate_variant"; id: string }
  | { kind: "delete_variant"; id: string }
  | { kind: "replace_state"; state: EditorState };

export function createEditorState(ctx: ActionContext): EditorState {
  return {
    present: createRoomDocument({ id: ctx.nextId("room"), createdAt: ctx.now }),
    past: [],
    future: [],
    selection: [],
    variants: [],
    activeVariantId: null,
    gestureActive: false,
  };
}

function pushHistory(past: RoomDocument[], document: RoomDocument): RoomDocument[] {
  const next = [...past, document];
  return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
}

/** Selection only ever names furniture that still exists. */
function pruneSelection(selection: string[], document: RoomDocument): string[] {
  const ids = new Set(document.furniture.map((placed) => placed.id));
  const kept = selection.filter((id) => ids.has(id));
  return kept.length === selection.length ? selection : kept;
}

/** Documents compare by content; `updatedAt` alone is not a real change. */
function sameDocument(a: RoomDocument, b: RoomDocument): boolean {
  return JSON.stringify({ ...a, updatedAt: 0 }) === JSON.stringify({ ...b, updatedAt: 0 });
}

function commit(state: EditorState, next: RoomDocument, transient: boolean): EditorState {
  if (next === state.present) return state;

  // A transient update mid-gesture edits the present in place; only the first
  // one in the gesture opens a history entry.
  const openGesture = transient && !state.gestureActive;
  const inGesture = transient && state.gestureActive;
  const activeVariant = state.variants.find((variant) => variant.id === state.activeVariantId);
  const activeVariantId =
    activeVariant && sameDocument(activeVariant.document, next) ? activeVariant.id : null;

  return {
    ...state,
    present: next,
    past: inGesture ? state.past : pushHistory(state.past, state.present),
    future: [],
    selection: pruneSelection(state.selection, next),
    activeVariantId,
    gestureActive: openGesture || inGesture,
  };
}

export function editorReducer(
  state: EditorState,
  action: EditorAction,
  ctx: ActionContext,
): EditorState {
  switch (action.kind) {
    case "document": {
      const next = applyAction(state.present, action.action, ctx);
      return commit(state, next, action.transient ?? false);
    }

    case "end_gesture": {
      if (!state.gestureActive) return state;
      const previous = state.past[state.past.length - 1];
      // A gesture that ended where it started leaves no trace in the history.
      if (previous && sameDocument(previous, state.present)) {
        return { ...state, past: state.past.slice(0, -1), gestureActive: false };
      }
      return { ...state, gestureActive: false };
    }

    case "undo": {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      return {
        ...state,
        present: previous,
        past: state.past.slice(0, -1),
        future: [state.present, ...state.future],
        selection: pruneSelection(state.selection, previous),
        gestureActive: false,
      };
    }

    case "redo": {
      if (state.future.length === 0) return state;
      const [next, ...rest] = state.future;
      return {
        ...state,
        present: next,
        past: pushHistory(state.past, state.present),
        future: rest,
        selection: pruneSelection(state.selection, next),
        gestureActive: false,
      };
    }

    case "reset": {
      const fresh = createRoomDocument({ id: ctx.nextId("room"), createdAt: ctx.now });
      return {
        ...state,
        present: fresh,
        past: pushHistory(state.past, state.present),
        future: [],
        selection: [],
        activeVariantId: null,
        gestureActive: false,
      };
    }

    case "select": {
      const ids = pruneSelection(action.ids, state.present);
      if (ids.length === state.selection.length && ids.every((id, i) => state.selection[i] === id)) {
        return state;
      }
      return { ...state, selection: ids };
    }

    case "save_variant": {
      const name = action.name.trim();
      if (!name) return state;

      const existing = state.variants.find((variant) => variant.name === name);
      const variant: LayoutVariant = {
        id: existing?.id ?? ctx.nextId("variant"),
        name,
        createdAt: ctx.now,
        document: state.present,
      };
      return {
        ...state,
        variants: existing
          ? state.variants.map((entry) => (entry.id === existing.id ? variant : entry))
          : [...state.variants, variant],
        activeVariantId: variant.id,
      };
    }

    case "activate_variant": {
      const variant = state.variants.find((entry) => entry.id === action.id);
      if (!variant) return state;
      return {
        ...state,
        present: { ...variant.document, updatedAt: ctx.now },
        past: pushHistory(state.past, state.present),
        future: [],
        selection: [],
        activeVariantId: variant.id,
        gestureActive: false,
      };
    }

    case "delete_variant": {
      if (!state.variants.some((entry) => entry.id === action.id)) return state;
      return {
        ...state,
        variants: state.variants.filter((entry) => entry.id !== action.id),
        activeVariantId: state.activeVariantId === action.id ? null : state.activeVariantId,
      };
    }

    case "replace_state":
      return action.state;

    default:
      return state;
  }
}
