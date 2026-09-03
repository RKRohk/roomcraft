@AGENTS.md

# RoomCraft project context

RoomCraft is a WebMCP-enabled collaborative 2D room planner for a hackathon.

## Locked first milestone

- Next.js, TypeScript, React Konva.
- Rectangular room editor with editable dimensions; store geometry in centimeters and display friendly dimensions.
- Grid, wall and dimension rendering, pan/zoom, selection, dragging, rotation, duplication, deletion, and exact property editing.
- Movable doors and windows, including door-swing visualization.
- Detect out-of-bounds furniture, furniture overlap, blocked doors, and configurable walkway-clearance issues.
- Curated local catalog of roughly 30–40 fictional generic items with stable IDs, categories, dimensions, direct USD-cent prices, styles, colors, and original top-down SVG-like representations.
- Persistent room-local custom items, separate from the built-in catalog, with stable IDs, dimensions, USD-cent prices, a single hex color, optional source metadata, and generated top-down representations.
- Versioned room document, browser-local persistence, undo/redo, reset, and locally stored named variants.
- WebMCP tools mutate the same state and history used by direct canvas interactions.

## WebMCP tools

- get_room_state
- set_room_dimensions
- set_room_settings
- add_opening
- update_opening
- remove_opening
- search_furniture
- create_custom_item
- place_furniture
- update_furniture
- remove_furniture
- apply_layout
- validate_layout
- save_layout_variant
- activate_layout_variant
- reset_current_layout
- undo_last_change

Use `document.modelContext.registerTool(...)` and provide a safe TypeScript declaration/fallback when native WebMCP is unavailable. Tool inputs must use explicit JSON schemas. Tool results must be structured, compact, and useful to an agent.

## Explicit exclusions

Do not implement accounts, authentication, databases, public sharing, export UI, checkout, affiliate links, photorealistic rendering, 3D, generative images, or multi-room floor plans in this milestone.

Never mention, imitate, or include real retailers, real brands, or real product names in UI copy, fixtures, catalog data, source comments, or documentation. All built-in catalog content must be fictional and generic. User-provided external listing metadata may only be retained on visibly marked custom items; do not scrape or fetch its URLs.

## Engineering standards

- Follow strict test-driven development for domain behavior: write a focused failing test, run it and verify the expected failure, then implement the minimum code and rerun.
- Keep geometry, validation, catalog search, room reducers/history, and WebMCP adapter logic pure and independently testable.
- The editor is an Operate surface, with Command/Inspect as the secondary surface. Prioritize canvas space, clear selection state, and fast controls over marketing decoration.
- Use accessible controls, real focus states, and at least 44px touch targets where practical.
- Verify with tests, lint, TypeScript, production build, and browser interaction checks.
