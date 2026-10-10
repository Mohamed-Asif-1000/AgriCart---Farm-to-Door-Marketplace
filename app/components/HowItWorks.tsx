"use client";
import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { Sprout, ShoppingCart, PackageCheck, Truck } from "lucide-react";
// Registers ScrollTrigger for the scrollTrigger config in useGSAP below.
import "../lib/gsapSetup";

const STEPS = [
  {
    icon: <Sprout size={28} />,
    title: "Farmers List Produce",
    description: "Local farmers upload fresh harvest directly to the platform.",
  },
  {
    icon: <ShoppingCart size={28} />,
    title: "Customers Place Orders",
    description: "Browse categories and order fresh products easily.",
  },
  {
    icon: <PackageCheck size={28} />,
    title: "Platform Processes",
    description: "We ensure quality check, packaging and coordination.",
  },
  {
    icon: <Truck size={28} />,
    title: "Fast Delivery",
    description: "Delivery partners bring freshness directly to your home.",
  },
];

export default function HowItWorks() {
  const container = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const media = gsap.matchMedia();

    // Animates y only. These sections used to fade in from opacity: 0, which
    // made the content's visibility depend on a ScrollTrigger actually firing:
    // gsap.from applies the "from" state on creation, so a section whose
    // trigger never got crossed stayed at opacity 0 permanently and rendered as
    // a heading above blank space. Start/end were measured before the Hero's
    // md:h-[90vh] and the lazy images below had settled, which is how that
    // happened. With no hidden initial state a missed trigger degrades to
    // "already visible" instead of "invisible", and the slide-up is kept.
    media.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.from(".step-card", {
        y: 40,
        duration: 0.7,
        stagger: 0.2,
        ease: "power3.out",
        scrollTrigger: {
          trigger: container.current,
          start: "top 80%",
          // Reveal once, so a reverse scroll cannot re-hide revealed cards.
          once: true,
        },
      });
    });

    return () => media.revert();
  }, { scope: container });

  return (
    <section id="how-it-works" ref={container} className="py-24 bg-emerald-50 scroll-mt-28">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">

        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-slate-900">
            How AgriCart Works
          </h2>
          <p className="text-slate-600 mt-4 max-w-2xl mx-auto">
            A simple and transparent farm-to-home supply chain
          </p>
        </div>

        {/* Steps */}
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <div
              key={index}
              className="step-card bg-white rounded-3xl p-8 shadow-md hover:shadow-xl transition-all flex flex-col items-center text-center"
            >
              <div className="w-16 h-16 flex items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 mb-6">
                {step.icon}
              </div>

              <h3 className="text-lg font-bold text-slate-900">
                {step.title}
              </h3>

              <p className="text-slate-600 text-sm mt-3 leading-relaxed">
                {step.description}
              </p>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}