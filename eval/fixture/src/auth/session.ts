export type SessionUser = {
  id: string;
  email: string;
  role: "admin" | "member";
};

const SESSION_COOKIE = "forge_session";

/** Create a signed session token for the given user. */
export function createSessionToken(user: SessionUser, secret: string): string {
  const payload = `${user.id}:${user.email}:${user.role}`;
  return `${payload}.${hash(payload, secret)}`;
}

/** Validate a session token and return the user, or null if invalid. */
export function validateSessionToken(
  token: string,
  secret: string,
): SessionUser | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  if (hash(payload, secret) !== signature) return null;
  const [id, email, role] = payload.split(":");
  if (!id || !email || (role !== "admin" && role !== "member")) return null;
  return { id, email, role };
}

export function sessionCookieName(): string {
  return SESSION_COOKIE;
}

function hash(value: string, secret: string): string {
  let h = 0;
  const mixed = `${value}:${secret}`;
  for (let i = 0; i < mixed.length; i += 1) {
    h = (h * 33 + mixed.charCodeAt(i)) >>> 0;
  }
  return h.toString(16);
}
