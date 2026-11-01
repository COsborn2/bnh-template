// Avatars ("Ink Bots"): option lists, a strict validator, a deterministic SVG
// renderer and a random picker. Dependency-free so the API, the web editor's
// live preview and any page that only shows avatars all share one copy.
//
// This package is marked `sideEffects: false`: keep this module free of
// top-level side effects.

/*
 * Option ids are persisted in `user.avatar_options`. Never rename or remove
 * one; append new ids instead, and teach renderAvatarSvg to draw them.
 */

export const AVATAR_SHAPES = ["box", "round", "dome", "tv", "tall", "cog"] as const;

export const AVATAR_COLORS = [
  "yellow",
  "pink",
  "blue",
  "green",
  "orange",
  "violet",
  "red",
  "white",
] as const;

export const AVATAR_BACKGROUNDS = [
  "blue",
  "yellow",
  "pink",
  "green",
  "orange",
  "violet",
  "red",
  "paper",
  "charcoal",
] as const;

export const AVATAR_EYES = [
  "dots",
  "goggles",
  "visor",
  "happy",
  "cyclops",
  "pixel",
  "wink",
  "sleepy",
] as const;

export const AVATAR_MOUTHS = ["smile", "grin", "flat", "grill", "oh", "smirk", "blep"] as const;

export const AVATAR_TOPS = ["none", "antenna", "twin", "fin", "light", "halo"] as const;

export const AVATAR_EXTRAS = ["none", "cheeks", "bolts", "brows"] as const;

export type AvatarShape = (typeof AVATAR_SHAPES)[number];
export type AvatarColor = (typeof AVATAR_COLORS)[number];
export type AvatarBackground = (typeof AVATAR_BACKGROUNDS)[number];
export type AvatarEyes = (typeof AVATAR_EYES)[number];
export type AvatarMouth = (typeof AVATAR_MOUTHS)[number];
export type AvatarTop = (typeof AVATAR_TOPS)[number];
export type AvatarExtra = (typeof AVATAR_EXTRAS)[number];

/** Stored/accepted avatar options: one id per part, all required. */
export interface AvatarOptions {
  shape: AvatarShape;
  color: AvatarColor;
  background: AvatarBackground;
  eyes: AvatarEyes;
  mouth: AvatarMouth;
  top: AvatarTop;
  extra: AvatarExtra;
}

const AVATAR_PARTS: { [K in keyof AvatarOptions]: readonly string[] } = {
  shape: AVATAR_SHAPES,
  color: AVATAR_COLORS,
  background: AVATAR_BACKGROUNDS,
  eyes: AVATAR_EYES,
  mouth: AVATAR_MOUTHS,
  top: AVATAR_TOPS,
  extra: AVATAR_EXTRAS,
};

/**
 * Strict check for anything that claims to be avatar options (a request body,
 * a jsonb column): a plain object with exactly the seven parts, each one of
 * the known ids. Returns a clean copy, or null.
 */
export function parseAvatarOptions(value: unknown): AvatarOptions | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(AVATAR_PARTS) as (keyof AvatarOptions)[];
  if (Object.keys(record).length !== keys.length) return null;
  const out: Record<string, string> = {};
  for (const key of keys) {
    const id = record[key];
    if (typeof id !== "string" || !AVATAR_PARTS[key].includes(id)) return null;
    out[key] = id;
  }
  return out as unknown as AvatarOptions;
}

/**
 * Fill colours, matching the web theme's `--app-fill-*` palette. They are
 * baked into stored SVGs (an `<img>` can't read CSS variables), so changing
 * one re-renders every avatar the next time it is read.
 */
export const AVATAR_FILL_HEX: Record<AvatarColor | AvatarBackground, string> = {
  yellow: "#ffdc58",
  pink: "#ff9ecf",
  blue: "#8fd3ff",
  green: "#8ef0a8",
  orange: "#ffb067",
  violet: "#c3b1ff",
  red: "#ff8f8f",
  white: "#ffffff",
  paper: "#fff7e8",
  charcoal: "#3a3644",
};


/*
 * Ink Bots renderer: options in, a self-contained SVG string out. The API
 * stores the string and every client shows it through an <img> data URI, so
 * it must stay deterministic (same options → byte-identical SVG) and build
 * markup only from the enum ids and numbers below — never from user input.
 * Option values are only ever used as lookup keys, and renderAvatarSvg
 * rejects any value it doesn't know before drawing anything.
 *
 * Drawing space is a 100×100 box. The bot (body, neck, head, face) sits in a
 * circular badge: a background disc, an ink ring, and everything clipped to
 * the circle, so the result looks right whether or not a caller rounds it.
 *
 * Optical sizing: an SVG shown through <img> is its own document, so the
 * media queries in its <style> see the size it's displayed at. Outlines
 * thicken as the avatar shrinks, and below 26px the bot crops to its face so
 * it still reads in card footers and the people pill. The stroke-width
 * attributes are fallbacks for renderers that ignore <style>. Class names and
 * the clip-path id carry an `rbav-` prefix so nothing collides with page
 * styles if an avatar is ever inlined instead of shown through <img>.
 */

const INK = "#000";
const WHITE = "#fff";

interface Head {
  d: string;
  /** Left/right edge, top and bottom of the head. */
  x0: number;
  x1: number;
  top: number;
  bot: number;
  /** Vertical centre (face-crop anchor), eye line, mouth line. */
  cy: number;
  ey: number;
  my: number;
  /** Horizontal distance from the centre line to each eye. */
  dx: number;
}

function n(value: number): string {
  return String(Math.round(value * 100) / 100);
}

function ellipse(cx: number, cy: number, rx: number, ry = rx): string {
  return (
    `M${n(cx - rx)} ${n(cy)}A${rx} ${ry} 0 1 0 ${n(cx + rx)} ${n(cy)}` +
    `A${rx} ${ry} 0 1 0 ${n(cx - rx)} ${n(cy)}Z`
  );
}

function roundedRect(x: number, y: number, w: number, h: number, r: number): string {
  return (
    `M${n(x + r)} ${n(y)}H${n(x + w - r)}A${r} ${r} 0 0 1 ${n(x + w)} ${n(y + r)}` +
    `V${n(y + h - r)}A${r} ${r} 0 0 1 ${n(x + w - r)} ${n(y + h)}` +
    `H${n(x + r)}A${r} ${r} 0 0 1 ${n(x)} ${n(y + h - r)}` +
    `V${n(y + r)}A${r} ${r} 0 0 1 ${n(x + r)} ${n(y)}Z`
  );
}

function cog(cx: number, cy: number, outer: number, inner: number, teeth: number): string {
  const span = (Math.PI * 2) / teeth;
  const start = -Math.PI / 2 - span * 0.3;
  let d = "";
  for (let i = 0; i < teeth; i++) {
    const a = start + i * span;
    const points: [number, number][] = [
      [inner, a],
      [outer, a + span * 0.16],
      [outer, a + span * 0.44],
      [inner, a + span * 0.6],
    ];
    for (const [r, t] of points) {
      d += `${d ? "L" : "M"}${n(cx + r * Math.cos(t))} ${n(cy + r * Math.sin(t))}`;
    }
  }
  return `${d}Z`;
}

const HEADS: Record<AvatarShape, Head> = {
  box: {
    d: "M32 30H68Q76 30 76 38V66Q76 74 68 74H32Q24 74 24 66V38Q24 30 32 30Z",
    x0: 24, x1: 76, top: 30, bot: 74, cy: 52, ey: 47, my: 63, dx: 11,
  },
  round: {
    d: ellipse(50, 52, 27, 24),
    x0: 23, x1: 77, top: 28, bot: 76, cy: 52, ey: 48, my: 63, dx: 11,
  },
  dome: {
    d: "M24 56A26 26 0 0 1 76 56V70Q76 75 71 75H29Q24 75 24 70Z",
    x0: 24, x1: 76, top: 30, bot: 75, cy: 55, ey: 52, my: 66, dx: 11,
  },
  tv: {
    d: "M30 34H70Q82 34 82 46V60Q82 72 70 72H30Q18 72 18 60V46Q18 34 30 34Z",
    x0: 18, x1: 82, top: 34, bot: 72, cy: 53, ey: 50, my: 63, dx: 14,
  },
  tall: {
    d: "M37 22H63Q70 22 70 29V70Q70 77 63 77H37Q30 77 30 70V29Q30 22 37 22Z",
    x0: 30, x1: 70, top: 22, bot: 77, cy: 49.5, ey: 42, my: 62, dx: 9,
  },
  cog: {
    d: cog(50, 52, 28, 23.5, 10),
    x0: 22, x1: 78, top: 24, bot: 80, cy: 52, ey: 48, my: 63, dx: 10,
  },
};

/** Stroke kinds: `o` outlines, `f` feature lines. `rbav-x` hides a detail at tiny sizes. */
type Stroke = "o" | "f";
const STROKE_CLASS: Record<Stroke, string> = { o: "rbav-o", f: "rbav-f" };
const FALLBACK_WIDTH: Record<Stroke, number> = { o: 3.3, f: 4.1 };

function shape(d: string, fill: string, stroke?: Stroke, hideTiny = false): string {
  const classes = [stroke && STROKE_CLASS[stroke], hideTiny ? "rbav-x" : undefined]
    .filter(Boolean)
    .join(" ");
  let attrs = `d="${d}"`;
  if (fill !== "none") attrs += ` fill="${fill}"`;
  if (stroke) attrs += ` stroke="${INK}" stroke-width="${FALLBACK_WIDTH[stroke]}"`;
  if (classes) attrs += ` class="${classes}"`;
  return `<path ${attrs}/>`;
}

function style(head: Head): string {
  // Ring widths are doubled: the ring is clipped to the badge, so only its
  // inner half shows.
  const cropY = n(-(head.cy - 33));
  return (
    "<style>" +
    ".rbav-o{stroke-width:2.2}.rbav-f{stroke-width:3}.rbav-r{stroke-width:3.8}" +
    "@media (max-width:119.98px){.rbav-o{stroke-width:3.3}.rbav-f{stroke-width:4.1}.rbav-r{stroke-width:4.8}}" +
    "@media (max-width:63.98px){.rbav-r{stroke-width:8}}" +
    "@media (max-width:39.98px){.rbav-o{stroke-width:3.6}.rbav-f{stroke-width:4.4}.rbav-r{stroke-width:10}}" +
    "@media (max-width:25.98px){" +
    `.rbav-c{transform-origin:0 0;transform:scale(1.4706) translate(-16px,${cropY}px)}` +
    ".rbav-o{stroke-width:4.2}.rbav-f{stroke-width:5.2}.rbav-r{stroke-width:15}.rbav-x{display:none}}" +
    "</style>"
  );
}

function drawTop(o: AvatarOptions, h: Head, accent: string): { behind: string; front: string } {
  const t = h.top;
  switch (o.top) {
    case "antenna":
      return {
        behind:
          shape(`M50 ${n(t + 6)}V${n(t - 10)}`, "none", "f") +
          shape(ellipse(50, t - 14, 4.5), accent, "o"),
        front: "",
      };
    case "twin":
      return {
        behind:
          shape(`M43 ${n(t + 6)}L36 ${n(t - 9)}M57 ${n(t + 6)}L64 ${n(t - 9)}`, "none", "f") +
          shape(ellipse(35, t - 11.5, 3.8) + ellipse(65, t - 11.5, 3.8), accent, "o"),
        front: "",
      };
    case "fin":
      return {
        behind: shape(
          `M43 ${n(t + 6)}V${n(t - 7)}Q43 ${n(t - 12)} 48 ${n(t - 12)}H52Q57 ${n(t - 12)} 57 ${n(t - 7)}V${n(t + 6)}Z`,
          accent,
          "o",
        ),
        front: "",
      };
    case "light":
      return {
        behind: shape(
          `M41 ${n(t + 6)}V${n(t + 1)}A9 9 0 0 1 59 ${n(t + 1)}V${n(t + 6)}Z`,
          accent,
          "o",
        ),
        front: "",
      };
    case "halo":
      return {
        behind: "",
        front: shape(ellipse(50, t - 10, 17, 6.5) + ellipse(50, t - 10, 9.5, 2.2), accent, "o"),
      };
    case "none":
      return { behind: "", front: "" };
  }
}

function arcUp(x: number, y: number): string {
  return `M${n(x - 5.5)} ${n(y + 2.5)}Q${n(x)} ${n(y - 6)} ${n(x + 5.5)} ${n(y + 2.5)}`;
}

function drawEyes(o: AvatarOptions, h: Head): string {
  const y = h.ey;
  const a = 50 - h.dx;
  const b = 50 + h.dx;
  switch (o.eyes) {
    case "dots":
      return shape(ellipse(a, y, 4.6) + ellipse(b, y, 4.6), INK);
    case "goggles":
      return (
        shape(ellipse(a, y, 8) + ellipse(b, y, 8), WHITE, "o") +
        shape(ellipse(a + 1.2, y + 1.2, 3.6) + ellipse(b + 1.2, y + 1.2, 3.6), INK)
      );
    case "visor":
      return (
        shape(roundedRect(a - 10, y - 6.5, b - a + 20, 13, 6.5), INK) +
        shape(roundedRect(a - 4, y - 2, 8, 4, 1.5) + roundedRect(b - 4, y - 2, 8, 4, 1.5), AVATAR_FILL_HEX.yellow)
      );
    case "happy":
      return shape(arcUp(a, y) + arcUp(b, y), "none", "f");
    case "cyclops":
      return shape(ellipse(50, y, 10), WHITE, "o") + shape(ellipse(51.2, y + 1.2, 4.6), INK);
    case "pixel":
      return shape(`M${n(a - 4)} ${n(y - 4)}h8v8h-8ZM${n(b - 4)} ${n(y - 4)}h8v8h-8Z`, INK);
    case "wink":
      return shape(ellipse(a, y, 4.6), INK) + shape(arcUp(b, y), "none", "f");
    case "sleepy":
      return (
        shape(
          `M${n(a - 5)} ${n(y)}A5 5 0 0 0 ${n(a + 5)} ${n(y)}ZM${n(b - 5)} ${n(y)}A5 5 0 0 0 ${n(b + 5)} ${n(y)}Z`,
          INK,
        ) + shape(`M${n(a - 6.5)} ${n(y)}H${n(a + 6.5)}M${n(b - 6.5)} ${n(y)}H${n(b + 6.5)}`, "none", "f")
      );
  }
}

function drawBrows(o: AvatarOptions, h: Head): string {
  const y = h.ey;
  if (o.eyes === "cyclops") {
    return shape(`M44 ${n(y - 12.5)}Q50 ${n(y - 16)} 56 ${n(y - 12.5)}`, "none", "f", true);
  }
  const a = 50 - h.dx;
  const b = 50 + h.dx;
  return shape(
    `M${n(a - 5)} ${n(y - 11)}Q${n(a)} ${n(y - 15)} ${n(a + 5)} ${n(y - 11)}` +
      `M${n(b - 5)} ${n(y - 11)}Q${n(b)} ${n(y - 15)} ${n(b + 5)} ${n(y - 11)}`,
    "none",
    "f",
    true,
  );
}

function drawMouth(o: AvatarOptions, h: Head): string {
  const y = h.my;
  switch (o.mouth) {
    case "smile":
      return shape(`M42 ${n(y - 2.5)}Q50 ${n(y + 6)} 58 ${n(y - 2.5)}`, "none", "f");
    case "grin":
      return (
        shape(`M40 ${n(y - 3)}H60Q60 ${n(y + 7)} 50 ${n(y + 7)}Q40 ${n(y + 7)} 40 ${n(y - 3)}Z`, INK) +
        shape(`M43.5 ${n(y - 3)}H56.5V${n(y + 0.5)}H43.5Z`, WHITE)
      );
    case "flat":
      return shape(`M43 ${n(y)}H57`, "none", "f");
    case "grill":
      return (
        shape(roundedRect(39, y - 4.5, 22, 9, 2), WHITE, "o") +
        shape(
          `M44.5 ${n(y - 4.5)}V${n(y + 4.5)}M50 ${n(y - 4.5)}V${n(y + 4.5)}M55.5 ${n(y - 4.5)}V${n(y + 4.5)}`,
          "none",
          "o",
        )
      );
    case "oh":
      return shape(ellipse(50, y + 1, 3.8, 4.4), INK);
    case "smirk":
      return shape(`M43 ${n(y + 1)}Q52 ${n(y + 3)} 58 ${n(y - 3.5)}`, "none", "f");
    case "blep":
      return (
        shape(
          `M46 ${n(y)}V${n(y + 4)}A4 4 0 0 0 54 ${n(y + 4)}V${n(y)}Z`,
          o.color === "pink" ? AVATAR_FILL_HEX.red : AVATAR_FILL_HEX.pink,
          "o",
        ) + shape(`M41 ${n(y)}H59`, "none", "f")
      );
  }
}

/** Renders Ink Bots options to a standalone SVG string. Deterministic; throws on unknown options. */
export function renderAvatarSvg(options: AvatarOptions): string {
  // Defence in depth: callers validate first, but the renderer still refuses
  // values it doesn't know instead of trusting them.
  if (!parseAvatarOptions(options)) throw new TypeError("Invalid avatar options");
  const h = HEADS[options.shape];
  const head = AVATAR_FILL_HEX[options.color];
  const accent = options.color === "yellow" ? AVATAR_FILL_HEX.pink : AVATAR_FILL_HEX.yellow;
  const blush =
    options.color === "pink" ? "#ff6fa8" : options.color === "red" ? "#ff5c5c" : AVATAR_FILL_HEX.pink;
  const top = drawTop(options, h, accent);

  let bot = "";
  bot += shape("M8 110C8 94 24 86 40 86H60C76 86 92 94 92 110Z", head, "o");
  bot += shape(`M44 ${n(h.bot - 3)}V87H56V${n(h.bot - 3)}Z`, head, "o");
  bot += top.behind;
  if (options.extra === "bolts") {
    bot += shape(
      `M${n(h.x0 - 5)} ${n(h.ey - 4)}H${n(h.x0 + 6)}V${n(h.ey + 4)}H${n(h.x0 - 5)}Z` +
        `M${n(h.x1 - 6)} ${n(h.ey - 4)}H${n(h.x1 + 5)}V${n(h.ey + 4)}H${n(h.x1 - 6)}Z`,
      WHITE,
      "o",
    );
  }
  bot += shape(h.d, head, "o");
  bot += top.front;
  if (options.extra === "cheeks") {
    bot += shape(ellipse(50 - h.dx - 5, h.my - 4, 4.2, 2.8) + ellipse(50 + h.dx + 5, h.my - 4, 4.2, 2.8), blush, undefined, true);
  }
  bot += drawEyes(options, h);
  if (options.extra === "brows") bot += drawBrows(options, h);
  bot += drawMouth(options, h);

  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" fill-rule="evenodd" stroke-linecap="round" stroke-linejoin="round">' +
    style(h) +
    '<defs><clipPath id="rbav-clip"><circle cx="50" cy="50" r="50"/></clipPath></defs>' +
    '<g clip-path="url(#rbav-clip)">' +
    `<rect width="100" height="100" fill="${AVATAR_FILL_HEX[options.background]}"/>` +
    `<g class="rbav-c">${bot}</g>` +
    `<circle class="rbav-r" cx="50" cy="50" r="50" stroke="${INK}" stroke-width="4.8"/>` +
    "</g></svg>"
  );
}

function pick<T>(list: readonly T[], random: () => number): T {
  return list[Math.min(list.length - 1, Math.floor(random() * list.length))];
}

/** A random, fully specified bot. The head colour never matches the background. */
export function randomAvatarOptions(random: () => number = Math.random): AvatarOptions {
  const background = pick(AVATAR_BACKGROUNDS, random);
  return {
    shape: pick(AVATAR_SHAPES, random),
    color: pick(
      AVATAR_COLORS.filter((c) => c !== background),
      random,
    ),
    background,
    eyes: pick(AVATAR_EYES, random),
    mouth: pick(AVATAR_MOUTHS, random),
    top: pick(AVATAR_TOPS, random),
    extra: pick(AVATAR_EXTRAS, random),
  };
}
