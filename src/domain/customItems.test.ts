import { describe, expect, it } from "vitest";

import { createEditorState, editorReducer } from "./editorState";
import { searchFurniture } from "./catalogSearch";
import { footprintOf } from "./placement";
import { applyAction, type ActionContext, type RoomAction } from "./reducer";
import { createRoomDocument, type PlacedFurniture } from "./room";
import { validateLayout } from "./validation";

function context(): ActionContext {
  let counter = 0;
  return { now: 1000, nextId: (prefix) => `${prefix}-${(counter += 1)}` };
}

const customItem = {
  id: "custom-reading-chair",
  name: "Reading Chair",
  widthCm: 80,
  depthCm: 85,
  heightCm: 92,
  priceUsdCents: 45900,
  category: "seating" as const,
  style: "cozy" as const,
  color: "#6f8073",
  sourceUrl: "https://listing.invalid/reading-chair",
  sourceLabel: "Saved listing",
  rawText: "Soft green reading chair, 80 by 85 cm.",
};

function placed(id: string, catalogId: string, xCm: number, yCm: number): PlacedFurniture {
  return { id, catalogId, xCm, yCm, rotationDeg: 0 };
}

describe("custom items", () => {
  it("creates a separate custom definition and can place it through the shared reducer", () => {
    const ctx = context();
    const base = createRoomDocument({ id: "room", createdAt: 0, widthCm: 400, depthCm: 300 });

    const next = applyAction(
      base,
      {
        type: "create_custom_item",
        item: customItem,
        place: { xCm: 100, yCm: 100 },
      } as unknown as RoomAction,
      ctx,
    );

    expect(next).toMatchObject({
      customItems: [customItem],
      furniture: [{ catalogId: customItem.id, xCm: 100, yCm: 100 }],
    });
  });

  it("resolves custom dimensions for placement and collision validation", () => {
    const base = createRoomDocument({ id: "room", createdAt: 0, widthCm: 400, depthCm: 300 });
    const doc = {
      ...base,
      customItems: [customItem],
      furniture: [
        placed("first", customItem.id, 100, 100),
        placed("second", customItem.id, 100, 100),
        placed("outside", customItem.id, 30, 100),
      ],
    };

    expect(footprintOf(doc.furniture[0], doc.customItems)).toMatchObject({
      width: 80,
      depth: 85,
    });
    const issues = validateLayout(doc).issues;
    expect(issues.some((issue) => issue.code === "overlap")).toBe(true);
    expect(issues.some((issue) => issue.code === "out-of-bounds")).toBe(true);
  });

  it("searches room-local custom items separately or alongside built-ins", () => {
    const customOnly = searchFurniture([customItem], { source: "custom", query: "reading" });
    expect(customOnly).toMatchObject([{ id: customItem.id, source: "custom" }]);

    const all = searchFurniture([customItem], { query: "reading" });
    expect(all.some((item) => item.id === customItem.id && item.source === "custom")).toBe(true);
  });

  it("undoes and redoes custom-item creation together with its placement", () => {
    const ctx = context();
    const initial = createEditorState(ctx);
    const created = editorReducer(
      initial,
      {
        kind: "document",
        action: {
          type: "create_custom_item",
          item: customItem,
          place: { xCm: 100, yCm: 100 },
        } as unknown as RoomAction,
      },
      ctx,
    );

    const undone = editorReducer(created, { kind: "undo" }, ctx);
    expect(undone.present).toMatchObject({ customItems: [], furniture: [] });

    const redone = editorReducer(undone, { kind: "redo" }, ctx);
    expect(redone.present).toMatchObject({
      customItems: [customItem],
      furniture: [{ catalogId: customItem.id }],
    });
  });

  it("keeps custom definitions and their locked placements in undoable variants", () => {
    const ctx = context();
    let state = createEditorState(ctx);
    state = editorReducer(
      state,
      {
        kind: "document",
        action: {
          type: "create_custom_item",
          item: customItem,
          place: { xCm: 100, yCm: 100 },
        } as unknown as RoomAction,
      },
      ctx,
    );
    const placedItem = state.present.furniture[0];
    state = editorReducer(
      state,
      {
        kind: "document",
        action: { type: "update_furniture", id: placedItem.id, patch: { locked: true } },
      },
      ctx,
    );
    state = editorReducer(state, { kind: "save_variant", name: "Custom plan" }, ctx);
    state = editorReducer(
      state,
      {
        kind: "document",
        action: { type: "update_furniture", id: placedItem.id, patch: { xCm: 200 } },
      },
      ctx,
    );

    expect(state.present.furniture[0]).toMatchObject({ xCm: 100, locked: true });
    expect(state.variants[0].document).toMatchObject({ customItems: [customItem] });

    const undone = editorReducer(state, { kind: "undo" }, ctx);
    expect(undone.present).toMatchObject({ customItems: [customItem] });
  });

  it("restores a custom placement when a saved variant is activated", () => {
    const ctx = context();
    let state = createEditorState(ctx);
    state = editorReducer(
      state,
      {
        kind: "document",
        action: {
          type: "create_custom_item",
          item: customItem,
          place: { xCm: 100, yCm: 100 },
        } as unknown as RoomAction,
      },
      ctx,
    );
    state = editorReducer(state, { kind: "save_variant", name: "Custom plan" }, ctx);
    state = editorReducer(
      state,
      {
        kind: "document",
        action: { type: "remove_furniture", ids: [state.present.furniture[0].id] },
      },
      ctx,
    );
    state = editorReducer(
      state,
      { kind: "activate_variant", id: state.variants[0].id },
      ctx,
    );

    expect(state.present).toMatchObject({
      customItems: [customItem],
      furniture: [{ catalogId: customItem.id }],
    });
  });
});
