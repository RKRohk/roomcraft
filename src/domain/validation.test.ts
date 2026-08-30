import { describe, expect, it } from "vitest";

import { footprintOf } from "./placement";
import { createRoomDocument, type PlacedFurniture, type RoomDocument } from "./room";
import { validateLayout } from "./validation";

function docWith(furniture: PlacedFurniture[], overrides: Partial<RoomDocument> = {}) {
  const base = createRoomDocument({ id: "d", createdAt: 0, widthCm: 500, depthCm: 400 });
  return { ...base, ...overrides, furniture };
}

const place = (
  id: string,
  catalogId: string,
  xCm: number,
  yCm: number,
  rotationDeg = 0,
): PlacedFurniture => ({ id, catalogId, xCm, yCm, rotationDeg });

describe("footprintOf", () => {
  it("resolves catalog dimensions into an oriented rectangle", () => {
    expect(footprintOf(place("a", "seat-sofa-three", 250, 200))).toEqual({
      x: 250,
      y: 200,
      width: 210,
      depth: 90,
      rotation: 0,
    });
  });

  it("returns null for an unknown catalog id", () => {
    expect(footprintOf(place("a", "not-real", 0, 0))).toBeNull();
  });
});

describe("validateLayout", () => {
  it("reports nothing for a clean layout", () => {
    const doc = docWith([place("a", "seat-sofa-three", 250, 60)]);
    const result = validateLayout(doc);
    expect(result.issues).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("flags furniture that leaves the room, including after rotation", () => {
    const doc = docWith([place("a", "seat-sofa-three", 60, 200)]);
    const issues = validateLayout(doc).issues;
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      code: "out-of-bounds",
      severity: "error",
      furnitureIds: ["a"],
    });

    // Rotated to run along the y axis it fits again.
    expect(validateLayout(docWith([place("a", "seat-sofa-three", 60, 200, 90)])).ok).toBe(true);
  });

  it("flags overlapping furniture once per pair", () => {
    const doc = docWith([
      place("a", "table-dining-four", 250, 200),
      place("b", "table-side", 250, 200),
    ]);
    const overlaps = validateLayout(doc).issues.filter((issue) => issue.code === "overlap");
    expect(overlaps).toHaveLength(1);
    expect(overlaps[0].furnitureIds.slice().sort()).toEqual(["a", "b"]);
  });

  it("flags furniture blocking a door's swing and approach", () => {
    const doc = docWith([place("a", "store-dresser", 250, 40)], {
      openings: [
        {
          id: "door-1",
          kind: "door",
          wall: "north",
          offsetCm: 210,
          widthCm: 80,
          swing: "inward-right",
        },
      ],
    });
    const blocked = validateLayout(doc).issues.filter((i) => i.code === "blocked-door");
    expect(blocked).toHaveLength(1);
    expect(blocked[0]).toMatchObject({
      severity: "error",
      furnitureIds: ["a"],
      openingId: "door-1",
    });
  });

  it("warns about walkways narrower than the configured clearance", () => {
    const base = createRoomDocument({ id: "d", createdAt: 0, widthCm: 500, depthCm: 400 });
    const doc: RoomDocument = {
      ...base,
      settings: { ...base.settings, clearanceCm: 75 },
      furniture: [
        // Sofa spans y 55..145, coffee table y 190..250: a 45 cm walkway.
        place("a", "seat-sofa-three", 250, 100),
        place("b", "table-coffee-rect", 250, 220),
      ],
    };
    const warnings = validateLayout(doc).issues.filter((i) => i.code === "narrow-walkway");
    expect(warnings).toHaveLength(1);
    expect(warnings[0].severity).toBe("warning");
    expect(warnings[0].furnitureIds.slice().sort()).toEqual(["a", "b"]);

    // Push them apart past the clearance and the warning goes away.
    const spacious: RoomDocument = {
      ...doc,
      furniture: [doc.furniture[0], { ...doc.furniture[1], yCm: 300 }],
    };
    expect(validateLayout(spacious).issues).toEqual([]);
  });

  it("respects a lower configured clearance", () => {
    const base = createRoomDocument({ id: "d", createdAt: 0, widthCm: 500, depthCm: 400 });
    const doc: RoomDocument = {
      ...base,
      settings: { ...base.settings, clearanceCm: 30 },
      furniture: [
        // The same 45 cm walkway that warns at a 75 cm clearance.
        place("a", "seat-sofa-three", 250, 100),
        place("b", "table-coffee-rect", 250, 220),
      ],
    };
    expect(validateLayout(doc).issues).toEqual([]);
  });

  it("summarises counts and orders errors before warnings", () => {
    const doc = docWith([
      place("a", "seat-sofa-three", 60, 200),
      place("b", "table-coffee-rect", 300, 200),
      place("c", "table-side", 300, 260),
    ]);
    const result = validateLayout(doc);
    expect(result.errorCount).toBeGreaterThan(0);
    expect(result.warningCount).toBeGreaterThan(0);
    expect(result.issues[0].severity).toBe("error");
    expect(result.ok).toBe(false);
  });

  it("does not treat rugs as collision obstacles", () => {
    const doc = docWith([
      place("rug", "rug-large", 240, 180),
      place("table", "table-coffee-rect", 240, 180),
    ]);

    expect(validateLayout(doc).issues.filter((issue) => issue.code === "overlap")).toEqual([]);
  });
});
