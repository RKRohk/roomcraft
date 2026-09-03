import { describe, expect, it } from "vitest";

import { editorLayoutForWidth, isDockOpen, toggleDock } from "./editorLayout";

describe("editor responsive layout", () => {
  it("keeps the three-pane workspace when the canvas still has room", () => {
    expect(editorLayoutForWidth(1024)).toBe("three-pane");
    expect(editorLayoutForWidth(1280)).toBe("three-pane");
  });

  it("uses one full-width workspace before the three-pane layout gets cramped", () => {
    expect(editorLayoutForWidth(1023)).toBe("single-workspace");
    expect(editorLayoutForWidth(480)).toBe("single-workspace");
  });
});

describe("narrow-mode dock", () => {
  it("opens a panel from collapsed", () => {
    expect(toggleDock("collapsed", "catalog")).toBe("catalog");
    expect(toggleDock("collapsed", "inspector")).toBe("inspector");
  });

  it("swaps straight between panels without collapsing in between", () => {
    expect(toggleDock("catalog", "inspector")).toBe("inspector");
    expect(toggleDock("inspector", "catalog")).toBe("catalog");
  });

  it("collapses when the open panel's own button is pressed again", () => {
    expect(toggleDock("catalog", "catalog")).toBe("collapsed");
    expect(toggleDock("inspector", "inspector")).toBe("collapsed");
  });

  it("reports exactly one open panel", () => {
    expect(isDockOpen("catalog", "catalog")).toBe(true);
    expect(isDockOpen("catalog", "inspector")).toBe(false);
    expect(isDockOpen("collapsed", "catalog")).toBe(false);
    expect(isDockOpen("collapsed", "inspector")).toBe(false);
  });
});
