import { create } from "zustand";
import type { AvatarOptions } from "@app/shared";
import { api } from "@/lib/api";

interface Avatar {
  options: AvatarOptions;
  svg: string;
}

interface AvatarState {
  /** The signed-in user's avatar once loaded; shared by every component that shows it. */
  avatar: Avatar | null;
  /** Fetches the avatar (the API repairs and saves a missing one). Cached after the first load. */
  load: () => Promise<Avatar | null>;
  /** Saves new options; the server renders the SVG. */
  save: (options: AvatarOptions) => Promise<void>;
  /** Forget the cached avatar (sign-out). */
  reset: () => void;
}

let inflight: Promise<Avatar | null> | null = null;

export const useAvatarStore = create<AvatarState>((set, get) => ({
  avatar: null,

  load: () => {
    const cached = get().avatar;
    if (cached) return Promise.resolve(cached);
    inflight ??= api<Avatar>("/account/avatar")
      .then((avatar) => {
        set({ avatar });
        return avatar;
      })
      .finally(() => {
        inflight = null;
      });
    return inflight;
  },

  save: async (options) => {
    const avatar = await api<Avatar>("/account/avatar", {
      method: "PUT",
      body: JSON.stringify(options),
    });
    set({ avatar });
  },

  reset: () => set({ avatar: null }),
}));
