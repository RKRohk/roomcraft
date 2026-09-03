# RoomCraft

> A 2D room planner where a WebMCP agent edits the actual room document, not an image of one.

[Live demo](https://roomcraft.rohankakar.com) · [Source code](https://github.com/RKRohk/roomcraft)

<pre>
┌──────────────────────────────────────────────────────────────┐
│ ROOMCRAFT · 2D ROOM PLANNER                       WebMCP: ON │
├───────────┬─────────────────────────┬────────────────────────┤
│ CATALOG   │      ROOM CANVAS        │ AGENT / INSPECTOR      │
│           │                         │                        │
│  SOFA     │   ┌────────────────┐    │ > get_room_state       │
│  TABLE    │   │      BED       │    │ ✓ 480 × 360 cm         │
│  STORAGE  │   │ door   fridge  │    │                        │
│  CUSTOM   │   └────────────────┘    │ > validate_layout      │
│           │                         │ ✓ no errors            │
│           │                         │ ↶ undo                 │
├───────────┴─────────────────────────┴────────────────────────┤
│ human taste → structured room state → reversible edits       │
└──────────────────────────────────────────────────────────────┘
</pre>

## What RoomCraft does

RoomCraft is an agent-native 2D room planner. A person edits a visual floor plan while a WebMCP-capable agent works with the same structured room state.

The agent can read the room, change dimensions, add doors and windows, search furniture, create custom items, place objects, validate the geometry, save layout variants, and undo changes.

The person can keep dragging, rotating, editing, and correcting the layout in the same editor.

RoomCraft works with room data rather than pixels:

- room dimensions
- wall openings
- furniture footprints
- centimetre coordinates
- rotations
- clearances
- collisions
- layout history

## The basic flow

A typical interaction looks like this:

1. The agent reads the existing room state.
2. It changes the room dimensions and adds openings.
3. It searches the furniture catalog.
4. It creates a custom item from user-provided listing details.
5. It places furniture using real centimetre coordinates.
6. The validator checks the layout.
7. The person or agent fixes or undoes the change.

The result is an editable room that can be inspected, corrected, and continued by a person. It is not a generated room image.

## Why RoomCraft

Most room planners are either manual drawing tools or image generators. RoomCraft keeps the room as structured, editable data.

- The person chooses the style and makes the final call.
- The agent works with dimensions, openings, furniture footprints, and clearances.
- Every agent edit appears in the same canvas as a human edit.
- Geometry validation catches overlaps, blocked doors, and narrow walkways.
- Undo makes agent changes reversible.
- Custom furniture can come from user-pasted listing details.
- Built-in catalog items remain fictional and generic.
- Human edits and agent edits share the same reducer and undo history.

## WebMCP in one glance

| Tool | What it does |
| --- | --- |
| `get_room_state` | Reads dimensions, openings, furniture, custom items, and variants |
| `set_room_dimensions` | Resizes the room |
| `set_room_settings` | Updates room settings such as grid, snapping, and clearance preferences |
| `add_opening` | Adds a door or window to a wall |
| `update_opening` | Changes an existing door or window |
| `remove_opening` | Removes an opening |
| `search_furniture` | Searches built-in and room-local custom items |
| `create_custom_item` | Adds a user-provided item with dimensions and price |
| `place_furniture` | Places a built-in or custom item in the room |
| `update_furniture` | Changes an existing furniture item |
| `remove_furniture` | Removes furniture |
| `apply_layout` | Applies a layout change to the room |
| `validate_layout` | Checks boundaries, overlaps, doors, and walkways |
| `save_layout_variant` | Saves the current layout under a name |
| `activate_layout_variant` | Restores a saved layout variant |
| `reset_current_layout` | Resets the current layout |
| `undo_last_change` | Reverses the latest human or agent edit |

The complete agent-facing contract is documented in [`public/llms.txt`](public/llms.txt), which is served at `/llms.txt`.

<details>
<summary>Show the tool workflow</summary>

A reliable agent journey is:

```text
get_room_state
      ↓
set_room_dimensions / set_room_settings
      ↓
search_furniture or create_custom_item
      ↓
place_furniture / update_furniture
      ↓
validate_layout
      ↓
save_layout_variant or undo_last_change
```

The agent should use IDs returned by tool results or by `get_room_state`. Mutations update the same state that the person sees on the canvas.

</details>

## Custom furniture and prices

RoomCraft separates user-provided items from the fictional built-in catalog.

A person can add a custom item without an agent through **Add your own item** in the catalog panel. The form accepts:

- centimetre measurements
- friendly imperial sizes such as `2' 6"`
- metric sizes such as `0.8m` or `950mm`
- exact dollar prices
- category, style, and colour
- optional source metadata

Custom items receive stable `custom-...` IDs and behave like built-in furniture. They can be placed, moved, rotated, edited, locked, validated, saved in variants, and undone.

`create_custom_item` accepts a name, width, depth, height, price in USD cents, category, style, and hex colour. It can also place the item in the same undoable change with `place: true`.

Prices use direct USD values. RoomCraft does not convert currencies.

Optional `sourceUrl`, `sourceLabel`, and `rawText` are stored only as user-provided metadata. RoomCraft does not scrape, fetch, or depend on retailer websites.

Custom entries are marked **Custom** in the catalog and inspector. `search_furniture` searches both built-in and custom items by default, or can filter with `source: "built-in"` and `source: "custom"`.

## Agent-facing documentation

[`public/llms.txt`](public/llms.txt) describes the geometry conventions an agent needs before its first call:

- measurements use centimetres
- the interior origin is at the northwest corner
- `x` increases eastward
- `y` increases southward
- furniture `x` and `y` coordinates refer to footprint centres
- opening offsets are measured from the start of each wall

The `llms.txt` contract is tested so every name in the WebMCP tool surface remains documented when new tools are added.

The registration adapter uses `document.modelContext.registerTool(...)` and supports `navigator.modelContext` for earlier preview builds. If WebMCP is unavailable, the editor continues to work and reports that agent tools are inactive.

## Run locally

### Requirements

- Node.js 22 or newer
- npm
- A WebMCP-capable browser for agent-tool testing

### Install and start

```bash
git clone https://github.com/RKRohk/roomcraft.git
cd roomcraft
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The development server binds to `0.0.0.0` so it can also be reached through an approved remote host. Configure private remote development origins through the `NEXT_ALLOWED_DEV_ORIGINS` environment variable. Do not commit private hostnames or access details.

## WebMCP testing

For Chrome preview builds, enable:

```text
chrome://flags/#enable-webmcp-testing
```

Test WebMCP from a secure HTTPS origin when accessing the app remotely.

The editor still works without WebMCP. In that case, the app reports that the agent tools are unavailable instead of pretending that normal UI actions were WebMCP calls.

## Production build

```bash
npm run build
npm run start
```

## Verify the project

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

The test suite covers:

- room geometry
- dimensions and openings
- furniture search
- custom items
- collision and boundary validation
- door clearance and walkway checks
- undo and redo
- browser-local persistence
- layout variants
- locked furniture
- editor breakpoints
- WebMCP tool behaviour
- browser-host registration
- catalog rendering
- the agent-facing `llms.txt` contract

## Architecture

```text
src/domain/       Room model, fictional catalog, custom items, geometry, validation, history, persistence
src/state/        Observable store shared by React and WebMCP
src/mcp/          Tool definitions, schemas, execution adapter, registration lifecycle
src/components/   Editor shell, canvas, catalog, inspector, validation UI
src/app/          Next.js application entry and global styling
public/           Agent-facing documentation and static assets
```

The canvas and WebMCP tools share one reducer and one undo history. Agent changes therefore become normal editor changes: they appear immediately, can be inspected, and can be undone.

## Current scope

RoomCraft currently focuses on the room-planning workflow.

It does not currently include:

- user accounts
- a backend database
- public room sharing
- export workflows
- checkout or affiliate links
- real retailer inventory
- 3D rendering
- generative room images
- multi-room floor plans
- agent-generated layout optimisation

Built-in catalog data is fictional and generic. User-provided external listing details exist as locally stored custom items and are not fetched from commercial catalogs.

## License

RoomCraft is a group project and is intended to use the MIT License, with `RoomCraft contributors` as the copyright holder.
