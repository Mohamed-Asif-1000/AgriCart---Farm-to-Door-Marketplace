"use client";

/**
 * The customer dashboard.
 *
 * Every figure here used to be a module-level constant: two invented orders, three
 * invented payment methods, three invented addresses, a payment history referring
 * to orders that never existed, and hardcoded stat cards reading "₹4,250 total
 * spent" for whoever happened to sign in. All of it is now derived from the store -
 * the orders this account actually placed, and the profile this account actually
 * saved.
 */

import { useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ShoppingBag,
  Heart,
  MapPin,
  Package,
  Clock,
  Star,
  ChevronRight,
  Settings,
  LogOut,
  CreditCard,
  Bell,
  Wallet,
  Landmark,
  Smartphone,
  ShieldCheck,
  ArrowUpRight,
  Leaf,
} from "lucide-react";
import { useCartWishlist } from "../../context/CartWishlistContext";
import { useIsSessionReady, useSession } from "../../lib/useSession";
import { clearSession, sessionId } from "../../lib/session";
import {
  ORDER_FLOW,
  type Address,
  type PaymentKind,
} from "../../lib/types";
import { formatDate, rupees } from "../../lib/pricing";
import {
  newAddressId,
  newPaymentId,
  profileFor,
  reviewOrder,
  updateProfile,
  useOrders,
  useProducts,
} from "../../lib/store";
import DashboardShell, {
  DashboardPanel,
  DashboardEmptyState,
  DashboardSkeleton,
} from "../../components/dashboard/DashboardShell";

const NAV = [
  { key: "overview", label: "My Orders", icon: <Package size={20} /> },
  { key: "wishlist", label: "Wishlist", icon: <Heart size={20} /> },
  { key: "address", label: "Addresses", icon: <MapPin size={20} /> },
  { key: "payments", label: "Payments", icon: <CreditCard size={20} /> },
];

const BRAND = (
  <div className="flex items-center gap-3">
    <span className="w-11 h-11 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-200 shrink-0">
      <ShoppingBag size={22} />
    </span>
    <span className="font-black text-xl tracking-tight truncate">My AgriCart</span>
  </div>
);

/** Payment kinds are stored as a short union; the icon is a view concern. */
const METHOD_ICONS: Record<PaymentKind, typeof CreditCard> = {
  Card: CreditCard,
  UPI: Smartphone,
  "Net Banking": Landmark,
  Wallet: Wallet,
  "Cash on Delivery": Wallet,
};

/** Offered when adding a method. The customer picks, rather than being given a fixed list. */
const METHOD_CHOICES: { label: string; detail: string; kind: PaymentKind }[] = [
  { label: "UPI · yourname@upi", detail: "Pay by UPI id", kind: "UPI" },
  { label: "HDFC Bank •••• 4412", detail: "Visa Debit", kind: "Card" },
  { label: "ICICI Bank •••• 9087", detail: "Net Banking", kind: "Net Banking" },
  { label: "Amazon Pay", detail: "Wallet", kind: "Wallet" },
  { label: "Cash on Delivery", detail: "Pay at doorstep", kind: "Cash on Delivery" },
];

const TRACKING_LABELS: Record<string, string> = {
  Placed: "Order confirmed",
  Assigned: "Agent assigned",
  "Picked up": "Packed at farm",
  "In Transit": "Out for delivery",
  Delivered: "Delivered",
};

export default function CustomerDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const {
    wishlist,
    isHydrated,
    wishlistCount,
    addToCart,
    removeFromWishlist,
  } = useCartWishlist();

  const session = useSession();
  const isSessionReady = useIsSessionReady();
  const router = useRouter();

  const allOrders = useOrders();
  const products = useProducts();
  const accountId = session ? sessionId(session) : null;

  // Scoped to this account. Without the filter every customer would see every
  // order in the browser, including other roles' test purchases.
  const orders = accountId
    ? allOrders.filter((order) => order.customerId === accountId)
    : [];

  const profile = accountId ? profileFor(accountId, "customer") : null;
  const liveById = new Map(products.map((product) => [product.id, product]));

  const [trackingId, setTrackingId] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<string | null>(null);
  const [addressDraft, setAddressDraft] = useState("");
  const [addressLabel, setAddressLabel] = useState("");

  // The dashboard used to greet a hardcoded "Rahul" and render a hardcoded
  // avatar, so every signed-in customer saw someone else's account. Read the
  // name the login form actually stored instead, once the localStorage snapshot
  // has landed - otherwise "there"/"Guest" flash before the swap.
  const knownName = isSessionReady ? session?.name : null;
  const firstName = knownName?.split(" ")[0] ?? "there";
  const displayName = knownName ?? "Guest";

  const handleLogout = () => {
    // Pushing /login without clearing agricart_current_user left the session
    // intact, and app/dashboard/layout.tsx re-authenticated on the way back.
    clearSession();
    router.push("/");
  };

  // removeFromWishlist filters off the previous state, so one call per item
  // composes correctly. Same pairing the /wishlist page uses.
  const moveToCart = (id: string) => {
    const saved = wishlist.find((entry) => entry.id === id);
    if (!saved) return;
    // Use the live product so the basket gets the current price and stock.
    const live = liveById.get(saved.id);
    if (live && !live.hidden) addToCart(live);
    removeFromWishlist(saved.id);
  };

  const activeOrders = orders.filter((order) => order.status !== "Delivered");
  const totalSpent = orders.reduce((sum, order) => sum + order.total, 0);

  const saveProfile = (mutate: Parameters<typeof updateProfile>[2]) => {
    if (!accountId) return;
    updateProfile(accountId, "customer", mutate);
  };

  const addMethod = (choice: (typeof METHOD_CHOICES)[number]) => {
    if (!profile) return;
    saveProfile((previous) => ({
      ...previous,
      paymentMethods: [
        ...previous.paymentMethods,
        {
          id: newPaymentId(),
          label: choice.label,
          detail: choice.detail,
          kind: choice.kind,
          // The first method saved becomes the default automatically, otherwise
          // every customer would have a form with nothing preselected.
          isDefault: previous.paymentMethods.length === 0,
        },
      ],
    }));
  };

  const makeDefaultMethod = (id: string) => {
    saveProfile((previous) => ({
      ...previous,
      paymentMethods: previous.paymentMethods.map((method) => ({
        ...method,
        isDefault: method.id === id,
      })),
    }));
  };

  const removeMethod = (id: string) => {
    saveProfile((previous) => {
      const remaining = previous.paymentMethods.filter((method) => method.id !== id);
      // Never leave the list with no default if the default was the one removed.
      const stillHasDefault = remaining.some((method) => method.isDefault);
      return {
        ...previous,
        paymentMethods: stillHasDefault
          ? remaining
          : remaining.map((method, i) => ({ ...method, isDefault: i === 0 })),
      };
    });
  };

  const saveAddress = () => {
    const text = addressDraft.trim();
    if (!text || !editingAddress || !profile) return;

    const next: Address[] = profile.addresses.some((entry) => entry.id === editingAddress)
      ? profile.addresses.map((entry) =>
          entry.id === editingAddress
            ? { ...entry, address: text, label: addressLabel.trim() || entry.label }
            : entry,
        )
      : [
          ...profile.addresses,
          {
            id: newAddressId(),
            label: addressLabel.trim() || `Address ${profile.addresses.length + 1}`,
            address: text,
            isDefault: profile.addresses.length === 0,
          },
        ];

    saveProfile((previous) => ({ ...previous, addresses: next }));
    setEditingAddress(null);
    setAddressDraft("");
    setAddressLabel("");
  };

  const removeAddress = (id: string) => {
    saveProfile((previous) => ({
      ...previous,
      addresses: previous.addresses.filter((entry) => entry.id !== id),
    }));
  };

  const beginAddAddress = () => {
    setEditingAddress("new");
    setAddressDraft("");
    setAddressLabel("");
  };

  const beginEditAddress = (address: Address) => {
    setEditingAddress(address.id);
    setAddressDraft(address.address);
    setAddressLabel(address.label);
  };

  const notifications = [
    ...activeOrders.map((order) => ({
      id: order.id,
      title: `Order ${order.id} is ${order.status.toLowerCase()}`,
      detail: order.agentName
        ? `${order.agentName} is handling this delivery.`
        : "Waiting for a delivery agent to accept it.",
    })),
    {
      id: "wishlist",
      title: isHydrated ? `${wishlistCount} items wishlisted` : "Wishlist saved",
      detail: "Saved products keep their current price in your wishlist.",
    },
  ];

  return (
    <DashboardShell
      theme="light"
      brand={BRAND}
      title={`Hello, ${firstName}`}
      subtitle="Manage your farm-fresh orders and preferences."
      nav={NAV}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      headerRight={
        <>
          <div className="relative">
            <button
              type="button"
              aria-label="Notifications"
              aria-expanded={notificationsOpen}
              onClick={() => setNotificationsOpen((open) => !open)}
              className="relative bg-white p-3 rounded-2xl border border-slate-200 text-slate-400 hover:text-slate-700 transition-colors"
            >
              <Bell size={22} />
              {activeOrders.length > 0 && (
                <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />
              )}
            </button>

            {notificationsOpen && (
              <div className="absolute right-0 mt-3 w-72 bg-white rounded-2xl border border-slate-200 shadow-xl p-2 z-50">
                <p className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Notifications
                </p>
                {notifications.length === 0 ? (
                  <p className="px-3 py-2.5 text-sm text-slate-500">Nothing to report.</p>
                ) : (
                  <ul className="space-y-1">
                    {notifications.map((note) => (
                      <li key={note.id} className="px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors">
                        <span className="block text-sm font-bold text-slate-800">{note.title}</span>
                        <span className="block text-xs text-slate-500">{note.detail}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
          <div className="w-12 h-12 bg-slate-200 rounded-2xl border-2 border-white overflow-hidden shrink-0 flex items-center justify-center">
            <span className="text-sm font-black text-slate-600">
              {displayName
                .split(" ")
                .map((part) => part[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()}
            </span>
          </div>
        </>
      }
      sidebarFooter={
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={() => setSettingsOpen((open) => !open)}
            aria-expanded={settingsOpen}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300 font-bold text-sm text-slate-500 hover:bg-slate-50 hover:text-emerald-600"
          >
            <Settings size={20} />
            <span>Account Settings</span>
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300 font-bold text-sm text-red-500 hover:bg-rose-50"
          >
            <LogOut size={20} />
            <span>Logout</span>
          </button>

          {settingsOpen && profile && (
            <div className="mt-2 p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              {(
                [
                  ["orderUpdates", "Order updates"],
                  ["smsAlerts", "SMS alerts"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex items-center justify-between gap-2 cursor-pointer">
                  <span className="text-xs font-bold text-slate-600">{label}</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={profile.prefs[key]}
                    aria-label={label}
                    onClick={() =>
                      saveProfile((previous) => ({
                        ...previous,
                        prefs: { ...previous.prefs, [key]: !previous.prefs[key] },
                      }))
                    }
                    className={`w-9 h-5 rounded-full relative transition-colors shrink-0 ${
                      profile.prefs[key] ? "bg-emerald-500" : "bg-slate-300"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${
                        profile.prefs[key] ? "left-4.5" : "left-0.5"
                      }`}
                    />
                  </button>
                </label>
              ))}
            </div>
          )}
        </div>
      }
    >
      {activeTab === "overview" && (
        <DashboardPanel className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <CustomerStat
              label="Active Orders"
              value={String(activeOrders.length).padStart(2, "0")}
              icon={<Clock className="text-blue-600" />}
              color="bg-blue-50"
            />
            <CustomerStat
              label="Total Spent"
              value={rupees(totalSpent)}
              icon={<CreditCard className="text-emerald-600" />}
              color="bg-emerald-50"
            />
            <CustomerStat
              label="Items Wishlisted"
              value={isHydrated ? String(wishlistCount).padStart(2, "0") : "--"}
              icon={<Heart className="text-pink-600" />}
              color="bg-pink-50"
            />
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-lg text-slate-800">Order History</h3>
              <span className="text-sm font-bold text-slate-400 flex items-center gap-1">
                {orders.length} orders <ChevronRight size={16} />
              </span>
            </div>

            {orders.length === 0 ? (
              <DashboardEmptyState
                icon={<Package size={32} />}
                title="No orders yet"
                description="Once you check out, every order appears here with live delivery status."
                action={
                  <Link
                    href="/shop"
                    className="inline-block bg-emerald-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-emerald-700 transition-colors"
                  >
                    Browse products
                  </Link>
                }
              />
            ) : (
              <div className="divide-y divide-slate-100">
                {orders.map((order) => {
                  const firstItem = order.items[0];
                  // Progress index from the shared flow, so tracking stays in step
                  // with what the delivery agent actually advances.
                  const stepIndex = ORDER_FLOW.indexOf(
                    order.status as (typeof ORDER_FLOW)[number],
                  );

                  return (
                    <div key={order.id} className="hover:bg-slate-50 transition-colors">
                      <div className="p-6 flex flex-col md:flex-row md:items-center gap-6">
                        {firstItem?.image ? (
                          <Image
                            src={firstItem.image}
                            className="w-20 h-20 rounded-2xl object-cover shrink-0"
                            alt=""
                            width={80}
                            height={80}
                          />
                        ) : (
                          <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                            <ShoppingBag size={28} />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-slate-400 font-bold mb-1">{order.id}</p>
                          <h4 className="font-bold text-slate-900 text-lg">
                            {firstItem?.name ?? "Order"}
                            {order.items.length > 1
                              ? ` + ${order.items.length - 1} more`
                              : ""}
                          </h4>
                          <p className="text-sm text-slate-500">
                            Purchased on {formatDate(order.placedAt)}
                            {order.agentName ? ` • ${order.agentName}` : ""}
                          </p>
                          <Link
                            href={`/order-success?group=${order.groupId}`}
                            className="inline-flex items-center gap-1 text-sm text-emerald-700 font-semibold hover:underline mt-2"
                          >
                            View receipt
                            <ArrowUpRight size={14} />
                          </Link>
                        </div>
                        <div className="text-left md:text-right">
                          <p className="font-black text-slate-900 text-lg">{rupees(order.total)}</p>
                          <span
                            className={`inline-block px-3 py-1 rounded-lg text-xs font-black mt-1 ${
                              order.status === "Delivered"
                                ? "bg-emerald-100 text-emerald-700"
                                : order.status === "In Transit"
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {order.status}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setTrackingId((current) => (current === order.id ? null : order.id))
                          }
                          aria-expanded={trackingId === order.id}
                          className="px-6 py-2 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-colors self-start"
                        >
                          {trackingId === order.id ? "Hide" : "Track"}
                        </button>
                      </div>

                      {trackingId === order.id && (
                        <div className="px-6 pb-6 -mt-2">
                          <ol className="border-l-2 border-emerald-100 pl-6 space-y-4">
                            {ORDER_FLOW.map((step, i) => (
                              <li key={step} className="relative">
                                <span
                                  className={`absolute -left-[31px] top-1 w-3 h-3 rounded-full border-2 border-white ${
                                    i <= stepIndex ? "bg-emerald-500" : "bg-slate-200"
                                  }`}
                                />
                                <p
                                  className={`text-sm font-bold ${
                                    i <= stepIndex ? "text-slate-900" : "text-slate-400"
                                  }`}
                                >
                                  {TRACKING_LABELS[step]}
                                </p>
                                <p className="text-xs text-slate-400">
                                  {i <= stepIndex ? "Completed" : "Pending"}
                                </p>
                              </li>
                            ))}
                          </ol>

                          {/* Only a delivered trip that nobody has rated yet can be
                              reviewed; reviewOrder re-checks that server-side of
                              the store, so the button state matches the rule. */}
                          {order.status === "Delivered" && order.agentId ? (
                            order.rating !== null ? (
                              <p className="mt-4 text-sm text-slate-500">
                                You rated this delivery {order.rating}/5.
                              </p>
                            ) : reviewingId === order.id ? (
                              <ReviewForm
                                onCancel={() => setReviewingId(null)}
                                onSubmit={(rating, comment) => {
                                  if (reviewOrder(order.id, rating, comment)) {
                                    setReviewingId(null);
                                  }
                                }}
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={() => setReviewingId(order.id)}
                                className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-emerald-700 hover:underline"
                              >
                                <Star size={15} />
                                Rate this delivery
                              </button>
                            )
                          ) : null}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DashboardPanel>
      )}

      {activeTab === "wishlist" && (
        <DashboardPanel>
          {!isHydrated ? (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm">
              <DashboardSkeleton rows={3} />
            </div>
          ) : wishlist.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm">
              <DashboardEmptyState
                icon={<Heart size={32} />}
                title="Your wishlist is empty"
                description="Tap the heart on any product to save it here for later."
                action={
                  <Link
                    href="/shop"
                    className="inline-block bg-emerald-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-emerald-700 transition-colors"
                  >
                    Browse all products
                  </Link>
                }
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {wishlist.map((saved) => {
                // Price and stock come from the live catalogue; the saved copy is
                // only a fallback for a listing the farmer has since removed.
                const live = liveById.get(saved.id);
                const item = live ?? saved;
                const gone = !live || live.hidden;
                return (
                  <div
                    key={saved.id}
                    className={`bg-white rounded-3xl border border-slate-200 p-4 shadow-sm group transition-all duration-300 hover:-translate-y-1 hover:shadow-lg flex flex-col ${
                      gone ? "opacity-60" : ""
                    }`}
                  >
                    <div className="relative aspect-square rounded-2xl overflow-hidden mb-4">
                      <Image
                        src={item.image}
                        fill
                        sizes="(min-width: 1024px) 25vw, 50vw"
                        className="object-cover group-hover:scale-110 transition-transform duration-500"
                        alt={item.name}
                      />
                      <button
                        type="button"
                        onClick={() => removeFromWishlist(saved.id)}
                        aria-label={`Remove ${item.name} from wishlist`}
                        className="absolute top-3 right-3 p-2 bg-white/90 backdrop-blur rounded-xl text-red-500 hover:bg-rose-500 hover:text-white transition-colors"
                      >
                        <Heart fill="currentColor" size={18} />
                      </button>
                    </div>

                    <h3 className="font-bold text-slate-900">{item.name}</h3>

                    <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
                      <Leaf size={14} /> {item.farmer}
                    </div>

                    {item.rating > 0 && (
                      <div className="flex items-center gap-1 text-amber-500 text-sm mt-1">
                        <Star size={14} fill="currentColor" /> {item.rating}
                      </div>
                    )}

                    <div className="pt-2 mt-auto">
                      <p className="text-lg font-bold text-emerald-600">{rupees(item.price)}</p>
                      <p className="text-xs text-slate-400">{item.unit}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => moveToCart(saved.id)}
                      disabled={gone}
                      className="w-full mt-3 inline-flex items-center justify-center gap-2 bg-emerald-600 text-white py-2.5 rounded-xl font-semibold hover:bg-emerald-700 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed"
                    >
                      <ShoppingBag size={16} />
                      {gone ? "Unavailable" : "Move to Cart"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </DashboardPanel>
      )}

      {activeTab === "address" && (
        <DashboardPanel>
          <div className="grid md:grid-cols-2 gap-6">
            {!profile || profile.addresses.length === 0 ? (
              <div className="md:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm">
                <DashboardEmptyState
                  icon={<MapPin size={32} />}
                  title="No saved addresses"
                  description="Add a delivery address so checkout can ship your order."
                  action={
                    <button
                      type="button"
                      onClick={beginAddAddress}
                      className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-emerald-700 transition-colors"
                    >
                      Add your first address
                    </button>
                  }
                />
              </div>
            ) : (
              profile.addresses.map((address) => (
                <AddressCard
                  key={address.id}
                  type={address.label}
                  address={address.address}
                  isDefault={address.isDefault}
                  editing={editingAddress === address.id}
                  draft={addressDraft}
                  labelDraft={addressLabel}
                  onDraftChange={setAddressDraft}
                  onLabelChange={setAddressLabel}
                  onEdit={() => beginEditAddress(address)}
                  onSave={saveAddress}
                  onCancel={() => setEditingAddress(null)}
                  onRemove={() => removeAddress(address.id)}
                />
              ))
            )}

            {editingAddress === "new" ? (
              <AddressCard
                type="New address"
                address=""
                editing
                draft={addressDraft}
                labelDraft={addressLabel}
                onDraftChange={setAddressDraft}
                onLabelChange={setAddressLabel}
                onEdit={() => undefined}
                onSave={saveAddress}
                onCancel={() => setEditingAddress(null)}
                onRemove={() => setEditingAddress(null)}
              />
            ) : (
              <button
                type="button"
                onClick={beginAddAddress}
                className="border-2 border-dashed border-slate-300 rounded-3xl p-8 flex flex-col items-center justify-center text-slate-500 hover:border-emerald-500 hover:text-emerald-600 transition-colors group"
              >
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-2 group-hover:bg-emerald-50">
                  <MapPin />
                </div>
                <span className="font-bold">Add New Address</span>
              </button>
            )}
          </div>
        </DashboardPanel>
      )}

      {activeTab === "payments" && (
        <DashboardPanel className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <CustomerStat
              label="Lifetime Spend"
              value={rupees(totalSpent)}
              icon={<Wallet className="text-emerald-600" />}
              color="bg-emerald-50"
            />
            <CustomerStat
              label="Saved Methods"
              value={String(profile?.paymentMethods.length ?? 0).padStart(2, "0")}
              icon={<CreditCard className="text-blue-600" />}
              color="bg-blue-50"
            />
            <CustomerStat
              label="Orders Placed"
              value={String(orders.length).padStart(2, "0")}
              icon={<ArrowUpRight className="text-orange-600" />}
              color="bg-orange-50"
            />
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex flex-wrap justify-between items-center gap-3">
              <h3 className="font-bold text-lg text-slate-800">Saved Payment Methods</h3>
              <details className="relative">
                <summary className="list-none bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-emerald-700 transition-colors cursor-pointer">
                  + Add Method
                </summary>
                <ul className="absolute right-0 mt-2 w-64 bg-white rounded-2xl border border-slate-200 shadow-xl p-2 z-50">
                  {METHOD_CHOICES.map((choice) => (
                    <li key={choice.kind}>
                      <button
                        type="button"
                        onClick={() => addMethod(choice)}
                        className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors"
                      >
                        <span className="block text-sm font-bold text-slate-800">{choice.label}</span>
                        <span className="block text-xs text-slate-500">{choice.detail}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </details>
            </div>

            {!profile || profile.paymentMethods.length === 0 ? (
              <DashboardEmptyState
                icon={<CreditCard size={32} />}
                title="No saved payment methods"
                description="Add a card, UPI id or wallet to check out without re-entering details."
              />
            ) : (
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5 p-6">
                {profile.paymentMethods.map((method) => {
                  const Icon = METHOD_ICONS[method.kind] ?? CreditCard;
                  return (
                    <div
                      key={method.id}
                      className={`p-5 rounded-2xl border-2 transition-all duration-300 ${
                        method.isDefault
                          ? "border-emerald-600 bg-emerald-50/40"
                          : "border-slate-100 bg-white hover:border-slate-200"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="w-11 h-11 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-emerald-600 shrink-0">
                          <Icon size={20} />
                        </div>
                        {method.isDefault && (
                          <span className="bg-emerald-600 text-white text-[10px] font-black px-2 py-1 rounded-lg uppercase shrink-0">
                            Default
                          </span>
                        )}
                      </div>
                      <p className="font-black text-slate-900">{method.label}</p>
                      <p className="text-sm text-slate-500 mt-0.5">{method.detail}</p>
                      <div className="flex gap-4 mt-4">
                        <button
                          type="button"
                          onClick={() => makeDefaultMethod(method.id)}
                          disabled={method.isDefault}
                          className="text-sm font-bold text-emerald-600 hover:underline disabled:text-slate-300 disabled:no-underline disabled:hover:no-underline"
                        >
                          Make default
                        </button>
                        <button
                          type="button"
                          onClick={() => removeMethod(method.id)}
                          className="text-sm font-bold text-slate-400 hover:text-red-500 transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center gap-2">
              <ShieldCheck size={20} className="text-emerald-600" />
              <h3 className="font-bold text-lg text-slate-800">Payment History</h3>
            </div>

            {orders.length === 0 ? (
              <DashboardEmptyState
                icon={<CreditCard size={32} />}
                title="No payments yet"
                description="Once you complete your first order, every transaction will be listed here."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                      <th className="px-6 py-4">Transaction</th>
                      <th className="px-6 py-4">Order</th>
                      <th className="px-6 py-4">Farms</th>
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4">Amount</th>
                      <th className="px-6 py-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 font-medium">
                    {orders.map((order) => (
                      <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 py-4 font-mono text-xs text-slate-400">
                          PM-{order.id.replace(/\D/g, "")}
                        </td>
                        <td className="px-6 py-4 font-bold text-slate-900">{order.id}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {[...new Set(order.items.map((item) => item.farmer))].join(", ")}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500">
                          {formatDate(order.placedAt)}
                        </td>
                        <td className="px-6 py-4 font-black text-slate-900">{rupees(order.total)}</td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-2 py-1 rounded-md text-[10px] font-black uppercase ${
                              order.status === "Delivered"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {order.status === "Delivered" ? "Paid" : "Processing"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </DashboardPanel>
      )}
    </DashboardShell>
  );
}

function ReviewForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (rating: number, comment: string) => void;
  onCancel: () => void;
}) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  return (
    <div className="mt-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
      <p className="text-sm font-bold text-slate-800 mb-2">How was your delivery?</p>
      <div className="flex gap-1 mb-3">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setRating(value)}
            aria-label={`${value} star${value === 1 ? "" : "s"}`}
            aria-pressed={rating === value}
            className="p-1"
          >
            <Star
              size={22}
              className={value <= rating ? "text-amber-500" : "text-slate-300"}
              fill="currentColor"
            />
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        rows={2}
        placeholder="Anything you want the agent to know? (optional)"
        aria-label="Delivery feedback"
        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
      />
      <div className="flex gap-4 mt-3">
        <button
          type="button"
          onClick={() => onSubmit(rating, comment)}
          className="text-sm font-bold text-emerald-700 hover:underline"
        >
          Submit rating
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

type CustomerStatProps = {
  label: string;
  value: string;
  icon: ReactNode;
  color: string;
};

function CustomerStat({ label, value, icon, color }: CustomerStatProps) {
  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
      <div className={`p-4 rounded-2xl shrink-0 ${color}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-slate-500 text-sm font-bold uppercase tracking-wider truncate">{label}</p>
        <h4 className="text-3xl font-black text-slate-900">{value}</h4>
      </div>
    </div>
  );
}

type AddressCardProps = {
  type: string;
  address: string;
  isDefault?: boolean;
  editing: boolean;
  draft: string;
  labelDraft: string;
  onDraftChange: (value: string) => void;
  onLabelChange: (value: string) => void;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onRemove: () => void;
};

function AddressCard({
  type,
  address,
  isDefault,
  editing,
  draft,
  labelDraft,
  onDraftChange,
  onLabelChange,
  onEdit,
  onSave,
  onCancel,
  onRemove,
}: AddressCardProps) {
  const isNew = address === "";

  return (
    <div
      className={`p-6 rounded-3xl border-2 transition-all ${
        isDefault ? "border-emerald-600 bg-emerald-50/30" : "border-slate-100 bg-white"
      }`}
    >
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <MapPin className={isDefault ? "text-emerald-600" : "text-slate-400"} size={20} />
          <span className="font-black text-slate-900 text-lg">
            {isNew ? labelDraft || type : type}
          </span>
        </div>
        {isDefault && (
          <span className="bg-emerald-600 text-white text-[10px] font-black px-2 py-1 rounded-lg uppercase">
            Default
          </span>
        )}
      </div>

      {editing ? (
        <div className="mb-4 space-y-3">
          <input
            value={labelDraft}
            onChange={(event) => onLabelChange(event.target.value)}
            placeholder="Label (Home, Office…)"
            aria-label="Address label"
            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <textarea
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            rows={3}
            aria-label={`Edit ${type} address`}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-600 leading-relaxed outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
          />
          <div className="flex gap-4">
            <button
              type="button"
              onClick={onSave}
              disabled={!draft.trim()}
              className="text-sm font-bold text-emerald-600 hover:underline disabled:text-slate-300 disabled:no-underline"
            >
              Save
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-slate-600 leading-relaxed mb-6 font-medium">
            {address || "No address saved yet."}
          </p>
          <div className="flex gap-4">
            <button type="button" onClick={onEdit} className="text-sm font-bold text-emerald-600 hover:underline">
              Edit
            </button>
            {!isNew && (
              <button
                type="button"
                onClick={onRemove}
                className="text-sm font-bold text-slate-400 hover:text-red-500 transition"
              >
                Remove
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}