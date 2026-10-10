"use client";

/**
 * The delivery agent dashboard.
 *
 * Every number on this screen used to be a module-level constant: two deliveries,
 * a week of earnings summing to a fixed ₹7,695, four payouts, a 4.92 rating from
 * 323 reviews, and a "Top 5% of Agents" badge. None of it was connected to the
 * orders customers placed, and the local `deliveries` state was discarded on
 * refresh, so completing a trip lost the work entirely.
 *
 * The queue is now the orders collection. Claiming, advancing and releasing all
 * write to the store, which means the farmer's order status, the customer's
 * tracking and this screen move together - and survive a reload.
 *
 * The palette matches the admin, farmer and customer dashboards: white cards on
 * a slate-50 page with emerald accents. This screen used to be the dark one out,
 * which made the four dashboards look like four different products.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  Truck,
  Package,
  MapPin,
  Clock,
  Navigation,
  Phone,
  AlertCircle,
  History,
  Settings,
  Power,
  Star,
  IndianRupee,
  CheckCircle,
  MessageSquare,
  Battery,
  ShieldCheck,
  Gauge,
  X,
} from "lucide-react";
import DashboardShell, {
  DashboardPanel,
  DashboardEmptyState,
} from "../../components/dashboard/DashboardShell";
import { useIsSessionReady, useSession } from "../../lib/useSession";
import { clearSession, sessionId } from "../../lib/session";
import {
  meanRating,
  orderItemCount,
  type Order,
  type Profile,
  type Vehicle,
} from "../../lib/types";
import { formatDate, rupees, tripPay } from "../../lib/pricing";
import {
  advanceOrder,
  claimOrder,
  profileFor,
  releaseOrder,
  updateProfile,
  useOrders,
  useReviews,
} from "../../lib/store";

/**
 * Labels for the steps that follow a claim. Claiming is its own action that
 * moves the order to "Assigned", so a claimed order shows "Start Pickup" and
 * then walks the shared ORDER_FLOW to Delivered.
 */
const ACTION_LABEL: Record<string, string> = {
  Assigned: "Start Pickup",
  "Picked up": "Start Delivery",
  "In Transit": "Complete Delivery",
};

const STATUS_TONE: Record<string, string> = {
  Placed: "bg-amber-100 text-amber-700",
  Assigned: "bg-amber-100 text-amber-700",
  "Picked up": "bg-emerald-100 text-emerald-700",
  "In Transit": "bg-blue-100 text-blue-700",
  Delivered: "bg-emerald-100 text-emerald-700",
};

const SAFETY_TIPS = [
  "Slow down on wet roads and leave double the braking distance.",
  "Keep produce crates covered so rain does not spoil the load.",
  "If visibility drops, pull over and wait under a safe shelter.",
];

const NAV = [
  { key: "active", label: "Current Tasks", icon: <Navigation size={18} /> },
  { key: "history", label: "Earning History", icon: <History size={18} /> },
  { key: "ratings", label: "Ratings & Reviews", icon: <Star size={18} /> },
  { key: "vehicle", label: "Vehicle Info", icon: <Settings size={18} /> },
];

const BRAND = (
  <div className="flex items-center gap-3">
    <span className="w-11 h-11 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-200 shrink-0">
      <Truck size={22} />
    </span>
    <span className="font-black text-xl tracking-tight uppercase truncate">
      AgriExpress
    </span>
  </div>
);

const CHART_TOOLTIP = {
  contentStyle: {
    borderRadius: "16px",
    border: "none",
    boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
  },
};

const EMPTY_VEHICLE: Vehicle = {
  number: "",
  make: "",
  model: "",
  year: "",
  insuranceValid: "",
  batteryHealth: "",
};

export default function DeliveryDashboard() {
  const [activeTab, setActiveTab] = useState("active");
  const [callingId, setCallingId] = useState<string | null>(null);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({});
  const [replies, setReplies] = useState<Record<string, string>>({});

  const router = useRouter();
  const session = useSession();
  const isSessionReady = useIsSessionReady();
  const orders = useOrders();
  const reviews = useReviews();

  const agentId = session ? sessionId(session) : null;
  const agentName = (isSessionReady ? session?.name : null) ?? "Agent";

  // The profile carries the on/off duty flag, so going offline here is visible to
  // the admin dashboard and survives a reload rather than living in React state
  // that resets on refresh.
  const profile: Profile = agentId
    ? profileFor(agentId, "delivery")
    : profileFor("", "delivery");
  const isOnline = profile.isOnline;

  const myOrders = useMemo(
    () => (agentId ? orders.filter((order) => order.agentId === agentId) : []),
    [orders, agentId],
  );

  /** Orders nobody has taken yet and that are still deliverable. */
  const openQueue = useMemo(
    () => orders.filter((order) => order.agentId === null && order.status !== "Delivered"),
    [orders],
  );

  const active = myOrders.filter((order) => order.status !== "Delivered");
  const completed = myOrders.filter((order) => order.status === "Delivered");

  const myReviews = useMemo(
    () =>
      agentId
        ? reviews
            .filter((review) => review.agentId === agentId)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        : [],
    [reviews, agentId],
  );

  const averageRating = meanRating(myReviews.map((review) => review.rating));

  const ratingBreakdown = useMemo(() => {
    const buckets = [1, 2, 3, 4, 5].map((stars) => ({
      stars,
      count: myReviews.filter((review) => review.rating === stars).length,
    }));
    return buckets.reverse();
  }, [myReviews]);

  /** Earnings come from payPerTrip, which was fixed at claim time from the trip. */
  const earningsByDay = useMemo(() => {
    const days: { day: string; amount: number; trips: number }[] = [];
    const now = new Date();

    for (let i = 6; i >= 0; i -= 1) {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);

      const trips = completed.filter((order) => {
        const at = new Date(order.deliveredAt ?? order.placedAt);
        return at >= start && at < end;
      });

      days.push({
        day: start.toLocaleDateString("en-IN", { weekday: "short" }),
        amount: trips.reduce((sum, order) => sum + order.payPerTrip, 0),
        trips: trips.length,
      });
    }

    return days;
  }, [completed]);

  const totalEarned = completed.reduce((sum, order) => sum + order.payPerTrip, 0);
  const totalTrips = completed.length;
  const weekEarned = earningsByDay.reduce((sum, day) => sum + day.amount, 0);
  const undeliveredPay = active.reduce((sum, order) => sum + order.payPerTrip, 0);

  const handleLogout = () => {
    clearSession();
    router.push("/");
  };

  const setOnline = (next: boolean) => {
    if (!agentId) return;
    updateProfile(agentId, "delivery", (previous) => ({
      ...previous,
      isOnline: next,
      // Duty status and the on/off toggle are the same fact; keeping only one of
      // them means the admin sees a suspended agent as on duty.
      accountStatus: next ? "On-Duty" : "Offline",
    }));
  };

  const claim = (orderId: string) => {
    if (!agentId) return;
    claimOrder(orderId, { id: agentId, name: agentName });
  };

  const sendReply = (id: string) => {
    const text = replyDraft[id]?.trim();
    if (!text) return;
    setReplies((prev) => ({ ...prev, [id]: text }));
    setReplyDraft((prev) => ({ ...prev, [id]: "" }));
    setReplyingId(null);
  };

  const callTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (callTimerRef.current !== null) {
        window.clearTimeout(callTimerRef.current);
      }
    };
  }, []);

  const callCustomer = (id: string) => {
    setCallingId(id);
    if (callTimerRef.current !== null) {
      window.clearTimeout(callTimerRef.current);
    }
    callTimerRef.current = window.setTimeout(() => {
      callTimerRef.current = null;
      setCallingId((current) => (current === id ? null : current));
    }, 2000);
  };

  const statusControl = (
    <div className="space-y-4">
      <div
        className={`flex items-center justify-between p-4 rounded-2xl border ${
          isOnline
            ? "bg-emerald-50 border-emerald-200"
            : "bg-slate-100 border-slate-200"
        }`}
      >
        <span
          className={`text-sm font-bold ${isOnline ? "text-emerald-600" : "text-slate-500"}`}
        >
          {isOnline ? "ONLINE" : "OFFLINE"}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={isOnline}
          aria-label="Toggle online status"
          onClick={() => setOnline(!isOnline)}
          className={`w-10 h-5 rounded-full relative transition-colors ${
            isOnline ? "bg-emerald-600" : "bg-slate-300"
          }`}
        >
          <div
            className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${
              isOnline ? "left-6" : "left-1"
            }`}
          />
        </button>
      </div>
      <button
        type="button"
        onClick={handleLogout}
        className="w-full flex items-center gap-3 p-3 text-red-500 hover:bg-red-50 rounded-xl transition-colors font-bold"
      >
        <Power size={18} /> Logout
      </button>
    </div>
  );

  return (
    <DashboardShell
      theme="light"
      brand={BRAND}
      title="Drive Dashboard"
      subtitle={`Welcome back, ${agentName.split(" ")[0]}. Ready for your shift?`}
      nav={NAV}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      sidebarFooter={statusControl}
    >
      {activeTab === "active" &&
        (!isOnline ? (
          <DashboardPanel>
            <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-12 sm:p-20 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6">
                <Power size={40} className="text-slate-400" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">
                You are currently Offline
              </h2>
              <p className="text-slate-500 max-w-xs">
                Switch to online to start receiving delivery requests in your
                area.
              </p>
              <button
                onClick={() => setOnline(true)}
                className="mt-8 bg-emerald-600 text-white px-8 py-3 rounded-xl font-black hover:bg-emerald-700 active:scale-95 transition-all duration-300"
              >
                GO ONLINE
              </button>
            </div>
          </DashboardPanel>
        ) : (
          <DashboardPanel className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <StatCard
                label="My Active Trips"
                value={String(active.length)}
                sub={`${active.reduce((sum, order) => sum + orderItemCount(order), 0)} items to carry`}
                icon={<Navigation />}
              />
              <StatCard
                label="Open Queue"
                value={String(openQueue.length)}
                sub="Waiting to be claimed"
                icon={<Package />}
              />
              <StatCard
                label="Pending Earnings"
                value={rupees(undeliveredPay)}
                sub="Credited once delivered"
                icon={<IndianRupee />}
              />
            </div>

            <div className="lg:col-span-2 space-y-6">
              <h3 className="font-bold text-xl text-slate-900 flex items-center gap-2">
                <Clock className="text-emerald-600" size={20} /> My Active Trips
              </h3>

              {active.length === 0 ? (
                <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl">
                  <DashboardEmptyState
                    tone="light"
                    icon={<CheckCircle size={32} className="text-emerald-600" />}
                    title="No active deliveries"
                    description="You are online and in the queue. Claim a request below to start a trip."
                  />
                </div>
              ) : (
                active.map((order) => (
                  <div
                    key={order.id}
                    className="bg-white border border-slate-100 shadow-sm rounded-3xl p-6 hover:border-emerald-300 transition-colors duration-300"
                  >
                    <div className="flex flex-col md:flex-row justify-between gap-6">
                      <div className="space-y-4 flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                          <span
                            className={`text-[10px] font-black px-2 py-1 rounded tracking-tighter uppercase ${
                              STATUS_TONE[order.status] ?? "bg-emerald-100 text-emerald-700"
                            }`}
                          >
                            {order.status}
                          </span>
                          <span className="text-slate-400 text-sm font-medium">{order.id}</span>
                        </div>

                        <div>
                          <h4 className="text-xl font-bold text-slate-900">
                            {order.customerName}
                          </h4>
                          <div className="flex items-start gap-2 text-slate-600 mt-2">
                            <MapPin size={16} className="mt-1 shrink-0 text-slate-400" />
                            <p className="text-sm">{order.shipping.address}</p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-6 pt-2">
                          <div className="flex items-center gap-2 text-sm font-bold text-slate-600">
                            <Package size={14} className="text-orange-500" />{" "}
                            {orderItemCount(order)} Items
                          </div>
                          <div className="flex items-center gap-2 text-sm font-bold text-slate-600">
                            <Clock size={14} className="text-emerald-600" />{" "}
                            Placed {formatDate(order.placedAt)}
                          </div>
                        </div>

                        {/* Pickup points. A delivery agent has to collect from
                            every farm in the order, not just drop it off, so the
                            farms are named rather than implied. */}
                        <ul className="space-y-1 pt-1">
                          {[...new Set(order.items.map((item) => item.farmer))].map((farm) => (
                            <li
                              key={farm}
                              className="text-xs text-slate-500 flex items-center gap-2"
                            >
                              <Navigation size={12} className="text-emerald-600 shrink-0" />
                              Collect from {farm}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="flex flex-col justify-between items-end gap-4">
                        <div className="text-right">
                          <p className="text-xs font-bold text-slate-400 uppercase">
                            Trip Pay
                          </p>
                          <p className="text-2xl font-black text-slate-900">
                            {rupees(order.payPerTrip)}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <a
                            href={`tel:${order.shipping.phone}`}
                            onClick={() => callCustomer(order.id)}
                            aria-label={`Call ${order.customerName}`}
                            title={`Call ${order.customerName}`}
                            className="p-3 bg-slate-100 hover:bg-slate-200 rounded-2xl text-slate-600 transition-colors min-w-[52px] flex items-center justify-center"
                          >
                            {callingId === order.id ? (
                              <span className="text-[10px] font-black uppercase">
                                Calling
                              </span>
                            ) : (
                              <Phone size={20} />
                            )}
                          </a>
                          {/* Release returns the trip to the shared queue for
                              another agent. */}
                          <button
                            type="button"
                            onClick={() => releaseOrder(order.id)}
                            aria-label={`Release ${order.id} back to the queue`}
                            title="Release back to queue"
                            className="p-3 bg-slate-100 hover:bg-slate-200 rounded-2xl text-slate-600 transition-colors flex items-center justify-center"
                          >
                            <X size={20} />
                          </button>
                          <button
                            type="button"
                            onClick={() => advanceOrder(order.id)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-2xl font-bold text-sm active:scale-95 transition-all duration-300"
                          >
                            {ACTION_LABEL[order.status] ?? "Continue"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="grid lg:grid-cols-2 gap-8">
              <div className="bg-emerald-600 rounded-3xl p-6 text-white relative overflow-hidden">
                <div className="relative z-10">
                  <p className="text-emerald-100 text-sm font-bold opacity-80 mb-1">
                    Your Rating
                  </p>
                  <h3 className="text-4xl font-black mb-4">
                    {myReviews.length === 0 ? "—" : `${averageRating} / 5`}
                  </h3>
                  {/* The bar width is the real mean, so it cannot claim a
                      "94%" that no review supports. */}
                  <div className="bg-white/20 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-white h-full transition-all duration-700"
                      style={{ width: `${(averageRating / 5) * 100}%` }}
                    />
                  </div>
                  <p className="text-[10px] mt-2 font-bold uppercase tracking-widest text-emerald-100">
                    {myReviews.length === 0
                      ? "No reviews yet"
                      : `Based on ${myReviews.length} delivered orders`}
                  </p>
                </div>
                <Star className="absolute -bottom-4 -right-4 w-32 h-32 text-white/10 rotate-12" />
              </div>

              <div className="bg-white border border-slate-100 shadow-sm rounded-3xl p-6">
                <h4 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <AlertCircle size={18} className="text-amber-500" /> Rain Advisory
                </h4>
                {/* Weather has no data source here, so the copy is honest about
                    being general guidance rather than a live alert about a
                    named sector. */}
                <p className="text-sm text-slate-500 leading-relaxed">
                  Heavy rain slows traffic on city roads. Drive slowly, keep
                  produce crates covered, and allow extra braking distance.
                </p>
                <button
                  type="button"
                  onClick={() => setSafetyOpen((open) => !open)}
                  aria-expanded={safetyOpen}
                  className="mt-4 text-xs font-black text-emerald-600 hover:underline"
                >
                  {safetyOpen ? "Hide Safety Protocols" : "View Safety Protocols"}
                </button>
                {safetyOpen && (
                  <ul className="mt-4 space-y-2 border-t border-slate-100 pt-4">
                    {SAFETY_TIPS.map((tip) => (
                      <li
                        key={tip}
                        className="flex gap-2 text-xs text-slate-500 leading-relaxed"
                      >
                        <ShieldCheck
                          size={14}
                          className="text-emerald-600 shrink-0 mt-0.5"
                        />
                        {tip}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* The claim queue. An order appears here the moment a customer's
                checkout creates it, which is the only place new work comes
                from. */}
            <div className="bg-white border border-slate-100 shadow-sm rounded-3xl overflow-hidden">
              <h3 className="p-6 border-b border-slate-100 font-bold text-slate-900 flex items-center gap-2">
                <Package size={18} className="text-emerald-600" /> Available Requests ·{" "}
                {openQueue.length}
              </h3>
              {openQueue.length === 0 ? (
                <DashboardEmptyState
                  tone="light"
                  icon={<CheckCircle size={32} />}
                  title="Queue is empty"
                  description="Every order that has been placed has been claimed by an agent."
                />
              ) : (
                <div className="divide-y divide-slate-100">
                  {[...openQueue]
                    .sort((a, b) => a.placedAt.localeCompare(b.placedAt))
                    .map((order: Order) => (
                      <div
                        key={order.id}
                        className="p-6 flex flex-col sm:flex-row gap-5 items-start sm:items-center justify-between hover:bg-slate-50 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-[10px] font-black px-2 py-1 rounded uppercase bg-amber-100 text-amber-700">
                              Unclaimed
                            </span>
                            <span className="text-xs text-slate-400 font-mono">
                              {order.id}
                            </span>
                          </div>
                          <p className="font-bold text-slate-900">{order.customerName}</p>
                          <p className="text-xs text-slate-500 mt-1 truncate">
                            {order.shipping.address}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            {orderItemCount(order)} items ·{" "}
                            {[...new Set(order.items.map((item) => item.farmer))].join(", ")}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {/*
                            The projected figure, not order.payPerTrip. Pay is
                            fixed when a trip is claimed, so every unclaimed order
                            carries 0 and showing that advertised the queue as
                            "₹0 pay" - the one number an agent needs in order to
                            decide whether to take the job.
                          */}
                          <span className="text-sm font-black text-emerald-600">
                            {rupees(tripPay(orderItemCount(order)))} pay
                          </span>
                          <button
                            type="button"
                            onClick={() => claim(order.id)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-2xl font-bold text-sm transition-all duration-300"
                          >
                            Claim Trip
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </DashboardPanel>
        ))}

      {activeTab === "history" && (
        <DashboardPanel className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <StatCard
              label="This Week"
              value={rupees(weekEarned)}
              sub="Across the last 7 days"
              icon={<IndianRupee />}
            />
            <StatCard
              label="Trips Completed"
              value={String(totalTrips)}
              sub={
                totalTrips === 0
                  ? "No completed trips yet"
                  : `${rupees(Math.round(totalEarned / totalTrips))} avg per trip`
              }
              icon={<Truck />}
            />
            <StatCard
              label="All Time Earned"
              value={rupees(totalEarned)}
              sub={`${rupees(undeliveredPay)} still pending`}
              icon={<CheckCircle />}
            />
          </div>

          <div className="bg-white border border-slate-100 shadow-sm rounded-3xl p-6 sm:p-8">
            <h3 className="font-black text-slate-800 uppercase tracking-wider text-sm mb-8">
              Daily Earnings
            </h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart data={earningsByDay}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="day"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#94a3b8", fontSize: 12 }}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#94a3b8", fontSize: 12 }}
                  />
                  <Tooltip
                    cursor={{ fill: "#f8fafc" }}
                    contentStyle={CHART_TOOLTIP.contentStyle}
                  />
                  <Bar
                    dataKey="amount"
                    fill="#10b981"
                    radius={[6, 6, 0, 0]}
                    barSize={40}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white border border-slate-100 shadow-sm rounded-3xl overflow-hidden">
            <h3 className="p-6 border-b border-slate-100 font-black text-slate-800 uppercase tracking-wider text-sm">
              Completed Trips
            </h3>
            {completed.length === 0 ? (
              <DashboardEmptyState
                tone="light"
                icon={<IndianRupee size={32} />}
                title="No payouts yet"
                description="Completing a delivery records it here with the trip pay fixed at claim time."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                      <th className="px-6 py-4">Order</th>
                      <th className="px-6 py-4">Customer</th>
                      <th className="px-6 py-4">Delivered</th>
                      <th className="px-6 py-4">Items</th>
                      <th className="px-6 py-4">Amount</th>
                      <th className="px-6 py-4">Rating</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 font-medium">
                    {[...completed]
                      .sort((a, b) =>
                        (b.deliveredAt ?? b.placedAt).localeCompare(a.deliveredAt ?? a.placedAt),
                      )
                      .map((order) => (
                        <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-6 py-4 font-mono text-xs text-slate-400">
                            {order.id}
                          </td>
                          <td className="px-6 py-4 font-bold text-slate-900">{order.customerName}</td>
                          <td className="px-6 py-4 text-slate-500">
                            {formatDate(order.deliveredAt ?? order.placedAt)}
                          </td>
                          <td className="px-6 py-4 text-slate-600">
                            {orderItemCount(order)}
                          </td>
                          <td className="px-6 py-4 font-black text-emerald-600">
                            {rupees(order.payPerTrip)}
                          </td>
                          <td className="px-6 py-4">
                            {order.rating === null ? (
                              <span className="text-[10px] font-black uppercase bg-slate-100 text-slate-500 px-2 py-1 rounded">
                                Unrated
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-emerald-600 font-black">
                                <Star size={12} fill="currentColor" />
                                {order.rating}
                              </span>
                            )}
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

      {activeTab === "ratings" && (
        <DashboardPanel className="space-y-8">
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="bg-emerald-600 rounded-3xl p-8 text-white relative overflow-hidden">
              <div className="relative z-10">
                <p className="text-emerald-100 text-sm font-bold opacity-80 mb-2">
                  Overall Rating
                </p>
                <h3 className="text-5xl font-black mb-3">
                  {myReviews.length === 0 ? "—" : averageRating}
                </h3>
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      size={18}
                      className="text-white"
                      // Grey out the stars the mean does not reach instead of
                      // always drawing five full stars.
                      fill={i < Math.round(averageRating) ? "currentColor" : "none"}
                      strokeWidth={i < Math.round(averageRating) ? 0 : 2}
                    />
                  ))}
                </div>
                <p className="text-sm text-emerald-100 font-bold">
                  {myReviews.length === 0
                    ? "No reviews yet"
                    : `Based on ${myReviews.length} deliveries`}
                </p>
              </div>
              <Star className="absolute -bottom-6 -right-6 w-40 h-40 text-white/10 rotate-12" />
            </div>

            <div className="lg:col-span-2 bg-white border border-slate-100 shadow-sm rounded-3xl p-6 sm:p-8">
              <h3 className="font-black text-slate-800 uppercase tracking-wider text-sm mb-6">
                Rating Breakdown
              </h3>
              {myReviews.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Ratings appear once customers review a delivery you completed.
                </p>
              ) : (
                <div className="space-y-3">
                  {ratingBreakdown.map((row) => {
                    const percent =
                      row.count === 0
                        ? 0
                        : Math.round((row.count / myReviews.length) * 100);
                    return (
                      <div key={row.stars} className="flex items-center gap-4">
                        <span className="flex items-center gap-1 text-sm font-bold text-slate-600 w-12 shrink-0">
                          {row.stars}
                          <Star size={13} className="text-amber-400" fill="currentColor" />
                        </span>
                        <div className="flex-1 h-2.5 rounded-full bg-slate-200 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-amber-400 transition-all duration-700"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-500 w-20 text-right shrink-0">
                          {row.count} · {percent}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-100 shadow-sm rounded-3xl overflow-hidden">
            <h3 className="p-6 border-b border-slate-100 font-black text-slate-800 uppercase tracking-wider text-sm flex items-center gap-2">
              <MessageSquare size={18} className="text-emerald-600" /> Recent Feedback
            </h3>
            {myReviews.length === 0 ? (
              <DashboardEmptyState
                tone="light"
                icon={<MessageSquare size={32} />}
                title="No feedback yet"
                description="Customer reviews will appear here after your first completed delivery."
              />
            ) : (
              <div className="divide-y divide-slate-100">
                {myReviews.map((review) => (
                  <div
                    key={review.id}
                    className="p-6 flex flex-col sm:flex-row gap-5 hover:bg-slate-50 transition-colors"
                  >
                    <div className="w-11 h-11 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-black shrink-0">
                      {review.customerName.split(" ").filter(Boolean)[0]?.[0] ?? "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-3 mb-1">
                        <p className="font-bold text-slate-900">{review.customerName}</p>
                        <div className="flex gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              size={13}
                              className={i < review.rating ? "text-amber-400" : "text-slate-300"}
                              fill="currentColor"
                            />
                          ))}
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 mb-2">
                        {formatDate(review.createdAt)} · {review.orderId}
                      </p>
                      <p className="text-sm text-slate-600 leading-relaxed">
                        {review.comment || "No written feedback."}
                      </p>
                      {replies[review.id] && (
                        <p className="mt-3 text-sm text-emerald-700 leading-relaxed border-l-2 border-emerald-200 pl-3">
                          <span className="font-bold">You:</span> {replies[review.id]}
                        </p>
                      )}
                      {replyingId === review.id && (
                        <div className="mt-3 flex flex-col sm:flex-row gap-2">
                          <input
                            type="text"
                            value={replyDraft[review.id] ?? ""}
                            onChange={(event) =>
                              setReplyDraft((prev) => ({
                                ...prev,
                                [review.id]: event.target.value,
                              }))
                            }
                            onKeyDown={(event) => {
                              if (event.key === "Enter") sendReply(review.id);
                            }}
                            placeholder="Write a reply..."
                            aria-label={`Reply to ${review.customerName}`}
                            className="flex-1 px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm text-slate-900 outline-none focus:border-emerald-500 transition-colors"
                          />
                          <button
                            type="button"
                            onClick={() => sendReply(review.id)}
                            disabled={!replyDraft[review.id]?.trim()}
                            className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-colors disabled:opacity-40"
                          >
                            Send
                          </button>
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setReplyingId((current) =>
                          current === review.id ? null : review.id,
                        )
                      }
                      aria-expanded={replyingId === review.id}
                      className="self-start text-xs font-black text-emerald-600 hover:underline shrink-0"
                    >
                      {replyingId === review.id ? "Cancel" : "Reply"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DashboardPanel>
      )}

      {activeTab === "vehicle" && (
        <DashboardPanel className="space-y-8">
          {/* Vehicle details are the agent's own, and they live in the profile so
              they are the same record the admin dashboard reads. The old screen
              hardcoded "HR 26 AB 4471" for whoever was signed in. */}
          <VehicleForm profile={profile} />

          <div className="bg-white border border-slate-100 shadow-sm rounded-3xl p-6 sm:p-8">
            <h3 className="font-black text-slate-800 uppercase tracking-wider text-sm mb-6">
              Registration Details
            </h3>
            <div className="grid sm:grid-cols-2 gap-6">
              <DetailRow label="Registration Number" value={profile.vehicle?.number} />
              <DetailRow label="Registered Owner" value={agentName} />
              <DetailRow label="Manufacturing Year" value={profile.vehicle?.year} />
              <DetailRow label="Insurance Valid Until" value={profile.vehicle?.insuranceValid} />
            </div>
          </div>
        </DashboardPanel>
      )}
    </DashboardShell>
  );
}

type StatCardProps = {
  label: string;
  value: string;
  sub: string;
  icon: ReactNode;
};

function StatCard({ label, value, sub, icon }: StatCardProps) {
  return (
    <div className="bg-white border border-slate-100 shadow-sm rounded-3xl p-6 transition-all duration-300 hover:-translate-y-1 hover:border-emerald-300">
      <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-4">
        {icon}
      </div>
      <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">{label}</p>
      <h3 className="text-2xl font-black text-slate-900 mt-1">{value}</h3>
      <p className="text-[10px] text-slate-400 mt-1 font-medium">{sub}</p>
    </div>
  );
}

type DetailRowProps = {
  label: string;
  value?: string;
};

function DetailRow({ label, value }: DetailRowProps) {
  return (
    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">
        {label}
      </p>
      <p className="font-bold text-slate-900">{value?.trim() || "Not set"}</p>
    </div>
  );
}

function VehicleForm({ profile }: { profile: Profile }) {
  const vehicle = profile.vehicle ?? EMPTY_VEHICLE;

  const setField = (field: keyof Vehicle, value: string) => {
    if (!profile.userId) return;
    updateProfile(profile.userId, "delivery", (previous) => {
      const current = previous.vehicle ?? EMPTY_VEHICLE;
      return { ...previous, vehicle: { ...current, [field]: value } };
    });
  };

  const fields: [keyof Vehicle, string, string][] = [
    ["number", "Registration Number", "HR 26 AB 4471"],
    ["make", "Make", "Hero"],
    ["model", "Model", "Optima 100"],
    ["year", "Year", "2023"],
    ["insuranceValid", "Insurance valid until", "14 Mar 2027"],
    ["batteryHealth", "Battery health (%)", "87"],
  ];

  return (
    <div className="bg-white border border-slate-100 shadow-sm rounded-3xl p-6 sm:p-8">
      <h3 className="font-black text-slate-800 uppercase tracking-wider text-sm mb-1">
        Vehicle Details
      </h3>
      <p className="text-xs text-slate-500 mb-6">
        Saved to your profile, so the admin dashboard shows the same vehicle.
      </p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {fields.map(([field, label, placeholder]) => (
          <label key={field} className="block">
            <span className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
              {label}
            </span>
            <input
              type="text"
              value={vehicle[field]}
              onChange={(event) => setField(field, event.target.value)}
              placeholder={placeholder}
              className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm text-slate-900 outline-none focus:border-emerald-500 transition-colors"
            />
          </label>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-8">
        <StatCard
          label="Vehicle"
          value={vehicle.make && vehicle.model ? `${vehicle.make} ${vehicle.model}` : "Not set"}
          sub={vehicle.number || "No registration"}
          icon={<Truck />}
        />
        <StatCard
          label="Battery Health"
          value={vehicle.batteryHealth ? `${vehicle.batteryHealth}%` : "Not set"}
          sub={vehicle.insuranceValid ? `Insurance to ${vehicle.insuranceValid}` : "No insurance date"}
          icon={<Battery />}
        />
      </div>
      <p className="mt-6 text-[10px] text-slate-400 flex items-center gap-2">
        <Gauge size={12} />
        Top speed and permit records are not tracked by this build.
      </p>
    </div>
  );
}
