/**
 * Turns the strings a person types into the same `CustomItemInput` the
 * `create_custom_item` tool receives, so the form and the agent share one
 * definition of a valid custom item. Errors are reported per field: the domain
 * validator answers yes or no, which is enough for a tool result and not enough
 * for someone filling in a form.
 */

import { CATEGORIES, STYLES, type FurnitureCategory, type FurnitureStyle } from "./catalog";
import {
  MAX_CUSTOM_ITEM_DIMENSION_CM,
  MAX_CUSTOM_ITEM_PRICE_USD_CENTS,
  isCustomItemColor,
  isHttpSourceUrl,
  normalizeCustomItemColor,
  type CustomItemInput,
} from "./customItems";
import { parseLength } from "./units";

export interface CustomItemDraft {
  name: string;
  /** Free text: bare centimetres, or friendly input like `2' 6"`, `0.8m`, `950mm`. */
  width: string;
  depth: string;
  height: string;
  /** Dollars as typed, including an optional `$` and thousands separators. */
  price: string;
  category: FurnitureCategory;
  style: FurnitureStyle;
  color: string;
  sourceUrl: string;
  sourceLabel: string;
}

export type CustomItemDraftField =
  | "name"
  | "width"
  | "depth"
  | "height"
  | "price"
  | "color"
  | "sourceUrl";

export type CustomItemDraftErrors = Partial<Record<CustomItemDraftField, string>>;

export type CustomItemDraftResult =
  | { ok: true; input: CustomItemInput }
  | { ok: false; errors: CustomItemDraftErrors };

export const DEFAULT_CUSTOM_ITEM_COLOR = "#6f7d8c";

const NAME_MAX_LENGTH = 160;
const SOURCE_LABEL_MAX_LENGTH = 240;
const LENGTH_HINT = `Enter a size in cm, or a value like 2' 6".`;

export function emptyCustomItemDraft(): CustomItemDraft {
  return {
    name: "",
    width: "",
    depth: "",
    height: "",
    price: "",
    category: CATEGORIES[0],
    style: STYLES[0],
    color: DEFAULT_CUSTOM_ITEM_COLOR,
    sourceUrl: "",
    sourceLabel: "",
  };
}

/**
 * Reads a dollar string as exact cents. Parsing runs on the digits rather than
 * on a float, so a half-cent rounds up instead of drifting down.
 */
export function parseUsdInput(value: string): number | null {
  const cleaned = value.trim().replace(/^\$/, "").replace(/,/g, "");
  const match = /^(\d*)(?:\.(\d+))?$/.exec(cleaned);
  if (!match || cleaned === "") return null;

  const digits = `${match[2] ?? ""}000`.slice(0, 3);
  let cents = Number(match[1] || "0") * 100 + Number(digits.slice(0, 2));
  if (Number(digits[2]) >= 5) cents += 1;

  if (!Number.isSafeInteger(cents) || cents > MAX_CUSTOM_ITEM_PRICE_USD_CENTS) return null;
  return cents;
}

function parseDimension(value: string): number | null {
  const centimetres = parseLength(value);
  if (centimetres === null) return null;
  if (centimetres <= 0 || centimetres > MAX_CUSTOM_ITEM_DIMENSION_CM) return null;
  return centimetres;
}

export function parseCustomItemDraft(draft: CustomItemDraft): CustomItemDraftResult {
  const errors: CustomItemDraftErrors = {};

  const name = draft.name.trim();
  if (!name) errors.name = "Give the item a name.";
  else if (name.length > NAME_MAX_LENGTH) errors.name = `Keep the name under ${NAME_MAX_LENGTH} characters.`;

  const widthCm = parseDimension(draft.width);
  const depthCm = parseDimension(draft.depth);
  const heightCm = parseDimension(draft.height);
  if (widthCm === null) errors.width = LENGTH_HINT;
  if (depthCm === null) errors.depth = LENGTH_HINT;
  if (heightCm === null) errors.height = LENGTH_HINT;

  const priceUsdCents = parseUsdInput(draft.price);
  if (priceUsdCents === null) errors.price = "Enter a price in dollars, such as 249.99.";

  if (!isCustomItemColor(draft.color)) errors.color = "Enter a hex colour, such as #8a5a44.";

  const sourceUrl = draft.sourceUrl.trim();
  if (sourceUrl && !isHttpSourceUrl(sourceUrl)) {
    errors.sourceUrl = "Use an http or https link, or leave this blank.";
  }

  if (!CATEGORIES.includes(draft.category) || !STYLES.includes(draft.style)) {
    // Unreachable from the form's own selects; guards a restored or injected draft.
    return { ok: false, errors };
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const sourceLabel = draft.sourceLabel.trim().slice(0, SOURCE_LABEL_MAX_LENGTH);

  return {
    ok: true,
    input: {
      name,
      widthCm: widthCm as number,
      depthCm: depthCm as number,
      heightCm: heightCm as number,
      priceUsdCents: priceUsdCents as number,
      category: draft.category,
      style: draft.style,
      color: normalizeCustomItemColor(draft.color),
      ...(sourceUrl ? { sourceUrl } : {}),
      ...(sourceLabel ? { sourceLabel } : {}),
    },
  };
}
