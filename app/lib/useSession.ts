"use client";

import { useMemo, useSyncExternalStore } from "react";
import { isRole, SESSION_KEY, type Session } from "./session";
const SESSION_EVENT = "agricart_session_change";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(SESSION_EVENT, callback);

  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(SESSION_EVENT, callback);
  };
}

// The snapshot has to be a primitive. Returning a freshly parsed object on
// every call would make useSyncExternalStore loop forever.
function getSnapshot() {
  return window.localStorage.getItem(SESSION_KEY);
}

const getServerSnapshot = () => null;

function parse(raw: string | null): Session | null {
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;

    const candidate = parsed as Record<string, unknown>;
    if (
      typeof candidate.email !== "string" ||
      typeof candidate.name !== "string" ||
      // `typeof role === "string"` accepted any string, so a hand-edited or
      // stale session with role "manager" parsed into a valid-looking Session.
      // Every consumer then indexed a Record<Role, ...> with it and got
      // undefined: Header rendered `ROLE_ICONS[role]` as a component and threw
      // "Element type is invalid", taking the whole storefront down with it.
      // isRole is the same check session.ts already applies.
      !isRole(candidate.role)
    ) {
      return null;
    }

    return parsed as Session;
  } catch {
    return null;
  }
}

/**
 * Reads the current session without a setState-in-effect round trip, so
 * components can gate on it during render without a cascading render.
 */
export function useSession(): Session | null {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return useMemo(() => parse(raw), [raw]);
}

/**
 * False during SSR and for the one hydration render, true once the browser
 * snapshot is in hand.
 *
 * The session lives in localStorage, so `getServerSnapshot` has to be `null`
 * and the first client render can only agree with the server by reporting "no
 * session" too. Any effect that treats that as a real signed-out state fires
 * on the hydration commit: the dashboard guard used to `router.replace
 * ("/login")` before React handed it the actual snapshot, bouncing signed-in
 * users through the login page on every refresh.
 *
 * The trick is a second useSyncExternalStore whose server snapshot is false and
 * whose client snapshot is true. React runs both consistency checks in the same
 * post-hydration flush, so `ready` only becomes true on a render that already
 * read the real session - there is no window where it is true but the session
 * is still stale, and no setState-in-effect to appease the lint rule.
 */
export function useIsSessionReady(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
}
