import { describe, expect, it } from "vitest";

import { createCustomItem } from "./customItems";
import {
  emptyCustomItemDraft,
  parseCustomItemDraft,
  parseUsdInput,
  type CustomItemDraft,
} from "./customItemDraft";

function draft(overrides: Partial<CustomItemDraft> = {}): CustomItemDraft {
  return {
    ...emptyCustomItemDraft(),
    name: "Reading chair",
    width: "70",
    depth: "80",
    height: "95",
    price: "249.99",
    color: "#8a5a44",
    ...overrides,
  };
}

describe("parseUsdInput", () => {
  it("reads a dollar string as exact cents", () => {
    expect(parseUsdInput("249.99")).toBe(24_999);
    expect(parseUsdInput("18")).toBe(1_800);
    expect(parseUsdInput("$1,299.50")).toBe(129_950);
  });

  it("rounds to the nearest cent rather than truncating", () => {
    expect(parseUsdInput("10.005")).toBe(1_001);
  });

  it("rejects blank, negative, and non-numeric input", () => {
    expect(parseUsdInput("")).toBeNull();
    expect(parseUsdInput("-5")).toBeNull();
    expect(parseUsdInput("free")).toBeNull();
  });
});

describe("parseCustomItemDraft", () => {
  it("converts a complete draft into tool-equivalent input", () => {
    const result = parseCustomItemDraft(draft());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.input).toMatchObject({
      name: "Reading chair",
      widthCm: 70,
      depthCm: 80,
      heightCm: 95,
      priceUsdCents: 24_999,
      color: "#8a5a44",
    });
  });

  it("accepts imperial dimensions through the shared length parser", () => {
    const result = parseCustomItemDraft(draft({ width: `2' 6"`, depth: "0.8m", height: "950mm" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.input.widthCm).toBeCloseTo(76.2, 5);
    expect(result.input.depthCm).toBeCloseTo(80, 5);
    expect(result.input.heightCm).toBeCloseTo(95, 5);
  });

  it("reports errors per field instead of failing as a whole", () => {
    const result = parseCustomItemDraft(
      draft({ name: "   ", width: "wide", price: "free", color: "burgundy" }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.errors).sort()).toEqual(["color", "name", "price", "width"]);
    expect(result.errors.width).toMatch(/cm/i);
  });

  it("rejects a zero or oversized dimension", () => {
    const zero = parseCustomItemDraft(draft({ depth: "0" }));
    expect(zero.ok).toBe(false);
    const huge = parseCustomItemDraft(draft({ depth: "2001" }));
    expect(huge.ok).toBe(false);
  });

  it("keeps optional metadata out of the input when blank", () => {
    const result = parseCustomItemDraft(draft({ sourceUrl: "  ", sourceLabel: "" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.input.sourceUrl).toBeUndefined();
    expect(result.input.sourceLabel).toBeUndefined();
  });

  it("accepts an http source URL and rejects any other scheme", () => {
    const good = parseCustomItemDraft(draft({ sourceUrl: "https://example.com/chair" }));
    expect(good.ok).toBe(true);
    if (good.ok) expect(good.input.sourceUrl).toBe("https://example.com/chair");

    const bad = parseCustomItemDraft(draft({ sourceUrl: "javascript:alert(1)" }));
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors.sourceUrl).toBeTruthy();
  });

  it("expands a three-digit hex colour to its six-digit form", () => {
    const result = parseCustomItemDraft(draft({ color: "#B84" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.input.color).toBe("#bb8844");
  });

  it("starts empty with a valid category, style, and colour", () => {
    const blank = emptyCustomItemDraft();
    expect(blank.name).toBe("");
    expect(parseCustomItemDraft(blank).ok).toBe(false);
    expect(parseCustomItemDraft({ ...blank, name: "Desk", width: "120", depth: "60", height: "75", price: "0" }).ok).toBe(
      true,
    );
  });

  it("produces input the domain validator accepts, so the form and the tool agree", () => {
    const result = parseCustomItemDraft(
      draft({ sourceUrl: "https://example.com/chair", sourceLabel: "Corner shop" }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const item = createCustomItem(result.input, "custom-1");
    expect(item).not.toBeNull();
    expect(item).toMatchObject({
      id: "custom-1",
      name: "Reading chair",
      priceUsdCents: 24_999,
      color: "#8a5a44",
      sourceUrl: "https://example.com/chair",
      sourceLabel: "Corner shop",
    });
  });
});
