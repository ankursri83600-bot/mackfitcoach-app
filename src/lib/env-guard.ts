/**
 * Placeholder detection for environment variables.
 *
 * The original guards tested for the exact placeholder strings shipped in
 * .env.local.example ("your-key-secret", "rzp_test_xxxx…"). That is far too
 * narrow: any other placeholder slipped straight through. A literal
 * `PASTE_KEY_SECRET_HERE` was reported as a valid secret, which flipped
 * payments out of demo mode and into a state where checkout opened and then
 * failed with a 401 from Razorpay — strictly worse than staying disabled, since
 * the user sees a broken payment rather than an honest "not set up yet".
 *
 * So the rule is inverted: a value must look like a real credential to count,
 * rather than merely not matching a known-bad list.
 */

/** Words that never appear in a real credential. */
const PLACEHOLDER_MARKERS = [
  "paste",
  "your-",
  "your_",
  "xxxx",
  "changeme",
  "change-me",
  "replace",
  "todo",
  "example",
  "placeholder",
  "<",
];

export function looksLikePlaceholder(value: string | undefined | null): boolean {
  if (!value) return true;
  const v = value.trim().toLowerCase();
  if (v.length === 0) return true;
  return PLACEHOLDER_MARKERS.some((marker) => v.includes(marker));
}

/** A credential must be present, long enough, and not a placeholder. */
export function isRealSecret(value: string | undefined | null, minLength = 20): boolean {
  if (looksLikePlaceholder(value)) return false;
  return (value as string).trim().length >= minLength;
}

/** Razorpay key ids have a fixed, checkable shape. */
export function isRazorpayKeyId(value: string | undefined | null): boolean {
  if (looksLikePlaceholder(value)) return false;
  return /^rzp_(test|live)_[A-Za-z0-9]{10,}$/.test((value as string).trim());
}
