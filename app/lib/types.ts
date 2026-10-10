/**
 * The domain model every surface agrees on.
 *
 * The farmer dashboard used to describe a listing as `{ id: "P-001", stock:
 * "45 kg", price: "\u20b940/kg" }` while the storefront described the same
 * product as `{ name, price: 40, unit: "1kg", stock: "In Stock" }`. Nothing
 * could move between the two without a lossy conversion, which is why a farmer
 * listing could never become something a customer could actually buy.
 *
 * There is now exactly one Product, one Order and one Profile, and each of the
 * four dashboards derives its view from those instead of owning a mock array.
 */

/** The six storefront categories, plus whatever new ones a farmer introduces. */
export const CATEGORIES = [
  "Fresh Vegetables",
  "Fresh Fruits",
  "Dairy Products",
  "Organic Grains",
  "Herbs & Spices",
  "Farm Fresh Eggs",
] as const;

export type CategoryName = (typeof CATEGORIES)[number] | (string & {});

/** Flat/unit hint for a product, e.g. "1kg", "500g", "12 pcs". */
export type Product = {
  id: string;
  category: string;
  name: string;
  /** Rupees, as a number. Rendered with a rupee sign at the edge. */
  price: number;
  /** A path under /public. Never a remote URL, so next/image stays local. */
  image: string;
  unit: string;
  rating: number;
  /** Owner. Derived from the account, so the farmer dashboard can scope on it. */
  farmerId: string;
  /** Display name of the farm, denormalised so listings render without a join. */
  farmer: string;
  location: string;
  quality: string;
  /**
   * Numeric stock. This is what the old stringly-typed `stock` field could not
   * be: a numeric quantity is the only form that can be decremented by a sale
   * and still mean something.
   */
  stockQty: number;
  discount?: string;
  /**
   * Soft delete. A hard delete would shift the indices of everything after it,
   * and both the cart and the product route address products by
   * (category, index), so a hard delete would turn live basket links into 404s.
   */
  hidden?: boolean;
  createdAt: string;
};

export type StockStatus = "In Stock" | "Low Stock" | "Out of Stock";

/** Below this, a listing is flagged as low rather than simply available. */
export const LOW_STOCK_THRESHOLD = 5;

/**
 * Status is derived, never stored. The farmer row menu used to write
 * `"0 Out of Stock"` into the stock field, destroying the unit along with the
 * quantity.
 */
export function stockStatus(qty: number): StockStatus {
  if (!Number.isFinite(qty) || qty <= 0) return "Out of Stock";
  if (qty <= LOW_STOCK_THRESHOLD) return "Low Stock";
  return "In Stock";
}

export function isPurchasable(product: Product): boolean {
  return !product.hidden && product.stockQty > 0;
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export const ORDER_FLOW = [
  "Placed",
  "Assigned",
  "Picked up",
  "In Transit",
  "Delivered",
] as const;

export type DeliveredStatus = (typeof ORDER_FLOW)[number];
export type OrderStatus = DeliveredStatus | "Cancelled";

export function nextOrderStatus(status: string): DeliveredStatus | null {
  const index = (ORDER_FLOW as readonly string[]).indexOf(status);
  if (index < 0 || index === ORDER_FLOW.length - 1) return null;
  return ORDER_FLOW[index + 1];
}

/**
 * The steps a delivery agent can set, in order. "Delayed" is not here because it
 * is a flag on the order rather than a stop in the flow: a delayed parcel keeps
 * its place and can still be marked delivered afterwards.
 */
export const AGENT_ORDER_STEPS = ["Picked up", "In Transit", "Delivered"] as const;
export type AgentOrderStep = (typeof AGENT_ORDER_STEPS)[number];

export type OrderItem = {
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

export type Shipping = {
  fullName: string;
  phone: string;
  address: string;
};

export type Order = {
  id: string;
  /**
   * A single checkout that split into one order per farmer shares a group id,
   * so the customer dashboard can present it as the one payment they made even
   * though each farmer sees only their own order.
   */
  groupId: string;
  customerId: string;
  customerName: string;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  shipping: Shipping;
  status: OrderStatus;
  /** null until a farmer assigns a delivery agent to this order. */
  agentId: string | null;
  agentName: string | null;
  placedAt: string;
  deliveredAt: string | null;
  /** What the agent earns for this trip. Set when the farmer assigns the order. */
  payPerTrip: number;
  rating: number | null;
  /**
   * A flag, not a status: the agent reports a delay without losing the order's
   * place in ORDER_FLOW, so it can still be marked delivered afterwards.
   */
  delayed?: boolean;
  delayedReason?: string;
};

export function orderItemCount(order: Order): number {
  return order.items.reduce((sum, item) => sum + item.quantity, 0);
}

/** What the customer paid across every order their checkout produced. */
export function groupTotal(orders: Order[]): number {
  return orders.reduce((sum, order) => sum + order.total, 0);
}

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------

export const ACCOUNT_STATUSES = [
  "New",
  "Pending",
  "Active",
  "Verified",
  "On-Duty",
  "Offline",
  "Suspended",
] as const;

export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

/** The status each role is created with, and the one a reinstatement returns to. */
export const INITIAL_STATUS = {
  customer: "New",
  farmer: "Pending",
  delivery: "Pending",
  admin: "Active",
} as const satisfies Record<string, AccountStatus>;

export const RESTORE_STATUS = {
  customer: "Active",
  farmer: "Verified",
  delivery: "Offline",
  admin: "Active",
} as const satisfies Record<string, AccountStatus>;

/** The status a row is in when it is behaving normally. */
export const HEALTHY_STATUS = {
  customer: "Active",
  farmer: "Verified",
  delivery: "On-Duty",
  admin: "Active",
} as const satisfies Record<string, AccountStatus>;

/**
 * Whether a delivery agent account has cleared admin approval. A new agent is
 * created Pending and cannot use the delivery dashboard until the admin approves
 * them (which moves them to Offline); a suspended agent is also barred.
 */
export function isAgentApproved(status: AccountStatus): boolean {
  return status !== "Pending" && status !== "Suspended";
}

export type Address = {
  id: string;
  label: string;
  address: string;
  isDefault: boolean;
};

export const PAYMENT_KINDS = [
  "Card",
  "UPI",
  "Net Banking",
  "Wallet",
  "Cash on Delivery",
] as const;

export type PaymentKind = (typeof PAYMENT_KINDS)[number];

export type PaymentMethod = {
  id: string;
  label: string;
  detail: string;
  kind: PaymentKind;
  isDefault: boolean;
};

export type Vehicle = {
  number: string;
  make: string;
  model: string;
  year: string;
  insuranceValid: string;
  batteryHealth: string;
};

export type Profile = {
  userId: string;
  /** Farmer-owned. The storefront shows this as the product's farm. */
  farmName?: string;
  location?: string;
  /**
   * Farmer-owned. A square photo the farmer uploads from their dashboard,
   * stored as a data URL so it survives a reload without a backend. Capped in
   * size by lib/farmerPhoto.ts, because it lives in localStorage next to
   * everything else.
   */
  photo?: string;
  /** Farmer-owned. Short introduction shown on the storefront farmer card. */
  bio?: string;
  addresses: Address[];
  paymentMethods: PaymentMethod[];
  vehicle?: Vehicle;
  /** Delivery agents only. Admin's agent table and the claim gate read this. */
  isOnline: boolean;
  accountStatus: AccountStatus;
  prefs: {
    orderUpdates: boolean;
    smsAlerts: boolean;
  };
};

export function emptyProfile(userId: string, role: keyof typeof INITIAL_STATUS): Profile {
  return {
    userId,
    farmName: role === "farmer" ? "" : undefined,
    location: role === "farmer" ? "" : undefined,
    addresses: [],
    paymentMethods: [],
    vehicle: undefined,
    isOnline: false,
    accountStatus: INITIAL_STATUS[role],
    prefs: { orderUpdates: true, smsAlerts: false },
  };
}

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

export type Review = {
  id: string;
  orderId: string;
  agentId: string;
  agentName: string;
  customerId: string;
  customerName: string;
  /** 1-5. */
  rating: number;
  comment: string;
  createdAt: string;
};

export function meanRating(ratings: number[]): number {
  if (ratings.length === 0) return 0;
  const total = ratings.reduce((sum, value) => sum + value, 0);
  return Math.round((total / ratings.length) * 10) / 10;
}

// ---------------------------------------------------------------------------
// Runtime validation
// ---------------------------------------------------------------------------
//
// Every value below comes out of localStorage, which is user-writable and
// survives a version change. Each collection filters against these before use;
// a malformed record is dropped rather than repaired, so it can never reach a
// total and render as NaN. Same approach as lib/session.ts and lib/order.ts.

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isStr = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

const isNum = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isOptStr = (value: unknown): value is string | undefined =>
  value === undefined || typeof value === "string";

export function isProduct(value: unknown): value is Product {
  if (!isObject(value)) return false;
  return (
    isStr(value.id) &&
    isStr(value.category) &&
    isStr(value.name) &&
    isNum(value.price) &&
    isStr(value.image) &&
    isStr(value.unit) &&
    isNum(value.rating) &&
    isStr(value.farmerId) &&
    isStr(value.farmer) &&
    isStr(value.location) &&
    isStr(value.quality) &&
    isNum(value.stockQty) &&
    isOptStr(value.discount) &&
    (value.hidden === undefined || typeof value.hidden === "boolean") &&
    isStr(value.createdAt)
  );
}

export function isOrderItem(value: unknown): value is OrderItem {
  if (!isObject(value)) return false;
  return (
    isStr(value.productId) &&
    isStr(value.category) &&
    isStr(value.name) &&
    isStr(value.farmerId) &&
    isStr(value.farmer) &&
    isStr(value.image) &&
    isStr(value.unit) &&
    isNum(value.price) &&
    isNum(value.quantity)
  );
}

export function isOrder(value: unknown): value is Order {
  if (!isObject(value)) return false;

  const shipping = value.shipping;
  if (!isObject(shipping)) return false;
  if (!isStr(shipping.fullName) || !isStr(shipping.phone) || !isStr(shipping.address)) {
    return false;
  }

  return (
    isStr(value.id) &&
    isStr(value.groupId) &&
    isStr(value.customerId) &&
    isStr(value.customerName) &&
    Array.isArray(value.items) &&
    value.items.every(isOrderItem) &&
    isNum(value.subtotal) &&
    isNum(value.deliveryFee) &&
    isNum(value.total) &&
    isStr(value.status) &&
    (value.agentId === null || isStr(value.agentId)) &&
    (value.agentName === null || isStr(value.agentName)) &&
    isStr(value.placedAt) &&
    (value.deliveredAt === null || isStr(value.deliveredAt)) &&
    isNum(value.payPerTrip) &&
    (value.rating === null || isNum(value.rating)) &&
    (value.delayed === undefined || typeof value.delayed === "boolean") &&
    (value.delayedReason === undefined || typeof value.delayedReason === "string")
  );
}

export function isAddress(value: unknown): value is Address {
  if (!isObject(value)) return false;
  return (
    isStr(value.id) &&
    isStr(value.label) &&
    isStr(value.address) &&
    typeof value.isDefault === "boolean"
  );
}

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  if (!isObject(value)) return false;
  return (
    isStr(value.id) &&
    isStr(value.label) &&
    isStr(value.detail) &&
    isStr(value.kind) &&
    typeof value.isDefault === "boolean"
  );
}

export function isVehicle(value: unknown): value is Vehicle {
  if (!isObject(value)) return false;
  return (
    isStr(value.number) &&
    isStr(value.make) &&
    isStr(value.model) &&
    isStr(value.year) &&
    isStr(value.insuranceValid) &&
    isStr(value.batteryHealth)
  );
}

/** Upper bound for a farm bio, so one profile cannot fill the whole card. */
export const MAX_BIO_LENGTH = 400;

export function isProfile(value: unknown): value is Profile {
  if (!isObject(value)) return false;
  if (!isStr(value.userId)) return false;
  if (value.farmName !== undefined && typeof value.farmName !== "string") return false;
  if (value.location !== undefined && typeof value.location !== "string") return false;
  // A photo is either the data URL lib/farmerPhoto.ts produces (a farmer's own
  // upload) or a root-relative public path (a seeded portrait). Anything else -
  // a remote or protocol-relative URL, a truncated write - would render a
  // broken image on the storefront, so the record is dropped rather than
  // repaired. A leading "//" is rejected because browsers read it as a host,
  // not a path.
  const isPhoto =
    typeof value.photo === "string" &&
    (value.photo.startsWith("data:image/") ||
      (value.photo.startsWith("/") && !value.photo.startsWith("//")));
  if (value.photo !== undefined && !isPhoto) {
    return false;
  }
  if (
    value.bio !== undefined &&
    (typeof value.bio !== "string" || value.bio.length > MAX_BIO_LENGTH)
  ) {
    return false;
  }
  if (!Array.isArray(value.addresses) || !value.addresses.every(isAddress)) return false;
  if (
    !Array.isArray(value.paymentMethods) ||
    !value.paymentMethods.every(isPaymentMethod)
  ) {
    return false;
  }
  if (value.vehicle !== undefined && !isVehicle(value.vehicle)) return false;
  if (typeof value.isOnline !== "boolean") return false;
  if (!isStr(value.accountStatus)) return false;
  if (!isObject(value.prefs)) return false;
  return (
    typeof value.prefs.orderUpdates === "boolean" &&
    typeof value.prefs.smsAlerts === "boolean"
  );
}

export function isReview(value: unknown): value is Review {
  if (!isObject(value)) return false;
  return (
    isStr(value.id) &&
    isStr(value.orderId) &&
    isStr(value.agentId) &&
    isStr(value.agentName) &&
    isStr(value.customerId) &&
    isStr(value.customerName) &&
    isNum(value.rating) &&
    typeof value.comment === "string" &&
    isStr(value.createdAt)
  );
}
