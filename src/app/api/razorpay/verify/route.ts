import { NextResponse, type NextRequest } from "next/server";

import {
  fetchRazorpayPayment,
  isRazorpayConfigured,
  verifyCheckoutSignature,
} from "@/lib/razorpay";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const ORDER_ID = /^order_[A-Za-z0-9]{10,24}$/;
const PAYMENT_ID = /^pay_[A-Za-z0-9]{10,24}$/;
const SIGNATURE = /^[a-f0-9]{64}$/;

/**
 * Fast-path settlement for the browser's checkout handler.
 *
 * This exists for UX only — the webhook is the source of truth. If the user
 * closes the tab between capture and this callback, only the webhook records the
 * payment, which is exactly why both must ship together.
 */
export async function POST(request: NextRequest) {
  if (!isRazorpayConfigured()) {
    return NextResponse.json({ error: "Payments are not configured." }, { status: 503 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Payments are not configured." }, { status: 503 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(`verify:${ip}`, 20, 60_000)) {
    return NextResponse.json({ error: "Too many attempts." }, { status: 429 });
  }

  let body: {
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const orderId = body.razorpay_order_id ?? "";
  const paymentId = body.razorpay_payment_id ?? "";
  const signature = body.razorpay_signature ?? "";

  if (!ORDER_ID.test(orderId) || !PAYMENT_ID.test(paymentId) || !SIGNATURE.test(signature)) {
    return NextResponse.json({ error: "Invalid payment reference." }, { status: 400 });
  }

  if (!verifyCheckoutSignature({ orderId, paymentId, signature })) {
    // Never log the expected signature — that would hand an attacker the oracle.
    console.error("[razorpay] signature rejected for order", orderId);
    return NextResponse.json({ error: "Payment could not be verified." }, { status: 400 });
  }

  // Re-fetch server-side. The amount in the browser payload is not trustworthy.
  let payment;
  try {
    payment = await fetchRazorpayPayment(paymentId);
  } catch (err) {
    console.error("[razorpay] payment fetch failed", err);
    return NextResponse.json({ error: "Could not confirm payment." }, { status: 502 });
  }

  if (payment.order_id !== orderId) {
    return NextResponse.json({ error: "Payment does not match order." }, { status: 400 });
  }

  if (payment.status === "authorized") {
    // Auto-capture is enabled, so this is transient. Let the webhook settle it.
    return NextResponse.json({ ok: false, pending: true }, { status: 202 });
  }

  if (payment.status !== "captured") {
    return NextResponse.json({ error: "Payment was not completed." }, { status: 402 });
  }

  const { data: settledOrderId, error } = await admin.rpc("mark_order_paid", {
    p_razorpay_order_id: orderId,
    p_razorpay_payment_id: paymentId,
    p_amount_paise: payment.amount,
    p_currency: payment.currency,
  });

  // A null id means the RPC refused the settlement (amount/currency mismatch)
  // and parked the order for reconciliation. It returns rather than raising so
  // that parking actually persists, so null must be handled as a failure here.
  if (error || !settledOrderId) {
    // Money has moved but our records disagree. Never report success here.
    console.error("[razorpay] SETTLEMENT REFUSED", { orderId, paymentId, error });
    return NextResponse.json(
      {
        error:
          `Your payment went through but we could not finalise the order. ` +
          `Please contact support quoting ${paymentId}.`,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    orderId: settledOrderId,
    redirect: `/checkout/success?order=${settledOrderId}`,
  });
}
