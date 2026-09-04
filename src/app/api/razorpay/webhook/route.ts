import { NextResponse, type NextRequest } from "next/server";

import { hasWebhookSecret, verifyWebhookSignature } from "@/lib/razorpay";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Razorpay webhook — the SOURCE OF TRUTH for payment state.
 *
 * Response discipline matters as much as the logic:
 *   - 200 for handled, duplicate AND ignored events.
 *   - 5xx only for transient failures, so Razorpay retries.
 *   - An amount mismatch is PERMANENT: record it, alert, and still return 200.
 *     Retrying will never fix it, and hammering the endpoint buries the signal.
 */
export async function POST(request: NextRequest) {
  if (!hasWebhookSecret()) {
    return NextResponse.json({ error: "Webhook not configured." }, { status: 503 });
  }

  // Read the RAW body first. Calling request.json() before verifying makes a
  // byte-exact HMAC impossible — re-serialising changes whitespace and key
  // order, and the digest will never match.
  const raw = await request.text();
  const signature = request.headers.get("x-razorpay-signature");

  if (!verifyWebhookSignature(raw, signature)) {
    console.error("[razorpay webhook] signature rejected");
    // Do not parse the body of an unverified request.
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  let payload: {
    event?: string;
    payload?: { payment?: { entity?: Record<string, unknown> }; refund?: { entity?: Record<string, unknown> } };
  };
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) {
    // Transient from Razorpay's perspective — ask it to retry.
    return NextResponse.json({ error: "Storage unavailable." }, { status: 503 });
  }

  const event = payload.event ?? "unknown";
  const eventId = request.headers.get("x-razorpay-event-id") ?? `${event}:${raw.length}`;

  // Idempotency: returns false when we have already seen this delivery.
  const { data: isNew, error: ledgerError } = await admin.rpc("record_payment_event", {
    p_razorpay_event_id: eventId,
    p_event: event,
    p_payload: payload,
  });

  if (ledgerError) {
    console.error("[razorpay webhook] ledger write failed", ledgerError);
    return NextResponse.json({ error: "Ledger unavailable." }, { status: 503 });
  }

  if (isNew === false) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  const paymentEntity = payload.payload?.payment?.entity as
    | { id?: string; order_id?: string; amount?: number; currency?: string; error_description?: string }
    | undefined;
  const refundEntity = payload.payload?.refund?.entity as
    | { payment_id?: string }
    | undefined;

  try {
    switch (event) {
      case "payment.captured":
      case "order.paid": {
        if (!paymentEntity?.order_id || !paymentEntity.id) break;
        const { data: settledId, error } = await admin.rpc("mark_order_paid", {
          p_razorpay_order_id: paymentEntity.order_id,
          p_razorpay_payment_id: paymentEntity.id,
          p_amount_paise: paymentEntity.amount ?? 0,
          p_currency: paymentEntity.currency ?? "INR",
        });
        // null = refused mismatch, already parked as 'mismatch' by the RPC.
        if (error || !settledId) {
          // Permanent: a mismatch will not resolve on retry.
          console.error("[razorpay webhook] SETTLEMENT REFUSED", {
            order: paymentEntity.order_id,
            payment: paymentEntity.id,
            error,
          });
          await admin
            .from("payment_events")
            .update({
              handled: true,
              handler_error: error?.message ?? "amount or currency mismatch — order parked",
            })
            .eq("razorpay_event_id", eventId);
          return NextResponse.json({ ok: true, refused: true });
        }
        break;
      }

      case "payment.failed": {
        if (!paymentEntity?.order_id) break;
        await admin.rpc("mark_order_failed", {
          p_razorpay_order_id: paymentEntity.order_id,
          p_reason: paymentEntity.error_description ?? "payment failed",
        });
        break;
      }

      case "refund.created":
      case "refund.processed": {
        if (!refundEntity?.payment_id) break;
        // Revokes the entitlement too — a refunded customer must not keep the plan.
        await admin.rpc("mark_order_refunded", {
          p_razorpay_payment_id: refundEntity.payment_id,
        });
        break;
      }

      default:
        break;
    }

    await admin
      .from("payment_events")
      .update({ handled: true })
      .eq("razorpay_event_id", eventId);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[razorpay webhook] handler threw", err);
    return NextResponse.json({ error: "Handler failed." }, { status: 500 });
  }
}
