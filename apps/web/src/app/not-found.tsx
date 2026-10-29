import type { CSSProperties } from "react";
import Link from "next/link";
import { House } from "lucide-react";
import { buttonClassName } from "@/components/ui/button";

/** The "404" itself: three tilted cards, one per digit. */
const DIGITS = [
  { char: "4", fill: "var(--app-fill-yellow)", rotation: -6 },
  { char: "0", fill: "var(--app-fill-pink)", rotation: 3 },
  { char: "4", fill: "var(--app-fill-blue)", rotation: -2 },
];

/** Notes that fell off the page, scattered round the edges (md and up). */
const LOST_NOTES = [
  { text: "Where did it go?", fill: "var(--app-fill-green)", rotation: -10, x: "7%", y: "16%" },
  { text: "Not here…", fill: "var(--app-fill-orange)", rotation: 7, x: "80%", y: "11%" },
  { text: "Try again?", fill: "var(--app-fill-violet)", rotation: -5, x: "83%", y: "66%" },
  { text: "Wrong turn!", fill: "var(--app-fill-blue)", rotation: 12, x: "5%", y: "70%" },
  { text: "Oops", fill: "var(--app-fill-pink)", rotation: -8, x: "72%", y: "40%" },
];

const tilt = (fill: string, rotation: number, extra?: CSSProperties): CSSProperties => ({
  background: fill,
  transform: `rotate(${rotation}deg)`,
  ...extra,
});

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      {LOST_NOTES.map((note, i) => (
        <div
          key={i}
          aria-hidden
          className="pointer-events-none absolute hidden w-[150px] select-none border border-ink px-3.5 pt-3 pb-3.5 font-mono text-xs font-bold text-on-fill shadow-control md:block"
          style={tilt(note.fill, note.rotation, { left: note.x, top: note.y })}
        >
          <span className="mb-2.5 block h-1 w-[34px] bg-on-fill" />
          {note.text}
        </div>
      ))}

      <div className="relative z-10 flex flex-col items-center text-center">
        <span className="app-sticker">Error 404</span>

        <h1 aria-label="404" className="mt-7 mb-8 flex gap-[clamp(10px,2vw,18px)]">
          {DIGITS.map((digit, i) => (
            <span
              key={i}
              aria-hidden
              className="flex h-[1.15em] w-[1em] items-center justify-center border-[3px] border-ink font-display text-[clamp(4.5rem,14vw,8.5rem)] leading-none text-on-fill shadow-[6px_6px_0_var(--app-shadow-ink)]"
              style={tilt(digit.fill, digit.rotation)}
            >
              {digit.char}
            </span>
          ))}
        </h1>

        <p className="max-w-md font-display text-[clamp(1.4rem,3.2vw,1.9rem)] leading-[1.1] text-text">
          Page not found
        </p>
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-text-muted">
          The page you&apos;re looking for doesn&apos;t exist, was moved, or
          maybe it never existed in the first place.
        </p>

        <Link href="/" className={buttonClassName({ size: "lg", className: "mt-8 gap-2" })}>
          <House aria-hidden="true" size={16} />
          Go home
        </Link>
      </div>
    </div>
  );
}
