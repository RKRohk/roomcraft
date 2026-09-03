import type { ShapePrimitive } from "@/domain/catalog";
import type { ShapePalette } from "@/lib/color";

/**
 * Projects a catalog item's top-down artwork into SVG-ready geometry.
 *
 * This is the DOM twin of `FurnitureShape`, which draws the same primitives on
 * the Konva canvas. Keeping the mapping here — pure and free of JSX — lets the
 * two renderers be checked against each other in tests, which is how the
 * open-polygon and squashed-frame defects were caught.
 */

/** Long side of the projected frame, in SVG user units. */
export const THUMBNAIL_LONG_SIDE = 100;

/**
 * Breathing room around the frame. Strokes are centred on their path, so a
 * primitive flush with the footprint edge loses its outer half to the viewBox
 * boundary without this.
 */
export const THUMBNAIL_PAD = 3;

/**
 * Stroke weight in CSS pixels. Paired with `vector-effect: non-scaling-stroke`
 * it stays constant however small the thumbnail renders, mirroring the canvas's
 * `strokeScaleEnabled={false}`.
 */
export const THUMBNAIL_STROKE_PX = 1.25;

export type ProjectedElement =
  | {
      kind: "rect";
      x: number;
      y: number;
      width: number;
      height: number;
      rx: number;
      fill: string;
      stroke: string;
    }
  | {
      kind: "ellipse";
      cx: number;
      cy: number;
      rx: number;
      ry: number;
      fill: string;
      stroke: string;
    }
  | { kind: "polygon" | "polyline"; points: string; fill: string; stroke: string };

export interface ProjectedShape {
  /** `min-x min-y width height`, padding included. */
  viewBox: string;
  /** Footprint frame, padding excluded — the item's true proportions. */
  width: number;
  height: number;
  elements: ProjectedElement[];
}

/**
 * Frames a footprint so its longer side is `THUMBNAIL_LONG_SIDE`. The frame
 * keeps the item's real aspect ratio: a 180x45 console stays 4:1 rather than
 * being squashed into a square, so wide pieces read as wide instead of flat.
 */
export function frameFor(widthCm: number, depthCm: number): { width: number; height: number } {
  const aspect = widthCm / depthCm;
  return aspect >= 1
    ? { width: THUMBNAIL_LONG_SIDE, height: THUMBNAIL_LONG_SIDE / aspect }
    : { width: THUMBNAIL_LONG_SIDE * aspect, height: THUMBNAIL_LONG_SIDE };
}

export function projectShape(
  shape: ShapePrimitive[],
  widthCm: number,
  depthCm: number,
  palette: ShapePalette,
): ProjectedShape {
  const { width, height } = frameFor(widthCm, depthCm);
  // Corner radii follow the short side, exactly as the canvas renderer does.
  const minSide = Math.min(width, height);

  const elements = shape.map((primitive): ProjectedElement => {
    const color = palette[primitive.role];
    // `stroke: true` primitives are outlines; everything else is a solid fill.
    // Only rects and ellipses carry the flag; polylines are always strokes.
    const outlined = primitive.kind !== "line" && primitive.stroke === true;
    const fill = outlined ? "none" : color;
    const stroke = outlined ? color : "none";

    if (primitive.kind === "rect") {
      return {
        kind: "rect",
        x: primitive.x * width,
        y: primitive.y * height,
        width: primitive.w * width,
        height: primitive.h * height,
        rx: (primitive.radius ?? 0) * minSide,
        fill,
        stroke,
      };
    }

    if (primitive.kind === "ellipse") {
      return {
        kind: "ellipse",
        cx: primitive.cx * width,
        cy: primitive.cy * height,
        rx: primitive.rx * width,
        ry: primitive.ry * height,
        fill,
        stroke,
      };
    }

    const points: string[] = [];
    for (let i = 0; i < primitive.points.length; i += 2) {
      points.push(`${primitive.points[i] * width},${primitive.points[i + 1] * height}`);
    }
    return {
      // The canvas closes these with Konva's `closed` flag; an open polyline
      // here would leave the silhouette visibly unfinished.
      kind: primitive.closed ? "polygon" : "polyline",
      points: points.join(" "),
      fill: "none",
      stroke: color,
    };
  });

  return {
    viewBox: `${-THUMBNAIL_PAD} ${-THUMBNAIL_PAD} ${width + THUMBNAIL_PAD * 2} ${
      height + THUMBNAIL_PAD * 2
    }`,
    width,
    height,
    elements,
  };
}
