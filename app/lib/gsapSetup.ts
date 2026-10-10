import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/**
 * Single place where ScrollTrigger gets registered.
 *
 * Registration used to live in Header.tsx, which meant every component using
 * the `scrollTrigger` property only worked because Header happened to be
 * imported first. SiteChrome skips the header on /dashboard, so a component
 * reused there would silently lose its scroll animation. Importing this module
 * for its side effect makes registration independent of import order.
 *
 * `useGSAP` registers itself with GSAP internally, so it must not be passed to
 * registerPlugin here.
 */
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export {};
