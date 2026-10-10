"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Heart, ShoppingCart, Star, Leaf, MapPin } from "lucide-react";
import { useCartWishlist } from "../context/CartWishlistContext";
import { productsInCategory } from "../lib/catalog";
import { isPurchasable, stockStatus, type Product } from "../lib/types";
import { rupees } from "../lib/pricing";
import { useProducts, useProfiles, tradeBlockReason } from "../lib/store";

export default function WishlistPage() {
  const {
    wishlist,
    isHydrated,
    wishlistCount,
    addToCart,
    removeFromWishlist,
  } = useCartWishlist();

  // Wishlist entries are snapshots taken when the heart was pressed, so a
  // listing's current price and stock are read from the live catalogue rather
  // than from the saved copy.
  const products = useProducts();
  const profiles = useProfiles();
  const visible = products.filter((product) => !product.hidden);
  const liveById = new Map(products.map((product) => [product.id, product]));

  // A saved heart is not a reservation: the farm behind it may have been
  // suspended or never approved, in which case the entry stays but cannot be
  // moved to the basket.
  const gateFor = (product: Product | undefined) =>
    product ? tradeBlockReason(product, profiles) : "";

  const [confirmingMoveAll, setConfirmingMoveAll] = useState(false);
  const [movedCount, setMovedCount] = useState(0);

  // The context starts with an empty wishlist and fills it in from localStorage
  // in an effect, so rendering before hydration would flash a false empty state.
  if (!isHydrated) {
    return (
      <div className="max-w-6xl mx-auto py-20 px-6 text-slate-500">
        Loading your wishlist…
      </div>
    );
  }

  if (wishlist.length === 0) {
    return (
      <div className="max-w-6xl mx-auto py-20 px-6 text-center">
        <div className="w-20 h-20 mx-auto rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mb-6">
          <Heart size={34} fill="currentColor" />
        </div>

        {movedCount > 0 ? (
          <>
            <h1 className="text-3xl font-black text-slate-900 mb-3">
              Moved {movedCount} {movedCount === 1 ? "item" : "items"} to your
              cart
            </h1>
            <p className="text-slate-500 mb-10 text-lg">
              Your wishlist is now empty.
            </p>
            <Link
              href="/cart"
              className="inline-block bg-emerald-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-emerald-700 transition-colors"
            >
              Go to cart
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-3xl font-black text-slate-900 mb-3">
              Your wishlist is empty
            </h1>
            <p className="text-slate-500 mb-10 text-lg">
              Tap the heart on any product to save it here for later.
            </p>
            <Link
              href="/shop"
              className="inline-block bg-emerald-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-emerald-700 transition-colors"
            >
              Browse all products
            </Link>
          </>
        )}
      </div>
    );
  }

  // removeFromWishlist filters off the previous state, so calling it once per
  // item composes correctly without needing a clearWishlist in the context.
  const moveToCart = (items: typeof wishlist) => {
    items.forEach((saved) => {
      // Move the live product, so the basket picks up the current price and
      // stock rather than whatever was saved weeks ago.
      const live = liveById.get(saved.id);
      if (!live || !isPurchasable(live) || gateFor(live) !== "") return;
      addToCart(live);
    });
    items.forEach((item) => removeFromWishlist(item.id));
    setMovedCount((n) => n + items.length);
  };

  const handleMoveAll = () => {
    if (!confirmingMoveAll) {
      setConfirmingMoveAll(true);
      return;
    }
    moveToCart(wishlist);
    setConfirmingMoveAll(false);
  };

  return (
    <div className="max-w-6xl mx-auto py-20 px-6">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
        <div>
          <h1 className="text-4xl font-black text-slate-900">Your Wishlist</h1>
          <p className="text-slate-500 mt-2">
            {wishlistCount} {wishlistCount === 1 ? "item" : "items"} saved
          </p>
        </div>

        <button
          type="button"
          onClick={handleMoveAll}
          aria-label={
            confirmingMoveAll
              ? `Confirm moving all ${wishlistCount} items to cart`
              : `Move all ${wishlistCount} items to cart`
          }
          className={`px-5 py-2.5 rounded-xl font-semibold transition-colors ${
            confirmingMoveAll
              ? "bg-amber-500 text-white hover:bg-amber-600"
              : "bg-emerald-600 text-white hover:bg-emerald-700"
          }`}
        >
          {confirmingMoveAll ? "Confirm move all" : "Move all to cart"}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mt-10">
        {wishlist.map((saved) => {
          const live = liveById.get(saved.id);
          // Falls back to the saved copy when the listing has been removed, so
          // the entry still renders with an explanation instead of vanishing.
          const item = live ?? saved;
          const gone = !live || live.hidden;
          const gate = gateFor(live);
          const unavailable = gone || gate !== "";
          const available = !unavailable && isPurchasable(live);
          const position = gone
            ? 0
            : Math.max(
                productsInCategory(visible, live.category).indexOf(live),
                0,
              );
          const href = `/product/${encodeURIComponent(item.category)}/${position}`;

          return (
            <div
              key={saved.id}
              className={`bg-white rounded-2xl shadow-md overflow-hidden flex flex-col ${
                unavailable ? "opacity-60" : ""
              }`}
            >
              <div className="relative h-52 overflow-hidden">
                <Link
                  href={href}
                  className="block h-full w-full"
                  aria-label={item.name}
                >
                  <Image
                    src={item.image}
                    alt={item.name}
                    fill
                    sizes="(min-width: 1024px) 25vw, 50vw"
                    className="object-cover transition-transform duration-500 hover:scale-105"
                  />
                </Link>

                <button
                  type="button"
                  onClick={() => removeFromWishlist(saved.id)}
                  aria-label={`Remove ${item.name} from wishlist`}
                  title="Remove from wishlist"
                  className="absolute top-3 right-3 p-2 rounded-full bg-rose-500 text-white shadow-md transition-colors hover:bg-rose-600"
                >
                  <Heart size={18} fill="currentColor" />
                </button>

                {unavailable && (
                  <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-slate-600 text-white text-xs font-bold">
                    {gone ? "No longer listed" : "Unavailable"}
                  </span>
                )}
              </div>

              <div className="p-5 space-y-2 flex flex-col grow">
                <h4 className="font-bold text-slate-900">
                  <Link href={href} className="hover:text-emerald-700 transition-colors">
                    {item.name}
                  </Link>
                </h4>

                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Leaf size={14} /> {item.farmer}
                </div>

                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <MapPin size={14} /> {item.location}
                </div>

                {item.rating > 0 && (
                  <div className="flex items-center gap-1 text-amber-500 text-sm">
                    <Star size={14} fill="currentColor" /> {item.rating}
                  </div>
                )}

                <div className="pt-2 mt-auto">
                  <p className="text-lg font-bold text-emerald-600">{rupees(item.price)}</p>
                  <p className="text-xs text-slate-400">
                    {item.unit}
                    {!gone && stockStatus(live.stockQty) !== "In Stock" ? (
                      <span className="text-amber-600 font-semibold">
                        {" "}
                        • {stockStatus(live.stockQty)}
                      </span>
                    ) : null}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => moveToCart([saved])}
                  disabled={!available}
                  className="w-full mt-2 inline-flex items-center justify-center gap-2 bg-emerald-600 text-white py-2.5 rounded-xl font-semibold hover:bg-emerald-700 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed"
                >
                  <ShoppingCart size={16} />
                  {available ? "Move to Cart" : "Unavailable"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}