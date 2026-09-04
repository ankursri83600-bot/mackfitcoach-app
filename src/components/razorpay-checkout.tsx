"use client";

import Script from "next/script";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui";
import { FormAlert } from "@/components/form";

interface RazorpayCheckoutProps {
  tierSlug: string;
  tierName: string;
  planId?: string;
  dietRequestId?: string;
  className?: string;
}

interface RazorpayInstance {
  open: () => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

/**
 * Razorpay Checkout.
 *
 * The client sends only a tier slug; the price, the Razorpay order and the key id
 * all come back from the server. Nothing here can influence what is charged —
 * the displayed amount is whatever the server returned.
 */
export function RazorpayCheckout({
  tierSlug,
  tierName,
  planId,
  dietRequestId,
  className,
}: RazorpayCheckoutProps) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function onPay() {
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      const res = await fetch("/api/razorpay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tierSlug, dietRequestId }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401) {
          router.push(`/login?next=/checkout/${tierSlug}${planId ? `?planId=${planId}` : ""}`);
          return;
        }
        setError(data.error ?? "Could not start checkout.");
        return;
      }

      if (!window.Razorpay) {
        setError("Payment window failed to load. Please refresh and try again.");
        return;
      }

      const rzp = new window.Razorpay({
        key: data.keyId,
        order_id: data.razorpayOrderId,
        amount: data.amountPaise,
        currency: data.currency,
        name: "MackFitCoach",
        description: tierName,
        image: "/brand/logo-badge-256.png",
        prefill: data.prefill ?? {},
        theme: { color: "#c4262b" },
        handler: async (response: Record<string, string>) => {
          setBusy(true);
          const verify = await fetch("/api/razorpay/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(response),
          });
          const result = await verify.json();

          if (verify.status === 202) {
            setNotice("Payment received — we are confirming it. This page will update shortly.");
            setBusy(false);
            setTimeout(() => router.refresh(), 4000);
            return;
          }

          if (!verify.ok) {
            setError(result.error ?? "Payment could not be verified.");
            setBusy(false);
            return;
          }

          router.push(planId ? `/diet/${planId}` : result.redirect);
          router.refresh();
        },
        modal: {
          ondismiss: () => {
            setBusy(false);
            setNotice("Checkout closed. Nothing has been charged.");
          },
        },
      });

      rzp.open();
    } catch (err) {
      console.error(err);
      setError("Could not start checkout.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={className}>
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="lazyOnload"
        onLoad={() => setReady(true)}
        onError={() => setError("Payment window failed to load.")}
      />

      {error ? <FormAlert>{error}</FormAlert> : null}
      {notice ? <FormAlert tone="info">{notice}</FormAlert> : null}

      <Button onClick={onPay} disabled={busy || !ready} className="mt-4 w-full">
        {busy ? "Opening checkout…" : ready ? `Pay for ${tierName}` : "Loading…"}
      </Button>

      <p className="mt-3 text-center text-[0.7rem] text-ash-dim">
        Secured by Razorpay. UPI, cards, net banking and wallets accepted.
      </p>
    </div>
  );
}
