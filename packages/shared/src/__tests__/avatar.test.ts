import { describe, test, expect } from "bun:test";
import {
  AVATAR_BACKGROUNDS,
  AVATAR_COLORS,
  AVATAR_EXTRAS,
  AVATAR_EYES,
  AVATAR_FILL_HEX,
  AVATAR_MOUTHS,
  AVATAR_SHAPES,
  AVATAR_TOPS,
  parseAvatarOptions,
  randomAvatarOptions,
  renderAvatarSvg,
  type AvatarOptions,
} from "../avatar.js";

const base: AvatarOptions = {
  shape: "box",
  color: "yellow",
  background: "blue",
  eyes: "goggles",
  mouth: "smile",
  top: "antenna",
  extra: "none",
};

const PARTS: { [K in keyof AvatarOptions]: readonly AvatarOptions[K][] } = {
  shape: AVATAR_SHAPES,
  color: AVATAR_COLORS,
  background: AVATAR_BACKGROUNDS,
  eyes: AVATAR_EYES,
  mouth: AVATAR_MOUTHS,
  top: AVATAR_TOPS,
  extra: AVATAR_EXTRAS,
};

/** Seeded PRNG so the sweep below is reproducible. */
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("renderAvatarSvg", () => {
  test("returns one standalone SVG document", () => {
    const svg = renderAvatarSvg(base);
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"')).toBe(true);
    expect(svg.endsWith("</svg>")).toBe(true);
    expect(svg.match(/<svg/g)).toHaveLength(1);
  });

  test("is deterministic", () => {
    expect(renderAvatarSvg(base)).toBe(renderAvatarSvg({ ...base }));
  });

  for (const [key, values] of Object.entries(PARTS)) {
    test(`every ${key} renders differently`, () => {
      const outputs = new Set(
        values.map((value) => renderAvatarSvg({ ...base, [key]: value } as AvatarOptions)),
      );
      expect(outputs.size).toBe(values.length);
    });
  }

  test("emits only safe markup for any option combination", () => {
    const random = mulberry32(42);
    for (let i = 0; i < 500; i++) {
      const svg = renderAvatarSvg(randomAvatarOptions(random));
      expect(svg).not.toContain("NaN");
      expect(svg).not.toContain("undefined");
      expect(svg).not.toMatch(/<script|on\w+=|href=|<foreignObject/i);
    }
  });

  test("carries the small-size crop and outline rules", () => {
    const svg = renderAvatarSvg(base);
    expect(svg).toContain("@media (max-width:25.98px)");
    expect(svg).toContain('class="rbav-c"');
    expect(svg).toContain('class="rbav-r"');
  });

  test("namespaces every class and id so an inlined avatar can't restyle the page", () => {
    const random = mulberry32(11);
    for (let i = 0; i < 100; i++) {
      const svg = renderAvatarSvg(randomAvatarOptions(random));
      for (const [, classes] of svg.matchAll(/class="([^"]*)"/g)) {
        for (const name of classes.split(" ")) expect(name).toMatch(/^rbav-/);
      }
      for (const [, id] of svg.matchAll(/\bid="([^"]*)"/g)) expect(id).toMatch(/^rbav-/);
      for (const [, selector] of svg.matchAll(/\.([a-z-]+)\{/g)) expect(selector).toMatch(/^rbav-/);
    }
  });

  test("refuses unknown or malformed options instead of drawing them", () => {
    const bad: unknown[] = [
      null,
      undefined,
      {},
      { ...base, eyes: "laser" },
      { ...base, color: "constructor" },
      { ...base, background: "__proto__" },
      { ...base, shape: "toString" },
      { ...base, mouth: '"><script>alert(1)</script>' },
      { ...base, top: ["antenna"] },
    ];
    for (const options of bad) {
      expect(() => renderAvatarSvg(options as AvatarOptions)).toThrow(TypeError);
    }
  });

  test("the crop recentres on each head shape", () => {
    const crops = new Set(
      AVATAR_SHAPES.map((shape) => renderAvatarSvg({ ...base, shape }).match(/translate\(-16px,(-?[\d.]+)px\)/)?.[1]),
    );
    expect(crops.size).toBeGreaterThan(1);
  });

  test("stays small enough to embed per participant", () => {
    const random = mulberry32(7);
    for (let i = 0; i < 200; i++) {
      expect(renderAvatarSvg(randomAvatarOptions(random)).length).toBeLessThan(4500);
    }
  });
});

describe("randomAvatarOptions", () => {
  test("returns options that pass parseAvatarOptions", () => {
    const random = mulberry32(1);
    for (let i = 0; i < 200; i++) {
      expect(parseAvatarOptions(randomAvatarOptions(random))).not.toBeNull();
    }
  });

  test("never paints the head the same colour as the background", () => {
    const random = mulberry32(3);
    for (let i = 0; i < 500; i++) {
      const options = randomAvatarOptions(random);
      expect(options.color).not.toBe(options.background);
    }
  });

  test("varies between calls", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 20; i++) seen.add(JSON.stringify(randomAvatarOptions()));
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe("parseAvatarOptions", () => {
  test("accepts valid options and returns a clean copy", () => {
    const parsed = parseAvatarOptions({ ...base });
    expect(parsed).toEqual(base);
    expect(parsed).not.toBe(base);
  });

  for (const key of Object.keys(PARTS)) {
    test(`rejects an unknown or missing ${key}`, () => {
      expect(parseAvatarOptions({ ...base, [key]: "laser" })).toBeNull();
      const rest: Record<string, string> = { ...base };
      delete rest[key];
      expect(parseAvatarOptions(rest)).toBeNull();
    });
  }

  test("rejects extra fields, arrays, prototype keys and non-objects", () => {
    for (const value of [
      { ...base, svg: "<svg><script>alert(1)</script></svg>" },
      { ...base, eyes: ["goggles"] },
      { ...base, color: "constructor" },
      [base],
      "box",
      null,
      undefined,
    ]) {
      expect(parseAvatarOptions(value)).toBeNull();
    }
  });
});

describe("avatar option lists", () => {
  test("ids are unique lowercase words, with an explicit none for optional parts", () => {
    for (const list of Object.values(PARTS)) {
      expect(new Set(list).size).toBe(list.length);
      for (const id of list) expect(id).toMatch(/^[a-z]+$/);
    }
    expect(AVATAR_TOPS[0]).toBe("none");
    expect(AVATAR_EXTRAS[0]).toBe("none");
  });

  test("every colour and background has a hex fill", () => {
    for (const id of [...AVATAR_COLORS, ...AVATAR_BACKGROUNDS]) {
      expect(AVATAR_FILL_HEX[id]).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});
