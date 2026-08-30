import { describe, expect, it, vi } from "vitest";

import { registerRoomTools } from "./register";
import type { RoomTool } from "./tools";

const tool = (name: string): RoomTool => ({
  name,
  description: `Tool ${name}`,
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
  execute: async () => ({ content: [{ type: "text", text: "{}" }] }),
});

const tools = [tool("get_room_state"), tool("validate_layout")];

describe("registerRoomTools", () => {
  it("registers every tool on document.modelContext", () => {
    const unregister = vi.fn();
    const registerTool = vi.fn(() => unregister);
    const result = registerRoomTools(tools, { document: { modelContext: { registerTool } } });

    expect(result.status).toBe("registered");
    expect(result.api).toBe("document.modelContext.registerTool");
    expect(result.toolNames).toEqual(["get_room_state", "validate_layout"]);
    expect(registerTool).toHaveBeenCalledTimes(2);

    const [descriptor] = registerTool.mock.calls[0] as unknown as [Record<string, unknown>];
    expect(descriptor.name).toBe("get_room_state");
    expect(descriptor.inputSchema).toEqual(tools[0].inputSchema);
    expect(typeof descriptor.execute).toBe("function");

    result.unregister();
    expect(unregister).toHaveBeenCalledTimes(2);
  });

  it("uses one AbortSignal to unregister current-API tools", () => {
    const signals: AbortSignal[] = [];
    const registerTool = vi.fn(
      (_descriptor: unknown, options?: { signal?: AbortSignal }) => {
        if (options?.signal) signals.push(options.signal);
        return Promise.resolve();
      },
    );
    const result = registerRoomTools(tools, { document: { modelContext: { registerTool } } });

    expect(signals).toHaveLength(2);
    expect(signals[0]).toBe(signals[1]);
    expect(signals[0].aborted).toBe(false);

    result.unregister();
    expect(signals[0].aborted).toBe(true);
  });

  it("falls back to provideContext when registerTool is missing", () => {
    const provideContext = vi.fn();
    const result = registerRoomTools(tools, { document: { modelContext: { provideContext } } });

    expect(result.status).toBe("registered");
    expect(result.api).toBe("document.modelContext.provideContext");
    expect(provideContext).toHaveBeenCalledTimes(1);
    const [payload] = provideContext.mock.calls[0] as unknown as [{ tools: unknown[] }];
    expect(payload.tools).toHaveLength(2);
  });

  it("falls back to navigator.modelContext when the document has none", () => {
    const registerTool = vi.fn();
    const result = registerRoomTools(tools, {
      document: {},
      navigator: { modelContext: { registerTool } },
    });

    expect(result.status).toBe("registered");
    expect(result.api).toBe("navigator.modelContext.registerTool");
  });

  it("reports unavailability instead of throwing when there is no host", () => {
    const result = registerRoomTools(tools, { document: {}, navigator: {} });

    expect(result.status).toBe("unavailable");
    expect(result.api).toBeNull();
    expect(result.toolNames).toEqual([]);
    expect(result.message).toMatch(/WebMCP/i);
    expect(() => result.unregister()).not.toThrow();
  });

  it("reports an error when the host rejects registration", () => {
    const registerTool = vi.fn(() => {
      throw new Error("registration refused");
    });
    const result = registerRoomTools(tools, { document: { modelContext: { registerTool } } });

    expect(result.status).toBe("error");
    expect(result.message).toContain("registration refused");
  });
});
