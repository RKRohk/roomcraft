import type { FurnitureItem } from "@/domain/customItems";
import { paletteFor, resolveColor } from "@/lib/color";
import { THUMBNAIL_STROKE_PX, projectShape } from "./shapeProjection";

/**
 * The same shape primitives the canvas draws, rendered as SVG for list rows so
 * a catalog entry always looks like what will land in the room.
 *
 * The SVG scales to fill its tile and keeps the item's real footprint aspect,
 * so a wide console uses the tile's full width instead of being letterboxed
 * inside a square. Strokes are non-scaling, which keeps outline detail at a
 * true 1.25px however small the tile is.
 */
export function CatalogThumbnail({
  item,
  colorId,
  className,
}: {
  item: FurnitureItem;
  colorId?: string;
  className?: string;
}) {
  const palette = paletteFor(resolveColor(item.colors, colorId));
  const projected = projectShape(item.shape, item.widthCm, item.depthCm, palette);

  return (
    <svg
      viewBox={projected.viewBox}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`${item.name}, ${item.widthCm} by ${item.depthCm} centimetres`}
      className={className ?? "h-full w-full"}
    >
      {projected.elements.map((element, index) => {
        if (element.kind === "rect") {
          return (
            <rect
              key={index}
              x={element.x}
              y={element.y}
              width={element.width}
              height={element.height}
              rx={element.rx}
              fill={element.fill}
              stroke={element.stroke}
              strokeWidth={element.stroke === "none" ? 0 : THUMBNAIL_STROKE_PX}
              vectorEffect="non-scaling-stroke"
            />
          );
        }

        if (element.kind === "ellipse") {
          return (
            <ellipse
              key={index}
              cx={element.cx}
              cy={element.cy}
              rx={element.rx}
              ry={element.ry}
              fill={element.fill}
              stroke={element.stroke}
              strokeWidth={element.stroke === "none" ? 0 : THUMBNAIL_STROKE_PX}
              vectorEffect="non-scaling-stroke"
            />
          );
        }

        const Tag = element.kind === "polygon" ? "polygon" : "polyline";
        return (
          <Tag
            key={index}
            points={element.points}
            fill="none"
            stroke={element.stroke}
            strokeWidth={THUMBNAIL_STROKE_PX}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
    </svg>
  );
}
