# RoomCraft

RoomCraft is an agent-native 2D room planner. A person edits the visual floor plan while an agent uses structured WebMCP tools to read the same room document, search a fictional local furniture catalog, place and update items, validate geometry, and manage layout variants.

The canvas and WebMCP tools share one reducer and one undo history. Agent changes therefore appear immediately in the editor and can be undone exactly like direct manipulation.

## First milestone

- Rectangular room with editable dimensions
- Centimeter-based geometry with friendly feet/inches display
- Pan, zoom, grid, selection, drag, rotation, duplication, deletion, and exact numeric editing
- Doors, windows, and door-swing visualization
- Boundary, overlap, door-clearance, and walkway validation
- 39 fictional generic furniture entries with dimensions, prices, styles, colors, and original top-down renderings
- Browser-local persistence, undo/redo, reset, and named layout variants
- Twelve WebMCP tools connected to the editor state

No account, backend, public sharing, export workflow, checkout, 3D rendering, or generative-image functionality is included in this milestone.

## WebMCP tools

- `get_room_state`
- `set_room_dimensions`
- `add_opening`
- `search_furniture`
- `place_furniture`
- `update_furniture`
- `remove_furniture`
- `apply_layout`
- `validate_layout`
- `save_layout_variant`
- `activate_layout_variant`
- `undo_last_change`

The registration adapter prefers the current `document.modelContext.registerTool(...)` API and uses `navigator.modelContext` only as a compatibility bridge for earlier preview builds. If WebMCP is unavailable, the editor continues to work and reports that agent tools are inactive.

## Requirements

- Node.js 22 or newer
- npm
- A WebMCP-capable browser for agent-tool testing

For the Chrome preview, enable:

```text
chrome://flags/#enable-webmcp-testing
```

WebMCP should be tested from a secure HTTPS origin when accessed remotely.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

The development server binds to `0.0.0.0` so it can also be reached through an approved remote host. Configure private remote development origins through the `NEXT_ALLOWED_DEV_ORIGINS` environment variable; do not commit private hostnames or access details.

## Production build

```bash
npm run build
npm run start
```

## Verification

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

The domain tests cover units, geometry, room updates, openings, catalog search, validation, history, persistence, editor state, WebMCP tool behavior, and browser-host registration.

## Architecture

```text
src/domain/       Pure room model, catalog, geometry, validation, history, persistence
src/state/        Observable store shared by React and WebMCP
src/mcp/          Tool definitions, schemas, execution adapter, registration lifecycle
src/components/   Editor shell, canvas, catalog, inspector, validation UI
src/app/          Next.js application entry and global styling
```

All catalog data is fictional and generic. The project does not contain or depend on commercial catalog data.
