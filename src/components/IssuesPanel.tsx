"use client";

import { useMemo } from "react";

import { validateLayout } from "@/domain/validation";
import { useEditorState, useRoomStore } from "@/state/RoomStoreProvider";

/** Live validation readout; clicking an issue selects the furniture it names. */
export function IssuesPanel() {
  const store = useRoomStore();
  const state = useEditorState();
  const validation = useMemo(() => validateLayout(state.present), [state.present]);

  return (
    <div className="max-h-64 shrink-0 overflow-y-auto border-t border-border-subtle bg-surface">
      <div className="sticky top-0 flex items-center justify-between bg-surface px-3 py-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Issues</h3>
        <span className="flex items-center gap-2 font-mono text-[11px]">
          <span className={validation.errorCount > 0 ? "text-danger" : "text-muted"}>
            {validation.errorCount} errors
          </span>
          <span className={validation.warningCount > 0 ? "text-warning" : "text-muted"}>
            {validation.warningCount} warnings
          </span>
        </span>
      </div>

      {validation.issues.length === 0 ? (
        <p className="px-3 pb-3 text-[11px] text-muted">
          No problems found. Furniture fits, doors are clear, walkways meet the{" "}
          {state.present.settings.clearanceCm} cm target.
        </p>
      ) : (
        <ul className="px-2 pb-2">
          {validation.issues.map((issue) => (
            <li key={issue.id}>
              <button
                type="button"
                onClick={() => store.dispatch({ kind: "select", ids: issue.furnitureIds })}
                className="flex w-full min-h-11 items-start gap-2 rounded-md p-2 text-left transition hover:bg-surface-raised"
              >
                <span
                  aria-hidden
                  className={`mt-1.5 size-2 shrink-0 rounded-full ${
                    issue.severity === "error" ? "bg-danger" : "bg-warning"
                  }`}
                />
                <span className="text-[12px] leading-snug text-foreground">
                  {issue.message}
                  <span className="sr-only"> ({issue.severity})</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
