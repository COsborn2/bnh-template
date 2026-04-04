export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

export interface AuthResult {
  user: AuthUser;
  sessionId: string;
}

const authUrl = process.env.WS_AUTH_URL;

if (!authUrl) {
  throw new Error("WS_AUTH_URL environment variable is required");
}

export async function validateSession(
  cookieHeader: string
): Promise<AuthResult | null> {
  try {
    const response = await fetch(authUrl!, {
      method: "GET",
      headers: {
        cookie: cookieHeader,
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as {
      session?: { id: string };
      user?: { id: string; name: string; email: string };
    };

    if (!data.session?.id || !data.user?.id) {
      return null;
    }

    return {
      user: {
        id: data.user.id,
        name: data.user.name,
        email: data.user.email,
      },
      sessionId: data.session.id,
    };
  } catch {
    return null;
  }
}
