"use client";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  Search,
  ShoppingCart,
  User,
  Heart,
  Leaf,
  LogIn,
  Menu,
  X,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Store,
  Package,
  Truck,
  ShieldCheck,
} from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useCartWishlist } from "../context/CartWishlistContext";
import { categoriesOf, productsInCategory } from "../lib/catalog";
import { useTradeableProducts } from "../lib/store";
import { useIsSessionReady, useSession } from "../lib/useSession";
import { DASHBOARD_BY_ROLE, clearSession } from "../lib/session";
import "../lib/gsapSetup";

gsap.registerPlugin(ScrollTrigger);

const ROLE_ICONS = {
  customer: User,
  farmer: Store,
  delivery: Truck,
  admin: ShieldCheck,
} as const;

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Shop", href: "/shop" },
  { label: "Our Farmers", href: "/#farmers" },
  { label: "How It Works", href: "/#how-it-works" },
] as const;

export default function ProfessionalHeader() {
  const headerRef = useRef<HTMLElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const categoryMenuRef = useRef<HTMLDivElement>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<"category" | "account" | null>(null);
  const [search, setSearch] = useState("");
  // `/#farmers` and `/#how-it-works` both resolve to the pathname "/", so the
  // active-state check below needs the hash as well. Seeded as "" so the server
  // render and the first client render agree; the effect below fills it in.
  const [hash, setHash] = useState("");
  const router = useRouter();
  const pathname = usePathname();
  const { cartCount, wishlistCount, isHydrated } = useCartWishlist();
  const session = useSession();
  const isSessionReady = useIsSessionReady();

  // The nav's category list and its counts come from the live catalogue, so a
  // category a farmer introduces appears here rather than being absent until a
  // deploy. useMemo because both menus read the same derived map on every render.
  const liveProducts = useTradeableProducts();
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const name of categoriesOf(liveProducts)) {
      counts.set(name, productsInCategory(liveProducts, name).length);
    }
    return counts;
  }, [liveProducts]);

  useEffect(() => {
    const syncHash = () => setHash(window.location.hash);
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  // Until the localStorage snapshot arrives, `session === null` is "unknown".
  // Rendering the logged-out header for that frame made the account button read
  // "Login / Register" and flash away a moment later on every page load.
  const currentSession = isSessionReady ? session : undefined;

  const closeMenus = useCallback(() => setOpenMenu(null), []);

  // One dismiss path for every overlay: a click anywhere outside the menus, or
  // Escape, closes the open menu and returns focus to its trigger.
  useEffect(() => {
    if (!openMenu && !isMobileMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        openMenu === "category" &&
        !categoryMenuRef.current?.contains(target)
      ) {
        setOpenMenu((current) => (current === "category" ? null : current));
      }
      if (
        openMenu === "account" &&
        !accountMenuRef.current?.contains(target)
      ) {
        setOpenMenu((current) => (current === "account" ? null : current));
      }
      if (
        isMobileMenuOpen &&
        !mobileMenuRef.current?.contains(target) &&
        !headerRef.current?.contains(target)
      ) {
        setIsMobileMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      closeMenus();
      setIsMobileMenuOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openMenu, isMobileMenuOpen, closeMenus]);

  // --- GSAP ANIMATIONS ---
  useGSAP(() => {
    // 1. Initial Load Stagger
    gsap.fromTo(
      ".nav-item",
      { y: -10, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.6, stagger: 0.07, ease: "power3.out" }
    );

    // 2. Scroll-Triggered Transformation
    // `end: "+=60"` with no trigger element meant onUpdate only fired for the
    // first 60px of the page: scroll past it and the header kept whatever
    // shadow/blur state it happened to hold, and scrolling back up to the top
    // never cleared it either. Drive it off the scroll position instead.
    ScrollTrigger.create({
      start: 0,
      end: "max",
      onUpdate: (self) => {
        const scrolled = self.scroll() > 8;
        // overwrite kills the previous tween instead of stacking a new one on
        // every scroll tick.
        gsap.to(headerRef.current, {
          backgroundColor: scrolled ? "rgba(255,255,255,0.96)" : "#ffffff",
          backdropFilter: scrolled ? "blur(12px)" : "blur(0px)",
          boxShadow: scrolled ? "0 10px 30px -10px rgba(0,0,0,0.1)" : "none",
          duration: 0.4,
          overwrite: "auto",
        });
      },
    });
  }, { scope: headerRef });

  // The mobile drawer used `animate-in slide-in-from-top`, which are
  // tailwindcss-animate plugin utilities. The plugin is not a dependency, so all
  // three classes were dead and the menu appeared with no transition. Animate
  // it with GSAP, which the rest of this file already uses.
  useGSAP(
    () => {
      if (!isMobileMenuOpen || !mobileMenuRef.current) return;
      gsap.fromTo(
        mobileMenuRef.current,
        { height: 0, opacity: 0 },
        { height: "auto", opacity: 1, duration: 0.3, ease: "power3.out" }
      );
    },
    { dependencies: [isMobileMenuOpen], scope: headerRef }
  );

  const submitSearch = () => {
    const term = search.trim();
    // An empty term used to navigate to /search?q=, where every product matched
    // and the page reported 48 results for the empty string.
    if (!term) return;
    setIsMobileMenuOpen(false);
    router.push(`/search?q=${encodeURIComponent(term)}`);
  };

  const handleLogout = () => {
    clearSession();
    setOpenMenu(null);
    setIsMobileMenuOpen(false);
    router.push("/");
  };

  const toggleMenu = (menu: "category" | "account") => {
    setOpenMenu((current) => (current === menu ? null : menu));
  };

  const RoleIcon = currentSession ? ROLE_ICONS[currentSession.role] : User;
  const accountLabel = currentSession
    ? currentSession.name.split(" ")[0]
    : "Login / Register";

  // A link can match on its path, its hash, or both. Stripping the hash like the
  // old version did made "/" , "/#farmers" and "/#how-it-works" all active at
  // once on the homepage, three aria-current="page" elements side by side.
  const isCurrent = (href: string) => {
    const [path, target] = href.split("#");
    const pathMatches =
      path === "/" ? pathname === "/" : pathname?.startsWith(path) ?? false;

    if (!pathMatches) return false;

    // A hash link is only current while that anchor is the one on screen; a
    // plain path link is only current when no anchor is active.
    return target ? hash === `#${target}` : hash === "";
  };

  return (
    <header
      ref={headerRef}
      className="w-full bg-white border-b border-slate-200 sticky top-0 z-100 flex flex-col"
    >
      {/* 1. MAIN HEADER CONTENT */}
      <div className="max-w-7xl mx-auto w-full px-4 md:px-8 flex items-center justify-between gap-2 sm:gap-4 md:gap-6 py-3">
        {/* LOGO */}
        <Link
          href="/"
          className="flex items-center gap-2.5 shrink-0 group nav-item"
        >
          <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-200 group-hover:scale-110 transition-transform duration-300">
            <Leaf size={22} fill="currentColor" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-lg sm:text-xl md:text-2xl font-black text-slate-900 leading-none tracking-tight">
              Agri<span className="text-emerald-600">Cart</span>
            </h1>
            <span className="text-[9px] uppercase tracking-[0.2em] text-emerald-700 font-extrabold mt-1 hidden sm:block">
              Fresh from Farm
            </span>
          </div>
        </Link>

        {/* SEARCH BAR */}
        <div className="hidden lg:flex grow max-w-xl nav-item">
          <div className="relative w-full group">
            <input
              type="search"
              aria-label="Search products"
              className="w-full py-2 pl-10 pr-4 border border-slate-300 rounded-xl bg-slate-50 placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors duration-200"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submitSearch();
                }
              }}
              placeholder="Search tomatoes, ghee, eggs..."
            />
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-600"
              size={18}
            />
          </div>
        </div>

        {/* INTERACTION HUB */}
        <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 shrink-0">
          {/* Wishlist */}
          <Link
            href="/wishlist"
            className="nav-item relative p-2.5 text-slate-600 hover:bg-rose-50 hover:text-rose-600 rounded-full transition-all group"
            aria-label={`Wishlist${wishlistCount > 0 ? `, ${wishlistCount} items` : ""}`}
          >
            <Heart size={22} className="group-active:scale-125 transition-transform" />
            {isHydrated && wishlistCount > 0 ? (
              <span className="absolute top-1.5 right-1.5 bg-rose-500 text-white text-[10px] font-bold min-w-4 h-4 px-1 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                {wishlistCount}
              </span>
            ) : null}
          </Link>

          {/* Shopping Cart */}
          <Link
            href="/cart"
            className="nav-item relative p-2.5 text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 rounded-full transition-all group"
            aria-label={`Cart${cartCount > 0 ? `, ${cartCount} items` : ""}`}
          >
            <ShoppingCart
              size={22}
              className="group-active:scale-125 transition-transform"
            />
            {isHydrated && cartCount > 0 ? (
              <span className="absolute top-1.5 right-1.5 bg-emerald-600 text-white text-[10px] font-bold min-w-4 h-4 px-1 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                {cartCount}
              </span>
            ) : null}
          </Link>

          <div className="h-8 w-px bg-slate-200 mx-1 hidden md:block" />

          {/* ACCOUNT. Signed out it is a link to /login; signed in it becomes
              the trigger for the account dropdown. Rendering both shapes is
              what makes it keyboard- and screen-reader-correct, which an
              overlaid link on top of a disabled button was not. */}
          <div className="nav-item relative" ref={accountMenuRef}>
            {currentSession ? (
              <button
                type="button"
                onClick={() => toggleMenu("account")}
                aria-expanded={openMenu === "account"}
                aria-haspopup="menu"
                className="flex items-center gap-3 px-3 sm:px-4 md:px-5 py-2.5 rounded-xl bg-slate-900 text-white hover:bg-emerald-600 transition-all duration-300 shadow-xl group active:scale-95 whitespace-nowrap"
              >
                <div className="bg-white/10 p-1 rounded-lg group-hover:bg-white group-hover:text-emerald-600 transition-colors">
                  <RoleIcon size={18} />
                </div>
                <div className="text-left hidden md:block">
                  <p className="text-[9px] text-white/50 font-bold leading-none uppercase tracking-tighter mb-0.5">
                    Welcome
                  </p>
                  <p className="text-xs font-bold tracking-tight flex items-center gap-1">
                    {accountLabel}
                    <ChevronDown
                      size={13}
                      className={`transition-transform ${
                        openMenu === "account" ? "rotate-180" : ""
                      }`}
                    />
                  </p>
                </div>
                <div className="md:hidden">
                  <RoleIcon size={18} />
                </div>
              </button>
            ) : (
              <Link
                href="/login"
                className="flex items-center gap-3 px-3 sm:px-4 md:px-5 py-2.5 rounded-xl bg-slate-900 text-white hover:bg-emerald-600 transition-all duration-300 shadow-xl group active:scale-95 whitespace-nowrap"
              >
                <div className="bg-white/10 p-1 rounded-lg group-hover:bg-white group-hover:text-emerald-600 transition-colors">
                  <User size={18} />
                </div>
                <div className="text-left hidden md:block">
                  <p className="text-[9px] text-white/50 font-bold leading-none uppercase tracking-tighter mb-0.5">
                    Account
                  </p>
                  <p className="text-xs font-bold tracking-tight">Login / Register</p>
                </div>
                <div className="md:hidden">
                  <LogIn size={18} />
                </div>
              </Link>
            )}

            {currentSession && openMenu === "account" ? (
              <div
                role="menu"
                className="absolute right-0 mt-3 w-64 bg-white rounded-2xl border border-slate-200 shadow-xl p-2 z-50"
              >
                <div className="px-3 py-2.5 border-b border-slate-100 mb-1">
                  <p className="text-sm font-bold text-slate-900 truncate">
                    {currentSession.name}
                  </p>
                  <p className="text-xs text-slate-500 truncate">{currentSession.email}</p>
                  <span className="inline-block mt-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                    {currentSession.role}
                  </span>
                </div>

                <Link
                  role="menuitem"
                  href={DASHBOARD_BY_ROLE[currentSession.role]}
                  onClick={closeMenus}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors text-sm font-semibold text-slate-700"
                >
                  <LayoutDashboard size={16} className="text-slate-400" />
                  My dashboard
                </Link>
                <Link
                  role="menuitem"
                  href="/order-success"
                  onClick={closeMenus}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors text-sm font-semibold text-slate-700"
                >
                  <Package size={16} className="text-slate-400" />
                  My orders
                </Link>
                <Link
                  role="menuitem"
                  href="/wishlist"
                  onClick={closeMenus}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors text-sm font-semibold text-slate-700"
                >
                  <Heart size={16} className="text-slate-400" />
                  Wishlist
                  {isHydrated && wishlistCount > 0 ? (
                    <span className="ml-auto text-xs font-bold text-rose-500">
                      {wishlistCount}
                    </span>
                  ) : null}
                </Link>
                <Link
                  role="menuitem"
                  href="/cart"
                  onClick={closeMenus}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors text-sm font-semibold text-slate-700"
                >
                  <ShoppingCart size={16} className="text-slate-400" />
                  Cart
                  {isHydrated && cartCount > 0 ? (
                    <span className="ml-auto text-xs font-bold text-emerald-600">
                      {cartCount}
                    </span>
                  ) : null}
                </Link>

                <button
                  type="button"
                  role="menuitem"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-3 py-2.5 mt-1 border-t border-slate-100 rounded-xl hover:bg-rose-50 transition-colors text-sm font-semibold text-red-600"
                >
                  <LogOut size={16} />
                  Sign out
                </button>
              </div>
            ) : null}
          </div>

          {/* MOBILE MENU TOGGLE */}
          <button
            type="button"
            className="lg:hidden p-2 text-slate-800"
            onClick={() => setIsMobileMenuOpen((open) => !open)}
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-nav"
            aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* 2. DESKTOP NAVIGATION */}
      <nav
        aria-label="Main"
        className="hidden lg:block border-t border-slate-100 bg-white/80"
      >
        <div className="max-w-7xl mx-auto px-4 md:px-8 flex items-center gap-1 h-12">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              aria-current={isCurrent(link.href) ? "page" : undefined}
              className={`px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors ${
                isCurrent(link.href)
                  ? "text-emerald-700 bg-emerald-50"
                  : "text-slate-600 hover:text-emerald-700 hover:bg-slate-50"
              }`}
            >
              {link.label}
            </Link>
          ))}

          <div className="relative" ref={categoryMenuRef}>
            <button
              type="button"
              onClick={() => toggleMenu("category")}
              aria-expanded={openMenu === "category"}
              aria-haspopup="true"
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors ${
                openMenu === "category"
                  ? "text-emerald-700 bg-emerald-50"
                  : "text-slate-600 hover:text-emerald-700 hover:bg-slate-50"
              }`}
            >
              Categories
              <ChevronDown
                size={15}
                className={`transition-transform ${openMenu === "category" ? "rotate-180" : ""}`}
              />
            </button>

            {openMenu === "category" ? (
              <div className="absolute left-0 top-full mt-1 w-64 bg-white rounded-2xl border border-slate-200 shadow-xl p-2 z-50">
                <ul className="grid grid-cols-1">
                  {[...categoryCounts].map(([name, count]) => (
                    <li key={name}>
                      <Link
                        href={`/shop?category=${encodeURIComponent(name)}`}
                        onClick={closeMenus}
                        className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors text-sm font-semibold text-slate-700"
                      >
                        {name}
                        <span className="text-xs font-bold text-slate-400">{count}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      </nav>

      {/* 3. MOBILE OVERLAY MENU */}
      {isMobileMenuOpen ? (
        <div
          ref={mobileMenuRef}
          id="mobile-nav"
          className="lg:hidden bg-white border-t border-slate-100 overflow-hidden"
        >
          {/* The drawer lives inside a sticky header, so once it grew past the
              viewport its lower half was clipped by the header's own bounds
              with no way to scroll to it: Cart and Sign out were unreachable on
              short screens. The tween still clips the outer box during the
              height animation; this inner box is what scrolls. dvh accounts
              for mobile browser chrome that vh does not. */}
          <div className="p-4 space-y-4 max-h-[85dvh] overflow-y-auto overscroll-contain">
            <div className="relative">
              <input
                type="search"
                aria-label="Search products"
                className="w-full bg-slate-100 p-3 rounded-xl pl-10 border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submitSearch();
                  }
                }}
                placeholder="Search..."
              />
              <Search className="absolute left-3 top-3.5 text-slate-400" size={18} />
            </div>

            <nav aria-label="Mobile" className="flex flex-col gap-1 font-bold text-slate-700">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-3 rounded-lg hover:bg-slate-50"
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-3 mb-2">
                Categories
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[...categoryCounts].map(([name]) => (
                  <Link
                    key={name}
                    href={`/shop?category=${encodeURIComponent(name)}`}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-2.5 rounded-lg bg-emerald-50/60 text-emerald-800 text-sm hover:bg-emerald-50 transition-colors"
                  >
                    {name}
                  </Link>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-100 pt-3 space-y-1">
              <Link
                href="/wishlist"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50"
              >
                Wishlist
                <span>{isHydrated ? wishlistCount : 0}</span>
              </Link>
              <Link
                href="/cart"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50"
              >
                Cart
                <span>{isHydrated ? cartCount : 0}</span>
              </Link>

              {currentSession ? (
                <>
                  <Link
                    href={DASHBOARD_BY_ROLE[currentSession.role]}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 text-emerald-700"
                  >
                    <LayoutDashboard size={16} />
                    My dashboard
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 p-3 rounded-lg text-left text-red-600 hover:bg-rose-50 transition-colors"
                  >
                    <LogOut size={16} />
                    Sign out
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block p-3 rounded-lg bg-slate-900 text-white text-center"
                  >
                    Login / Register
                  </Link>
                  <Link
                    href="/login"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block p-3 rounded-lg bg-emerald-50 text-emerald-700 text-center"
                  >
                    Sell as Farmer
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
