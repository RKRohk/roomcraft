import { clamp } from "./units";
import { normalizeAngle, type OrientedRect, type Point } from "./geometry";
import type { Opening, RoomDocument, WallId } from "./room";

/**
 * Openings live on a wall, described by a distance along that wall rather than
 * by room coordinates, so they survive room resizes and stay easy for an agent
 * to reason about. This module converts that description into geometry.
 */

export const MIN_OPENING_WIDTH_CM = 30;
export const MAX_OPENING_WIDTH_CM = 400;

interface WallFrame {
  /** Corner the offset is measured from. */
  origin: Point;
  /** Unit vector running along the wall in the direction of increasing offset. */
  along: Point;
  /** Unit vector pointing from the wall into the room. */
  inward: Point;
  lengthCm: number;
}

export function wallFrame(doc: RoomDocument, wall: WallId): WallFrame {
  const { widthCm, depthCm } = doc.room;
  switch (wall) {
    case "north":
      return {
        origin: { x: 0, y: 0 },
        along: { x: 1, y: 0 },
        inward: { x: 0, y: 1 },
        lengthCm: widthCm,
      };
    case "east":
      return {
        origin: { x: widthCm, y: 0 },
        along: { x: 0, y: 1 },
        inward: { x: -1, y: 0 },
        lengthCm: depthCm,
      };
    case "south":
      return {
        origin: { x: 0, y: depthCm },
        along: { x: 1, y: 0 },
        inward: { x: 0, y: -1 },
        lengthCm: widthCm,
      };
    case "west":
      return {
        origin: { x: 0, y: 0 },
        along: { x: 0, y: 1 },
        inward: { x: 1, y: 0 },
        lengthCm: depthCm,
      };
  }
}

export function wallLengthCm(doc: RoomDocument, wall: WallId): number {
  return wallFrame(doc, wall).lengthCm;
}

function pointAlong(frame: WallFrame, distance: number): Point {
  return {
    x: frame.origin.x + frame.along.x * distance,
    y: frame.origin.y + frame.along.y * distance,
  };
}

export interface WallSegment {
  start: Point;
  end: Point;
}

/** The opening's footprint on the wall, in room coordinates. */
export function openingSegment(doc: RoomDocument, opening: Opening): WallSegment {
  const frame = wallFrame(doc, opening.wall);
  return {
    start: pointAlong(frame, opening.offsetCm),
    end: pointAlong(frame, opening.offsetCm + opening.widthCm),
  };
}

/** Forces an opening to fit within its wall, trimming width before offset. */
export function clampOpening(doc: RoomDocument, opening: Opening): Opening {
  const length = wallLengthCm(doc, opening.wall);
  const widthCm = clamp(
    opening.widthCm,
    Math.min(MIN_OPENING_WIDTH_CM, length),
    Math.min(MAX_OPENING_WIDTH_CM, length),
  );
  const offsetCm = clamp(opening.offsetCm, 0, Math.max(0, length - widthCm));
  return { ...opening, widthCm, offsetCm };
}

export interface DoorSwingGeometry {
  /** Jamb the leaf pivots on. */
  hinge: Point;
  radiusCm: number;
  /** Angle of the closed leaf, in degrees (screen axes, clockwise positive). */
  startAngleDeg: number;
  /** Signed sweep to the fully open position: ±90°. */
  sweepDeg: number;
  /** Position of the leaf tip when fully open. */
  leafEnd: Point;
  /** True when the leaf sweeps into the room. */
  inward: boolean;
}

function angleOf(vector: Point): number {
  return normalizeAngle((Math.atan2(vector.y, vector.x) * 180) / Math.PI);
}

function signedDelta(from: number, to: number): number {
  const delta = normalizeAngle(to - from);
  return delta > 180 ? delta - 360 : delta;
}

/**
 * A door's leaf pivots on one jamb and sweeps a quarter circle of radius equal
 * to the opening width. `*-left` hinges on the jamb nearer the wall's start
 * corner, `*-right` on the far jamb.
 */
export function doorSwingGeometry(
  doc: RoomDocument,
  opening: Opening,
): DoorSwingGeometry | null {
  if (opening.kind !== "door") return null;

  const swing = opening.swing ?? "inward-right";
  const frame = wallFrame(doc, opening.wall);
  const segment = openingSegment(doc, opening);
  const hingeOnStart = swing.endsWith("left");
  const hinge = hingeOnStart ? segment.start : segment.end;
  const otherJamb = hingeOnStart ? segment.end : segment.start;
  const inward = swing.startsWith("inward");
  const openDirection = {
    x: frame.inward.x * (inward ? 1 : -1),
    y: frame.inward.y * (inward ? 1 : -1),
  };

  const startAngleDeg = angleOf({
    x: otherJamb.x - hinge.x,
    y: otherJamb.y - hinge.y,
  });
  const sweepDeg = signedDelta(startAngleDeg, angleOf(openDirection));

  return {
    hinge,
    radiusCm: opening.widthCm,
    startAngleDeg,
    sweepDeg,
    leafEnd: {
      x: hinge.x + openDirection.x * opening.widthCm,
      y: hinge.y + openDirection.y * opening.widthCm,
    },
    inward,
  };
}

/**
 * The floor area immediately inside a door that must stay walkable. Sized to
 * the door width in both axes, which covers the leaf sweep of an inward door
 * and the approach path of an outward one.
 */
export function openingClearanceRect(
  doc: RoomDocument,
  opening: Opening,
): OrientedRect | null {
  if (opening.kind !== "door") return null;

  const frame = wallFrame(doc, opening.wall);
  const segment = openingSegment(doc, opening);
  const midpoint = {
    x: (segment.start.x + segment.end.x) / 2,
    y: (segment.start.y + segment.end.y) / 2,
  };
  const depth = opening.widthCm;
  const horizontal = frame.along.x !== 0;

  return {
    x: midpoint.x + (frame.inward.x * depth) / 2,
    y: midpoint.y + (frame.inward.y * depth) / 2,
    width: horizontal ? opening.widthCm : depth,
    depth: horizontal ? depth : opening.widthCm,
    rotation: 0,
  };
}
