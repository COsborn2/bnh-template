/**
 * The signed-in user as better-auth's GET /auth/get-session returns it over
 * JSON — the shape server pages fetch with the request's cookies and hand to
 * their client shells as `initialUser`. Clients render it on first paint and
 * switch to `useSession()`'s live user once that settles, so only the fields
 * pages actually read are declared here.
 */
export interface SessionUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null;
  username?: string | null;
  role?: string | null;
}
