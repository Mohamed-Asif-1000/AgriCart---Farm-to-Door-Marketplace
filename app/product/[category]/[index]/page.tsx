import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import {
  allProductParams,
  findProductIn,
  productsInCategory,
  safeDecodeParam,
  SEED_PRODUCTS,
} from "@/app/lib/catalog";
import { stockStatus } from "@/app/lib/types";
import ProductPurchasePanel from "./ProductPurchasePanel";
import LiveProductFallback from "./LiveProductFallback";

type PageProps = {
  params: Promise<{ category: string; index: string }>;
};

export function generateStaticParams() {
  return allProductParams();
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { category, index } = await params;
  const categoryName = safeDecodeParam(category);

  // Number("0x2") and Number("3.0") are both 2 and 3, so those would render a
  // real product. The raw segment has to be a plain digit string to count.
  if (!/^\d+$/.test(index)) {
    return { title: "Product not found - AgriCart" };
  }

  // Only the seeded catalogue is knowable on the server. A farmer-created
  // product exists in localStorage, which is per-browser, so its metadata is
  // resolved by the client fallback instead.
  const product = findProductIn(SEED_PRODUCTS, categoryName, Number(index));
  if (!product) {
    return { title: "Product - AgriCart" };
  }

  const title = `${product.name} - ${categoryName} | AgriCart`;
  const description = `Buy ${product.name} (${product.unit}) from ${product.farmer}, ${product.location}. Rated ${product.rating}/5. ${stockStatus(product.stockQty)}. Only ₹${product.price}.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      images: [{ url: product.image, alt: product.name }],
    },
  };
}

function Breadcrumb({ categoryName, productName }: { categoryName: string; productName: string }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-8">
      <ol className="flex flex-wrap items-center gap-1 text-sm text-slate-500">
        <li>
          <Link href="/" className="hover:text-emerald-700 transition-colors">
            Home
          </Link>
        </li>
        <li aria-hidden="true">
          <ChevronRight size={14} className="mx-1" />
        </li>
        <li>
          <Link
            href={`/shop?category=${encodeURIComponent(categoryName)}`}
            className="hover:text-emerald-700 transition-colors"
          >
            {categoryName}
          </Link>
        </li>
        <li aria-hidden="true">
          <ChevronRight size={14} className="mx-1" />
        </li>
        <li>
          <span aria-current="page" className="font-semibold text-slate-900">
            {productName}
          </span>
        </li>
      </ol>
    </nav>
  );
}

export default async function ProductDetailsPage({ params }: PageProps) {
  const { category, index } = await params;
  const categoryName = safeDecodeParam(category);
  const indexNumber = /^\d+$/.test(index) ? Number(index) : Number.NaN;

  const seeded = findProductIn(SEED_PRODUCTS, categoryName, indexNumber);

  // A farmer-created listing has no server-side record, so it is rendered by the
  // client, which reads the same store the farmer published it to. This is the
  // hybrid: 48 pages stay statically prerendered, and anything added afterwards
  // still resolves.
  if (!seeded) {
    return (
      <LiveProductFallback
        categoryName={categoryName}
        index={Number.isFinite(indexNumber) ? indexNumber : 0}
      />
    );
  }

  const siblings = productsInCategory(SEED_PRODUCTS, categoryName).filter(
    (_, i) => i !== indexNumber,
  );
  const related = siblings.slice(0, 4);

  return (
    <div className="max-w-6xl mx-auto py-10 md:py-16 px-6">
      <Breadcrumb categoryName={categoryName} productName={seeded.name} />

      <div className="grid md:grid-cols-2 gap-10">
        <div className="relative h-[450px] rounded-xl overflow-hidden shadow-lg bg-slate-100">
          <Image
            src={seeded.image}
            alt={seeded.name}
            fill
            priority
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-cover"
          />
          {seeded.discount ? (
            <span className="absolute top-4 left-4 bg-emerald-600 text-white text-xs font-black uppercase tracking-wider px-3 py-1.5 rounded-lg">
              {seeded.discount}
            </span>
          ) : null}
        </div>

        <ProductPurchasePanel product={seeded} />
      </div>

      {related.length > 0 ? (
        <section className="mt-20">
          <h2 className="text-2xl font-bold text-slate-900 mb-8">More from {categoryName}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {related.map((item, i) => (
              <Link
                key={item.id}
                href={`/product/${encodeURIComponent(categoryName)}/${
                  // Siblings start at 0 but sit after the current product, so the
                  // live index in the full category list is the offset.
                  i + (i >= indexNumber ? 1 : 0)
                }`}
                className="group bg-white rounded-2xl shadow-md overflow-hidden hover:shadow-lg transition-shadow"
              >
                <div className="relative h-36 bg-slate-100">
                  <Image
                    src={item.image}
                    alt={item.name}
                    fill
                    sizes="(min-width: 768px) 25vw, 50vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="p-4">
                  <p className="font-semibold text-slate-900 text-sm group-hover:text-emerald-700 transition-colors">
                    {item.name}
                  </p>
                  <p className="text-sm text-emerald-600 font-bold mt-1">₹{item.price}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}