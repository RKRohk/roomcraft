import {
  CATALOG,
  type CatalogItem,
  type FurnitureCategory,
  type FurnitureStyle,
} from "./catalog";

export interface CatalogQuery {
  query?: string;
  category?: FurnitureCategory;
  style?: FurnitureStyle;
  maxWidthCm?: number;
  maxDepthCm?: number;
  maxPriceMinor?: number;
  limit?: number;
}

function tokenize(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(Boolean);
}

function haystack(item: CatalogItem): string {
  return [item.name, item.category, item.style, ...item.tags].join(" ").toLowerCase();
}

/**
 * Scores a single item. Returns null when a query token is missing entirely,
 * so results always contain every word the caller asked for.
 */
function score(item: CatalogItem, query: string): number | null {
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

/** Filters and ranks the catalog. Ties fall back to a stable name order. */
export function searchCatalog(query: CatalogQuery = {}): CatalogItem[] {
  const scored: Array<{ item: CatalogItem; score: number }> = [];

  for (const item of CATALOG) {
    if (query.category && item.category !== query.category) continue;
    if (query.style && item.style !== query.style) continue;
    if (query.maxWidthCm !== undefined && item.widthCm > query.maxWidthCm) continue;
    if (query.maxDepthCm !== undefined && item.depthCm > query.maxDepthCm) continue;
    if (query.maxPriceMinor !== undefined && item.priceMinor > query.maxPriceMinor) continue;

    const itemScore = query.query ? score(item, query.query) : 0;
    if (itemScore === null) continue;
    scored.push({ item, score: itemScore });
  }

  scored.sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name));

  const results = scored.map((entry) => entry.item);
  return query.limit !== undefined ? results.slice(0, query.limit) : results;
}
