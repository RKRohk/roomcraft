"use client";

import { useMemo, useState } from "react";

import { CATEGORIES, type FurnitureCategory } from "@/domain/catalog";
import { searchFurniture } from "@/domain/catalogSearch";
import { formatUsd } from "@/domain/units";
import { useEditorState, useRoomStore } from "@/state/RoomStoreProvider";
import { CatalogThumbnail } from "./CatalogThumbnail";

/** Browse and add catalog items: click to place, or drag straight onto the plan. */
export function CatalogPanel() {
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
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-border-subtle bg-surface">
      <div className="border-b border-border-subtle p-3">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
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

        <div className="mt-2 flex flex-wrap gap-1">
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
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2" role="list">
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
              <span className="grid size-12 shrink-0 place-items-center rounded-md border border-border-subtle bg-background">
                <CatalogThumbnail item={item} size={40} />
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
      className={`rounded-full border px-2.5 py-1 text-[11px] capitalize transition ${
        active
          ? "border-accent bg-accent/15 text-accent-strong"
          : "border-border-subtle text-muted hover:border-border-strong hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}
