/**
 * The RoomCraft catalog. Every entry is fictional and generic: descriptive
 * names, direct USD prices, and original top-down artwork described
 * as normalised shape primitives rather than bitmaps.
 *
 * Shape coordinates run 0..1 across the item's width (x) and depth (y), with
 * y = 0 at the back of the piece. An unrotated item faces +y.
 */

export const CATEGORIES = [
  "seating",
  "tables",
  "storage",
  "beds",
  "workspace",
  "lighting",
  "rugs",
  "decor",
] as const;
export type FurnitureCategory = (typeof CATEGORIES)[number];

export const STYLES = ["modern", "minimal", "classic", "cozy", "industrial"] as const;
export type FurnitureStyle = (typeof STYLES)[number];

/** Roles are resolved against the instance colour at render time. */
export type ShapeRole = "body" | "panel" | "cushion" | "accent" | "outline";

export interface ShapeRectangle {
  kind: "rect";
  x: number;
  y: number;
  w: number;
  h: number;
  radius?: number;
  role: ShapeRole;
  stroke?: boolean;
}

export interface ShapeEllipse {
  kind: "ellipse";
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  role: ShapeRole;
  stroke?: boolean;
}

export interface ShapePolyline {
  kind: "line";
  points: number[];
  role: ShapeRole;
  closed?: boolean;
}

export type ShapePrimitive = ShapeRectangle | ShapeEllipse | ShapePolyline;

export interface ColorOption {
  id: string;
  name: string;
  hex: string;
}

export interface CatalogItem {
  id: string;
  name: string;
  description: string;
  category: FurnitureCategory;
  style: FurnitureStyle;
  widthCm: number;
  depthCm: number;
  heightCm: number;
  /** Price in USD cents; this is a direct display price, not a conversion. */
  priceUsdCents: number;
  colors: ColorOption[];
  tags: string[];
  shape: ShapePrimitive[];
}

const rect = (
  x: number,
  y: number,
  w: number,
  h: number,
  role: ShapeRole,
  radius = 0,
  stroke = false,
): ShapeRectangle => ({ kind: "rect", x, y, w, h, role, radius, stroke });

const ellipse = (
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  role: ShapeRole,
  stroke = false,
): ShapeEllipse => ({ kind: "ellipse", cx, cy, rx, ry, role, stroke });

const line = (points: number[], role: ShapeRole, closed = false): ShapePolyline => ({
  kind: "line",
  points,
  role,
  closed,
});

/** Upholstered seat with a back cushion and `seats` seat cushions. */
function upholstered(seats: number, armWidth = 0.09): ShapePrimitive[] {
  const inner = 1 - armWidth * 2;
  const gap = 0.012;
  const cushionWidth = (inner - gap * (seats - 1)) / seats;
  const cushions: ShapePrimitive[] = [];
  for (let i = 0; i < seats; i += 1) {
    cushions.push(
      rect(armWidth + i * (cushionWidth + gap), 0.3, cushionWidth, 0.58, "cushion", 0.04),
    );
  }
  return [
    rect(0, 0, 1, 1, "body", 0.06),
    rect(armWidth, 0.06, inner, 0.2, "panel", 0.04),
    ...cushions,
  ];
}

/** Slab top with legs showing at the corners. */
function tableTop(inset = 0.08): ShapePrimitive[] {
  return [
    rect(0, 0, 1, 1, "body", 0.04),
    rect(inset, inset, 1 - inset * 2, 1 - inset * 2, "panel", 0.03, true),
  ];
}

/** Carcass with vertical dividers, read from above. */
function carcass(bays: number): ShapePrimitive[] {
  const dividers: ShapePrimitive[] = [];
  for (let i = 1; i < bays; i += 1) {
    const x = i / bays;
    dividers.push(line([x, 0.12, x, 0.88], "outline"));
  }
  return [
    rect(0, 0, 1, 1, "body", 0.02),
    rect(0.03, 0.12, 0.94, 0.76, "panel", 0.02),
    ...dividers,
  ];
}

/** Mattress with pillows along the head edge. */
function mattress(pillows: number): ShapePrimitive[] {
  const gap = 0.04;
  const width = (0.86 - gap * (pillows - 1)) / pillows;
  const cushions: ShapePrimitive[] = [];
  for (let i = 0; i < pillows; i += 1) {
    cushions.push(rect(0.07 + i * (width + gap), 0.04, width, 0.14, "cushion", 0.03));
  }
  return [
    rect(0, 0, 1, 1, "body", 0.03),
    ...cushions,
    rect(0.03, 0.22, 0.94, 0.74, "panel", 0.03),
    line([0.03, 0.46, 0.97, 0.46], "outline"),
  ];
}

const NEUTRALS: ColorOption[] = [
  { id: "oat", name: "Oat", hex: "#d8cbb6" },
  { id: "slate", name: "Slate", hex: "#6d7683" },
  { id: "moss", name: "Moss", hex: "#78876a" },
  { id: "clay", name: "Clay", hex: "#b8785f" },
];

const WOODS: ColorOption[] = [
  { id: "pale-oak", name: "Pale Oak", hex: "#c9a97e" },
  { id: "walnut", name: "Walnut", hex: "#8a6244" },
  { id: "charcoal", name: "Charcoal", hex: "#4a4d52" },
];

const PAINTED: ColorOption[] = [
  { id: "chalk", name: "Chalk", hex: "#e2ded6" },
  { id: "ink", name: "Ink", hex: "#3c4450" },
  { id: "sage", name: "Sage", hex: "#8fa08a" },
];

export const CATALOG: CatalogItem[] = [
  // ---------------------------------------------------------------- seating
  {
    id: "seat-sofa-three",
    name: "Three-Seat Sofa",
    description: "Deep three-seat sofa with a low back and square arms.",
    category: "seating",
    style: "modern",
    widthCm: 210,
    depthCm: 90,
    heightCm: 82,
    priceUsdCents: 129900,
    colors: NEUTRALS,
    tags: ["sofa", "couch", "living room", "lounge"],
    shape: upholstered(3),
  },
  {
    id: "seat-sofa-two",
    name: "Two-Seat Sofa",
    description: "Compact two-seat sofa for smaller living areas.",
    category: "seating",
    style: "minimal",
    widthCm: 160,
    depthCm: 88,
    heightCm: 80,
    priceUsdCents: 99900,
    colors: NEUTRALS,
    tags: ["sofa", "loveseat", "couch", "living room"],
    shape: upholstered(2),
  },
  {
    id: "seat-sectional-l",
    name: "L-Shaped Sectional Sofa",
    description: "Corner sectional with a long return, right-hand facing.",
    category: "seating",
    style: "modern",
    widthCm: 260,
    depthCm: 180,
    heightCm: 80,
    priceUsdCents: 219900,
    colors: NEUTRALS,
    tags: ["sofa", "sectional", "corner", "living room"],
    shape: [
      rect(0, 0, 1, 0.5, "body", 0.04),
      rect(0.62, 0, 0.38, 1, "body", 0.04),
      rect(0.04, 0.05, 0.56, 0.12, "panel", 0.03),
      rect(0.05, 0.2, 0.55, 0.26, "cushion", 0.03),
      rect(0.66, 0.2, 0.3, 0.36, "cushion", 0.03),
      rect(0.66, 0.6, 0.3, 0.34, "cushion", 0.03),
    ],
  },
  {
    id: "seat-armchair",
    name: "Armchair",
    description: "Generously padded armchair with rolled arms.",
    category: "seating",
    style: "cozy",
    widthCm: 84,
    depthCm: 86,
    heightCm: 78,
    priceUsdCents: 59900,
    colors: NEUTRALS,
    tags: ["chair", "armchair", "living room", "lounge"],
    shape: upholstered(1, 0.14),
  },
  {
    id: "seat-accent-chair",
    name: "Accent Chair",
    description: "Slim occasional chair on tapered legs.",
    category: "seating",
    style: "minimal",
    widthCm: 66,
    depthCm: 70,
    heightCm: 80,
    priceUsdCents: 34900,
    colors: PAINTED,
    tags: ["chair", "accent", "occasional"],
    shape: [
      rect(0.05, 0.1, 0.9, 0.85, "body", 0.12),
      rect(0.12, 0.02, 0.76, 0.16, "panel", 0.08),
      rect(0.16, 0.3, 0.68, 0.5, "cushion", 0.1),
    ],
  },
  {
    id: "seat-ottoman",
    name: "Upholstered Ottoman",
    description: "Square ottoman that doubles as a footrest.",
    category: "seating",
    style: "cozy",
    widthCm: 60,
    depthCm: 60,
    heightCm: 42,
    priceUsdCents: 19900,
    colors: NEUTRALS,
    tags: ["ottoman", "footstool", "pouf"],
    shape: [
      rect(0, 0, 1, 1, "body", 0.14),
      rect(0.1, 0.1, 0.8, 0.8, "cushion", 0.12),
      line([0.5, 0.1, 0.5, 0.9], "outline"),
    ],
  },
  {
    id: "seat-bench",
    name: "Entry Bench",
    description: "Slatted bench with an open shelf underneath.",
    category: "seating",
    style: "industrial",
    widthCm: 120,
    depthCm: 40,
    heightCm: 45,
    priceUsdCents: 24900,
    colors: WOODS,
    tags: ["bench", "seat", "hallway", "entry"],
    shape: [
      rect(0, 0, 1, 1, "body", 0.05),
      line([0.03, 0.33, 0.97, 0.33], "outline"),
      line([0.03, 0.66, 0.97, 0.66], "outline"),
    ],
  },
  {
    id: "seat-dining-chair",
    name: "Dining Chair",
    description: "Wooden dining chair with a shaped back.",
    category: "seating",
    style: "classic",
    widthCm: 46,
    depthCm: 52,
    heightCm: 88,
    priceUsdCents: 12900,
    colors: WOODS,
    tags: ["chair", "dining", "seat"],
    shape: [
      rect(0.06, 0.14, 0.88, 0.8, "body", 0.08),
      rect(0.06, 0.0, 0.88, 0.12, "panel", 0.05),
      rect(0.16, 0.26, 0.68, 0.56, "cushion", 0.06),
    ],
  },
  {
    id: "seat-bar-stool",
    name: "Bar Stool",
    description: "Round-top stool with a footrest ring.",
    category: "seating",
    style: "industrial",
    widthCm: 40,
    depthCm: 40,
    heightCm: 100,
    priceUsdCents: 14900,
    colors: WOODS,
    tags: ["stool", "bar", "counter", "seat"],
    shape: [
      ellipse(0.5, 0.5, 0.5, 0.5, "body"),
      ellipse(0.5, 0.5, 0.34, 0.34, "panel"),
      ellipse(0.5, 0.5, 0.12, 0.12, "accent"),
    ],
  },

  // ----------------------------------------------------------------- tables
  {
    id: "table-coffee-rect",
    name: "Rectangular Coffee Table",
    description: "Low table with a recessed lower shelf.",
    category: "tables",
    style: "modern",
    widthCm: 120,
    depthCm: 60,
    heightCm: 42,
    priceUsdCents: 29900,
    colors: WOODS,
    tags: ["table", "coffee table", "living room"],
    shape: tableTop(0.1),
  },
  {
    id: "table-coffee-round",
    name: "Round Coffee Table",
    description: "Circular coffee table on a pedestal base.",
    category: "tables",
    style: "minimal",
    widthCm: 90,
    depthCm: 90,
    heightCm: 40,
    priceUsdCents: 26900,
    colors: WOODS,
    tags: ["table", "coffee table", "round"],
    shape: [
      ellipse(0.5, 0.5, 0.5, 0.5, "body"),
      ellipse(0.5, 0.5, 0.36, 0.36, "panel", true),
      ellipse(0.5, 0.5, 0.14, 0.14, "panel"),
    ],
  },
  {
    id: "table-side",
    name: "Side Table",
    description: "Small square side table for beside a sofa.",
    category: "tables",
    style: "minimal",
    widthCm: 45,
    depthCm: 45,
    heightCm: 55,
    priceUsdCents: 11900,
    colors: WOODS,
    tags: ["table", "side table", "end table"],
    shape: tableTop(0.16),
  },
  {
    id: "table-console",
    name: "Console Table",
    description: "Narrow console for hallways and behind sofas.",
    category: "tables",
    style: "classic",
    widthCm: 120,
    depthCm: 35,
    heightCm: 78,
    priceUsdCents: 27900,
    colors: WOODS,
    tags: ["table", "console", "hallway"],
    shape: [
      rect(0, 0, 1, 1, "body", 0.03),
      rect(0.04, 0.18, 0.92, 0.64, "panel", 0.02, true),
      line([0.5, 0.18, 0.5, 0.82], "outline"),
    ],
  },
  {
    id: "table-dining-four",
    name: "Four-Seat Dining Table",
    description: "Rectangular dining table sized for four covers.",
    category: "tables",
    style: "modern",
    widthCm: 140,
    depthCm: 80,
    heightCm: 75,
    priceUsdCents: 64900,
    colors: WOODS,
    tags: ["table", "dining", "kitchen"],
    shape: tableTop(0.09),
  },
  {
    id: "table-dining-six",
    name: "Six-Seat Dining Table",
    description: "Long dining table with a solid plank top.",
    category: "tables",
    style: "classic",
    widthCm: 200,
    depthCm: 95,
    heightCm: 75,
    priceUsdCents: 89900,
    colors: WOODS,
    tags: ["table", "dining", "kitchen", "large"],
    shape: [
      ...tableTop(0.07),
      line([0.33, 0.07, 0.33, 0.93], "outline"),
      line([0.66, 0.07, 0.66, 0.93], "outline"),
    ],
  },
  {
    id: "table-dining-round",
    name: "Round Dining Table",
    description: "Pedestal dining table seating four comfortably.",
    category: "tables",
    style: "cozy",
    widthCm: 120,
    depthCm: 120,
    heightCm: 75,
    priceUsdCents: 72900,
    colors: WOODS,
    tags: ["table", "dining", "round", "kitchen"],
    shape: [
      ellipse(0.5, 0.5, 0.5, 0.5, "body"),
      ellipse(0.5, 0.5, 0.38, 0.38, "panel", true),
      ellipse(0.5, 0.5, 0.16, 0.16, "panel"),
    ],
  },

  // ---------------------------------------------------------------- storage
  {
    id: "store-bookshelf-tall",
    name: "Tall Bookshelf",
    description: "Five-shelf open bookcase, wall anchored.",
    category: "storage",
    style: "minimal",
    widthCm: 80,
    depthCm: 32,
    heightCm: 200,
    priceUsdCents: 39900,
    colors: PAINTED,
    tags: ["shelf", "bookshelf", "bookcase", "storage"],
    shape: carcass(2),
  },
  {
    id: "store-bookshelf-low",
    name: "Low Bookshelf",
    description: "Two-shelf bookcase that works as a room divider.",
    category: "storage",
    style: "minimal",
    widthCm: 120,
    depthCm: 32,
    heightCm: 90,
    priceUsdCents: 32900,
    colors: PAINTED,
    tags: ["shelf", "bookshelf", "bookcase", "storage", "divider"],
    shape: carcass(3),
  },
  {
    id: "store-media-console",
    name: "Media Console",
    description: "Low console with two drawers and a cable channel.",
    category: "storage",
    style: "modern",
    widthCm: 160,
    depthCm: 42,
    heightCm: 50,
    priceUsdCents: 49900,
    colors: WOODS,
    tags: ["media", "console", "tv stand", "storage"],
    shape: [
      rect(0, 0, 1, 1, "body", 0.03),
      rect(0.04, 0.14, 0.44, 0.72, "panel", 0.02),
      rect(0.52, 0.14, 0.44, 0.72, "panel", 0.02),
      line([0.26, 0.4, 0.26, 0.6], "accent"),
      line([0.74, 0.4, 0.74, 0.6], "accent"),
    ],
  },
  {
    id: "store-sideboard",
    name: "Sideboard",
    description: "Four-door sideboard for dining storage.",
    category: "storage",
    style: "classic",
    widthCm: 180,
    depthCm: 45,
    heightCm: 80,
    priceUsdCents: 74900,
    colors: WOODS,
    tags: ["sideboard", "buffet", "cabinet", "storage", "dining"],
    shape: carcass(4),
  },
  {
    id: "store-wardrobe",
    name: "Two-Door Wardrobe",
    description: "Full-height wardrobe with hanging rail and shelf.",
    category: "storage",
    style: "classic",
    widthCm: 150,
    depthCm: 60,
    heightCm: 210,
    priceUsdCents: 109900,
    colors: PAINTED,
    tags: ["wardrobe", "closet", "storage", "bedroom"],
    shape: [
      rect(0, 0, 1, 1, "body", 0.02),
      rect(0.03, 0.1, 0.45, 0.8, "panel", 0.02),
      rect(0.52, 0.1, 0.45, 0.8, "panel", 0.02),
      line([0.44, 0.45, 0.44, 0.55], "accent"),
      line([0.56, 0.45, 0.56, 0.55], "accent"),
    ],
  },
  {
    id: "store-dresser",
    name: "Six-Drawer Dresser",
    description: "Wide chest of drawers for bedroom storage.",
    category: "storage",
    style: "modern",
    widthCm: 140,
    depthCm: 48,
    heightCm: 80,
    priceUsdCents: 62900,
    colors: WOODS,
    tags: ["dresser", "drawers", "chest", "storage", "bedroom"],
    shape: [
      rect(0, 0, 1, 1, "body", 0.03),
      rect(0.04, 0.12, 0.28, 0.76, "panel", 0.02),
      rect(0.36, 0.12, 0.28, 0.76, "panel", 0.02),
      rect(0.68, 0.12, 0.28, 0.76, "panel", 0.02),
    ],
  },
  {
    id: "store-nightstand",
    name: "Nightstand",
    description: "Bedside table with a drawer and open cubby.",
    category: "storage",
    style: "minimal",
    widthCm: 45,
    depthCm: 40,
    heightCm: 55,
    priceUsdCents: 15900,
    colors: WOODS,
    tags: ["nightstand", "bedside", "storage", "bedroom"],
    shape: [
      rect(0, 0, 1, 1, "body", 0.06),
      rect(0.1, 0.16, 0.8, 0.34, "panel", 0.03),
      rect(0.1, 0.56, 0.8, 0.28, "panel", 0.03, true),
    ],
  },

  // ------------------------------------------------------------------- beds
  {
    id: "bed-single",
    name: "Single Bed",
    description: "Single bed frame with a low headboard.",
    category: "beds",
    style: "minimal",
    widthCm: 90,
    depthCm: 200,
    heightCm: 45,
    priceUsdCents: 54900,
    colors: PAINTED,
    tags: ["bed", "single", "bedroom"],
    shape: mattress(1),
  },
  {
    id: "bed-double",
    name: "Double Bed",
    description: "Double bed frame with an upholstered headboard.",
    category: "beds",
    style: "cozy",
    widthCm: 140,
    depthCm: 200,
    heightCm: 45,
    priceUsdCents: 84900,
    colors: NEUTRALS,
    tags: ["bed", "double", "bedroom"],
    shape: mattress(2),
  },
  {
    id: "bed-queen",
    name: "Queen Bed",
    description: "Queen bed with a slatted base and tall headboard.",
    category: "beds",
    style: "modern",
    widthCm: 160,
    depthCm: 210,
    heightCm: 48,
    priceUsdCents: 99900,
    colors: NEUTRALS,
    tags: ["bed", "queen", "bedroom"],
    shape: mattress(2),
  },
  {
    id: "bed-king",
    name: "King Bed",
    description: "Wide king bed with a padded surround.",
    category: "beds",
    style: "classic",
    widthCm: 190,
    depthCm: 210,
    heightCm: 48,
    priceUsdCents: 129900,
    colors: NEUTRALS,
    tags: ["bed", "king", "bedroom", "large"],
    shape: mattress(3),
  },

  // -------------------------------------------------------------- workspace
  {
    id: "work-desk",
    name: "Writing Desk",
    description: "Slim desk with a single shallow drawer.",
    category: "workspace",
    style: "minimal",
    widthCm: 130,
    depthCm: 60,
    heightCm: 75,
    priceUsdCents: 44900,
    colors: WOODS,
    tags: ["desk", "office", "workspace", "study"],
    shape: [
      rect(0, 0, 1, 1, "body", 0.03),
      rect(0.05, 0.6, 0.5, 0.3, "panel", 0.02),
      line([0.3, 0.72, 0.3, 0.78], "accent"),
    ],
  },
  {
    id: "work-desk-corner",
    name: "Corner Desk",
    description: "L-shaped desk that tucks into a corner.",
    category: "workspace",
    style: "industrial",
    widthCm: 160,
    depthCm: 160,
    heightCm: 75,
    priceUsdCents: 69900,
    colors: WOODS,
    tags: ["desk", "corner", "office", "workspace", "l-shaped"],
    shape: [
      rect(0, 0, 1, 0.38, "body", 0.03),
      rect(0, 0, 0.38, 1, "body", 0.03),
      rect(0.05, 0.05, 0.9, 0.28, "panel", 0.02, true),
      rect(0.05, 0.42, 0.28, 0.53, "panel", 0.02, true),
    ],
  },
  {
    id: "work-task-chair",
    name: "Task Chair",
    description: "Height-adjustable task chair on castors.",
    category: "workspace",
    style: "modern",
    widthCm: 62,
    depthCm: 62,
    heightCm: 110,
    priceUsdCents: 39900,
    colors: PAINTED,
    tags: ["chair", "task chair", "office", "desk", "workspace"],
    shape: [
      ellipse(0.5, 0.55, 0.42, 0.42, "body"),
      rect(0.12, 0.02, 0.76, 0.2, "panel", 0.08),
      ellipse(0.5, 0.55, 0.12, 0.12, "accent"),
    ],
  },
  {
    id: "work-filing-cabinet",
    name: "Filing Cabinet",
    description: "Three-drawer filing cabinet on a plinth.",
    category: "workspace",
    style: "industrial",
    widthCm: 45,
    depthCm: 55,
    heightCm: 70,
    priceUsdCents: 22900,
    colors: PAINTED,
    tags: ["cabinet", "filing", "office", "storage", "workspace"],
    shape: [
      rect(0, 0, 1, 1, "body", 0.03),
      rect(0.1, 0.1, 0.8, 0.8, "panel", 0.02),
      line([0.35, 0.5, 0.65, 0.5], "accent"),
    ],
  },

  // --------------------------------------------------------------- lighting
  {
    id: "light-floor-lamp",
    name: "Floor Lamp",
    description: "Slim floor lamp with a drum shade.",
    category: "lighting",
    style: "minimal",
    widthCm: 40,
    depthCm: 40,
    heightCm: 160,
    priceUsdCents: 17900,
    colors: PAINTED,
    tags: ["lamp", "floor lamp", "lighting"],
    shape: [
      ellipse(0.5, 0.5, 0.5, 0.5, "body", true),
      ellipse(0.5, 0.5, 0.28, 0.28, "panel"),
      ellipse(0.5, 0.5, 0.08, 0.08, "accent"),
    ],
  },
  {
    id: "light-arc-lamp",
    name: "Arc Floor Lamp",
    description: "Weighted base with a long arcing arm over the seat.",
    category: "lighting",
    style: "modern",
    widthCm: 90,
    depthCm: 40,
    heightCm: 200,
    priceUsdCents: 31900,
    colors: PAINTED,
    tags: ["lamp", "arc lamp", "lighting", "floor lamp"],
    shape: [
      ellipse(0.15, 0.5, 0.15, 0.35, "body"),
      line([0.15, 0.5, 0.5, 0.5, 0.85, 0.5], "outline"),
      ellipse(0.85, 0.5, 0.15, 0.15, "panel"),
    ],
  },

  // ------------------------------------------------------------------- rugs
  {
    id: "rug-small",
    name: "Small Area Rug",
    description: "Flat-woven rug with a plain border.",
    category: "rugs",
    style: "minimal",
    widthCm: 160,
    depthCm: 230,
    heightCm: 1,
    priceUsdCents: 24900,
    colors: NEUTRALS,
    tags: ["rug", "carpet", "floor"],
    shape: [
      rect(0, 0, 1, 1, "body", 0.01),
      rect(0.06, 0.04, 0.88, 0.92, "accent", 0.01, true),
    ],
  },
  {
    id: "rug-large",
    name: "Large Area Rug",
    description: "Room-sized rug that anchors a seating group.",
    category: "rugs",
    style: "cozy",
    widthCm: 200,
    depthCm: 300,
    heightCm: 1,
    priceUsdCents: 39900,
    colors: NEUTRALS,
    tags: ["rug", "carpet", "floor", "large"],
    shape: [
      rect(0, 0, 1, 1, "body", 0.01),
      rect(0.05, 0.03, 0.9, 0.94, "accent", 0.01, true),
      rect(0.12, 0.08, 0.76, 0.84, "accent", 0.01, true),
    ],
  },
  {
    id: "rug-round",
    name: "Round Rug",
    description: "Circular rug with concentric bands.",
    category: "rugs",
    style: "modern",
    widthCm: 180,
    depthCm: 180,
    heightCm: 1,
    priceUsdCents: 29900,
    colors: NEUTRALS,
    tags: ["rug", "carpet", "floor", "round"],
    shape: [
      ellipse(0.5, 0.5, 0.5, 0.5, "body"),
      ellipse(0.5, 0.5, 0.36, 0.36, "accent", true),
      ellipse(0.5, 0.5, 0.18, 0.18, "accent", true),
    ],
  },

  // ------------------------------------------------------------------ decor
  {
    id: "decor-plant-large",
    name: "Large Potted Plant",
    description: "Tall leafy plant in a floor planter.",
    category: "decor",
    style: "cozy",
    widthCm: 60,
    depthCm: 60,
    heightCm: 150,
    priceUsdCents: 12900,
    colors: [
      { id: "terracotta", name: "Terracotta", hex: "#b8785f" },
      { id: "chalk", name: "Chalk", hex: "#e2ded6" },
      { id: "charcoal", name: "Charcoal", hex: "#4a4d52" },
    ],
    tags: ["plant", "greenery", "planter", "decor"],
    shape: [
      ellipse(0.5, 0.5, 0.42, 0.42, "body"),
      ellipse(0.36, 0.4, 0.22, 0.22, "accent"),
      ellipse(0.64, 0.42, 0.24, 0.24, "accent"),
      ellipse(0.5, 0.66, 0.2, 0.2, "accent"),
    ],
  },
  {
    id: "decor-plant-small",
    name: "Small Potted Plant",
    description: "Compact plant for a shelf or corner.",
    category: "decor",
    style: "minimal",
    widthCm: 30,
    depthCm: 30,
    heightCm: 60,
    priceUsdCents: 5900,
    colors: [
      { id: "terracotta", name: "Terracotta", hex: "#b8785f" },
      { id: "chalk", name: "Chalk", hex: "#e2ded6" },
    ],
    tags: ["plant", "greenery", "planter", "decor", "small"],
    shape: [
      ellipse(0.5, 0.5, 0.4, 0.4, "body"),
      ellipse(0.5, 0.5, 0.26, 0.26, "accent"),
    ],
  },
  {
    id: "decor-floor-mirror",
    name: "Leaning Floor Mirror",
    description: "Full-height mirror that leans against the wall.",
    category: "decor",
    style: "classic",
    widthCm: 60,
    depthCm: 25,
    heightCm: 170,
    priceUsdCents: 21900,
    colors: WOODS,
    tags: ["mirror", "decor", "bedroom"],
    shape: [
      rect(0, 0.25, 1, 0.5, "body", 0.06),
      rect(0.06, 0.34, 0.88, 0.32, "accent", 0.04),
    ],
  },
];

const BY_ID = new Map(CATALOG.map((item) => [item.id, item]));

export function getCatalogItem(id: string): CatalogItem | undefined {
  return BY_ID.get(id);
}
