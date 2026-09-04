/**
 * Derives every web-ready brand asset from the original MackFitCoach badge.
 *
 * Run once (or after replacing the source art):
 *   node scripts/build-brand-assets.mjs
 *
 * How the badge is cut free of its black square: a FLOOD FILL inward from the
 * border, clearing only black that is *connected to the edge*.
 *
 * The two obvious alternatives are both wrong here:
 *  - Global black-keying punches holes straight through the artwork, because
 *    the badge's interior is also black (the cap, the tank top, the ring fill).
 *  - A circular mask clips the design: measured against the source, the sides
 *    sit at 0.955 of the half-width but the pointed bottom banner reaches
 *    0.992, so no single radius both clears the corners and keeps the tip.
 *
 * The flood respects the sticker's white outline as a natural boundary, so it
 * follows the true silhouette and leaves every interior black untouched.
 */
import { existsSync, mkdirSync, copyFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

const SOURCE = process.env.LOGO_SOURCE
  ? resolve(process.env.LOGO_SOURCE)
  : resolve(root, "..", "file new", "WhatsApp Image 2026-08-09 at 10.28.52 PM.jpeg");

const ARCHIVE_DIR = join(root, "assets", "source");
const OUT = join(root, "public", "brand");

/** Luminance at or below this counts as the black surround during the flood. */
const FLOOD_THRESHOLD = 46;
/**
 * The flood alone leaks: the badge's pointed bottom banner comes within 5px of
 * the frame edge, so exterior black connects to interior black through a gap in
 * the white outline, and the fill eats the cap, tank top and ring interior.
 *
 * So the flood result is only honoured OUTSIDE this radius (as a fraction of
 * the half-width). Measured against the source, the artwork's own boundary runs
 * between 0.955 (sides) and 0.992 (bottom tip), so 0.93 sits safely inside the
 * outline everywhere: no interior leak can survive, and the true silhouette —
 * including the bottom tip a plain circular mask would clip — is preserved.
 */
const RADIUS_GUARD = 0.93;
/** Sub-pixel feather on the cut edge so the outline doesn't look stair-stepped. */
const EDGE_FEATHER = 0.7;

const INK = "#050505";
const BLOOD = "#c4262b";
const BONE = "#f5f3f1";

function ensureDir(p) {
  if (!existsSync(p)) mkdirSync(p, { recursive: true });
}

/**
 * Single-channel alpha for the badge: 0 where the black surround is, 255 on the
 * artwork. Computed by a 4-neighbour flood inward from every border pixel.
 */
async function buildAlphaMask() {
  const { data, info } = await sharp(SOURCE)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: c } = info;

  const alpha = Buffer.alloc(w * h, 255);
  const seen = new Uint8Array(w * h);
  // Int32Array ring buffer instead of a JS array: ~1.5M pushes otherwise
  // thrashes the allocator badly enough to be noticeable.
  const queue = new Int32Array(w * h);
  let head = 0;
  let tail = 0;

  const isSurround = (idx) => {
    const i = idx * c;
    return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2] <= FLOOD_THRESHOLD;
  };

  const seed = (x, y) => {
    const idx = y * w + x;
    if (seen[idx] || !isSurround(idx)) return;
    seen[idx] = 1;
    alpha[idx] = 0;
    queue[tail++] = idx;
  };

  for (let x = 0; x < w; x++) {
    seed(x, 0);
    seed(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    seed(0, y);
    seed(w - 1, y);
  }

  while (head < tail) {
    const idx = queue[head++];
    const x = idx % w;
    const y = (idx - x) / w;
    if (x > 0) seed(x - 1, y);
    if (x < w - 1) seed(x + 1, y);
    if (y > 0) seed(x, y - 1);
    if (y < h - 1) seed(x, y + 1);
  }

  // Undo any leak that reached inside the guard radius.
  const cxf = (w - 1) / 2;
  const cyf = (h - 1) / 2;
  const guard = Math.min(cxf, cyf) * RADIUS_GUARD;
  const guardSq = guard * guard;
  let restored = 0;
  for (let y = 0; y < h; y++) {
    const dy = y - cyf;
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (alpha[idx] !== 0) continue;
      const dx = x - cxf;
      if (dx * dx + dy * dy <= guardSq) {
        alpha[idx] = 255;
        restored++;
      }
    }
  }

  const cleared = tail - restored;
  const pct = ((cleared / (w * h)) * 100).toFixed(1);
  console.log(
    `  flood cleared ${tail} px, restored ${restored} px inside the guard radius ` +
      `→ ${cleared} px (${pct}%) background`,
  );

  // Feather the cut so the outline edge isn't stair-stepped.
  // toColourspace('b-w') is load-bearing: blur() on a 1-channel raw buffer
  // otherwise promotes the result to 3-channel sRGB, and the interleaved RGB
  // then reads back as an alpha that tracks image luminance — which silently
  // makes every dark part of the artwork semi-transparent.
  const feathered = await sharp(alpha, { raw: { width: w, height: h, channels: 1 } })
    .blur(EDGE_FEATHER)
    .toColourspace("b-w")
    .raw()
    .toBuffer();

  if (feathered.length !== w * h) {
    throw new Error(
      `mask feather returned ${feathered.length} bytes, expected ${w * h} ` +
        `(${(feathered.length / (w * h)).toFixed(2)} channels) — alpha would be garbage`,
    );
  }

  // Materialise as an RGBA PNG (white, varying alpha) so it can drive a
  // `dest-in` composite. A single-channel mask has no alpha for `dest-in` to
  // read, and joinChannel with raw options misaligns against the base image —
  // both were tried and both corrupt the interior blacks.
  const rgba = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    rgba[i * 4] = 255;
    rgba[i * 4 + 1] = 255;
    rgba[i * 4 + 2] = 255;
    rgba[i * 4 + 3] = feathered[i];
  }

  const png = await sharp(rgba, { raw: { width: w, height: h, channels: 4 } })
    .png()
    .toBuffer();

  return { png, width: w, height: h };
}

async function buildTransparentBadge(mask, size) {
  // Enhance at full source resolution so the sharpen works on real detail,
  // then attach the alpha, then resize (sharp premultiplies, so the cut edge
  // does not bleed black into the artwork).
  const enhanced = await sharp(SOURCE)
    .modulate({ saturation: 1.12, brightness: 1.02 })
    .linear(1.06, -6) // gentle contrast lift: the red must hold up on #050505
    .png()
    .toBuffer();

  // Two explicit stages, materialising the full-res RGBA in between: cut at
  // source resolution, then downscale. Compositing and resizing in one
  // pipeline is not guaranteed to run in JS call order.
  const fullRes = await sharp(enhanced)
    .ensureAlpha()
    .composite([{ input: mask.png, blend: "dest-in" }])
    .png()
    .toBuffer();

  return sharp(fullRes)
    .resize(size, size, { fit: "cover", kernel: "lanczos3" })
    .sharpen({ sigma: 0.7, m1: 0.5, m2: 2.2 }) // crisp brush edges after downscale
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/** Badge composited onto the brand ink, for icons that must not be transparent. */
async function onInk(badge, size, pad = 0.08) {
  const inner = Math.round(size * (1 - pad * 2));
  const scaled = await sharp(badge).resize(inner, inner).png().toBuffer();
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: INK,
    },
  })
    .composite([{ input: scaled, gravity: "centre" }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function buildOgImage(badge) {
  const W = 1200;
  const H = 630;
  const badgeSize = 400;

  const scaled = await sharp(badge).resize(badgeSize, badgeSize).png().toBuffer();

  // Red grunge slashes + wordmark, echoing the badge's own composition.
  const overlay = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>
      <linearGradient id="fade" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="${BLOOD}" stop-opacity="0.85"/>
        <stop offset="100%" stop-color="${BLOOD}" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <g transform="skewX(-18)">
      <rect x="560" y="92"  width="520" height="12" fill="url(#fade)"/>
      <rect x="600" y="120" width="300" height="6"  fill="url(#fade)"/>
      <rect x="560" y="500" width="420" height="10" fill="url(#fade)"/>
    </g>
    <text x="600" y="300" font-family="Impact, 'Arial Narrow', sans-serif"
          font-size="104" letter-spacing="-2" fill="${BONE}">MACK<tspan fill="${BLOOD}">FIT</tspan></text>
    <text x="604" y="356" font-family="Impact, 'Arial Narrow', sans-serif"
          font-size="46" letter-spacing="14" fill="${BONE}">COACH</text>
    <text x="604" y="424" font-family="Arial, Helvetica, sans-serif"
          font-size="27" fill="#8a8a90">Personalised Indian diet plans &amp;</text>
    <text x="604" y="462" font-family="Arial, Helvetica, sans-serif"
          font-size="27" fill="#8a8a90">real body transformations.</text>
  </svg>`);

  return sharp({
    create: { width: W, height: H, channels: 4, background: INK },
  })
    .composite([
      { input: scaled, left: 108, top: Math.round((H - badgeSize) / 2) },
      { input: overlay, left: 0, top: 0 },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/**
 * Minimal ICO writer. sharp has no .ico encoder, so pack PNG frames into the
 * ICO container ourselves — every browser since IE11 accepts PNG-in-ICO.
 */
function buildIco(frames) {
  const count = frames.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(count, 4);

  const entries = [];
  const images = [];
  let offset = 6 + count * 16;

  for (const { size, data } of frames) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0); // width (0 means 256)
    e.writeUInt8(size >= 256 ? 0 : size, 1); // height
    e.writeUInt8(0, 2); // palette count
    e.writeUInt8(0, 3); // reserved
    e.writeUInt16LE(1, 4); // colour planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    entries.push(e);
    images.push(data);
    offset += data.length;
  }

  return Buffer.concat([header, ...entries, ...images]);
}

async function main() {
  if (!existsSync(SOURCE)) {
    console.error(`✗ Source logo not found:\n  ${SOURCE}\n`);
    console.error("  Set LOGO_SOURCE=/path/to/logo.png and re-run.");
    process.exit(1);
  }

  ensureDir(ARCHIVE_DIR);
  ensureDir(OUT);

  // 1. Archive the untouched original.
  const archived = join(ARCHIVE_DIR, "mackfitcoach-logo-original.jpeg");
  if (!existsSync(archived)) {
    copyFileSync(SOURCE, archived);
    console.log("→ archived original            assets/source/");
  }

  const meta = await sharp(SOURCE).metadata();
  console.log(`  source: ${meta.width}x${meta.height} ${meta.format}`);

  // 2. Master transparent badge.
  const mask = await buildAlphaMask();
  const master = await buildTransparentBadge(mask, 1024);
  writeFileSync(join(OUT, "logo-badge.png"), master);
  console.log("→ logo-badge.png               1024  transparent");

  // 3. Downscales from the master (never re-enhance — that double-sharpens).
  for (const size of [512, 256, 128, 64]) {
    const buf = await sharp(master).resize(size, size).png({ compressionLevel: 9 }).toBuffer();
    writeFileSync(join(OUT, `logo-badge-${size}.png`), buf);
    console.log(`→ logo-badge-${size}.png`.padEnd(31) + `${size}`.padStart(4) + "  transparent");
  }

  // 4. WebP for the header/footer (smaller, transparent, widely supported).
  const webp = await sharp(master).resize(512, 512).webp({ quality: 92 }).toBuffer();
  writeFileSync(join(OUT, "logo-badge.webp"), webp);
  console.log("→ logo-badge.webp               512  transparent");

  // 5. Blur placeholder for next/image.
  const blur = await sharp(master).resize(16, 16).webp({ quality: 40 }).toBuffer();
  writeFileSync(
    join(OUT, "logo-badge-blur.txt"),
    `data:image/webp;base64,${blur.toString("base64")}`,
  );
  console.log("→ logo-badge-blur.txt            16  base64 placeholder");

  // 6. PWA + Apple icons — on ink, since transparent favicons vanish on
  //    dark browser chrome and Apple ignores alpha entirely.
  for (const [name, size] of [
    ["icon-192.png", 192],
    ["icon-512.png", 512],
    ["apple-icon-180.png", 180],
  ]) {
    writeFileSync(join(OUT, name), await onInk(master, size));
    console.log(`→ ${name}`.padEnd(31) + `${size}`.padStart(4) + "  on ink");
  }

  // 7. favicon.ico (32 + 16). Uses less padding so the badge reads at 16px.
  const icoFrames = [];
  for (const size of [32, 16]) {
    icoFrames.push({ size, data: await onInk(master, size, 0.02) });
  }
  writeFileSync(join(OUT, "favicon.ico"), buildIco(icoFrames));
  console.log("→ favicon.ico                 32+16  on ink");

  // 8. Open Graph card.
  writeFileSync(join(OUT, "og-image.png"), await buildOgImage(master));
  console.log("→ og-image.png            1200x630  social card");

  console.log("\n✓ brand assets written to public/brand/");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
