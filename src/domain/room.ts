import type { Bounds } from "./geometry";

/**
 * The room document is the single serialisable unit of truth. Everything the
 * canvas draws and every WebMCP tool mutates lives here, versioned so stored
 * documents can be migrated forward.
 */
export const ROOM_DOCUMENT_VERSION = 1 as const;

export const MIN_ROOM_SIZE_CM = 150;
export const MAX_ROOM_SIZE_CM = 2000;
export const DEFAULT_ROOM_WIDTH_CM = 480;
export const DEFAULT_ROOM_DEPTH_CM = 360;
export const DEFAULT_WALL_THICKNESS_CM = 12;
export const DEFAULT_CLEARANCE_CM = 75;
export const DEFAULT_GRID_CM = 10;

export type WallId = "north" | "east" | "south" | "west";
export const WALL_IDS: readonly WallId[] = ["north", "east", "south", "west"];

export type OpeningKind = "door" | "window";

/** Which side the leaf swings to, viewed from inside the room, plus the hinge side. */
export type DoorSwing =
  | "inward-left"
  | "inward-right"
  | "outward-left"
  | "outward-right";

export interface Opening {
  id: string;
  kind: OpeningKind;
  wall: WallId;
  /** Distance in cm from the wall's start corner to the opening's start edge. */
  offsetCm: number;
  widthCm: number;
  /** Doors only. */
  swing?: DoorSwing;
  /** Windows only, height of the sill above the floor. */
  sillHeightCm?: number;
}

export interface PlacedFurniture {
  id: string;
  catalogId: string;
  /** Centre of the footprint, in room coordinates. */
  xCm: number;
  yCm: number;
  /** Clockwise degrees; 0 means the item faces "down" the room (towards +y). */
  rotationDeg: number;
  /** Optional per-instance overrides. */
  label?: string;
  colorId?: string;
  locked?: boolean;
}

export interface RoomSettings {
  /** Minimum walkway gap before a clearance warning is raised. */
  clearanceCm: number;
  /** Snap grid size in cm. */
  gridCm: number;
  snapToGrid: boolean;
}

export interface RoomDocument {
  version: typeof ROOM_DOCUMENT_VERSION;
  id: string;
  name: string;
  room: {
    widthCm: number;
    depthCm: number;
    wallThicknessCm: number;
  };
  openings: Opening[];
  furniture: PlacedFurniture[];
  settings: RoomSettings;
  createdAt: number;
  updatedAt: number;
}

export interface CreateRoomOptions {
  id: string;
  createdAt: number;
  name?: string;
  widthCm?: number;
  depthCm?: number;
  wallThicknessCm?: number;
}

export function createRoomDocument(options: CreateRoomOptions): RoomDocument {
  return {
    version: ROOM_DOCUMENT_VERSION,
    id: options.id,
    name: options.name ?? "Untitled room",
    room: {
      widthCm: options.widthCm ?? DEFAULT_ROOM_WIDTH_CM,
      depthCm: options.depthCm ?? DEFAULT_ROOM_DEPTH_CM,
      wallThicknessCm: options.wallThicknessCm ?? DEFAULT_WALL_THICKNESS_CM,
    },
    openings: [],
    furniture: [],
    settings: {
      clearanceCm: DEFAULT_CLEARANCE_CM,
      gridCm: DEFAULT_GRID_CM,
      snapToGrid: true,
    },
    createdAt: options.createdAt,
    updatedAt: options.createdAt,
  };
}

/** Interior floor area of the room, in room coordinates. */
export function interiorBounds(doc: RoomDocument): Bounds {
  return { minX: 0, minY: 0, maxX: doc.room.widthCm, maxY: doc.room.depthCm };
}

export interface RoomSummary {
  widthCm: number;
  depthCm: number;
  areaM2: number;
  openings: number;
  furniture: number;
}

/** A compact digest, small enough to hand straight back to an agent. */
export function roomSummary(doc: RoomDocument): RoomSummary {
  return {
    widthCm: doc.room.widthCm,
    depthCm: doc.room.depthCm,
    areaM2: Math.round((doc.room.widthCm * doc.room.depthCm) / 100) / 100,
    openings: doc.openings.length,
    furniture: doc.furniture.length,
  };
}
