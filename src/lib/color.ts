import type { ColorOption, ShapeRole } from "@/domain/catalog";

/**
 * Catalog artwork is described with semantic roles rather than fixed colours,
 * so one selected colour drives a small consistent palette per item.
 */

function clampChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((char) => char + char)
          .join("")
      : clean;
  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16),
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((channel) => clampChannel(channel).toString(16).padStart(2, "0"))
    .join("")}`;
}

/** Positive amounts lighten towards white, negative darken towards black. */
export function shade(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  const target = amount >= 0 ? 255 : 0;
  const ratio = Math.abs(amount);
  return rgbToHex(
    r + (target - r) * ratio,
    g + (target - g) * ratio,
    b + (target - b) * ratio,
  );
}

export function withAlpha(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export interface ShapePalette {
  body: string;
  panel: string;
  cushion: string;
  accent: string;
  outline: string;
}

export function paletteFor(color: ColorOption): ShapePalette {
  return {
    body: color.hex,
    panel: shade(color.hex, -0.16),
    cushion: shade(color.hex, 0.16),
    accent: shade(color.hex, -0.34),
    outline: withAlpha(shade(color.hex, -0.6), 0.55),
  };
}

export function roleColor(palette: ShapePalette, role: ShapeRole): string {
  return palette[role];
}

/** Resolves the colour an instance should use, falling back to the first option. */
export function resolveColor(colors: ColorOption[], colorId?: string): ColorOption {
  return colors.find((color) => color.id === colorId) ?? colors[0];
}
