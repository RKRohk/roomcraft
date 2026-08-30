import type { RoomTool } from "./tools";

/**
 * Registers the RoomCraft tools with the browser's WebMCP host.
 *
 * WebMCP is still emerging, so this adapter is written defensively: it prefers
 * `document.modelContext.registerTool`, accepts the batch `provideContext`
 * shape, falls back to `navigator.modelContext`, and — when no host exists at
 * all — reports that cleanly so the UI can show a status instead of breaking.
 */

export type McpStatus = "registered" | "unavailable" | "error";

export interface McpHost {
  registerTool?: (
    descriptor: McpToolDescriptor,
    options?: { signal?: AbortSignal },
  ) => undefined | void | Promise<void> | (() => void);
  provideContext?: (payload: { tools: McpToolDescriptor[] }) => void;
}

export interface McpToolDescriptor {
  name: string;
  description: string;
  inputSchema: RoomTool["inputSchema"];
  execute: (args: unknown) => Promise<unknown>;
}

export interface McpTargets {
  document?: { modelContext?: McpHost };
  navigator?: { modelContext?: McpHost };
}

export interface RegistrationResult {
  status: McpStatus;
  /** Which host API was used, for display in the status pill. */
  api: string | null;
  toolNames: string[];
  message: string;
  unregister: () => void;
}

const NOOP = () => {};

function descriptorFor(tool: RoomTool): McpToolDescriptor {
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    execute: (args: unknown) => tool.execute(args),
  };
}

function candidates(targets: McpTargets): Array<{ label: string; host: McpHost }> {
  const found: Array<{ label: string; host: McpHost }> = [];
  const documentHost = targets.document?.modelContext;
  const navigatorHost = targets.navigator?.modelContext;
  if (documentHost) found.push({ label: "document.modelContext", host: documentHost });
  if (navigatorHost) found.push({ label: "navigator.modelContext", host: navigatorHost });
  return found;
}

/**
 * Resolves the ambient browser targets; safe to call during SSR, where no
 * `document` exists and registration reports "unavailable" instead of throwing.
 */
export function browserTargets(): McpTargets {
  if (typeof window === "undefined") return {};
  return { document, navigator };
}

export function registerRoomTools(
  tools: RoomTool[],
  targets: McpTargets = browserTargets(),
): RegistrationResult {
  const hosts = candidates(targets);

  if (hosts.length === 0) {
    return {
      status: "unavailable",
      api: null,
      toolNames: [],
      message:
        "No WebMCP host detected. The editor works normally; agent tools will register automatically in a browser that exposes document.modelContext.",
      unregister: NOOP,
    };
  }

  for (const { label, host } of hosts) {
    const descriptors = tools.map(descriptorFor);

    if (typeof host.registerTool === "function") {
      const disposers: Array<() => void> = [];
      const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      try {
        for (const descriptor of descriptors) {
          const dispose = host.registerTool(
            descriptor,
            controller ? { signal: controller.signal } : undefined,
          );
          if (typeof dispose === "function") disposers.push(dispose);
        }
      } catch (error) {
        controller?.abort();
        for (const dispose of disposers) dispose();
        return {
          status: "error",
          api: `${label}.registerTool`,
          toolNames: [],
          message: `WebMCP registration failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
          unregister: NOOP,
        };
      }

      return {
        status: "registered",
        api: `${label}.registerTool`,
        toolNames: tools.map((tool) => tool.name),
        message: `${tools.length} RoomCraft tools registered with ${label}.`,
        unregister: () => {
          controller?.abort();
          for (const dispose of disposers) dispose();
        },
      };
    }

    if (typeof host.provideContext === "function") {
      try {
        host.provideContext({ tools: descriptors });
      } catch (error) {
        return {
          status: "error",
          api: `${label}.provideContext`,
          toolNames: [],
          message: `WebMCP registration failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
          unregister: NOOP,
        };
      }

      return {
        status: "registered",
        api: `${label}.provideContext`,
        toolNames: tools.map((tool) => tool.name),
        message: `${tools.length} RoomCraft tools provided to ${label}.`,
        // provideContext replaces the whole tool set; clearing means providing none.
        unregister: () => {
          try {
            host.provideContext?.({ tools: [] });
          } catch {
            // Nothing useful to do if teardown is rejected.
          }
        },
      };
    }
  }

  return {
    status: "unavailable",
    api: null,
    toolNames: [],
    message:
      "A WebMCP host is present but exposes neither registerTool nor provideContext. Agent tools are inactive.",
    unregister: NOOP,
  };
}
