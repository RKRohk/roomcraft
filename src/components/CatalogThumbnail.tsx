import type { FurnitureItem } from "@/domain/customItems";
import { paletteFor, resolveColor } from "@/lib/color";

/**
 * The same shape primitives the canvas draws, rendered as SVG for list rows so
 * a catalog entry always looks like what will land in the room.
 */
export function CatalogThumbnail({
  item,
  colorId,
  size = 48,
}: {
  item: FurnitureItem;
  colorId?: string;
  size?: number;
}) {
  const palette = paletteFor(resolveColor(item.colors, colorId));
  const aspect = item.widthCm / item.depthCm;
  const width = aspect >= 1 ? 100 : 100 * aspect;
  const height = aspect >= 1 ? 100 / aspect : 100;
  const minSide = Math.min(width, height);

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role="img"
      aria-label={`${item.name}, ${item.widthCm} by ${item.depthCm} centimetres`}
      className="shrink-0"
    >
      <g transform={`translate(${(100 - width) / 2} ${(100 - height) / 2})`}>
        {item.shape.map((primitive, index) => {
          const color = palette[primitive.role];

          if (primitive.kind === "rect") {
            return (
              <rect
                key={index}
                x={primitive.x * width}
                y={primitive.y * height}
                width={primitive.w * width}
                height={primitive.h * height}
                rx={(primitive.radius ?? 0) * minSide}
                fill={primitive.stroke ? "none" : color}
                stroke={primitive.stroke ? color : "none"}
                strokeWidth={primitive.stroke ? 1.5 : 0}
              />
            );
          }

          if (primitive.kind === "ellipse") {
            return (
              <ellipse
                key={index}
                cx={primitive.cx * width}
                cy={primitive.cy * height}
                rx={primitive.rx * width}
                ry={primitive.ry * height}
                fill={primitive.stroke ? "none" : color}
                stroke={primitive.stroke ? color : "none"}
                strokeWidth={primitive.stroke ? 1.5 : 0}
              />
            );
          }

          const points: string[] = [];
          for (let i = 0; i < primitive.points.length; i += 2) {
            points.push(`${primitive.points[i] * width},${primitive.points[i + 1] * height}`);
          }
          return (
            <polyline
              key={index}
              points={points.join(" ")}
              fill="none"
              stroke={color}
              strokeWidth={1.5}
            />
          );
        })}
      </g>
    </svg>
  );
}
