import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { ROOM_TOOL_NAMES } from "@/mcp/tools";

describe("llms.txt", () => {
  it("documents the browser-local planner and the current WebMCP surface", async () => {
    const content = await readFile(new URL("../public/llms.txt", import.meta.url), "utf8");
    const lines = content.trim().split(/\r?\n/);

    expect(lines[0]).toMatch(/^# RoomCraft\b/);
    expect(content).toMatch(/\n>[^\n]+/);
    expect(content).toContain("browser-local 2D room planner");
    expect(content).toContain("same canvas and undo history");
    expect(content).toContain("centimetres");
    expect(content).toContain("northwest interior origin");
    expect(content).toContain("x increases east");
    expect(content).toContain("y increases south");
    expect(content).toContain("footprint centres");
    expect(content).toContain("wall start");
    expect(content).toContain("get_room_state first");
    expect(content).toMatch(/source URLs/i);
    expect(content).toContain("never fetched");

    for (const name of ROOM_TOOL_NAMES) {
      expect(content).toContain(`\`${name}\``);
    }

    const layout = await readFile(new URL("./app/layout.tsx", import.meta.url), "utf8");
    expect(layout).toMatch(/rel:\s*["']describedby["']/);
    expect(layout).toMatch(/url:\s*["']\/llms\.txt["']/);
  });
});
