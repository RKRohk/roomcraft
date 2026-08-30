import { describe, expect, it } from "vitest";

import { createEditorState, editorReducer } from "./editorState";
import {
  PERSISTED_VERSION,
  STORAGE_KEY,
  loadEditorState,
  parsePersisted,
  saveEditorState,
  toPersisted,
} from "./persistence";
import type { ActionContext } from "./reducer";

function context(): ActionContext {
  let counter = 0;
  return { now: 1000, nextId: (prefix) => `${prefix}-${(counter += 1)}` };
}

function memoryStorage(seed: Record<string, string> = {}) {
  const data = new Map(Object.entries(seed));
  return {
    store: data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

function populated() {
  const ctx = context();
  let state = createEditorState(ctx);
  state = editorReducer(
    state,
    { kind: "document", action: { type: "add_furniture", catalogId: "seat-sofa-three" } },
    ctx,
  );
  state = editorReducer(state, { kind: "save_variant", name: "Plan A" }, ctx);
  return { ctx, state };
}

describe("persistence", () => {
  it("round-trips the document and variants, dropping history", () => {
    const { ctx, state } = populated();
    const storage = memoryStorage();

    saveEditorState(storage, state);
    const restored = loadEditorState(storage, ctx);

    expect(restored.present).toEqual(state.present);
    expect(restored.variants).toEqual(state.variants);
    expect(restored.activeVariantId).toBe(state.activeVariantId);
    expect(restored.past).toEqual([]);
    expect(restored.future).toEqual([]);
  });

  it("writes under a versioned key", () => {
    const { state } = populated();
    const storage = memoryStorage();
    saveEditorState(storage, state);

    const raw = JSON.parse(storage.getItem(STORAGE_KEY)!);
    expect(raw.version).toBe(PERSISTED_VERSION);
    expect(raw.document.furniture).toHaveLength(1);
  });

  it("rejects malformed or unknown payloads", () => {
    expect(parsePersisted("not json")).toBeNull();
    expect(parsePersisted(JSON.stringify({ version: 99, document: {} }))).toBeNull();
    expect(parsePersisted(JSON.stringify({ version: 1 }))).toBeNull();
    expect(parsePersisted(JSON.stringify({ version: 1, document: { room: {} } }))).toBeNull();
  });

  it("fills in defaults for fields added since a document was stored", () => {
    const { state } = populated();
    const stripped = JSON.parse(JSON.stringify(toPersisted(state)));
    delete stripped.document.settings.snapToGrid;
    delete stripped.document.name;
    delete stripped.variants;

    const parsed = parsePersisted(JSON.stringify(stripped));
    expect(parsed).not.toBeNull();
    expect(parsed!.document.settings.snapToGrid).toBe(true);
    expect(typeof parsed!.document.name).toBe("string");
    expect(parsed!.variants).toEqual([]);
  });

  it("migrates version-one local state with an empty custom catalog", () => {
    const { state } = populated();
    const legacy = JSON.parse(JSON.stringify(toPersisted(state)));
    legacy.version = 1;
    delete legacy.document.customItems;

    const parsed = parsePersisted(JSON.stringify(legacy));
    expect(parsed?.version).toBe(PERSISTED_VERSION);
    expect(parsed?.document.customItems).toEqual([]);
  });

  it("drops furniture whose catalog item no longer exists", () => {
    const { state } = populated();
    const payload = toPersisted({
      ...state,
      present: {
        ...state.present,
        furniture: [
          ...state.present.furniture,
          { id: "gone", catalogId: "retired-item", xCm: 10, yCm: 10, rotationDeg: 0 },
        ],
      },
    });

    const parsed = parsePersisted(JSON.stringify(payload));
    expect(parsed!.document.furniture.map((item) => item.catalogId)).toEqual([
      "seat-sofa-three",
    ]);
  });

  it("round-trips custom items and their placed references", () => {
    const ctx = context();
    const custom = {
      id: "custom-reading-chair",
      name: "Reading Chair",
      widthCm: 80,
      depthCm: 85,
      heightCm: 92,
      priceUsdCents: 45900,
      category: "seating",
      style: "cozy",
      color: "#6f8073",
      sourceUrl: "https://listing.invalid/reading-chair",
      sourceLabel: "Saved listing",
      rawText: "Soft green reading chair.",
    };
    let state = createEditorState(ctx);
    state = editorReducer(
      state,
      {
        kind: "document",
        action: {
          type: "create_custom_item",
          item: custom,
          place: { xCm: 100, yCm: 100 },
        } as never,
      },
      ctx,
    );

    const parsed = parsePersisted(JSON.stringify(toPersisted(state)));
    expect(parsed?.document).toMatchObject({
      customItems: [custom],
      furniture: [{ catalogId: custom.id }],
    });
  });

  it("falls back to a fresh editor state when storage is empty or throws", () => {
    const ctx = context();
    expect(loadEditorState(memoryStorage(), ctx).present.furniture).toEqual([]);

    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {},
    };
    expect(loadEditorState(broken, ctx).present.furniture).toEqual([]);
    expect(() => saveEditorState(broken, populated().state)).not.toThrow();
  });
});
