import { describe, expect, it } from "vitest";

import type { ShapePrimitive } from "@/domain/catalog";
import type { ShapePalette } from "@/lib/color";

import { THUMBNAIL_PAD, projectShape } from "./shapeProjection";

const palette: ShapePalette = {
  body: "#aaa",
  panel: "#bbb",
  cushion: "#ccc",
  accent: "#ddd",
  outline: "#eee",
};

describe("catalog thumbnail projection", () => {
  it("frames the item in its true footprint aspect instead of a square", () => {
    // A 180x45 console is 4:1 from above. Squeezing it into a square frame is
    // what made narrow thumbnails read as flat slivers.
    const wide = projectShape([], 180, 45, palette);
    expect(wide.width / wide.height).toBeCloseTo(4, 5);

    const tall = projectShape([], 90, 200, palette);
    expect(tall.width / tall.height).toBeCloseTo(0.45, 5);

    const square = projectShape([], 90, 90, palette);
    expect(square.width).toBeCloseTo(square.height, 5);
  });

  it("pads the viewBox so edge strokes are not clipped in half", () => {
    const projected = projectShape([], 100, 100, palette);
    expect(projected.viewBox).toBe(
      `${-THUMBNAIL_PAD} ${-THUMBNAIL_PAD} ${100 + THUMBNAIL_PAD * 2} ${100 + THUMBNAIL_PAD * 2}`,
    );
    expect(THUMBNAIL_PAD).toBeGreaterThan(0);
  });

  it("closes polygons the canvas closes, so silhouettes are not left open", () => {
    const shape: ShapePrimitive[] = [
      { kind: "line", points: [0, 0, 1, 0, 0.5, 1], role: "accent", closed: true },
      { kind: "line", points: [0, 0, 1, 1], role: "accent", closed: false },
    ];
    const [closed, open] = projectShape(shape, 100, 100, palette).elements;

    expect(closed.kind).toBe("polygon");
    expect(open.kind).toBe("polyline");
  });

  it("maps unit coordinates onto the footprint the way the canvas does", () => {
    const shape: ShapePrimitive[] = [
      { kind: "rect", x: 0, y: 0.5, w: 1, h: 0.5, role: "body", radius: 0.1 },
      { kind: "ellipse", cx: 0.5, cy: 0.5, rx: 0.5, ry: 0.5, role: "accent" },
    ];
    const projected = projectShape(shape, 200, 100, palette);
    const [rect, ellipse] = projected.elements;

    // 2:1 footprint -> 100 x 50 frame; x scales by width, y by depth.
    if (rect.kind !== "rect" || ellipse.kind !== "ellipse") throw new Error("wrong kinds");
    expect(rect.width).toBeCloseTo(100, 5);
    expect(rect.height).toBeCloseTo(25, 5);
    expect(rect.y).toBeCloseTo(25, 5);
    // Corner radius follows the short side, matching the canvas renderer.
    expect(rect.rx).toBeCloseTo(5, 5);
    expect(ellipse.rx).toBeCloseTo(50, 5);
    expect(ellipse.ry).toBeCloseTo(25, 5);
  });

  it("fills solid primitives and outlines stroked ones", () => {
    const shape: ShapePrimitive[] = [
      { kind: "rect", x: 0, y: 0, w: 1, h: 1, role: "body" },
      { kind: "rect", x: 0, y: 0, w: 1, h: 1, role: "outline", stroke: true },
    ];
    const [solid, outlined] = projectShape(shape, 100, 100, palette).elements;

    expect(solid).toMatchObject({ fill: palette.body, stroke: "none" });
    expect(outlined).toMatchObject({ fill: "none", stroke: palette.outline });
  });
});
