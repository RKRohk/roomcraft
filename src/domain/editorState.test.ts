import { describe, expect, it } from "vitest";

import {
  MAX_HISTORY,
  createEditorState,
  editorReducer,
  type EditorAction,
  type EditorState,
} from "./editorState";
import type { ActionContext } from "./reducer";

function context(): ActionContext {
  let counter = 0;
  return { now: 1000, nextId: (prefix) => `${prefix}-${(counter += 1)}` };
}

function reduce(state: EditorState, ctx: ActionContext, ...actions: EditorAction[]) {
  return actions.reduce((current, action) => editorReducer(current, action, ctx), state);
}

const addSofa: EditorAction = {
  kind: "document",
  action: { type: "add_furniture", catalogId: "seat-sofa-three", xCm: 240, yCm: 60 },
};

function seeded() {
  const ctx = context();
  const state = reduce(createEditorState(ctx), ctx, addSofa);
  return { ctx, state, id: state.present.furniture[0].id };
}

describe("editorReducer", () => {
  it("starts with an empty document and no history", () => {
    const state = createEditorState(context());
    expect(state.past).toEqual([]);
    expect(state.future).toEqual([]);
    expect(state.selection).toEqual([]);
    expect(state.present.furniture).toEqual([]);
  });

  it("records document changes and undoes and redoes them", () => {
    const { ctx, state } = seeded();
    expect(state.past).toHaveLength(1);
    expect(state.future).toEqual([]);

    const undone = reduce(state, ctx, { kind: "undo" });
    expect(undone.present.furniture).toHaveLength(0);
    expect(undone.future).toHaveLength(1);

    const redone = reduce(undone, ctx, { kind: "redo" });
    expect(redone.present.furniture).toHaveLength(1);
    expect(redone.future).toEqual([]);
  });

  it("ignores undo and redo when there is nothing to move", () => {
    const state = createEditorState(context());
    expect(reduce(state, context(), { kind: "undo" })).toBe(state);
    expect(reduce(state, context(), { kind: "redo" })).toBe(state);
  });

  it("drops the redo stack once a new change lands", () => {
    const { ctx, state } = seeded();
    const undone = reduce(state, ctx, { kind: "undo" });
    const changed = reduce(undone, ctx, addSofa);
    expect(changed.future).toEqual([]);
  });

  it("collapses a drag gesture into a single history entry", () => {
    const { ctx, state, id } = seeded();
    const drag = (xCm: number): EditorAction => ({
      kind: "document",
      transient: true,
      action: { type: "update_furniture", id, patch: { xCm } },
    });

    const dragged = reduce(state, ctx, drag(200), drag(220), drag(260), { kind: "end_gesture" });
    expect(dragged.past).toHaveLength(2);
    expect(dragged.present.furniture[0].xCm).toBe(260);

    const undone = reduce(dragged, ctx, { kind: "undo" });
    expect(undone.present.furniture[0].xCm).toBe(240);
  });

  it("discards a gesture that changed nothing", () => {
    const { ctx, state, id } = seeded();
    const noop = reduce(
      state,
      ctx,
      {
        kind: "document",
        transient: true,
        action: { type: "update_furniture", id, patch: { xCm: 240 } },
      },
      { kind: "end_gesture" },
    );
    expect(noop.past).toHaveLength(1);
  });

  it("caps the history depth", () => {
    const ctx = context();
    let state = createEditorState(ctx);
    for (let i = 0; i < MAX_HISTORY + 10; i += 1) {
      state = editorReducer(state, { kind: "document", action: { type: "rename_room", name: `R${i}` } }, ctx);
    }
    expect(state.past).toHaveLength(MAX_HISTORY);
  });

  it("tracks selection and prunes ids that no longer exist", () => {
    const { ctx, state, id } = seeded();
    const selected = reduce(state, ctx, { kind: "select", ids: [id] });
    expect(selected.selection).toEqual([id]);

    const removed = reduce(selected, ctx, {
      kind: "document",
      action: { type: "remove_furniture", ids: [id] },
    });
    expect(removed.selection).toEqual([]);
  });

  it("resets to a fresh document but keeps the change undoable", () => {
    const { ctx, state } = seeded();
    const reset = reduce(state, ctx, { kind: "reset" });
    expect(reset.present.furniture).toEqual([]);
    expect(reduce(reset, ctx, { kind: "undo" }).present.furniture).toHaveLength(1);
  });

  it("saves, activates and deletes named variants", () => {
    const { ctx, state } = seeded();
    const saved = reduce(state, ctx, { kind: "save_variant", name: "Cosy" });
    expect(saved.variants).toHaveLength(1);
    expect(saved.variants[0]).toMatchObject({ name: "Cosy" });
    expect(saved.activeVariantId).toBe(saved.variants[0].id);

    const cleared = reduce(saved, ctx, {
      kind: "document",
      action: { type: "remove_furniture", ids: [saved.present.furniture[0].id] },
    });
    expect(cleared.present.furniture).toHaveLength(0);

    const restored = reduce(cleared, ctx, {
      kind: "activate_variant",
      id: saved.variants[0].id,
    });
    expect(restored.present.furniture).toHaveLength(1);
    expect(reduce(restored, ctx, { kind: "undo" }).present.furniture).toHaveLength(0);

    const deleted = reduce(restored, ctx, {
      kind: "delete_variant",
      id: saved.variants[0].id,
    });
    expect(deleted.variants).toEqual([]);
    expect(deleted.activeVariantId).toBeNull();
  });

  it("marks a saved variant stale after editing the current document", () => {
    const { ctx, state } = seeded();
    const saved = reduce(state, ctx, { kind: "save_variant", name: "Plan A" });
    const changed = reduce(saved, ctx, {
      kind: "document",
      action: { type: "rename_room", name: "Edited room" },
    });

    expect(changed.activeVariantId).toBeNull();
  });

  it("does not mutate locked furniture through shared actions", () => {
    const { ctx, state, id } = seeded();
    const locked = reduce(state, ctx, {
      kind: "document",
      action: { type: "update_furniture", id, patch: { locked: true } },
    });
    const moved = reduce(locked, ctx, {
      kind: "document",
      action: { type: "update_furniture", id, patch: { xCm: 100 } },
    });
    expect(moved.present.furniture[0]).toMatchObject({ xCm: 240, locked: true });

    const removed = reduce(moved, ctx, {
      kind: "document",
      action: { type: "remove_furniture", ids: [id] },
    });
    expect(removed.present.furniture).toHaveLength(1);
  });

  it("overwrites a variant saved under an existing name", () => {
    const { ctx, state } = seeded();
    const saved = reduce(
      state,
      ctx,
      { kind: "save_variant", name: "Plan A" },
      { kind: "save_variant", name: "Plan A" },
    );
    expect(saved.variants).toHaveLength(1);
  });
});
