"use client";

import { Fragment } from "react";
import { Ellipse, Line, Rect } from "react-konva";

import type { ShapePrimitive } from "@/domain/catalog";
import type { ShapePalette } from "@/lib/color";

/**
 * Draws a catalog item's top-down artwork in item-local centimetres, centred on
 * the origin so the parent group can position and rotate it directly.
 */
export function FurnitureShape({
  shape,
  widthCm,
  depthCm,
  palette,
}: {
  shape: ShapePrimitive[];
  widthCm: number;
  depthCm: number;
  palette: ShapePalette;
}) {
  const toX = (value: number) => -widthCm / 2 + value * widthCm;
  const toY = (value: number) => -depthCm / 2 + value * depthCm;
  const minSide = Math.min(widthCm, depthCm);

  return (
    <>
      {shape.map((primitive, index) => {
        const color = palette[primitive.role];

        if (primitive.kind === "rect") {
          return (
            <Rect
              key={index}
              x={toX(primitive.x)}
              y={toY(primitive.y)}
              width={primitive.w * widthCm}
              height={primitive.h * depthCm}
              cornerRadius={(primitive.radius ?? 0) * minSide}
              fill={primitive.stroke ? undefined : color}
              stroke={primitive.stroke ? color : undefined}
              strokeWidth={primitive.stroke ? 1.25 : 0}
              strokeScaleEnabled={false}
              listening={false}
              perfectDrawEnabled={false}
            />
          );
        }

        if (primitive.kind === "ellipse") {
          return (
            <Ellipse
              key={index}
              x={toX(primitive.cx)}
              y={toY(primitive.cy)}
              radiusX={primitive.rx * widthCm}
              radiusY={primitive.ry * depthCm}
              fill={primitive.stroke ? undefined : color}
              stroke={primitive.stroke ? color : undefined}
              strokeWidth={primitive.stroke ? 1.25 : 0}
              strokeScaleEnabled={false}
              listening={false}
              perfectDrawEnabled={false}
            />
          );
        }

        const points: number[] = [];
        for (let i = 0; i < primitive.points.length; i += 2) {
          points.push(toX(primitive.points[i]), toY(primitive.points[i + 1]));
        }
        return (
          <Fragment key={index}>
            <Line
              points={points}
              closed={primitive.closed}
              stroke={color}
              strokeWidth={1.25}
              strokeScaleEnabled={false}
              listening={false}
              perfectDrawEnabled={false}
            />
          </Fragment>
        );
      })}
    </>
  );
}
