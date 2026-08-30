import { describe, expect, it } from "vitest";

import { CATALOG, CATEGORIES, getCatalogItem } from "./catalog";
import { searchCatalog } from "./catalogSearch";

describe("catalog", () => {
  it("ships a curated catalog with stable unique ids and complete data", () => {
    expect(CATALOG.length).toBeGreaterThanOrEqual(30);
    expect(CATALOG.length).toBeLessThanOrEqual(40);

    const ids = new Set(CATALOG.map((item) => item.id));
    expect(ids.size).toBe(CATALOG.length);

    for (const item of CATALOG) {
      expect(item.id).toMatch(/^[a-z]+-[a-z0-9-]+$/);
      expect(item.widthCm).toBeGreaterThan(0);
      expect(item.depthCm).toBeGreaterThan(0);
      expect(item.heightCm).toBeGreaterThan(0);
      expect(item.priceMinor).toBeGreaterThan(0);
      expect(CATEGORIES).toContain(item.category);
      expect(item.colors.length).toBeGreaterThan(0);
      expect(item.shape.length).toBeGreaterThan(0);
    }
  });

  it("looks an item up by id", () => {
    const first = CATALOG[0];
    expect(getCatalogItem(first.id)).toBe(first);
    expect(getCatalogItem("does-not-exist")).toBeUndefined();
  });
});

describe("searchCatalog", () => {
  it("matches on name and tags", () => {
    const results = searchCatalog({ query: "sofa" });
    expect(results.length).toBeGreaterThan(0);
    for (const item of results) {
      const haystack = `${item.name} ${item.tags.join(" ")}`.toLowerCase();
      expect(haystack).toContain("sofa");
    }
  });

  it("filters by category, style and maximum footprint", () => {
    const results = searchCatalog({ category: "seating", maxWidthCm: 160 });
    expect(results.length).toBeGreaterThan(0);
    for (const item of results) {
      expect(item.category).toBe("seating");
      expect(item.widthCm).toBeLessThanOrEqual(160);
    }

    const styled = searchCatalog({ style: "minimal" });
    expect(styled.every((item) => item.style === "minimal")).toBe(true);
  });

  it("filters by maximum price and respects the result limit", () => {
    const cheap = searchCatalog({ maxPriceMinor: 20000 });
    expect(cheap.every((item) => item.priceMinor <= 20000)).toBe(true);

    expect(searchCatalog({ limit: 3 })).toHaveLength(3);
  });

  it("ranks closer name matches first", () => {
    const results = searchCatalog({ query: "dining chair" });
    expect(results[0].name.toLowerCase()).toContain("dining chair");
  });

  it("returns an empty list when nothing matches", () => {
    expect(searchCatalog({ query: "submarine" })).toEqual([]);
  });
});
