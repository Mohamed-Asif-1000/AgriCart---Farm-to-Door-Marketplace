"use client";

/**
 * The farmer dashboard.
 *
 * This is the surface that proved the old architecture was broken rather than
 * merely untidy: the inventory was a local `useState` copy of five invented rows
 * with `"45 kg"` stock and `"₹40/kg"` prices, the charts were module-level
 * constants, and the four "direct buyers" had never bought anything. Adding a
 * product here changed a React state variable and nothing else - it did not
 * appear on the shop, and it could not be ordered.
 *
 * Everything below is derived from the store instead: the listings this account
 * owns, and the orders customers have actually placed against them. Revenue
 * counts only this farmer's own line items, so a shared order does not credit
 * another farm's produce.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent, ReactNode } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
import {
  Sprout,
  Store,
  IndianRupee,
  PackageCheck,
  TrendingUp,
  Plus,
  Search,
  X,
  MoreVertical,
  Leaf,
  AlertTriangle,
  LayoutDashboard,
  Box,
  Users,
  ShoppingBag,
  LogOut,
  AlertCircle,
  ImageIcon,
  Camera,
  Check,
} from "lucide-react";
import DashboardShell, {
  DashboardPanel,
  DashboardEmptyState,
} from "../../components/dashboard/DashboardShell";
import { useIsSessionReady, useSession } from "../../lib/useSession";
import { clearSession, sessionId } from "../../lib/session";
import {
  MAX_BIO_LENGTH,
  stockStatus,
  type Order,
  type Product,
} from "../../lib/types";
import { formatDate, rupees } from "../../lib/pricing";
import { ALL_IMAGES, CATEGORIES, IMAGE_LIBRARY, categoryTile } from "../../lib/catalog";
import { processFarmerPhoto } from "../../lib/farmerPhoto";
import {
  createProduct,
  hideProduct,
  syncFarmerIdentity,
  updateProduct,
  updateProfile,
  useOrders,
  useProducts,
  useProfiles,
} from "../../lib/store";

const NAV = [
  { key: "overview", label: "Overview", icon: <LayoutDashboard size={20} /> },
  { key: "inventory", label: "My Inventory", icon: <Box size={20} /> },
  { key: "sales", label: "Sales Reports", icon: <TrendingUp size={20} /> },
  { key: "buyers", label: "Direct Buyers", icon: <Users size={20} /> },
  { key: "profile", label: "Farm Profile", icon: <Camera size={20} /> },
];

const BRAND = (
  <div className="flex items-center gap-3">
    <span className="text-emerald-600 shrink-0">
      <Sprout size={28} strokeWidth={2.5} />
    </span>
    <span className="font-black text-xl tracking-tight truncate">FarmDirect</span>
  </div>
);

const CHART_TOOLTIP = {
  contentStyle: {
    borderRadius: "16px",
    border: "none",
    boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
  },
};

const UNITS = ["1kg", "500g", "250g", "1pc", "1 bunch", "1 dozen", "1L", "500ml", "12 pcs", "6 pcs"];

type Draft = {
  name: string;
  category: string;
  unit: string;
  price: string;
  stockQty: string;
  quality: string;
  image: string;
};

const EMPTY_DRAFT: Draft = {
  name: "",
  category: CATEGORIES[0],
  unit: UNITS[0],
  price: "",
  stockQty: "",
  quality: "",
  image: "",
};

/** Everything the Farm Profile tab and the sidebar card edit together. */
type FarmProfileDraft = {
  farmName: string;
  location: string;
  bio: string;
  photo: string;
};

/**
 * This farmer's cut of an order: their own line items, never the delivery fee.
 * Module-level and explicit about the owner id, so it can sit inside a useMemo
 * without becoming a dependency that changes on every render.
 */
function ownRevenue(order: Order, accountId: string | null) {
  if (!accountId) return 0;
  return order.items
    .filter((item) => item.farmerId === accountId)
    .reduce((sum, item) => sum + item.price * item.quantity, 0);
}

export default function FarmerDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [inventoryQuery, setInventoryQuery] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [openRowMenu, setOpenRowMenu] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // The farm profile form. Draft-first: the inputs bind to this rather than to
  // the stored profile, so typing is an ordinary state update instead of a
  // localStorage write per keystroke - and nothing is persisted until Save.
  const [profileDraft, setProfileDraft] = useState<FarmProfileDraft | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const savedTimer = useRef<number | null>(null);

  const session = useSession();
  const isSessionReady = useIsSessionReady();
  const router = useRouter();

  const accountId = session ? sessionId(session) : null;
  // Reactive, not profileFor(): a profile write only notifies components that
  // subscribe to the profiles collection, and this dashboard used to read the
  // profile once per render from storage - so a saved farm name or location
  // stayed invisible here until something unrelated caused a re-render.
  const profiles = useProfiles();
  const profile = accountId ? profiles.find((entry) => entry.userId === accountId) ?? null : null;
  const products = useProducts();
  const orders = useOrders();

  // The shell greeted "Green Valley Farm / Farmer Rajesh Kumar" regardless of
  // who was signed in. Read the name the login form stored, and let the farmer
  // set their own farm name in the profile below.
  const displayName = (isSessionReady ? session?.name : null) ?? "Farmer";
  const farmName = profile?.farmName?.trim() || displayName;

  const handleLogout = () => {
    // There was no logout at all on this dashboard: farmer and admin simply
    // never signed the user out.
    clearSession();
    router.push("/");
  };

  // Scoped to this account. Only listings this farmer owns are editable or
  // counted; the rest of the catalogue is someone else's.
  const ownProducts = useMemo(
    () => products.filter((product) => product.farmerId === accountId),
    [products, accountId],
  );

  /**
   * Orders containing at least one of this farmer's items. A checkout that mixed
   * two farms becomes two orders, so an order in this list may still hold other
   * farms' lines - which is why revenue below is computed from this farmer's
   * items only rather than from order.total.
   */
  const ownOrders = useMemo(() => {
    if (!accountId) return [];
    return orders.filter((order) => order.items.some((item) => item.farmerId === accountId));
  }, [orders, accountId]);

  const revenueByOrder = useMemo(
    () => new Map(ownOrders.map((order) => [order.id, ownRevenue(order, accountId)])),
    [ownOrders, accountId],
  );

  const totalRevenue = [...revenueByOrder.values()].reduce((sum, value) => sum + value, 0);

  const pendingOrders = ownOrders.filter((order) => order.status !== "Delivered");
  const liveListings = ownProducts.filter((product) => !product.hidden);

  // Whether customers can actually buy any of this farmer's produce. Own listings
  // are still listed and editable either way - a Pending farmer has to be able to
  // prepare the inventory that admin is about to approve - so this only drives
  // the warning, never the inventory count.
  const isPendingApproval = profile?.accountStatus !== "Verified";

  // Trimmed against the stored values, because that is what Save will write:
  // a draft with a stray trailing space counts as unchanged only after it has
  // been through the trim the save itself performs.
  const profileDirty =
    profileDraft !== null &&
    (profileDraft.farmName.trim() !== (profile?.farmName ?? "") ||
      profileDraft.location.trim() !== (profile?.location ?? "") ||
      profileDraft.bio.trim() !== (profile?.bio ?? "") ||
      profileDraft.photo !== (profile?.photo ?? ""));

  const lowStockCount = liveListings.filter(
    (product) => stockStatus(product.stockQty) !== "In Stock",
  ).length;

  // Mean of the ratings on this farmer's own listings. The old card read a
  // literal "4.8/5 · 120 Reviews", which was not derived from anything.
  const profileRating = useMemo(() => {
    const rated = ownProducts.filter((product) => product.rating > 0);
    if (rated.length === 0) return null;
    return Math.round((rated.reduce((sum, p) => sum + p.rating, 0) / rated.length) * 10) / 10;
  }, [ownProducts]);

  const filteredInventory = useMemo(() => {
    const query = inventoryQuery.trim().toLowerCase();
    return ownProducts.filter((product) => {
      if (!showHidden && product.hidden) return false;
      if (lowStockOnly && stockStatus(product.stockQty) === "In Stock") return false;
      if (!query) return true;
      return (
        product.name.toLowerCase().includes(query) ||
        product.id.toLowerCase().includes(query) ||
        stockStatus(product.stockQty).toLowerCase().includes(query) ||
        product.category.toLowerCase().includes(query)
      );
    });
  }, [ownProducts, inventoryQuery, lowStockOnly, showHidden]);

  useEffect(() => {
    if (!openRowMenu) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenRowMenu(null);
    };

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-menu-root]")) return;
      setOpenRowMenu(null);
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [openRowMenu]);

  /**
   * Seeds the draft from the stored profile once it is readable, and never
   * re-seeds: a profiles write happens on save, and overwriting an untouched
   * draft with it would be harmless - but overwriting one that is mid-edit
   * would discard whatever the farmer had just typed.
   */
  useEffect(() => {
    if (!profile || profileDraft !== null) return;
    setProfileDraft({
      farmName: profile.farmName ?? "",
      location: profile.location ?? "",
      bio: profile.bio ?? "",
      photo: profile.photo ?? "",
    });
  }, [profile, profileDraft]);

  useEffect(
    () => () => {
      if (savedTimer.current !== null) window.clearTimeout(savedTimer.current);
    },
    [],
  );

  const setStock = (product: Product, stockQty: number) => {
    updateProduct(product.id, { stockQty });
    setOpenRowMenu(null);
  };

  const submitAdd = (event: React.FormEvent) => {
    event.preventDefault();
    if (!accountId) return;

    const name = draft.name.trim();
    const price = draft.price.trim();
    const stockQty = draft.stockQty.trim();

    // Every invalid path used to hit the same bare `return`, so clicking
    // "Add Product" with an empty field looked like the app was frozen. Say
    // what is wrong instead.
    if (!name) {
      setFormError("Product name is required.");
      return;
    }
    if (!price) {
      setFormError("Unit price is required.");
      return;
    }
    if (!stockQty) {
      setFormError("Stock is required.");
      return;
    }
    // Price and stock are numbers in the Product type. Anything else would be
    // rejected by the store's validator and the listing would silently vanish
    // from the farmer's own table on the next read.
    if (!/^\d+(\.\d{1,2})?$/.test(price)) {
      setFormError("Price must be a number, for example 120 or 99.50.");
      return;
    }
    if (!/^\d+(\.\d{1,2})?$/.test(stockQty)) {
      setFormError("Stock must be a number, for example 25 or 12.5.");
      return;
    }
    if (Number(price) <= 0) {
      setFormError("Price must be greater than zero.");
      return;
    }
    if (Number(stockQty) <= 0) {
      setFormError("Stock must be greater than zero.");
      return;
    }

    // A listing with no photo renders as a broken image everywhere it is used,
    // so fall back to the category's own art rather than storing an empty path.
    const image = draft.image || categoryTile(draft.category);

    const saved = createProduct(
      {
        name,
        category: draft.category,
        unit: draft.unit,
        price: Number(price),
        stockQty: Number(stockQty),
        quality: draft.quality.trim() || "Grade A",
        image,
      },
      {
        id: accountId,
        // Denormalised onto every listing so the shop can render the farm name
        // without joining against the profile, and so a historic listing keeps
        // the name it was published under.
        farmName,
        location: profile?.location?.trim() || "India",
      },
    );

    if (!saved) {
      setFormError("This browser refused to save the listing. Check that site data is allowed.");
      return;
    }

    setDraft(EMPTY_DRAFT);
    setFormError(null);
    setAdding(false);
  };

  const saveFarmProfile = () => {
    if (!accountId || !profileDraft) return;

    const farmName = profileDraft.farmName.trim();
    const location = profileDraft.location.trim();
    const bio = profileDraft.bio.trim();

    if (farmName.length < 2) {
      setProfileError("Please enter your farm's name (at least 2 characters).");
      return;
    }
    if (location.length < 2) {
      setProfileError("Please enter the area you farm in (at least 2 characters).");
      return;
    }
    if (bio.length > MAX_BIO_LENGTH) {
      setProfileError(`The farm description must be under ${MAX_BIO_LENGTH} characters.`);
      return;
    }

    const saved = updateProfile(accountId, "farmer", (previous) => ({
      ...previous,
      farmName,
      location,
      // Empty means "not set", which is what the storefront renders as a
      // fallback - writing "" would put a blank string through the validator.
      bio: bio || undefined,
      photo: profileDraft.photo || undefined,
    }));

    if (!saved) {
      setProfileError(
        "This browser refused to save your farm profile. Check that site data is allowed.",
      );
      return;
    }

    // The listing fields are denormalised, so without this the shop would keep
    // printing the farm name and location the listing was published with.
    syncFarmerIdentity(accountId, { farmer: farmName, location });

    setProfileError(null);
    setPhotoError(null);
    setProfileSaved(true);
    if (savedTimer.current !== null) window.clearTimeout(savedTimer.current);
    savedTimer.current = window.setTimeout(() => setProfileSaved(false), 2500);
  };

  const patchProfileDraft = (patch: Partial<FarmProfileDraft>) => {
    setProfileDraft((previous) => ({
      farmName: profile?.farmName ?? "",
      location: profile?.location ?? "",
      bio: profile?.bio ?? "",
      photo: profile?.photo ?? "",
      ...previous,
      ...patch,
    }));
    setProfileSaved(false);
    setProfileError(null);
    setPhotoError(null);
  };

  const handlePhotoPick = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Cleared so picking the same file twice still fires a change event.
    event.target.value = "";
    if (!file) return;

    setPhotoBusy(true);
    setPhotoError(null);
    try {
      const photo = await processFarmerPhoto(file);
      patchProfileDraft({ photo });
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : "That image could not be used.");
    } finally {
      setPhotoBusy(false);
    }
  };

  // ---- derived chart data -------------------------------------------------

  const weeklySales = useMemo(() => {
    const days: { label: string; sales: number }[] = [];
    const now = new Date();

    for (let i = 6; i >= 0; i -= 1) {
      const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const next = new Date(day);
      next.setDate(next.getDate() + 1);

      const total = ownOrders
        .filter((order) => {
          const placed = new Date(order.placedAt);
          return placed >= day && placed < next;
        })
        .reduce((sum, order) => sum + (revenueByOrder.get(order.id) ?? 0), 0);

      days.push({ label: day.toLocaleDateString("en-IN", { weekday: "short" }), sales: total });
    }

    return days;
  }, [ownOrders, revenueByOrder]);

  const revenueTrend = useMemo(() => {
    const months: { label: string; revenue: number }[] = [];
    const now = new Date();

    for (let i = 5; i >= 0; i -= 1) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);

      const total = ownOrders
        .filter((order) => {
          const placed = new Date(order.placedAt);
          return placed >= start && placed < end;
        })
        .reduce((sum, order) => sum + (revenueByOrder.get(order.id) ?? 0), 0);

      months.push({
        label: start.toLocaleDateString("en-IN", { month: "short" }),
        revenue: total,
      });
    }

    return months;
  }, [ownOrders, revenueByOrder]);

  const productSales = useMemo(() => {
    const byProduct = new Map<string, { qty: number; revenue: number }>();

    for (const order of ownOrders) {
      for (const item of order.items) {
        if (item.farmerId !== accountId) continue;
        const entry = byProduct.get(item.productId) ?? { qty: 0, revenue: 0 };
        entry.qty += item.quantity;
        entry.revenue += item.price * item.quantity;
        byProduct.set(item.productId, entry);
      }
    }

    const rows = [...byProduct.entries()]
      .map(([productId, entry]) => {
        const product = ownProducts.find((candidate) => candidate.id === productId);
        return {
          productId,
          name: product?.name ?? "(removed listing)",
          category: product?.category ?? "—",
          unit: product?.unit ?? "",
          qty: entry.qty,
          revenue: entry.revenue,
        };
      })
      .filter((row) => row.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue);

    const total = rows.reduce((sum, row) => sum + row.revenue, 0);
    return rows.map((row) => ({
      ...row,
      // Share of this farmer's revenue, so the bars always sum to 100%.
      share: total === 0 ? 0 : Math.round((row.revenue / total) * 100),
    }));
  }, [ownOrders, ownProducts, accountId]);

  const buyers = useMemo(() => {
    const byCustomer = new Map<
      string,
      { name: string; orders: number; spend: number; lastOrder: string; location: string }
    >();

    for (const order of ownOrders) {
      const entry = byCustomer.get(order.customerId) ?? {
        name: order.customerName,
        orders: 0,
        spend: 0,
        lastOrder: order.placedAt,
        location: order.shipping.address,
      };
      entry.orders += 1;
      entry.spend += revenueByOrder.get(order.id) ?? 0;
      if (order.placedAt > entry.lastOrder) entry.lastOrder = order.placedAt;
      byCustomer.set(order.customerId, entry);
    }

    return [...byCustomer.entries()]
      .map(([id, entry]) => ({ id, ...entry }))
      .sort((a, b) => b.spend - a.spend);
  }, [ownOrders, revenueByOrder]);

  const recentOrders = [...ownOrders]
    .sort((a, b) => b.placedAt.localeCompare(a.placedAt))
    .slice(0, 3);

  const weekTotal = weeklySales.reduce((sum, day) => sum + day.sales, 0);
  const averageOrder =
    ownOrders.length === 0 ? 0 : totalRevenue / ownOrders.length;

  const availableImages = IMAGE_LIBRARY[draft.category] ?? ALL_IMAGES;

  return (
    <DashboardShell
      theme="light"
      brand={BRAND}
      title={farmName}
      subtitle={`Welcome back, ${displayName}`}
      nav={NAV}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      headerRight={
        <button
          type="button"
          onClick={() => {
            setActiveTab("inventory");
            setAdding((open) => !open);
            setOpenRowMenu(null);
          }}
          aria-expanded={adding}
          className="bg-emerald-600 text-white px-5 sm:px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-emerald-700 active:scale-95 transition-all duration-300 shadow-lg shadow-emerald-200"
        >
          <Plus size={20} /> {adding ? "Cancel" : "Add New Product"}
        </button>
      }
      sidebarFooter={
        <div className="space-y-3">
          <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 space-y-3">
            <p className="text-[10px] font-black uppercase text-emerald-800">Your farm</p>
            {/*
              A Pending farmer can write listings here, but the storefront gate
              means none of them can be bought until admin approves the account.
            */}
            {isPendingApproval && (
              <p className="text-[11px] font-semibold text-amber-700 bg-amber-50 rounded-lg px-2 py-1.5 leading-snug">
                Awaiting approval — your listings are saved but cannot be ordered
                by customers until an admin verifies this farm.
              </p>
            )}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-200 text-emerald-800 flex items-center justify-center font-black text-sm overflow-hidden shrink-0">
                {profile?.photo ? (
                  <Image
                    src={profile.photo}
                    alt={`${farmName} photo`}
                    width={40}
                    height={40}
                    className="h-full w-full object-cover"
                    unoptimized
                  />
                ) : (
                  (farmName || displayName).trim().slice(0, 2).toUpperCase()
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-emerald-900 truncate">{farmName}</p>
                <p className="text-[10px] text-emerald-700 truncate">
                  {profile?.location?.trim() || "Location not set"}
                </p>
              </div>
            </div>
            {profileDraft && (
              <>
                <input
                  value={profileDraft.farmName}
                  onChange={(event) => patchProfileDraft({ farmName: event.target.value })}
                  placeholder="Farm name"
                  aria-label="Farm name"
                  className="w-full px-2 py-1 rounded-lg border border-emerald-200 bg-white text-xs font-bold text-emerald-900 outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <input
                  value={profileDraft.location}
                  onChange={(event) => patchProfileDraft({ location: event.target.value })}
                  placeholder="Location"
                  aria-label="Farm location"
                  className="w-full px-2 py-1 rounded-lg border border-emerald-200 bg-white text-xs text-emerald-700 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </>
            )}
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("profile")}
                className="text-[10px] font-bold text-emerald-700 hover:underline"
              >
                Manage farm profile &amp; photo →
              </button>
              <button
                type="button"
                onClick={saveFarmProfile}
                disabled={!profileDirty}
                aria-disabled={!profileDirty}
                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1 text-[10px] font-bold text-white transition hover:bg-emerald-700 disabled:bg-emerald-200 disabled:cursor-not-allowed"
              >
                {profileSaved ? (
                  <>
                    <Check size={12} /> Saved
                  </>
                ) : (
                  "Save"
                )}
              </button>
            </div>
            {profileError ? <p className="text-[10px] text-rose-600">{profileError}</p> : null}
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-sm text-red-500 hover:bg-rose-50 transition-colors"
          >
            <LogOut size={18} /> Logout
          </button>
        </div>
      }
    >
      {activeTab === "overview" && (
        <DashboardPanel className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <FarmerStat
              title="Total Earnings"
              value={rupees(totalRevenue)}
              sub={`Across ${ownOrders.length} orders`}
              icon={<IndianRupee />}
              color="text-emerald-600"
              bg="bg-emerald-50"
            />
            <FarmerStat
              title="Orders Pending"
              value={String(pendingOrders.length).padStart(2, "0")}
              sub="Needs dispatch"
              icon={<PackageCheck />}
              color="text-blue-600"
              bg="bg-blue-50"
            />
            <FarmerStat
              title="Active Listings"
              value={String(liveListings.length).padStart(2, "0")}
              sub="Live on Shop"
              icon={<Store />}
              color="text-purple-600"
              bg="bg-purple-50"
            />
            <FarmerStat
              title="Listing Rating"
              value={profileRating === null ? "—" : `${profileRating}/5`}
              sub={`${liveListings.length} listings rated`}
              icon={<Leaf />}
              color="text-orange-600"
              bg="bg-orange-50"
            />
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white p-6 sm:p-8 rounded-3xl border border-slate-100 shadow-sm">
              <div className="flex flex-wrap justify-between items-center gap-3 mb-8">
                <h3 className="font-black text-slate-800 uppercase tracking-wider text-sm">
                  Weekly Sales Revenue
                </h3>
                <span className="text-xs font-bold bg-slate-100 text-slate-600 p-2 rounded-lg">
                  This Week · {rupees(weekTotal)}
                </span>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <BarChart data={weeklySales}>
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
                      cursor={{ fill: "#f8fafc" }}
                      contentStyle={CHART_TOOLTIP.contentStyle}
                    />
                    <Bar dataKey="sales" fill="#10b981" radius={[6, 6, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-100 shadow-sm">
              <h3 className="font-black text-slate-800 uppercase tracking-wider text-sm mb-6">
                Recent Orders
              </h3>
              {recentOrders.length === 0 ? (
                <p className="text-sm text-slate-400">
                  No orders yet. Publish a listing and it will appear on the shop
                  straight away.
                </p>
              ) : (
                <div className="space-y-6">
                  {recentOrders.map((order) => (
                    <OrderSmall
                      key={order.id}
                      customer={order.customerName}
                      amount={rupees(revenueByOrder.get(order.id) ?? 0)}
                      item={order.items
                        .filter((item) => item.farmerId === accountId)
                        .map((item) => item.name)
                        .join(", ")}
                    />
                  ))}
                </div>
              )}
              <button
                onClick={() => setActiveTab("sales")}
                className="w-full mt-8 py-3 rounded-xl border-2 border-slate-50 text-slate-400 font-bold text-sm hover:bg-slate-50 hover:text-emerald-600 transition-colors"
              >
                View Sales Report
              </button>
            </div>
          </div>
        </DashboardPanel>
      )}

      {activeTab === "inventory" && (
        <DashboardPanel>
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-6 bg-slate-50/50 flex flex-col md:flex-row gap-4 justify-between">
              <div className="relative w-full md:w-72">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  size={18}
                />
                <input
                  type="text"
                  value={inventoryQuery}
                  onChange={(event) => setInventoryQuery(event.target.value)}
                  placeholder="Filter crops..."
                  aria-label="Filter inventory"
                  className="w-full pl-10 pr-10 py-2 bg-white rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                />
                {inventoryQuery && (
                  <button
                    type="button"
                    onClick={() => setInventoryQuery("")}
                    aria-label="Clear inventory filter"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setShowHidden((on) => !on)}
                  aria-pressed={showHidden}
                  className={`flex items-center gap-2 self-start px-3 py-1 rounded-lg text-xs font-bold border transition-colors ${
                    showHidden
                      ? "bg-slate-200 text-slate-800 border-slate-300"
                      : "bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {showHidden ? "Hiding nothing" : "Show removed"}
                </button>
                <button
                  type="button"
                  onClick={() => setLowStockOnly((on) => !on)}
                  aria-pressed={lowStockOnly}
                  className={`flex items-center gap-2 self-start px-3 py-1 rounded-lg text-xs font-bold border transition-colors ${
                    lowStockOnly
                      ? "bg-amber-100 text-amber-800 border-amber-300"
                      : "bg-amber-50 text-amber-600 border border-amber-100 hover:bg-amber-100"
                  }`}
                >
                  <AlertTriangle size={14} /> {lowStockCount} Low Stock Alerts
                </button>
              </div>
            </div>

            {adding && (
              <form
                onSubmit={submitAdd}
                className="p-6 border-b border-slate-100 bg-emerald-50/40 grid sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end"
              >
                {(
                  [
                    ["name", "Product name", "Organic Tomatoes"],
                    ["price", "Unit price (₹)", "40"],
                    ["stockQty", "Stock", "45"],
                    ["quality", "Quality", "Grade A"],
                  ] as const
                ).map(([key, label, placeholder]) => (
                  <label key={key} className="block">
                    <span className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
                      {label}
                    </span>
                    <input
                      type="text"
                      value={draft[key]}
                      onChange={(event) => {
                        setDraft((prev) => ({ ...prev, [key]: event.target.value }));
                        // Clear the validation message as soon as the farmer
                        // starts correcting the field.
                        if (formError) setFormError(null);
                      }}
                      placeholder={placeholder}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </label>
                ))}

                <label className="block">
                  <span className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
                    Category
                  </span>
                  <select
                    value={draft.category}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, category: event.target.value, image: "" }))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {/* Categories already in the catalogue, so a farmer does not
                        end up with two spellings of the same category. */}
                    {[
                      ...new Set([...CATEGORIES, ...ownProducts.map((p) => p.category)]),
                    ].map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
                    Unit
                  </span>
                  <select
                    value={draft.unit}
                    onChange={(event) => setDraft((prev) => ({ ...prev, unit: event.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {UNITS.map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </select>
                </label>

                {/* Photo picker. Images are the app's own local files under
                    /public rather than uploaded, so a listing can only ever
                    reference an asset that actually exists - an arbitrary URL
                    would 404 in next/image. */}
                <div className="sm:col-span-2 lg:col-span-4">
                  <span className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
                    Photo
                  </span>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {availableImages.map((image) => (
                      <button
                        key={image}
                        type="button"
                        onClick={() => setDraft((prev) => ({ ...prev, image }))}
                        aria-label={`Use photo ${image.split("/").pop()}`}
                        aria-pressed={draft.image === image}
                        className={`w-14 h-14 rounded-xl overflow-hidden shrink-0 border-2 transition-colors ${
                          draft.image === image ? "border-emerald-500" : "border-transparent"
                        }`}
                      >
                        <Image src={image} alt="" width={56} height={56} className="object-cover" />
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {draft.image ? (
                      <>Selected: {draft.image}</>
                    ) : (
                      <>
                        <ImageIcon size={11} className="inline mr-1" />
                        No photo selected - the category&apos;s own image will be used.
                      </>
                    )}
                  </p>
                </div>

                <button
                  type="submit"
                  className="bg-emerald-600 text-white px-5 py-2 rounded-xl font-bold text-sm hover:bg-emerald-700 transition-colors"
                >
                  List product
                </button>
                {formError && (
                  <p
                    role="alert"
                    className="sm:col-span-2 lg:col-span-4 flex items-center gap-2 text-sm font-semibold text-red-600"
                  >
                    <AlertCircle size={16} className="shrink-0" />
                    {formError}
                  </p>
                )}
              </form>
            )}

            {filteredInventory.length === 0 ? (
              <DashboardEmptyState
                icon={<Box size={32} />}
                title={
                  ownProducts.length === 0
                    ? "You have no listings yet"
                    : lowStockOnly && !inventoryQuery.trim()
                      ? "Every listing is fully stocked"
                      : "No crops match that filter"
                }
                description={
                  ownProducts.length === 0
                    ? "Add your first product and it appears on the shop immediately - no deploy, no waiting."
                    : lowStockOnly && !inventoryQuery.trim()
                      ? `All ${liveListings.length} listings are in stock. Turn off the low stock filter to see the rest.`
                      : `Nothing in your inventory matches "${inventoryQuery}". Try a different name, ID, or status.`
                }
                action={
                  ownProducts.length === 0 ? (
                    <button
                      onClick={() => setAdding(true)}
                      className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-emerald-700 transition-colors"
                    >
                      Add your first product
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setInventoryQuery("");
                        setLowStockOnly(false);
                      }}
                      className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-emerald-700 transition-colors"
                    >
                      Clear filter
                    </button>
                  )
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                      <th className="px-8 py-5">Product Name</th>
                      <th className="px-8 py-5">Quality</th>
                      <th className="px-8 py-5">Current Stock</th>
                      <th className="px-8 py-5">Unit Price</th>
                      <th className="px-8 py-5">Status</th>
                      <th className="px-8 py-5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 font-medium">
                    {filteredInventory.map((product) => {
                      const status = stockStatus(product.stockQty);
                      return (
                        <tr
                          key={product.id}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            product.hidden ? "opacity-50" : ""
                          }`}
                        >
                          <td className="px-8 py-5">
                            <p className="text-slate-900 font-bold">{product.name}</p>
                            <p className="text-[10px] text-slate-400 font-mono uppercase">
                              {product.id} · {product.category}
                              {product.hidden ? " · removed" : ""}
                            </p>
                          </td>
                          <td className="px-8 py-5 text-sm text-slate-500">{product.quality}</td>
                          <td className="px-8 py-5 font-bold text-slate-700">
                            {product.stockQty} {product.unit}
                          </td>
                          <td className="px-8 py-5 text-emerald-600 font-bold">
                            {rupees(product.price)}/{product.unit}
                          </td>
                          <td className="px-8 py-5">
                            <span
                              className={`px-2 py-1 rounded-md text-[10px] font-black uppercase ${
                                status === "In Stock"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : status === "Low Stock"
                                    ? "bg-amber-100 text-amber-700"
                                    : "bg-red-100 text-red-700"
                              }`}
                            >
                              {status}
                            </span>
                          </td>
                          <td className="px-8 py-5 text-right">
                            <div className="relative inline-block" data-menu-root>
                              <button
                                type="button"
                                onClick={() =>
                                  setOpenRowMenu((current) =>
                                    current === product.id ? null : product.id,
                                  )
                                }
                                aria-label={`Actions for ${product.name}`}
                                aria-expanded={openRowMenu === product.id}
                                className="p-2 text-slate-400 hover:text-emerald-600 transition-colors"
                              >
                                <MoreVertical size={20} />
                              </button>

                              {openRowMenu === product.id && (
                                <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-xl border border-slate-200 shadow-xl p-1 z-40 text-left">
                                  {(
                                    [
                                      ["Restock to 25", 25],
                                      ["Restock to 100", 100],
                                    ] as const
                                  ).map(([label, qty]) => (
                                    <button
                                      key={label}
                                      type="button"
                                      onClick={() => setStock(product, qty)}
                                      className="w-full px-3 py-2 rounded-lg text-sm font-bold text-emerald-600 hover:bg-emerald-50 transition-colors text-left"
                                    >
                                      {label}
                                    </button>
                                  ))}
                                  <button
                                    type="button"
                                    onClick={() => setStock(product, 0)}
                                    className="w-full px-3 py-2 rounded-lg text-sm font-bold text-amber-600 hover:bg-amber-50 transition-colors text-left"
                                  >
                                    Mark out of stock
                                  </button>
                                  {/* Soft delete. A hard delete would renumber
                                      every product after it in its category and
                                      break the (category, index) links held by
                                      open baskets. */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      hideProduct(product.id, !product.hidden);
                                      setOpenRowMenu(null);
                                    }}
                                    className="w-full px-3 py-2 rounded-lg text-sm font-bold text-red-600 hover:bg-red-50 transition-colors text-left"
                                  >
                                    {product.hidden ? "Restore listing" : "Remove listing"}
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </DashboardPanel>
      )}

      {activeTab === "sales" && (
        <DashboardPanel className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <FarmerStat
              title="This Week"
              value={rupees(weekTotal)}
              sub="Across the last 7 days"
              icon={<TrendingUp />}
              color="text-emerald-600"
              bg="bg-emerald-50"
            />
            <FarmerStat
              title="All Time"
              value={rupees(totalRevenue)}
              sub={`From ${ownOrders.length} orders`}
              icon={<IndianRupee />}
              color="text-blue-600"
              bg="bg-blue-50"
            />
            <FarmerStat
              title="Average Order"
              value={rupees(Math.round(averageOrder))}
              sub={`From ${ownOrders.length} orders`}
              icon={<ShoppingBag />}
              color="text-purple-600"
              bg="bg-purple-50"
            />
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-100 shadow-sm">
              <h3 className="font-black text-slate-800 uppercase tracking-wider text-sm mb-8">
                Day-by-Day Revenue
              </h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <BarChart data={weeklySales}>
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
                      cursor={{ fill: "#f8fafc" }}
                      contentStyle={CHART_TOOLTIP.contentStyle}
                    />
                    <Bar dataKey="sales" fill="#10b981" radius={[6, 6, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-100 shadow-sm">
              <h3 className="font-black text-slate-800 uppercase tracking-wider text-sm mb-8">
                6-Month Revenue Trend
              </h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <LineChart data={revenueTrend}>
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
                    <Tooltip contentStyle={CHART_TOOLTIP.contentStyle} />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke="#10b981"
                      strokeWidth={3}
                      dot={{ r: 4, fill: "#10b981" }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <h3 className="p-6 border-b border-slate-100 font-black text-slate-800 uppercase tracking-wider text-sm">
              Revenue by Product
            </h3>
            {productSales.length === 0 ? (
              <DashboardEmptyState
                icon={<TrendingUp size={32} />}
                title="No sales recorded yet"
                description="Once a customer orders one of your listings, the revenue split by product appears here."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                      <th className="px-8 py-5">Product</th>
                      <th className="px-8 py-5">Category</th>
                      <th className="px-8 py-5">Quantity Sold</th>
                      <th className="px-8 py-5">Revenue</th>
                      <th className="px-8 py-5 w-48">Share</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 font-medium">
                    {productSales.map((row) => (
                      <tr key={row.productId} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-8 py-5 font-bold text-slate-900">{row.name}</td>
                        <td className="px-8 py-5 text-sm text-slate-500">{row.category}</td>
                        <td className="px-8 py-5 text-slate-700">
                          {row.qty} {row.unit}
                        </td>
                        <td className="px-8 py-5 text-emerald-600 font-bold">
                          {rupees(row.revenue)}
                        </td>
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                                style={{ width: `${row.share}%` }}
                              />
                            </div>
                            <span className="text-xs font-bold text-slate-500 w-9 text-right">
                              {row.share}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <h3 className="p-6 border-b border-slate-100 font-black text-slate-800 uppercase tracking-wider text-sm">
              Sales Orders
            </h3>
            {ownOrders.length === 0 ? (
              <DashboardEmptyState
                icon={<PackageCheck size={32} />}
                title="No orders yet"
                description="Orders placed against your listings will appear here, newest first."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                      <th className="px-8 py-5">Order</th>
                      <th className="px-8 py-5">Buyer</th>
                      <th className="px-8 py-5">Item</th>
                      <th className="px-8 py-5">Your Revenue</th>
                      <th className="px-8 py-5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 font-medium">
                    {[...ownOrders]
                      .sort((a, b) => b.placedAt.localeCompare(a.placedAt))
                      .map((order) => (
                        <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-8 py-5 font-mono text-xs text-slate-400">{order.id}</td>
                          <td className="px-8 py-5 font-bold text-slate-900">
                            {order.customerName}
                          </td>
                          <td className="px-8 py-5 text-slate-600">
                            {order.items
                              .filter((item) => item.farmerId === accountId)
                              .map((item) => `${item.name} × ${item.quantity}`)
                              .join(", ")}
                          </td>
                          <td className="px-8 py-5 text-emerald-600 font-bold">
                            {rupees(revenueByOrder.get(order.id) ?? 0)}
                          </td>
                          <td className="px-8 py-5">
                            <span
                              className={`px-2 py-1 rounded-md text-[10px] font-black uppercase ${
                                order.status === "Delivered"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-amber-100 text-amber-700"
                              }`}
                            >
                              {order.status}
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

      {activeTab === "buyers" && (
        <DashboardPanel>
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <h3 className="p-6 border-b border-slate-100 font-black text-slate-800 uppercase tracking-wider text-sm">
              Direct Buyers · {buyers.length}
            </h3>
            {buyers.length === 0 ? (
              <DashboardEmptyState
                icon={<Users size={32} />}
                title="No buyers yet"
                description="Customers who order from you are listed here with their order count and lifetime spend."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                      <th className="px-8 py-5">Buyer</th>
                      <th className="px-8 py-5">Orders</th>
                      <th className="px-8 py-5">Lifetime Spend</th>
                      <th className="px-8 py-5">Last Order</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 font-medium">
                    {buyers.map((buyer) => (
                      <tr key={buyer.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-sm shrink-0">
                              {buyer.name.split(" ").filter(Boolean)[0]?.[0] ?? "?"}
                            </div>
                            <div>
                              <p className="text-slate-900 font-bold">{buyer.name}</p>
                              {/* The address is the one on the order they placed,
                                  so it is their own data and it is real. */}
                              <p className="text-[10px] text-slate-400">{buyer.location}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-5 font-bold text-slate-700">{buyer.orders}</td>
                        <td className="px-8 py-5 text-emerald-600 font-bold">
                          {rupees(buyer.spend)}
                        </td>
                        <td className="px-8 py-5 text-sm text-slate-500">
                          {formatDate(buyer.lastOrder)}
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
      {activeTab === "profile" && profileDraft && (
        <DashboardPanel>
          <form
            className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 md:p-10"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              saveFarmProfile();
            }}
          >
            <div className="flex flex-col gap-8 lg:flex-row">
              <div className="flex flex-col items-center gap-4 lg:w-80">
                <div className="relative h-64 w-64 rounded-3xl overflow-hidden bg-emerald-100 ring-1 ring-emerald-200">
                  {profileDraft.photo ? (
                    <Image
                      src={profileDraft.photo}
                      alt="Your farm photo"
                      width={256}
                      height={256}
                      className="h-full w-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <span className="flex h-32 w-32 items-center justify-center rounded-full bg-emerald-600 text-5xl font-black text-white">
                        {(profileDraft.farmName || displayName).trim().slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <label className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2 text-sm font-bold text-white transition hover:bg-emerald-700">
                    <Camera size={16} />
                    {photoBusy ? "Processing…" : "Choose photo"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePhotoPick}
                      disabled={photoBusy}
                    />
                  </label>
                  {profileDraft.photo && (
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-600 transition hover:border-rose-200 hover:text-rose-600"
                      onClick={() => patchProfileDraft({ photo: "" })}
                    >
                      <X size={16} />
                      Remove photo
                    </button>
                  )}
                </div>
                <p className="text-xs text-slate-400 text-center max-w-xs">
                  Square images work best. Photos are cropped to 480×480 and saved as a small
                  data URL on this device.
                </p>
                {photoError ? (
                  <p className="text-sm text-rose-600" role="alert">
                    {photoError}
                  </p>
                ) : null}
              </div>
              <div className="flex-1 space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                      Farm name
                    </label>
                    <input
                      value={profileDraft.farmName}
                      onChange={(event) => patchProfileDraft({ farmName: event.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      placeholder="e.g. Green Valley Farm"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                      Location
                    </label>
                    <input
                      value={profileDraft.location}
                      onChange={(event) => patchProfileDraft({ location: event.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      placeholder="e.g. Wayanad, Kerala"
                    />
                  </div>
                </div>
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="text-sm font-semibold text-slate-700">
                      About this farm
                    </label>
                    <span className="text-xs text-slate-400">
                      {profileDraft.bio.length}/{MAX_BIO_LENGTH}
                    </span>
                  </div>
                  <textarea
                    rows={5}
                    value={profileDraft.bio}
                    onChange={(event) => patchProfileDraft({ bio: event.target.value })}
                    maxLength={MAX_BIO_LENGTH}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    placeholder="Tell buyers a little about your farm, what you grow, and how fresh your produce is."
                  />
                  <p className="mt-2 text-xs text-slate-500">
                    Shown on the &quot;Meet Our Farmers&quot; card on the home page.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="submit"
                    disabled={!profileDirty || photoBusy}
                    aria-disabled={!profileDirty || photoBusy}
                    className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:bg-emerald-200 disabled:cursor-not-allowed"
                  >
                    {profileSaved ? (
                      <>
                        <Check size={16} /> Saved
                      </>
                    ) : (
                      "Save farm profile"
                    )}
                  </button>
                  {profileError ? (
                    <p className="text-sm text-rose-600" role="alert">
                      {profileError}
                    </p>
                  ) : profileSaved ? (
                    <p className="text-sm text-emerald-600">Your farm profile is up to date.</p>
                  ) : null}
                </div>
              </div>
            </div>
          </form>
        </DashboardPanel>
      )}
    </DashboardShell>
  );
}

type FarmerStatProps = {
  title: string;
  value: string;
  sub: string;
  icon: ReactNode;
  color: string;
  bg: string;
};

function FarmerStat({ title, value, sub, icon, color, bg }: FarmerStatProps) {
  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
      <div className={`w-12 h-12 ${bg} ${color} rounded-2xl flex items-center justify-center mb-4`}>
        {icon}
      </div>
      <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">{title}</p>
      <h3 className="text-2xl font-black text-slate-900 mt-1">{value}</h3>
      <p className="text-[10px] text-slate-400 mt-1 font-medium">{sub}</p>
    </div>
  );
}

function OrderSmall({
  customer,
  amount,
  item,
}: {
  customer: string;
  amount: string;
  item: string;
}) {
  // This row used to carry cursor-pointer, a group-hover tint, and a
  // ChevronRight, so it advertised that clicking would open the order. There is
  // no per-order route to open, so the affordance is gone rather than left
  // lying. Wired up to a real order view, this is where the Link would go.
  return (
    <div className="flex justify-between items-center">
      <div className="flex gap-3 items-center">
        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
          {customer.split(" ").filter(Boolean)[0]?.[0] ?? "?"}
        </div>
        <div>
          <p className="text-sm font-bold text-slate-800">{customer}</p>
          <p className="text-[10px] text-slate-400">{item}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-sm font-black text-slate-900">{amount}</p>
      </div>
    </div>
  );
}
