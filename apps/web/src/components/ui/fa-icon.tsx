import type { CSSProperties } from "react";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";

/**
 * Renders a Font Awesome icon straight from its `IconDefinition` data,
 * without the svg-core runtime.
 *
 * `<FontAwesomeIcon>` hard-imports all of `@fortawesome/fontawesome-svg-core`
 * (~28KB gz, marked `sideEffects` so bundlers can never trim it), which is the
 * wrong trade for chrome that rides the root layout onto pages with no other
 * Font Awesome usage (marketing, legal, auth). The icon *definitions* are
 * per-icon tree-shaken modules, so drawing from them keeps every glyph in
 * lockstep with the installed Font Awesome version — never hand-copy path
 * data.
 *
 * Use `<FontAwesomeIcon>` as usual inside app pages (they load the runtime
 * anyway); reach for this only in root-layout/shared chrome.
 */
export function FaIcon({
  icon,
  size = 16,
  className,
  style,
}: {
  icon: IconDefinition;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const [width, height, , , pathData] = icon.icon;
  const paths = Array.isArray(pathData) ? pathData : [pathData];
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${width} ${height}`}
      fill="currentColor"
      aria-hidden="true"
      className={className}
      // FA's own stylesheet renders icons with overflow visible — several
      // glyphs (e.g. faMessage's bubble tail, faWandMagicSparkles' top
      // sparkle) draw past the viewBox.
      style={{ overflow: "visible", ...style }}
    >
      {paths.map((d, i) => (
        // Two-path definitions put the secondary layer first at 40% opacity,
        // matching svg-core's duotone rendering.
        <path
          key={i}
          d={d}
          opacity={paths.length === 2 && i === 0 ? 0.4 : undefined}
        />
      ))}
    </svg>
  );
}
