import { getCatalogItem } from "./catalog";
import { createEditorState, type EditorState, type LayoutVariant } from "./editorState";
import { clampOpening } from "./openings";
import type { ActionContext } from "./reducer";
import {
  DEFAULT_CLEARANCE_CM,
  DEFAULT_GRID_CM,
  DEFAULT_WALL_THICKNESS_CM,
  MAX_ROOM_SIZE_CM,
  MIN_ROOM_SIZE_CM,
  ROOM_DOCUMENT_VERSION,
  WALL_IDS,
  type Opening,
  type PlacedFurniture,
  type RoomDocument,
} from "./room";
import { clamp } from "./units";

/**
 * Browser-local persistence. Parsing is deliberately defensive: a stored
 * document is untrusted input, so every field is validated or defaulted and a
 * hopeless payload is discarded rather than crashing the editor.
 */

export const STORAGE_KEY = "roomcraft:v1";
export const PERSISTED_VERSION = 1 as const;

export interface PersistedState {
  version: typeof PERSISTED_VERSION;
  savedAt: number;
  document: RoomDocument;
  variants: LayoutVariant[];
  activeVariantId: string | null;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function toPersisted(state: EditorState): PersistedState {
  return {
    version: PERSISTED_VERSION,
    savedAt: state.present.updatedAt,
    document: state.present,
    variants: state.variants,
    activeVariantId: state.activeVariantId,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function num(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function str(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function migrateFurniture(value: unknown): PlacedFurniture | null {
  if (!isRecord(value)) return null;
  const catalogId = typeof value.catalogId === "string" ? value.catalogId : "";
  // Items pulled from the catalog since the save are dropped rather than kept
  // as unrenderable ghosts.
  if (!getCatalogItem(catalogId)) return null;

  return {
    id: str(value.id, `furniture-${Math.random().toString(36).slice(2, 10)}`),
    catalogId,
    xCm: num(value.xCm, 0),
    yCm: num(value.yCm, 0),
    rotationDeg: num(value.rotationDeg, 0),
    ...(typeof value.label === "string" ? { label: value.label } : {}),
    ...(typeof value.colorId === "string" ? { colorId: value.colorId } : {}),
    ...(typeof value.locked === "boolean" ? { locked: value.locked } : {}),
  };
}

function migrateOpening(value: unknown): Opening | null {
  if (!isRecord(value)) return null;
  const kind = value.kind === "window" ? "window" : "door";
  const wall = WALL_IDS.find((candidate) => candidate === value.wall);
  if (!wall) return null;

  return {
    id: str(value.id, `opening-${Math.random().toString(36).slice(2, 10)}`),
    kind,
    wall,
    offsetCm: num(value.offsetCm, 0),
    widthCm: num(value.widthCm, 80),
    ...(kind === "door"
      ? { swing: (str(value.swing, "inward-right") as Opening["swing"]) }
      : { sillHeightCm: num(value.sillHeightCm, 90) }),
  };
}

/** Brings a stored document up to the current shape, or returns null if unusable. */
export function migrateDocument(value: unknown): RoomDocument | null {
  if (!isRecord(value) || !isRecord(value.room)) return null;

  const widthCm = num(value.room.widthCm, NaN);
  const depthCm = num(value.room.depthCm, NaN);
  if (!Number.isFinite(widthCm) || !Number.isFinite(depthCm)) return null;

  const settings = isRecord(value.settings) ? value.settings : {};
  const now = num(value.updatedAt, Date.now());

  const doc: RoomDocument = {
    version: ROOM_DOCUMENT_VERSION,
    id: str(value.id, `room-${Math.random().toString(36).slice(2, 10)}`),
    name: str(value.name, "Untitled room"),
    room: {
      widthCm: clamp(widthCm, MIN_ROOM_SIZE_CM, MAX_ROOM_SIZE_CM),
      depthCm: clamp(depthCm, MIN_ROOM_SIZE_CM, MAX_ROOM_SIZE_CM),
      wallThicknessCm: clamp(
        num(value.room.wallThicknessCm, DEFAULT_WALL_THICKNESS_CM),
        5,
        60,
      ),
    },
    openings: [],
    furniture: Array.isArray(value.furniture)
      ? value.furniture.map(migrateFurniture).filter((item): item is PlacedFurniture => item !== null)
      : [],
    settings: {
      clearanceCm: clamp(num(settings.clearanceCm, DEFAULT_CLEARANCE_CM), 0, 300),
      gridCm: clamp(num(settings.gridCm, DEFAULT_GRID_CM), 1, 100),
      snapToGrid: typeof settings.snapToGrid === "boolean" ? settings.snapToGrid : true,
    },
    createdAt: num(value.createdAt, now),
    updatedAt: now,
  };

  const openings = Array.isArray(value.openings)
    ? value.openings.map(migrateOpening).filter((item): item is Opening => item !== null)
    : [];
  doc.openings = openings.map((opening) => clampOpening(doc, opening));

  return doc;
}

function migrateVariant(value: unknown): LayoutVariant | null {
  if (!isRecord(value)) return null;
  const document = migrateDocument(value.document);
  if (!document) return null;
  return {
    id: str(value.id, `variant-${Math.random().toString(36).slice(2, 10)}`),
    name: str(value.name, "Variant"),
    createdAt: num(value.createdAt, document.updatedAt),
    document,
  };
}

/** Parses a stored payload. Returns null when it cannot be trusted. */
export function parsePersisted(raw: string): PersistedState | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isRecord(parsed) || parsed.version !== PERSISTED_VERSION) return null;

  const document = migrateDocument(parsed.document);
  if (!document) return null;

  const variants = Array.isArray(parsed.variants)
    ? parsed.variants.map(migrateVariant).filter((item): item is LayoutVariant => item !== null)
    : [];
  const activeVariantId =
    typeof parsed.activeVariantId === "string" &&
    variants.some((variant) => variant.id === parsed.activeVariantId)
      ? parsed.activeVariantId
      : null;

  return {
    version: PERSISTED_VERSION,
    savedAt: num(parsed.savedAt, document.updatedAt),
    document,
    variants,
    activeVariantId,
  };
}

/** Loads state from storage, falling back to a fresh document on any problem. */
export function loadEditorState(storage: StorageLike, ctx: ActionContext): EditorState {
  const fresh = createEditorState(ctx);
  let raw: string | null = null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return fresh;
  }
  if (!raw) return fresh;

  const parsed = parsePersisted(raw);
  if (!parsed) return fresh;

  return {
    ...fresh,
    present: parsed.document,
    variants: parsed.variants,
    activeVariantId: parsed.activeVariantId,
  };
}

/** Persists state. Storage failures (private mode, quota) are non-fatal. */
export function saveEditorState(storage: StorageLike, state: EditorState): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(toPersisted(state)));
  } catch {
    // Persistence is best-effort; the in-memory session keeps working.
  }
}
