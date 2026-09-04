import assert from "node:assert/strict";
import { test } from "node:test";

import { isRazorpayKeyId, isRealSecret, looksLikePlaceholder } from "../env-guard";

/**
 * These tests exist because of a real bug: the original guard only rejected the
 * exact placeholder strings shipped in .env.local.example, so a literal
 * `PASTE_KEY_SECRET_HERE` counted as a valid secret. That flipped payments out
 * of demo mode into a state where checkout opened and then 401'd — worse than
 * staying disabled.
 */

test("the placeholders that actually caused the bug are rejected", () => {
  for (const value of [
    "PASTE_KEY_SECRET_HERE",
    "PASTE_ANON_KEY_HERE",
    "PASTE_SERVICE_ROLE_KEY_HERE",
    "your-key-secret",
    "your-service-role-key",
    "your_anon_key",
    "rzp_test_xxxxxxxxxxxx",
    "changeme",
    "REPLACE_ME",
    "<your-key>",
    "todo",
    "",
    "   ",
  ]) {
    assert.equal(looksLikePlaceholder(value), true, `should reject: ${JSON.stringify(value)}`);
    assert.equal(isRealSecret(value), false, `should not be a secret: ${JSON.stringify(value)}`);
  }
});

test("undefined and null are placeholders, not crashes", () => {
  assert.equal(looksLikePlaceholder(undefined), true);
  assert.equal(looksLikePlaceholder(null), true);
  assert.equal(isRealSecret(undefined), false);
});

test("credential-shaped values are accepted", () => {
  // Supabase publishable key, real shape.
  assert.equal(isRealSecret("sb_publishable_VDZeBwM9jQw7_kpCtOZv_A_LaCtOpAy", 20), true);
  // A JWT-style legacy anon key.
  assert.equal(
    isRealSecret(
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.abcdefghijklmnop",
      20,
    ),
    true,
  );
  // Razorpay secrets are ~24 alphanumerics.
  assert.equal(isRealSecret("4f8Kq2WmZpL9xTnB7rVdYc3H", 16), true);
});

test("too-short values are rejected even when they look real", () => {
  assert.equal(isRealSecret("abc123", 20), false);
  assert.equal(isRealSecret("4f8Kq2Wm", 16), false);
});

test("razorpay key id shape is enforced", () => {
  assert.equal(isRazorpayKeyId("rzp_test_TOmYpOsjJs0ODn"), true);
  assert.equal(isRazorpayKeyId("rzp_live_AbCdEfGh123456"), true);

  // Wrong prefix, placeholder, or too short.
  assert.equal(isRazorpayKeyId("rzp_test_xxxxxxxxxxxx"), false);
  assert.equal(isRazorpayKeyId("pk_test_abcdefghijkl"), false);
  assert.equal(isRazorpayKeyId("rzp_test_abc"), false);
  assert.equal(isRazorpayKeyId("PASTE_KEY_ID_HERE"), false);
  assert.equal(isRazorpayKeyId(undefined), false);
});

test("a key id alone must not enable payments", () => {
  // The exact situation after pasting only the key id: id valid, secret absent.
  const idOk = isRazorpayKeyId("rzp_test_TOmYpOsjJs0ODn");
  const secretOk = isRealSecret("PASTE_KEY_SECRET_HERE", 16);
  assert.equal(idOk, true);
  assert.equal(secretOk, false);
  assert.equal(idOk && secretOk, false, "payments must stay disabled without a real secret");
});
