"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";

/**
 * Route-level boundary. The app reads user-writable storage during render
 * (cart, wishlist, session, last order), so a malformed value can throw. Those
 * paths are now validated, but this keeps any future one a recoverable message
 * instead of a blank screen in production.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="max-w-2xl mx-auto py-20 px-6 text-center">
      <div className="w-20 h-20 mx-auto rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mb-6">
        <AlertTriangle size={34} />
      </div>

      <h1 className="text-3xl font-black text-slate-900 mb-3">
        Something went wrong
      </h1>
      <p className="text-slate-500 mb-8 text-lg">
        We could not load this page. Your cart and wishlist are still saved on
        this device.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-emerald-700 transition-colors"
        >
          <RotateCcw size={16} />
          Try again
        </button>
        <Link
          href="/shop"
          className="inline-flex items-center gap-2 bg-white border border-slate-300 text-slate-700 px-6 py-3 rounded-xl font-semibold hover:bg-slate-50 transition-colors"
        >
          Browse products
        </Link>
      </div>
    </div>
  );
}
