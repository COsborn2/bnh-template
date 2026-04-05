import { createAuthClient } from "better-auth/react";
import {
  adminClient,
  usernameClient,
} from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: "",
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
