import Link from "next/link";

export default function NotFound() {
  return (
    <div className="max-w-6xl mx-auto py-20 px-6 text-center">
      <p className="text-6xl font-black text-emerald-600 mb-4">404</p>

      <h1 className="text-4xl font-black text-slate-900 mb-4">
        Page not found
      </h1>

      <p className="text-slate-600 mb-10 text-lg">
        We couldn&apos;t find the product or page you were looking for. It may
        have been removed or the link may be incorrect.
      </p>

      <Link
        href="/shop"
        className="inline-block bg-emerald-600 text-white px-6 py-3 rounded-xl font-semibold"
      >
        Browse all products
      </Link>
    </div>
  );
}
