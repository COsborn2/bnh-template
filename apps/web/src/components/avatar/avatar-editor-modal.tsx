"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import Image from "next/image";
import { Check, Lock, LockOpen, Shuffle, Undo2 } from "lucide-react";
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
} from "@app/shared";
import { useAvatarStore } from "@/stores/avatar";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toaster";
import { svgToDataUri } from "@/lib/svg-uri";

interface AvatarEditorModalProps {
  onClose: () => void;
}

type PartKey = "shape" | "eyes" | "mouth" | "top" | "extra";
type TabId = "color" | PartKey;

const TABS: { id: TabId; label: string; keys: (keyof AvatarOptions)[] }[] = [
  { id: "color", label: "Color", keys: ["color", "background"] },
  { id: "shape", label: "Head", keys: ["shape"] },
  { id: "eyes", label: "Eyes", keys: ["eyes"] },
  { id: "mouth", label: "Mouth", keys: ["mouth"] },
  { id: "top", label: "Top", keys: ["top"] },
  { id: "extra", label: "Extras", keys: ["extra"] },
];

const PART_VALUES: { [K in PartKey]: readonly AvatarOptions[K][] } = {
  shape: AVATAR_SHAPES,
  eyes: AVATAR_EYES,
  mouth: AVATAR_MOUTHS,
  top: AVATAR_TOPS,
  extra: AVATAR_EXTRAS,
};

/** Small previews of how the bot reads where it actually appears. */
const SIZE_STRIP = [
  { size: 48, label: "48px" },
  { size: 22, label: "22px" },
  { size: 16, label: "16px" },
] as const;

const HISTORY_LIMIT = 30;

/** The renderer throws on unknown options; never let bad data reach it. */
function usableOptions(loaded: unknown): AvatarOptions {
  return parseAvatarOptions(loaded) ?? randomAvatarOptions();
}

function optionLabel(id: string): string {
  return id === "tv" ? "TV" : id.charAt(0).toUpperCase() + id.slice(1);
}

function BotImage({
  options,
  size,
  alt,
  className,
  style,
}: {
  options: AvatarOptions;
  size: number;
  alt: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <Image
      src={svgToDataUri(renderAvatarSvg(options))}
      alt={alt}
      width={size}
      height={size}
      unoptimized
      className={className}
      style={{ display: "block", borderRadius: "50%", flexShrink: 0, ...style }}
    />
  );
}

export function AvatarEditorModal({ onClose }: AvatarEditorModalProps) {
  const loadAvatar = useAvatarStore((s) => s.load);
  const saveAvatar = useAvatarStore((s) => s.save);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [options, setOptions] = useState<AvatarOptions | null>(null);
  const [history, setHistory] = useState<AvatarOptions[]>([]);
  const [tab, setTab] = useState<TabId>("eyes");
  const [locked, setLocked] = useState<ReadonlySet<TabId>>(() => new Set());

  useEffect(() => {
    loadAvatar()
      .then((loaded) => setOptions(usableOptions(loaded?.options)))
      .catch(() => setOptions(randomAvatarOptions()))
      .finally(() => setIsLoading(false));
  }, [loadAvatar]);

  function commit(next: AvatarOptions) {
    if (!options) return;
    setHistory((prev) => [...prev, options].slice(-HISTORY_LIMIT));
    setOptions(next);
  }

  function setPart<K extends keyof AvatarOptions>(key: K, value: AvatarOptions[K]) {
    if (!options || options[key] === value) return;
    commit({ ...options, [key]: value });
  }

  function handleShuffle() {
    if (!options) return;
    const next = randomAvatarOptions();
    for (const t of TABS) {
      if (!locked.has(t.id)) continue;
      for (const key of t.keys) (next as unknown as Record<string, string>)[key] = options[key];
    }
    commit(next);
  }

  function handleUndo() {
    const previous = history.at(-1);
    if (!previous) return;
    setHistory((prev) => prev.slice(0, -1));
    setOptions(previous);
  }

  function toggleLock(id: TabId) {
    setLocked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSave() {
    if (!options) return;
    setIsSaving(true);
    try {
      await saveAvatar(options);
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to save avatar", "error");
    } finally {
      setIsSaving(false);
    }
  }

  const activeTab = TABS.find((t) => t.id === tab) ?? TABS[2];
  const isLocked = locked.has(activeTab.id);

  return (
    <Modal
      onClose={onClose}
      title="Customize your bot"
      subtitle="Shown on your dashboard and next to your chat messages."
      ariaLabel="Customize your avatar"
      maxWidth="max-w-[860px]"
      bodyClassName="px-0 py-0"
      footer={
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10 }}>
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={isSaving || isLoading || !options}>
            <Check size={14} strokeWidth={3} aria-hidden />
            {isSaving ? "Saving…" : "Save avatar"}
          </Button>
        </div>
      }
    >
      {isLoading || !options ? (
        <div
          style={{
            padding: "60px 26px",
            display: "flex",
            justifyContent: "center",
            color: "var(--bnh-text-dim)",
          }}
        >
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--bnh-violet)] border-t-transparent" />
        </div>
      ) : (
        <div className="md:grid md:grid-cols-[248px_minmax(0,1fr)]">
          {/* Stage: pinned above the options on phones, a side column on desktop. */}
          <aside
            style={{
              backgroundColor: "var(--bnh-bg)",
              backgroundImage: "radial-gradient(var(--app-dot) 1.2px, transparent 1.6px)",
              backgroundSize: "22px 22px",
            }}
            className="sticky top-0 z-[2] flex items-center gap-4 border-b-2 border-[var(--app-ink)] px-4 py-3 md:static md:flex-col md:items-stretch md:gap-5 md:border-r-2 md:border-b-0 md:px-6 md:py-6"
          >
            <div className="flex justify-center">
              <BotImage
                options={options}
                size={168}
                alt="Avatar preview"
                className="size-[104px] md:size-[168px]"
                style={{ boxShadow: "var(--app-shadow-lg)" }}
              />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-3 md:gap-4">
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "space-evenly",
                  gap: 8,
                  padding: "8px 10px",
                  border: "2px solid var(--app-ink)",
                  borderRadius: 0,
                  background: "var(--bnh-bg-2)",
                }}
                aria-label="How your bot reads at small sizes"
                role="group"
              >
                {SIZE_STRIP.map(({ size, label }) => (
                  <div
                    key={label}
                    // The 48px sample only fits beside the desktop preview.
                    className={size === 48 ? "hidden md:flex" : "flex"}
                    style={{ flexDirection: "column", alignItems: "center", gap: 4, minWidth: 0 }}
                  >
                    <BotImage options={options} size={size} alt="" />
                    <span style={{ fontSize: 11, color: "var(--bnh-text-mute)" }}>{label}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Button type="button" variant="secondary" onClick={handleShuffle} style={{ flex: 1, height: 44 }}>
                  <Shuffle size={15} strokeWidth={2.4} aria-hidden />
                  Shuffle
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleUndo}
                  disabled={history.length === 0}
                  style={{ width: 44, height: 44, padding: 0 }}
                  aria-label="Undo"
                  title="Undo"
                >
                  <Undo2 size={16} strokeWidth={2.4} aria-hidden />
                </Button>
              </div>
            </div>
          </aside>

          <div className="min-w-0 px-4 pt-4 pb-5 md:px-6 md:pt-5">
            <div
              role="tablist"
              aria-label="Avatar parts"
              className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0"
            >
              {TABS.map((t) => {
                const active = t.id === activeTab.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    id={`avatar-tab-${t.id}`}
                    aria-selected={active}
                    aria-controls="avatar-tab-panel"
                    onClick={() => setTab(t.id)}
                    style={{
                      flexShrink: 0,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      height: 40,
                      padding: "0 14px",
                      border: "2px solid var(--app-ink)",
                      borderRadius: 4,
                      background: active ? "var(--app-select)" : "var(--bnh-surface)",
                      color: active ? "var(--app-on-fill)" : "var(--bnh-text)",
                      boxShadow: active ? "var(--app-shadow-sm)" : "none",
                      fontFamily: "inherit",
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {t.label}
                    {locked.has(t.id) && <Lock size={12} strokeWidth={2.6} aria-label="kept on shuffle" />}
                  </button>
                );
              })}
            </div>

            <div
              role="tabpanel"
              id="avatar-tab-panel"
              aria-labelledby={`avatar-tab-${activeTab.id}`}
              style={{ marginTop: 14 }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div style={{ flex: 1, fontSize: 15, fontWeight: 700 }}>{activeTab.label}</div>
                <button
                  type="button"
                  onClick={() => toggleLock(activeTab.id)}
                  aria-pressed={isLocked}
                  title="Keep this part when you shuffle"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    height: 32,
                    padding: "0 10px",
                    border: "2px solid var(--app-ink)",
                    borderRadius: 4,
                    background: isLocked ? "var(--app-select)" : "transparent",
                    color: isLocked ? "var(--app-on-fill)" : "var(--bnh-text)",
                    fontFamily: "inherit",
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {isLocked ? <Lock size={13} strokeWidth={2.4} aria-hidden /> : <LockOpen size={13} strokeWidth={2.4} aria-hidden />}
                  {isLocked ? "Kept on shuffle" : "Keep on shuffle"}
                </button>
              </div>

              {activeTab.id === "color" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                  <SwatchGroup
                    label="Bot color"
                    values={AVATAR_COLORS}
                    selected={options.color}
                    round={false}
                    onPick={(value) => setPart("color", value)}
                  />
                  <SwatchGroup
                    label="Background"
                    values={AVATAR_BACKGROUNDS}
                    selected={options.background}
                    round
                    onPick={(value) => setPart("background", value)}
                  />
                </div>
              ) : (
                <PartGrid
                  part={activeTab.id}
                  options={options}
                  onPick={(value) => setPart(activeTab.id as PartKey, value as never)}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

function PartGrid({
  part,
  options,
  onPick,
}: {
  part: PartKey;
  options: AvatarOptions;
  onPick: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-2.5 md:gap-3.5">
      {PART_VALUES[part].map((value) => {
        const selected = options[part] === value;
        const label = optionLabel(value);
        return (
          <button
            key={value}
            type="button"
            onClick={() => onPick(value)}
            aria-pressed={selected}
            style={{
              position: "relative",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              minWidth: 0,
              padding: "10px 4px 8px",
              border: "2px solid var(--app-ink)",
              borderRadius: 4,
              background: selected ? "var(--app-select)" : "var(--bnh-surface)",
              color: selected ? "var(--app-on-fill)" : "var(--bnh-text)",
              boxShadow: selected ? "var(--app-shadow-md)" : "none",
              transform: selected ? "translate(-2px, -2px)" : "none",
              fontFamily: "inherit",
              fontSize: 12.5,
              fontWeight: selected ? 700 : 500,
              cursor: "pointer",
            }}
          >
            <BotImage
              options={{ ...options, [part]: value }}
              size={72}
              alt=""
              className="size-14 md:size-[72px]"
            />
            <span style={{ maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {label}
            </span>
            {selected && <SelectedBadge />}
          </button>
        );
      })}
    </div>
  );
}

function SwatchGroup<T extends keyof typeof AVATAR_FILL_HEX>({
  label,
  values,
  selected,
  round,
  onPick,
}: {
  label: string;
  values: readonly T[];
  selected: T;
  round: boolean;
  onPick: (value: T) => void;
}): ReactNode {
  return (
    <div role="group" aria-label={label}>
      <div
        className="font-mono"
        style={{
          fontSize: 10.5,
          color: "var(--bnh-text-mute)",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          marginBottom: 10,
        }}
      >
        {label}
      </div>
      <div className="grid grid-cols-5 gap-x-2 gap-y-3 sm:flex sm:flex-wrap sm:gap-3">
        {values.map((value) => {
          const isSelected = value === selected;
          const name = optionLabel(value);
          return (
            <button
              key={value}
              type="button"
              onClick={() => onPick(value)}
              aria-pressed={isSelected}
              aria-label={`${label}: ${name}`}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 5,
                padding: 0,
                border: 0,
                background: "transparent",
                color: "var(--bnh-text-dim)",
                fontFamily: "inherit",
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              <span
                style={{
                  width: 46,
                  height: 46,
                  boxSizing: "border-box",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "2px solid var(--app-ink)",
                  borderRadius: round ? "50%" : 4,
                  background: AVATAR_FILL_HEX[value],
                  boxShadow: isSelected ? "var(--app-shadow-md)" : "none",
                  transform: isSelected ? "translate(-2px, -2px)" : "none",
                }}
              >
                {isSelected && (
                  <Check size={18} strokeWidth={3} color={value === "charcoal" ? "#fff" : "#000"} aria-hidden />
                )}
              </span>
              <span aria-hidden>{name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SelectedBadge() {
  return (
    <span
      aria-hidden
      style={{
        position: "absolute",
        top: -8,
        right: -8,
        width: 20,
        height: 20,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 4,
        background: "var(--app-ink)",
        color: "var(--app-fill-yellow)",
      }}
    >
      <Check size={13} strokeWidth={3.2} />
    </span>
  );
}
