/**
 * Cart rules, in one place.
 *
 * These used to be exported from CartWishlistContext. The store needs the same
 * numbers to price an order at checkout, and importing the context into the
 * store would be circular, so they live here and the context re-exports them.
 */

export const DELIVERY_FEE = 40;
export const FREE_DELIVERY_THRESHOLD = 499;

/**
 * Quantity bounds shared by the product page and the cart so a line item can
 * never be pushed past what a single "add to cart" would allow.
 */
export const MIN_QUANTITY = 1;
export const MAX_QUANTITY = 10;

/** What a delivery agent earns per trip, scaled by how much they carry. */
export const BASE_TRIP_PAY = 25;
export const PER_ITEM_PAY = 5;

/**
 * The steppers and buttons clamp in their own UI, but a single helper is the
 * only place that can guarantee the invariant for every caller (repeated adds,
 * wishlist "move to cart", programmatic updates).
 * Math.round(NaN) is NaN and Math.max(NaN, n) is NaN, so without this guard a
 * bad value would flow straight through into the totals.
 */
export const clampQuantity = (quantity: number) => {
  if (!Number.isFinite(quantity)) return MIN_QUANTITY;
  return Math.min(Math.max(Math.round(quantity), MIN_QUANTITY), MAX_QUANTITY);
};

export const inr = new Intl.NumberFormat("en-IN");

export const rupees = (value: number) => `\u20b9${inr.format(Math.round(value))}`;

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** What the agent earns for a trip of `itemCount` units. */
export const tripPay = (itemCount: number) =>
  BASE_TRIP_PAY + Math.max(itemCount - 1, 0) * PER_ITEM_PAY;
