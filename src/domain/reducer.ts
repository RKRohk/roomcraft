import { getCatalogItem } from "./catalog";
import { normalizeAngle } from "./geometry";
import { clampOpening, MAX_OPENING_WIDTH_CM, MIN_OPENING_WIDTH_CM } from "./openings";
import { clampToRoom, findFreeSpot, snapPlacement } from "./placement";
import {
  MAX_ROOM_SIZE_CM,
  MIN_ROOM_SIZE_CM,
  type DoorSwing,
  type Opening,
  type OpeningKind,
  type PlacedFurniture,
  type RoomDocument,
  type RoomSettings,
  type WallId,
} from "./room";
import { clamp } from "./units";

/**
 * The one place a room document changes. Direct canvas interactions and WebMCP
 * tool calls both funnel through `applyAction`, so agents and humans share
 * identical semantics — and identical undo history.
 */

export interface ActionContext {
  now: number;
  nextId: (prefix: string) => string;
}

export interface LayoutItemInput {
  catalogId: string;
  xCm: number;
  yCm: number;
  rotationDeg?: number;
  colorId?: string;
  label?: string;
}

export type RoomAction =
  | { type: "set_room_dimensions"; widthCm?: number; depthCm?: number; wallThicknessCm?: number }
  | { type: "rename_room"; name: string }
  | { type: "set_settings"; patch: Partial<RoomSettings> }
  | {
      type: "add_opening";
      kind: OpeningKind;
      wall: WallId;
      offsetCm: number;
      widthCm: number;
      swing?: DoorSwing;
      sillHeightCm?: number;
    }
  | { type: "update_opening"; id: string; patch: Partial<Omit<Opening, "id">> }
  | { type: "remove_opening"; id: string }
  | {
      type: "add_furniture";
      catalogId: string;
      xCm?: number;
      yCm?: number;
      rotationDeg?: number;
      colorId?: string;
      label?: string;
    }
  | {
      type: "update_furniture";
      id: string;
      patch: Partial<Omit<PlacedFurniture, "id" | "catalogId">>;
    }
  | { type: "remove_furniture"; ids: string[] }
  | { type: "duplicate_furniture"; ids: string[] }
  | { type: "apply_layout"; mode: "replace" | "merge"; items: LayoutItemInput[] }
  | { type: "load_document"; document: RoomDocument };

function touch(doc: RoomDocument, ctx: ActionContext): RoomDocument {
  return { ...doc, updatedAt: ctx.now };
}

/** Re-settles openings and furniture after the room itself changes. */
function reflow(doc: RoomDocument): RoomDocument {
  return {
    ...doc,
    openings: doc.openings.map((opening) => clampOpening(doc, opening)),
    furniture: doc.furniture.map((placed) => clampToRoom(doc, placed)),
  };
}

function normalizePlacement(doc: RoomDocument, placed: PlacedFurniture): PlacedFurniture {
  return clampToRoom(doc, snapPlacement(doc, { ...placed, rotationDeg: normalizeAngle(placed.rotationDeg) }));
}

export function applyAction(
  doc: RoomDocument,
  action: RoomAction,
  ctx: ActionContext,
): RoomDocument {
  switch (action.type) {
    case "set_room_dimensions": {
      const resized: RoomDocument = {
        ...doc,
        room: {
          widthCm: clamp(action.widthCm ?? doc.room.widthCm, MIN_ROOM_SIZE_CM, MAX_ROOM_SIZE_CM),
          depthCm: clamp(action.depthCm ?? doc.room.depthCm, MIN_ROOM_SIZE_CM, MAX_ROOM_SIZE_CM),
          wallThicknessCm: clamp(
            action.wallThicknessCm ?? doc.room.wallThicknessCm,
            5,
            60,
          ),
        },
      };
      return touch(reflow(resized), ctx);
    }

    case "rename_room":
      return touch({ ...doc, name: action.name.trim() || doc.name }, ctx);

    case "set_settings": {
      const patch = action.patch;
      return touch(
        {
          ...doc,
          settings: {
            clearanceCm: clamp(patch.clearanceCm ?? doc.settings.clearanceCm, 0, 300),
            gridCm: clamp(patch.gridCm ?? doc.settings.gridCm, 1, 100),
            snapToGrid: patch.snapToGrid ?? doc.settings.snapToGrid,
          },
        },
        ctx,
      );
    }

    case "add_opening": {
      const opening = clampOpening(doc, {
        id: ctx.nextId("opening"),
        kind: action.kind,
        wall: action.wall,
        offsetCm: action.offsetCm,
        widthCm: clamp(action.widthCm, MIN_OPENING_WIDTH_CM, MAX_OPENING_WIDTH_CM),
        ...(action.kind === "door"
          ? { swing: action.swing ?? "inward-right" }
          : { sillHeightCm: action.sillHeightCm ?? 90 }),
      });
      return touch({ ...doc, openings: [...doc.openings, opening] }, ctx);
    }

    case "update_opening": {
      const openings = doc.openings.map((opening) =>
        opening.id === action.id ? clampOpening(doc, { ...opening, ...action.patch }) : opening,
      );
      return touch({ ...doc, openings }, ctx);
    }

    case "remove_opening":
      return touch(
        { ...doc, openings: doc.openings.filter((opening) => opening.id !== action.id) },
        ctx,
      );

    case "add_furniture": {
      const item = getCatalogItem(action.catalogId);
      if (!item) return doc;

      const candidate: PlacedFurniture = {
        id: ctx.nextId("furniture"),
        catalogId: action.catalogId,
        xCm: action.xCm ?? doc.room.widthCm / 2,
        yCm: action.yCm ?? doc.room.depthCm / 2,
        rotationDeg: normalizeAngle(action.rotationDeg ?? 0),
        ...(action.colorId ? { colorId: action.colorId } : {}),
        ...(action.label ? { label: action.label } : {}),
      };
      const placed = findFreeSpot(doc, snapPlacement(doc, candidate));
      return touch({ ...doc, furniture: [...doc.furniture, placed] }, ctx);
    }

    case "update_furniture": {
      const furniture = doc.furniture.map((placed) =>
        placed.id === action.id && (!placed.locked || action.patch.locked === false)
          ? normalizePlacement(doc, { ...placed, ...action.patch })
          : placed,
      );
      return touch({ ...doc, furniture }, ctx);
    }

    case "remove_furniture": {
      const removing = new Set(action.ids);
      return touch(
        { ...doc, furniture: doc.furniture.filter((placed) => !removing.has(placed.id) || placed.locked) },
        ctx,
      );
    }

    case "duplicate_furniture": {
      const offset = Math.max(doc.settings.gridCm, 20);
      const copies: PlacedFurniture[] = [];
      let working = doc;
      for (const id of action.ids) {
        const source = doc.furniture.find((placed) => placed.id === id);
        if (!source || source.locked) continue;
        const copy = findFreeSpot(working, {
          ...source,
          id: ctx.nextId("furniture"),
          xCm: source.xCm + offset,
          yCm: source.yCm + offset,
        });
        copies.push(copy);
        working = { ...working, furniture: [...working.furniture, copy] };
      }
      if (copies.length === 0) return doc;
      return touch({ ...doc, furniture: [...doc.furniture, ...copies] }, ctx);
    }

    case "apply_layout": {
      let working: RoomDocument =
        action.mode === "replace" ? { ...doc, furniture: [] } : doc;

      for (const item of action.items) {
        working = applyAction(
          working,
          {
            type: "add_furniture",
            catalogId: item.catalogId,
            xCm: item.xCm,
            yCm: item.yCm,
            rotationDeg: item.rotationDeg,
            colorId: item.colorId,
            label: item.label,
          },
          ctx,
        );
      }
      return touch(working, ctx);
    }

    case "load_document":
      return action.document;

    default:
      return doc;
  }
}
