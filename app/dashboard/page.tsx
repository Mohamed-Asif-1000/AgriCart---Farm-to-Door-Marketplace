"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { DASHBOARD_BY_ROLE } from "../lib/session";
import { useSession } from "../lib/useSession";

/**
 * Entry point for /dashboard. There is no single dashboard for every role, so
 * this only resolves which one the current session belongs to.
 */
export default function DashboardIndexPage() {
  const router = useRouter();
  const session = useSession();

  useEffect(() => {
    router.replace(session ? DASHBOARD_BY_ROLE[session.role] : "/login");
  }, [router, session]);

  return (
    <div className="min-h-screen flex items-center justify-center text-slate-500">
      <Loader2 size={18} className="animate-spin" />
    </div>
  );
}
