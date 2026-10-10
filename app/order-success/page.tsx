"use client";

import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, MapPin, ShoppingBag, Truck } from "lucide-react";
import { groupTotal, type Order } from "../lib/types";
import { formatDateTime, rupees } from "../lib/pricing";
import { useOrders } from "../lib/store";

function OrderLoading() {
  return (
    <div className="max-w-6xl mx-auto py-20 px-4 sm:px-6">
      <div className="flex items-center gap-2 text-slate-500">
        <Loader2 size={18} className="animate-spin" />
        Loading your order…
      </div>
    </div>
  );
}

export default function OrderSuccessPage() {
  return (
    <Suspense fallback={<OrderLoading />}>
      <OrderSuccessContent />
    </Suspense>
  );
}

function OrderSuccessContent() {
  const searchParams = useSearchParams();
  const groupId = searchParams.get("group");
  const orders = useOrders();

  // Keyed by the group the checkout returned rather than a single stored
  // "last order". A mixed-farmer basket is several orders under one group id, so
  // this is the only way to show the customer the one payment they actually
  // made.
  const group: Order[] = groupId ? orders.filter((order) => order.groupId === groupId) : [];

  if (!groupId || group.length === 0) {
    return (
      <div className="max-w-6xl mx-auto py-20 px-4 sm:px-6">
        <div className="rounded-2xl border border-slate-200 shadow-sm p-8 sm:p-12 text-center flex flex-col items-center">
          <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-4">
            <ShoppingBag size={24} className="text-slate-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">No recent order</h1>
          <p className="text-slate-500 mb-6 max-w-md">
            We could not find a recent order on this device. Your order history
            lives in this browser&apos;s storage, so an order placed in a different
            browser or after clearing site data will not appear here.
          </p>
          <Link
            href="/shop"
            className="inline-flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-emerald-700 transition"
          >
            Browse products
          </Link>
        </div>
      </div>
    );
  }

  const subtotal = group.reduce((sum, order) => sum + order.subtotal, 0);
  const deliveryFee = group.reduce((sum, order) => sum + order.deliveryFee, 0);
  const total = groupTotal(group);
  const first = group[0];
  // One delivery, one agent: the receipt presents the trip as a whole even when
  // the basket was split across farms.
  const farmers = [...new Set(group.flatMap((order) => order.items.map((item) => item.farmer)))];

  return (
    <div className="max-w-6xl mx-auto py-10 md:py-20 px-4 sm:px-6">
      <div className="flex items-start gap-3 sm:gap-4 mb-6 md:mb-10">
        <div className="w-12 h-12 shrink-0 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
          <CheckCircle2 size={26} />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
            Order placed successfully
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {group.length > 1
              ? `Your order was split across ${group.length} farms. `
              : ""}
            Placed on {formatDateTime(first.placedAt)}
          </p>
        </div>
      </div>

      <div className="grid gap-8 lg:gap-10 lg:grid-cols-[1fr_360px] items-start">
        <div className="order-1 bg-white rounded-2xl shadow-md p-5 sm:p-6">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Items in this order</h2>

          <ul className="divide-y divide-slate-100">
            {group.flatMap((order) =>
              order.items.map((item) => (
                <li key={`${order.id}-${item.productId}`} className="flex items-center gap-3 py-3">
                  <Image
                    src={item.image}
                    alt={item.name}
                    width={56}
                    height={56}
                    className="w-14 h-14 rounded-lg object-cover shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{item.name}</p>
                    <p className="text-xs text-slate-500 truncate">{item.farmer}</p>
                    <p className="text-xs text-slate-500">
                      {item.quantity} × {item.unit}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-slate-900 shrink-0">
                    {rupees(item.price * item.quantity)}
                  </p>
                </li>
              )),
            )}
          </ul>

          <div className="mt-6 pt-5 border-t border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
              <MapPin size={15} className="text-slate-400" />
              Delivery address
            </h3>
            <p className="text-sm font-semibold text-slate-900">{first.shipping.fullName}</p>
            <p className="text-sm text-slate-500">{first.shipping.phone}</p>
            <p className="text-sm text-slate-500 mt-1 whitespace-pre-line">
              {first.shipping.address}
            </p>
          </div>
        </div>

        {/* top-32, not top-24: the lg header stacks a content row and an h-12 nav row
            and measures ~114px, so a 96px offset tucked the panel under it. */}
        <aside className="order-2 bg-white rounded-2xl shadow-md p-5 sm:p-6 lg:sticky lg:top-32 h-fit">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Payment Summary</h2>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span>{rupees(subtotal)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Delivery</span>
              <span className={deliveryFee === 0 ? "text-emerald-600 font-semibold" : ""}>
                {deliveryFee === 0 ? "Free" : rupees(deliveryFee)}
              </span>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-baseline">
            <span className="font-bold text-slate-900">Total paid</span>
            <span className="text-2xl font-black text-emerald-600">{rupees(total)}</span>
          </div>

          <div className="mt-4 flex items-start gap-2 text-xs bg-slate-50 rounded-lg p-3">
            <Truck size={15} className="shrink-0 mt-0.5 text-slate-500" />
            <span className="text-slate-600">
              {farmers.length > 1
                ? `A delivery agent will collect your order from ${farmers.join(", ")} and bring it to you in one trip.`
                : "Your order is being prepared for delivery."}
            </span>
          </div>

          <p className="mt-4 text-xs text-slate-400">
            This was a simulated payment - no real charge was made.
          </p>

          <Link
            href="/shop"
            className="mt-5 w-full bg-emerald-600 text-white py-3 rounded-xl font-semibold hover:bg-emerald-700 active:scale-[0.99] transition text-center"
          >
            Continue Shopping
          </Link>
        </aside>
      </div>
    </div>
  );
}