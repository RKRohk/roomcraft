import { describe, expect, it } from "vitest";

import {
  ROOM_DOCUMENT_VERSION,
  MIN_ROOM_SIZE_CM,
  MAX_ROOM_SIZE_CM,
  createRoomDocument,
  interiorBounds,
  roomSummary,
} from "./room";

describe("room document", () => {
  it("creates a versioned document with sensible defaults", () => {
    const doc = createRoomDocument({ id: "doc-1", createdAt: 1700000000000 });

    expect(doc.version).toBe(ROOM_DOCUMENT_VERSION);
    expect(doc.id).toBe("doc-1");
    expect(doc.room.widthCm).toBeGreaterThanOrEqual(MIN_ROOM_SIZE_CM);
    expect(doc.room.depthCm).toBeLessThanOrEqual(MAX_ROOM_SIZE_CM);
    expect(doc.openings).toEqual([]);
    expect(doc.furniture).toEqual([]);
    expect(doc.settings.clearanceCm).toBeGreaterThan(0);
    expect(doc.settings.gridCm).toBeGreaterThan(0);
    expect(doc.updatedAt).toBe(1700000000000);
  });

  it("accepts explicit dimensions", () => {
    const doc = createRoomDocument({
      id: "doc-2",
      createdAt: 0,
      widthCm: 520,
      depthCm: 380,
      name: "Studio",
    });
    expect(doc.room).toMatchObject({ widthCm: 520, depthCm: 380 });
    expect(doc.name).toBe("Studio");
  });

  it("exposes interior bounds and a compact summary", () => {
    const doc = createRoomDocument({ id: "doc-3", createdAt: 0, widthCm: 400, depthCm: 300 });

    expect(interiorBounds(doc)).toEqual({ minX: 0, minY: 0, maxX: 400, maxY: 300 });
    expect(roomSummary(doc)).toEqual({
      widthCm: 400,
      depthCm: 300,
      areaM2: 12,
      openings: 0,
      furniture: 0,
    });
  });
});
