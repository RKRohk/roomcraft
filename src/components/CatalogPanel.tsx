"use client";

import { useMemo, useState } from "react";

import { CATEGORIES, type FurnitureCategory } from "@/domain/catalog";
import { searchFurniture } from "@/domain/catalogSearch";
import { formatUsd } from "@/domain/units";
import { useEditorState, useRoomStore } from "@/state/RoomStoreProvider";
import { CatalogThumbnail } from "./CatalogThumbnail";
import { AddCustomItemButton } from "./CustomItemForm";

/** Browse and add catalog items: click to place, or drag straight onto the plan. */
export function CatalogPanel({ dockOpen }: { dockOpen: boolean }) {
  const store = useRoomStore();
  const doc = useEditorState().present;
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<FurnitureCategory | "all">("all");

  const results = useMemo(
    () =>
      searchFurniture(doc.customItems, {
        query: query.trim() || undefined,
        category: category === "all" ? undefined : category,
      }),
    [category, doc.customItems, query],
  );

  const add = (catalogId: string) => {
    store.dispatch({ kind: "document", action: { type: "add_furniture", catalogId } });
  };

  return (
    <aside
      id="dock-panel-catalog"
      /* Narrow: a full-width dock under the plan, height-capped so the plan
         keeps most of the pane. Wide: the left rail, full height. */
      className={`${dockOpen ? "flex" : "hidden lg:flex"} order-3 h-[clamp(14rem,36vh,20rem)] w-full shrink-0 flex-col border-t border-border-subtle bg-surface lg:order-1 lg:h-auto lg:w-72 lg:border-r lg:border-t-0`}
      aria-label="Furniture catalog"
    >
      <div className="border-b border-border-subtle p-3">
        <h2 className="mb-2 hidden text-xs font-semibold uppercase tracking-wider text-muted lg:block">
          Catalog
        </h2>
        <label className="sr-only" htmlFor="catalog-search">
          Search furniture
        </label>
        <input
          id="catalog-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search sofas, beds, desks…"
          className="h-11 w-full rounded-md border border-border-subtle bg-background px-3 text-sm text-foreground placeholder:text-muted/70"
        />

        {/* Dock height is scarce, so chips scroll on one line when narrow and
            wrap only in the tall desktop rail. */}
        <div className="mt-2 -mx-3 flex gap-1 overflow-x-auto px-3 pb-0.5 [scrollbar-width:none] lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0">
          <CategoryChip
            active={category === "all"}
            onClick={() => setCategory("all")}
            label="All"
          />
          {CATEGORIES.map((entry) => (
            <CategoryChip
              key={entry}
              active={category === entry}
              onClick={() => setCategory(entry)}
              label={entry}
            />
          ))}
        </div>

        <AddCustomItemButton />
      </div>

      {/* The dock is full-width but short, so a second column at mid widths
          shows roughly twice as many items without scrolling. */}
      <div
        className="grid min-h-0 flex-1 grid-cols-1 content-start gap-x-2 overflow-y-auto overscroll-contain p-2 sm:grid-cols-2 lg:grid-cols-1"
        role="list"
      >
        {results.length === 0 ? (
          <p className="p-4 text-sm text-muted">
            Nothing matches “{query}”. Try a broader search.
          </p>
        ) : null}

        {results.map((item) => (
          <div
            key={item.id}
            role="listitem"
            draggable
            onDragStart={(event) => {
              event.dataTransfer.setData("application/x-roomcraft-item", item.id);
              event.dataTransfer.effectAllowed = "copy";
            }}
            className="group"
          >
            <button
              type="button"
              onClick={() => add(item.id)}
              title={`${item.description} — drag onto the plan or click to place`}
              className="flex w-full min-h-11 items-center gap-3 rounded-md p-2 text-left transition hover:bg-surface-raised"
            >
              {/* A 4:3 tile, wider than it is tall, so wide pieces like a
                  console can use its full width instead of being letterboxed
                  into a square. */}
              <span className="flex h-12 w-16 shrink-0 items-center justify-center rounded-md border border-border-subtle bg-background p-1.5">
                <CatalogThumbnail item={item} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="min-w-0 truncate text-sm text-foreground">{item.name}</span>
                  {item.source === "custom" ? (
                    <span className="shrink-0 rounded border border-accent/40 bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-accent-strong">
                      Custom
                    </span>
                  ) : null}
                </span>
                <span className="block font-mono text-[11px] text-muted">
                  {item.widthCm}×{item.depthCm} cm · {formatUsd(item.priceUsdCents)}
                </span>
              </span>
            </button>
          </div>
        ))}
      </div>

      <p className="border-t border-border-subtle px-3 py-2 text-[11px] text-muted">
        {results.length} items · custom items are marked · drag onto the plan or click to place
      </p>
    </aside>
  );
}

function CategoryChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] capitalize transition ${
        active
          ? "border-accent bg-accent/15 text-accent-strong"
          : "border-border-subtle text-muted hover:border-border-strong hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}
