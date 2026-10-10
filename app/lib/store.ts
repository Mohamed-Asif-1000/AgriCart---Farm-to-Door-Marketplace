"use client";

/**
 * The single source of truth for everything the four dashboards share.
 *
 * Before this, each dashboard owned a private `const` array of invented rows and
 * its own `useState` copy of it, so nothing one role did was ever visible to
 * another: a farmer could add a listing that no customer could buy, and an order
 * a customer had paid for appeared in no farmer's sales.
 *
 * A collection here is a validated localStorage array with two change
 * notifications, because one is not enough:
 *
 *   - the native `storage` event, which fires in *other* tabs, so four tabs of
 *     the same browser stay in step while you play all four roles;
 *   - a same-tab custom event, because `storage` deliberately does not fire in
 *     the tab that made the write, which is exactly the tab you are looking at.
 *
 * Reads are cached so the reference handed to useSyncExternalStore is stable
 * between changes - returning a freshly parsed array on every call would loop
 * forever, the trap documented in lib/useSession.ts.
 */

import { useEffect, useMemo, useSyncExternalStore } from "react";
import {
  accountId,
  readSession,
  readUsers,
  sessionId,
  writeSession,
  writeUsers,
  type Role,
  type StoredUser,
} from "./session";
import {
  DEMO_FARMER,
  DEMO_FARMER_ID,
  SEED_FARMERS,
  SEED_FARMER_IDS,
  SEED_PRODUCTS,
  type SeedFarmer,
} from "./catalog";
import {
  emptyProfile,
  isOrder,
  isProduct,
  isProfile,
  isReview,
  isAgentApproved,
  nextOrderStatus,
  ORDER_FLOW,
  orderItemCount,
  type AccountStatus,
  type AgentOrderStep,
  type Order,
  type OrderItem,
  type Product,
  type Profile,
  type Review,
  type Shipping,
} from "./types";
import { tripPay } from "./pricing";

const KEYS = {
  products: "agricart_products",
  orders: "agricart_orders",
  profiles: "agricart_profiles",
  reviews: "agricart_reviews",
  seeded: "agricart_seeded_v2",
} as const;

/**
 * The marker an older build wrote. Still honoured so an existing browser is
 * migrated rather than re-seeded: re-seeding writes SEED_PRODUCTS wholesale and
 * would throw away every listing the visitor added.
 */
const SEED_MARKER_V1 = "agricart_seeded_v1";

/** Stable empty value for server snapshots. */
const EMPTY: never[] = [];

type Guard<T> = (value: unknown) => value is T;

type Collection<T> = {
  get: () => T[];
  /** Returns false when storage refused the write, so callers can keep state. */
  write: (next: T[]) => boolean;
  update: (mutate: (previous: T[]) => T[]) => boolean;
  subscribe: (notify: () => void) => () => void;
};

function createCollection<T>(key: string, isValid: Guard<T>): Collection<T> {
  const event = `agricart_store_${key}`;
  let cache: T[] | null = null;

  const get = (): T[] => {
    if (cache) return cache;

    let parsed: unknown;
    try {
      const raw = window.localStorage.getItem(key);
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      parsed = null;
    }

    // Anything that is not a well-formed record is dropped rather than repaired,
    // so a hand-edited or half-migrated entry can never reach a total and
    // render as NaN.
    cache = Array.isArray(parsed) ? parsed.filter(isValid) : [];
    return cache;
  };

  const subscribe = (notify: () => void) => {
    const onStorage = (event: StorageEvent) => {
      // A null key means the whole store was cleared.
      if (event.key !== null && event.key !== key) return;
      cache = null;
      notify();
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener(event, notify);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(event, notify);
    };
  };

  const write = (next: T[]): boolean => {
    try {
      window.localStorage.setItem(key, JSON.stringify(next));
    } catch {
      return false;
    }
    // The writer has to drop its own cache: a storage event never comes back to
    // this tab, so nothing else would invalidate the value it just replaced.
    cache = null;
    window.dispatchEvent(new Event(event));
    return true;
  };

  const update = (mutate: (previous: T[]) => T[]) => write(mutate(get()));

  return { get, write, update, subscribe };
}

const products = createCollection<Product>(KEYS.products, isProduct);
const orders = createCollection<Order>(KEYS.orders, isOrder);
const profiles = createCollection<Profile>(KEYS.profiles, isProfile);
const reviews = createCollection<Review>(KEYS.reviews, isReview);

/**
 * The account directory is not a collection of its own - it belongs to
 * lib/session.ts, which also owns the key and the change event. All the admin
 * dashboard needs is a reactive view of it, so it is wrapped here with the same
 * cache-then-notify pattern rather than duplicating the storage handling.
 */
const USERS_CHANGED = "agricart_session_change";
let userCache: StoredUser[] | null = null;

function getUsers(): StoredUser[] {
  if (userCache) return userCache;
  userCache = readUsers();
  return userCache;
}

function subscribeUsers(notify: () => void) {
  const invalidate = () => {
    userCache = null;
    notify();
  };

  window.addEventListener("storage", invalidate);
  window.addEventListener(USERS_CHANGED, invalidate);

  return () => {
    window.removeEventListener("storage", invalidate);
    window.removeEventListener(USERS_CHANGED, invalidate);
  };
}

// ---------------------------------------------------------------------------
// First-run seed
// ---------------------------------------------------------------------------

/** Seed products keyed by id, for the by-id reconciliation below. */
const SEED_PRODUCT_BY_ID = new Map(SEED_PRODUCTS.map((product) => [product.id, product]));

/**
 * A seeded farmer's profile as SEED_FARMERS defines it: already Verified, so the
 * seeded listings clear the storefront gate the moment the catalogue is written
 * and no approval step stands between a fresh browser and a working storefront.
 */
function seedProfile(farmer: SeedFarmer, userId: string): Profile {
  return {
    ...emptyProfile(userId, farmer.role),
    farmName: farmer.farmName,
    location: farmer.location,
    photo: farmer.photo,
    bio: farmer.bio,
    accountStatus: "Verified",
  };
}

/**
 * The seeded accounts are written straight into the account list rather than
 * being registered through the form, because the seeded products have to belong
 * to accounts someone can actually sign into. Without them the catalogue would
 * exist with owners no farmer dashboard could ever show.
 */
function ensureSeedAccounts(): void {
  const users = readUsers();
  const additions: StoredUser[] = [];

  SEED_FARMERS.forEach((farmer, index) => {
    const id = SEED_FARMER_IDS[index];
    if (users.some((user) => user.id === id) || additions.some((user) => user.id === id)) return;

    additions.push({
      id,
      name: farmer.name,
      email: farmer.email,
      password: farmer.password,
      role: farmer.role,
      createdAt: new Date().toISOString(),
    });
  });

  if (additions.length > 0) writeUsers([...users, ...additions]);
}

/**
 * Restores any seeded account a visitor removed, and un-hides the listings that
 * removal hid.
 *
 * Removing an account (admin) deletes its profile row, deletes its account row
 * and hides every listing it owns - and because the seed marker is still set,
 * the first-run seed never runs again, so the catalogue would stay hidden
 * forever with no dashboard left to restore it.
 *
 * This fires only for a seeded account whose profile row is *missing*, which is
 * precisely what account removal produces. A farmer's own "Remove listing"
 * toggle and an admin suspension both leave the profile row in place, so both
 * still survive a reload untouched, and an existing profile's status is never
 * forced back to Verified.
 */
function ensureSeedProfiles(): void {
  const existing = profiles.get();
  const have = new Set(existing.map((profile) => profile.userId));

  const missing: Profile[] = [];
  const restoredIds = new Set<string>();
  SEED_FARMERS.forEach((farmer, index) => {
    const id = SEED_FARMER_IDS[index];
    if (have.has(id)) return;
    missing.push(seedProfile(farmer, id));
    restoredIds.add(id);
  });

  if (missing.length === 0) return;

  const hasHidden = products
    .get()
    .some((product) => restoredIds.has(product.farmerId) && product.hidden);
  if (hasHidden) {
    products.update((previous) =>
      previous.map((product) =>
        restoredIds.has(product.farmerId) && product.hidden
          ? { ...product, hidden: undefined }
          : product,
      ),
    );
  }

  // Written last so the Verified profiles are what open the gate: every render
  // after this write sees a complete, tradeable catalogue rather than a frame
  // of unhidden listings still blocked as "awaiting approval".
  profiles.update((previous) => [...previous, ...missing]);
}

/**
 * Brings a seeded farm's profile fields in line with the current SEED_FARMERS.
 *
 * The seed's descriptive fields - farm name, location, bio and the bundled
 * portrait - are catalogue data, not visitor data: a browser seeded by an older
 * build used to keep its stale copy forever, which is how Green Valley Farm
 * ended up photo-less on the storefront while its two siblings had portraits.
 * Only the three seeded ids are touched, and accountStatus, addresses, prefs
 * and any other personal field are left exactly as the farmer set them.
 *
 * A portrait the farmer uploaded themselves (a data:image/ URL from
 * lib/farmerPhoto.ts) is never overwritten - only a missing photo or a stale
 * /farmers/ seed path is replaced.
 */
function refreshSeedProfiles(): void {
  let changed = false;

  const next = profiles.get().map((profile) => {
    const index = SEED_FARMER_IDS.indexOf(profile.userId);
    if (index === -1) return profile;
    const farmer = SEED_FARMERS[index];

    const ownUpload =
      typeof profile.photo === "string" && profile.photo.startsWith("data:image/");
    const photo = ownUpload ? profile.photo : farmer.photo;

    if (
      profile.farmName === farmer.farmName &&
      profile.location === farmer.location &&
      profile.bio === farmer.bio &&
      photo === profile.photo
    ) {
      return profile;
    }

    changed = true;
    return { ...profile, farmName: farmer.farmName, location: farmer.location, bio: farmer.bio, photo };
  });

  if (changed) profiles.write(next);
}

/**
 * Renames the seeded accounts to match SEED_FARMERS, including the live session
 * if it happens to be one of them, so a demo farmer signed in before a rename
 * does not keep displaying the old name for the rest of the visit.
 */
function refreshSeedAccountNames(): void {
  const nameById = new Map(
    SEED_FARMERS.map((farmer, index) => [SEED_FARMER_IDS[index], farmer.name]),
  );

  const users = readUsers();
  let usersChanged = false;
  const nextUsers = users.map((user) => {
    const name = nameById.get(user.id);
    if (name === undefined || user.name === name) return user;
    usersChanged = true;
    return { ...user, name };
  });
  if (usersChanged) writeUsers(nextUsers);

  const session = readSession();
  if (!session) return;
  const name = nameById.get(sessionId(session));
  if (name !== undefined && session.name !== name) writeSession({ ...session, name });
}

/**
 * Points every seed product at the farm SEED_FARMERS now assigns it to, and
 * adds any seed product that is missing.
 *
 * Ownership is matched by the product's stable `seed-<category>-<index>` id, so
 * a browser seeded before the catalogue was split across three farms has its
 * existing listings re-attributed in place instead of duplicated. Everything
 * else a visitor may have changed on a listing - price, stock, hidden - is left
 * untouched.
 */
function reconcileSeedProducts(): void {
  const current = products.get();
  let changed = false;

  const next = current.map((product) => {
    const seed = SEED_PRODUCT_BY_ID.get(product.id);
    if (!seed) return product;
    if (
      product.farmerId === seed.farmerId &&
      product.farmer === seed.farmer &&
      product.location === seed.location
    ) {
      return product;
    }
    changed = true;
    return {
      ...product,
      farmerId: seed.farmerId,
      farmer: seed.farmer,
      location: seed.location,
    };
  });

  const present = new Set(current.map((product) => product.id));
  const missing = SEED_PRODUCTS.filter((seed) => !present.has(seed.id));
  if (missing.length > 0) changed = true;

  if (changed) products.write([...next, ...missing]);
}

/**
 * Brings an already-seeded browser in line with the current SEED_FARMERS without
 * overwriting visitor data: re-adds missing seeded accounts and profiles,
 * un-hides their removed listings, re-attributes the seeded catalogue, and
 * refreshes the three demo farms' own descriptive fields (name, location, bio,
 * bundled portrait) so a browser seeded by an older build self-heals.
 */
function reconcileSeed(): void {
  ensureSeedAccounts();
  ensureSeedProfiles();
  refreshSeedProfiles();
  refreshSeedAccountNames();
  reconcileSeedProducts();
}

let reconciledSeed = false;

/**
 * Writes the starting catalogue and its seeded farms exactly once, and migrates
 * an older seed on every later load.
 *
 * Idempotent and marker-guarded, so it is safe to call from the first read as
 * well as from an effect. `typeof window` is the guard that keeps it off the
 * server: during a prerender there is no storage and nothing should be written.
 */
function ensureSeeded() {
  if (typeof window === "undefined") return;

  let marker: string | null = null;
  let legacyMarker: string | null = null;
  try {
    marker = window.localStorage.getItem(KEYS.seeded);
    legacyMarker = window.localStorage.getItem(SEED_MARKER_V1);
  } catch {
    return;
  }

  // An existing install - either the current marker or the v1 one - is migrated
  // in place rather than re-seeded, which would discard the visitor's listings.
  if (marker || legacyMarker) {
    if (reconciledSeed) return;
    reconciledSeed = true;
    reconcileSeed();
    if (!marker) {
      try {
        window.localStorage.setItem(KEYS.seeded, new Date().toISOString());
      } catch {
        // See below: the marker is an optimisation, not the data.
      }
    }
    return;
  }

  products.write(SEED_PRODUCTS);
  profiles.write(
    SEED_FARMERS.map((farmer, index) => seedProfile(farmer, SEED_FARMER_IDS[index])),
  );
  ensureSeedAccounts();

  try {
    window.localStorage.setItem(KEYS.seeded, new Date().toISOString());
  } catch {
    // Nothing depends on the marker's own write succeeding; the collections
    // above are the real data.
  }
}

function useCollection<T>(collection: Collection<T>): T[] {
  return useSyncExternalStore<T[]>(collection.subscribe, collection.get, () => EMPTY as unknown as T[]);
}

/**
 * False during SSR and on the hydration render, true once the browser snapshot is
 * in hand. Same construction as useIsSessionReady: the first client render has
 * to agree with the server, so a collection reads as empty until React's
 * post-hydration check swaps in the real value. Gating a listing on this avoids
 * reporting "0 products" for the frame between the two.
 */
export function useStoreReady(): boolean {
  return useSyncExternalStore(
    (notify) => {
      window.addEventListener("storage", notify);
      return () => window.removeEventListener("storage", notify);
    },
    () => true,
    () => false,
  );
}

export function useProducts(): Product[] {
  return useCollection(products);
}

export function useOrders(): Order[] {
  return useCollection(orders);
}

export function useProfiles(): Profile[] {
  return useCollection(profiles);
}

/**
 * Whether a farm is cleared to sell.
 *
 * A farmer registers as Pending and only becomes Verified once an admin approves
 * the account; a suspension withdraws that clearance. This predicate is the one
 * place that decides it, so the storefront, the cart and placeOrder cannot drift
 * into disagreeing about who is allowed to trade.
 *
 * A product whose owner has no profile at all is not tradeable: that means the
 * owning account was removed, and removeAccount hides its listings anyway.
 */
export function isTradeable(farmerId: string, profiles: Profile[]): boolean {
  return profiles.some(
    (profile) => profile.userId === farmerId && profile.accountStatus === "Verified",
  );
}

/**
 * Why a listing cannot be bought, or "" when it can. The distinction matters: a
 * suspended farm and an unapproved one are different problems, and telling a
 * customer the produce "sold out" when the seller is in fact suspended is the kind
 * of thing that reads as a bug and gets reported as one.
 */
export function tradeBlockReason(product: Product, profiles: Profile[]): string {
  if (product.hidden) return "This listing is no longer available.";
  if (isTradeable(product.farmerId, profiles)) return "";

  const profile = profiles.find((candidate) => candidate.userId === product.farmerId);
  return profile?.accountStatus === "Suspended"
    ? "This farm's account is suspended, so its listings cannot be ordered."
    : "This farm is awaiting approval, so its listings cannot be ordered.";
}

/**
 * The catalogue a customer may actually buy from: not hidden, and owned by a
 * verified farm.
 *
 * The farmer dashboard deliberately does not use this. A farmer has to be able to
 * see and edit their own listings while Pending, otherwise the account would look
 * empty and there would be nothing to approve.
 */
export function useTradeableProducts(): Product[] {
  const all = useProducts();
  const profiles = useProfiles();

  return useMemo(
    () => all.filter((product) => !product.hidden && isTradeable(product.farmerId, profiles)),
    [all, profiles],
  );
}

export function useReviews(): Review[] {
  return useCollection(reviews);
}

/**
 * Every account in the directory, reactively. Used by the admin dashboard, whose
 * tables have to include accounts that were just registered or provisioned - a
 * one-shot readUsers() at render would leave the new row invisible until a
 * reload.
 */
export function useUsers(): StoredUser[] {
  return useSyncExternalStore<StoredUser[]>(
    subscribeUsers,
    getUsers,
    () => EMPTY as unknown as StoredUser[],
  );
}

/**
 * Runs the first-run seed on mount, from app/layout.tsx.
 *
 * Deliberately an effect rather than a module-level or render-time call: the
 * seed writes to localStorage, and a write during render is a side effect in a
 * pass React is allowed to run twice or throw away. useSyncExternalStore then
 * picks the new collection up through the same-tab event, so every subscriber
 * re-reads without this component knowing who they are.
 */
export function StoreHydrator() {
  useEffect(() => {
    ensureSeeded();
  }, []);
  return null;
}

// ---------------------------------------------------------------------------
// Read helpers (plain functions, for use outside React)
// ---------------------------------------------------------------------------

export const readProducts = (): Product[] => {
  ensureSeeded();
  return products.get();
};

export const readOrders = (): Order[] => orders.get();

export const readProfiles = (): Profile[] => {
  ensureSeeded();
  return profiles.get();
};

export const readReviews = (): Review[] => reviews.get();

/**
 * The profile for an account, or a blank one. Deliberately does not write: a
 * lookup that persisted itself would be a side effect during render, and a
 * profile only needs to exist once something is actually saved into it.
 */
export function profileFor(userId: string, role: Role): Profile {
  return readProfiles().find((profile) => profile.userId === userId) ?? emptyProfile(userId, role);
}

export { DEMO_FARMER, DEMO_FARMER_ID };

// ---------------------------------------------------------------------------
// Identifiers
// ---------------------------------------------------------------------------

let counter = 0;

/** Collision-resistant enough for a single-browser demo, and sortable by age. */
function uid(prefix: string): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

export const newProductId = () => uid("p");
export const newOrderId = (existing: Order[]) => {
  const highest = existing.reduce((max, order) => {
    const numeric = Number(order.id.replace(/\D/g, ""));
    return Number.isFinite(numeric) ? Math.max(max, numeric) : max;
  }, 1000);
  return `ORD-${highest + 1}`;
};

export const newGroupId = () => uid("grp");
export const newAddressId = () => uid("adr");
export const newPaymentId = () => uid("pm");
export const newReviewId = () => uid("rev");

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export type ProductDraft = {
  name: string;
  category: string;
  price: number;
  stockQty: number;
  unit: string;
  quality: string;
  image: string;
  discount?: string;
};

/**
 * Publishes a listing. Returns false if storage refused the write, so the form
 * can tell the farmer their crop was not saved instead of closing on a lie.
 */
export function createProduct(
  draft: ProductDraft,
  owner: { id: string; farmName: string; location: string },
): boolean {
  const product: Product = {
    id: newProductId(),
    category: draft.category.trim(),
    name: draft.name.trim(),
    price: draft.price,
    image: draft.image,
    unit: draft.unit.trim(),
    quality: draft.quality.trim() || "Grade A",
    rating: 0,
    farmerId: owner.id,
    farmer: owner.farmName.trim() || "Your Farm",
    location: owner.location.trim() || "India",
    stockQty: draft.stockQty,
    discount: draft.discount?.trim() || undefined,
    createdAt: new Date().toISOString(),
  };

  return products.update((previous) => [...previous, product]);
}

export function updateProduct(id: string, patch: Partial<Product>): boolean {
  return products.update((previous) =>
    previous.map((product) => (product.id === id ? { ...product, ...patch, id } : product)),
  );
}

/**
 * Hides rather than deletes. A hard delete shifts the indices of every product
 * after it, and both the cart and /product/[category]/[index] address products by
 * that index, so deleting a live listing would turn basket links into 404s.
 */
export function hideProduct(id: string, hidden: boolean): boolean {
  return updateProduct(id, { hidden });
}

/**
 * Pushes a farmer's saved farm name and location onto every listing they own.
 *
 * `farmer` and `location` are denormalised onto a Product so the shop can render
 * a card without joining the profile, which means a profile edit alone would
 * leave the storefront still printing the values the listing was published with.
 * One write over the farmer's own rows keeps the two in step.
 *
 * Orders are deliberately untouched: a completed order records the farm as it
 * was at the time of sale, and rewriting history would change the receipts the
 * customer and the farmer already have.
 */
export function syncFarmerIdentity(
  farmerId: string,
  patch: { farmer?: string; location?: string },
): boolean {
  if (!patch.farmer && !patch.location) return true;

  return products.update((previous) =>
    previous.map((product) => {
      if (product.farmerId !== farmerId) return product;
      return {
        ...product,
        farmer: patch.farmer ?? product.farmer,
        location: patch.location ?? product.location,
      };
    }),
  );
}

// There is deliberately no hard delete. See hideProduct above: the cart and the
// product route address listings by index, so removing one would renumber
// everything after it and break links that are already in people's baskets.

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export type CheckoutLine = {
  productId: string;
  category: string;
  name: string;
  farmerId: string;
  farmer: string;
  image: string;
  unit: string;
  price: number;
  quantity: number;
};

export type PlaceOrderResult =
  | { ok: true; groupId: string; orderIds: string[] }
  /**
   * `reason` is a machine-readable case so callers can react (the checkout form
   * tells the customer a specific item sold out), `detail` is the sentence to
   * show. Conflating the two is how a UI ends up rendering "no stock" at someone
   * who paid.
   */
  | { ok: false; reason: "no stock" | "unavailable" | "storage"; detail: string };

/**
 * Turns a paid basket into orders.
 *
 * The basket is split by the farm that owns each line, so a mixed basket becomes
 * one order per farmer. That is what a marketplace does, and it is what keeps
 * each farmer's sales, revenue and stock movement to their own products instead
 * of requiring every order to be apportioned by hand.
 *
 * The delivery fee the customer was quoted is charged once, on the first order of
 * the group, and the rest carry none. Recomputing the free-delivery threshold per
 * farmer would be more realistic per seller but the parts would no longer add up
 * to the total that was shown and paid at checkout.
 */
export function placeOrder(input: {
  customer: { id: string; name: string };
  lines: CheckoutLine[];
  subtotal: number;
  deliveryFee: number;
  shipping: Shipping;
}): PlaceOrderResult {
  const available = readProducts();

  // Refuse rather than oversell: a basket can outlive the listing it was built
  // from, and quietly selling stock that is not there is worse than an error.
  const shortfall = input.lines.find((line) => {
    const product = available.find((candidate) => candidate.id === line.productId);
    return !product || product.hidden || product.stockQty < line.quantity;
  });
  if (shortfall) {
    return { ok: false, reason: "no stock", detail: `${shortfall.name} is no longer available in that quantity.` };
  }

  // Approval is re-checked here, not only in the storefront. A basket can be built
  // while a farm is Verified and then sit in the cart through a suspension, and
  // the customer pays for the whole basket before this runs - so the gate has to
  // hold at the point of writing the order, not just at the point of display.
  const profiles = readProfiles();
  const gated = input.lines
    .map((line) => available.find((candidate) => candidate.id === line.productId))
    .find((product) => product !== undefined && !isTradeable(product.farmerId, profiles));
  if (gated) {
    return { ok: false, reason: "unavailable", detail: tradeBlockReason(gated, profiles) };
  }

  const byFarmer = new Map<string, OrderItem[]>();
  for (const line of input.lines) {
    const bucket = byFarmer.get(line.farmerId) ?? [];
    bucket.push({
      productId: line.productId,
      category: line.category,
      name: line.name,
      farmerId: line.farmerId,
      farmer: line.farmer,
      image: line.image,
      unit: line.unit,
      price: line.price,
      quantity: line.quantity,
    });
    byFarmer.set(line.farmerId, bucket);
  }

  const existing = orders.get();
  const groupId = newGroupId();
  const placedAt = new Date().toISOString();
  let feeRemaining = input.deliveryFee;

  // Built with a loop rather than `.map()` over the buckets: newOrderId has to
  // see the orders already produced in this group to number the next one, and
  // reading `created` from inside its own initialiser is a temporal dead zone -
  // a ReferenceError the moment a customer checked out. `seq` carries the
  // numbers forward instead.
  const created: Order[] = [];
  let seq = existing;

  for (const items of byFarmer.values()) {
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    // The whole delivery fee lands on the first order of the group, so the sum of
    // the order totals equals the cart total exactly.
    const deliveryFee = feeRemaining;
    feeRemaining = 0;

    const order: Order = {
      id: newOrderId(seq),
      groupId,
      customerId: input.customer.id,
      customerName: input.customer.name,
      items,
      subtotal,
      deliveryFee,
      total: subtotal + deliveryFee,
      shipping: input.shipping,
      status: "Placed",
      agentId: null,
      agentName: null,
      placedAt,
      deliveredAt: null,
      payPerTrip: 0,
      rating: null,
    };

    created.push(order);
    seq = [...seq, order];
  }

  // Orders first. If this write is refused the basket is untouched and the
  // customer keeps their cart, which is the recoverable outcome; losing the
  // stock decrement instead would let the same units be sold twice.
  if (!orders.update((previous) => [...previous, ...created])) {
    return {
      ok: false,
      reason: "storage",
      detail: "Your order could not be saved on this device.",
    };
  }

  products.update((previous) =>
    previous.map((product) => {
      const line = input.lines.find((candidate) => candidate.productId === product.id);
      return line ? { ...product, stockQty: Math.max(product.stockQty - line.quantity, 0) } : product;
    }),
  );

  return { ok: true, groupId, orderIds: created.map((order) => order.id) };
}

/**
 * Claims an unowned order for a delivery agent. This is the agent's action in
 * the self-claim queue and the counterpart to placeOrder: a checkout writes a
 * Placed order with no agent, and this is what turns it into a trip.
 *
 * Guarded on `agentId === null`, so two agents - or two tabs of the same agent -
 * cannot both take the same parcel. The first write wins and the second is a
 * no-op, which is what keeps one order from appearing in two queues at once and
 * credits its pay to only the agent who actually carries it.
 */
export function claimOrder(
  orderId: string,
  agent: { id: string; name: string },
): boolean {
  let changed = false;

  orders.update((previous) =>
    previous.map((order) => {
      if (order.id !== orderId) return order;
      if (order.agentId !== null || order.status !== "Placed") return order;

      changed = true;
      return {
        ...order,
        agentId: agent.id,
        agentName: agent.name,
        // Priced at claim time from what the parcel actually weighs up as, so
        // the agent's earnings follow the real order rather than a fixed fee.
        payPerTrip: tripPay(orderItemCount(order)),
        status: "Assigned",
        delayed: undefined,
        delayedReason: undefined,
      };
    }),
  );

  return changed;
}

/**
 * Advances a claimed order to the next step in ORDER_FLOW. Forward-only via
 * nextOrderStatus, so a stale click can never walk a parcel backwards out of
 * Delivered. Reaching Delivered stamps the completion time that the customer's
 * tracking, the agent's earnings and the admin's totals all read.
 */
export function advanceOrder(orderId: string): boolean {
  let changed = false;

  orders.update((previous) =>
    previous.map((order) => {
      if (order.id !== orderId) return order;

      const next = nextOrderStatus(order.status);
      if (!next) return order;

      changed = true;
      return {
        ...order,
        status: next,
        deliveredAt:
          next === "Delivered" ? new Date().toISOString() : order.deliveredAt,
      };
    }),
  );

  return changed;
}

/** Assigns an order to a delivery agent. This is the farmer's action. No-op if
 * the order is already delivered or cancelled, or has been picked up already. */
export function assignOrderToAgent(
  orderId: string,
  agent: { id: string; name: string },
): boolean {
  let changed = false;

  orders.update((previous) =>
    previous.map((order) => {
      if (order.id !== orderId) return order;
      // Only an order that has not left the farm can be (re)assigned.
      if (order.status !== "Placed" && order.status !== "Assigned") return order;
      changed = true;
      return {
        ...order,
        agentId: agent.id,
        agentName: agent.name,
        // Priced at assignment time from what the parcel actually weighs up as,
        // so the agent's earnings follow the real order rather than a fixed fee.
        payPerTrip: tripPay(orderItemCount(order)),
        status: "Assigned",
        delayed: undefined,
        delayedReason: undefined,
      };
    }),
  );

  return changed;
}

/** Pulls a not-yet-picked-up order back from its agent, returning it to the pool. */
export function unassignOrder(orderId: string): boolean {
  let changed = false;

  orders.update((previous) =>
    previous.map((order) => {
      if (order.id !== orderId) return order;
      if (order.status !== "Placed" && order.status !== "Assigned") return order;
      changed = true;
      return {
        ...order,
        agentId: null,
        agentName: null,
        payPerTrip: 0,
        status: "Placed",
        delayed: undefined,
        delayedReason: undefined,
      };
    }),
  );

  return changed;
}

/**
 * Advances an assigned order along the agent's steps. Forward-only, so an order
 * can never be walked backwards out of Delivered, and a stale click can never
 * reset progress. `Delivered` stamps the completion time.
 */
export function setOrderStatus(orderId: string, status: AgentOrderStep): boolean {
  let changed = false;

  orders.update((previous) =>
    previous.map((order) => {
      if (order.id !== orderId) return order;
      const currentIndex = (ORDER_FLOW as readonly string[]).indexOf(order.status);
      const targetIndex = (ORDER_FLOW as readonly string[]).indexOf(status);
      if (currentIndex < 0 || targetIndex <= currentIndex) return order;

      changed = true;
      return {
        ...order,
        status,
        deliveredAt: status === "Delivered" ? new Date().toISOString() : order.deliveredAt,
      };
    }),
  );

  return changed;
}

/**
 * Flags an in-flight order as delayed (or clears the flag). Deliberately not a
 * status: the order keeps its place and can still be marked delivered, so a
 * delay never strands a parcel outside the normal flow.
 */
export function setOrderDelayed(orderId: string, delayed: boolean, reason = ""): boolean {
  let changed = false;

  orders.update((previous) =>
    previous.map((order) => {
      if (order.id !== orderId) return order;
      if (order.status === "Delivered" || order.status === "Cancelled") return order;

      const nextReason = delayed ? reason.trim() : "";
      if (order.delayed === delayed && (order.delayedReason ?? "") === nextReason) {
        return order;
      }

      changed = true;
      return {
        ...order,
        delayed,
        delayedReason: delayed ? nextReason || undefined : undefined,
      };
    }),
  );

  return changed;
}

/** Returns a claimed order to the pool, e.g. when an agent goes offline. */
export function releaseOrder(orderId: string): boolean {
  return orders.update((previous) =>
    previous.map((order) =>
      order.id === orderId &&
      (order.status === "Placed" || order.status === "Assigned")
        ? {
            ...order,
            agentId: null,
            agentName: null,
            payPerTrip: 0,
            status: "Placed",
            delayed: undefined,
            delayedReason: undefined,
          }
        : order,
    ),
  );
}

export function ordersForAgent(agentId: string): Order[] {
  return orders.get().filter((order) => order.agentId === agentId);
}

export function ordersForFarmer(farmerId: string): Order[] {
  return orders.get().filter((order) => order.items.some((item) => item.farmerId === farmerId));
}

export function ordersForCustomer(customerId: string): Order[] {
  return orders.get().filter((order) => order.customerId === customerId);
}

export type ApprovedAgent = {
  id: string;
  name: string;
  onDuty: boolean;
};

/**
 * The delivery agents a farmer may assign an order to: approved accounts only
 * (never a pending or suspended one), so the dropdown can never route a parcel
 * to an agent the admin has not cleared.
 */
export function approvedAgents(users: StoredUser[], profiles: Profile[]): ApprovedAgent[] {
  const profileById = new Map(profiles.map((profile) => [profile.userId, profile]));

  return users
    .filter((user) => user.role === "delivery")
    .flatMap((user) => {
      const profile = profileById.get(user.id);
      if (!profile || !isAgentApproved(profile.accountStatus)) return [];
      return [{ id: user.id, name: user.name, onDuty: profile.accountStatus === "On-Duty" }];
    })
    .sort((a, b) => Number(b.onDuty) - Number(a.onDuty) || a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

/** Records a rating against a delivered order and mirrors it onto the order. */
export function reviewOrder(orderId: string, rating: number, comment: string): boolean {
  const order = orders.get().find((candidate) => candidate.id === orderId);
  // Only a completed delivery can be reviewed, otherwise an agent could be rated
  // before they ever carried the parcel.
  if (!order || order.status !== "Delivered" || !order.agentId) return false;
  if (order.rating !== null) return false;

  const review: Review = {
    id: newReviewId(),
    orderId: order.id,
    agentId: order.agentId,
    agentName: order.agentName ?? "Agent",
    customerId: order.customerId,
    customerName: order.customerName,
    rating,
    comment: comment.trim(),
    createdAt: new Date().toISOString(),
  };

  if (!reviews.update((previous) => [...previous, review])) return false;
  orders.update((previous) =>
    previous.map((candidate) => (candidate.id === orderId ? { ...candidate, rating } : candidate)),
  );
  return true;
}

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------

export function updateProfile(
  userId: string,
  role: Role,
  mutate: (previous: Profile) => Profile,
): boolean {
  return profiles.update((previous) => {
    const existing = previous.find((profile) => profile.userId === userId);
    return [
      ...previous.filter((profile) => profile.userId !== userId),
      mutate(existing ?? emptyProfile(userId, role)),
    ];
  });
}

export function setAccountStatus(userId: string, role: Role, status: AccountStatus): boolean {
  return updateProfile(userId, role, (previous) => ({ ...previous, accountStatus: status }));
}

// ---------------------------------------------------------------------------
// Accounts (admin provisioning)
// ---------------------------------------------------------------------------

export type ProvisionedAccount = { account: StoredUser; password: string };

/**
 * Creates a real account from the admin dashboard, so the row it inserts can
 * actually sign in rather than being a directory entry with no login behind it.
 * The generated password is returned once, for the admin to pass on - it is
 * stored verbatim, exactly as a self-registered password is.
 */
export function provisionAccount(input: {
  name: string;
  email: string;
  role: Role;
  status: AccountStatus;
}): ProvisionedAccount | { error: string } {
  const email = input.email.trim().toLowerCase();
  if (!email) return { error: "An email address is required." };

  const id = accountId(email, input.role);
  const users = readUsers();
  if (users.some((user) => user.id === id)) {
    return { error: `An account already exists for ${email} as ${input.role}.` };
  }

  const password = `agri${Math.random().toString(36).slice(2, 8)}`;
  const account: StoredUser = {
    id,
    name: input.name.trim(),
    email,
    password,
    role: input.role,
    createdAt: new Date().toISOString(),
  };

  if (!writeUsers([...users, account])) {
    return { error: "This device refused to store the new account." };
  }

  updateProfile(id, input.role, (previous) => ({
    ...previous,
    accountStatus: input.status,
  }));

  return { account, password };
}

/**
 * Removes an account. Their listings are hidden rather than deleted, and their
 * orders are left alone: an order is a transaction that already happened, and
 * rewriting it would change the revenue the other dashboards have reported.
 */
export function removeAccount(userId: string, role: Role): boolean {
  const users = readUsers();
  const account = users.find((user) => user.id === userId);
  // The role is part of the key, so a mismatched pair means the caller is about
  // to remove an account it never meant to target.
  if (!account || account.role !== role) return false;

  writeUsers(users.filter((user) => user.id !== userId));
  profiles.update((previous) => previous.filter((profile) => profile.userId !== userId));
  products.update((previous) =>
    previous.map((product) =>
      product.farmerId === userId ? { ...product, hidden: true } : product,
    ),
  );
  return true;
}

/** Used by the login form so a new account starts with a real profile. */
export function ensureProfileFor(userId: string, role: Role, farm?: { farmName: string; location: string }) {
  if (readProfiles().some((profile) => profile.userId === userId)) return;
  updateProfile(userId, role, (previous) => ({
    ...previous,
    farmName: farm?.farmName ?? previous.farmName,
    location: farm?.location ?? previous.location,
  }));
}
