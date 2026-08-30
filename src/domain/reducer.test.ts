import { describe, expect, it } from "vitest";

import { applyAction, type ActionContext, type RoomAction } from "./reducer";
import { createRoomDocument, type RoomDocument } from "./room";

function context(): ActionContext {
  let counter = 0;
  return {
    now: 1000,
    nextId: (prefix) => `${prefix}-${(counter += 1)}`,
  };
}

function run(doc: RoomDocument, ...actions: RoomAction[]): RoomDocument {
  return runWith(context(), doc, ...actions);
}

function runWith(ctx: ActionContext, doc: RoomDocument, ...actions: RoomAction[]): RoomDocument {
  return actions.reduce((current, action) => applyAction(current, action, ctx), doc);
}

const base = createRoomDocument({ id: "d", createdAt: 0, widthCm: 500, depthCm: 400 });

describe("applyAction", () => {
  it("returns the same document for an unknown action", () => {
    const next = run(base, { type: "noop" } as unknown as RoomAction);
    expect(next).toBe(base);
  });

  it("sets room dimensions within limits and stamps updatedAt", () => {
    const next = run(base, { type: "set_room_dimensions", widthCm: 600, depthCm: 50 });
    expect(next.room.widthCm).toBe(600);
    expect(next.room.depthCm).toBe(150); // clamped to the minimum
    expect(next.updatedAt).toBe(1000);
  });

  it("pulls furniture and openings back inside when the room shrinks", () => {
    const withStuff = run(
      base,
      { type: "add_furniture", catalogId: "seat-sofa-three", xCm: 400, yCm: 350 },
      {
        type: "add_opening",
        kind: "door",
        wall: "north",
        offsetCm: 380,
        widthCm: 90,
        swing: "inward-left",
      },
    );
    const shrunk = run(withStuff, { type: "set_room_dimensions", widthCm: 300, depthCm: 300 });

    expect(shrunk.furniture[0].xCm).toBeLessThanOrEqual(300 - 210 / 2);
    expect(shrunk.openings[0].offsetCm + shrunk.openings[0].widthCm).toBeLessThanOrEqual(300);
  });

  it("adds furniture with a generated id, avoiding an occupied spot", () => {
    const next = run(
      base,
      { type: "add_furniture", catalogId: "table-side", xCm: 250, yCm: 200 },
      { type: "add_furniture", catalogId: "table-side", xCm: 250, yCm: 200 },
    );
    expect(next.furniture).toHaveLength(2);
    expect(next.furniture[0].id).toBe("furniture-1");
    expect(next.furniture[1].id).toBe("furniture-2");
    expect(
      next.furniture[0].xCm !== next.furniture[1].xCm ||
        next.furniture[0].yCm !== next.furniture[1].yCm,
    ).toBe(true);
  });

  it("ignores furniture that is not in the catalog", () => {
    const next = run(base, { type: "add_furniture", catalogId: "ghost-chair" });
    expect(next.furniture).toHaveLength(0);
  });

  it("updates, snaps and clamps a placed item", () => {
    const withSofa = run(base, {
      type: "add_furniture",
      catalogId: "seat-sofa-three",
      xCm: 250,
      yCm: 200,
    });
    const id = withSofa.furniture[0].id;

    const moved = run(withSofa, {
      type: "update_furniture",
      id,
      patch: { xCm: 243, yCm: 197, rotationDeg: 450 },
    });
    expect(moved.furniture[0]).toMatchObject({ xCm: 240, yCm: 200, rotationDeg: 90 });

    const shoved = run(withSofa, { type: "update_furniture", id, patch: { xCm: 10_000 } });
    expect(shoved.furniture[0].xCm).toBe(500 - 210 / 2);
  });

  it("removes and duplicates selections", () => {
    // One shared context so duplicate ids keep counting on from the originals.
    const ctx = context();
    const withTwo = runWith(
      ctx,
      base,
      { type: "add_furniture", catalogId: "table-side", xCm: 100, yCm: 100 },
      { type: "add_furniture", catalogId: "seat-armchair", xCm: 300, yCm: 100 },
    );
    const ids = withTwo.furniture.map((item) => item.id);

    expect(run(withTwo, { type: "remove_furniture", ids: [ids[0]] }).furniture).toHaveLength(1);

    const duplicated = runWith(ctx, withTwo, { type: "duplicate_furniture", ids });
    expect(duplicated.furniture).toHaveLength(4);
    expect(duplicated.furniture[2].catalogId).toBe("table-side");
    expect(duplicated.furniture[2].id).not.toBe(ids[0]);
  });

  it("adds, updates and removes openings with clamping", () => {
    const withDoor = run(base, {
      type: "add_opening",
      kind: "door",
      wall: "west",
      offsetCm: 1000,
      widthCm: 90,
    });
    expect(withDoor.openings[0]).toMatchObject({
      kind: "door",
      wall: "west",
      offsetCm: 310,
      widthCm: 90,
      swing: "inward-right",
    });

    const id = withDoor.openings[0].id;
    const updated = run(withDoor, {
      type: "update_opening",
      id,
      patch: { offsetCm: 40, swing: "outward-left" },
    });
    expect(updated.openings[0]).toMatchObject({ offsetCm: 40, swing: "outward-left" });

    expect(run(withDoor, { type: "remove_opening", id }).openings).toHaveLength(0);
  });

  it("applies a whole layout, replacing or merging", () => {
    const seeded = run(base, { type: "add_furniture", catalogId: "table-side", xCm: 60, yCm: 60 });

    const replaced = run(seeded, {
      type: "apply_layout",
      mode: "replace",
      items: [
        { catalogId: "seat-sofa-three", xCm: 250, yCm: 60, rotationDeg: 0 },
        { catalogId: "table-coffee-rect", xCm: 250, yCm: 200 },
      ],
    });
    expect(replaced.furniture.map((item) => item.catalogId)).toEqual([
      "seat-sofa-three",
      "table-coffee-rect",
    ]);

    const merged = run(seeded, {
      type: "apply_layout",
      mode: "merge",
      items: [{ catalogId: "seat-armchair", xCm: 400, yCm: 300 }],
    });
    expect(merged.furniture).toHaveLength(2);
  });

  it("updates settings and the document name", () => {
    const next = run(
      base,
      { type: "set_settings", patch: { clearanceCm: 90, snapToGrid: false } },
      { type: "rename_room", name: "Loft" },
    );
    expect(next.settings.clearanceCm).toBe(90);
    expect(next.settings.snapToGrid).toBe(false);
    expect(next.name).toBe("Loft");
  });
});
