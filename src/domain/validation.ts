import { resolveFurnitureItem } from "./customItems";
import { gapBetween, rectContainsRect, rectanglesOverlap } from "./geometry";
import { openingClearanceRect } from "./openings";
import { footprints } from "./placement";
import { interiorBounds, type RoomDocument } from "./room";

/**
 * Layout validation. Every rule is a pure function of the document so the
 * canvas, the inspector and the `validate_layout` WebMCP tool all read from
 * exactly the same analysis.
 */

export type IssueCode =
  | "out-of-bounds"
  | "overlap"
  | "blocked-door"
  | "narrow-walkway"
  | "unknown-item";

export type IssueSeverity = "error" | "warning";

export interface ValidationIssue {
  id: string;
  code: IssueCode;
  severity: IssueSeverity;
  message: string;
  furnitureIds: string[];
  openingId?: string;
  /** Measured value in cm that triggered the issue, where one applies. */
  measuredCm?: number;
}

export interface ValidationResult {
  ok: boolean;
  errorCount: number;
  warningCount: number;
  issues: ValidationIssue[];
}

const SEVERITY_ORDER: Record<IssueSeverity, number> = { error: 0, warning: 1 };

function labelFor(doc: RoomDocument, catalogId: string): string {
  return resolveFurnitureItem(doc.customItems, catalogId)?.name ?? catalogId;
}

function isObstacle(doc: RoomDocument, catalogId: string): boolean {
  return resolveFurnitureItem(doc.customItems, catalogId)?.category !== "rugs";
}

export function validateLayout(doc: RoomDocument): ValidationResult {
  const issues: ValidationIssue[] = [];
  const placedRects = footprints(doc);
  const room = interiorBounds(doc);

  for (const placed of doc.furniture) {
    if (!resolveFurnitureItem(doc.customItems, placed.catalogId)) {
      issues.push({
        id: `unknown-item:${placed.id}`,
        code: "unknown-item",
        severity: "error",
        message: `Item "${placed.catalogId}" is not in the catalog.`,
        furnitureIds: [placed.id],
      });
    }
  }

  for (const { placed, rect } of placedRects) {
    if (!rectContainsRect(room, rect)) {
      issues.push({
        id: `out-of-bounds:${placed.id}`,
        code: "out-of-bounds",
        severity: "error",
        message: `${labelFor(doc, placed.catalogId)} extends outside the room.`,
        furnitureIds: [placed.id],
      });
    }
  }

  for (let i = 0; i < placedRects.length; i += 1) {
    for (let j = i + 1; j < placedRects.length; j += 1) {
      const a = placedRects[i];
      const b = placedRects[j];
      if (!isObstacle(doc, a.placed.catalogId) || !isObstacle(doc, b.placed.catalogId)) continue;
      if (rectanglesOverlap(a.rect, b.rect)) {
        issues.push({
          id: `overlap:${a.placed.id}:${b.placed.id}`,
          code: "overlap",
          severity: "error",
          message: `${labelFor(doc, a.placed.catalogId)} overlaps ${labelFor(doc, b.placed.catalogId)}.`,
          furnitureIds: [a.placed.id, b.placed.id],
        });
        continue;
      }

      const gap = gapBetween(a.rect, b.rect);
      if (gap > 0 && gap < doc.settings.clearanceCm) {
        issues.push({
          id: `narrow-walkway:${a.placed.id}:${b.placed.id}`,
          code: "narrow-walkway",
          severity: "warning",
          message: `Only ${Math.round(gap)} cm between ${labelFor(doc, a.placed.catalogId)} and ${labelFor(
            doc,
            b.placed.catalogId,
          )} (target ${doc.settings.clearanceCm} cm).`,
          furnitureIds: [a.placed.id, b.placed.id],
          measuredCm: Math.round(gap),
        });
      }
    }
  }

  for (const opening of doc.openings) {
    const clearance = openingClearanceRect(doc, opening);
    if (!clearance) continue;
    for (const { placed, rect } of placedRects) {
      if (!isObstacle(doc, placed.catalogId)) continue;
      if (rectanglesOverlap(clearance, rect)) {
        issues.push({
          id: `blocked-door:${opening.id}:${placed.id}`,
          code: "blocked-door",
          severity: "error",
          message: `${labelFor(doc, placed.catalogId)} blocks the door on the ${opening.wall} wall.`,
          furnitureIds: [placed.id],
          openingId: opening.id,
        });
      }
    }
  }

  issues.sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.id.localeCompare(b.id),
  );

  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  return {
    ok: errorCount === 0 && issues.length === 0,
    errorCount,
    warningCount: issues.length - errorCount,
    issues,
  };
}
