import { create } from "zustand";
import type { AvatarOptions } from "@app/shared";
import { api } from "@/lib/api";
import { getViewerId, registerViewerScopedStore } from "@/stores/viewer-scope";

export interface Avatar {
  options: AvatarOptions;
  svg: string;
}

interface AvatarState {
  /** The signed-in user's avatar once loaded; shared by every component that shows it. */
  avatar: Avatar | null;
  /** Fetches the avatar (the API repairs and saves a missing one). Cached after the first load. */
  load: () => Promise<Avatar | null>;
  /** Seeds the cache with the avatar a server page already fetched for
   *  `ownerId`, so load() doesn't fetch it again. Ignored when the cache is
   *  already filled, or when another account is signed in by now. */
  prime: (avatar: Avatar, ownerId: string) => void;
  /** Saves new options; the server renders the SVG. */
  save: (options: AvatarOptions) => Promise<void>;
  /** Forget the cached avatar. Runs on its own whenever the signed-in account
   *  changes (stores/viewer-scope.ts). */
  reset: () => void;
}

let inflight: Promise<Avatar | null> | null = null;
/** Bumped by reset(), so a response for the previous account that lands
 *  after a switch is dropped instead of cached for the next one. */
let generation = 0;

export const useAvatarStore = create<AvatarState>((set, get) => ({
  avatar: null,

  load: () => {
    const cached = get().avatar;
    if (cached) return Promise.resolve(cached);
    if (inflight) return inflight;
    const requestGeneration = generation;
    const request = api<Avatar>("/account/avatar")
      .then((avatar) => {
        if (requestGeneration === generation) set({ avatar });
        return avatar;
      })
      .finally(() => {
        if (inflight === request) inflight = null;
      });
    inflight = request;
    return request;
  },

  prime: (avatar, ownerId) => {
    if (get().avatar) return;
    const viewer = getViewerId();
    if (viewer !== null && viewer !== ownerId) return;
    set({ avatar });
  },

  save: async (options) => {
    const requestGeneration = generation;
    const avatar = await api<Avatar>("/account/avatar", {
      method: "PUT",
      body: JSON.stringify(options),
    });
    if (requestGeneration === generation) set({ avatar });
  },

  reset: () => {
    generation += 1;
    inflight = null;
    set({ avatar: null });
  },
}));

registerViewerScopedStore(() => useAvatarStore.getState().reset());
