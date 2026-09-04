import "server-only";

import crypto from "node:crypto";

import { isRazorpayKeyId, isRealSecret, looksLikePlaceholder } from "@/lib/env-guard";

const API_BASE = "https://api.razorpay.com/v1";

export function isRazorpayConfigured(): boolean {
  // Both must look like real credentials. Checking only against known
  // placeholder strings let anything else through, which enabled checkout with
  // an unusable secret and produced a 401 mid-payment.
  return isRazorpayKeyId(process.env.RAZORPAY_KEY_ID) &&
    isRealSecret(process.env.RAZORPAY_KEY_SECRET, 16);
}

export function hasWebhookSecret(): boolean {
  return isRealSecret(process.env.RAZORPAY_WEBHOOK_SECRET, 8);
}

export interface RazorpayConfigStatus {
  configured: boolean;
  /** Env var names that are absent or still placeholders. */
  missing: string[];
  /** Set but wrong shape — worth calling out separately from simply absent. */
  invalid: string[];
  keyIdPresent: boolean;
  webhookReady: boolean;
  mode: "live" | "test" | null;
}

/**
 * Precise account of what payments are still waiting on.
 *
 * A single boolean produced a misleading message — it told the user to "add your
 * Razorpay keys" after they had already added the key id, giving no hint that
 * only the secret was outstanding. The screens now name the exact variable.
 */
export function razorpayConfigStatus(): RazorpayConfigStatus {
  const id = process.env.RAZORPAY_KEY_ID;
  const publicId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;

  const missing: string[] = [];
  const invalid: string[] = [];

  if (!isRazorpayKeyId(id)) {
    if (looksLikePlaceholder(id)) missing.push("RAZORPAY_KEY_ID");
    else invalid.push("RAZORPAY_KEY_ID");
  }
  if (!isRazorpayKeyId(publicId)) {
    if (looksLikePlaceholder(publicId)) missing.push("NEXT_PUBLIC_RAZORPAY_KEY_ID");
    else invalid.push("NEXT_PUBLIC_RAZORPAY_KEY_ID");
  }
  if (!isRealSecret(secret, 16)) missing.push("RAZORPAY_KEY_SECRET");

  // A mismatch here would take payments into the wrong account, so it counts as
  // invalid rather than merely missing.
  if (id && publicId && id !== publicId) invalid.push("NEXT_PUBLIC_RAZORPAY_KEY_ID (does not match)");

  const webhookReady = hasWebhookSecret();
  if (!webhookReady) missing.push("RAZORPAY_WEBHOOK_SECRET");

  return {
    configured: isRazorpayConfigured(),
    missing,
    invalid,
    keyIdPresent: isRazorpayKeyId(id),
    webhookReady,
    mode: isRazorpayKeyId(id) ? (id!.startsWith("rzp_live_") ? "live" : "test") : null,
  };
}

/**
 * The public key id exposed to the browser must match the server's key, or
 * checkout silently pays into a different account.
 */
export function assertKeysAgree() {
  const server = process.env.RAZORPAY_KEY_ID;
  const client = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  if (server && client && server !== client) {
    throw new Error(
      "RAZORPAY_KEY_ID and NEXT_PUBLIC_RAZORPAY_KEY_ID differ — refusing to start checkout",
    );
  }
}

function authHeader() {
  const token = Buffer.from(
    `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`,
  ).toString("base64");
  return `Basic ${token}`;
}

export class RazorpayError extends Error {
  readonly status: number;
  readonly body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "RazorpayError";
    this.status = status;
    this.body = body;
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new RazorpayError(`Razorpay ${path} failed (${res.status})`, res.status, body);
  }
  return body as T;
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  receipt?: string;
  status: string;
}

export async function createRazorpayOrder(args: {
  amountPaise: number;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<RazorpayOrder> {
  return call<RazorpayOrder>("/orders", {
    method: "POST",
    body: JSON.stringify({
      amount: args.amountPaise,
      currency: "INR",
      receipt: args.receipt,
      notes: args.notes ?? {},
      payment_capture: 1,
    }),
  });
}

export interface RazorpayPayment {
  id: string;
  order_id: string;
  status: string;
  amount: number;
  currency: string;
  method?: string;
  error_description?: string;
}

/**
 * The ONLY trusted source of the captured amount. The browser's handler payload
 * is attacker-controlled; this is not.
 */
export async function fetchRazorpayPayment(paymentId: string): Promise<RazorpayPayment> {
  return call<RazorpayPayment>(`/payments/${paymentId}`);
}

/**
 * Constant-time compare of two hex digests.
 *
 * timingSafeEqual throws on length mismatch, so a malformed signature would
 * otherwise surface as a 500 instead of a clean rejection.
 */
function safeEqualHex(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

/** Checkout handler signature: HMAC_SHA256(order_id|payment_id, KEY_SECRET). */
export function verifyCheckoutSignature(args: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET ?? "")
    .update(`${args.orderId}|${args.paymentId}`)
    .digest("hex");
  return safeEqualHex(expected, args.signature);
}

/**
 * Webhook signature: HMAC_SHA256(RAW BODY, WEBHOOK_SECRET).
 *
 * Must be given the exact bytes received. Parsing to JSON and re-stringifying
 * changes whitespace and key order and the digest will never match.
 */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET ?? "")
    .update(rawBody)
    .digest("hex");
  return safeEqualHex(expected, signature);
}
