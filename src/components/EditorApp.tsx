"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { resolveFurnitureItem } from "@/domain/customItems";
import { loadEditorState, saveEditorState } from "@/domain/persistence";
import { formatArea, formatUsd } from "@/domain/units";
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
import { type DockState, type DockTab, toggleDock } from "./editorLayout";
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
  // Narrow layouts show one docked panel at a time; wide layouts show both
  // rails and ignore this entirely.
  const [dock, setDock] = useState<DockState>("catalog");
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
        {/*
          Narrow: a vertical stack — plan on top, one docked panel underneath.
          Wide (lg+): the classic catalog / plan / inspector three-pane, restored
          by the `order-*` overrides so the plan sits back in the middle.
        */}
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <main className="relative order-1 min-h-0 min-w-0 flex-1 lg:order-2">
            <RoomCanvas />
          </main>

          <DockBar dock={dock} onToggle={(tab) => setDock((current) => toggleDock(current, tab))} />

          <CatalogPanel dockOpen={dock === "catalog"} />
          <InspectorPanel dockOpen={dock === "inspector"} />
        </div>
        <StatusBar />
      </div>
      <KeyboardShortcuts />
    </RoomStoreProvider>
  );
}

/**
 * Narrow-mode panel switcher. Sits directly above the docked panel it controls,
 * so the relationship is visible rather than implied by an icon in the corner.
 * Pressing the open panel's button collapses the dock and gives the plan the
 * whole pane.
 */
function DockBar({
  dock,
  onToggle,
}: {
  dock: DockState;
  onToggle: (tab: DockTab) => void;
}) {
  const state = useEditorState();
  const selectedCount = state.selection.length;

  return (
    <div className="order-2 flex shrink-0 items-center gap-1 border-t border-border-subtle bg-surface px-2 py-1 lg:hidden">
      <DockButton tab="catalog" label="Catalog" dock={dock} onToggle={onToggle} />
      <DockButton tab="inspector" label="Inspector" dock={dock} onToggle={onToggle}>
        {selectedCount > 0 ? (
          <span className="rounded-full bg-accent/20 px-1.5 py-0.5 font-mono text-[10px] text-accent-strong">
            {selectedCount}
          </span>
        ) : null}
      </DockButton>
      {dock === "collapsed" ? (
        <span className="ml-auto pr-1 font-mono text-[10px] text-muted">panels hidden</span>
      ) : null}
    </div>
  );
}

function DockButton({
  tab,
  label,
  dock,
  onToggle,
  children,
}: {
  tab: DockTab;
  label: string;
  dock: DockState;
  onToggle: (tab: DockTab) => void;
  children?: React.ReactNode;
}) {
  const open = dock === tab;
  return (
    <button
      type="button"
      onClick={() => onToggle(tab)}
      aria-expanded={open}
      aria-controls={`dock-panel-${tab}`}
      title={open ? `Hide the ${label} panel` : `Show the ${label} panel`}
      className={`flex min-h-11 items-center gap-1.5 rounded-md px-3 text-sm transition ${
        open
          ? "bg-surface-raised font-medium text-foreground shadow-[inset_0_-2px_0_0_var(--accent)]"
          : "text-muted hover:bg-surface-raised hover:text-foreground"
      }`}
    >
      {label}
      {children}
      <svg
        viewBox="0 0 24 24"
        className={`size-3.5 transition-transform ${open ? "" : "rotate-180"}`}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden
      >
        <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
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
      {/* The room's identity moves down here when the bar above gets compact,
          so it stays on screen at every width. */}
      <span className="shrink-0 xl:hidden">{formatArea(doc.room.widthCm, doc.room.depthCm)}</span>
      <span className="shrink-0">{doc.furniture.length} items</span>
      <span className="hidden shrink-0 sm:inline">{doc.openings.length} openings</span>
      <span className="shrink-0">{formatUsd(total)} total</span>
      <span className="ml-auto hidden truncate lg:inline">
        drag to move · R rotate · Ctrl+D duplicate · Del remove · scroll to zoom · drag canvas to pan
      </span>
      <span className="ml-auto shrink-0 lg:ml-0">
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
