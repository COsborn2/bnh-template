export interface GuestProfile {
  id: string;
  name: string;
}

const STORAGE_KEY = "chat-guest-profile";

const ADJECTIVES = [
  "Amber",
  "Bright",
  "Cinder",
  "Clever",
  "Cosmic",
  "Electric",
  "Golden",
  "Lucky",
  "Mellow",
  "Neon",
  "Silver",
  "Swift",
] as const;

const ANIMALS = [
  "Badger",
  "Comet",
  "Falcon",
  "Fox",
  "Gecko",
  "Koala",
  "Lynx",
  "Otter",
  "Panda",
  "Raven",
  "Tiger",
  "Whale",
] as const;

function randomItem<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

function buildGuestName() {
  return `${randomItem(ADJECTIVES)} ${randomItem(ANIMALS)}`;
}

export function createGuestProfile(): GuestProfile {
  return {
    id: crypto.randomUUID(),
    name: buildGuestName(),
  };
}

export function loadGuestProfile(): GuestProfile {
  const stored = window.localStorage.getItem(STORAGE_KEY);

  if (stored) {
    try {
      const parsed = JSON.parse(stored) as Partial<GuestProfile>;
      if (
        typeof parsed.id === "string" &&
        parsed.id.length > 0 &&
        typeof parsed.name === "string" &&
        parsed.name.length > 0
      ) {
        return parsed as GuestProfile;
      }
    } catch {
      // Ignore malformed stored profiles and issue a fresh one instead.
    }
  }

  const nextProfile = createGuestProfile();
  saveGuestProfile(nextProfile);
  return nextProfile;
}

export function saveGuestProfile(profile: GuestProfile) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

export function buildChatWebSocketUrl(guestProfile?: GuestProfile | null) {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const hostname = window.location.hostname;
  const isLocalhost =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1";
  const localDevUrl = `${protocol}//${hostname}:3002/ws`;
  const fallbackUrl = `${protocol}//${window.location.host}/ws`;
  const url = new URL(
    process.env.NEXT_PUBLIC_WS_URL || (isLocalhost ? localDevUrl : fallbackUrl),
  );

  if (url.pathname === "/" || url.pathname === "") {
    url.pathname = "/ws";
  }

  if (guestProfile) {
    url.searchParams.set("guestId", guestProfile.id);
    url.searchParams.set("guestName", guestProfile.name);
  }

  return url.toString();
}
