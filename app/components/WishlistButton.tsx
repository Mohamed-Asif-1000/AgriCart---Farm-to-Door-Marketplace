"use client";

import { Heart } from "lucide-react";
import { useCartWishlist } from "../context/CartWishlistContext";
import type { Product } from "../lib/types";

type WishlistButtonProps = {
  product: Product;
  className?: string;
};

export default function WishlistButton({ product, className = "" }: WishlistButtonProps) {
  const { isInWishlist, toggleWishlist } = useCartWishlist();
  const saved = isInWishlist(product.id);

  return (
    <button
      type="button"
      onClick={(event) => {
        // The surrounding product card is a link target, so the click must not
        // bubble up to it or the heart would navigate instead of toggling.
        event.preventDefault();
        event.stopPropagation();
        toggleWishlist(product);
      }}
      aria-label={
        saved ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`
      }
      aria-pressed={saved}
      title={saved ? "Remove from wishlist" : "Add to wishlist"}
      className={`p-2 rounded-full transition-colors ${
        saved ? "bg-rose-500 text-white" : "bg-white/90 text-slate-500 hover:text-rose-600"
      } ${className}`}
    >
      <Heart size={18} fill={saved ? "currentColor" : "none"} />
    </button>
  );
}