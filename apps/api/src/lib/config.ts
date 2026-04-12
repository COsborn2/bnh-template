const LOCAL_HOST_RE = /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(\/|$)/i;

function withInferredScheme(value: string): string {
  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  if (LOCAL_HOST_RE.test(value)) {
    return `http://${value}`;
  }

  return `https://${value}`;
}

function parseUrlEnv(name: string, fallback?: string): URL {
  const raw = process.env[name]?.trim();
  const candidate = raw && raw.length > 0 ? raw : fallback;

  if (!candidate) {
    throw new Error(
      `${name} is required and must be a full URL like https://myapp-production.up.railway.app`,
    );
  }

  try {
    return new URL(withInferredScheme(candidate));
  } catch {
    throw new Error(
      `${name}="${candidate}" is invalid. Use a full URL like https://myapp-production.up.railway.app`,
    );
  }
}

const betterAuthUrl = parseUrlEnv("BETTER_AUTH_URL", "http://localhost:3000");

export const betterAuthBaseUrl = betterAuthUrl.origin;
export const betterAuthCorsOrigin = betterAuthUrl.origin;
