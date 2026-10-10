"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Leaf, Mail, Phone, MapPin } from "lucide-react";
import { categoriesOf } from "../lib/catalog";
import { useTradeableProducts } from "../lib/store";
import { DASHBOARD_BY_ROLE } from "../lib/session";

export default function Footer() {
  // Derived from the live catalogue so a category a farmer introduces is linked
  // here too. The contact details below are the business's own and stay static.
  const products = useTradeableProducts();
  const categories = useMemo(() => categoriesOf(products), [products]);

  return (
    <footer className="bg-slate-900 text-slate-300 pt-20 pb-10">
      <div className="max-w-7xl mx-auto px-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-12">
        {/* Brand */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white">
              <Leaf size={20} />
            </div>
            <h3 className="text-white text-2xl font-black">AgriCart</h3>
          </div>

          <p className="text-sm leading-relaxed">
            Connecting farmers directly with customers for fresh, healthy, and
            sustainable food.
          </p>
        </div>

        {/* Marketplace */}
        <div>
          <h4 className="text-white font-bold mb-4">Marketplace</h4>
          <ul className="space-y-2 text-sm">
            <li>
              <FooterLink href="/shop">All products</FooterLink>
            </li>
            {categories.map((name) => (
              <li key={name}>
                <FooterLink href={`/shop?category=${encodeURIComponent(name)}`}>
                  {name}
                </FooterLink>
              </li>
            ))}
            <li>
              <FooterLink href="/#farmers">Featured farmers</FooterLink>
            </li>
            <li>
              <FooterLink href="/#how-it-works">How it works</FooterLink>
            </li>
          </ul>
        </div>

        {/* For Partners */}
        <div>
          <h4 className="text-white font-bold mb-4">For Partners</h4>
          <ul className="space-y-2 text-sm">
            <li>
              <FooterLink href="/login">Become a farmer</FooterLink>
            </li>
            <li>
              <FooterLink href="/login">Delivery partner</FooterLink>
            </li>
            <li>
              <FooterLink href={DASHBOARD_BY_ROLE.admin}>
                Admin portal
              </FooterLink>
            </li>
            <li>
              <FooterLink href="/cart">Your cart</FooterLink>
            </li>
            <li>
              <FooterLink href="/wishlist">Your wishlist</FooterLink>
            </li>
          </ul>
        </div>

        {/* Contact */}
        <div>
          <h4 className="text-white font-bold mb-4">Contact</h4>
          <ul className="space-y-3 text-sm">
            <li className="flex items-center gap-2 min-w-0 break-words">
              <MapPin size={16} className="shrink-0" />
              Kochi, Kerala, India
            </li>
            <li className="flex items-center gap-2 min-w-0 break-words">
              <Phone size={16} className="shrink-0" />
              <a
                href="tel:+919876543210"
                className="hover:text-white transition-colors"
              >
                +91 98765 43210
              </a>
            </li>
            <li className="flex items-center gap-2 min-w-0 break-words">
              <Mail size={16} className="shrink-0" />
              <a
                href="mailto:support@agricart.com"
                className="hover:text-white transition-colors break-all"
              >
                support@agricart.com
              </a>
            </li>
          </ul>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-slate-800 mt-12 pt-6 text-center text-sm text-slate-500">
        © 2026 AgriCart. All rights reserved.
      </div>
    </footer>
  );
}

function FooterLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className="hover:text-white transition-colors">
      {children}
    </Link>
  );
}
