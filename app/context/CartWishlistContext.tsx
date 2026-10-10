"use client";

/**
 * The basket and the wishlist.
 *
 * The one structural change from before is identity. Lines used to be keyed by
 * `category-index`, which is positional: adding a product to the catalogue ahead
 * of an existing one renumbers it, so a saved basket could end up pointing at a
 * different product entirely, and a farmer-created listing - which has no
 * catalogue index at all - could not be keyed consistently. Lines are now keyed
 * by `productId`, which is stable for the life of the listing.
 *
 * A line also carries `farmerId`, because checkout splits the basket per farm and
 * needs to know the owner without looking every product up again.
 *
 * The quantity and delivery constants moved to lib/pricing.ts, which the store
 * also needs; they are re-exported here so existing import sites keep working.
 */

import { createContext, useContext, useEffect, useState } from "react";
import {
  clampQuantity,
  DELIVERY_FEE,
  FREE_DELIVERY_THRESHOLD,
  MAX_QUANTITY,
  MIN_QUANTITY,
} from "../lib/pricing";
import { isPurchasable, type Product } from "../lib/types";

export {
  clampQuantity,
  DELIVERY_FEE,
  FREE_DELIVERY_THRESHOLD,
  MAX_QUANTITY,
  MIN_QUANTITY,
};

/** A basket line. `quantity` is the only field that differs from the product. */
export type CartItem = Product & { quantity: number };

export type WishlistItem = Product;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

/**
 * localStorage holds whatever the last version of the app - or a person with
 * devtools open - wrote there. A single unvalidated entry used to survive the
 * Array.isArray check and render as "NaN" in the totals. Anything that is not a
 * well-formed line is dropped rather than repaired.
 */
function parseStored<T>(raw: string | null, isValid: (value: unknown) => value is T): T[] {
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) return [];
  return parsed.filter(isValid);
}

function isProductRecord(value: unknown): value is Omit<Product, "hidden"> {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;

  return (
    isNonEmptyString(item.id) &&
    isNonEmptyString(item.category) &&
    isNonEmptyString(item.name) &&
    isFiniteNumber(item.price) &&
    isNonEmptyString(item.image) &&
    isFiniteNumber(item.rating) &&
    isNonEmptyString(item.farmerId) &&
    isNonEmptyString(item.farmer) &&
    isNonEmptyString(item.location) &&
    isNonEmptyString(item.unit) &&
    isNonEmptyString(item.quality) &&
    isFiniteNumber(item.stockQty) &&
    (item.discount === undefined || typeof item.discount === "string") &&
    isNonEmptyString(item.createdAt)
  );
}

function isCartItem(value: unknown): value is CartItem {
  if (typeof value !== "object" || value === null) return false;
  return isProductRecord(value) && isFiniteNumber((value as CartItem).quantity);
}

function isWishlistItem(value: unknown): value is WishlistItem {
  return isProductRecord(value);
}

type CartWishlistContextType = {
  cart: CartItem[];
  wishlist: WishlistItem[];
  isHydrated: boolean;
  cartSubtotal: number;
  deliveryFee: number;
  cartTotal: number;
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  updateCartQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  removeFromWishlist: (productId: string) => void;
  toggleWishlist: (product: Product) => void;
  isInWishlist: (productId: string) => boolean;
  cartCount: number;
  wishlistCount: number;
};

const CartWishlistContext = createContext<CartWishlistContextType | undefined>(undefined);

export default function CartWishlistProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load from localStorage on mount.
  // Reading localStorage requires the client only, so this cannot be a lazy
  // useState initializer without breaking SSR. The isHydrated flag below is
  // what guards consumers against the initial empty render.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    // getItem itself throws when storage is disabled entirely (private mode,
    // blocked cookies), so the read has to be guarded and not just the parse.
    const read = (key: string) => {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    };

    setCart(
      parseStored(read("agricart_cart"), isCartItem).map((item) => ({
        ...item,
        quantity: clampQuantity(item.quantity),
      })),
    );
    setWishlist(parseStored(read("agricart_wishlist"), isWishlistItem));
    setIsHydrated(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Save to localStorage whenever cart changes
  useEffect(() => {
    if (isHydrated) {
      try {
        localStorage.setItem("agricart_cart", JSON.stringify(cart));
      } catch {
        // A full or disabled store must not take the page down; the basket just
        // will not survive the reload.
      }
    }
  }, [cart, isHydrated]);

  // Save to localStorage whenever wishlist changes
  useEffect(() => {
    if (isHydrated) {
      try {
        localStorage.setItem("agricart_wishlist", JSON.stringify(wishlist));
      } catch {
        // Same as the cart above.
      }
    }
  }, [wishlist, isHydrated]);

  /**
   * Adds up to `quantity`, capped by the MAX_QUANTITY limit and by what the
   * listing actually has.
   *
   * The stock cap matters because every caller is not the product page: the
   * wishlist's "move all to cart" and the product page's "buy now" both come
   * through here, and a basket built from a snapshot can be replayed long after
   * the stock moved. Capping to stockQty here means the context can never be the
   * thing that puts an impossible quantity into a basket - checkout would have to
   * refuse it later instead, with the customer already at the payment step.
   */
  const addToCart = (product: Product, quantity: number = 1) => {
    // An out-of-stock product is left out of the basket entirely rather than
    // added at zero, so the cart page cannot show a line that can never be bought.
    if (!isPurchasable(product)) return;

    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item.id === product.id);
      const target = existingItem ? existingItem.quantity + quantity : quantity;

      return existingItem
        ? prevCart.map((item) =>
            item.id === product.id
              ? { ...item, quantity: clampQuantity(Math.min(target, product.stockQty)) }
              : item,
          )
        : [
            ...prevCart,
            { ...product, quantity: clampQuantity(Math.min(quantity, product.stockQty)) },
          ];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== productId));
  };

  const updateCartQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }

    setCart((prevCart) =>
      prevCart.map((item) => (item.id === productId ? { ...item, quantity: clampQuantity(quantity) } : item)),
    );
  };

  const clearCart = () => {
    setCart([]);
  };

  const removeFromWishlist = (productId: string) => {
    setWishlist((prevWishlist) => prevWishlist.filter((item) => item.id !== productId));
  };

  const isInWishlist = (productId: string) => wishlist.some((item) => item.id === productId);

  const toggleWishlist = (product: Product) => {
    setWishlist((prevWishlist) =>
      prevWishlist.some((item) => item.id === product.id)
        ? prevWishlist.filter((item) => item.id !== product.id)
        : [...prevWishlist, product],
    );
  };

  const cartSubtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const deliveryFee =
    cartSubtotal === 0 || cartSubtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;

  const cartTotal = cartSubtotal + deliveryFee;

  return (
    <CartWishlistContext.Provider
      value={{
        cart,
        wishlist,
        isHydrated,
        cartSubtotal,
        deliveryFee,
        cartTotal,
        addToCart,
        removeFromCart,
        updateCartQuantity,
        clearCart,
        removeFromWishlist,
        toggleWishlist,
        isInWishlist,
        cartCount: cart.reduce((sum, item) => sum + item.quantity, 0),
        wishlistCount: wishlist.length,
      }}
    >
      {children}
    </CartWishlistContext.Provider>
  );
}

export function useCartWishlist() {
  const context = useContext(CartWishlistContext);
  if (!context) {
    throw new Error("useCartWishlist must be used within CartWishlistProvider");
  }
  return context;
}