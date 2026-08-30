import { describe, expect, it } from "vitest";

import {
  clampOpening,
  doorSwingGeometry,
  openingClearanceRect,
  openingSegment,
  wallLengthCm,
} from "./openings";
import { createRoomDocument, type Opening } from "./room";

const doc = createRoomDocument({ id: "d", createdAt: 0, widthCm: 400, depthCm: 300 });

const door: Opening = {
  id: "o1",
  kind: "door",
  wall: "north",
  offsetCm: 100,
  widthCm: 80,
  swing: "inward-right",
};

describe("openings", () => {
  it("knows the usable length of each wall", () => {
    expect(wallLengthCm(doc, "north")).toBe(400);
    expect(wallLengthCm(doc, "south")).toBe(400);
    expect(wallLengthCm(doc, "west")).toBe(300);
    expect(wallLengthCm(doc, "east")).toBe(300);
  });

  it("maps an opening onto a wall segment in room coordinates", () => {
    expect(openingSegment(doc, door)).toEqual({
      start: { x: 100, y: 0 },
      end: { x: 180, y: 0 },
    });
    expect(openingSegment(doc, { ...door, wall: "east", offsetCm: 50 })).toEqual({
      start: { x: 400, y: 50 },
      end: { x: 400, y: 130 },
    });
    expect(openingSegment(doc, { ...door, wall: "south", offsetCm: 20 })).toEqual({
      start: { x: 20, y: 300 },
      end: { x: 100, y: 300 },
    });
    expect(openingSegment(doc, { ...door, wall: "west", offsetCm: 0 })).toEqual({
      start: { x: 0, y: 0 },
      end: { x: 0, y: 80 },
    });
  });

  it("clamps an opening so it always fits inside its wall", () => {
    expect(clampOpening(doc, { ...door, offsetCm: -40 }).offsetCm).toBe(0);
    expect(clampOpening(doc, { ...door, offsetCm: 900 }).offsetCm).toBe(320);
    expect(clampOpening(doc, { ...door, widthCm: 5000 }).widthCm).toBe(400);
  });

  it("describes an inward door swing as a quarter arc hinged on one jamb", () => {
    const swing = doorSwingGeometry(doc, door);
    expect(swing).not.toBeNull();
    // Hinged on the right jamb (x=180) for `inward-right`, sweeping into the room.
    expect(swing!.hinge).toEqual({ x: 180, y: 0 });
    expect(swing!.radiusCm).toBe(80);
    expect(swing!.startAngleDeg).toBe(180);
    expect(swing!.sweepDeg).toBe(-90);
    expect(swing!.leafEnd.x).toBeCloseTo(180, 6);
    expect(swing!.leafEnd.y).toBeCloseTo(80, 6);
  });

  it("has no swing geometry for windows and for outward doors it stays outside", () => {
    expect(doorSwingGeometry(doc, { ...door, kind: "window", swing: undefined })).toBeNull();
    const outward = doorSwingGeometry(doc, { ...door, swing: "outward-right" })!;
    expect(outward.leafEnd.y).toBeCloseTo(-80, 6);
  });

  it("produces an interior clearance rectangle in front of a door", () => {
    const rect = openingClearanceRect(doc, door);
    expect(rect).toMatchObject({ x: 140, width: 80, depth: 80, rotation: 0 });
    expect(rect!.y).toBeCloseTo(40, 6);
    expect(openingClearanceRect(doc, { ...door, kind: "window", swing: undefined })).toBeNull();
  });
});
