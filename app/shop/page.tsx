"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { productsInCategory, categoriesOf } from "../lib/catalog";
import { useTradeableProducts } from "../lib/store";
import ProductCard from "../components/ProductCard";

function ShopContent() {
  const params = useSearchParams();
  const categoryName = params.get("category");
  const products = useTradeableProducts();

  // Derived from the catalogue rather than the fixed CATEGORIES list, so a
  // category a farmer has introduced gets a page and a filter chip of its own.
  const categories = categoriesOf(products);

  const active = categoryName ? productsInCategory(products, categoryName) : undefined;

  return (
    <div className="max-w-7xl mx-auto py-20 px-6">
      <h1 className="text-4xl font-black text-slate-900">
        {active ? categoryName : "All Products"}
      </h1>
      <p className="text-slate-600 mt-3 mb-10 text-lg">
        {active
          ? `${active.length} products sourced directly from local farmers.`
          : "Browse the complete AgriCart catalogue of farm-fresh produce."}
      </p>

      {/* Category filter. A ?category= value that matches nothing falls back to
          the full catalogue below instead of rendering an empty grid. */}
      <nav aria-label="Product categories" className="mb-14 flex flex-wrap gap-3">
        <Link
          href="/shop"
          aria-current={active ? undefined : "page"}
          className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
            active
              ? "bg-white text-slate-700 border border-slate-200 hover:border-emerald-400"
              : "bg-emerald-600 text-white"
          }`}
        >
          All
        </Link>
        {categories.map((name) => {
          const isActive = categoryName === name;
          return (
            <Link
              key={name}
              href={`/shop?category=${encodeURIComponent(name)}`}
              aria-current={isActive ? "page" : undefined}
              className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                isActive
                  ? "bg-emerald-600 text-white"
                  : "bg-white text-slate-700 border border-slate-200 hover:border-emerald-400 hover:text-emerald-700"
              }`}
            >
              {name}
            </Link>
          );
        })}
      </nav>

      {active ? (
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-8">
          {active.map((product, index) => (
            <ProductCard key={product.id} product={product} index={index} />
          ))}
        </div>
      ) : (
        categories.map((name) => {
          const inCategory = productsInCategory(products, name);
          return (
            <div key={name} className="mb-20">
              <h2 className="text-2xl font-bold text-slate-900 mb-8">{name}</h2>
              <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-8">
                {inCategory.map((product, index) => (
                  <ProductCard key={product.id} product={product} index={index} />
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

export default function ShopPage() {
  return (
    <Suspense fallback={<div className="p-10 text-slate-500">Loading products...</div>}>
      <ShopContent />
    </Suspense>
  );
}