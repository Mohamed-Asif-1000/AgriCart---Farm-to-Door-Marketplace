"use client";

import { ShieldCheck, Truck, Sprout, BadgeCheck } from "lucide-react";

const benefits = [
  {
    title: "Direct From Farmers",
    description:
      "No middlemen. Farmers sell directly to customers ensuring fair prices and fresh produce.",
    icon: <Sprout size={28} />,
  },
  {
    title: "Quality Guaranteed",
    description:
      "All products are carefully verified for freshness, safety, and organic standards.",
    icon: <BadgeCheck size={28} />,
  },
  {
    title: "Secure Payments",
    description:
      "Safe and reliable payment options with full transaction protection.",
    icon: <ShieldCheck size={28} />,
  },
  {
    title: "Fast Delivery Network",
    description:
      "Efficient logistics system ensures quick and safe delivery to your doorstep.",
    icon: <Truck size={28} />,
  },
];

export default function WhyChooseUs() {
  return (
    <section className="py-16 md:py-28 bg-slate-50">
      <div className="max-w-7xl mx-auto px-6 text-center mb-20">
        <h2 className="text-4xl md:text-5xl font-black text-slate-900">
          Why Choose AgriCart
        </h2>
        <p className="text-slate-600 mt-4 text-lg max-w-2xl mx-auto">
          A smarter and fairer way to buy farm-fresh produce.
        </p>
      </div>

      <div className="max-w-7xl mx-auto px-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 lg:gap-10">
        {benefits.map((item, index) => (
          <div
            key={index}
            className="bg-white p-8 rounded-3xl shadow-lg text-center hover:shadow-xl transition"
          >
            <div className="w-14 h-14 mx-auto flex items-center justify-center bg-emerald-100 text-emerald-600 rounded-xl mb-6">
              {item.icon}
            </div>

            <h3 className="text-xl font-bold text-slate-900 mb-3">
              {item.title}
            </h3>

            <p className="text-slate-600">
              {item.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}