"use client";

/**
 * The admin dashboard.
 *
 * This screen used to be four invented tables (F-101 Green Valley Farms with 12
 * products, C-503 Karthik Nair with 28 orders, D-903 Imran Qureshi with a 4.9
 * rating) and a stat row reading ₹6.8L / 85 farmers / 24 agents / 1.2k orders.
 * Adding a farmer from here produced a row that could not sign in, and nothing
 * counted below was connected to the store.
 *
 * Every row is now a real account from the directory, so a farmer who registers
 * on the login page appears here without a reload, and "Remove" hides their
 * listings rather than deleting orders that already happened.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  Users,
  ShoppingBag,
  IndianRupee,
  MoreVertical,
  Search,
  Bell,
  X,
  ShieldCheck,
  UserX,
  UserCheck,
  Truck,
  Sprout,
  LayoutDashboard,
  LogOut,
  Check,
  KeyRound,
} from "lucide-react";
import DashboardShell, {
  DashboardPanel,
  DashboardEmptyState,
} from "../../components/dashboard/DashboardShell";
import { useIsSessionReady, useSession } from "../../lib/useSession";
import { clearSession, type Role, type StoredUser } from "../../lib/session";
import {
  meanRating,
  HEALTHY_STATUS,
  INITIAL_STATUS,
  RESTORE_STATUS,
  type AccountStatus,
  type Order,
  type Product,
  type Profile,
} from "../../lib/types";
import { formatDate, rupees } from "../../lib/pricing";
import {
  provisionAccount,
  removeAccount,
  setAccountStatus,
  updateProfile,
  useOrders,
  useProducts,
  useProfiles,
  useReviews,
  useUsers,
} from "../../lib/store";
import { useRouter } from "next/navigation";

type ManageType = "farmers" | "customers" | "delivery";

const MANAGED: Record<
  ManageType,
  { role: Role; noun: string; plural: string; activity: string }
> = {
  farmers: { role: "farmer", noun: "farmer", plural: "farmers", activity: "products" },
  customers: {
    role: "customer",
    noun: "customer",
    plural: "customers",
    activity: "orders",
  },
  delivery: {
    role: "delivery",
    noun: "agent",
    plural: "agents",
    activity: "deliveries",
  },
};

/** Statuses that mean an account is working normally. */
/**
 * The statuses that count as "operating normally", one per role. Read from
 * HEALTHY_STATUS rather than a flat list of all three good-looking strings,
 * which had the bug that any role could be shown as healthy on another's status.
 */
const isHealthyStatus = (role: Role, status: AccountStatus) =>
  status === HEALTHY_STATUS[role];

const NAV = [
  { key: "overview", label: "Overview", icon: <LayoutDashboard size={18} /> },
  { key: "orders", label: "Orders", icon: <ShoppingBag size={18} /> },
  { key: "farmers", label: "Manage Farmers", icon: <Sprout size={18} /> },
  { key: "customers", label: "Manage Customers", icon: <Users size={18} /> },
  { key: "delivery", label: "Delivery Agents", icon: <Truck size={18} /> },
];

const BRAND = (
  <div className="flex items-center gap-3">
    <span className="bg-emerald-500 p-2 rounded-lg text-slate-950 shrink-0">
      <ShieldCheck size={20} />
    </span>
    <span className="font-black text-xl tracking-tight truncate">
      AgriAdmin
    </span>
  </div>
);

type Row = {
  id: string;
  name: string;
  /** Farm name for farmers, vehicle for agents, location or email otherwise. */
  detail: string;
  activity: string;
  status: AccountStatus;
  email: string;
};

/**
 * The status an account holds when it has no profile yet. INITIAL_STATUS is the
 * same map the store creates a profile from, so an account shows one status here
 * and on its dashboard instead of two.
 */
const DEFAULT_STATUS: Record<Role, AccountStatus> = INITIAL_STATUS;

/**
 * Every managed role is created with a name and an email, because those are what
 * an account needs in order to sign in at all. Only a farmer has a third field
 * here: the farm name, which is free text in the profile. An agent's vehicle is a
 * structured record, so the agent fills that in on their own dashboard rather
 * than the admin guessing at it.
 */
const ADD_FIELDS: Record<ManageType, { key: string; label: string; placeholder: string }[]> = {
  farmers: [
    { key: "name", label: "Owner name", placeholder: "Ravi Anand" },
    { key: "email", label: "Email", placeholder: "ravi@example.com" },
    { key: "detail", label: "Farm name", placeholder: "Sunrise Fields" },
  ],
  customers: [
    { key: "name", label: "Customer name", placeholder: "Neha Verma" },
    { key: "email", label: "Email", placeholder: "neha@example.com" },
  ],
  delivery: [
    { key: "name", label: "Agent name", placeholder: "Ravi Kumar" },
    { key: "email", label: "Email", placeholder: "ravi@example.com" },
  ],
};

/**
 * Builds one management table out of the store.
 *
 * The activity column is derived rather than typed in: a farmer's live listings,
 * a customer's orders and lifetime spend, an agent's completed deliveries and
 * mean rating. The old table carried these as literals (28 orders, 4.9★) that
 * never changed, which is why the admin figures disagreed with the farmer and
 * delivery dashboards about the same accounts.
 */
function buildRows(
  type: ManageType,
  users: StoredUser[],
  profiles: Profile[],
  products: Product[],
  orders: Order[],
): Row[] {
  const { role } = MANAGED[type];

  return users
    .filter((user) => user.role === role)
    .map((user) => {
      const profile = profiles.find((candidate) => candidate.userId === user.id);

      let activity = "0";
      let detail = user.email;

      if (role === "farmer") {
        const listings = products.filter(
          (product) => product.farmerId === user.id && !product.hidden,
        );
        activity = `${listings.length} Products`;
        detail = profile?.farmName?.trim() || "Farm name not set";
      } else if (role === "customer") {
        const theirs = orders.filter((order) => order.customerId === user.id);
        // One checkout can split into several orders, so spend is summed over
        // every order the customer placed.
        const spend = theirs.reduce((sum, order) => sum + order.total, 0);
        activity = `${theirs.length} Orders · ${rupees(spend)}`;
        detail = profile?.location?.trim() || user.email;
      } else {
        const theirs = orders.filter((order) => order.agentId === user.id);
        const done = theirs.filter((order) => order.status === "Delivered");
        // Only orders the customer actually rated, so an unrated delivery does
        // not drag the mean toward zero.
        const ratings = theirs
          .map((order) => order.rating)
          .filter((rating): rating is number => rating !== null);
        const vehicle = profile?.vehicle;
        detail = vehicle
          ? `${vehicle.make} ${vehicle.model}`.trim() || vehicle.number || "Vehicle not set"
          : "Vehicle not set";
        activity =
          done.length === 0
            ? "0 Deliveries"
            : `${done.length} Deliveries${ratings.length === 0 ? "" : ` · ${meanRating(ratings)}★`}`;
      }

      return {
        id: user.id,
        name: user.name,
        detail,
        activity,
        status: profile?.accountStatus ?? DEFAULT_STATUS[role],
        email: user.email,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [manageType, setManageType] = useState<ManageType>("farmers");
  const [query, setQuery] = useState("");
  const [openRowMenu, setOpenRowMenu] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [addError, setAddError] = useState<string | null>(null);
  /** A provisioned password, shown once so the admin can hand it over. */
  const [issued, setIssued] = useState<{ email: string; password: string } | null>(null);

  const session = useSession();
  const isSessionReady = useIsSessionReady();
  const router = useRouter();

  const users = useUsers();
  const profiles = useProfiles();
  const products = useProducts();
  const orders = useOrders();
  const reviews = useReviews();

  const initials =
    (isSessionReady ? session?.name : null)
      ?.split(" ")
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "AD";

  const handleLogout = () => {
    clearSession();
    router.push("/");
  };

  // A row menu or the notification popover are both dismissible layers, so a
  // click anywhere outside or an Escape press has to collapse them.
  useEffect(() => {
    if (!openRowMenu && !notificationsOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpenRowMenu(null);
      setNotificationsOpen(false);
    };

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-menu-root]")) return;
      setOpenRowMenu(null);
      setNotificationsOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [openRowMenu, notificationsOpen]);

  const rowsByType = useMemo(
    () =>
      ({
        farmers: buildRows("farmers", users, profiles, products, orders),
        customers: buildRows("customers", users, profiles, products, orders),
        delivery: buildRows("delivery", users, profiles, products, orders),
      }) as Record<ManageType, Row[]>,
    [users, profiles, products, orders],
  );

  const rows = rowsByType[manageType];
  const { noun, plural } = MANAGED[manageType];

  const pendingFarmers = rowsByType.farmers.filter((row) => row.status === "Pending").length;
  // A new delivery agent is created Pending and cannot use the site until the
  // admin approves them, so they belong in the same attention count as farmers.
  const pendingAgents = rowsByType.delivery.filter((row) => row.status === "Pending").length;
  const pendingApprovals = pendingFarmers + pendingAgents;

  const suspendedByType = useMemo(() => {
    const count = (type: ManageType) =>
      rowsByType[type].filter((row) => row.status === "Suspended").length;
    return { farmers: count("farmers"), customers: count("customers"), delivery: count("delivery") };
  }, [rowsByType]);

  const suspendedCount =
    suspendedByType.farmers + suspendedByType.customers + suspendedByType.delivery;

  const SUSPENDED_LABEL: Record<ManageType, string> = {
    farmers: "farm",
    customers: "customer",
    delivery: "agent",
  };

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      [row.id, row.name, row.email, row.detail, row.activity, row.status]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [rows, query]);

  // ---- derived overview -----------------------------------------------------

  const farmerAccounts = rowsByType.farmers.length;
  const onDutyAgents = rowsByType.delivery.filter((row) => row.status === "On-Duty").length;
  const platformOrders = orders.length;
  // Grouped by groupId: a mixed checkout paid once should count once.
  const checkouts = new Set(orders.map((order) => order.groupId)).size;
  const revenue = orders
    .filter((order) => order.status === "Delivered")
    .reduce((sum, order) => sum + order.total, 0);

  const revenueByMonth = useMemo(() => {
    const months: { label: string; revenue: number }[] = [];
    const now = new Date();

    for (let i = 5; i >= 0; i -= 1) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);

      const total = orders
        .filter((order) => order.status === "Delivered")
        .filter((order) => {
          const at = new Date(order.deliveredAt ?? order.placedAt);
          return at >= start && at < end;
        })
        .reduce((sum, order) => sum + order.total, 0);

      months.push({ label: start.toLocaleDateString("en-IN", { month: "short" }), revenue: total });
    }

    return months;
  }, [orders]);

  const pendingReviews = reviews.filter((review) => review.rating <= 3).length;

  // ---- actions --------------------------------------------------------------

  const updateStatus = (row: Row, status: AccountStatus) => {
    setAccountStatus(row.id, MANAGED[manageType].role, status);
  };

  const toggleSuspend = (row: Row) => {
    const role = MANAGED[manageType].role;
    // Reinstating returns the account to the status that means "working
    // normally" for its own role, read from RESTORE_STATUS in lib/types rather
    // than from a copy made here. That map used to be duplicated, which meant a
    // farmer reinstated on one build could come back Verified while the storefront
    // gate expected something else.
    updateStatus(row, row.status === "Suspended" ? RESTORE_STATUS[role] : "Suspended");
  };

  const removeRow = (row: Row) => {
    removeAccount(row.id, MANAGED[manageType].role);
    setOpenRowMenu(null);
  };

  const selectManageType = (type: ManageType) => {
    setManageType(type);
    setActiveTab(type);
    setQuery("");
    setAdding(false);
    setDraft({});
    setAddError(null);
    setOpenRowMenu(null);
  };

  const handleTabChange = (key: string) => {
    setAdding(false);
    setDraft({});
    setAddError(null);

    if (key === "overview" || key === "orders") {
      setActiveTab(key);
      setOpenRowMenu(null);
      return;
    }
    if (key in MANAGED) selectManageType(key as ManageType);
  };

  const submitAdd = (event: React.FormEvent) => {
    event.preventDefault();
    const { role } = MANAGED[manageType];

    const name = draft.name?.trim() ?? "";
    const email = draft.email?.trim() ?? "";

    if (!name) {
      setAddError("A name is required.");
      return;
    }
    if (!email) {
      setAddError("An email address is required.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setAddError("That email address does not look valid.");
      return;
    }

    // A new farmer starts Pending, and an agent starts Offline, so the row that
    // appears is already in the state the approval workflow expects.
    const result = provisionAccount({
      name,
      email,
      role,
      status: DEFAULT_STATUS[role],
    });
    if ("error" in result) {
      setAddError(result.error);
      return;
    }

    // Shown once and never again: it is not retrievable from the dashboard.
    setIssued({ email: result.account.email, password: result.password });

    // The farm name belongs in the profile, which is where the farmer dashboard
    // reads it. An agent's vehicle is a structured record the agent completes on
    // their own Vehicle tab, so nothing is invented for it here.
    const farmName = draft.detail?.trim() ?? "";
    if (role === "farmer" && farmName) {
      updateProfile(result.account.id, role, (previous) => ({
        ...previous,
        farmName,
      }));
    }

    setDraft({});
    setAddError(null);
    setAdding(false);
  };

  const copiedTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current !== null) {
        window.clearTimeout(copiedTimerRef.current);
      }
    };
  }, []);

  const copyId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
    } catch {
      return;
    }
    setCopiedId(id);
    if (copiedTimerRef.current !== null) {
      window.clearTimeout(copiedTimerRef.current);
    }
    copiedTimerRef.current = window.setTimeout(() => {
      copiedTimerRef.current = null;
      setCopiedId((current) => (current === id ? null : current));
    }, 1500);
  };

  const title =
    activeTab === "overview"
      ? "Executive Overview"
      : activeTab === "orders"
        ? "All Orders"
        : `Manage ${MANAGED[manageType].plural.charAt(0).toUpperCase()}${MANAGED[manageType].plural.slice(1)}`;

  const addFields = ADD_FIELDS[manageType];

  return (
    <DashboardShell
      theme="light"
      brand={BRAND}
      title={title}
      subtitle={`${rows.length} ${plural} in the directory`}
      nav={NAV}
      activeTab={activeTab}
      onTabChange={handleTabChange}
      sidebarFooter={
        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-sm text-red-500 hover:bg-rose-50 transition-colors"
        >
          <LogOut size={18} /> Logout
        </button>
      }
      headerRight={
        <>
          <div className="relative" data-menu-root>
            <button
              type="button"
              aria-label="Notifications"
              aria-expanded={notificationsOpen}
              onClick={() => {
                setNotificationsOpen((open) => !open);
                setOpenRowMenu(null);
              }}
              className="relative bg-white p-2.5 rounded-xl border border-slate-200 text-slate-600 shadow-sm hover:text-slate-900 transition-colors"
            >
              <Bell size={20} />
              {pendingApprovals + suspendedCount > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
              )}
            </button>

            {notificationsOpen && (
              <div className="absolute right-0 mt-3 w-72 bg-white rounded-2xl border border-slate-200 shadow-xl p-2 z-50">
                <p className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Notifications
                </p>
                {pendingApprovals + suspendedCount === 0 ? (
                  <p className="px-3 pb-3 text-sm text-slate-500">
                    You are all caught up.
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {pendingFarmers > 0 && (
                      <li>
                        <button
                          type="button"
                          onClick={() => {
                            selectManageType("farmers");
                            setNotificationsOpen(false);
                          }}
                          className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-amber-50 transition-colors"
                        >
                          <span className="block text-sm font-bold text-slate-800">
                            {pendingFarmers}{" "}
                            {pendingFarmers === 1 ? "farm" : "farms"} awaiting verification
                          </span>
                          <span className="block text-xs text-slate-500">
                            Approve them to let their listings trade.
                          </span>
                        </button>
                      </li>
                    )}
                    {pendingAgents > 0 && (
                      <li>
                        <button
                          type="button"
                          onClick={() => {
                            selectManageType("delivery");
                            setNotificationsOpen(false);
                          }}
                          className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-amber-50 transition-colors"
                        >
                          <span className="block text-sm font-bold text-slate-800">
                            {pendingAgents}{" "}
                            {pendingAgents === 1 ? "agent" : "agents"} awaiting approval
                          </span>
                          <span className="block text-xs text-slate-500">
                            Approve them before farmers can assign deliveries.
                          </span>
                        </button>
                      </li>
                    )}
                    {suspendedCount > 0 &&
                      (["farmers", "customers", "delivery"] as ManageType[])
                        .filter((type) => suspendedByType[type] > 0)
                        .map((type) => (
                          <li key={type}>
                            <button
                              type="button"
                              onClick={() => {
                                selectManageType(type);
                                setQuery("suspended");
                                setNotificationsOpen(false);
                              }}
                              className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-red-50 transition-colors"
                            >
                              <span className="block text-sm font-bold text-slate-800">
                                {suspendedByType[type]} suspended{" "}
                                {SUSPENDED_LABEL[type]}
                                {suspendedByType[type] === 1 ? "" : "s"}
                              </span>
                              <span className="block text-xs text-slate-500">
                                Reinstate or remove them.
                              </span>
                            </button>
                          </li>
                        ))}
                  </ul>
                )}
              </div>
            )}
          </div>
          <div className="w-10 h-10 bg-emerald-100 rounded-full border-2 border-white shadow-sm flex items-center justify-center font-bold text-emerald-700 shrink-0">
            {initials}
          </div>
        </>
      }
    >
      {issued && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-2xl p-5 flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
          <div className="flex items-start gap-3">
            <KeyRound size={20} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-900 text-sm">
                Account created for {issued.email}
              </p>
              <p className="text-amber-800 text-sm">
                Password:{" "}
                <code className="font-mono font-black bg-white px-2 py-0.5 rounded">
                  {issued.password}
                </code>{" "}
                — shown once, copy it now.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIssued(null)}
            className="text-amber-700 hover:text-amber-900 shrink-0"
            aria-label="Dismiss"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {activeTab === "overview" ? (
        <DashboardPanel className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              title="Delivered Revenue"
              value={rupees(revenue)}
              sub={`From ${orders.filter((o: Order) => o.status === "Delivered").length} completed orders`}
              icon={<IndianRupee />}
              color="bg-emerald-50"
            />
            <StatCard
              title="Farmers"
              value={String(farmerAccounts)}
              sub={`${pendingFarmers} awaiting approval`}
              icon={<Sprout />}
              color="bg-blue-50"
            />
              <StatCard
                title="Agents On-Duty"
                value={`${onDutyAgents}/${rowsByType.delivery.length}`}
                sub={`${rowsByType.delivery.length - onDutyAgents} offline · ${pendingAgents} pending`}
                icon={<Truck />}
                color="bg-orange-50"
              />
            <StatCard
              title="Platform Orders"
              value={String(platformOrders)}
              sub={`${checkouts} checkouts paid`}
              icon={<ShoppingBag />}
              color="bg-purple-50"
            />
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
              <h3 className="font-bold text-slate-800 mb-6">
                Delivered Revenue (Last 6 Months)
              </h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <AreaChart data={revenueByMonth}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="label"
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
                      contentStyle={{
                        borderRadius: "16px",
                        border: "none",
                        boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#10b981"
                      fill="#10b98130"
                      strokeWidth={3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
              <h3 className="font-bold text-slate-800">Needs attention</h3>
              <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4">
                <p className="text-2xl font-black text-amber-700">{pendingFarmers}</p>
                <p className="text-xs text-amber-800 font-bold mt-1">
                  Farms awaiting verification
                </p>
              </div>
              <div className="rounded-2xl bg-red-50 border border-red-100 p-4">
                <p className="text-2xl font-black text-red-700">{suspendedCount}</p>
                <p className="text-xs text-red-800 font-bold mt-1">Suspended accounts</p>
              </div>
              <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
                <p className="text-2xl font-black text-slate-700">{pendingReviews}</p>
                <p className="text-xs text-slate-600 font-bold mt-1">
                  Deliveries rated 3★ or lower
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
                <p className="text-2xl font-black text-slate-700">
                  {orders.filter((order) => order.agentId === null && order.status !== "Delivered").length}
                </p>
                <p className="text-xs text-slate-600 font-bold mt-1">Orders with no agent</p>
              </div>
            </div>
          </div>
        </DashboardPanel>
      ) : activeTab === "orders" ? (
        <DashboardPanel>
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <h3 className="p-6 border-b border-slate-100 font-black text-slate-800 uppercase tracking-wider text-sm">
              All Orders · {orders.length}
            </h3>
            {orders.length === 0 ? (
              <DashboardEmptyState
                icon={<ShoppingBag size={32} />}
                title="No orders yet"
                description="Orders appear here the moment a customer checks out, with the farm and assigned agent."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-left">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                      <th className="px-6 py-4">Order</th>
                      <th className="px-6 py-4">Customer</th>
                      <th className="px-6 py-4">Farm</th>
                      <th className="px-6 py-4">Items</th>
                      <th className="px-6 py-4">Agent</th>
                      <th className="px-6 py-4">Total</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Placed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 font-medium">
                    {[...orders]
                      .sort((a, b) => b.placedAt.localeCompare(a.placedAt))
                      .map((order) => (
                        <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-6 py-4 font-mono text-xs text-slate-400">{order.id}</td>
                          <td className="px-6 py-4 font-bold text-slate-900">{order.customerName}</td>
                          <td className="px-6 py-4 text-slate-600">
                            {[...new Set(order.items.map((item) => item.farmer))].join(", ")}
                          </td>
                          <td className="px-6 py-4 text-slate-600">
                            {order.items.reduce((sum, item) => sum + item.quantity, 0)}
                          </td>
                          <td className="px-6 py-4">
                            {order.agentName ?? (
                              <span className="text-xs font-black uppercase text-amber-600">
                                Unassigned
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 font-black text-slate-900">
                            {rupees(order.total)}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`px-2 py-1 rounded-md text-[10px] font-black uppercase ${
                                order.status === "Delivered"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : order.status === "Cancelled"
                                    ? "bg-red-100 text-red-700"
                                    : "bg-amber-100 text-amber-700"
                              }`}
                            >
                              {order.status}
                              {order.delayed ? " · Delayed" : ""}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-500">
                            {formatDate(order.placedAt)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </DashboardPanel>
      ) : (
        <DashboardPanel>
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row gap-4 justify-between">
              <div className="relative w-full md:w-96">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  size={18}
                />
                <input
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={`Search ${plural}...`}
                  aria-label={`Search ${plural}`}
                  className="w-full pl-10 pr-10 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    aria-label="Clear search"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setAdding((open) => !open);
                  setDraft({});
                  setAddError(null);
                  setOpenRowMenu(null);
                }}
                aria-expanded={adding}
                className="bg-emerald-600 text-white px-5 py-2 rounded-xl font-bold text-sm hover:bg-emerald-700 transition-colors self-start"
              >
                {adding ? "Cancel" : `+ Add New ${noun}`}
              </button>
            </div>

            {adding && (
              <form
                onSubmit={submitAdd}
                noValidate
                className="p-6 border-b border-slate-100 bg-emerald-50/40 grid sm:grid-cols-2 lg:grid-cols-4 gap-4 items-start"
              >
                {addFields.map((field) => (
                  <div key={field.key} className="block">
                    <label
                      htmlFor={`add-${manageType}-${field.key}`}
                      className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5"
                    >
                      {field.label}
                    </label>
                    <input
                      id={`add-${manageType}-${field.key}`}
                      type="text"
                      value={draft[field.key] ?? ""}
                      onChange={(event) => {
                        setDraft((prev) => ({ ...prev, [field.key]: event.target.value }));
                        if (addError) setAddError(null);
                      }}
                      placeholder={field.placeholder}
                      className="w-full px-3 py-2 rounded-xl border bg-white text-sm outline-none focus:ring-2 focus:ring-emerald-500 border-slate-200"
                    />
                  </div>
                ))}
                <div className="flex flex-col gap-2">
                  <button
                    type="submit"
                    className="bg-emerald-600 text-white px-5 py-2 rounded-xl font-bold text-sm hover:bg-emerald-700 transition-colors"
                  >
                    Create account
                  </button>
                  <p className="text-[10px] text-slate-500">
                    Creates a real sign-in. The password is generated and shown once.
                  </p>
                </div>
                {addError && (
                  <p role="alert" className="sm:col-span-2 lg:col-span-4 text-xs font-semibold text-rose-600">
                    {addError}
                  </p>
                )}
              </form>
            )}

            {filteredRows.length === 0 ? (
              <DashboardEmptyState
                icon={<Users size={32} />}
                title={
                  rows.length === 0
                    ? `No ${plural} registered yet`
                    : `No ${plural} match that search`
                }
                description={
                  rows.length === 0
                    ? `Accounts appear here as soon as they register on the login page, or use the add form.`
                    : `Nothing found for "${query}". Try a different name, email, status, or activity.`
                }
                action={
                  rows.length === 0 ? undefined : (
                    <button
                      type="button"
                      onClick={() => setQuery("")}
                      className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-emerald-700 transition-colors"
                    >
                      Clear search
                    </button>
                  )
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-left">
                  <thead>
                    <tr className="text-slate-400 text-xs uppercase tracking-widest border-b border-slate-100">
                      <th className="px-6 py-4">Identification</th>
                      <th className="px-6 py-4">Primary Info</th>
                      <th className="px-6 py-4">Activity</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredRows.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-bold text-slate-900 text-xs font-mono">{row.id}</p>
                          <p className="text-xs text-slate-400">{row.detail}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-semibold text-slate-800">{row.name}</p>
                          <p className="text-xs text-slate-500">{row.email}</p>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">{row.activity}</td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                              isHealthyStatus(
                                MANAGED[manageType].role,
                                row.status,
                              )
                                ? "bg-emerald-100 text-emerald-700"
                                : row.status === "Suspended"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {row.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                updateStatus(row, RESTORE_STATUS[MANAGED[manageType].role])
                              }
                              // Approving is only meaningful for an account that
                              // has not been approved yet. This ran on every row,
                              // so a tick on a suspended customer silently
                              // reinstated them without going through Reinstate.
                              //
                              // The target status comes from RESTORE_STATUS, and for
                              // a farmer that is Verified - which is the exact string
                              // the storefront gate checks. Approving now actually
                              // makes a farm's listings sellable.
                              disabled={row.status !== "Pending"}
                              aria-label={`Approve ${row.name}`}
                              title={
                                row.status === "Pending"
                                  ? `Approve and set to ${RESTORE_STATUS[MANAGED[manageType].role]}`
                                  : `Only pending accounts can be approved (this one is ${row.status})`
                              }
                              className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                            >
                              <UserCheck size={18} />
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleSuspend(row)}
                              aria-label={`${row.status === "Suspended" ? "Reinstate" : "Suspend"} ${row.name}`}
                              title={row.status === "Suspended" ? "Reinstate" : "Suspend"}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <UserX size={18} />
                            </button>
                            <div className="relative" data-menu-root>
                              <button
                                type="button"
                                onClick={() =>
                                  setOpenRowMenu((current) =>
                                    current === row.id ? null : row.id,
                                  )
                                }
                                aria-label={`More actions for ${row.name}`}
                                aria-expanded={openRowMenu === row.id}
                                title="More actions"
                                className="p-2 text-slate-400 hover:text-slate-700 rounded-lg transition-colors"
                              >
                                <MoreVertical size={18} />
                              </button>

                              {openRowMenu === row.id && (
                                <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-xl border border-slate-200 shadow-xl p-1 z-40 text-left">
                                  <button
                                    type="button"
                                    onClick={() => copyId(row.id)}
                                    className="w-full px-3 py-2 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors text-left flex items-center gap-2"
                                  >
                                    {copiedId === row.id ? (
                                      <>
                                        <Check size={14} /> Copied
                                      </>
                                    ) : (
                                      "Copy ID"
                                    )}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => removeRow(row)}
                                    className="w-full px-3 py-2 rounded-lg text-sm font-bold text-red-600 hover:bg-red-50 transition-colors text-left"
                                  >
                                    Remove account
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
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

type StatCardProps = {
  title: string;
  value: string;
  sub: string;
  icon: ReactNode;
  color: string;
};

function StatCard({ title, value, sub, icon, color }: StatCardProps) {
  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-2xl shrink-0 ${color}`}>{icon}</div>
      </div>
      <p className="text-slate-500 text-sm">{title}</p>
      <h4 className="text-2xl font-black text-slate-900 break-words">{value}</h4>
      <p className="text-[10px] text-slate-400 font-medium mt-1">{sub}</p>
    </div>
  );
}