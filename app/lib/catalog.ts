/**
 * The product catalogue seed, and the pure helpers that work over any list of
 * products.
 *
 * This module is deliberately free of localStorage and React, so the product
 * route can import it on the server. It is used for three things:
 *
 *   1. The first-run seed of the live store (lib/store.ts).
 *   2. The product route's static path, which still prerenders from here.
 *   3. The image library a farmer picks from when creating a listing.
 *
 * The live catalogue is never read from here - that comes from the store. What
 * lives in this file is what the store is seeded with, and the functions below
 * are pure so both the server page and the client pages can share them.
 */

import { CATEGORIES, type Product } from "./types";
import { accountId } from "./session";

export { CATEGORIES };

export type SeedFarmer = {
  email: string;
  name: string;
  password: string;
  role: "farmer";
  farmName: string;
  location: string;
  bio: string;
  /** Root-relative public path; see the photo rule in lib/types.ts isProfile. */
  photo: string;
};

/**
 * The farms the catalogue is seeded with.
 *
 * A fresh browser used to seed a single farmer, which meant the "Meet Our
 * Farmers" carousel on the home page had one card and no rotation until a
 * visitor registered farms of their own. Seeding three gives the live demo the
 * section it advertises out of the box, and each one is Verified with listings
 * so it clears the storefront gate immediately.
 *
 * The first entry is the demo login every other module already expects
 * (lib/store.ts re-exports DEMO_FARMER / DEMO_FARMER_ID from here), so signing
 * in as demo@greenvalley.farm still shows a real, populated inventory.
 */
export const SEED_FARMERS: SeedFarmer[] = [
  {
    email: "demo@greenvalley.farm",
    name: "Ramesh Kumar",
    password: "demo1234",
    role: "farmer",
    farmName: "Green Valley Farm",
    location: "Palakkad, Kerala",
    bio: "Third-generation grower tending seven acres of vegetables and spices in Palakkad. We pick to order and deliver within a day.",
    photo: "/farmers/male-farmer-01.jpg",
  },
  {
    email: "sunrise@agricart.farm",
    name: "Anitha Nair",
    password: "demo1234",
    role: "farmer",
    farmName: "Sunrise Organics",
    location: "Wayanad, Kerala",
    bio: "Tending fruit orchards in the Wayanad hills for over thirty years. Seasonal bananas, mangoes and papaya, picked ripe and delivered fresh.",
    photo: "/farmers/female-farmer-01.jpg",
  },
  {
    email: "mistyhills@agricart.farm",
    name: "Gurpreet Singh",
    password: "demo1234",
    role: "farmer",
    farmName: "Majha Dairy Farm",
    location: "Ludhiana, Punjab",
    bio: "A family dairy and poultry farm outside Ludhiana. Grass-fed cows, free-ranging hens and wheat grown on the same land, no shortcuts.",
    photo: "/farmers/male-farmer-02.jpg",
  },
];

/** Stable account id per seeded farmer, in the same order as SEED_FARMERS. */
export const SEED_FARMER_IDS: string[] = SEED_FARMERS.map((farmer) =>
  accountId(farmer.email, farmer.role),
);

/** The demo login, kept as a named export for the rest of the app. */
export const DEMO_FARMER = SEED_FARMERS[0];
export const DEMO_FARMER_ID = SEED_FARMER_IDS[0];

/**
 * Which seeded farm owns each category's listings, as an index into
 * SEED_FARMERS. Splitting by category keeps each dashboard's inventory coherent
 * (a dairy farm does not list potatoes) while giving every seeded card a real
 * listing count, which is what the storefront carousel gates on.
 */
const CATEGORY_FARMER: Record<string, number> = {
  "Fresh Vegetables": 0,
  "Herbs & Spices": 0,
  "Fresh Fruits": 1,
  "Dairy Products": 2,
  "Farm Fresh Eggs": 2,
  "Organic Grains": 2,
};

const slug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/**
 * Compact seed rows: name, price, image, rating, unit, stock, quality, discount.
 * The farmer and location are filled from SEED_FARMERS via CATEGORY_FARMER, so
 * every listing is owned by a real account that can be signed into and whose
 * dashboard shows exactly the products it owns.
 */
type SeedRow = [
  name: string,
  price: number,
  image: string,
  rating: number,
  unit: string,
  stockQty: number,
  quality: string,
  discount?: string,
];

const SEED_ROWS: Record<string, SeedRow[]> = {
  "Fresh Vegetables": [
    ["Organic Tomato", 40, "/vegetables/roma-tomato.jpg", 4.5, "1kg", 48, "Grade A", "10% OFF"],
    ["Farm Fresh Potato", 30, "/vegetables/farm-potato.jpg", 4.2, "1kg", 120, "Grade A"],
    ["Natural Onion", 35, "/vegetables/natural-onion.jpg", 4.1, "1kg", 4, "Grade A"],
    ["Green Chilli", 25, "/vegetables/green-chilli.jpg", 4.4, "500g", 60, "Grade A"],
    ["Carrot Premium", 50, "/vegetables/carrot-premium.jpg", 4.6, "1kg", 35, "Premium"],
    ["Cabbage Fresh", 28, "/vegetables/fresh-cabbage.jpg", 4.0, "1pc", 22, "Grade A"],
    ["Beans Organic", 60, "/vegetables/organic-beans.jpg", 4.7, "500g", 18, "Organic"],
    ["Spinach Leaves", 20, "/vegetables/spinach-leaves.jpg", 4.3, "1 bunch", 26, "Grade A"],
  ],
  "Fresh Fruits": [
    ["Apple Premium", 180, "/fruits/apple.jpg", 4.8, "1kg", 30, "Premium"],
    ["Banana Robusta", 60, "/fruits/robusta-banana.jpg", 4.4, "1 dozen", 55, "Grade A"],
    ["Orange Juicy", 120, "/fruits/orange.jpg", 4.5, "1kg", 40, "Grade A"],
    ["Papaya Sweet", 70, "/fruits/papaya.jpg", 4.2, "1pc", 3, "Ripened"],
    ["Pomegranate", 160, "/fruits/pomegranate.jpg", 4.7, "1kg", 25, "Premium"],
    ["Mango Alphonso", 250, "/fruits/alphonso-mango.jpg", 4.9, "1kg", 14, "Seasonal"],
    ["Watermelon", 90, "/fruits/watermelon.jpg", 4.3, "1pc", 20, "Grade A"],
    ["Grapes Seedless", 140, "/fruits/seedless-grape.jpg", 4.6, "500g", 16, "Premium"],
  ],
  "Dairy Products": [
    ["Farm Fresh Milk", 55, "/dairy-products/milk.jpg", 4.7, "1L", 80, "Grade A"],
    ["Organic Butter", 220, "/dairy-products/butter.jpg", 4.8, "500g", 24, "Organic"],
    ["Paneer Fresh", 180, "/dairy-products/paneer.jpg", 4.6, "500g", 20, "Grade A"],
    ["Curd Natural", 60, "/dairy-products/curd.jpg", 4.3, "500g", 45, "Grade A"],
    ["Cheese Block", 250, "/dairy-products/cheese.jpg", 4.5, "200g", 0, "Premium"],
    ["Ghee Pure", 480, "/dairy-products/ghee.jpg", 4.9, "500ml", 12, "Handmade"],
    ["Buttermilk", 40, "/dairy-products/buttermilk.jpg", 4.2, "1L", 60, "Grade A"],
    ["Flavoured Yogurt", 70, "/dairy-products/yogurt.jpg", 4.4, "200g", 33, "Grade A"],
  ],
  "Organic Grains": [
    ["Organic Rice", 95, "/organic-grains/white-rice.jpg", 4.6, "1kg", 50, "Organic"],
    ["Wheat Premium", 80, "/organic-grains/wheat.jpg", 4.4, "1kg", 44, "Grade A"],
    ["Ragi Natural", 65, "/organic-grains/ragi.jpg", 4.5, "1kg", 38, "Millet"],
    ["Oats Organic", 120, "/organic-grains/oats.jpg", 4.7, "500g", 26, "Organic"],
    ["Barley Whole", 70, "/organic-grains/barley.jpg", 4.3, "1kg", 29, "Grade A"],
    ["Corn Grain", 55, "/organic-grains/corn.jpg", 4.2, "1kg", 65, "Grade A"],
    ["Quinoa Organic", 320, "/organic-grains/quinoa.jpg", 4.8, "500g", 2, "Imported"],
    ["Brown Rice", 110, "/organic-grains/brown-rice.jpg", 4.6, "1kg", 41, "Organic"],
  ],
  "Herbs & Spices": [
    ["Turmeric Powder", 90, "/herbs&spices/turmeric-powder.jpg", 4.7, "250g", 70, "Grade A"],
    ["Black Pepper", 220, "/herbs&spices/black-pepper.jpg", 4.9, "200g", 34, "Premium"],
    ["Cardamom Premium", 450, "/herbs&spices/cardamom.jpg", 4.8, "100g", 4, "Premium"],
    ["Coriander Seeds", 70, "/herbs&spices/coriander-seed.jpg", 4.3, "250g", 58, "Grade A"],
    ["Cumin Seeds", 140, "/herbs&spices/cumin-seed.jpg", 4.6, "200g", 47, "Grade A"],
    ["Mint Leaves", 20, "/herbs&spices/mint-leaves.jpg", 4.2, "1 bunch", 30, "Grade A"],
    ["Curry Leaves", 15, "/herbs&spices/curry-leaves.jpg", 4.1, "1 bunch", 36, "Grade A"],
    ["Dry Red Chilli", 130, "/herbs&spices/dry-red-chilli.jpg", 4.5, "250g", 52, "Grade A"],
  ],
  "Farm Fresh Eggs": [
    ["Country Eggs", 120, "/farm-fresh-eggs/country-eggs.jpg", 4.8, "12 pcs", 40, "Grade A"],
    ["Organic Eggs", 150, "/farm-fresh-eggs/organic-eggs.jpg", 4.9, "12 pcs", 28, "Organic"],
    ["Brown Eggs", 110, "/farm-fresh-eggs/brown-eggs.jpg", 4.6, "12 pcs", 33, "Grade A"],
    ["Duck Eggs", 180, "/farm-fresh-eggs/duck-eggs.jpg", 4.7, "6 pcs", 3, "Grade A"],
    ["Free Range Eggs", 160, "/farm-fresh-eggs/free-range-eggs.jpg", 4.9, "12 pcs", 22, "Free Range"],
    ["Farm Eggs Premium", 140, "/farm-fresh-eggs/farm-eggs.jpg", 4.5, "12 pcs", 31, "Premium"],
    ["Local Eggs", 100, "/farm-fresh-eggs/local-eggs.jpg", 4.3, "12 pcs", 45, "Grade A"],
    ["Protein Eggs", 170, "/farm-fresh-eggs/protein-eggs.jpg", 4.8, "12 pcs", 19, "Premium"],
  ],
};

/**
 * Fixed so the seeded catalogue is byte-identical on every machine. A fresh
 * `new Date()` here would make the store's first write differ per browser, which
 * is exactly the kind of thing that makes a "why is my data different" bug
 * impossible to reproduce.
 */
const SEED_CREATED_AT = "2026-01-01T00:00:00.000Z";

export const SEED_PRODUCTS: Product[] = Object.entries(SEED_ROWS).flatMap(
  ([category, rows]) => {
    const ownerIndex = CATEGORY_FARMER[category] ?? 0;
    const owner = SEED_FARMERS[ownerIndex];
    const ownerId = SEED_FARMER_IDS[ownerIndex];

    return rows.map((row, index) => {
      const [name, price, image, rating, unit, stockQty, quality, discount] = row;
      return {
        id: `seed-${slug(category)}-${index}`,
        category,
        name,
        price,
        image,
        rating,
        unit,
        stockQty,
        quality,
        farmerId: ownerId,
        farmer: owner.farmName,
        location: owner.location,
        discount,
        createdAt: SEED_CREATED_AT,
      } satisfies Product;
    });
  },
);

/** Every distinct category present in a product list, in first-seen order. */
export function categoriesOf(products: Product[]): string[] {
  const seen: string[] = [];
  for (const product of products) {
    if (!seen.includes(product.category)) seen.push(product.category);
  }
  return seen;
}

export function productsInCategory(products: Product[], category: string): Product[] {
  return products.filter((product) => product.category === category);
}

export function findCategoryIn(products: Product[], name: string): Product[] {
  return productsInCategory(products, name);
}

export function findProductIn(
  products: Product[],
  categoryName: string,
  index: number,
): Product | undefined {
  return productsInCategory(products, categoryName)[index];
}

export function findProductById(products: Product[], id: string): Product | undefined {
  return products.find((product) => product.id === id);
}

/**
 * Every (category, index) pair the product route has to prerender.
 *
 * The category name must be returned raw. Next.js treats these values as path
 * segments and percent-encodes them itself, so encoding here produced a
 * double-encoded param: the page received "Fresh%2520Vegetables", its single
 * decodeURIComponent yielded "Fresh%20Vegetables", findCategory found nothing
 * and all 48 pages prerendered as 404s. The ampersand in "Herbs & Spices" needs
 * no special handling - Next encodes it when forming the URL.
 */
export function allProductParams(): { category: string; index: string }[] {
  return Object.entries(SEED_ROWS).flatMap(([category, rows]) =>
    rows.map((_, index) => ({ category, index: String(index) })),
  );
}

/**
 * decodeURIComponent throws a URIError on a malformed sequence, so a request
 * for /product/%/0 would take the whole route down instead of 404ing. Falls
 * back to the raw value, which then simply fails the catalogue lookup.
 */
export function safeDecodeParam(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Name matches only, and an empty query returns nothing rather than everything.
 * `"".includes`-style matching made a blank search bar report all 48 products as
 * results for the empty string.
 */
export function searchProductsIn(
  products: Product[],
  query: string,
): { product: Product; category: string; index: number }[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];

  // The index is the product's position inside its own category, because that is
  // what /product/[category]/[index] is addressed by. It has to be counted per
  // category, so the walk below tracks a running position rather than using the
  // position in the flat list.
  const seen = new Map<string, number>();
  const results: { product: Product; category: string; index: number }[] = [];

  for (const product of products) {
    const index = seen.get(product.category) ?? 0;
    seen.set(product.category, index + 1);

    if (product.name.toLowerCase().includes(needle)) {
      results.push({ product, category: product.category, index });
    }
  }

  return results;
}

/**
 * Every local listing photo, grouped by category.
 *
 * Hand-maintained rather than derived from the seed, because it has to be the
 * complete set of images that exist under /public - deriving it from SEED_PRODUCTS
 * silently hid /fruits/robusta-banana-02.jpg, which is on disk but not seeded, so
 * a farmer could never choose it. Adding a photo means adding it here.
 */
export const IMAGE_LIBRARY: Record<string, string[]> = {
  "Fresh Vegetables": [
    "/vegetables/roma-tomato.jpg",
    "/vegetables/farm-potato.jpg",
    "/vegetables/natural-onion.jpg",
    "/vegetables/green-chilli.jpg",
    "/vegetables/carrot-premium.jpg",
    "/vegetables/fresh-cabbage.jpg",
    "/vegetables/organic-beans.jpg",
    "/vegetables/spinach-leaves.jpg",
  ],
  "Fresh Fruits": [
    "/fruits/apple.jpg",
    "/fruits/orange.jpg",
    "/fruits/papaya.jpg",
    "/fruits/pomegranate.jpg",
    "/fruits/alphonso-mango.jpg",
    "/fruits/watermelon.jpg",
    "/fruits/seedless-grape.jpg",
    "/fruits/robusta-banana.jpg",
    "/fruits/robusta-banana-02.jpg",
  ],
  "Dairy Products": [
    "/dairy-products/milk.jpg",
    "/dairy-products/butter.jpg",
    "/dairy-products/paneer.jpg",
    "/dairy-products/curd.jpg",
    "/dairy-products/cheese.jpg",
    "/dairy-products/ghee.jpg",
    "/dairy-products/buttermilk.jpg",
    "/dairy-products/yogurt.jpg",
  ],
  "Organic Grains": [
    "/organic-grains/white-rice.jpg",
    "/organic-grains/wheat.jpg",
    "/organic-grains/ragi.jpg",
    "/organic-grains/oats.jpg",
    "/organic-grains/barley.jpg",
    "/organic-grains/corn.jpg",
    "/organic-grains/quinoa.jpg",
    "/organic-grains/brown-rice.jpg",
  ],
  "Herbs & Spices": [
    "/herbs&spices/turmeric-powder.jpg",
    "/herbs&spices/black-pepper.jpg",
    "/herbs&spices/cardamom.jpg",
    "/herbs&spices/coriander-seed.jpg",
    "/herbs&spices/cumin-seed.jpg",
    "/herbs&spices/mint-leaves.jpg",
    "/herbs&spices/curry-leaves.jpg",
    "/herbs&spices/dry-red-chilli.jpg",
  ],
  "Farm Fresh Eggs": [
    "/farm-fresh-eggs/country-eggs.jpg",
    "/farm-fresh-eggs/organic-eggs.jpg",
    "/farm-fresh-eggs/brown-eggs.jpg",
    "/farm-fresh-eggs/duck-eggs.jpg",
    "/farm-fresh-eggs/free-range-eggs.jpg",
    "/farm-fresh-eggs/farm-eggs.jpg",
    "/farm-fresh-eggs/local-eggs.jpg",
    "/farm-fresh-eggs/protein-eggs.jpg",
  ],
};

/** The whole library, flattened, for a category that has no group of its own. */
export const ALL_IMAGES: string[] = Object.values(IMAGE_LIBRARY).flat();

export const FALLBACK_IMAGE = "/categories/fresh-vegetables.jpg";

/** Home page tile art. */
const CATEGORY_TILES: Record<string, string> = {
  "Fresh Vegetables": "/categories/fresh-vegetables.jpg",
  "Fresh Fruits": "/categories/seasonal-fruits.jpg",
  "Dairy Products": "/categories/dairy-products.jpg",
  "Organic Grains": "/categories/organic-grains.jpg",
  "Herbs & Spices": "/herbs&spices/turmeric-powder.jpg",
  "Farm Fresh Eggs": "/farm-fresh-eggs/country-eggs.jpg",
};

export function categoryTile(category: string): string {
  return CATEGORY_TILES[category] ?? (IMAGE_LIBRARY[category]?.[0] ?? FALLBACK_IMAGE);
}

/**
 * Tile art for a category, preferring a real photo of what is being sold in it.
 *
 * A category a farmer invents ("Exotic Vegetables") has no dedicated tile and no
 * entry in IMAGE_LIBRARY, so categoryTile alone hands it the generic vegetable
 * photo - which misrepresents it. The farmer's own listings are far better art,
 * so they are checked first.
 */
export function categoryImage(category: string, products: Product[]): string {
  const shot = products.find((product) => product.category === category)?.image;
  return shot ?? categoryTile(category);
}
