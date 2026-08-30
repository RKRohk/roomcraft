"use client";

import type { KonvaEventObject } from "konva/lib/Node";
import type { Stage as KonvaStage } from "konva/lib/Stage";
import type { Vector2d } from "konva/lib/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Arc, Circle, Group, Layer, Line, Rect, Stage, Text } from "react-konva";

import { resolveFurnitureItem } from "@/domain/customItems";
import { normalizeAngle } from "@/domain/geometry";
import { doorSwingGeometry, openingClearanceRect, openingSegment, wallFrame } from "@/domain/openings";
import { clampToRoom, snapPlacement } from "@/domain/placement";
import type { Opening, PlacedFurniture, RoomDocument } from "@/domain/room";
import { formatLength } from "@/domain/units";
import { validateLayout, type IssueSeverity } from "@/domain/validation";
import { paletteFor, resolveColor, withAlpha } from "@/lib/color";
import { useEditorState, useRoomStore } from "@/state/RoomStoreProvider";
import { FurnitureShape } from "./FurnitureShape";

const MIN_SCALE = 0.08;
const MAX_SCALE = 6;
const FIT_PADDING_PX = 72;

const COLORS = {
  floor: "#191f27",
  floorEdge: "#232b35",
  gridMinor: "rgba(255,255,255,0.035)",
  gridMajor: "rgba(255,255,255,0.08)",
  wall: "#39424f",
  wallEdge: "#4b5665",
  opening: "#0e1116",
  door: "#5ac8b0",
  window: "#7cb8ff",
  dimension: "rgba(230,233,238,0.55)",
  selection: "#5ac8b0",
  error: "#f87171",
  warning: "#fbbf24",
  clearance: "rgba(90,200,176,0.10)",
};

interface Viewport {
  scale: number;
  x: number;
  y: number;
}

export default function RoomCanvas() {
  const store = useRoomStore();
  const state = useEditorState();
  const doc = state.present;

  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<KonvaStage>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [view, setView] = useState<Viewport>({ scale: 1, x: 0, y: 0 });
  const [showClearances, setShowClearances] = useState(true);
  const dragOrigins = useRef<Map<string, { xCm: number; yCm: number }>>(new Map());

  const validation = useMemo(() => validateLayout(doc), [doc]);

  const severityByFurniture = useMemo(() => {
    const map = new Map<string, IssueSeverity>();
    for (const issue of validation.issues) {
      for (const id of issue.furnitureIds) {
        if (issue.severity === "error" || !map.has(id)) map.set(id, issue.severity);
      }
    }
    return map;
  }, [validation]);

  // ------------------------------------------------------------- viewport

  const fitToRoom = useCallback(
    (canvasSize = size) => {
      if (canvasSize.width === 0 || canvasSize.height === 0) return;
      const margin = doc.room.wallThicknessCm * 2 + 60;
      const scale = Math.min(
        (canvasSize.width - FIT_PADDING_PX * 2) / (doc.room.widthCm + margin),
        (canvasSize.height - FIT_PADDING_PX * 2) / (doc.room.depthCm + margin),
      );
      const clamped = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));
      setView({
        scale: clamped,
        x: (canvasSize.width - doc.room.widthCm * clamped) / 2,
        y: (canvasSize.height - doc.room.depthCm * clamped) / 2,
      });
    },
    [doc.room.widthCm, doc.room.depthCm, doc.room.wallThicknessCm, size],
  );

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (box) setSize({ width: box.width, height: box.height });
    });
    observer.observe(element);
    setSize({ width: element.clientWidth, height: element.clientHeight });
    return () => observer.disconnect();
  }, []);

  // Fit once the canvas has a size, and again whenever the room is resized.
  const fitKey = `${size.width}x${size.height}:${doc.room.widthCm}x${doc.room.depthCm}`;
  const lastFitKey = useRef<string | null>(null);
  useEffect(() => {
    if (size.width === 0 || size.height === 0) return;
    if (lastFitKey.current === fitKey) return;
    lastFitKey.current = fitKey;
    fitToRoom(size);
  }, [fitKey, fitToRoom, size]);

  const zoomBy = useCallback(
    (factor: number, focus?: { x: number; y: number }) => {
      setView((current) => {
        const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, current.scale * factor));
        const point = focus ?? { x: size.width / 2, y: size.height / 2 };
        const worldX = (point.x - current.x) / current.scale;
        const worldY = (point.y - current.y) / current.scale;
        return { scale: next, x: point.x - worldX * next, y: point.y - worldY * next };
      });
    },
    [size.height, size.width],
  );

  const handleWheel = (event: KonvaEventObject<WheelEvent>) => {
    event.evt.preventDefault();
    const stage = stageRef.current;
    const pointer = stage?.getPointerPosition();
    const direction = event.evt.deltaY > 0 ? 1 / 1.08 : 1.08;
    zoomBy(direction, pointer ?? undefined);
  };

  // ------------------------------------------------------------ selection

  const select = useCallback(
    (ids: string[]) => store.dispatch({ kind: "select", ids }),
    [store],
  );

  const handleStagePointerDown = (event: KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (event.target === event.target.getStage()) select([]);
  };

  const toggleSelection = (id: string, additive: boolean) => {
    if (!additive) {
      select([id]);
      return;
    }
    select(
      state.selection.includes(id)
        ? state.selection.filter((entry) => entry !== id)
        : [...state.selection, id],
    );
  };

  // ------------------------------------------------------------- dragging

  const toCm = useCallback(
    (pos: Vector2d): Vector2d => {
      const stage = stageRef.current;
      const originX = stage?.x() ?? view.x;
      const originY = stage?.y() ?? view.y;
      return { x: (pos.x - originX) / view.scale, y: (pos.y - originY) / view.scale };
    },
    [view.scale, view.x, view.y],
  );

  const toStage = useCallback(
    (cm: Vector2d): Vector2d => {
      const stage = stageRef.current;
      const originX = stage?.x() ?? view.x;
      const originY = stage?.y() ?? view.y;
      return { x: cm.x * view.scale + originX, y: cm.y * view.scale + originY };
    },
    [view.scale, view.x, view.y],
  );

  const beginFurnitureDrag = (placed: PlacedFurniture) => {
    dragOrigins.current = new Map(
      doc.furniture
        .filter((item) => state.selection.includes(item.id) || item.id === placed.id)
        .map((item) => [item.id, { xCm: item.xCm, yCm: item.yCm }]),
    );
    if (!state.selection.includes(placed.id)) select([placed.id]);
  };

  const moveDuringDrag = (placed: PlacedFurniture, node: { x(): number; y(): number }) => {
    const anchor = dragOrigins.current.get(placed.id);
    const deltaX = anchor ? node.x() - anchor.xCm : 0;
    const deltaY = anchor ? node.y() - anchor.yCm : 0;

    for (const [id, origin] of dragOrigins.current) {
      const patch =
        id === placed.id
          ? { xCm: node.x(), yCm: node.y() }
          : { xCm: origin.xCm + deltaX, yCm: origin.yCm + deltaY };
      store.dispatch({
        kind: "document",
        transient: true,
        action: { type: "update_furniture", id, patch },
      });
    }
  };

  const endGesture = () => {
    dragOrigins.current = new Map();
    store.dispatch({ kind: "end_gesture" });
  };

  // ---------------------------------------------------------- drag & drop

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const catalogId = event.dataTransfer.getData("application/x-roomcraft-item");
    if (!catalogId || !resolveFurnitureItem(doc.customItems, catalogId)) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cm = toCm({ x: event.clientX - rect.left, y: event.clientY - rect.top });
    store.dispatch({
      kind: "document",
      action: { type: "add_furniture", catalogId, xCm: cm.x, yCm: cm.y },
    });
  };

  // ------------------------------------------------------------ rendering

  const wallT = doc.room.wallThicknessCm;
  const roomW = doc.room.widthCm;
  const roomD = doc.room.depthCm;
  const px = (value: number) => value / view.scale;

  const gridLines = useMemo(
    () => buildGrid(doc, view.scale),
    [doc, view.scale],
  );

  const orderedFurniture = useMemo(() => {
    // Rugs sit under everything else, otherwise document order wins.
    return [...doc.furniture].sort((a, b) => {
      const aRug = resolveFurnitureItem(doc.customItems, a.catalogId)?.category === "rugs" ? 0 : 1;
      const bRug = resolveFurnitureItem(doc.customItems, b.catalogId)?.category === "rugs" ? 0 : 1;
      return aRug - bRug;
    });
  }, [doc.customItems, doc.furniture]);

  const selectedItem =
    state.selection.length === 1
      ? doc.furniture.find((item) => item.id === state.selection[0])
      : undefined;

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-background"
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }}
      onDrop={handleDrop}
    >
      {size.width > 0 && size.height > 0 ? (
        <Stage
          ref={stageRef}
          width={size.width}
          height={size.height}
          x={view.x}
          y={view.y}
          draggable
          onWheel={handleWheel}
          onMouseDown={handleStagePointerDown}
          onTouchStart={handleStagePointerDown}
          onDragEnd={(event) => {
            if (event.target !== event.target.getStage()) return;
            const stage = event.target as KonvaStage;
            setView((current) => ({ ...current, x: stage.x(), y: stage.y() }));
          }}
          style={{ cursor: "default" }}
        >
          <Layer scaleX={view.scale} scaleY={view.scale} listening={false}>
            {/* Floor and walls */}
            <Rect
              x={-wallT}
              y={-wallT}
              width={roomW + wallT * 2}
              height={roomD + wallT * 2}
              fill={COLORS.wall}
              stroke={COLORS.wallEdge}
              strokeWidth={1}
              strokeScaleEnabled={false}
              cornerRadius={2}
            />
            <Rect x={0} y={0} width={roomW} height={roomD} fill={COLORS.floor} />

            {gridLines.map((entry, index) => (
              <Line
                key={index}
                points={entry.points}
                stroke={entry.major ? COLORS.gridMajor : COLORS.gridMinor}
                strokeWidth={1}
                strokeScaleEnabled={false}
              />
            ))}

            <Rect
              x={0}
              y={0}
              width={roomW}
              height={roomD}
              stroke={COLORS.floorEdge}
              strokeWidth={1.5}
              strokeScaleEnabled={false}
            />

            {showClearances &&
              doc.openings.map((opening) => {
                const zone = openingClearanceRect(doc, opening);
                if (!zone) return null;
                return (
                  <Rect
                    key={`clearance-${opening.id}`}
                    x={zone.x - zone.width / 2}
                    y={zone.y - zone.depth / 2}
                    width={zone.width}
                    height={zone.depth}
                    fill={COLORS.clearance}
                    dash={[px(6), px(6)]}
                    stroke={withAlpha(COLORS.door, 0.35)}
                    strokeWidth={1}
                    strokeScaleEnabled={false}
                  />
                );
              })}

            <DimensionLines doc={doc} scale={view.scale} />
          </Layer>

          {/* Furniture */}
          <Layer scaleX={view.scale} scaleY={view.scale}>
            {orderedFurniture.map((placed) => (
              <FurnitureNode
                key={placed.id}
                doc={doc}
                placed={placed}
                scale={view.scale}
                selected={state.selection.includes(placed.id)}
                severity={severityByFurniture.get(placed.id)}
                onSelect={(additive) => toggleSelection(placed.id, additive)}
                onDragStart={() => beginFurnitureDrag(placed)}
                onDragMove={(node) => moveDuringDrag(placed, node)}
                onDragEnd={endGesture}
                dragBoundFunc={(pos) => {
                  const cm = toCm(pos);
                  const settled = clampToRoom(
                    doc,
                    snapPlacement(doc, { ...placed, xCm: cm.x, yCm: cm.y }),
                  );
                  return toStage({ x: settled.xCm, y: settled.yCm });
                }}
              />
            ))}
          </Layer>

          {/* Openings sit above furniture so doors stay readable */}
          <Layer scaleX={view.scale} scaleY={view.scale}>
            {doc.openings.map((opening) => (
              <OpeningNode
                key={opening.id}
                opening={opening}
                doc={doc}
                scale={view.scale}
                toCm={toCm}
                toStage={toStage}
                onMove={(offsetCm) =>
                  store.dispatch({
                    kind: "document",
                    transient: true,
                    action: { type: "update_opening", id: opening.id, patch: { offsetCm } },
                  })
                }
                onMoveEnd={endGesture}
              />
            ))}
          </Layer>

          {/* Selection chrome */}
          <Layer scaleX={view.scale} scaleY={view.scale}>
            {selectedItem ? (
              <RotationHandle
                doc={doc}
                placed={selectedItem}
                scale={view.scale}
                toCm={toCm}
                onRotate={(rotationDeg) =>
                  store.dispatch({
                    kind: "document",
                    transient: true,
                    action: {
                      type: "update_furniture",
                      id: selectedItem.id,
                      patch: { rotationDeg },
                    },
                  })
                }
                onRotateEnd={endGesture}
              />
            ) : null}
          </Layer>
        </Stage>
      ) : null}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-3">
        <div className="pointer-events-auto flex items-center gap-1 rounded-lg border border-border-subtle bg-surface/90 p-1 backdrop-blur">
          <CanvasButton label="Zoom out" onClick={() => zoomBy(1 / 1.25)}>
            −
          </CanvasButton>
          <span className="min-w-14 text-center font-mono text-xs text-muted">
            {Math.round(view.scale * 100)}%
          </span>
          <CanvasButton label="Zoom in" onClick={() => zoomBy(1.25)}>
            +
          </CanvasButton>
          <CanvasButton label="Fit room to view" onClick={() => fitToRoom()} wide>
            Fit
          </CanvasButton>
        </div>

        <label className="pointer-events-auto flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-border-subtle bg-surface/90 px-3 text-xs text-muted backdrop-blur">
          <input
            type="checkbox"
            checked={showClearances}
            onChange={(event) => setShowClearances(event.target.checked)}
            className="size-4 accent-[color:var(--accent)]"
          />
          Door clearance
        </label>
      </div>
    </div>
  );
}

function CanvasButton({
  children,
  label,
  onClick,
  wide,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  wide?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`flex h-11 items-center justify-center rounded-md text-sm text-foreground transition hover:bg-surface-raised ${
        wide ? "px-3" : "w-11"
      }`}
    >
      {children}
    </button>
  );
}

// ----------------------------------------------------------------- pieces

function buildGrid(doc: RoomDocument, scale: number) {
  const lines: Array<{ points: number[]; major: boolean }> = [];
  const minor = doc.settings.gridCm;
  const showMinor = minor * scale >= 7;

  for (let x = 0; x <= doc.room.widthCm; x += minor) {
    const major = x % 100 === 0;
    if (!major && !showMinor) continue;
    lines.push({ points: [x, 0, x, doc.room.depthCm], major });
  }
  for (let y = 0; y <= doc.room.depthCm; y += minor) {
    const major = y % 100 === 0;
    if (!major && !showMinor) continue;
    lines.push({ points: [0, y, doc.room.widthCm, y], major });
  }
  return lines;
}

function DimensionLines({ doc, scale }: { doc: RoomDocument; scale: number }) {
  const px = (value: number) => value / scale;
  const offset = px(34);
  const tick = px(6);
  const font = px(13);
  const { widthCm, depthCm } = doc.room;

  return (
    <>
      <Line
        points={[0, -offset, widthCm, -offset]}
        stroke={COLORS.dimension}
        strokeWidth={1}
        strokeScaleEnabled={false}
      />
      <Line points={[0, -offset - tick, 0, -offset + tick]} stroke={COLORS.dimension} strokeWidth={1} strokeScaleEnabled={false} />
      <Line
        points={[widthCm, -offset - tick, widthCm, -offset + tick]}
        stroke={COLORS.dimension}
        strokeWidth={1}
        strokeScaleEnabled={false}
      />
      <Text
        x={widthCm / 2 - px(50)}
        y={-offset - px(20)}
        width={px(100)}
        align="center"
        text={formatLength(widthCm)}
        fontSize={font}
        fill={COLORS.dimension}
      />

      <Line
        points={[-offset, 0, -offset, depthCm]}
        stroke={COLORS.dimension}
        strokeWidth={1}
        strokeScaleEnabled={false}
      />
      <Line points={[-offset - tick, 0, -offset + tick, 0]} stroke={COLORS.dimension} strokeWidth={1} strokeScaleEnabled={false} />
      <Line
        points={[-offset - tick, depthCm, -offset + tick, depthCm]}
        stroke={COLORS.dimension}
        strokeWidth={1}
        strokeScaleEnabled={false}
      />
      <Text
        x={-offset - px(50)}
        y={depthCm / 2}
        width={px(100)}
        align="center"
        text={formatLength(depthCm)}
        fontSize={font}
        fill={COLORS.dimension}
        rotation={-90}
        offsetX={px(50)}
      />
    </>
  );
}

function FurnitureNode({
  doc,
  placed,
  scale,
  selected,
  severity,
  onSelect,
  onDragStart,
  onDragMove,
  onDragEnd,
  dragBoundFunc,
}: {
  doc: RoomDocument;
  placed: PlacedFurniture;
  scale: number;
  selected: boolean;
  severity?: IssueSeverity;
  onSelect: (additive: boolean) => void;
  onDragStart: () => void;
  onDragMove: (node: { x(): number; y(): number }) => void;
  onDragEnd: () => void;
  dragBoundFunc: (pos: Vector2d) => Vector2d;
}) {
  const item = resolveFurnitureItem(doc.customItems, placed.catalogId);
  if (!item) return null;

  const palette = paletteFor(resolveColor(item.colors, placed.colorId));
  const px = (value: number) => value / scale;
  const outline = severity === "error" ? COLORS.error : severity === "warning" ? COLORS.warning : null;

  return (
    <Group
      x={placed.xCm}
      y={placed.yCm}
      rotation={placed.rotationDeg}
      draggable={!placed.locked}
      dragBoundFunc={dragBoundFunc}
      onDragStart={onDragStart}
      onDragMove={(event) => onDragMove(event.target)}
      onDragEnd={onDragEnd}
      onMouseDown={(event) => {
        event.cancelBubble = true;
        onSelect(event.evt.shiftKey);
      }}
      onTouchStart={(event) => {
        event.cancelBubble = true;
        onSelect(false);
      }}
      onMouseEnter={(event) => {
        const stage = event.target.getStage();
        if (stage) stage.container().style.cursor = placed.locked ? "not-allowed" : "move";
      }}
      onMouseLeave={(event) => {
        const stage = event.target.getStage();
        if (stage) stage.container().style.cursor = "default";
      }}
    >
      {/* Hit area: the artwork itself does not listen, so the footprint does. */}
      <Rect
        x={-item.widthCm / 2}
        y={-item.depthCm / 2}
        width={item.widthCm}
        height={item.depthCm}
        fill="rgba(0,0,0,0.01)"
      />
      <FurnitureShape
        shape={item.shape}
        widthCm={item.widthCm}
        depthCm={item.depthCm}
        palette={palette}
      />

      {/* Facing marker: a short tick on the front edge. */}
      <Line
        points={[0, item.depthCm / 2 - px(10), 0, item.depthCm / 2 - px(2)]}
        stroke={withAlpha("#ffffff", 0.5)}
        strokeWidth={1.5}
        strokeScaleEnabled={false}
        listening={false}
      />

      {outline ? (
        <Rect
          x={-item.widthCm / 2}
          y={-item.depthCm / 2}
          width={item.widthCm}
          height={item.depthCm}
          stroke={outline}
          strokeWidth={2}
          strokeScaleEnabled={false}
          dash={[px(8), px(5)]}
          listening={false}
        />
      ) : null}

      {selected ? (
        <Rect
          x={-item.widthCm / 2 - px(3)}
          y={-item.depthCm / 2 - px(3)}
          width={item.widthCm + px(6)}
          height={item.depthCm + px(6)}
          stroke={COLORS.selection}
          strokeWidth={2}
          strokeScaleEnabled={false}
          cornerRadius={px(3)}
          listening={false}
        />
      ) : null}
    </Group>
  );
}

function OpeningNode({
  opening,
  doc,
  scale,
  toCm,
  toStage,
  onMove,
  onMoveEnd,
}: {
  opening: Opening;
  doc: RoomDocument;
  scale: number;
  toCm: (pos: Vector2d) => Vector2d;
  toStage: (cm: Vector2d) => Vector2d;
  onMove: (offsetCm: number) => void;
  onMoveEnd: () => void;
}) {
  const frame = wallFrame(doc, opening.wall);
  const segment = openingSegment(doc, opening);
  const swing = doorSwingGeometry(doc, opening);
  const px = (value: number) => value / scale;
  const thickness = doc.room.wallThicknessCm;
  const accent = opening.kind === "door" ? COLORS.door : COLORS.window;

  // Local frame: the group sits on the opening's start corner, children are
  // offset along the wall (`along`) and into the room (`inward`).
  const local = (alongCm: number, inwardCm: number): number[] => [
    frame.along.x * alongCm + frame.inward.x * inwardCm,
    frame.along.y * alongCm + frame.inward.y * inwardCm,
  ];

  const cut = [
    ...local(0, 0),
    ...local(opening.widthCm, 0),
    ...local(opening.widthCm, -thickness),
    ...local(0, -thickness),
  ];

  const maxOffset = Math.max(0, frame.lengthCm - opening.widthCm);

  return (
    <Group
      x={segment.start.x}
      y={segment.start.y}
      draggable
      dragBoundFunc={(pos) => {
        const cm = toCm(pos);
        const along =
          (cm.x - frame.origin.x) * frame.along.x + (cm.y - frame.origin.y) * frame.along.y;
        const clamped = Math.max(0, Math.min(maxOffset, Math.round(along)));
        return toStage({
          x: frame.origin.x + frame.along.x * clamped,
          y: frame.origin.y + frame.along.y * clamped,
        });
      }}
      onDragMove={(event) => {
        const node = event.target;
        const along =
          (node.x() - frame.origin.x) * frame.along.x + (node.y() - frame.origin.y) * frame.along.y;
        onMove(Math.max(0, Math.min(maxOffset, Math.round(along))));
      }}
      onDragEnd={onMoveEnd}
      onMouseEnter={(event) => {
        const stage = event.target.getStage();
        if (stage) stage.container().style.cursor = "grab";
      }}
      onMouseLeave={(event) => {
        const stage = event.target.getStage();
        if (stage) stage.container().style.cursor = "default";
      }}
    >
      {/* The gap through the wall */}
      <Line points={cut} closed fill={COLORS.opening} />

      {opening.kind === "window" ? (
        <>
          <Line
            points={[...local(0, -thickness * 0.62), ...local(opening.widthCm, -thickness * 0.62)]}
            stroke={accent}
            strokeWidth={2}
            strokeScaleEnabled={false}
          />
          <Line
            points={[...local(0, -thickness * 0.38), ...local(opening.widthCm, -thickness * 0.38)]}
            stroke={withAlpha(accent, 0.5)}
            strokeWidth={2}
            strokeScaleEnabled={false}
          />
        </>
      ) : null}

      {opening.kind === "door" && swing ? (
        <>
          <Arc
            x={swing.hinge.x - segment.start.x}
            y={swing.hinge.y - segment.start.y}
            innerRadius={0}
            outerRadius={swing.radiusCm}
            angle={Math.abs(swing.sweepDeg)}
            rotation={swing.sweepDeg < 0 ? swing.startAngleDeg + swing.sweepDeg : swing.startAngleDeg}
            fill={withAlpha(accent, 0.08)}
            stroke={withAlpha(accent, 0.5)}
            strokeWidth={1.25}
            strokeScaleEnabled={false}
            listening={false}
          />
          <Line
            points={[
              swing.hinge.x - segment.start.x,
              swing.hinge.y - segment.start.y,
              swing.leafEnd.x - segment.start.x,
              swing.leafEnd.y - segment.start.y,
            ]}
            stroke={accent}
            strokeWidth={2.5}
            strokeScaleEnabled={false}
            listening={false}
          />
        </>
      ) : null}

      {/* Jamb markers double as the drag affordance. */}
      <Line
        points={[...local(0, px(4)), ...local(0, -thickness - px(4))]}
        stroke={accent}
        strokeWidth={2}
        strokeScaleEnabled={false}
      />
      <Line
        points={[...local(opening.widthCm, px(4)), ...local(opening.widthCm, -thickness - px(4))]}
        stroke={accent}
        strokeWidth={2}
        strokeScaleEnabled={false}
      />
    </Group>
  );
}

function RotationHandle({
  doc,
  placed,
  scale,
  toCm,
  onRotate,
  onRotateEnd,
}: {
  doc: RoomDocument;
  placed: PlacedFurniture;
  scale: number;
  toCm: (pos: Vector2d) => Vector2d;
  onRotate: (rotationDeg: number) => void;
  onRotateEnd: () => void;
}) {
  const item = resolveFurnitureItem(doc.customItems, placed.catalogId);
  if (!item) return null;

  const px = (value: number) => value / scale;
  const distance = item.depthCm / 2 + px(28);

  return (
    <Group x={placed.xCm} y={placed.yCm} rotation={placed.rotationDeg}>
      <Line
        points={[0, -item.depthCm / 2, 0, -distance]}
        stroke={COLORS.selection}
        strokeWidth={1.5}
        strokeScaleEnabled={false}
        listening={false}
      />
      <Circle
        x={0}
        y={-distance}
        radius={px(9)}
        fill="#0e1116"
        stroke={COLORS.selection}
        strokeWidth={2}
        strokeScaleEnabled={false}
        draggable
        onDragMove={(event) => {
          const stage = event.target.getStage();
          const pointer = stage?.getPointerPosition();
          if (!pointer) return;
          const cm = toCm(pointer);
          const angle = (Math.atan2(cm.y - placed.yCm, cm.x - placed.xCm) * 180) / Math.PI + 90;
          const step = event.evt.shiftKey ? 1 : 15;
          onRotate(normalizeAngle(Math.round(angle / step) * step));
          // The handle is positioned by state, not by the drag itself.
          event.target.position({ x: 0, y: -distance });
        }}
        onDragEnd={(event) => {
          event.target.position({ x: 0, y: -distance });
          onRotateEnd();
        }}
        onMouseEnter={(event) => {
          const stage = event.target.getStage();
          if (stage) stage.container().style.cursor = "grab";
        }}
        onMouseLeave={(event) => {
          const stage = event.target.getStage();
          if (stage) stage.container().style.cursor = "default";
        }}
      />
    </Group>
  );
}
