"use client";

import { useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { categoriesOf, productsInCategory } from "@/app/lib/catalog";
import { useProducts, useStoreReady } from "@/app/lib/store";
import ProductPurchasePanel from "./ProductPurchasePanel";

/**
 * Renders a listing the server could not know about.
 *
 * Everything in the catalogue is per-browser state, so a product a farmer
 * publishes exists only in the store and cannot be prerendered. The page shells
 * out to this island instead, which resolves the same (category, index) address
 * against the live catalogue - so a shared link to a farmer's listing opens
 * correctly in the browser that holds it.
 */
export default function LiveProductFallback({
  categoryName,
  index,
}: {
  categoryName: string;
  index: number;
}) {
  const products = useProducts();
  const visible = useMemo(() => products.filter((product) => !product.hidden), [products]);

  // Wait rather than 404 while the store is still the empty SSR snapshot,
  // otherwise every shared link would intermittently 404 on hydration.
  //
  // The wait has to end, though: the old check was `visible.length > 0`, so a
  // browser whose catalogue really was empty showed "Loading product…" forever
  // and never reached the not-found message. useStoreReady reports false during
  // SSR and the hydration render and true once the browser snapshot is in hand,
  // which is the distinction being made here.
  const settled = useStoreReady();

  const inCategory = productsInCategory(visible, categoryName);
  const product = inCategory[index];

  if (!product) {
    return (
      <div className="max-w-6xl mx-auto py-20 px-6 text-center">
        {settled ? (
          <>
            <h1 className="text-3xl font-black text-slate-900 mb-3">Product not found</h1>
            <p className="text-slate-500 mb-8">
              This listing may have been removed by the farmer, or it belongs to a
              different browser&apos;s catalogue.
            </p>
            <Link
              href="/shop"
              className="inline-block bg-emerald-600 text-white px-6 py-3 rounded-xl font-semibold"
            >
              Browse all products
            </Link>
          </>
        ) : (
          <p className="text-slate-500">Loading product…</p>
        )}
      </div>
    );
  }

  const siblings = inCategory.filter((_, i) => i !== index);

  return (
    <div className="max-w-6xl mx-auto py-10 md:py-16 px-6">
      <nav aria-label="Breadcrumb" className="mb-8">
        <ol className="flex flex-wrap items-center gap-1 text-sm text-slate-500">
          <li>
            <Link href="/" className="hover:text-emerald-700 transition-colors">
              Home
            </Link>
          </li>
          <li aria-hidden="true">
            <ChevronRight size={14} className="mx-1" />
          </li>
          <li>
            <Link
              href={`/shop?category=${encodeURIComponent(categoryName)}`}
              className="hover:text-emerald-700 transition-colors"
            >
              {categoryName}
            </Link>
          </li>
          <li aria-hidden="true">
            <ChevronRight size={14} className="mx-1" />
          </li>
          <li>
            <span aria-current="page" className="font-semibold text-slate-900">
              {product.name}
            </span>
          </li>
        </ol>
      </nav>

      <div className="grid md:grid-cols-2 gap-10">
        <div className="relative h-[450px] rounded-xl overflow-hidden shadow-lg bg-slate-100">
          <Image
            src={product.image}
            alt={product.name}
            fill
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-cover"
          />
        </div>

        <ProductPurchasePanel product={product} />
      </div>

      {siblings.length > 0 ? (
        <section className="mt-20">
          <h2 className="text-2xl font-bold text-slate-900 mb-8">More from {categoryName}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {siblings.slice(0, 4).map((item, i) => (
              <Link
                key={item.id}
                href={`/product/${encodeURIComponent(categoryName)}/${i + (i >= index ? 1 : 0)}`}
                className="group bg-white rounded-2xl shadow-md overflow-hidden hover:shadow-lg transition-shadow"
              >
                <div className="relative h-36 bg-slate-100">
                  <Image
                    src={item.image}
                    alt={item.name}
                    fill
                    sizes="(min-width: 768px) 25vw, 50vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="p-4">
                  <p className="font-semibold text-slate-900 text-sm group-hover:text-emerald-700 transition-colors">
                    {item.name}
                  </p>
                  <p className="text-sm text-emerald-600 font-bold mt-1">₹{item.price}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <p className="mt-16 text-center text-xs text-slate-400">
        {categoriesOf(visible).length} categories • {visible.length} products from local farms
      </p>
    </div>
  );
}