"use client";

import { useState } from "react";

import { formatArea } from "@/domain/units";
import type { RegistrationResult } from "@/mcp/register";
import { useEditorState, useRoomStore } from "@/state/RoomStoreProvider";
import { Button } from "./ui";

export function TopBar({ mcp }: { mcp: RegistrationResult | null }) {
  const store = useRoomStore();
  const state = useEditorState();
  const doc = state.present;

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border-subtle bg-surface px-3">
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-semibold tracking-tight text-foreground">RoomCraft</span>
        <span className="hidden font-mono text-[11px] text-muted sm:inline">
          {doc.name} · {formatArea(doc.room.widthCm, doc.room.depthCm)}
        </span>
      </div>

      <div className="mx-1 h-6 w-px bg-border-subtle" aria-hidden />

      <div className="flex items-center gap-1">
        <Button
          title="Undo (Ctrl+Z)"
          disabled={state.past.length === 0}
          onClick={() => store.dispatch({ kind: "undo" })}
        >
          Undo
        </Button>
        <Button
          title="Redo (Ctrl+Shift+Z)"
          disabled={state.future.length === 0}
          onClick={() => store.dispatch({ kind: "redo" })}
        >
          Redo
        </Button>
      </div>

      <VariantMenu />

      <div className="ml-auto flex items-center gap-2">
        <McpStatusBadge mcp={mcp} />
        <Button
          variant="ghost"
          title="Clear the room and start again"
          onClick={() => {
            if (
              typeof window === "undefined" ||
              window.confirm("Reset the room? This clears the layout — you can still undo it.")
            ) {
              store.dispatch({ kind: "reset" });
            }
          }}
        >
          Reset
        </Button>
      </div>
    </header>
  );
}

function VariantMenu() {
  const store = useRoomStore();
  const state = useEditorState();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    store.dispatch({ kind: "save_variant", name: trimmed });
    setName("");
  };

  const active = state.variants.find((variant) => variant.id === state.activeVariantId);

  return (
    <div className="relative">
      <Button
        onClick={() => setOpen((current) => !current)}
        title="Saved layout variants, stored in this browser"
      >
        Variants
        <span className="font-mono text-[11px] text-muted">
          {active ? active.name : state.variants.length}
        </span>
      </Button>

      {open ? (
        <>
          <button
            type="button"
            aria-label="Close variants menu"
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-full z-20 mt-1 w-72 rounded-lg border border-border-subtle bg-surface-raised p-2 shadow-xl">
            <div className="flex gap-2">
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") save();
                }}
                placeholder="Variant name"
                aria-label="Variant name"
                className="h-11 min-w-0 flex-1 rounded-md border border-border-subtle bg-background px-2.5 text-sm"
              />
              <Button variant="primary" onClick={save} disabled={!name.trim()}>
                Save
              </Button>
            </div>

            <ul className="mt-2 max-h-64 overflow-y-auto">
              {state.variants.length === 0 ? (
                <li className="p-2 text-[11px] text-muted">
                  No saved variants yet. Save the current layout to compare alternatives.
                </li>
              ) : null}

              {state.variants.map((variant) => (
                <li key={variant.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => store.dispatch({ kind: "activate_variant", id: variant.id })}
                    className={`flex min-h-11 flex-1 items-center justify-between rounded-md px-2 text-left text-sm transition hover:bg-surface ${
                      variant.id === state.activeVariantId ? "text-accent-strong" : "text-foreground"
                    }`}
                  >
                    <span className="truncate">{variant.name}</span>
                    <span className="font-mono text-[11px] text-muted">
                      {variant.document.furniture.length} items
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete variant ${variant.name}`}
                    onClick={() => store.dispatch({ kind: "delete_variant", id: variant.id })}
                    className="grid size-11 place-items-center rounded-md text-muted transition hover:bg-surface hover:text-danger"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : null}
    </div>
  );
}

function McpStatusBadge({ mcp }: { mcp: RegistrationResult | null }) {
  const [open, setOpen] = useState(false);
  const status = mcp?.status ?? "unavailable";
  const tone =
    status === "registered"
      ? "border-accent/50 text-accent-strong"
      : status === "error"
        ? "border-danger/50 text-danger"
        : "border-border-subtle text-muted";
  const dot =
    status === "registered" ? "bg-accent" : status === "error" ? "bg-danger" : "bg-muted";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className={`flex min-h-11 items-center gap-2 rounded-md border px-3 text-xs transition hover:bg-surface-raised ${tone}`}
      >
        <span className={`size-2 rounded-full ${dot}`} aria-hidden />
        WebMCP
        <span className="hidden sm:inline">
          {status === "registered" ? `${mcp?.toolNames.length ?? 0} tools` : status}
        </span>
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-label="Close WebMCP details"
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full z-20 mt-1 w-80 rounded-lg border border-border-subtle bg-surface-raised p-3 shadow-xl">
            <p className="text-xs leading-relaxed text-foreground">
              {mcp?.message ?? "Checking for a WebMCP host…"}
            </p>
            {mcp?.api ? (
              <p className="mt-2 font-mono text-[11px] text-muted">{mcp.api}</p>
            ) : null}
            {mcp?.toolNames.length ? (
              <ul className="mt-2 grid grid-cols-2 gap-x-2 gap-y-0.5 font-mono text-[11px] text-muted">
                {mcp.toolNames.map((tool) => (
                  <li key={tool}>{tool}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
