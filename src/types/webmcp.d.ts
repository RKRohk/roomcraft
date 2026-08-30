/**
 * Ambient declarations for the WebMCP browser API.
 *
 * No shipping browser exposes `modelContext` in its own lib.dom typings yet, so
 * RoomCraft declares the surface it uses. Everything is optional: code must
 * feature-detect before calling, and the app stays fully usable without a host.
 */

export interface WebMcpToolDescriptor {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties: false;
  };
  execute: (args: unknown) => Promise<unknown>;
}

export interface WebMcpModelContext {
  /** Registers a single tool; may return an unregister callback. */
  registerTool?: (descriptor: WebMcpToolDescriptor) => undefined | (() => void);
  /** Batch alternative that replaces the page's advertised tool set. */
  provideContext?: (payload: { tools: WebMcpToolDescriptor[] }) => void;
}

declare global {
  interface Document {
    modelContext?: WebMcpModelContext;
  }

  interface Navigator {
    modelContext?: WebMcpModelContext;
  }
}
