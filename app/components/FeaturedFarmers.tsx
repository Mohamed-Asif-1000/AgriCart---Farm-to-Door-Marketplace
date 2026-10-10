"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ChevronLeft, ChevronRight, MapPin, Sprout } from "lucide-react";
import "../lib/gsapSetup";
import { useProducts, useProfiles, useStoreReady, useUsers } from "../lib/store";
import { meanRating } from "../lib/types";

type FarmerCard = {
  id: string;
  name: string;
  farmName: string;
  location: string;
  listingCount: number;
  rating: number | null;
  verified: boolean;
  photo?: string;
  bio?: string;
  memberSince: string | null;
};

/** Get two initials to show if there's no profile photo. */
function initials(name: string, farmName: string): string {
  const source = (farmName || name).trim();
  const words = source.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}

/**
 * The farms actually selling on this marketplace.
 *
 * This used to be a hardcoded array of three invented growers with their own
 * names, villages and photographs, which is worse than having no section at all:
 * it looked like a directory of sellers while none of them could be bought from
 * and none existed as accounts. Every card here is now a real farmer profile,
 * with their listing count and rating computed from the same store the rest of
 * the app reads, so approving a farm in admin makes it appear here by itself.
 */
export default function FeaturedFarmers() {
  const container = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const products = useProducts();
  const profiles = useProfiles();
  const users = useUsers();
  const isStoreReady = useStoreReady();
  const [active, setActive] = useState(0);
  const intervalRef = useRef<number | null>(null);
  const pausedRef = useRef(false);
  const prefersReducedMotion = useRef(false);

  const farmers = useMemo<FarmerCard[]>(() => {
    const visible = products.filter((product) => !product.hidden);
    const ratingByFarmer = new Map<string, number[]>();

    for (const product of visible) {
      if (typeof product.rating !== "number") continue;
      ratingByFarmer.set(product.farmerId, [
        ...(ratingByFarmer.get(product.farmerId) ?? []),
        product.rating,
      ]);
    }

    const nameById = new Map(users.map((user) => [user.id, user.name]));
    const memberById = new Map(users.map((user) => [user.id, user.createdAt]));

    return profiles
      .filter((profile) => nameById.has(profile.userId))
      .map((profile) => {
        const listings = visible.filter((product) => product.farmerId === profile.userId);
        const ratings = ratingByFarmer.get(profile.userId) ?? [];
        const created = memberById.get(profile.userId) ?? null;
        return {
          id: profile.userId,
          name: nameById.get(profile.userId) ?? "",
          farmName: profile.farmName?.trim() || "Unnamed farm",
          location: profile.location?.trim() || "Location not set",
          listingCount: listings.length,
          rating: ratings.length > 0 ? meanRating(ratings) : null,
          verified: profile.accountStatus === "Verified",
          photo: profile.photo,
          bio: profile.bio?.trim() || undefined,
          memberSince: created ?? null,
        };
      })
      .filter((farmer) => farmer.listingCount > 0)
      .sort((a, b) => b.listingCount - a.listingCount);
  }, [products, profiles, users]);

  useGSAP(
    () => {
      if (typeof window === "undefined") return;
      prefersReducedMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (prefersReducedMotion.current || farmers.length === 0) return;

      const el = stage.current;
      if (!el) return;
      gsap.set(el, { autoAlpha: 1, y: 0 });

      // Gentle fade up on load
      const media = gsap.matchMedia();
      media.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from(".farmer-stage", {
          y: 32,
          duration: 0.8,
          ease: "power3.out",
          scrollTrigger: { trigger: container.current, start: "top 80%", once: true },
        });
      });
      return () => media.revert();
    },
    { scope: container, dependencies: [farmers.length] },
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    prefersReducedMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion.current || farmers.length <= 1) {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = window.setInterval(() => {
      if (pausedRef.current) return;
      setActive((index) => (index + 1) % farmers.length);
    }, 4000);

    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [farmers.length]);

  const goTo = (nextIndex: number) => {
    setActive((nextIndex % farmers.length + farmers.length) % farmers.length);
  };

  const current = farmers[active];

  return (
    <section id="farmers" ref={container} className="py-24 bg-white scroll-mt-24">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-slate-900">Meet Our Farmers</h2>
          <p className="text-slate-600 mt-4 max-w-2xl mx-auto">
            Real farmers growing real food with care and dedication
          </p>
        </div>

        {/*
          Nothing is rendered until the browser snapshot of the store has landed,
          and nothing is rendered for a fresh install with no farmers either. Both
          would otherwise flash "0 farms" or an empty grid during the frame between
          the server HTML and the first client render.
        */}
          {!isStoreReady || farmers.length === 0 ? (
            <p className="text-center text-slate-500 max-w-xl mx-auto">
              {isStoreReady
                ? "No farms are selling yet. Once a farmer account is approved, it appears here."
                : "Loading farms…"}
            </p>
          ) : (
            <div className="relative">
              <div
                ref={stage}
                className="farmer-stage group relative overflow-hidden rounded-3xl bg-emerald-50 shadow-md ring-1 ring-emerald-100"
                onMouseEnter={() => {
                  pausedRef.current = true;
                }}
                onMouseLeave={() => {
                  pausedRef.current = false;
                }}
                onFocus={() => {
                  pausedRef.current = true;
                }}
                onBlur={() => {
                  pausedRef.current = false;
                }}
              >
                {current && (
                  <div className="flex flex-col lg:flex-row">
                    <div className="relative h-80 w-full bg-emerald-100 lg:h-[420px] lg:w-[480px] xl:w-[540px]">
                      {current.photo ? (
                        <Image
                          src={current.photo}
                          alt={`${current.farmName} photo`}
                          width={640}
                          height={640}
                          className="h-full w-full object-cover"
                          unoptimized
                          priority
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <span className="flex h-40 w-40 items-center justify-center rounded-full bg-emerald-600 text-6xl font-black text-white lg:h-56 lg:w-56">
                            {initials(current.name, current.farmName)}
                          </span>
                        </div>
                      )}
                      {current.verified && (
                        <span className="absolute top-4 right-4 rounded-full bg-white px-3 py-1 text-xs font-bold text-emerald-700 shadow-sm">
                          Verified
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col justify-between p-6 md:p-8 lg:p-10 lg:w-[calc(100%-480px)] xl:w-[calc(100%-540px)]">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-600">
                          Meet Our Farmers
                        </p>
                        <h3 className="mt-2 text-3xl font-black text-slate-900 md:text-4xl">
                          {current.farmName}
                        </h3>
                        <p className="mt-1 text-base text-slate-600">{current.name}</p>
                        <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                          <MapPin size={16} />
                          {current.location}
                        </p>
                        {current.bio && (
                          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-700 line-clamp-5">
                            {current.bio}
                          </p>
                        )}
                        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-600">
                          <span className="flex items-center gap-1.5">
                            <Sprout size={16} className="text-emerald-600" />
                            {current.listingCount}{" "}
                            {current.listingCount === 1 ? "listing" : "listings"}
                          </span>
                          <span>
                            {current.rating === null
                              ? "Not rated yet"
                              : `${current.rating.toFixed(1)} / 5 from buyers`}
                          </span>
                          {!current.verified && (
                            <span className="font-semibold text-amber-700">Awaiting approval</span>
                          )}
                          {current.memberSince && (
                            <span>
                              Farming since{" "}
                              {new Date(current.memberSince).toLocaleDateString("en-IN", {
                                month: "long",
                                year: "numeric",
                              })}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
                        <Link
                          href="/shop"
                          className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700"
                        >
                          View Products →
                        </Link>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => goTo(active - 1)}
                            aria-label="Previous farmer"
                            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-emerald-300 hover:text-emerald-700"
                          >
                            <ChevronLeft size={18} />
                          </button>
                          <span className="text-xs font-semibold text-slate-500">
                            {active + 1} / {farmers.length}
                          </span>
                          <button
                            type="button"
                            onClick={() => goTo(active + 1)}
                            aria-label="Next farmer"
                            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-emerald-300 hover:text-emerald-700"
                          >
                            <ChevronRight size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              {farmers.length > 1 && (
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {farmers.map((farmer, index) => (
                    <button
                      key={farmer.id}
                      type="button"
                      onClick={() => goTo(index)}
                      aria-current={active === index ? "true" : "false"}
                      aria-label={`Show ${farmer.farmName}`}
                      className={`h-2.5 rounded-full transition-all ${
                        active === index
                          ? "w-8 bg-emerald-600"
                          : "w-2.5 bg-emerald-200 hover:bg-emerald-300"
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
      </div>
    </section>
  );
}
