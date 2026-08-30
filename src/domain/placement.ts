import { getCatalogItem } from "./catalog";
import {
  boundsOf,
  normalizeAngle,
  rectanglesOverlap,
  type OrientedRect,
} from "./geometry";
import { interiorBounds, type PlacedFurniture, type RoomDocument } from "./room";
import { clamp, roundToStep } from "./units";

/**
 * Bridges catalog dimensions and placed instances. Everything here is pure so
 * both the canvas and the WebMCP tools can share the same placement rules.
 */

/** The footprint a placed item occupies, or null when its catalog id is unknown. */
export function footprintOf(placed: PlacedFurniture): OrientedRect | null {
  const item = getCatalogItem(placed.catalogId);
  if (!item) return null;
  return {
    x: placed.xCm,
    y: placed.yCm,
    width: item.widthCm,
    depth: item.depthCm,
    rotation: normalizeAngle(placed.rotationDeg),
  };
}

/** Footprints for every resolvable item in the document. */
export function footprints(doc: RoomDocument): Array<{
  placed: PlacedFurniture;
  rect: OrientedRect;
}> {
  const result: Array<{ placed: PlacedFurniture; rect: OrientedRect }> = [];
  for (const placed of doc.furniture) {
    const rect = footprintOf(placed);
    if (rect) result.push({ placed, rect });
  }
  return result;
}

/** Keeps a centre point inside the room for the item's current rotation. */
export function clampToRoom(doc: RoomDocument, placed: PlacedFurniture): PlacedFurniture {
  const rect = footprintOf(placed);
  if (!rect) return placed;

  const bounds = boundsOf(rect);
  const halfWidth = (bounds.maxX - bounds.minX) / 2;
  const halfDepth = (bounds.maxY - bounds.minY) / 2;
  const room = interiorBounds(doc);

  // An oversized item is centred rather than clamped to an impossible range.
  const xCm =
    halfWidth * 2 > room.maxX
      ? room.maxX / 2
      : clamp(placed.xCm, room.minX + halfWidth, room.maxX - halfWidth);
  const yCm =
    halfDepth * 2 > room.maxY
      ? room.maxY / 2
      : clamp(placed.yCm, room.minY + halfDepth, room.maxY - halfDepth);

  return { ...placed, xCm, yCm };
}

/** Applies the document's grid snapping to a centre point. */
export function snapPlacement(doc: RoomDocument, placed: PlacedFurniture): PlacedFurniture {
  if (!doc.settings.snapToGrid) return placed;
  const step = doc.settings.gridCm;
  return {
    ...placed,
    xCm: roundToStep(placed.xCm, step),
    yCm: roundToStep(placed.yCm, step),
  };
}

/**
 * Finds a free spot for a new item: tries the requested centre, then walks a
 * coarse grid of candidate positions, then falls back to the room centre.
 */
export function findFreeSpot(
  doc: RoomDocument,
  candidate: PlacedFurniture,
): PlacedFurniture {
  const existing = footprints(doc).map((entry) => entry.rect);
  const isFree = (placed: PlacedFurniture) => {
    const rect = footprintOf(placed);
    if (!rect) return true;
    return !existing.some((other) => rectanglesOverlap(rect, other));
  };

  const start = clampToRoom(doc, candidate);
  if (isFree(start)) return start;

  const step = Math.max(doc.settings.gridCm, 20);
  for (let ring = 1; ring <= 24; ring += 1) {
    for (const [dx, dy] of [
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
      [1, 1],
      [-1, 1],
      [1, -1],
      [-1, -1],
    ]) {
      const moved = clampToRoom(doc, {
        ...start,
        xCm: start.xCm + dx * ring * step,
        yCm: start.yCm + dy * ring * step,
      });
      if (isFree(moved)) return moved;
    }
  }
  return start;
}
