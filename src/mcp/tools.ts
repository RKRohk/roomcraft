import { CATEGORIES, STYLES, getCatalogItem, type CatalogItem } from "@/domain/catalog";
import { searchCatalog } from "@/domain/catalogSearch";
import type { EditorAction, EditorState } from "@/domain/editorState";
import { doorSwingGeometry } from "@/domain/openings";
import type { LayoutItemInput } from "@/domain/reducer";
import { WALL_IDS, type RoomDocument } from "@/domain/room";
import { roomSummary } from "@/domain/room";
import { validateLayout } from "@/domain/validation";

/**
 * WebMCP tool surface. Each tool is a pure function of a store handle, so the
 * exact same definitions can be registered against `document.modelContext` in
 * the browser or exercised directly in tests. Every mutation goes through the
 * editor reducer, which means an agent's edits land in the same undo history
 * as a drag on the canvas.
 */

export interface RoomToolStore {
  getState(): EditorState;
  dispatch(action: EditorAction): void;
}

export interface ToolTextContent {
  type: "text";
  text: string;
}

export interface ToolResponse {
  content: ToolTextContent[];
  structuredContent?: unknown;
  isError?: boolean;
}

export interface JsonSchema {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties: false;
}

export interface RoomTool {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  execute(args: unknown): Promise<ToolResponse>;
}

export const ROOM_TOOL_NAMES = [
  "get_room_state",
  "set_room_dimensions",
  "add_opening",
  "search_furniture",
  "place_furniture",
  "update_furniture",
  "remove_furniture",
  "apply_layout",
  "validate_layout",
  "save_layout_variant",
  "activate_layout_variant",
  "undo_last_change",
] as const;

export type RoomToolName = (typeof ROOM_TOOL_NAMES)[number];

// ---------------------------------------------------------------- responses

function ok(structuredContent: unknown): ToolResponse {
  return {
    content: [{ type: "text", text: JSON.stringify(structuredContent) }],
    structuredContent,
  };
}

function fail(message: string): ToolResponse {
  return {
    content: [{ type: "text", text: message }],
    structuredContent: { error: message },
    isError: true,
  };
}

class ToolInputError extends Error {}

// --------------------------------------------------------------- validation

function record(args: unknown): Record<string, unknown> {
  if (args === undefined || args === null) return {};
  if (typeof args !== "object" || Array.isArray(args)) {
    throw new ToolInputError("Arguments must be a JSON object.");
  }
  return args as Record<string, unknown>;
}

function optionalNumber(
  args: Record<string, unknown>,
  key: string,
  range?: { min?: number; max?: number },
): number | undefined {
  const value = args[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ToolInputError(`"${key}" must be a finite number.`);
  }
  if (range?.min !== undefined && value < range.min) {
    throw new ToolInputError(`"${key}" must be at least ${range.min}.`);
  }
  if (range?.max !== undefined && value > range.max) {
    throw new ToolInputError(`"${key}" must be at most ${range.max}.`);
  }
  return value;
}

function requiredNumber(
  args: Record<string, unknown>,
  key: string,
  range?: { min?: number; max?: number },
): number {
  const value = optionalNumber(args, key, range);
  if (value === undefined) throw new ToolInputError(`"${key}" is required.`);
  return value;
}

function optionalString(args: Record<string, unknown>, key: string): string | undefined {
  const value = args[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") throw new ToolInputError(`"${key}" must be a string.`);
  return value;
}

function requiredString(args: Record<string, unknown>, key: string): string {
  const value = optionalString(args, key);
  if (value === undefined || value.trim() === "") {
    throw new ToolInputError(`"${key}" is required.`);
  }
  return value;
}

function optionalEnum<T extends string>(
  args: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
): T | undefined {
  const value = optionalString(args, key);
  if (value === undefined) return undefined;
  if (!allowed.includes(value as T)) {
    throw new ToolInputError(`"${key}" must be one of: ${allowed.join(", ")}.`);
  }
  return value as T;
}

function requiredEnum<T extends string>(
  args: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
): T {
  const value = optionalEnum(args, key, allowed);
  if (value === undefined) throw new ToolInputError(`"${key}" is required.`);
  return value;
}

function optionalStringArray(args: Record<string, unknown>, key: string): string[] | undefined {
  const value = args[key];
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new ToolInputError(`"${key}" must be an array of strings.`);
  }
  return value as string[];
}

// ------------------------------------------------------------- projections

const SWINGS = ["inward-left", "inward-right", "outward-left", "outward-right"] as const;

function catalogSummary(item: CatalogItem) {
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    style: item.style,
    widthCm: item.widthCm,
    depthCm: item.depthCm,
    heightCm: item.heightCm,
    priceMinor: item.priceMinor,
  };
}

function furnitureView(doc: RoomDocument) {
  return doc.furniture.map((placed) => {
    const item = getCatalogItem(placed.catalogId);
    return {
      id: placed.id,
      catalogId: placed.catalogId,
      name: item?.name ?? placed.catalogId,
      xCm: placed.xCm,
      yCm: placed.yCm,
      rotationDeg: placed.rotationDeg,
      widthCm: item?.widthCm ?? 0,
      depthCm: item?.depthCm ?? 0,
      ...(placed.label ? { label: placed.label } : {}),
      ...(placed.colorId ? { colorId: placed.colorId } : {}),
    };
  });
}

function openingView(doc: RoomDocument) {
  return doc.openings.map((opening) => ({
    id: opening.id,
    kind: opening.kind,
    wall: opening.wall,
    offsetCm: opening.offsetCm,
    widthCm: opening.widthCm,
    ...(opening.swing ? { swing: opening.swing } : {}),
    ...(opening.sillHeightCm !== undefined ? { sillHeightCm: opening.sillHeightCm } : {}),
    ...(opening.kind === "door"
      ? { swingsInward: doorSwingGeometry(doc, opening)?.inward ?? true }
      : {}),
  }));
}

function stateView(state: EditorState, includeIssues: boolean) {
  const doc = state.present;
  const view: Record<string, unknown> = {
    name: doc.name,
    room: {
      widthCm: doc.room.widthCm,
      depthCm: doc.room.depthCm,
      wallThicknessCm: doc.room.wallThicknessCm,
    },
    settings: doc.settings,
    summary: roomSummary(doc),
    openings: openingView(doc),
    furniture: furnitureView(doc),
    variants: state.variants.map((variant) => ({ id: variant.id, name: variant.name })),
    canUndo: state.past.length > 0,
  };
  if (includeIssues) view.issues = validationView(doc);
  return view;
}

function validationView(doc: RoomDocument) {
  const result = validateLayout(doc);
  return {
    ok: result.ok,
    errorCount: result.errorCount,
    warningCount: result.warningCount,
    issues: result.issues.map((issue) => ({
      code: issue.code,
      severity: issue.severity,
      message: issue.message,
      furnitureIds: issue.furnitureIds,
      ...(issue.openingId ? { openingId: issue.openingId } : {}),
      ...(issue.measuredCm !== undefined ? { measuredCm: issue.measuredCm } : {}),
    })),
  };
}

// -------------------------------------------------------------------- tools

const NUMBER = { type: "number" } as const;

export function createRoomTools(store: RoomToolStore): RoomTool[] {
  const define = (
    name: RoomToolName,
    description: string,
    inputSchema: JsonSchema,
    handler: (args: Record<string, unknown>) => ToolResponse,
  ): RoomTool => ({
    name,
    description,
    inputSchema,
    async execute(args: unknown) {
      try {
        return handler(record(args));
      } catch (error) {
        if (error instanceof ToolInputError) return fail(error.message);
        return fail(error instanceof Error ? error.message : "Unexpected tool failure.");
      }
    },
  });

  return [
    define(
      "get_room_state",
      "Read the current room: dimensions, settings, doors and windows, placed furniture, saved variants and (optionally) validation issues.",
      {
        type: "object",
        properties: {
          includeIssues: {
            type: "boolean",
            description: "Include the validation report alongside the layout.",
          },
        },
        additionalProperties: false,
      },
      (args) => {
        const includeIssues = args.includeIssues === true;
        return ok(stateView(store.getState(), includeIssues));
      },
    ),

    define(
      "set_room_dimensions",
      "Resize the room. Dimensions are interior measurements in centimetres; existing furniture and openings are pulled back inside.",
      {
        type: "object",
        properties: {
          widthCm: { ...NUMBER, minimum: 150, maximum: 2000, description: "Interior width in cm." },
          depthCm: { ...NUMBER, minimum: 150, maximum: 2000, description: "Interior depth in cm." },
          wallThicknessCm: { ...NUMBER, minimum: 5, maximum: 60 },
        },
        additionalProperties: false,
      },
      (args) => {
        const widthCm = optionalNumber(args, "widthCm", { min: 150, max: 2000 });
        const depthCm = optionalNumber(args, "depthCm", { min: 150, max: 2000 });
        const wallThicknessCm = optionalNumber(args, "wallThicknessCm", { min: 5, max: 60 });
        if (widthCm === undefined && depthCm === undefined && wallThicknessCm === undefined) {
          throw new ToolInputError("Provide at least one of widthCm, depthCm or wallThicknessCm.");
        }
        store.dispatch({
          kind: "document",
          action: { type: "set_room_dimensions", widthCm, depthCm, wallThicknessCm },
        });
        return ok(stateView(store.getState(), false));
      },
    ),

    define(
      "add_opening",
      "Add a door or window to a wall. offsetCm is measured along the wall from its start corner (north/south from the west end, east/west from the north end).",
      {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["door", "window"] },
          wall: { type: "string", enum: [...WALL_IDS] },
          offsetCm: { ...NUMBER, minimum: 0 },
          widthCm: { ...NUMBER, minimum: 30, maximum: 400 },
          swing: { type: "string", enum: [...SWINGS], description: "Doors only." },
          sillHeightCm: { ...NUMBER, minimum: 0, description: "Windows only." },
        },
        required: ["kind", "wall", "offsetCm", "widthCm"],
        additionalProperties: false,
      },
      (args) => {
        const kind = requiredEnum(args, "kind", ["door", "window"] as const);
        const wall = requiredEnum(args, "wall", WALL_IDS);
        const offsetCm = requiredNumber(args, "offsetCm", { min: 0 });
        const widthCm = requiredNumber(args, "widthCm", { min: 30, max: 400 });
        const swing = optionalEnum(args, "swing", SWINGS);
        const sillHeightCm = optionalNumber(args, "sillHeightCm", { min: 0 });

        const before = new Set(store.getState().present.openings.map((o) => o.id));
        store.dispatch({
          kind: "document",
          action: { type: "add_opening", kind, wall, offsetCm, widthCm, swing, sillHeightCm },
        });
        const doc = store.getState().present;
        const created = doc.openings.find((opening) => !before.has(opening.id));
        return ok({
          opening: created ? openingView(doc).find((view) => view.id === created.id) : null,
          issues: validationView(doc),
        });
      },
    ),

    define(
      "search_furniture",
      "Search the local furniture catalog by keywords, category, style, footprint or price. Returns catalog ids to pass to place_furniture.",
      {
        type: "object",
        properties: {
          query: { type: "string", description: "Free text matched against name and tags." },
          category: { type: "string", enum: [...CATEGORIES] },
          style: { type: "string", enum: [...STYLES] },
          maxWidthCm: { ...NUMBER, minimum: 1 },
          maxDepthCm: { ...NUMBER, minimum: 1 },
          maxPriceMinor: { ...NUMBER, minimum: 0 },
          limit: { type: "integer", minimum: 1, maximum: 40 },
        },
        additionalProperties: false,
      },
      (args) => {
        const results = searchCatalog({
          query: optionalString(args, "query"),
          category: optionalEnum(args, "category", CATEGORIES),
          style: optionalEnum(args, "style", STYLES),
          maxWidthCm: optionalNumber(args, "maxWidthCm", { min: 1 }),
          maxDepthCm: optionalNumber(args, "maxDepthCm", { min: 1 }),
          maxPriceMinor: optionalNumber(args, "maxPriceMinor", { min: 0 }),
          limit: optionalNumber(args, "limit", { min: 1, max: 40 }),
        });
        return ok({ count: results.length, results: results.map(catalogSummary) });
      },
    ),

    define(
      "place_furniture",
      "Place a catalog item in the room. Coordinates are the item's centre in centimetres from the room's top-left corner; omitted coordinates default to the room centre and collisions are nudged to a free spot.",
      {
        type: "object",
        properties: {
          catalogId: { type: "string", description: "Catalog id from search_furniture." },
          xCm: NUMBER,
          yCm: NUMBER,
          rotationDeg: { ...NUMBER, description: "Clockwise degrees; 0 faces the south wall." },
          colorId: { type: "string" },
          label: { type: "string" },
        },
        required: ["catalogId"],
        additionalProperties: false,
      },
      (args) => {
        const catalogId = requiredString(args, "catalogId");
        if (!getCatalogItem(catalogId)) {
          return fail(`Unknown catalogId "${catalogId}". Use search_furniture to find valid ids.`);
        }
        const before = new Set(store.getState().present.furniture.map((item) => item.id));
        store.dispatch({
          kind: "document",
          action: {
            type: "add_furniture",
            catalogId,
            xCm: optionalNumber(args, "xCm"),
            yCm: optionalNumber(args, "yCm"),
            rotationDeg: optionalNumber(args, "rotationDeg"),
            colorId: optionalString(args, "colorId"),
            label: optionalString(args, "label"),
          },
        });
        const doc = store.getState().present;
        const created = doc.furniture.find((item) => !before.has(item.id));
        return ok({
          placed: created ? furnitureView(doc).find((view) => view.id === created.id) : null,
          issues: validationView(doc),
        });
      },
    ),

    define(
      "update_furniture",
      "Move, rotate, relabel or recolour one placed item. Only the supplied fields change.",
      {
        type: "object",
        properties: {
          id: { type: "string", description: "Instance id from get_room_state." },
          xCm: NUMBER,
          yCm: NUMBER,
          rotationDeg: NUMBER,
          colorId: { type: "string" },
          label: { type: "string" },
        },
        required: ["id"],
        additionalProperties: false,
      },
      (args) => {
        const id = requiredString(args, "id");
        if (!store.getState().present.furniture.some((item) => item.id === id)) {
          return fail(`No placed furniture with id "${id}".`);
        }
        const patch = {
          xCm: optionalNumber(args, "xCm"),
          yCm: optionalNumber(args, "yCm"),
          rotationDeg: optionalNumber(args, "rotationDeg"),
          colorId: optionalString(args, "colorId"),
          label: optionalString(args, "label"),
        };
        const cleaned = Object.fromEntries(
          Object.entries(patch).filter(([, value]) => value !== undefined),
        );
        if (Object.keys(cleaned).length === 0) {
          throw new ToolInputError("Provide at least one field to update.");
        }
        store.dispatch({ kind: "document", action: { type: "update_furniture", id, patch: cleaned } });
        const doc = store.getState().present;
        return ok({
          updated: furnitureView(doc).find((view) => view.id === id),
          issues: validationView(doc),
        });
      },
    ),

    define(
      "remove_furniture",
      "Remove one or more placed items by instance id.",
      {
        type: "object",
        properties: {
          ids: { type: "array", items: { type: "string" }, minItems: 1 },
        },
        required: ["ids"],
        additionalProperties: false,
      },
      (args) => {
        const ids = optionalStringArray(args, "ids");
        if (!ids || ids.length === 0) throw new ToolInputError('"ids" is required.');

        const present = new Set(store.getState().present.furniture.map((item) => item.id));
        const known = ids.filter((id) => present.has(id));
        if (known.length === 0) return fail("None of the supplied ids are placed in the room.");

        store.dispatch({ kind: "document", action: { type: "remove_furniture", ids: known } });
        const doc = store.getState().present;
        return ok({
          removedIds: known,
          skippedIds: ids.filter((id) => !present.has(id)),
          issues: validationView(doc),
        });
      },
    ),

    define(
      "apply_layout",
      "Place a whole layout at once. mode 'replace' clears existing furniture first, 'merge' adds to it.",
      {
        type: "object",
        properties: {
          mode: { type: "string", enum: ["replace", "merge"] },
          items: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              properties: {
                catalogId: { type: "string" },
                xCm: NUMBER,
                yCm: NUMBER,
                rotationDeg: NUMBER,
                colorId: { type: "string" },
                label: { type: "string" },
              },
              required: ["catalogId", "xCm", "yCm"],
              additionalProperties: false,
            },
          },
        },
        required: ["items"],
        additionalProperties: false,
      },
      (args) => {
        const mode = optionalEnum(args, "mode", ["replace", "merge"] as const) ?? "replace";
        const rawItems = args.items;
        if (!Array.isArray(rawItems) || rawItems.length === 0) {
          throw new ToolInputError('"items" must be a non-empty array.');
        }

        const items: LayoutItemInput[] = rawItems.map((entry, index) => {
          const item = record(entry);
          const catalogId = requiredString(item, "catalogId");
          if (!getCatalogItem(catalogId)) {
            throw new ToolInputError(`items[${index}]: unknown catalogId "${catalogId}".`);
          }
          return {
            catalogId,
            xCm: requiredNumber(item, "xCm"),
            yCm: requiredNumber(item, "yCm"),
            rotationDeg: optionalNumber(item, "rotationDeg"),
            colorId: optionalString(item, "colorId"),
            label: optionalString(item, "label"),
          };
        });

        store.dispatch({ kind: "document", action: { type: "apply_layout", mode, items } });
        const doc = store.getState().present;
        return ok({
          mode,
          placedCount: items.length,
          furniture: furnitureView(doc),
          issues: validationView(doc),
        });
      },
    ),

    define(
      "validate_layout",
      "Check the layout for furniture outside the room, overlaps, blocked doors and walkways narrower than the configured clearance.",
      { type: "object", properties: {}, additionalProperties: false },
      () => ok(validationView(store.getState().present)),
    ),

    define(
      "save_layout_variant",
      "Save the current layout under a name, stored locally in this browser. Saving with an existing name overwrites that variant.",
      {
        type: "object",
        properties: { name: { type: "string", minLength: 1 } },
        required: ["name"],
        additionalProperties: false,
      },
      (args) => {
        const name = requiredString(args, "name");
        store.dispatch({ kind: "save_variant", name });
        const state = store.getState();
        return ok({
          saved: state.variants.find((variant) => variant.name === name.trim())?.id ?? null,
          variants: state.variants.map((variant) => ({ id: variant.id, name: variant.name })),
        });
      },
    ),

    define(
      "activate_layout_variant",
      "Load a saved variant into the editor as an undoable change. Identify it by id or by name.",
      {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
        },
        additionalProperties: false,
      },
      (args) => {
        const id = optionalString(args, "id");
        const name = optionalString(args, "name");
        if (!id && !name) throw new ToolInputError("Provide either id or name.");

        const variants = store.getState().variants;
        const variant = id
          ? variants.find((entry) => entry.id === id)
          : variants.find((entry) => entry.name === name?.trim());
        if (!variant) return fail(`No saved variant matching ${id ? `id "${id}"` : `name "${name}"`}.`);

        store.dispatch({ kind: "activate_variant", id: variant.id });
        return ok({
          activated: { id: variant.id, name: variant.name },
          ...stateView(store.getState(), true),
        });
      },
    ),

    define(
      "undo_last_change",
      "Undo the most recent change, whether it came from this agent or from direct canvas editing.",
      { type: "object", properties: {}, additionalProperties: false },
      () => {
        if (store.getState().past.length === 0) return fail("There is nothing left to undo.");
        store.dispatch({ kind: "undo" });
        return ok(stateView(store.getState(), true));
      },
    ),
  ];
}
