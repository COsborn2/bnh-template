import { createAuthClient } from "better-auth/react";
import {
  adminClient,
  usernameClient,
} from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "",
  plugins: [
    adminClient(),
    usernameClient(),
  ],
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  requestPasswordReset,
  resetPassword,
} = authClient;
