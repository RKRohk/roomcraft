import {
  CATALOG,
  CATEGORIES,
  STYLES,
  getCatalogItem,
  type CatalogItem,
  type ColorOption,
  type FurnitureCategory,
  type FurnitureStyle,
  type ShapePrimitive,
} from "./catalog";

/** Custom records live in a room document; they never alter the built-in catalog. */
export interface CustomItem {
  id: string;
  name: string;
  widthCm: number;
  depthCm: number;
  heightCm: number;
  /** USD cents, stored exactly as supplied rather than converted from another currency. */
  priceUsdCents: number;
  category: FurnitureCategory;
  style: FurnitureStyle;
  /** Hex colour used for the generated top-down representation. */
  color: string;
  sourceUrl?: string;
  sourceLabel?: string;
  rawText?: string;
}

export interface CustomItemInput {
  id?: string;
  name: string;
  widthCm: number;
  depthCm: number;
  heightCm: number;
  priceUsdCents: number;
  category: FurnitureCategory;
  style: FurnitureStyle;
  color: string;
  sourceUrl?: string;
  sourceLabel?: string;
  rawText?: string;
}

export type FurnitureSource = "built-in" | "custom";

/** A render-ready common shape for built-in and local custom items. */
export interface FurnitureItem {
  id: string;
  name: string;
  description: string;
  category: FurnitureCategory;
  style: FurnitureStyle;
  widthCm: number;
  depthCm: number;
  heightCm: number;
  priceUsdCents: number;
  colors: ColorOption[];
  tags: string[];
  shape: ShapePrimitive[];
  source: FurnitureSource;
  sourceUrl?: string;
  sourceLabel?: string;
  rawText?: string;
}

export const MAX_CUSTOM_ITEM_DIMENSION_CM = 2_000;
export const MAX_CUSTOM_ITEM_PRICE_USD_CENTS = 100_000_000;

const CUSTOM_ID = /^custom-[a-z0-9][a-z0-9-]*$/;
const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

const CUSTOM_SHAPE: ShapePrimitive[] = [
  { kind: "rect", x: 0, y: 0, w: 1, h: 1, radius: 0.08, role: "body" },
  { kind: "rect", x: 0.08, y: 0.1, w: 0.84, h: 0.8, radius: 0.05, role: "panel" },
  { kind: "line", points: [0.12, 0.5, 0.88, 0.5], role: "outline" },
];

function optionalText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= maxLength ? trimmed : undefined;
}

function normalizedHex(value: string): string {
  const lower = value.trim().toLowerCase();
  if (lower.length === 4) {
    return `#${lower
      .slice(1)
      .split("")
      .map((channel) => channel + channel)
      .join("")}`;
  }
  return lower;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

/** IDs are intentionally namespaced so they cannot shadow fictional built-ins. */
export function isCustomItemId(value: string): boolean {
  return CUSTOM_ID.test(value);
}

export function isCustomItemColor(value: string): boolean {
  return HEX_COLOR.test(value.trim());
}

/** Validates and normalises a user-owned custom item without fetching its source URL. */
export function createCustomItem(
  input: CustomItemInput,
  generatedId: string,
): CustomItem | null {
  const id = (input.id ?? generatedId).trim();
  const name = input.name.trim();
  const sourceUrl = optionalText(input.sourceUrl, 2_000);
  const suppliedSourceUrl = typeof input.sourceUrl === "string" && input.sourceUrl.trim() !== "";

  if (
    !isCustomItemId(id) ||
    !name ||
    name.length > 160 ||
    !Number.isFinite(input.widthCm) ||
    !Number.isFinite(input.depthCm) ||
    !Number.isFinite(input.heightCm) ||
    input.widthCm <= 0 ||
    input.depthCm <= 0 ||
    input.heightCm <= 0 ||
    input.widthCm > MAX_CUSTOM_ITEM_DIMENSION_CM ||
    input.depthCm > MAX_CUSTOM_ITEM_DIMENSION_CM ||
    input.heightCm > MAX_CUSTOM_ITEM_DIMENSION_CM ||
    !Number.isSafeInteger(input.priceUsdCents) ||
    input.priceUsdCents < 0 ||
    input.priceUsdCents > MAX_CUSTOM_ITEM_PRICE_USD_CENTS ||
    !CATEGORIES.includes(input.category) ||
    !STYLES.includes(input.style) ||
    !isCustomItemColor(input.color) ||
    (suppliedSourceUrl && (!sourceUrl || !isHttpUrl(sourceUrl)))
  ) {
    return null;
  }

  const sourceLabel = optionalText(input.sourceLabel, 240);
  const rawText = optionalText(input.rawText, 10_000);

  return {
    id,
    name,
    widthCm: input.widthCm,
    depthCm: input.depthCm,
    heightCm: input.heightCm,
    priceUsdCents: input.priceUsdCents,
    category: input.category,
    style: input.style,
    color: normalizedHex(input.color),
    ...(sourceUrl ? { sourceUrl } : {}),
    ...(sourceLabel ? { sourceLabel } : {}),
    ...(rawText ? { rawText } : {}),
  };
}

/** Parses persisted unknown input through the same validation as tool-created items. */
export function parseCustomItem(value: unknown): CustomItem | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  if (
    typeof item.id !== "string" ||
    typeof item.name !== "string" ||
    typeof item.widthCm !== "number" ||
    typeof item.depthCm !== "number" ||
    typeof item.heightCm !== "number" ||
    typeof item.priceUsdCents !== "number" ||
    typeof item.category !== "string" ||
    typeof item.style !== "string" ||
    typeof item.color !== "string"
  ) {
    return null;
  }

  return createCustomItem(
    {
      id: item.id,
      name: item.name,
      widthCm: item.widthCm,
      depthCm: item.depthCm,
      heightCm: item.heightCm,
      priceUsdCents: item.priceUsdCents,
      category: item.category as FurnitureCategory,
      style: item.style as FurnitureStyle,
      color: item.color,
      ...(typeof item.sourceUrl === "string" ? { sourceUrl: item.sourceUrl } : {}),
      ...(typeof item.sourceLabel === "string" ? { sourceLabel: item.sourceLabel } : {}),
      ...(typeof item.rawText === "string" ? { rawText: item.rawText } : {}),
    },
    item.id,
  );
}

function builtInFurnitureItem(item: CatalogItem): FurnitureItem {
  return { ...item, source: "built-in" };
}

function customFurnitureItem(item: CustomItem): FurnitureItem {
  return {
    id: item.id,
    name: item.name,
    description: "Custom item",
    category: item.category,
    style: item.style,
    widthCm: item.widthCm,
    depthCm: item.depthCm,
    heightCm: item.heightCm,
    priceUsdCents: item.priceUsdCents,
    colors: [{ id: `${item.id}-color`, name: "Custom colour", hex: item.color }],
    tags: ["custom", item.category, item.style],
    shape: CUSTOM_SHAPE,
    source: "custom",
    ...(item.sourceUrl ? { sourceUrl: item.sourceUrl } : {}),
    ...(item.sourceLabel ? { sourceLabel: item.sourceLabel } : {}),
    ...(item.rawText ? { rawText: item.rawText } : {}),
  };
}

export function getCustomItem(
  customItems: readonly CustomItem[],
  id: string,
): CustomItem | undefined {
  return customItems.find((item) => item.id === id);
}

/** Resolves either a built-in generic item or a room-local custom item. */
export function resolveFurnitureItem(
  customItems: readonly CustomItem[],
  id: string,
): FurnitureItem | undefined {
  const builtIn = getCatalogItem(id);
  if (builtIn) return builtInFurnitureItem(builtIn);

  const custom = getCustomItem(customItems, id);
  return custom ? customFurnitureItem(custom) : undefined;
}

export function toFurnitureItem(item: CustomItem): FurnitureItem {
  return customFurnitureItem(item);
}

export function builtInFurnitureItems(): FurnitureItem[] {
  return CATALOG.map(builtInFurnitureItem);
}
