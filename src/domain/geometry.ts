/**
 * Pure 2D geometry helpers, all in centimetres.
 *
 * RoomCraft models every footprint as an oriented rectangle: a centre point,
 * a width/depth pair, and a rotation in degrees (clockwise, screen axes with
 * y pointing down). Overlap uses the separating axis theorem so rotated
 * furniture is handled exactly rather than by bounding box approximation.
 */

export interface Point {
  x: number;
  y: number;
}

export interface OrientedRect {
  x: number;
  y: number;
  width: number;
  depth: number;
  rotation: number;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Tolerance in centimetres; below this two shapes are treated as touching, not overlapping. */
export const EPSILON = 1e-6;

export function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Normalises any angle into the [0, 360) range. */
export function normalizeAngle(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

export function rotatePoint(point: Point, origin: Point, degrees: number): Point {
  const radians = degreesToRadians(degrees);
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const dx = point.x - origin.x;
  const dy = point.y - origin.y;
  return {
    x: origin.x + dx * cos - dy * sin,
    y: origin.y + dx * sin + dy * cos,
  };
}

/** Corners in order: top-left, top-right, bottom-right, bottom-left (before rotation). */
export function cornersOf(rect: OrientedRect): Point[] {
  const halfWidth = rect.width / 2;
  const halfDepth = rect.depth / 2;
  const centre = { x: rect.x, y: rect.y };
  const local: Point[] = [
    { x: rect.x - halfWidth, y: rect.y - halfDepth },
    { x: rect.x + halfWidth, y: rect.y - halfDepth },
    { x: rect.x + halfWidth, y: rect.y + halfDepth },
    { x: rect.x - halfWidth, y: rect.y + halfDepth },
  ];
  if (normalizeAngle(rect.rotation) === 0) return local;
  return local.map((corner) => rotatePoint(corner, centre, rect.rotation));
}

export function boundsOfPoints(points: Point[]): Bounds {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
}

export function boundsOf(rect: OrientedRect): Bounds {
  return boundsOfPoints(cornersOf(rect));
}

function axesOf(corners: Point[]): Point[] {
  // A rectangle only needs its two perpendicular edge normals.
  return [0, 1].map((index) => {
    const a = corners[index];
    const b = corners[index + 1];
    const edge = { x: b.x - a.x, y: b.y - a.y };
    const length = Math.hypot(edge.x, edge.y) || 1;
    return { x: -edge.y / length, y: edge.x / length };
  });
}

function project(corners: Point[], axis: Point): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (const corner of corners) {
    const value = corner.x * axis.x + corner.y * axis.y;
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  return { min, max };
}

/**
 * Signed separation between two rectangles: negative when they interpenetrate,
 * otherwise the width of the largest gap found across the candidate axes.
 */
function separation(a: OrientedRect, b: OrientedRect): number {
  const cornersA = cornersOf(a);
  const cornersB = cornersOf(b);
  const axes = [...axesOf(cornersA), ...axesOf(cornersB)];

  let best = -Infinity;
  for (const axis of axes) {
    const projectionA = project(cornersA, axis);
    const projectionB = project(cornersB, axis);
    const distance = Math.max(
      projectionA.min - projectionB.max,
      projectionB.min - projectionA.max,
    );
    best = Math.max(best, distance);
  }
  return best;
}

/** True when two footprints share interior area. Shapes that merely touch do not overlap. */
export function rectanglesOverlap(a: OrientedRect, b: OrientedRect): boolean {
  return separation(a, b) < -EPSILON;
}

/**
 * Clear distance between two footprints, in centimetres. Returns 0 when they
 * touch or overlap. For rotated rectangles this is the separating-axis
 * distance, which is exact for the axis-aligned case and a close, always
 * conservative estimate otherwise.
 */
export function gapBetween(a: OrientedRect, b: OrientedRect): number {
  return Math.max(0, separation(a, b));
}

export function rectContainsRect(container: Bounds, rect: OrientedRect): boolean {
  const bounds = boundsOf(rect);
  return (
    bounds.minX >= container.minX - EPSILON &&
    bounds.minY >= container.minY - EPSILON &&
    bounds.maxX <= container.maxX + EPSILON &&
    bounds.maxY <= container.maxY + EPSILON
  );
}

/** The footprint of `rect` after rotation, useful for axis-aligned reasoning. */
export function footprintSize(rect: OrientedRect): { width: number; depth: number } {
  const bounds = boundsOf(rect);
  return { width: bounds.maxX - bounds.minX, depth: bounds.maxY - bounds.minY };
}
