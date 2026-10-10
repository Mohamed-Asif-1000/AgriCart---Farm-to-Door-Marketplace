"use client";

import Image from "next/image";
import { Star } from "lucide-react";

const testimonials = [
  {
    name: "Arjun Menon",
    location: "Palakkad",
    review:
      "The vegetables are incredibly fresh. You can actually taste the difference compared to supermarket produce.",
    image: "/testimonials/male-customer-01.png",
    rating: 5,
  },
  {
    name: "Lakshmi Thangadurai",
    location: "Salem",
    review:
      "I love supporting local farmers. The delivery is fast and the quality is always excellent.",
    image: "/testimonials/female-customer-01.png",
    rating: 5,
  },
  {
    name: "Raj Srivastava",
    location: "Bangalore",
    review:
      "Best farm-to-home platform I’ve used. Clean packaging and genuine organic produce.",
    image: "/testimonials/male-customer-02.png",
    rating: 5,
  },
];

export default function Testimonials() {
  return (
    <section className="py-16 md:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-6 text-center mb-20">
        <h2 className="text-4xl md:text-5xl font-black text-slate-900">
          What Customers Say
        </h2>
        <p className="text-slate-600 mt-4 text-lg max-w-2xl mx-auto">
          Trusted by families who value fresh and healthy food.
        </p>
      </div>

      <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-3 gap-6 md:gap-10">
        {testimonials.map((t, index) => (
          <div
            key={index}
            className="bg-slate-50 p-6 sm:p-8 rounded-3xl shadow-lg text-center"
          >
            <Image
              src={t.image}
              alt={t.name}
              width={80}
              height={80}
              className="w-20 h-20 rounded-full mx-auto mb-4 object-cover"
            />

            <h3 className="font-bold text-slate-900">{t.name}</h3>
            <p className="text-sm text-slate-500">{t.location}</p>

            <div className="flex justify-center mt-3 text-amber-500">
              {Array.from({ length: t.rating }).map((_, i) => (
                <Star key={i} size={16} fill="currentColor" />
              ))}
            </div>

            <p className="text-slate-600 mt-4 text-sm leading-relaxed">
              “{t.review}”
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}