/**
 * All geometry in RoomCraft is stored in centimetres. These helpers are the
 * only place that turns those raw numbers into human-facing strings, and back.
 */

const CM_PER_M = 100;
const CM_PER_INCH = 2.54;
const INCHES_PER_FOOT = 12;
const CM_PER_FOOT = CM_PER_INCH * INCHES_PER_FOOT;

/** Renders a centimetre length as friendly whole feet and inches. */
export function formatLength(cm: number): string {
  const sign = cm < 0 ? "−" : "";
  const totalInches = Math.round(Math.abs(cm) / CM_PER_INCH);
  const feet = Math.floor(totalInches / INCHES_PER_FOOT);
  const inches = totalInches % INCHES_PER_FOOT;
  return `${sign}${feet}′ ${inches}″`;
}

/** Renders a centimetre footprint as square feet. */
export function formatArea(widthCm: number, depthCm: number): string {
  const squareFeet = (widthCm * depthCm) / (CM_PER_FOOT * CM_PER_FOOT);
  return `${squareFeet.toFixed(1)} ft²`;
}

/**
 * Parses friendly metric or imperial length input into centimetres.
 * Bare numbers are treated as centimetres. Returns null when unparseable.
 */
export function parseLength(input: string): number | null {
  const trimmed = input.trim().toLowerCase().replace(",", ".");
  const imperial = /^(-?\d*\.?\d+)\s*(?:ft|feet|foot|'|′)(?:\s*(\d*\.?\d+)\s*(?:in|inches|inch|"|″)?)?$/.exec(
    trimmed,
  );
  if (imperial) {
    const feet = Number.parseFloat(imperial[1]);
    const inches = imperial[2] ? Number.parseFloat(imperial[2]) : 0;
    if (!Number.isFinite(feet) || !Number.isFinite(inches) || inches < 0 || inches >= 12) {
      return null;
    }
    const sign = feet < 0 ? -1 : 1;
    const centimetres = feet * CM_PER_FOOT + sign * inches * CM_PER_INCH;
    return Math.round(centimetres * 1_000_000) / 1_000_000;
  }

  const metric = /^(-?\d*\.?\d+)\s*(mm|cm|m)?$/.exec(trimmed);
  if (!metric) return null;

  const value = Number.parseFloat(metric[1]);
  if (!Number.isFinite(value)) return null;

  switch (metric[2]) {
    case "m":
      return value * CM_PER_M;
    case "mm":
      return value / 10;
    default:
      return value;
  }
}

/** Snaps a value to the nearest multiple of `step`. A step of 0 disables snapping. */
export function roundToStep(value: number, step: number): number {
  if (step <= 0) return value;
  return Math.round(value / step) * step;
}

/** Clamps a value into an inclusive range. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Formats a price held in minor currency units. */
export function formatPrice(minorUnits: number): string {
  return `${(minorUnits / 100).toFixed(0)} cr`;
}
