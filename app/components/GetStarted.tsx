"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

const PARTNER_CLAIMS = [
  {
    title: "Become a Farmer Partner",
    copy: "List your harvest and reach buyers in your own city.",
  },
  {
    title: "Join Delivery Network",
    copy: "Deliver fresh produce and earn on every trip.",
  },
] as const;

export default function GetStarted() {
  return (
    <section className="py-16 md:py-28 bg-emerald-600 text-white text-center">
      <div className="max-w-4xl mx-auto px-6">
        <h2 className="text-4xl md:text-5xl font-black">
          Start Your Farm Fresh Journey Today
        </h2>

        <p className="mt-4 text-lg text-emerald-100">
          Join AgriCart to experience healthy food, fair farmer income, and
          transparent agriculture.
        </p>

        <div className="flex flex-wrap justify-center gap-4 mt-10">
          <Link
            href="/shop"
            className="inline-flex items-center gap-2 bg-white text-emerald-700 px-8 py-4 rounded-2xl font-bold hover:bg-emerald-50 transition"
          >
            Shop Fresh Products
            <ArrowRight size={18} />
          </Link>

          {PARTNER_CLAIMS.map((claim) => (
            <Link
              key={claim.title}
              href="/login"
              title={claim.copy}
              className="border border-white/40 px-8 py-4 rounded-2xl font-bold hover:bg-white/10 transition"
            >
              {claim.title}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
