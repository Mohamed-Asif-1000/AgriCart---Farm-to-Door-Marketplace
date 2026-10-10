"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import ProductCard from "./ProductCard";
import { categoriesOf, productsInCategory } from "../lib/catalog";
import { useTradeableProducts } from "../lib/store";

export default function ProductsSection() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const products = useTradeableProducts();
  const categories = useMemo(() => categoriesOf(products), [products]);

  return (
    <section className="py-16 md:py-28 bg-slate-50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-20">
          <h2 className="text-4xl md:text-5xl font-black text-slate-900">
            Farm Fresh Products
          </h2>
          <p className="text-slate-600 mt-4 text-lg">
            Handpicked quality directly from farmers
          </p>
        </div>

        {categories.map((name) => {
          const inCategory = productsInCategory(products, name);
          const isExpanded = expanded[name];
          // Only the first four are shown collapsed, but their indices are their
          // real positions in the category, because the product route addresses
          // by index. Slicing naively would link card 5 to product 4.
          const visible = isExpanded ? inCategory : inCategory.slice(0, 4);

          return (
            <div key={name} className="mb-24">
              <div className="flex flex-wrap justify-between items-center gap-4 mb-10">
                <h3 className="text-2xl font-bold text-slate-900">{name}</h3>

                <div className="flex items-center gap-4">
                  <Link
                    href={`/shop?category=${encodeURIComponent(name)}`}
                    className="text-sm font-semibold text-slate-500 hover:text-emerald-700 transition-colors"
                  >
                    Shop {name}
                  </Link>
                  <button
                    type="button"
                    onClick={() =>
                      setExpanded((prev) => ({
                        ...prev,
                        [name]: !prev[name],
                      }))
                    }
                    aria-expanded={Boolean(isExpanded)}
                    className="text-emerald-600 font-semibold hover:text-emerald-700 transition-colors"
                  >
                    {isExpanded ? "Show Less" : `View All ${inCategory.length} Products`}
                  </button>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 md:gap-8">
                {visible.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    index={inCategory.indexOf(product)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}