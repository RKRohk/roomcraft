"use client";

import { useState, type ReactNode } from "react";

import { formatArea } from "@/domain/units";
import type { RegistrationResult } from "@/mcp/register";
import { useEditorState, useRoomStore } from "@/state/RoomStoreProvider";
import { Button } from "./ui";

export function TopBar({ mcp }: { mcp: RegistrationResult | null }) {
  const store = useRoomStore();
  const state = useEditorState();
  const doc = state.present;

  const reset = () => {
    if (
      typeof window === "undefined" ||
      window.confirm("Reset the room? This clears the layout — you can still undo it.")
    ) {
      store.dispatch({ kind: "reset" });
    }
  };

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border-subtle bg-surface px-3">
      <span className="shrink-0 text-sm font-semibold tracking-tight text-foreground">
        RoomCraft
      </span>
      <span className="hidden min-w-0 truncate font-mono text-[11px] text-muted xl:inline">
        {doc.name} · {formatArea(doc.room.widthCm, doc.room.depthCm)}
      </span>

      <div className="mx-1 h-6 w-px shrink-0 bg-border-subtle" aria-hidden />

      <div className="flex shrink-0 items-center gap-1">
        <IconButton
          label="Undo"
          hint="Undo (Ctrl+Z)"
          disabled={state.past.length === 0}
          onClick={() => store.dispatch({ kind: "undo" })}
        >
          <UndoIcon />
        </IconButton>
        <IconButton
          label="Redo"
          hint="Redo (Ctrl+Shift+Z)"
          disabled={state.future.length === 0}
          onClick={() => store.dispatch({ kind: "redo" })}
        >
          <RedoIcon />
        </IconButton>
      </div>

      {/* Wide screens get the document actions inline. */}
      <div className="ml-auto hidden shrink-0 items-center gap-2 lg:flex">
        <VariantMenu />
        <McpStatusBadge mcp={mcp} />
        <Button variant="ghost" title="Clear the room and start again" onClick={reset}>
          Reset
        </Button>
      </div>

      {/* Narrow screens keep the status visible and fold the rest into one
          labelled overflow, rather than scattering unlabelled glyphs. */}
      <div className="ml-auto flex shrink-0 items-center gap-1 lg:hidden">
        <McpStatusBadge mcp={mcp} />
        <OverflowMenu onReset={reset} />
      </div>
    </header>
  );
}

function IconButton({
  label,
  hint,
  onClick,
  disabled,
  children,
}: {
  label: string;
  hint: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={hint}
      aria-label={label}
      className="grid size-11 shrink-0 place-items-center rounded-md border border-border-subtle bg-surface-raised text-foreground transition hover:border-border-strong disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function UndoIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path d="M9 14 4 9l5-5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 9h10a6 6 0 0 1 0 12h-3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RedoIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path d="m15 14 5-5-5-5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 9H10a6 6 0 0 0 0 12h3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Click-away backdrop shared by every popover in the bar. */
function Backdrop({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" aria-label={label} className="fixed inset-0 z-10 cursor-default" onClick={onClick} />
  );
}

/** Narrow-width home for the actions that do not fit the compact bar. */
function OverflowMenu({ onReset }: { onReset: () => void }) {
  const [open, setOpen] = useState(false);
  const state = useEditorState();

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-label="More document actions"
        className="flex min-h-11 shrink-0 items-center gap-1 rounded-md border border-border-subtle bg-surface-raised px-2.5 text-sm text-foreground transition hover:border-border-strong"
      >
        More
        <ChevronIcon />
      </button>

      {open ? (
        <>
          <Backdrop label="Close menu" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-20 mt-1 w-[min(20rem,calc(100vw-1.5rem))] rounded-lg border border-border-subtle bg-surface-raised p-3 shadow-xl">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
              Variants
              <span className="ml-1 font-mono normal-case tracking-normal">
                ({state.variants.length})
              </span>
            </h2>
            <VariantControls onDone={() => setOpen(false)} />

            <div className="mt-3 border-t border-border-subtle pt-3">
              <Button
                variant="danger"
                full
                title="Clear the room and start again"
                onClick={() => {
                  setOpen(false);
                  onReset();
                }}
              >
                Reset room
              </Button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function VariantMenu() {
  const state = useEditorState();
  const [open, setOpen] = useState(false);
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
          <Backdrop label="Close variants menu" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-20 mt-1 w-72 max-w-[calc(100vw-1rem)] rounded-lg border border-border-subtle bg-surface-raised p-2 shadow-xl">
            <VariantControls onDone={() => setOpen(false)} />
          </div>
        </>
      ) : null}
    </div>
  );
}

/**
 * Save/activate/delete for layout variants. Shared so the wide popover and the
 * narrow overflow menu cannot drift apart.
 */
function VariantControls({ onDone }: { onDone: () => void }) {
  const store = useRoomStore();
  const state = useEditorState();
  const [name, setName] = useState("");

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    store.dispatch({ kind: "save_variant", name: trimmed });
    setName("");
  };

  return (
    <>
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
              onClick={() => {
                store.dispatch({ kind: "activate_variant", id: variant.id });
                onDone();
              }}
              className={`flex min-h-11 min-w-0 flex-1 items-center justify-between gap-2 rounded-md px-2 text-left text-sm transition hover:bg-surface ${
                variant.id === state.activeVariantId ? "text-accent-strong" : "text-foreground"
              }`}
            >
              <span className="truncate">{variant.name}</span>
              <span className="shrink-0 font-mono text-[11px] text-muted">
                {variant.document.furniture.length} items
              </span>
            </button>
            <button
              type="button"
              aria-label={`Delete variant ${variant.name}`}
              onClick={() => store.dispatch({ kind: "delete_variant", id: variant.id })}
              className="grid size-11 shrink-0 place-items-center rounded-md text-muted transition hover:bg-surface hover:text-danger"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </>
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
        aria-label={`WebMCP status: ${status}. Show details`}
        title={`WebMCP: ${status}`}
        className={`flex min-h-11 shrink-0 items-center gap-2 rounded-md border px-2.5 text-xs transition hover:bg-surface-raised ${tone}`}
      >
        <span className={`size-2 shrink-0 rounded-full ${dot}`} aria-hidden />
        <span aria-hidden>WebMCP</span>
        <span className="hidden sm:inline" aria-hidden>
          {status === "registered" ? `${mcp?.toolNames.length ?? 0} tools` : status}
        </span>
      </button>

      {open ? (
        <>
          <Backdrop label="Close WebMCP details" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-20 mt-1 w-[min(20rem,calc(100vw-1.5rem))] rounded-lg border border-border-subtle bg-surface-raised p-3 shadow-xl">
            <p className="text-xs leading-relaxed text-foreground">
              {mcp?.message ?? "Checking for a WebMCP host…"}
            </p>
            {mcp?.api ? <p className="mt-2 font-mono text-[11px] text-muted">{mcp.api}</p> : null}
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
