# 🥬 AgriCart - Farm-to-Door Marketplace

[![Next.js](https://img.shields.io/badge/Next.js-16.1.6-black?logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19.2.3-blue?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-4-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![Recharts](https://img.shields.io/badge/Recharts-3.7-097BED?logo=recharts&logoColor=white)](https://recharts.org)
[![GSAP](https://img.shields.io/badge/GSAP-3.14-88CE02?logo=greensock&logoColor=white)](https://gsap.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A modern, full-featured farm-to-door marketplace for farm-fresh produce, dairy, grains, herbs and eggs. Customers browse and order from local farms; **farmer, delivery and admin dashboards** each manage their own corner of the marketplace - all client-side, with no backend.

**[💻 Project Repository](https://github.com/Mohamed-Asif-1000/AgriCart---Farm-to-Door-Marketplace)**

---

## ✨ Key Features

### 🛍️ Complete E-Commerce

- **Product Catalog**: Browse produce across 6 categories with live inventory from verified farms
- **Smart Cart & Wishlist**: Full cart management, wishlist and a persistent checkout flow
- **Farm-to-Door Ordering**: A mixed basket is split into one order per farm, each with its own totals and delivery fee
- **Order Tracking**: Track orders from placement through delivery with status updates
- **Reviews**: Rate delivery agents after completed orders
- **Simulated Checkout**: Animated mock payment flow, no real charge is made.

### 👩‍🌾 Farmer Tools

- **Farm Profile**: Manage farm details, photo, bio and verification status
- **Product Management**: Add, edit and hide listings with numeric stock tracking
- **Sales Dashboard**: Sales, revenue and buyer details, with Recharts graphs
- **Live Sync**: Saving a farm name or location pushes it onto every listing you own

### 🚚 Delivery Management

- **Duty Status**: Go online/offline and work through the claim queue
- **Trip Tracking**: Claim orders, then walk them Placed → Picking up → In Transit → Delivered
- **Earnings**: Pay per trip is priced at claim time from what the parcel weighs up as

### 👨‍💼 Admin Controls

- **Account Management**: Approve, verify, suspend or provision new accounts
- **Marketplace Oversight**: Watch orders, products, reviews and revenue across the whole market

### 🎨 User Experience

- **Responsive Design**: Works on mobile, tablet and desktop
- **Smooth Animations**: GSAP-powered header, menus and dashboard motion
- **Featured Farmers Carousel**: Animated single-card showcase of verified farms
- **Search & Filter**: Find products quickly by category or by name

---

## 🛠️ Tech Stack

| Category     | Technology                          | Purpose                            |
| ------------ | ----------------------------------- | ---------------------------------- |
| **Frontend** | Next.js 16 + React 19 + TypeScript  | App Router, server-rendered pages  |
| **Styling**  | Tailwind CSS 4 + GSAP               | Emerald palette, animated UI       |
| **State**    | localStorage + useSyncExternalStore | Client store, cross-tab sync       |
| **Charts**   | Recharts                            | Dashboard sales and revenue charts |
| **Icons**    | Lucide React                        | Clean, modern icon set             |
| **Auth**     | localStorage sessions               | Role-based demo login              |

### Dependencies

```json
{
  "next": "16.1.6",
  "react": "19.2.3",
  "react-dom": "19.2.3",
  "gsap": "^3.14.2",
  "@gsap/react": "^2.1.2",
  "recharts": "^3.7.0",
  "lucide-react": "^0.575.0",
  "tailwindcss": "^4"
}
```

Dev tooling: `typescript`, `eslint`, `eslint-config-next`, `@tailwindcss/postcss`.

---

## 🚀 Getting Started

### Prerequisites

- Node.js 20 or higher
- npm 10 or higher
- A modern browser

### Installation

```bash
# Clone the repository
git clone https://github.com/Mohamed-Asif-1000/AgriCart---Farm-to-Door-Marketplace.git
cd AgriCart---Farm-to-Door-Marketplace

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for Production

```bash
npm run build     # Production build
npm run start     # Serve the production build
npm run lint      # ESLint
npx tsc --noEmit  # TypeScript check
```

---

## 🧠 How to Use

1️⃣ **Explore the Shop** - Use the search bar in the Header or browse through the animated category grid on the landing page.

2️⃣ **Build a Basket** - Add items to your Cart or Wishlist and watch the live cart counter in the Header update as you shop across sections.

3️⃣ **Test Multi-Roles** - Sign up via the Login page and select a role (Customer, Farmer, Delivery, Admin) to unlock role-specific features.

4️⃣ **Sell as a Farmer** - Create a listing, then edit your Farm Profile and watch the farm name and location sync onto every product you own.

5️⃣ **Deliver & Earn** - Go online in the Delivery dashboard, claim an order, and walk it through Placed → Picking up → In Transit → Delivered.

6️⃣ **Admin Control** - Log in as an Admin to approve or suspend accounts, provision new users and watch marketplace revenue.

---

## 📱 Responsive Design

- 📱 **Mobile (≤640px)**: Single-column product grids and a sleek slide-out hamburger menu.

- 📟 **Tablets (640px - 1024px)**: Adjusted layout for tablet displays, featuring 2-column product views.

- 💻 **Desktop (>1024px)**: Full horizontal navigation, multi-column layouts, and hover-triggered interactions.

---

## 📁 Project Structure

```
agricart-shopping/
├── app/
│   ├── components/              # Reusable UI
│   │   ├── dashboard/           # DashboardShell, DashboardUIContext
│   │   ├── Header.tsx
│   │   ├── ProductCard.tsx
│   │   ├── FeaturedFarmers.tsx
│   │   └── PaymentModal.tsx
│   ├── context/                 # CartWishlistContext (cart, wishlist, persistence)
│   ├── dashboard/
│   │   ├── admin/page.tsx       # Accounts, approvals, revenue
│   │   ├── customer/page.tsx    # Orders, addresses, reviews
│   │   ├── delivery/page.tsx    # Duty status, trips, earnings
│   │   └── farmer/page.tsx      # Listings, sales charts, farm profile
│   ├── lib/                     # Shared logic
│   │   ├── store.ts             # localStorage collections (products, orders, profiles, reviews)
│   │   ├── types.ts             # Domain model + validators
│   │   ├── catalog.ts           # 48 seeded products, pure helpers
│   │   ├── session.ts           # Auth session read/write
│   │   ├── useSession.ts        # React session hooks
│   │   ├── pricing.ts           # Cart totals, trip pay
│   │   └── farmerPhoto.ts       # Photo crop/compress
│   ├── product/[category]/[index]/  # Product detail + purchase panel
│   ├── shop/                    # Live catalogue with filters
│   ├── cart/, checkout/         # Cart and checkout flow
│   ├── wishlist/, search/       # Saved items, search
│   ├── login/                   # Sign in / register, role picker
│   └── layout.tsx, page.tsx     # Root layout + landing page
├── public/                      # Static assets
├── package.json
├── tsconfig.json
├── eslint.config.mjs
└── README.md
```

---

## 🧭 Routes

| Route                         | What it is                                                      |
| ----------------------------- | --------------------------------------------------------------- |
| `/`                           | Landing page (hero, categories, how it works, farmers, reviews) |
| `/shop`                       | Live catalogue with a category filter                           |
| `/product/[category]/[index]` | Product detail with purchase panel                              |
| `/search`                     | Name search over the catalogue                                  |
| `/cart`, `/checkout`          | Cart and checkout flow                                          |
| `/wishlist`                   | Saved products                                                  |
| `/order-success`              | Post-checkout confirmation                                      |
| `/login`                      | Sign in / register; picks a role                                |
| `/dashboard/customer`         | Orders, addresses, payment methods, reviews                     |
| `/dashboard/farmer`           | Live inventory, listing form, sales charts, farm profile        |
| `/dashboard/delivery`         | Duty status, claim queue, active trips, earnings                |
| `/dashboard/admin`            | Account directory, approvals, suspensions, revenue              |

---

## 🗄️ Data & State

There is no backend. `app/lib/store.ts` is the single source of truth for every
shared record: products, orders, profiles and reviews. Each one is a validated
`localStorage` collection read through `useSyncExternalStore`, listening to the
native `storage` event (so other tabs stay in step) _and_ a same-tab custom
event, because `storage` never fires in the tab that made the write.

`app/lib/catalog.ts` is what the store is seeded with on first run: 6 categories,
48 products split across 3 verified demo farms, so the "Meet Our Farmers"
carousel is populated on a fresh browser. An already-seeded browser is migrated
in place rather than re-seeded, so visitor-added listings survive an update.

| localStorage key        | Holds                                              |
| ----------------------- | -------------------------------------------------- |
| `agricart_products`     | Every listing, with its owner and numeric stock    |
| `agricart_orders`       | Orders, split per farm, shared `groupId`           |
| `agricart_profiles`     | Farm name, location, photo, bio, addresses, status |
| `agricart_reviews`      | Ratings against delivered orders                   |
| `agricart_seeded_v2`    | Marker so the first-run seed runs once             |
| `agricart_cart`         | Cart lines and totals                              |
| `agricart_wishlist`     | Saved products                                     |
| `agricart_current_user` | Active session (name, email, role)                 |
| `agricart_users`        | Registered and admin-provisioned accounts          |

**Scope:** storage is per browser profile. Two tabs of the same browser stay in
step; different browsers or devices are separate.

---

## 🔐 Privacy & Security

- ✅ **Local-first**: All state lives in your browser's localStorage
- ✅ **No backend**: Nothing is sent to a server
- ✅ **No tracking**: No analytics, cookies or camera access
- ✅ **Demo auth**: Sessions are demo-only and cleared on logout
- ⚠️ **Storage limit**: ~5MB per origin - farm photos are cropped and compressed before saving
- ⚠️ **Demo auth only**: passwords are stored in plain text in localStorage. Never reuse a real password.

---

## 📊 Project Stats

- **Routes**: 13 pages across the storefront and 4 dashboards
- **Catalogue**: 48 seeded products across 6 categories
- **Dashboards**: Customer, Farmer, Delivery, Admin
- **Data types**: Product, Order, Profile, Review, Session
- **State**: 9 localStorage keys behind one cross-tab reactive store
- **Animations**: GSAP-powered header, menus and dashboard motion

---

## 🌍 Live Demo

You can view the live version of the website here:

👉 **[Open AgriCart]()**

There is no shared backend, so there are no logins to share. Your data lives in your own browser. To try the full flow:

1. Register a **Customer** on `/login`, shop from the 48 pre-stocked products, and check out (simulated payment).
2. Log out, register a **Delivery** partner, go online, claim the order and move it to Delivered.
3. Register a **Farmer** and add a listing. New farmers start as Pending, so register an **Admin** to approve them.

---

## 📝 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

## 👤 Author

**Mohamed Asif.A**

💼 Python Django Full Stack Developer

- 🔗 [GitHub Profile](https://github.com/Mohamed-Asif-1000/)
- 🔗 [LinkedIn](https://www.linkedin.com/in/mohamed-asif-a-14162326atm)

---

## 🙏 Acknowledgements

- **Lucide Icons** for the professional iconography.
- **GSAP & @gsap/react** for smooth, accessible UI animations.
- **Recharts** for the dashboard sales and revenue charts.
- **Tailwind CSS** for utility-first styling and the emerald palette.
- **Next.js & React** for server rendering, App Router and modern React hooks.
- **Unsplash & Pixabay Contributors** for providing high-quality, royalty-free farm and produce photography.

---

⭐ If you like this project, consider giving it a star on GitHub!
