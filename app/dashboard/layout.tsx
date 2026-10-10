"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { DashboardUIProvider } from "./DashboardUIContext";
import { DASHBOARD_BY_ROLE, type Role } from "../lib/session";
import { useIsSessionReady, useSession } from "../lib/useSession";

const ROLE_PREFIX: Record<Role, string> = {
  customer: "/dashboard/customer",
  farmer: "/dashboard/farmer",
  delivery: "/dashboard/delivery",
  admin: "/dashboard/admin",
};

/**
 * Client-side route guard. The session lives in localStorage, so it can only be
 * read on the client - children stay gated until the store has produced one.
 *
 * This is a UX guard, not security: anyone can write the session key by hand.
 * Real enforcement needs a server session and middleware.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const session = useSession();
  const isSessionReady = useIsSessionReady();

  const allowed =
    session !== null &&
    (pathname === "/dashboard" ||
      pathname.startsWith(ROLE_PREFIX[session.role]));

  useEffect(() => {
    // Until the browser snapshot has landed, `session === null` only means
    // "unknown", not "signed out". Redirecting on that reading bounced every
    // signed-in user through /login on refresh, because the hydration commit
    // runs before React swaps in the real value.
    if (!isSessionReady) return;

    if (session === null) {
      router.replace("/login");
      return;
    }

    // /dashboard itself resolves the right role; any other path must match.
    if (pathname && !allowed) {
      router.replace(DASHBOARD_BY_ROLE[session.role]);
    }
  }, [allowed, isSessionReady, pathname, router, session]);

  if (!allowed) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        <Loader2 size={18} className="animate-spin" />
      </div>
    );
  }

  return <DashboardUIProvider>{children}</DashboardUIProvider>;
}
