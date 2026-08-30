import { describe, expect, it } from "vitest";

import { formatLength, formatArea, formatUsd, parseLength, roundToStep } from "./units";

describe("units", () => {
  it("formats centimetres as friendly feet and whole inches", () => {
    expect(formatLength(420)).toBe("13′ 9″");
    expect(formatLength(85)).toBe("2′ 9″");
    expect(formatLength(30.48)).toBe("1′ 0″");
  });

  it("carries rounded twelve inches into the next foot", () => {
    expect(formatLength(364.5)).toBe("12′ 0″");
  });

  it("formats area in square feet from centimetre dimensions", () => {
    expect(formatArea(400, 300)).toBe("129.2 ft²");
  });

  it("formats USD cents as dollars without a conversion", () => {
    expect(formatUsd(129900)).toBe("$1,299.00");
    expect(formatUsd(199)).toBe("$1.99");
  });

  it("parses metric and feet-inch input back to centimetres", () => {
    expect(parseLength("4.2 m")).toBe(420);
    expect(parseLength("85cm")).toBe(85);
    expect(parseLength("85")).toBe(85);
    expect(parseLength("12' 6\"")).toBe(381);
    expect(parseLength("12 ft 6 in")).toBe(381);
    expect(parseLength("nonsense")).toBeNull();
  });

  it("rounds to a snap step", () => {
    expect(roundToStep(47, 5)).toBe(45);
    expect(roundToStep(48, 5)).toBe(50);
    expect(roundToStep(48, 0)).toBe(48);
  });
});
