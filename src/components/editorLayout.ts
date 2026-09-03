export type EditorLayout = "three-pane" | "single-workspace";

/**
 * Below this width a catalog rail, canvas, and inspector cannot coexist
 * without stealing the workspace from the user.
 *
 * Narrow mode is aimed at the common split-pane case — RoomCraft holding
 * roughly a third of a laptop screen — where width is scarce but height is
 * plentiful. So the panels move *below* the plan rather than beside it: the
 * canvas keeps the full pane width, and the open panel gets the full width too
 * instead of being squeezed into a 20rem overlay. Both stay on screen at once,
 * which side drawers cannot manage at this size.
 */
export const SINGLE_WORKSPACE_BREAKPOINT_PX = 1024;

export function editorLayoutForWidth(widthPx: number): EditorLayout {
  return widthPx >= SINGLE_WORKSPACE_BREAKPOINT_PX ? "three-pane" : "single-workspace";
}

/** The panels the narrow-mode dock can show, one at a time. */
export type DockTab = "catalog" | "inspector";
export type DockState = DockTab | "collapsed";

/**
 * Dock buttons are toggles: pressing the open panel's own button collapses the
 * dock and hands the whole pane to the plan.
 */
export function toggleDock(current: DockState, tab: DockTab): DockState {
  return current === tab ? "collapsed" : tab;
}

export function isDockOpen(current: DockState, tab: DockTab): boolean {
  return current === tab;
}
