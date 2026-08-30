import { describe, expect, it } from "vitest";

import {
  boundsOf,
  cornersOf,
  gapBetween,
  rectanglesOverlap,
  rectContainsRect,
  rotatePoint,
  type OrientedRect,
} from "./geometry";

const rect = (
  x: number,
  y: number,
  width: number,
  depth: number,
  rotation = 0,
): OrientedRect => ({ x, y, width, depth, rotation });

describe("geometry", () => {
  it("rotates a point around an origin", () => {
    const p = rotatePoint({ x: 10, y: 0 }, { x: 0, y: 0 }, 90);
    expect(p.x).toBeCloseTo(0, 6);
    expect(p.y).toBeCloseTo(10, 6);
  });

  it("returns the four corners of an unrotated rectangle centred on its position", () => {
    expect(cornersOf(rect(100, 100, 200, 100))).toEqual([
      { x: 0, y: 50 },
      { x: 200, y: 50 },
      { x: 200, y: 150 },
      { x: 0, y: 150 },
    ]);
  });

  it("computes an axis-aligned bounding box for a rotated rectangle", () => {
    const bounds = boundsOf(rect(100, 100, 200, 100, 90));
    expect(bounds.minX).toBeCloseTo(50, 6);
    expect(bounds.maxX).toBeCloseTo(150, 6);
    expect(bounds.minY).toBeCloseTo(0, 6);
    expect(bounds.maxY).toBeCloseTo(200, 6);
  });

  it("detects overlap between rotated rectangles and ignores touching edges", () => {
    expect(rectanglesOverlap(rect(0, 0, 100, 100), rect(50, 0, 100, 100))).toBe(true);
    expect(rectanglesOverlap(rect(0, 0, 100, 100), rect(100, 0, 100, 100))).toBe(false);
    // A long bar rotated 45° reaches into a square it would miss when axis-aligned.
    expect(rectanglesOverlap(rect(0, 0, 300, 20, 45), rect(90, 90, 40, 40))).toBe(true);
    expect(rectanglesOverlap(rect(0, 0, 300, 20), rect(90, 90, 40, 40))).toBe(false);
  });

  it("measures the clear gap between two separated rectangles", () => {
    expect(gapBetween(rect(0, 0, 100, 100), rect(160, 0, 100, 100))).toBeCloseTo(60, 6);
    expect(gapBetween(rect(0, 0, 100, 100), rect(50, 0, 100, 100))).toBe(0);
  });

  it("checks containment of a rotated rectangle inside an axis-aligned box", () => {
    const room = { minX: 0, minY: 0, maxX: 400, maxY: 300 };
    expect(rectContainsRect(room, rect(200, 150, 100, 100, 45))).toBe(true);
    expect(rectContainsRect(room, rect(20, 150, 100, 100, 45))).toBe(false);
  });
});
