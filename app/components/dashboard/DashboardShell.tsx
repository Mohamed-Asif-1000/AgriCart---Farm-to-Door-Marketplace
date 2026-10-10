"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { Menu, X, ShoppingCart, Heart, Store } from "lucide-react";
import { useDashboardUI } from "../../dashboard/DashboardUIContext";
import { useCartWishlist } from "../../context/CartWishlistContext";

export type DashboardNavItem = {
  key: string;
  label: string;
  icon: React.ReactNode;
};

type Theme = "light" | "dark";

const THEMES = {
  light: {
    // text-slate-900 belongs here: the page background alone left this theme
    // inheriting whatever colour <body> set, which was the reason light
    // dashboards could render near-white text on a white card.
    page: "bg-slate-50 text-slate-900",
    sidebar: "bg-white border-slate-200",
    topBar: "bg-white/90 border-slate-200",
    brandText: "text-slate-900",
    titleText: "text-slate-900",
    subText: "text-slate-500",
    navActive: "bg-emerald-600 text-white shadow-lg shadow-emerald-200",
    navIdle: "text-slate-500 hover:bg-slate-50 hover:text-emerald-600",
  },
  dark: {
    page: "bg-slate-900 text-slate-300",
    sidebar: "bg-slate-950 border-slate-800",
    topBar: "bg-slate-950/90 border-slate-800",
    brandText: "text-white",
    titleText: "text-white",
    subText: "text-slate-500",
    navActive: "bg-emerald-600 text-white shadow-lg shadow-emerald-900/40",
    navIdle: "text-slate-500 hover:bg-slate-800 hover:text-slate-300",
  },
} as const;

function prefersReducedMotion() {
  // Guarded like app/login/page.tsx does. This one used to call
  // window.matchMedia with no server check, so it threw the moment the helper
  // was ever reached from a render pass.
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

type ShellProps = {
  theme: Theme;
  brand: React.ReactNode;
  title: string;
  subtitle?: string;
  nav: DashboardNavItem[];
  activeTab: string;
  onTabChange: (key: string) => void;
  headerRight?: React.ReactNode;
  sidebarFooter?: React.ReactNode;
  children: React.ReactNode;
};

export default function DashboardShell({
  theme,
  brand,
  title,
  subtitle,
  nav,
  activeTab,
  onTabChange,
  headerRight,
  sidebarFooter,
  children,
}: ShellProps) {
  const t = THEMES[theme];
  const { drawerOpen, openDrawer, closeDrawer } = useDashboardUI();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const wasOpenRef = useRef(false);

  // Returning focus to the trigger keeps keyboard users from being dropped at
  // the top of the document every time the drawer closes. Guarding on the
  // previous value stops this from stealing focus on first paint.
  useEffect(() => {
    if (wasOpenRef.current && !drawerOpen) {
      menuButtonRef.current?.focus();
    }
    wasOpenRef.current = drawerOpen;
  }, [drawerOpen]);

  const selectTab = (key: string) => {
    onTabChange(key);
    closeDrawer();
  };

  return (
    <div className={`flex min-h-screen ${t.page}`}>
      <aside
        className={`hidden lg:flex w-64 shrink-0 flex-col p-6 sticky top-0 h-screen border-r ${t.sidebar}`}
      >
        <div className={`mb-6 px-2 ${t.brandText}`}>{brand}</div>

        <StorefrontLinks theme={theme} />

        <nav aria-label="Dashboard sections" className="space-y-1.5 flex-1">
          {nav.map((item) => (
            <NavButton
              key={item.key}
              item={item}
              active={activeTab === item.key}
              activeClass={t.navActive}
              idleClass={t.navIdle}
              onClick={() => selectTab(item.key)}
            />
          ))}
        </nav>

        {sidebarFooter && <div className="mt-auto">{sidebarFooter}</div>}
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <div
          className={`lg:hidden sticky top-0 z-40 flex items-center gap-3 px-4 h-16 border-b backdrop-blur ${t.topBar}`}
        >
          <button
            ref={menuButtonRef}
            type="button"
            onClick={openDrawer}
            aria-label="Open navigation menu"
            aria-expanded={drawerOpen}
            aria-controls="dashboard-drawer"
            className={`p-2 -ml-2 rounded-xl transition-colors ${t.navIdle}`}
          >
            <Menu size={24} />
          </button>
          <div className={`min-w-0 truncate ${t.brandText}`}>{brand}</div>
        </div>

        <main className="flex-1 min-w-0 p-6 lg:p-10 space-y-8">
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="min-w-0">
              <h1 className={`text-2xl sm:text-3xl font-black ${t.titleText}`}>
                {title}
              </h1>
              {subtitle && (
                <p className={`font-medium text-sm mt-1 ${t.subText}`}>
                  {subtitle}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              {headerRight}
            </div>
          </header>

          {children}
        </main>
      </div>

      {drawerOpen && (
        <Drawer
          theme={theme}
          brand={brand}
          nav={nav}
          activeTab={activeTab}
          sidebarFooter={sidebarFooter}
          onSelect={selectTab}
          onClose={closeDrawer}
        />
      )}
    </div>
  );
}

function NavButton({
  item,
  active,
  activeClass,
  idleClass,
  onClick,
}: {
  item: DashboardNavItem;
  active: boolean;
  activeClass: string;
  idleClass: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300 font-bold text-sm ${
        active ? activeClass : idleClass
      }`}
    >
      {item.icon}
      <span>{item.label}</span>
    </button>
  );
}

/**
 * SiteChrome strips the storefront header on /dashboard, so without this the
 * dashboard had no cart indicator and no way back to the shop at all. The
 * counts come from the same context the storefront header uses, and are gated
 * on isHydrated so the badge cannot mismatch the server render.
 */
function StorefrontLinks({ theme }: { theme: Theme }) {
  const { cartCount, wishlistCount, isHydrated } = useCartWishlist();
  const isDark = theme === "dark";

  const linkBase = `flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
    isDark
      ? "text-slate-400 hover:text-white hover:bg-slate-900"
      : "text-slate-500 hover:text-emerald-700 hover:bg-slate-50"
  }`;

  return (
    <div className="mb-4 pb-4 border-b border-slate-200/60 space-y-0.5">
      <Link href="/shop" className={linkBase}>
        <Store size={17} />
        Back to store
      </Link>
      <Link href="/cart" className={linkBase}>
        <ShoppingCart size={17} />
        Cart
        {isHydrated && cartCount > 0 ? (
          <span
            className={`ml-auto min-w-5 px-1.5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${
              isDark
                ? "bg-emerald-500/20 text-emerald-400"
                : "bg-emerald-100 text-emerald-700"
            }`}
          >
            {cartCount}
          </span>
        ) : null}
      </Link>
      <Link href="/wishlist" className={linkBase}>
        <Heart size={17} />
        Wishlist
        {isHydrated && wishlistCount > 0 ? (
          <span
            className={`ml-auto min-w-5 px-1.5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${
              isDark
                ? "bg-rose-500/20 text-rose-400"
                : "bg-rose-100 text-rose-600"
            }`}
          >
            {wishlistCount}
          </span>
        ) : null}
      </Link>
    </div>
  );
}

function Drawer({
  theme,
  brand,
  nav,
  activeTab,
  sidebarFooter,
  onSelect,
  onClose,
}: {
  theme: Theme;
  brand: React.ReactNode;
  nav: DashboardNavItem[];
  activeTab: string;
  sidebarFooter?: React.ReactNode;
  onSelect: (key: string) => void;
  onClose: () => void;
}) {
  const t = THEMES[theme];
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<(() => void) | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useGSAP(
    () => {
      const reduce = prefersReducedMotion();

      if (reduce) {
        gsap.set(backdropRef.current, { opacity: 1 });
        gsap.set(panelRef.current, { x: "0%" });
      } else {
        gsap
          .timeline()
          .fromTo(
            backdropRef.current,
            { opacity: 0 },
            { opacity: 1, duration: 0.25, ease: "power2.out" }
          )
          .fromTo(
            panelRef.current,
            { x: "-100%" },
            { x: "0%", duration: 0.35, ease: "power3.out" },
            "-=0.1"
          );
      }

      closeRef.current = () => {
        if (reduce) {
          onClose();
          return;
        }
        gsap
          .timeline({ onComplete: onClose })
          .to(panelRef.current, { x: "-100%", duration: 0.25, ease: "power2.in" })
          .to(
            backdropRef.current,
            { opacity: 0, duration: 0.2 },
            "-=0.15"
          );
      };
    },
    { scope: rootRef }
  );

  useEffect(() => {
    closeButtonRef.current?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeRef.current?.();
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <div
      ref={rootRef}
      id="dashboard-drawer"
      className="lg:hidden fixed inset-0 z-[60]"
    >
      <div
        ref={backdropRef}
        onClick={() => closeRef.current?.()}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Dashboard navigation"
        className={`absolute inset-y-0 left-0 w-72 max-w-[85vw] flex flex-col p-6 border-r ${t.sidebar}`}
      >
        <div className="flex items-start justify-between gap-3 mb-8">
          <div className={`min-w-0 ${t.brandText}`}>{brand}</div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={() => closeRef.current?.()}
            aria-label="Close navigation menu"
            className={`p-2 -mr-2 -mt-2 rounded-xl transition-colors shrink-0 ${t.navIdle}`}
          >
            <X size={22} />
          </button>
        </div>

        <div className="mb-4">
          <StorefrontLinks theme={theme} />
        </div>

        <nav aria-label="Dashboard sections" className="space-y-1.5 flex-1 overflow-y-auto">
          {nav.map((item) => (
            <NavButton
              key={item.key}
              item={item}
              active={activeTab === item.key}
              activeClass={t.navActive}
              idleClass={t.navIdle}
              onClick={() => onSelect(item.key)}
            />
          ))}
        </nav>

        {sidebarFooter && <div className="mt-6">{sidebarFooter}</div>}
      </div>
    </div>
  );
}

export function DashboardPanel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      gsap.fromTo(
        ref.current,
        { opacity: 0, y: 16 },
        { opacity: 1, y: 0, duration: 0.4, ease: "power3.out" }
      );
    },
    { scope: ref }
  );

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

export function DashboardEmptyState({
  icon,
  title,
  description,
  action,
  tone = "light",
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  tone?: "light" | "dark";
}) {
  const isDark = tone === "dark";
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <div
        className={`w-20 h-20 rounded-full flex items-center justify-center mb-5 ${
          isDark
            ? "bg-white/10 text-emerald-300"
            : "bg-slate-100 text-slate-400"
        }`}
      >
        {icon}
      </div>
      <h3
        className={`text-xl font-black mb-2 ${
          isDark ? "text-white" : "text-slate-900"
        }`}
      >
        {title}
      </h3>
      <p
        className={`max-w-sm mb-6 ${
          isDark ? "text-slate-400" : "text-slate-500"
        }`}
      >
        {description}
      </p>
      {action}
    </div>
  );
}

export function DashboardSkeleton({
  rows = 4,
  tone = "light",
}: {
  rows?: number;
  tone?: "light" | "dark";
}) {
  const bar = tone === "dark" ? "bg-white/10" : "bg-slate-100";
  return (
    <div className="p-6 space-y-4" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <div className={`w-10 h-10 rounded-full animate-pulse ${bar}`} />
          <div className="flex-1 space-y-2">
            <div className={`h-3 w-1/3 rounded animate-pulse ${bar}`} />
            <div className={`h-3 w-1/2 rounded animate-pulse ${bar}`} />
          </div>
        </div>
      ))}
    </div>
  );
}
