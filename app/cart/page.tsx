"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Minus, Plus, Trash2, Leaf, ShoppingBag, Truck } from "lucide-react";
import {
  useCartWishlist,
  MIN_QUANTITY,
  MAX_QUANTITY,
  FREE_DELIVERY_THRESHOLD,
} from "../context/CartWishlistContext";
import { productsInCategory } from "../lib/catalog";
import { stockStatus } from "../lib/types";
import { rupees } from "../lib/pricing";
import { useProducts, useProfiles, tradeBlockReason } from "../lib/store";

export default function CartPage() {
  const {
    cart,
    isHydrated,
    cartCount,
    cartSubtotal,
    deliveryFee,
    cartTotal,
    updateCartQuantity,
    removeFromCart,
  } = useCartWishlist();
  const router = useRouter();

  // The basket holds a snapshot of each product from the moment it was added, so
  // stock and availability have to be read back from the live catalogue: a
  // listing may have sold out, been hidden, or had its price changed since.
  const products = useProducts();
  const profiles = useProfiles();
  const liveById = new Map(products.map((product) => [product.id, product]));

  // One reason per unbuyable line, computed once and then read by the line item,
  // the status label and the summary list, so the three cannot end up telling the
  // customer different stories about the same basket.
  const reasonFor = (item: (typeof cart)[number]) => {
    const live = liveById.get(item.id);
    if (!live) return "This listing is no longer available.";
    const gate = tradeBlockReason(live, profiles);
    if (gate) return gate;
    if (live.stockQty < item.quantity) {
      return `only ${live.stockQty} ${live.unit} left`;
    }
    return "";
  };

  const blockedLines = cart
    .map((item) => ({ id: item.id, name: item.name, reason: reasonFor(item) }))
    .filter((line) => line.reason !== "");
  const blocked = blockedLines.length > 0;
  const blockedReason = (productId: string) =>
    blockedLines.find((line) => line.id === productId)?.reason ?? "";

  // The context starts with an empty cart and fills it in from localStorage in
  // an effect, so rendering before hydration would flash a false empty cart.
  if (!isHydrated) {
    return (
      <div className="max-w-6xl mx-auto py-20 px-6 text-slate-500">
        Loading your cart…
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="max-w-6xl mx-auto py-20 px-6 text-center">
        <div className="w-20 h-20 mx-auto rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-6">
          <ShoppingBag size={34} />
        </div>
        <h1 className="text-3xl font-black text-slate-900 mb-3">
          Your cart is empty
        </h1>
        <p className="text-slate-500 mb-10 text-lg">
          Looks like you haven&apos;t picked anything yet.
        </p>
        <Link
          href="/shop"
          className="inline-block bg-emerald-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-emerald-700 transition-colors"
        >
          Browse all products
        </Link>
      </div>
    );
  }

  const remainingForFreeDelivery = FREE_DELIVERY_THRESHOLD - cartSubtotal;

  return (
    <div className="max-w-6xl mx-auto py-20 px-6">
      <h1 className="text-4xl font-black text-slate-900 mb-2">Your Cart</h1>
      <p className="text-slate-500 mb-10">
        {cartCount} {cartCount === 1 ? "item" : "items"} from local farms
      </p>

      <div className="grid items-start lg:grid-cols-[1fr_360px] gap-8">
        {/* Line items */}
        <div className="bg-white rounded-2xl shadow-md px-6">
          {cart.map((item) => {
            const live = liveById.get(item.id);
            // Link by live position, and fall back to the first slot when the
            // listing is gone so the cart does not render a dead link.
            const position =
              live && !live.hidden
                ? productsInCategory(
                    products.filter((product) => !product.hidden),
                    live.category,
                  ).indexOf(live)
                : 0;
            const href = `/product/${encodeURIComponent(item.category)}/${Math.max(position, 0)}`;

            const status = !live || live.hidden
              ? "Out of Stock"
              : tradeBlockReason(live, profiles)
                ? "Unavailable"
                : stockStatus(live.stockQty);
            // A line whose quantity exceeds what is left cannot be bought as-is,
            // so it is capped on screen and flagged rather than silently
            // charging the customer for stock that does not exist.
            const maxForLine = Math.min(MAX_QUANTITY, live?.stockQty ?? 0);
            const overStock = maxForLine > 0 && item.quantity > maxForLine;

            return (
              <div
                key={item.id}
                className="flex gap-4 py-6 border-b border-slate-100 last:border-0"
              >
                <Link href={href} className="shrink-0" aria-label={item.name}>
                  <Image
                    src={item.image}
                    alt={item.name}
                    width={96}
                    height={96}
                    className="w-24 h-24 object-cover rounded-xl"
                  />
                </Link>

                <div className="flex-1 min-w-0">
                  <Link
                    href={href}
                    className="font-bold text-slate-900 hover:text-emerald-700 transition-colors"
                  >
                    {item.name}
                  </Link>

                  <p className="text-sm text-slate-500 flex items-center gap-1 mt-1">
                    <Leaf size={13} />
                    {item.farmer}
                  </p>

                  <p className="text-xs text-slate-400 mt-0.5">
                    {item.unit} • {status}
                  </p>

                  {overStock && (
                    <p className="text-xs text-amber-700 mt-1">
                      Only {maxForLine} left - please reduce the quantity.
                    </p>
                  )}
                  {(!live || blockedReason(item.id) !== "") && (
                    <p className="text-xs text-rose-600 mt-1">
                      {blockedReason(item.id)}
                    </p>
                  )}

                  <div className="inline-flex items-center border border-slate-300 rounded-lg overflow-hidden mt-3">
                    <button
                      type="button"
                      onClick={() =>
                        updateCartQuantity(item.id, item.quantity - 1)
                      }
                      disabled={item.quantity <= MIN_QUANTITY}
                      aria-label={`Decrease quantity of ${item.name}`}
                      className="p-2 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <Minus size={14} />
                    </button>
                    <span
                      aria-live="polite"
                      className="w-10 text-center text-sm font-semibold border-x border-slate-300"
                    >
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        updateCartQuantity(item.id, item.quantity + 1)
                      }
                      disabled={item.quantity >= maxForLine}
                      aria-label={`Increase quantity of ${item.name}`}
                      className="p-2 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>

                <div className="text-right shrink-0 flex flex-col items-end">
                  <p className="font-bold text-slate-900">
                    {rupees(item.price * item.quantity)}
                  </p>
                  <p className="text-xs text-slate-400 mb-3">{rupees(item.price)} each</p>
                  <button
                    type="button"
                    onClick={() => removeFromCart(item.id)}
                    aria-label={`Remove ${item.name} from cart`}
                    className="p-2 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Order summary */}
        <aside className="lg:sticky lg:top-32 h-fit bg-white rounded-2xl shadow-md p-6">
          <h2 className="text-xl font-black text-slate-900 mb-5">
            Order Summary
          </h2>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">Subtotal</span>
              <span className="font-semibold">{rupees(cartSubtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Delivery</span>
              <span
                className={`font-semibold ${
                  deliveryFee === 0 ? "text-emerald-600" : ""
                }`}
              >
                {deliveryFee === 0 ? "Free" : rupees(deliveryFee)}
              </span>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-baseline">
            <span className="font-bold text-slate-900">Total</span>
            <span className="text-2xl font-black text-emerald-600">
              {rupees(cartTotal)}
            </span>
          </div>

          <div className="mt-4 flex items-start gap-2 text-xs bg-slate-50 rounded-lg p-3">
            <Truck size={15} className="shrink-0 mt-0.5 text-slate-500" />
            {remainingForFreeDelivery > 0 ? (
              <span className="text-slate-600">
                Add {rupees(remainingForFreeDelivery)} more for free delivery
              </span>
            ) : (
              <span className="text-emerald-700 font-semibold">
                Free delivery applied
              </span>
            )}
          </div>

          {/*
            A real button rather than a link with aria-disabled. aria-disabled
            only tells a screen reader the control is unavailable; it does not
            stop the navigation, so a stale basket still carried the customer
            into checkout to be told there that an item had sold out.
          */}
          <button
            type="button"
            disabled={blocked}
            onClick={() => {
              if (!blocked) router.push("/checkout");
            }}
            className="block w-full text-center bg-emerald-600 text-white py-3 rounded-xl font-semibold hover:bg-emerald-700 active:scale-[0.99] transition mt-5 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-emerald-600"
          >
            Proceed to Checkout
          </button>

          {/* A basket can be stale against the live catalogue - an item sold out,
              was hidden, or belongs to a farm that is not approved - and this says
              which line is the problem before the customer reaches the payment
              step rather than after. */}
          {blocked ? (
            <ul className="mt-3 text-xs text-amber-700 space-y-1">
              {blockedLines.map((line) => (
                <li key={line.id}>
                  {line.name}: {line.reason}
                </li>
              ))}
            </ul>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
