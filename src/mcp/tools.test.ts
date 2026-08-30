import { describe, expect, it } from "vitest";

import {
  createEditorState,
  editorReducer,
  type EditorAction,
  type EditorState,
} from "@/domain/editorState";
import type { ActionContext } from "@/domain/reducer";
import { ROOM_TOOL_NAMES, createRoomTools, type RoomToolStore } from "./tools";

function testStore(): RoomToolStore & { state: EditorState } {
  let counter = 0;
  const ctx: ActionContext = { now: 1000, nextId: (prefix) => `${prefix}-${(counter += 1)}` };
  const store = {
    state: createEditorState(ctx),
    getState() {
      return store.state;
    },
    dispatch(action: EditorAction) {
      store.state = editorReducer(store.state, action, ctx);
    },
  };
  return store;
}

function toolsFor(store: RoomToolStore) {
  const tools = createRoomTools(store);
  return new Map(tools.map((tool) => [tool.name, tool]));
}

describe("room WebMCP tools", () => {
  it("exposes every milestone tool with an explicit object schema", () => {
    const tools = createRoomTools(testStore());
    expect(tools.map((tool) => tool.name)).toEqual([...ROOM_TOOL_NAMES]);

    for (const tool of tools) {
      expect(tool.description.length).toBeGreaterThan(10);
      expect(tool.inputSchema.type).toBe("object");
      expect(tool.inputSchema.additionalProperties).toBe(false);
      expect(typeof tool.inputSchema.properties).toBe("object");
      expect(typeof tool.execute).toBe("function");
    }
  });

  it("reports room state as compact structured content", async () => {
    const store = testStore();
    const tools = toolsFor(store);

    const result = await tools.get("get_room_state")!.execute({});
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({
      room: { widthCm: 480, depthCm: 360 },
      furniture: [],
      openings: [],
    });
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual(result.structuredContent);
  });

  it("sets room dimensions through the shared reducer", async () => {
    const store = testStore();
    const result = await toolsFor(store).get("set_room_dimensions")!.execute({
      widthCm: 600,
      depthCm: 420,
    });

    expect(store.getState().present.room).toMatchObject({ widthCm: 600, depthCm: 420 });
    expect(result.structuredContent).toMatchObject({ room: { widthCm: 600, depthCm: 420 } });
  });

  it("rejects invalid arguments without mutating state", async () => {
    const store = testStore();
    const before = store.getState().present;

    const result = await toolsFor(store).get("set_room_dimensions")!.execute({ widthCm: "wide" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/widthCm/);
    expect(store.getState().present).toBe(before);
  });

  it("rejects values below the published room and opening schema minimums", async () => {
    const store = testStore();
    const tools = toolsFor(store);

    const room = await tools.get("set_room_dimensions")!.execute({ widthCm: 1 });
    expect(room.isError).toBe(true);
    expect(store.getState().present.room.widthCm).toBe(480);

    const opening = await tools.get("add_opening")!.execute({
      kind: "door",
      wall: "north",
      offsetCm: 0,
      widthCm: 1,
    });
    expect(opening.isError).toBe(true);
    expect(store.getState().present.openings).toHaveLength(0);
  });

  it("searches the catalog and returns agent-sized records", async () => {
    const result = await toolsFor(testStore())
      .get("search_furniture")!
      .execute({ query: "sofa", limit: 2 });

    const results = (result.structuredContent as { results: Array<Record<string, unknown>> })
      .results;
    expect(results).toHaveLength(2);
    expect(Object.keys(results[0]).sort()).toEqual([
      "category",
      "depthCm",
      "heightCm",
      "id",
      "name",
      "priceMinor",
      "style",
      "widthCm",
    ]);
  });

  it("places furniture and reports the created instance", async () => {
    const store = testStore();
    const result = await toolsFor(store)
      .get("place_furniture")!
      .execute({ catalogId: "seat-sofa-three", xCm: 240, yCm: 60, rotationDeg: 0 });

    expect(store.getState().present.furniture).toHaveLength(1);
    expect(result.structuredContent).toMatchObject({
      placed: { catalogId: "seat-sofa-three", xCm: 240, yCm: 60 },
    });
  });

  it("refuses to place an unknown catalog item", async () => {
    const store = testStore();
    const result = await toolsFor(store)
      .get("place_furniture")!
      .execute({ catalogId: "imaginary-item" });

    expect(result.isError).toBe(true);
    expect(store.getState().present.furniture).toHaveLength(0);
  });

  it("updates and removes placed furniture by id", async () => {
    const store = testStore();
    const tools = toolsFor(store);
    await tools.get("place_furniture")!.execute({ catalogId: "table-side", xCm: 100, yCm: 100 });
    const id = store.getState().present.furniture[0].id;

    await tools.get("update_furniture")!.execute({ id, xCm: 200, rotationDeg: 90 });
    expect(store.getState().present.furniture[0]).toMatchObject({ xCm: 200, rotationDeg: 90 });

    const missing = await tools.get("update_furniture")!.execute({ id: "nope", xCm: 10 });
    expect(missing.isError).toBe(true);

    await tools.get("remove_furniture")!.execute({ ids: [id] });
    expect(store.getState().present.furniture).toHaveLength(0);
  });

  it("adds openings and validates the resulting layout", async () => {
    const store = testStore();
    const tools = toolsFor(store);

    const added = await tools.get("add_opening")!.execute({
      kind: "door",
      wall: "north",
      offsetCm: 200,
      widthCm: 80,
      swing: "inward-right",
    });
    expect(added.structuredContent).toMatchObject({ opening: { wall: "north", widthCm: 80 } });

    await tools.get("place_furniture")!.execute({
      catalogId: "store-dresser",
      xCm: 240,
      yCm: 40,
    });

    const validation = await tools.get("validate_layout")!.execute({});
    const structured = validation.structuredContent as {
      ok: boolean;
      issues: Array<{ code: string }>;
    };
    expect(structured.ok).toBe(false);
    expect(structured.issues.some((issue) => issue.code === "blocked-door")).toBe(true);
  });

  it("applies a whole layout in one call", async () => {
    const store = testStore();
    const result = await toolsFor(store)
      .get("apply_layout")!
      .execute({
        mode: "replace",
        items: [
          { catalogId: "seat-sofa-three", xCm: 240, yCm: 60 },
          { catalogId: "table-coffee-rect", xCm: 240, yCm: 200 },
        ],
      });

    expect(store.getState().present.furniture).toHaveLength(2);
    expect(result.structuredContent).toMatchObject({ placedCount: 2 });
  });

  it("saves and activates named variants", async () => {
    const store = testStore();
    const tools = toolsFor(store);
    await tools.get("place_furniture")!.execute({ catalogId: "seat-armchair", xCm: 100, yCm: 100 });
    await tools.get("save_layout_variant")!.execute({ name: "Agent plan" });
    expect(store.getState().variants).toHaveLength(1);

    await tools.get("remove_furniture")!.execute({
      ids: [store.getState().present.furniture[0].id],
    });
    const activated = await tools.get("activate_layout_variant")!.execute({ name: "Agent plan" });
    expect(activated.isError).toBeFalsy();
    expect(store.getState().present.furniture).toHaveLength(1);

    const missing = await tools.get("activate_layout_variant")!.execute({ name: "ghost" });
    expect(missing.isError).toBe(true);
  });

  it("undoes its own last change through the shared history", async () => {
    const store = testStore();
    const tools = toolsFor(store);
    await tools.get("place_furniture")!.execute({ catalogId: "seat-armchair", xCm: 100, yCm: 100 });

    const undone = await tools.get("undo_last_change")!.execute({});
    expect(undone.isError).toBeFalsy();
    expect(store.getState().present.furniture).toHaveLength(0);

    const nothingLeft = await tools.get("undo_last_change")!.execute({});
    expect(nothingLeft.isError).toBe(true);
  });
});
