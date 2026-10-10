"use client";

import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, LogIn, ShieldCheck, ShoppingBag, Truck } from "lucide-react";
import { useCartWishlist, FREE_DELIVERY_THRESHOLD } from "../context/CartWishlistContext";
import { placeOrder } from "../lib/store";
import { DASHBOARD_BY_ROLE, readSession, sessionId } from "../lib/session";
import { useIsSessionReady, useSession } from "../lib/useSession";
import PaymentModal from "../components/PaymentModal";
import { fieldClass, FieldShell } from "../components/FormField";

type Field = "fullName" | "phone" | "address";
type FormValues = Record<Field, string>;

const PHONE_PATTERN = /^[6-9]\d{9}$/;

function validate(values: FormValues) {
  return {
    fullName:
      values.fullName.trim().length >= 2
        ? null
        : "Please enter your full name.",
    phone: PHONE_PATTERN.test(values.phone.trim())
      ? null
      : "Enter a valid 10-digit mobile number.",
    address:
      values.address.trim().length >= 10
        ? null
        : "Please enter a complete address.",
  };
}

export default function CheckoutPage() {
  const router = useRouter();
  const {
    cart,
    cartSubtotal,
    deliveryFee,
    cartTotal,
    cartCount,
    isHydrated,
    clearCart,
  } = useCartWishlist();

  // The session lives in localStorage, so it is only readable on the client.
  // Checkout required no account at all before this, which meant an anonymous
  // visitor could pay and land on a confirmation page with no order behind it.
  const session = useSession();
  const isSessionReady = useIsSessionReady();
  // Until the browser snapshot has landed, session === null means "unknown",
  // not "signed out" - see the note on useIsSessionReady.
  const isSignedIn = isSessionReady && session !== null;

  const [values, setValues] = useState<FormValues>({
    fullName: "",
    phone: "",
    address: "",
  });
  const [touched, setTouched] = useState<Record<Field, boolean>>({
    fullName: false,
    phone: false,
    address: false,
  });
  const [paying, setPaying] = useState(false);
  // Set the moment payment succeeds. clearCart() below empties the cart before
  // the router settles, and without this the `cart.length === 0` guard swapped
  // in the empty-cart screen for a frame and unmounted the payment modal
  // mid-animation.
  const [completing, setCompleting] = useState(false);
  // Form-level failure that is not tied to a single field - currently only a
  // storage write refusing the order.
  const [formError, setFormError] = useState<string | null>(null);

  const errors = useMemo(() => validate(values), [values]);
  const isValid = !errors.fullName && !errors.phone && !errors.address;
  const amountToFreeDelivery = FREE_DELIVERY_THRESHOLD - cartSubtotal;

  const handleChange =
    (field: Field) =>
    (
      event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
      setValues((prev) => ({ ...prev, [field]: event.target.value }));
      setFormError(null);
    };

  const handleBlur = (field: Field) => () => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  // maxLength={10} used to truncate a pasted "+91 98765 43210" to
  // "9198765432", which PHONE_PATTERN then rejected with no way for the user to
  // see what went wrong. Sanitising on change accepts any paste format while
  // still holding the 10-digit cap.
  const handlePhoneChange = (event: ChangeEvent<HTMLInputElement>) => {
    const digits = event.target.value.replace(/\D/g, "").slice(0, 10);
    setValues((prev) => ({ ...prev, phone: digits }));
    setFormError(null);
  };

  const handlePay = (event: FormEvent) => {
    event.preventDefault();
    if (!isValid || paying) return;
    // The form is only rendered once signed in, so this is belt-and-braces
    // against a submit landing in the gap before the session is read.
    if (!isSignedIn) return;
    setPaying(true);
  };

  const completePayment = () => {
    // The session is re-read here instead of using the value captured at render:
    // the modal is open for ~2.8s, and the reading that matters is the one live
    // at completion.
    const liveSession = readSession();
    if (!liveSession) {
      setCompleting(false);
      setPaying(false);
      setFormError("Your session ended before the payment finished. Please sign in again.");
      return;
    }

    const result = placeOrder({
      customer: {
        id: sessionId(liveSession),
        name: values.fullName.trim() || liveSession.name,
      },
      lines: cart.map((item) => ({
        productId: item.id,
        category: item.category,
        name: item.name,
        farmerId: item.farmerId,
        farmer: item.farmer,
        image: item.image,
        unit: item.unit,
        price: item.price,
        quantity: item.quantity,
      })),
      subtotal: cartSubtotal,
      deliveryFee,
      shipping: {
        fullName: values.fullName.trim(),
        phone: values.phone.trim(),
        address: values.address.trim(),
      },
    });

    // Losing the receipt is recoverable; losing the basket is not. If the write
    // was refused, keep the cart and drop the customer back on the form with an
    // explanation rather than clearing it and claiming success.
    if (!result.ok) {
      setCompleting(false);
      setPaying(false);
      // The cart is deliberately kept in both cases, so the customer can fix the
      // basket and retry rather than losing the selections they just paid for.
      setFormError(`${result.detail} Your cart has been kept.`);
      return;
    }

    setCompleting(true);
    clearCart();
    // The customer's own receipt is passed by group id, so a mixed-farmer
    // checkout shows the single payment they made rather than one of several
    // per-farm orders. Other roles land on their dashboard, where the new order is
    // already waiting for them.
    router.push(
      liveSession.role === "customer"
        ? `/order-success?group=${result.groupId}`
        : DASHBOARD_BY_ROLE[liveSession.role],
    );
  };

  // Held until both the basket and the session have been read. Rendering the
  // form during the one frame where the session is still unknown would flash
  // the signed-out panel and then the form back again.
  if (!isHydrated || !isSessionReady) {
    return (
      <div className="max-w-6xl mx-auto py-20 px-6">
        <div className="flex items-center gap-2 text-slate-500">
          <Loader2 size={18} className="animate-spin" />
          Loading checkout…
        </div>
      </div>
    );
  }

  // Signed out: keep the basket and the summary on screen and ask for an
  // account in place, rather than redirecting away from a full cart. The cart
  // is in localStorage, so signing in and coming back loses nothing.
  if (isSessionReady && !isSignedIn) {
    return (
      <div className="max-w-6xl mx-auto py-10 md:py-20 px-4 sm:px-6">
        <div className="rounded-2xl border border-slate-200 shadow-md bg-white p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <LogIn size={24} />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-slate-900 mb-1">
              Sign in to checkout
            </h1>
            <p className="text-slate-500 text-sm">
              Your basket has {cartCount}{" "}
              {cartCount === 1 ? "item" : "items"} ({cart.length}{" "}
              {cart.length === 1 ? "line" : "lines"}) worth ₹{cartTotal}. Sign in
              to place the order - nothing here is lost.
            </p>
          </div>
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-emerald-700 transition shrink-0"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  if (cart.length === 0 && !completing) {
    return (
      <div className="max-w-6xl mx-auto py-20 px-6">
        <div className="rounded-2xl border border-slate-200 shadow-sm p-12 text-center flex flex-col items-center">
          <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-4">
            <ShoppingBag size={24} className="text-slate-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            Your cart is empty
          </h1>
          <p className="text-slate-500 mb-6 max-w-md">
            Add a few farm fresh products before heading to checkout.
          </p>
          <Link
            href="/shop"
            className="inline-flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-emerald-700 transition"
          >
            Shop now
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-10 md:py-20 px-4 sm:px-6">
      <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-6 md:mb-10">
        Checkout
      </h1>

      <div className="grid gap-8 lg:gap-10 lg:grid-cols-[1fr_360px] items-start">
        {/* Shipping details */}
        <div className="order-1">
          <form
            className="bg-white rounded-2xl shadow-md p-5 sm:p-6"
            noValidate
            onSubmit={handlePay}
          >
            <h2 className="text-xl font-bold text-slate-900 mb-5">
              Shipping Details
            </h2>

            {formError ? (
              <p
                role="alert"
                className="mb-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
              >
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                {formError}
              </p>
            ) : null}

            <FieldShell
              id="fullName"
              label="Full Name"
              error={errors.fullName}
              showError={touched.fullName}
              className="mb-4"
            >
              <input
                id="fullName"
                type="text"
                autoComplete="name"
                placeholder="e.g. Anita Sharma"
                required
                value={values.fullName}
                onChange={handleChange("fullName")}
                onBlur={handleBlur("fullName")}
                aria-invalid={touched.fullName && Boolean(errors.fullName)}
                aria-describedby={
                  touched.fullName && errors.fullName ? "fullName-error" : undefined
                }
                className={fieldClass(touched.fullName, errors.fullName)}
              />
            </FieldShell>

            <FieldShell
              id="phone"
              label="Phone Number"
              error={errors.phone}
              showError={touched.phone}
              className="mb-4"
            >
              <input
                id="phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                placeholder="10-digit mobile number"
                required
                value={values.phone}
                onChange={handlePhoneChange}
                onBlur={handleBlur("phone")}
                aria-invalid={touched.phone && Boolean(errors.phone)}
                aria-describedby={
                  touched.phone && errors.phone ? "phone-error" : undefined
                }
                className={fieldClass(touched.phone, errors.phone)}
              />
            </FieldShell>

            <FieldShell
              id="address"
              label="Delivery Address"
              error={errors.address}
              showError={touched.address}
              className="mb-4"
            >
              <textarea
                id="address"
                rows={3}
                autoComplete="street-address"
                placeholder="House / street, area, city, state, PIN code"
                required
                value={values.address}
                onChange={handleChange("address")}
                onBlur={handleBlur("address")}
                aria-invalid={touched.address && Boolean(errors.address)}
                aria-describedby={
                  touched.address && errors.address
                    ? "address-error"
                    : undefined
                }
                className={`${fieldClass(touched.address, errors.address)} resize-none`}
              />
            </FieldShell>

            <button
              type="submit"
              disabled={!isValid || paying}
              aria-disabled={!isValid || paying}
              className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 text-white py-3.5 rounded-xl font-bold transition hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed disabled:hover:bg-slate-300"
            >
              <ShieldCheck size={18} />
              Proceed to Payment
            </button>

            <p className="mt-3 text-center text-xs text-slate-500">
              Demo payment - no real charge is made. You would be charged ₹
              {cartTotal} in total.
            </p>
          </form>
        </div>

        {/* Order summary */}
        <div className="order-2">
          {/* The sticky header is two rows on lg (py-3 content row + an h-12 nav row
            plus borders), roughly 114px tall. top-24 is 96px, so the summary
            slid underneath it and its heading was clipped. top-32 matches the
            offset cart/page.tsx already uses. */}
          <div className="bg-white rounded-2xl shadow-md p-5 sm:p-6 lg:sticky lg:top-32">
            <h2 className="text-xl font-bold text-slate-900 mb-4">
              Order Summary
            </h2>

            <ul className="divide-y divide-slate-100 mb-4">
              {cart.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-3 py-3"
                >
                  <Image
                    src={item.image}
                    alt={item.name}
                    width={56}
                    height={56}
                    className="w-14 h-14 rounded-lg object-cover shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {item.name}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {item.farmer}
                    </p>
                    <p className="text-xs text-slate-500">
                      {item.quantity} × {item.unit}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-slate-900 shrink-0">
                    ₹{item.price * item.quantity}
                  </p>
                </li>
              ))}
            </ul>

            <div className="border-t border-slate-200 pt-4 space-y-2 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span>₹{cartSubtotal}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Delivery</span>
                <span className={deliveryFee === 0 ? "text-emerald-600 font-semibold" : ""}>
                  {deliveryFee === 0 ? "Free" : `₹${deliveryFee}`}
                </span>
              </div>
              <div className="flex justify-between text-base font-bold text-slate-900 pt-2 border-t border-slate-100">
                <span>Total</span>
                <span>₹{cartTotal}</span>
              </div>
            </div>

            {amountToFreeDelivery > 0 ? (
              <p className="mt-4 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2">
                <Truck size={16} className="mt-0.5 shrink-0" />
                <span>
                  Add ₹{amountToFreeDelivery} more for free delivery.
                </span>
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {paying ? (
        <PaymentModal
          subtotal={cartSubtotal}
          deliveryFee={deliveryFee}
          total={cartTotal}
          onComplete={completePayment}
        />
      ) : null}
    </div>
  );
}
