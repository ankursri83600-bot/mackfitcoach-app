import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

import { resolvePlanPrice } from "@/lib/plan-pricing";
import { assertKeysAgree, createRazorpayOrder, isRazorpayConfigured } from "@/lib/razorpay";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!isRazorpayConfigured()) {
    return NextResponse.json({ error: "Payments are not configured." }, { status: 503 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Payments are not configured." }, { status: 503 });
  }

  try {
    assertKeysAgree();
  } catch (err) {
    console.error("[razorpay] key mismatch", err);
    return NextResponse.json({ error: "Payment configuration error." }, { status: 503 });
  }

  const user = await getCurrentUser();
  if (!user) {
    // Entitlements are keyed on auth.uid(); without an account there is nothing
    // durable to attach the purchase to.
    return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(`create-order:${user.id ?? ip}`, 10, 60_000)) {
    return NextResponse.json({ error: "Too many attempts. Try again shortly." }, { status: 429 });
  }

  let body: { tierSlug?: string; dietRequestId?: string; phone?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!body.tierSlug) {
    return NextResponse.json({ error: "Missing plan." }, { status: 400 });
  }

  // Server-side price resolution. Anything the client claimed about cost is
  // never read.
  let tier;
  try {
    tier = resolvePlanPrice(body.tierSlug);
  } catch {
    return NextResponse.json({ error: "Unknown plan." }, { status: 400 });
  }

  // A diet request may only be attached by its owner.
  if (body.dietRequestId) {
    const { data: owned } = await admin
      .from("diet_requests")
      .select("id")
      .eq("id", body.dietRequestId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!owned) {
      return NextResponse.json({ error: "That plan is not yours." }, { status: 403 });
    }
  }

  // Reuse a recent pending order rather than minting a second Razorpay order
  // every time the user reopens checkout.
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60_000).toISOString();
  const { data: existing } = await admin
    .from("orders")
    .select("id, razorpay_order_id, amount_paise")
    .eq("user_id", user.id)
    .eq("tier_slug", tier.slug)
    .eq("status", "created")
    .gte("created_at", fifteenMinutesAgo)
    .not("razorpay_order_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.razorpay_order_id && existing.amount_paise === tier.pricePaise) {
    return NextResponse.json({
      orderId: existing.id,
      razorpayOrderId: existing.razorpay_order_id,
      amountPaise: existing.amount_paise,
      currency: "INR",
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    });
  }

  try {
    const receipt = `mfc_${randomUUID().replace(/-/g, "").slice(0, 24)}`;
    const rzpOrder = await createRazorpayOrder({
      amountPaise: tier.pricePaise,
      receipt,
      notes: {
        tier_slug: tier.slug,
        user_id: user.id,
        diet_request_id: body.dietRequestId ?? "",
      },
    });

    const { data: orderId, error } = await admin.rpc("create_order_record", {
      p_user_id: user.id,
      p_email: user.email ?? "",
      p_phone: body.phone ?? null,
      p_tier_slug: tier.slug,
      p_tier_name: tier.name,
      p_amount_paise: tier.pricePaise,
      p_razorpay_order_id: rzpOrder.id,
      p_diet_request_id: body.dietRequestId ?? null,
    });

    if (error) {
      console.error("[razorpay] create_order_record failed", error);
      return NextResponse.json({ error: "Could not start checkout." }, { status: 500 });
    }

    return NextResponse.json({
      orderId,
      razorpayOrderId: rzpOrder.id,
      amountPaise: tier.pricePaise,
      currency: "INR",
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      prefill: { email: user.email ?? "", contact: body.phone ?? "" },
    });
  } catch (err) {
    console.error("[razorpay] order creation failed", err);
    return NextResponse.json({ error: "Could not start checkout." }, { status: 502 });
  }
}
