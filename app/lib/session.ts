export const SESSION_KEY = "agricart_current_user";
export const USERS_KEY = "agricart_users";

/**
 * Same-tab change signal. The native `storage` event only fires in other tabs,
 * so anything subscribing to the session needs this to see local writes.
 * Implemented as a local function rather than an import so this module stays
 * free of client-only dependencies.
 */
function notifySessionChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("agricart_session_change"));
}

export const ROLES = ["customer", "farmer", "delivery", "admin"] as const;

export type Role = (typeof ROLES)[number];

export type StoredUser = {
  /**
   * Stable account identifier. Deterministic from email + role rather than
   * generated, so a farmer's product, an order and a profile can all be
   * attributed without a lookup table. It has to include the role because
   * uniqueness here is (email, role): the same address may hold one account of
   * each role, so the email alone is not a key.
   */
  id: string;
  name: string;
  email: string;
  password: string;
  role: Role;
  createdAt: string;
};

export type Session = {
  name: string;
  email: string;
  role: Role;
};

export function accountId(email: string, role: Role): string {
  return `${role}:${email.trim().toLowerCase()}`;
}

/** The account id behind a live session. */
export function sessionId(session: Session): string {
  return accountId(session.email, session.role);
}

export const DASHBOARD_BY_ROLE: Record<Role, string> = {
  customer: "/dashboard/customer",
  farmer: "/dashboard/farmer",
  delivery: "/dashboard/delivery",
  admin: "/dashboard/admin",
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

function isSession(value: unknown): value is Session {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.email === "string" &&
    typeof candidate.name === "string" &&
    isRole(candidate.role)
  );
}

/**
 * Reads the session from localStorage. Returns null on the server and whenever
 * storage is unavailable or holds something unexpected, so every caller can
 * treat "no session" as the single unauthenticated case.
 */
export function readSession(): Session | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    return isSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeSession(session: Session) {
  try {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    return;
  }
  notifySessionChange();
}

export function clearSession() {
  try {
    window.localStorage.removeItem(SESSION_KEY);
  } catch {
    return;
  }
  notifySessionChange();
}

function parseUser(entry: unknown): StoredUser | null {
  if (typeof entry !== "object" || entry === null) return null;
  const candidate = entry as Record<string, unknown>;
  if (
    typeof candidate.email !== "string" ||
    typeof candidate.password !== "string" ||
    !isRole(candidate.role) ||
    typeof candidate.name !== "string"
  ) {
    return null;
  }

  // Accounts written before ids existed, and any hand-edited entry, get one
  // backfilled here. Without this the whole directory would be filtered away by
  // the id check and every existing account would silently disappear on the
  // first read after an upgrade.
  const id = typeof candidate.id === "string" && candidate.id.length > 0
    ? candidate.id
    : accountId(candidate.email, candidate.role);

  const createdAt =
    typeof candidate.createdAt === "string" && candidate.createdAt.length > 0
      ? candidate.createdAt
      : new Date(0).toISOString();

  return {
    id,
    name: candidate.name,
    email: candidate.email,
    password: candidate.password,
    role: candidate.role,
    createdAt,
  };
}

export function readUsers(): StoredUser[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(USERS_KEY);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map(parseUser)
      .filter((entry): entry is StoredUser => entry !== null);
  } catch {
    return [];
  }
}

/**
 * Returns whether the write actually landed. The admin's "add account" path
 * needs this: it registers an account and then tells the user the account exists
 * and is ready to sign in to, so a silent failure here would produce a credential
 * that cannot be used and no error explaining why.
 */
export function writeUsers(users: StoredUser[]): boolean {
  try {
    window.localStorage.setItem(USERS_KEY, JSON.stringify(users));
  } catch {
    return false;
  }
  notifySessionChange();
  return true;
}

/** Finds the account matching a set of credentials, role included. */
export function findUser(
  email: string,
  role: Role,
  password: string,
): StoredUser | null {
  const needle = email.trim().toLowerCase();
  const match = readUsers().find(
    (user) =>
      user.email.trim().toLowerCase() === needle &&
      user.role === role &&
      user.password === password,
  );
  return match ?? null;
}
