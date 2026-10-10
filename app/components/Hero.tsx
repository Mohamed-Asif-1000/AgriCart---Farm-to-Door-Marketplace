"use client";
import { useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ArrowRight, Leaf, ShieldCheck, Truck, Sprout } from "lucide-react";

const SLIDES = [
  {
    image: "/hero/hero-farm.jpg",
    title: "FRESH FROM",
    highlight: "FARM TO HOME.",
    description: "Connect directly with local growers. No middlemen, just pure organic goodness delivered to your doorstep.",
    badge: "100% Organic Certified",
    icon: <Leaf size={16} />
  },
  {
    image: "/hero/hero-vegetables.jpg",
    title: "SEASONAL",
    highlight: "HARVEST BUNDLES.",
    description: "Curated boxes of the week's best picks. From crunchy carrots to sun-ripened tomatoes, picked at peak ripeness.",
    badge: "Pesticide Free",
    icon: <Sprout size={16} />
  },
  {
    image: "/hero/hero-farmer.jpg",
    title: "SUPPORT YOUR",
    highlight: "LOCAL FARMERS.",
    description: "Every purchase directly empowers a rural family.",
    badge: "Fair Trade Practice",
    icon: <ShieldCheck size={16} />
  },
  {
    image: "/hero/hero-spices-01.jpg",
    title: "EXPRESS",
    highlight: "24H DELIVERY.",
    description: "Harvested in the morning, on your table by evening.",
    badge: "Fast & Reliable",
    icon: <Truck size={16} />
  }
];

export default function Hero() {
  const container = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const images = gsap.utils.toArray(".hero-img");
    const texts = gsap.utils.toArray(".text-block");

    const tl = gsap.timeline({ repeat: -1 });

    // Each slide owns a sequential SLIDE_MS window. Passing "slide-N" as the
    // position would create labels at t=0,1,2,3 and play every slide at once,
    // so the offsets have to be relative to the previous label.
    const SLIDE_MS = 5;
    const FADE_MS = 1.5;
    const EXIT_AT = SLIDE_MS - 0.5;

    SLIDES.forEach((_, i) => {
      // Anchor to the previous label, not "+=", which is measured from the end
      // of the timeline and would open a SLIDE_MS gap between slides.
      const at = i === 0 ? 0 : `slide-${i - 1}+=${SLIDE_MS}`;

      tl.add(`slide-${i}`, at)
        .to(images[i] as HTMLElement, { opacity: 1, duration: FADE_MS, ease: "expo.inOut" }, `slide-${i}`)
        .fromTo(images[i] as HTMLElement, { scale: 1 }, { scale: 1.1, duration: SLIDE_MS, ease: "none" }, `slide-${i}`)
        .fromTo(texts[i] as HTMLElement, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 1, ease: "power3.out" }, `slide-${i}+=0.5`)
        .fromTo(`.slide-progress-${i}`, { width: "0%" }, { width: "100%", duration: SLIDE_MS, ease: "none" }, `slide-${i}`)
        .to(images[i] as HTMLElement, { opacity: 0, duration: FADE_MS, ease: "expo.inOut" }, `slide-${i}+=${EXIT_AT}`)
        .to(texts[i] as HTMLElement, { y: -40, opacity: 0, duration: 1, ease: "power3.in" }, `slide-${i}+=${EXIT_AT}`);
    });

    // Raw DOM listeners are not reverted by the GSAP context on unmount, so
    // they are bound and released explicitly.
    const onEnter = () => tl.pause();
    const onLeave = () => tl.resume();

    container.current?.addEventListener("mouseenter", onEnter);
    container.current?.addEventListener("mouseleave", onLeave);

    return () => {
      container.current?.removeEventListener("mouseenter", onEnter);
      container.current?.removeEventListener("mouseleave", onLeave);
    };
  }, { scope: container });

  return (
    <section ref={container} className="relative min-h-[50vh] md:h-[90vh] w-full overflow-hidden bg-slate-900">

      {/* Background Images */}
      <div className="absolute inset-0">
        {SLIDES.map((slide, idx) => (
          <div
            key={idx}
            className="hero-img absolute inset-0 opacity-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${slide.image})` }}
          >
            <div className="absolute inset-0 bg-black/45" />
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 h-full max-w-7xl mx-auto px-6 lg:px-8 flex flex-col justify-center">
        {SLIDES.map((slide, idx) => (
          <div key={idx} className="text-block absolute inset-0 flex flex-col justify-center opacity-0">
            <div className="max-w-3xl">
              <div className="flex items-center gap-2 bg-emerald-500/20 backdrop-blur-md border border-emerald-500/30 text-emerald-400 px-4 py-2 rounded-full w-fit mb-6">
                {slide.icon}
                <span className="text-[10px] font-black uppercase tracking-widest">{slide.badge}</span>
              </div>

              <h1 className="text-5xl md:text-6xl lg:text-8xl font-black text-white leading-[0.9] mb-6 tracking-tighter">
                {slide.title} <br />
                <span className="text-emerald-500">{slide.highlight}</span>
              </h1>

              <p className="text-lg md:text-xl text-slate-200 mb-10 leading-relaxed max-w-xl font-medium">
                {slide.description}
              </p>

              <div className="flex flex-wrap gap-4">
                <Link
                  href="/shop"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-4 rounded-2xl font-bold flex items-center gap-3 transition-all"
                >
                  Shop Now <ArrowRight />
                </Link>
                <Link
                  href="/#farmers"
                  className="bg-white/10 border border-white/20 text-white px-8 py-4 rounded-2xl font-bold hover:bg-white/20 transition-all"
                >
                  View Farmers
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Progress Indicators */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20 flex gap-3">
        {SLIDES.map((_, i) => (
          <div key={i} className="h-1.5 w-12 bg-white/20 rounded-full overflow-hidden">
            <div className={`h-full bg-emerald-500 w-0 slide-progress-${i}`} />
          </div>
        ))}
      </div>

    </section>
  );
}