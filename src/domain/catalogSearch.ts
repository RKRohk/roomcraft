import {
  CATALOG,
  type CatalogItem,
  type FurnitureCategory,
  type FurnitureStyle,
} from "./catalog";
import {
  builtInFurnitureItems,
  toFurnitureItem,
  type CustomItem,
  type FurnitureItem,
  type FurnitureSource,
} from "./customItems";

export interface CatalogQuery {
  query?: string;
  category?: FurnitureCategory;
  style?: FurnitureStyle;
  maxWidthCm?: number;
  maxDepthCm?: number;
  maxPriceUsdCents?: number;
  limit?: number;
}

export interface FurnitureQuery extends CatalogQuery {
  /** Omit to search both sources. */
  source?: FurnitureSource;
}

function tokenize(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(Boolean);
}

interface SearchableFurniture {
  name: string;
  category: FurnitureCategory;
  style: FurnitureStyle;
  widthCm: number;
  depthCm: number;
  priceUsdCents: number;
  tags: string[];
}

function haystack(item: SearchableFurniture): string {
  return [item.name, item.category, item.style, ...item.tags].join(" ").toLowerCase();
}

/**
 * Scores a single item. Returns null when a query token is missing entirely,
 * so results always contain every word the caller asked for.
 */
function score(item: SearchableFurniture, query: string): number | null {
  const tokens = tokenize(query);
  if (tokens.length === 0) return 0;

  const name = item.name.toLowerCase();
  const text = haystack(item);
  let total = 0;

  if (name === query.trim().toLowerCase()) total += 100;
  if (name.includes(query.trim().toLowerCase())) total += 50;

  for (const token of tokens) {
    if (!text.includes(token)) return null;
    if (name.startsWith(token)) total += 12;
    else if (name.includes(token)) total += 8;
    else total += 4;
  }
  return total;
}

/** Filters and ranks a fixed collection. Ties fall back to a stable name order. */
function searchItems<T extends SearchableFurniture>(items: readonly T[], query: CatalogQuery): T[] {
  const scored: Array<{ item: T; score: number }> = [];

  for (const item of items) {
    if (query.category && item.category !== query.category) continue;
    if (query.style && item.style !== query.style) continue;
    if (query.maxWidthCm !== undefined && item.widthCm > query.maxWidthCm) continue;
    if (query.maxDepthCm !== undefined && item.depthCm > query.maxDepthCm) continue;
    if (query.maxPriceUsdCents !== undefined && item.priceUsdCents > query.maxPriceUsdCents) {
      continue;
    }

    const itemScore = query.query ? score(item, query.query) : 0;
    if (itemScore === null) continue;
    scored.push({ item, score: itemScore });
  }

  scored.sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name));

  const results = scored.map((entry) => entry.item);
  return query.limit !== undefined ? results.slice(0, query.limit) : results;
}

/** Searches only the immutable, fictional built-in catalog. */
export function searchCatalog(query: CatalogQuery = {}): CatalogItem[] {
  return searchItems(CATALOG, query);
}

/** Searches generic built-ins and room-local custom items without merging their storage. */
export function searchFurniture(
  customItems: readonly CustomItem[],
  query: FurnitureQuery = {},
): FurnitureItem[] {
  const items = [
    ...(query.source === "custom" ? [] : builtInFurnitureItems()),
    ...(query.source === "built-in" ? [] : customItems.map(toFurnitureItem)),
  ];
  return searchItems(items, query);
}
