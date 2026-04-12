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

function isLocalDevHostname(hostname: string) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "[::1]"
  );
}

function buildSocketUrl({ port }: { port?: string } = {}) {
  const url = new URL(window.location.href);
  url.protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/ws";
  url.search = "";
  url.hash = "";

  if (port) {
    url.port = port;
  }

  return url.toString();
}

export function createGuestProfile(): GuestProfile {
  return {
    id: crypto.randomUUID(),
    name: buildGuestName(),
  };
}

export function loadGuestProfile(): GuestProfile {
  let stored: string | null = null;

  try {
    stored = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // Some browser contexts block storage access entirely.
  }

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
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Ignore storage failures and keep the in-memory guest profile.
  }
}

export function buildChatWebSocketUrl(guestProfile?: GuestProfile | null) {
  const hostname = window.location.hostname;
  const localDevUrl = buildSocketUrl({ port: "3002" });
  const fallbackUrl = buildSocketUrl();
  const url = new URL(
    process.env.NEXT_PUBLIC_WS_URL ||
      (isLocalDevHostname(hostname) ? localDevUrl : fallbackUrl),
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
