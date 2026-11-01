import Image from "next/image";
import { svgToDataUri } from "@/lib/svg-uri";

interface UserAvatarProps {
  /** The stored avatar SVG, or null when there is none (e.g. a chat guest). */
  svg: string | null | undefined;
  name: string;
  size: number;
  className?: string;
}

/**
 * Shows a stored avatar. Always through an <img> data URI: an SVG in <img>
 * can't run script or load anything, and its own media queries see the size
 * it's drawn at (that's how avatars crop to the face when small). Without an
 * SVG it falls back to the person's initial on an ink-ringed disc.
 */
export function UserAvatar({ svg, name, size, className }: UserAvatarProps) {
  if (svg) {
    return (
      <Image
        src={svgToDataUri(svg)}
        alt=""
        width={size}
        height={size}
        unoptimized
        className={className}
        style={{ width: size, height: size, borderRadius: "50%", display: "block", flexShrink: 0 }}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={className}
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        boxSizing: "border-box",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "50%",
        border: "2px solid var(--app-ink)",
        background: "var(--app-fill-yellow)",
        color: "var(--app-on-fill)",
        fontSize: Math.max(9, Math.round(size * 0.45)),
        fontWeight: 700,
        lineHeight: 1,
      }}
    >
      {(name.trim()[0] ?? "?").toUpperCase()}
    </span>
  );
}
