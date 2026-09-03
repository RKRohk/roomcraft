"use client";

import { useEffect, useId, useRef, useState, type ReactNode, type Ref } from "react";

import { CATEGORIES, STYLES } from "@/domain/catalog";
import {
  emptyCustomItemDraft,
  parseCustomItemDraft,
  type CustomItemDraft,
  type CustomItemDraftErrors,
} from "@/domain/customItemDraft";
import { createCustomItem, toFurnitureItem } from "@/domain/customItems";
import { useRoomStore } from "@/state/RoomStoreProvider";
import { CatalogThumbnail } from "./CatalogThumbnail";
import { Button } from "./ui";

/**
 * Lets a person add their own item without an agent in the loop. The form is
 * only a typed front end for `parseCustomItemDraft`, so the same validation and
 * the same undoable action back both this and the `create_custom_item` tool.
 */
export function AddCustomItemButton() {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        ref={opener}
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border-strong text-sm text-muted transition hover:border-accent hover:text-accent-strong"
      >
        <span aria-hidden="true">+</span> Add your own item
      </button>
      {open ? (
        <CustomItemDialog
          onClose={() => {
            setOpen(false);
            opener.current?.focus();
          }}
        />
      ) : null}
    </>
  );
}

function CustomItemDialog({ onClose }: { onClose: () => void }) {
  const store = useRoomStore();
  const titleId = useId();
  const firstField = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<CustomItemDraft>(emptyCustomItemDraft);
  const [placeNow, setPlaceNow] = useState(true);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    firstField.current?.focus();
  }, []);

  const parsed = parseCustomItemDraft(draft);
  const errors: CustomItemDraftErrors = submitted && !parsed.ok ? parsed.errors : {};
  const errorCount = Object.keys(errors).length;

  // Preview the generated top-down rendering from the same shape the catalog
  // will draw, so the colour and proportions are visible before committing.
  const preview = parsed.ok ? createCustomItem(parsed.input, "custom-preview") : null;

  const set = (patch: Partial<CustomItemDraft>) => setDraft((current) => ({ ...current, ...patch }));

  const submit = () => {
    setSubmitted(true);
    if (!parsed.ok) return;
    store.dispatch({
      kind: "document",
      action: {
        type: "create_custom_item",
        item: parsed.input,
        ...(placeNow ? { place: {} } : {}),
      },
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
      /* Escape is handled here rather than globally: the editor's own Escape
         clears the canvas selection, which must not fire while a dialog is up. */
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      {/* A plain div, not a button: a focusable backdrop puts a full-viewport
          focus ring in the tab order. */}
      <div className="absolute inset-0" onPointerDown={onClose} aria-hidden="true" />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-xl border border-border-strong bg-surface shadow-[0_16px_40px_-12px_rgb(0_0_0/0.8)] sm:rounded-xl"
      >
        <div className="border-b border-border-subtle px-4 py-3">
          <h2 id={titleId} className="text-sm font-semibold text-foreground">
            Add your own item
          </h2>
          <p className="mt-1 text-[11px] text-muted">
            Saved in this browser only. A link is kept as a note and is never opened.
          </p>
        </div>

        <form
          className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <Field
            ref={firstField}
            label="Name"
            value={draft.name}
            onChange={(name) => set({ name })}
            placeholder="Walnut reading chair"
            error={errors.name}
            autoComplete="off"
          />

          <div className="grid grid-cols-3 gap-2">
            <Field
              label="Width"
              value={draft.width}
              onChange={(width) => set({ width })}
              placeholder="70"
              error={errors.width}
              hint="cm"
            />
            <Field
              label="Depth"
              value={draft.depth}
              onChange={(depth) => set({ depth })}
              placeholder="80"
              error={errors.depth}
              hint="cm"
            />
            <Field
              label="Height"
              value={draft.height}
              onChange={(height) => set({ height })}
              placeholder="95"
              error={errors.height}
              hint="cm"
            />
          </div>
          <p className="-mt-1 text-[11px] text-muted">
            Centimetres, or type it the way you measured it: 2&#39; 6&quot;, 0.8m, 950mm.
          </p>

          <div className="grid grid-cols-2 gap-2">
            <Field
              label="Price"
              value={draft.price}
              onChange={(price) => set({ price })}
              placeholder="249.99"
              error={errors.price}
              hint="USD"
              inputMode="decimal"
            />
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-muted">Colour</span>
              <span className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label="Item colour"
                  value={/^#[0-9a-fA-F]{6}$/.test(draft.color) ? draft.color : "#6f7d8c"}
                  onChange={(event) => set({ color: event.target.value })}
                  className="size-11 shrink-0 cursor-pointer rounded-md border border-border-subtle bg-background p-1"
                />
                <input
                  type="text"
                  aria-label="Colour hex value"
                  value={draft.color}
                  onChange={(event) => set({ color: event.target.value })}
                  className="h-11 w-full min-w-0 rounded-md border border-border-subtle bg-background px-2.5 font-mono text-sm text-foreground"
                />
              </span>
            </label>
          </div>
          {errors.color ? <FieldError>{errors.color}</FieldError> : null}

          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-muted">Category</span>
              <select
                value={draft.category}
                onChange={(event) =>
                  set({ category: event.target.value as CustomItemDraft["category"] })
                }
                className="h-11 rounded-md border border-border-subtle bg-background px-2 text-sm capitalize text-foreground"
              >
                {CATEGORIES.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-muted">Style</span>
              <select
                value={draft.style}
                onChange={(event) => set({ style: event.target.value as CustomItemDraft["style"] })}
                className="h-11 rounded-md border border-border-subtle bg-background px-2 text-sm capitalize text-foreground"
              >
                {STYLES.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <Field
            label="Link (optional)"
            value={draft.sourceUrl}
            onChange={(sourceUrl) => set({ sourceUrl })}
            placeholder="https://…"
            error={errors.sourceUrl}
            inputMode="url"
          />
          <Field
            label="Where it is from (optional)"
            value={draft.sourceLabel}
            onChange={(sourceLabel) => set({ sourceLabel })}
            placeholder="Corner shop, aisle 4"
          />

          <div className="flex items-center gap-3 rounded-md border border-border-subtle bg-background p-2">
            <span className="flex h-12 w-16 shrink-0 items-center justify-center rounded-md border border-border-subtle p-1.5">
              {preview ? (
                <CatalogThumbnail item={toFurnitureItem(preview)} />
              ) : (
                <span className="text-[10px] text-muted">Preview</span>
              )}
            </span>
            <p className="text-[11px] text-muted">
              {preview
                ? `${Math.round(preview.widthCm)}×${Math.round(preview.depthCm)} cm top-down rendering, generated from the size and colour.`
                : "Fill in the size and colour to see how it will be drawn."}
            </p>
          </div>

          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={placeNow}
              onChange={(event) => setPlaceNow(event.target.checked)}
              className="size-4 accent-[color:var(--accent)]"
            />
            Place it in the room now
          </label>

          <p aria-live="polite" className="sr-only">
            {errorCount > 0 ? `${errorCount} field${errorCount === 1 ? "" : "s"} need attention.` : ""}
          </p>
        </form>

        <div className="flex items-center justify-end gap-2 border-t border-border-subtle p-3">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit}>
            Add item
          </Button>
        </div>
      </div>
    </div>
  );
}

function FieldError({ children }: { children: ReactNode }) {
  return <span className="text-[11px] text-danger">{children}</span>;
}

function Field({
  ref,
  label,
  value,
  onChange,
  placeholder,
  error,
  hint,
  inputMode,
  autoComplete,
}: {
  ref?: Ref<HTMLInputElement>;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  hint?: string;
  inputMode?: "decimal" | "url";
  autoComplete?: string;
}) {
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <label htmlFor={id} className="flex min-w-0 flex-col gap-1">
      <span className="text-[11px] text-muted">{label}</span>
      <span className="relative flex items-center">
        <input
          ref={ref}
          id={id}
          type="text"
          inputMode={inputMode}
          autoComplete={autoComplete}
          value={value}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => onChange(event.target.value)}
          className={`h-11 w-full min-w-0 rounded-md border bg-background pl-2.5 text-sm text-foreground placeholder:text-muted ${
            hint ? "pr-9" : "pr-2.5"
          } ${error ? "border-danger" : "border-border-subtle"}`}
        />
        {hint ? (
          <span className="pointer-events-none absolute right-2.5 text-[11px] text-muted">
            {hint}
          </span>
        ) : null}
      </span>
      {error ? <span id={errorId} className="text-[11px] text-danger">{error}</span> : null}
    </label>
  );
}
