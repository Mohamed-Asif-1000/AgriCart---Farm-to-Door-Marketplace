"use client";

import { Suspense } from "react";
import Link from "next/link";
import { SearchX } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { categoriesOf, searchProductsIn } from "../lib/catalog";
import { useTradeableProducts } from "../lib/store";
import ProductCard from "../components/ProductCard";

function SearchResults() {
  const params = useSearchParams();
  const rawQuery = params.get("q") ?? "";
  const query = rawQuery.trim();

  const products = useTradeableProducts();
  const categories = categoriesOf(products);

  if (!query) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-16 text-center">
        <div className="w-20 h-20 mx-auto rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-6">
          <SearchX size={32} />
        </div>
        <h1 className="text-3xl font-black text-slate-900 mb-3">
          What are you looking for?
        </h1>
        <p className="text-slate-500 mb-10 max-w-md mx-auto">
          Search our farm-fresh catalogue by product name, or start from one of
          these categories.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          {categories.map((name) => (
            <Link
              key={name}
              href={`/shop?category=${encodeURIComponent(name)}`}
              className="px-4 py-2.5 rounded-xl bg-white shadow-sm border border-slate-200 text-sm font-semibold text-slate-700 hover:border-emerald-400 hover:text-emerald-700 transition-colors"
            >
              {name}
            </Link>
          ))}
        </div>
      </div>
    );
  }

  // category + index must survive the filter: they are the two segments that
  // /product/[category]/[index] needs to resolve back to this exact product.
  const results = searchProductsIn(products, query);

  return (
    <div className="max-w-7xl mx-auto p-10">
      <h1 className="text-3xl font-bold mb-3">
        Search results for <span className="text-emerald-600">{query}</span>
      </h1>
      <p className="text-slate-500 mb-10">
        {results.length} {results.length === 1 ? "product" : "products"} found
      </p>

      {results.length === 0 ? (
        <div className="text-center py-20 text-slate-500">
          <p className="text-lg mb-2">No products matched your search.</p>
          <p className="text-sm mb-6">
            Try a different name, or browse everything we stock.
          </p>
          <Link
            href="/shop"
            className="inline-block bg-emerald-600 text-white px-6 py-3 rounded-xl font-semibold"
          >
            Browse all products
          </Link>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-8">
          {results.map(({ product, index }) => (
            <ProductCard key={product.id} product={product} index={index} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="p-10 text-slate-500">Searching...¦</div>}>
      <SearchResults />
    </Suspense>
  );
}