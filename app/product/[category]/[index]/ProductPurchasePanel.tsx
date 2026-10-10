"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Minus, Plus } from "lucide-react";
import type { Product } from "@/app/lib/types";
import { isPurchasable, stockStatus } from "@/app/lib/types";
import { MAX_QUANTITY, MIN_QUANTITY, clampQuantity, rupees } from "@/app/lib/pricing";
import { useCartWishlist } from "@/app/context/CartWishlistContext";
import { useProducts, tradeBlockReason, useProfiles } from "@/app/lib/store";
import WishlistButton from "@/app/components/WishlistButton";

type ProductPurchasePanelProps = {
  product: Product;
};

/**
 * The only part of the product route that needs the browser. The page itself is
 * a server component so the image, copy and metadata ship in the initial HTML;
 * this island owns the quantity stepper and the three actions.
 *
 * It takes the whole product rather than a subset, so the panel cannot drift from
 * the Product the store holds - the previous version rebuilt an object literal
 * from nine props here, which is where the stringly-typed `stock` field came
 * from.
 */
export default function ProductPurchasePanel({ product }: ProductPurchasePanelProps) {
  const router = useRouter();
  const { cart, addToCart, clearCart } = useCartWishlist();
  const [added, setAdded] = useState(false);

  const products = useProducts();
  const live = products.find((candidate) => candidate.id === product.id) ?? product;
  const currentProduct = live;

  // The approval gate, re-read here rather than assumed. This panel is the one
  // place a listing can still be bought from a direct URL or a stale bookmark, so
  // if the farm is not cleared to trade the buttons have to be dead here as well
  // as in the catalogue.
  const gate = tradeBlockReason(currentProduct, useProfiles());

  const purchasable = isPurchasable(currentProduct) && gate === "";
  const status = stockStatus(currentProduct.stockQty);

  // addToCart clamps the *running total* to MAX_QUANTITY, not the amount being
  // added, so the naive price * quantity is only right when the item is not
  // already in the basket.
  const inCart = cart.find((item) => item.id === currentProduct.id)?.quantity ?? 0;
  // Also bounded by what is left on the shelf: the basket may outlive the stock
  // it was built from, and the button must not offer units that do not exist.
  const selectable = Math.min(MAX_QUANTITY, currentProduct.stockQty);
  const [desired, setDesired] = useState(() => clampQuantity(MIN_QUANTITY));
  const quantity = Math.min(desired, Math.max(selectable, MIN_QUANTITY));
  const addedQuantity = Math.min(quantity, Math.max(MAX_QUANTITY - inCart, 0));
  const hitsCap = addedQuantity < quantity;

  const handleAddToCart = () => {
    addToCart(currentProduct, quantity);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1500);
  };

  // "Buy now" means buy this, not buy this plus everything already saved, so
  // the basket is replaced rather than appended to.
  const handleBuyNow = () => {
    clearCart();
    addToCart(currentProduct, quantity);
    router.push("/checkout");
  };

  return (
    <div className="flex flex-col justify-center">
      <h1 className="text-4xl font-bold text-slate-900 mb-4">{currentProduct.name}</h1>

      <p className="text-emerald-600 text-3xl font-bold mb-3">
        {rupees(currentProduct.price)}
        <span className="text-base font-semibold text-slate-400 ml-2">
          / {currentProduct.unit}
        </span>
      </p>

      <p className="text-slate-600 mb-6">
        Farm fresh product grown by <b className="text-slate-900">{currentProduct.farmer}</b>{" "}
        in <b className="text-slate-900">{currentProduct.location}</b>.
      </p>

      {gate ? (
        <p className="mb-6 text-rose-600 font-semibold">{gate}</p>
      ) : (
        <p className="mb-6 text-slate-700">
          {currentProduct.quality} •{" "}
          <span className={status === "In Stock" ? "" : "text-amber-600 font-semibold"}>
            {status === "Out of Stock"
              ? "Out of stock"
              : status === "Low Stock"
                ? `Only ${currentProduct.stockQty} left`
                : `${currentProduct.stockQty} available`}
          </span>{" "}
          • {currentProduct.unit} per {currentProduct.unit.includes("pcs") ? "pack" : "unit"}
        </p>
      )}

      <div className="mb-6">
        <span className="block text-sm font-semibold text-slate-700 mb-2">Quantity</span>
        <div className="inline-flex items-center border border-slate-300 rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setDesired((q) => Math.max(MIN_QUANTITY, q - 1))}
            disabled={quantity <= MIN_QUANTITY}
            aria-label="Decrease quantity"
            className="p-3 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Minus size={16} />
          </button>
          <span
            aria-live="polite"
            className="w-12 py-3 text-center font-semibold border-x border-slate-300"
          >
            {quantity}
          </span>
          <button
            type="button"
            onClick={() => setDesired((q) => Math.min(selectable, q + 1))}
            disabled={quantity >= selectable}
            aria-label="Increase quantity"
            className="p-3 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Plus size={16} />
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {gate ? (
            <>This listing cannot be ordered right now.</>
          ) : !purchasable ? (
            <>This listing is currently out of stock. Check back soon.</>
          ) : hitsCap ? (
            <>
              Only {addedQuantity} more will be added - {currentProduct.name} reaches the limit of{" "}
              {MAX_QUANTITY}
            </>
          ) : (
            <>
              Adds {quantity} to your cart • {rupees(currentProduct.price * quantity)} total • up to{" "}
              {MAX_QUANTITY} per item
            </>
          )}
        </p>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={handleAddToCart}
          disabled={!purchasable || addedQuantity < MIN_QUANTITY}
          aria-label={`Add ${currentProduct.name} to cart`}
          className={`inline-flex items-center gap-2 text-white px-6 py-3 rounded-xl transition disabled:bg-slate-300 disabled:cursor-not-allowed ${
            added ? "bg-emerald-500" : "bg-emerald-600 hover:bg-emerald-700"
          }`}
        >
          {added ? (
            <>
              <Check size={18} />
              Added
            </>
          ) : (
            "Add to Cart"
          )}
        </button>

        <button
          type="button"
          onClick={handleBuyNow}
          disabled={!purchasable || addedQuantity < MIN_QUANTITY}
          className="border border-slate-300 hover:bg-slate-100 px-6 py-3 rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Buy Now
        </button>

        <WishlistButton product={currentProduct} className="ml-auto shadow-md" />
      </div>
    </div>
  );
}