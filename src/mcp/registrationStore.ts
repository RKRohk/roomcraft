import { registerRoomTools, type RegistrationResult } from "./register";
import type { RoomTool } from "./tools";

/**
 * WebMCP registration is an external system, so its result lives outside React
 * and components read it through `useSyncExternalStore`. That keeps the effect
 * a pure "tell the outside world" step rather than a setState cascade.
 */

let current: RegistrationResult | null = null;
const listeners = new Set<() => void>();

function publish(result: RegistrationResult | null): void {
  current = result;
  for (const listener of listeners) listener();
}

export function subscribeRegistration(listener: () => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

export function getRegistration(): RegistrationResult | null {
  return current;
}

/** Nothing is registered during SSR; the badge renders its pending state. */
export function getServerRegistration(): null {
  return null;
}

/** Registers the tools and returns a teardown that also clears the published status. */
export function registerAndPublish(tools: RoomTool[]): () => void {
  const result = registerRoomTools(tools);
  publish(result);

  return () => {
    result.unregister();
    if (current === result) publish(null);
  };
}
