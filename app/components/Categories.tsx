"use client";
import { useMemo, useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { categoriesOf, categoryImage, productsInCategory } from "../lib/catalog";
import { useTradeableProducts } from "../lib/store";
// Registers ScrollTrigger for the scrollTrigger config below. Without it this
// component only worked because Header.tsx happened to be imported first, which
// is exactly the import-order dependency gsapSetup.ts exists to remove - and
// SiteChrome skips Header on /dashboard.
import "../lib/gsapSetup";

// The tiles used to be a hardcoded list of 4 names, so "Herbs & Spices" and
// "Farm Fresh Eggs" were unreachable from the homepage even though the shop
// page could list them. The names and the counts are now derived from the live
// catalogue, which also means a category a farmer introduces shows up here on its
// own. Tile art comes from catalog's categoryImage, which prefers a photo of
// something actually being sold in that category - so a farmer's own category
// gets its own produce rather than the generic vegetable photo.
export default function Categories() {
  const container = useRef<HTMLDivElement>(null);
  const products = useTradeableProducts();
  const categories = useMemo(() => categoriesOf(products), [products]);
  const counts = useMemo(
    () =>
      new Map(categories.map((name) => [name, productsInCategory(products, name).length])),
    [categories, products],
  );

  useGSAP(() => {
    const media = gsap.matchMedia();

    // y only, no opacity fade - see HowItWorks.tsx for why. Fading from
    // opacity 0 tied the tiles' visibility to a ScrollTrigger that could be
    // measured before the Hero had settled, leaving the grid blank.
    media.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.from(".category-card", {
        y: 60,
        duration: 1,
        stagger: 0.2,
        ease: "power3.out",
        scrollTrigger: {
          trigger: container.current,
          start: "top 80%",
          once: true,
        },
      });
    });

    return () => media.revert();
  }, { scope: container });

  return (
    <section ref={container} id="categories" className="py-16 md:py-20 bg-emerald-50 scroll-mt-28">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <h2 className="text-4xl font-bold text-center text-slate-900 mb-4">
          Shop by Category
        </h2>
        <p className="text-center text-slate-600 mb-14">
          Fresh produce sourced directly from trusted farmers
        </p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {categories.map((name) => (
            <Link
              key={name}
              href={`/shop?category=${encodeURIComponent(name)}`}
              className="category-card group relative rounded-3xl overflow-hidden shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
            >
              <div
                className="h-64 bg-cover bg-center group-hover:scale-110 transition-transform duration-700"
                style={{ backgroundImage: `url(${categoryImage(name, products)})` }}
              />

              <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-all" />

              <div className="absolute bottom-6 left-6 text-white">
                <h3 className="text-2xl font-bold">{name}</h3>
                <p className="text-sm opacity-90">{counts.get(name) ?? 0} products</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
