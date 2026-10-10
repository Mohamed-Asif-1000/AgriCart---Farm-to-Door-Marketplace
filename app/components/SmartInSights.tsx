"use client";

import { useMemo } from "react";
import { Package, Sprout, Star, Truck } from "lucide-react";
import { useOrders, useProducts, useReviews, useStoreReady } from "../lib/store";
import { meanRating } from "../lib/types";
import { rupees } from "../lib/pricing";

/**
 * Platform figures, computed from the store.
 *
 * This section used to state "30°C - Humidity 65%", "Tomato prices increased by
 * 12% this week" and "Leafy greens are trending" as live facts. None of them came
 * from anywhere: they were constants in the file, so they stayed the same number
 * forever and were wrong immediately. There is no weather feed and no price index
 * in a localStorage demo, so claiming to show either would mean inventing it again.
 *
 * What replaced them are counts that genuinely follow the data, which makes the
 * section a live readout of the marketplace instead of a decoration.
 */
export default function SmartInsights() {
  const products = useProducts();
  const orders = useOrders();
  const reviews = useReviews();
  const isStoreReady = useStoreReady();

  const insights = useMemo(() => {
    const listed = products.filter((product) => !product.hidden);
    const farmerIds = new Set(listed.map((product) => product.farmerId));
    const delivered = orders.filter((order) => order.status === "Delivered");
    const ratings = reviews.map((review) => review.rating);

    // Best-selling category by units actually sold, which is a different number
    // from the largest catalogue category and is the one worth surfacing.
    const unitsByCategory = new Map<string, number>();
    for (const order of delivered) {
      for (const item of order.items) {
        unitsByCategory.set(item.category, (unitsByCategory.get(item.category) ?? 0) + item.quantity);
      }
    }

    const top = [...unitsByCategory.entries()].sort((a, b) => b[1] - a[1])[0];

    return {
      listings: listed.length,
      farms: farmerIds.size,
      delivered: delivered.length,
      revenue: delivered.reduce((sum, order) => sum + order.total, 0),
      rating: ratings.length > 0 ? meanRating(ratings) : null,
      topCategory: top?.[0] ?? null,
      topUnits: top?.[1] ?? 0,
    };
  }, [products, orders, reviews]);

  const cards = [
    {
      icon: Package,
      title: "Live listings",
      value: isStoreReady ? String(insights.listings) : "…",
      body: isStoreReady
        ? insights.listings === 0
          ? "No produce is listed for sale yet."
          : `Across ${insights.farms} ${insights.farms === 1 ? "farm" : "farms"} on the platform.`
        : "Reading the catalogue.",
    },
    {
      icon: Truck,
      title: "Delivered orders",
      value: isStoreReady ? String(insights.delivered) : "…",
      body: isStoreReady
        ? insights.delivered === 0
          ? "No order has been delivered yet."
          : `${rupees(insights.revenue)} of produce delivered so far.`
        : "Reading the order book.",
    },
    {
      icon: Star,
      title: "Delivery rating",
      value: isStoreReady
        ? insights.rating === null
          ? "—"
          : `${insights.rating.toFixed(1)} / 5`
        : "…",
      body: isStoreReady
        ? insights.rating === null
          ? "Customers have not rated a delivery yet."
          : `Average across ${reviews.length} customer ${reviews.length === 1 ? "review" : "reviews"}.`
        : "Reading reviews.",
    },
    {
      icon: Sprout,
      title: "Top category",
      value: isStoreReady ? (insights.topCategory ?? "—") : "…",
      body: isStoreReady
        ? insights.topCategory === null
          ? "Nothing has sold yet, so there is no top category."
          : `${insights.topUnits} ${insights.topUnits === 1 ? "unit" : "units"} delivered - the best seller so far.`
        : "Reading sales.",
    },
  ];

  return (
    <section className="py-16 md:py-28 bg-slate-50">
      <div className="max-w-7xl mx-auto px-6 text-center mb-20">
        <h2 className="text-4xl md:text-5xl font-black text-slate-900">
          Live From the Marketplace
        </h2>
        <p className="text-slate-600 mt-4 text-lg max-w-2xl mx-auto">
          Every figure below is counted from this browser&apos;s own records, so it
          changes as farmers list produce and customers place orders.
        </p>
      </div>

      <div className="max-w-7xl mx-auto px-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
        {cards.map(({ icon: Icon, title, value, body }) => (
          <div
            key={title}
            className="bg-white p-6 sm:p-8 rounded-3xl shadow-lg text-center"
          >
            <div className="w-14 h-14 mx-auto flex items-center justify-center bg-emerald-100 text-emerald-600 rounded-xl mb-6">
              <Icon size={28} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">{title}</h3>
            <p className="text-3xl font-black text-emerald-600 break-words">
              {value}
            </p>
            <p className="text-slate-600 mt-3 text-sm">{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
