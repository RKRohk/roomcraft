"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { resolveFurnitureItem } from "@/domain/customItems";
import { loadEditorState, saveEditorState } from "@/domain/persistence";
import { formatUsd } from "@/domain/units";
import {
  getRegistration,
  getServerRegistration,
  registerAndPublish,
  subscribeRegistration,
} from "@/mcp/registrationStore";
import { createRoomTools } from "@/mcp/tools";
import { RoomStoreProvider, useEditorState, useRoomStore } from "@/state/RoomStoreProvider";
import { createActionContext, createRoomStore } from "@/state/store";
import { CatalogPanel } from "./CatalogPanel";
import { InspectorPanel } from "./InspectorPanel";
import { TopBar } from "./TopBar";

// Konva touches the DOM directly, so the canvas is client-only.
const RoomCanvas = dynamic(() => import("./canvas/RoomCanvas"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center text-sm text-muted">
      Preparing the plan…
    </div>
  ),
});

export function EditorApp() {
  const [{ store, ctx }] = useState(() => {
    const ctx = createActionContext();
    return { ctx, store: createRoomStore(ctx) };
  });
  const mcp = useSyncExternalStore(
    subscribeRegistration,
    getRegistration,
    getServerRegistration,
  );

  // Restore the last session after mount, so the server and client agree on
  // the first render.
  useEffect(() => {
    const restored = loadEditorState(window.localStorage, ctx);
    store.dispatch({ kind: "replace_state", state: restored });
  }, [ctx, store]);

  // Persist on change, coalesced so a drag does not thrash storage.
  useEffect(() => {
    let timer: number | undefined;
    const unsubscribe = store.subscribe(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => saveEditorState(window.localStorage, store.getState()), 250);
    });
    return () => {
      window.clearTimeout(timer);
      unsubscribe();
    };
  }, [store]);

  // Advertise the tools to whatever WebMCP host the browser provides.
  useEffect(() => registerAndPublish(createRoomTools(store)), [store]);

  return (
    <RoomStoreProvider store={store}>
      <div className="flex h-full flex-col">
        <TopBar mcp={mcp} />
        <div className="flex min-h-0 flex-1">
          <CatalogPanel />
          <main className="relative min-w-0 flex-1">
            <RoomCanvas />
          </main>
          <InspectorPanel />
        </div>
        <StatusBar />
      </div>
      <KeyboardShortcuts />
    </RoomStoreProvider>
  );
}

function StatusBar() {
  const state = useEditorState();
  const doc = state.present;

  const total = useMemo(
    () =>
      doc.furniture.reduce(
        (sum, placed) =>
          sum + (resolveFurnitureItem(doc.customItems, placed.catalogId)?.priceUsdCents ?? 0),
        0,
      ),
    [doc.customItems, doc.furniture],
  );

  return (
    <footer className="flex h-9 shrink-0 items-center gap-4 border-t border-border-subtle bg-surface px-3 font-mono text-[11px] text-muted">
      <span>{doc.furniture.length} items</span>
      <span>{doc.openings.length} openings</span>
      <span>{formatUsd(total)} total</span>
      <span className="ml-auto hidden md:inline">
        drag to move · R rotate · Ctrl+D duplicate · Del remove · scroll to zoom · drag canvas to pan
      </span>
      <span>
        {state.selection.length > 0 ? `${state.selection.length} selected` : "nothing selected"}
      </span>
    </footer>
  );
}

/** Global editor shortcuts, ignored while a form control has focus. */
function KeyboardShortcuts() {
  const store = useRoomStore();

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      ) {
        return;
      }

      const state = store.getState();
      const selection = state.selection;
      const meta = event.metaKey || event.ctrlKey;

      if (meta && event.key.toLowerCase() === "z") {
        event.preventDefault();
        store.dispatch({ kind: event.shiftKey ? "redo" : "undo" });
        return;
      }
      if (meta && event.key.toLowerCase() === "y") {
        event.preventDefault();
        store.dispatch({ kind: "redo" });
        return;
      }
      if (meta && event.key.toLowerCase() === "d") {
        if (selection.length === 0) return;
        event.preventDefault();
        store.dispatch({
          kind: "document",
          action: { type: "duplicate_furniture", ids: selection },
        });
        return;
      }
      if (event.key === "Escape") {
        store.dispatch({ kind: "select", ids: [] });
        return;
      }
      if (selection.length === 0) return;

      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        store.dispatch({ kind: "document", action: { type: "remove_furniture", ids: selection } });
        return;
      }
      if (event.key.toLowerCase() === "r") {
        event.preventDefault();
        const step = event.shiftKey ? -15 : 15;
        for (const id of selection) {
          const placed = state.present.furniture.find((item) => item.id === id);
          if (!placed) continue;
          store.dispatch({
            kind: "document",
            action: {
              type: "update_furniture",
              id,
              patch: { rotationDeg: placed.rotationDeg + step },
            },
          });
        }
        return;
      }

      const nudges: Record<string, [number, number]> = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
      };
      const nudge = nudges[event.key];
      if (!nudge) return;

      event.preventDefault();
      const step = event.shiftKey ? 1 : state.present.settings.gridCm;
      for (const id of selection) {
        const placed = state.present.furniture.find((item) => item.id === id);
        if (!placed) continue;
        store.dispatch({
          kind: "document",
          action: {
            type: "update_furniture",
            id,
            patch: { xCm: placed.xCm + nudge[0] * step, yCm: placed.yCm + nudge[1] * step },
          },
        });
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [store]);

  return null;
}
