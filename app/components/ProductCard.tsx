"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ShoppingCart, Star, Leaf, MapPin, Check } from "lucide-react";
import { useCartWishlist } from "../context/CartWishlistContext";
import { isPurchasable, stockStatus, type Product } from "../lib/types";
import { rupees } from "../lib/pricing";
import WishlistButton from "./WishlistButton";

type ProductCardProps = {
  product: Product;
  /**
   * Position within the product's own category, because that is what the
   * product route is addressed by. Passed in rather than derived, so a card
   * rendering a filtered or paged list still links to the right address.
   */
  index: number;
};

export default function ProductCard({ product, index }: ProductCardProps) {
  const { addToCart } = useCartWishlist();
  const [added, setAdded] = useState(false);

  const purchasable = isPurchasable(product);
  const status = stockStatus(product.stockQty);
  const href = `/product/${encodeURIComponent(product.category)}/${index}`;

  const handleAddToCart = () => {
    addToCart(product);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1500);
  };

  return (
    <div className="bg-white rounded-2xl shadow-md overflow-hidden flex flex-col">
      <div className="relative h-52 overflow-hidden">
        <Link href={href} className="block relative h-full w-full" aria-label={product.name}>
          <Image
            src={product.image}
            alt={product.name}
            fill
            sizes="(min-width: 1280px) 20vw, (min-width: 768px) 33vw, 50vw"
            className="object-cover transition-transform duration-500 hover:scale-105"
          />
        </Link>

        <WishlistButton product={product} className="absolute top-3 right-3 shadow-md" />

        {status !== "In Stock" && (
          <span
            className={`absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-bold text-white ${
              status === "Out of Stock" ? "bg-slate-600" : "bg-amber-500"
            }`}
          >
            {status}
          </span>
        )}
      </div>

      <div className="p-5 space-y-2 flex flex-col grow">
        <h4 className="font-bold text-slate-900">
          <Link href={href} className="hover:text-emerald-700 transition-colors">
            {product.name}
          </Link>
        </h4>

        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Leaf size={14} /> {product.farmer}
        </div>

        <div className="flex items-center gap-2 text-sm text-slate-500">
          <MapPin size={14} /> {product.location}
        </div>

        {/* A product nobody has rated yet would otherwise show 0, which reads as
            "badly rated" rather than "no ratings". */}
        {product.rating > 0 && (
          <div className="flex items-center gap-1 text-amber-500 text-sm">
            <Star size={14} fill="currentColor" /> {product.rating}
          </div>
        )}

        <div className="flex justify-between items-center pt-2 mt-auto">
          <div>
            <p className="text-lg font-bold text-emerald-600">{rupees(product.price)}</p>
            <p className="text-xs text-slate-400">{product.unit}</p>
          </div>

          <button
            type="button"
            onClick={handleAddToCart}
            disabled={!purchasable}
            aria-label={`Add ${product.name} to cart`}
            className={`p-2 rounded-lg text-white transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed ${
              added ? "bg-emerald-500" : "bg-emerald-600 hover:bg-emerald-500"
            }`}
          >
            {added ? <Check size={18} /> : <ShoppingCart size={18} />}
          </button>
        </div>

        <p
          className={`text-xs ${
            status === "In Stock" ? "text-slate-500" : "text-amber-600 font-semibold"
          }`}
        >
          {status === "Out of Stock"
            ? "Out of stock"
            : status === "Low Stock"
              ? `Only ${product.stockQty} ${product.unit} left`
              : `${product.stockQty} ${product.unit} available`}
        </p>
      </div>
    </div>
  );
}