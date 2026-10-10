"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { Loader2, ShieldCheck } from "lucide-react";

/**
 * Simulated payment lock screen. There is no payment gateway, SDK, key or
 * network call behind this - it only animates, then reports completion.
 */

const PROCESSING_MS = 1.8;
const SUCCESS_MS = 1.0;
const CHECK_PATH_LENGTH = 48;

type PaymentModalProps = {
  subtotal: number;
  deliveryFee: number;
  total: number;
  onComplete: () => void;
};

export default function PaymentModal({
  subtotal,
  deliveryFee,
  total,
  onComplete,
}: PaymentModalProps) {
  const container = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<"processing" | "success">("processing");

  // The GSAP timeline and the failsafe below both race to call onComplete, so
  // the completion is latched. onComplete is held in a ref to keep completeOnce
  // stable, which is what lets the failsafe effect stay mount-only.
  const completed = useRef(false);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const completeOnce = useCallback(() => {
    if (completed.current) return;
    completed.current = true;
    onCompleteRef.current();
  }, []);

  // The timeline is the only thing that would call onComplete, and this modal
  // blocks Escape and has no close button. If GSAP fails to load, the plugin is
  // missing, or the tween is killed by a re-render, that callback would never
  // fire and the customer would be stranded behind an aria-modal overlay with
  // the body scroll locked. A plain timer cannot be lost that way.
  useEffect(() => {
    const failsafe = setTimeout(
      completeOnce,
      (PROCESSING_MS + SUCCESS_MS) * 1000 + 1500
    );
    return () => clearTimeout(failsafe);
  }, [completeOnce]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    container.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useGSAP(
    () => {
      const timeline = gsap.timeline();
      const spinner = ".pm-spinner";
      const successMark = ".pm-success";
      const checkPath = ".pm-check-path";

      const spin = gsap.to(spinner, {
        rotation: 360,
        duration: 0.9,
        ease: "none",
        repeat: -1,
      });
      const pulse = gsap.to(spinner, {
        scale: 1.12,
        duration: 0.6,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
      });

      timeline
        .fromTo(
          ".pm-card",
          { opacity: 0, scale: 0.95, y: 12 },
          { opacity: 1, scale: 1, y: 0, duration: 0.35, ease: "power2.out" }
        )
        .call(() => {
          spin.kill();
          pulse.kill();
        }, undefined, PROCESSING_MS)
        .to(
          spinner,
          { opacity: 0, scale: 0.5, duration: 0.3, ease: "power2.in" },
          PROCESSING_MS
        )
        .fromTo(
          successMark,
          { opacity: 0, scale: 0.4 },
          { opacity: 1, scale: 1, duration: 0.5, ease: "back.out(2.5)" },
          PROCESSING_MS
        )
        .fromTo(
          checkPath,
          { strokeDashoffset: CHECK_PATH_LENGTH },
          { strokeDashoffset: 0, duration: 0.45, ease: "power2.out" },
          PROCESSING_MS + 0.15
        )
        .call(() => setPhase("success"), undefined, PROCESSING_MS)
        .call(completeOnce, undefined, PROCESSING_MS + SUCCESS_MS);
    },
    { scope: container }
  );

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={container}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pm-title"
      aria-busy={phase === "processing"}
      tabIndex={-1}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm outline-none"
      onKeyDown={(event) => {
        if (event.key === "Escape" || event.key === "Tab") event.preventDefault();
      }}
    >
      <div className="pm-card w-[min(28rem,100%)] rounded-2xl bg-white shadow-2xl p-6 sm:p-8 text-center">
        <div className="relative mx-auto mb-6 h-20 w-20">
          <span
            className={`pm-spinner absolute inset-0 flex items-center justify-center text-emerald-600 ${
              phase === "success" ? "invisible" : "visible"
            }`}
          >
            <Loader2 size={56} strokeWidth={2.5} />
          </span>

          <span
            className={`pm-success absolute inset-0 flex items-center justify-center ${
              phase === "success" ? "visible" : "invisible"
            }`}
          >
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-11 w-11 text-emerald-600"
                aria-hidden="true"
              >
                <path
                  className="pm-check-path"
                  d="M5 13l4 4 11-11"
                  style={{
                    strokeDasharray: CHECK_PATH_LENGTH,
                    strokeDashoffset: CHECK_PATH_LENGTH,
                  }}
                />
              </svg>
            </span>
          </span>
        </div>

        <p aria-live="polite" className="sr-only">
          {phase === "success"
            ? "Payment successful"
            : "Processing your payment"}
        </p>

        <h2 id="pm-title" className="text-xl sm:text-2xl font-black text-slate-900">
          {phase === "success" ? "Payment Successful" : "Processing your payment..."}
        </h2>

        <p className="mt-2 text-sm text-slate-500">
          {phase === "success"
            ? "Taking you to your order confirmation."
            : "Please do not close this window."}
        </p>

        <div className="mt-6 rounded-xl bg-slate-50 p-4 text-left">
          <div className="flex justify-between text-sm text-slate-600">
            <span>Subtotal</span>
            <span>₹{subtotal}</span>
          </div>
          <div className="mt-1.5 flex justify-between text-sm text-slate-600">
            <span>Delivery</span>
            <span className={deliveryFee === 0 ? "font-semibold text-emerald-600" : ""}>
              {deliveryFee === 0 ? "Free" : `₹${deliveryFee}`}
            </span>
          </div>
          <div className="mt-3 flex justify-between items-baseline border-t border-slate-200 pt-3">
            <span className="text-sm font-bold text-slate-900">Paying</span>
            <span className="text-xl font-black text-emerald-600">₹{total}</span>
          </div>
        </div>

        <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-slate-400">
          <ShieldCheck size={13} />
          Simulated payment - no real charge is made.
        </p>
      </div>
    </div>,
    document.body
  );
}
