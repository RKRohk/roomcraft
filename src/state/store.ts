import {
  createEditorState,
  editorReducer,
  type EditorAction,
  type EditorState,
} from "@/domain/editorState";
import type { ActionContext } from "@/domain/reducer";

/**
 * A tiny observable store outside React.
 *
 * Keeping the state here (rather than in `useReducer`) means a WebMCP tool can
 * dispatch and immediately read the result synchronously, which is what the
 * tool responses need, while React subscribes through `useSyncExternalStore`.
 */

export interface RoomStore {
  getState(): EditorState;
  dispatch(action: EditorAction): void;
  subscribe(listener: () => void): () => void;
}

function randomSuffix(): string {
  const globalCrypto = typeof crypto !== "undefined" ? crypto : undefined;
  if (globalCrypto?.randomUUID) return globalCrypto.randomUUID().slice(0, 8);
  return Math.random().toString(36).slice(2, 10);
}

/** Wall-clock context: `now` is read fresh on every dispatch. */
export function createActionContext(): ActionContext {
  return {
    get now() {
      return Date.now();
    },
    nextId: (prefix: string) => `${prefix}-${randomSuffix()}`,
  };
}

export function createRoomStore(
  ctx: ActionContext = createActionContext(),
  initial?: EditorState,
): RoomStore {
  let state = initial ?? createEditorState(ctx);
  const listeners = new Set<() => void>();

  return {
    getState: () => state,
    dispatch(action) {
      const next = editorReducer(state, action, ctx);
      if (next === state) return;
      state = next;
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}
