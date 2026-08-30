"use client";

import { getCatalogItem } from "@/domain/catalog";
import { MIN_OPENING_WIDTH_CM, wallLengthCm } from "@/domain/openings";
import {
  MAX_ROOM_SIZE_CM,
  MIN_ROOM_SIZE_CM,
  WALL_IDS,
  type DoorSwing,
  type Opening,
  type PlacedFurniture,
  type WallId,
} from "@/domain/room";
import { formatArea, formatLength, formatPrice } from "@/domain/units";
import { useEditorState, useRoomStore } from "@/state/RoomStoreProvider";
import { IssuesPanel } from "./IssuesPanel";
import { Button, NumberField, Section, SectionTitle, SelectField, TextField, Toggle } from "./ui";

/**
 * The Inspect surface: exact numeric editing for whatever is selected, and the
 * room's own properties when nothing is.
 */
export function InspectorPanel() {
  const state = useEditorState();
  const doc = state.present;
  const selected = doc.furniture.filter((item) => state.selection.includes(item.id));

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col border-l border-border-subtle bg-surface">
      <div className="min-h-0 flex-1 overflow-y-auto">
        {selected.length === 1 ? (
          <FurnitureInspector placed={selected[0]} />
        ) : selected.length > 1 ? (
          <MultiSelectionInspector selected={selected} />
        ) : (
          <RoomInspector />
        )}
        <OpeningsInspector />
      </div>
      <IssuesPanel />
    </aside>
  );
}

function RoomInspector() {
  const store = useRoomStore();
  const doc = useEditorState().present;

  const setDimensions = (patch: { widthCm?: number; depthCm?: number; wallThicknessCm?: number }) =>
    store.dispatch({ kind: "document", action: { type: "set_room_dimensions", ...patch } });

  return (
    <>
      <Section>
        <SectionTitle>Room</SectionTitle>
        <div className="flex flex-col gap-2">
          <TextField
            label="Name"
            value={doc.name}
            onCommit={(name) =>
              store.dispatch({ kind: "document", action: { type: "rename_room", name } })
            }
            placeholder="Untitled room"
          />
          <div className="grid grid-cols-2 gap-2">
            <NumberField
              label="Width"
              value={doc.room.widthCm}
              min={MIN_ROOM_SIZE_CM}
              max={MAX_ROOM_SIZE_CM}
              step={10}
              onCommit={(widthCm) => setDimensions({ widthCm })}
            />
            <NumberField
              label="Depth"
              value={doc.room.depthCm}
              min={MIN_ROOM_SIZE_CM}
              max={MAX_ROOM_SIZE_CM}
              step={10}
              onCommit={(depthCm) => setDimensions({ depthCm })}
            />
          </div>
          <NumberField
            label="Wall thickness"
            value={doc.room.wallThicknessCm}
            min={5}
            max={60}
            onCommit={(wallThicknessCm) => setDimensions({ wallThicknessCm })}
          />
          <p className="font-mono text-[11px] text-muted">
            {formatLength(doc.room.widthCm)} × {formatLength(doc.room.depthCm)} ·{" "}
            {formatArea(doc.room.widthCm, doc.room.depthCm)}
          </p>
        </div>
      </Section>

      <Section>
        <SectionTitle>Layout rules</SectionTitle>
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <NumberField
              label="Walkway clearance"
              value={doc.settings.clearanceCm}
              min={0}
              max={300}
              step={5}
              onCommit={(clearanceCm) =>
                store.dispatch({
                  kind: "document",
                  action: { type: "set_settings", patch: { clearanceCm } },
                })
              }
            />
            <NumberField
              label="Grid"
              value={doc.settings.gridCm}
              min={1}
              max={100}
              onCommit={(gridCm) =>
                store.dispatch({
                  kind: "document",
                  action: { type: "set_settings", patch: { gridCm } },
                })
              }
            />
          </div>
          <Toggle
            label="Snap to grid"
            checked={doc.settings.snapToGrid}
            onChange={(snapToGrid) =>
              store.dispatch({
                kind: "document",
                action: { type: "set_settings", patch: { snapToGrid } },
              })
            }
          />
        </div>
      </Section>
    </>
  );
}

function FurnitureInspector({ placed }: { placed: PlacedFurniture }) {
  const store = useRoomStore();
  const item = getCatalogItem(placed.catalogId);
  if (!item) return null;

  const update = (patch: Partial<Omit<PlacedFurniture, "id" | "catalogId">>) =>
    store.dispatch({
      kind: "document",
      action: { type: "update_furniture", id: placed.id, patch },
    });

  return (
    <>
      <Section>
        <SectionTitle>Selected</SectionTitle>
        <p className="text-sm text-foreground">{placed.label || item.name}</p>
        <p className="mt-0.5 font-mono text-[11px] text-muted">
          {item.widthCm}×{item.depthCm}×{item.heightCm} cm · {formatPrice(item.priceMinor)} ·{" "}
          {item.style}
        </p>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <NumberField label="X (centre)" value={placed.xCm} onCommit={(xCm) => update({ xCm })} />
          <NumberField label="Y (centre)" value={placed.yCm} onCommit={(yCm) => update({ yCm })} />
        </div>

        <div className="mt-2 flex items-end gap-2">
          <div className="flex-1">
            <NumberField
              label="Rotation"
              unit="°"
              value={placed.rotationDeg}
              step={15}
              onCommit={(rotationDeg) => update({ rotationDeg })}
            />
          </div>
          <Button
            title="Rotate 90° counter-clockwise"
            onClick={() => update({ rotationDeg: placed.rotationDeg - 90 })}
          >
            ⟲
          </Button>
          <Button
            title="Rotate 90° clockwise"
            onClick={() => update({ rotationDeg: placed.rotationDeg + 90 })}
          >
            ⟳
          </Button>
        </div>

        <div className="mt-2">
          <TextField
            label="Label"
            value={placed.label ?? ""}
            placeholder={item.name}
            onCommit={(label) => update({ label: label.trim() || undefined })}
          />
        </div>

        {item.colors.length > 1 ? (
          <div className="mt-3">
            <span className="text-[11px] text-muted">Colour</span>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {item.colors.map((color) => {
                const active = (placed.colorId ?? item.colors[0].id) === color.id;
                return (
                  <button
                    key={color.id}
                    type="button"
                    title={color.name}
                    aria-label={color.name}
                    aria-pressed={active}
                    onClick={() => update({ colorId: color.id })}
                    className={`size-11 rounded-md border-2 transition ${
                      active ? "border-accent" : "border-border-subtle hover:border-border-strong"
                    }`}
                    style={{ background: color.hex }}
                  />
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            onClick={() =>
              store.dispatch({
                kind: "document",
                action: { type: "duplicate_furniture", ids: [placed.id] },
              })
            }
          >
            Duplicate
          </Button>
          <Button
            variant="danger"
            onClick={() =>
              store.dispatch({
                kind: "document",
                action: { type: "remove_furniture", ids: [placed.id] },
              })
            }
          >
            Delete
          </Button>
          <Toggle
            label="Lock"
            checked={placed.locked ?? false}
            onChange={(locked) => update({ locked })}
          />
        </div>
      </Section>
    </>
  );
}

function MultiSelectionInspector({ selected }: { selected: PlacedFurniture[] }) {
  const store = useRoomStore();
  const ids = selected.map((item) => item.id);

  return (
    <Section>
      <SectionTitle>Selection</SectionTitle>
      <p className="text-sm text-foreground">{selected.length} items selected</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          onClick={() =>
            store.dispatch({ kind: "document", action: { type: "duplicate_furniture", ids } })
          }
        >
          Duplicate all
        </Button>
        <Button
          variant="danger"
          onClick={() =>
            store.dispatch({ kind: "document", action: { type: "remove_furniture", ids } })
          }
        >
          Delete all
        </Button>
      </div>
    </Section>
  );
}

const SWING_OPTIONS: Array<{ value: DoorSwing; label: string }> = [
  { value: "inward-left", label: "Inward, left hinge" },
  { value: "inward-right", label: "Inward, right hinge" },
  { value: "outward-left", label: "Outward, left hinge" },
  { value: "outward-right", label: "Outward, right hinge" },
];

function OpeningsInspector() {
  const store = useRoomStore();
  const doc = useEditorState().present;

  const add = (kind: "door" | "window") =>
    store.dispatch({
      kind: "document",
      action: {
        type: "add_opening",
        kind,
        wall: "north",
        offsetCm: Math.max(0, doc.room.widthCm / 2 - (kind === "door" ? 45 : 60)),
        widthCm: kind === "door" ? 90 : 120,
        ...(kind === "door" ? { swing: "inward-right" as DoorSwing } : { sillHeightCm: 90 }),
      },
    });

  return (
    <Section>
      <div className="flex items-center justify-between">
        <SectionTitle>Doors &amp; windows</SectionTitle>
        <span className="mb-2 font-mono text-[11px] text-muted">{doc.openings.length}</span>
      </div>

      <div className="flex gap-2">
        <Button full onClick={() => add("door")}>
          + Door
        </Button>
        <Button full onClick={() => add("window")}>
          + Window
        </Button>
      </div>

      <div className="mt-3 flex flex-col gap-3">
        {doc.openings.map((opening) => (
          <OpeningRow key={opening.id} opening={opening} />
        ))}
        {doc.openings.length === 0 ? (
          <p className="text-[11px] text-muted">
            No openings yet. Add one, then drag it along its wall on the plan.
          </p>
        ) : null}
      </div>
    </Section>
  );
}

function OpeningRow({ opening }: { opening: Opening }) {
  const store = useRoomStore();
  const doc = useEditorState().present;

  const update = (patch: Partial<Omit<Opening, "id">>) =>
    store.dispatch({
      kind: "document",
      action: { type: "update_opening", id: opening.id, patch },
    });

  return (
    <div className="rounded-md border border-border-subtle bg-background p-2">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm capitalize text-foreground">{opening.kind}</span>
        <button
          type="button"
          onClick={() =>
            store.dispatch({ kind: "document", action: { type: "remove_opening", id: opening.id } })
          }
          aria-label={`Remove ${opening.kind}`}
          className="grid size-11 place-items-center rounded-md text-muted transition hover:bg-surface-raised hover:text-danger"
        >
          ✕
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <SelectField
          label="Wall"
          value={opening.wall}
          options={WALL_IDS.map((wall) => ({ value: wall, label: wall }))}
          onChange={(wall: WallId) => update({ wall })}
        />
        <NumberField
          label="Width"
          value={opening.widthCm}
          min={MIN_OPENING_WIDTH_CM}
          step={5}
          onCommit={(widthCm) => update({ widthCm })}
        />
      </div>

      <div className="mt-2">
        <NumberField
          label={`Offset along ${opening.wall} wall (max ${Math.max(
            0,
            wallLengthCm(doc, opening.wall) - opening.widthCm,
          )})`}
          value={opening.offsetCm}
          min={0}
          step={5}
          onCommit={(offsetCm) => update({ offsetCm })}
        />
      </div>

      {opening.kind === "door" ? (
        <div className="mt-2">
          <SelectField
            label="Swing"
            value={opening.swing ?? "inward-right"}
            options={SWING_OPTIONS}
            onChange={(swing: DoorSwing) => update({ swing })}
          />
        </div>
      ) : (
        <div className="mt-2">
          <NumberField
            label="Sill height"
            value={opening.sillHeightCm ?? 90}
            min={0}
            step={5}
            onCommit={(sillHeightCm) => update({ sillHeightCm })}
          />
        </div>
      )}
    </div>
  );
}
