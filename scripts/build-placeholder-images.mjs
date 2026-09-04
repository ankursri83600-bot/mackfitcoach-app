/**
 * Generates placeholder transformation and coach photos so the gallery and
 * coach cards have real image dimensions to lay out against.
 *
 * These are OBVIOUSLY placeholders by design — labelled "SAMPLE" — so nothing
 * here can be mistaken for a real client result. Replace them via the admin
 * uploader once you have consented client photos.
 *
 *   node scripts/build-placeholder-images.mjs
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const OUT = join(root, "public", "placeholder");

if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const W = 800;
const H = 1000;

/** Simple torso silhouette; `bulk` widens the shoulders and waist. */
function silhouette(bulk, tint) {
  const shoulder = 150 + bulk * 90;
  const waist = 95 + bulk * 105;
  const cx = W / 2;

  return `
    <g fill="${tint}" opacity="0.9">
      <circle cx="${cx}" cy="235" r="82"/>
      <path d="M ${cx - shoulder} 430
               Q ${cx} 335 ${cx + shoulder} 430
               L ${cx + waist} 760
               Q ${cx} 815 ${cx - waist} 760 Z"/>
      <rect x="${cx - waist - 8}" y="755" width="${waist * 0.85}" height="245" rx="34"/>
      <rect x="${cx + waist * 0.15}" y="755" width="${waist * 0.85}" height="245" rx="34"/>
    </g>`;
}

function card({ label, bulk, accent, sub }) {
  const tint = accent ? "#c4262b" : "#3a3a42";
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#16161a"/>
        <stop offset="100%" stop-color="#08080a"/>
      </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    <g transform="skewX(-16)" opacity="0.5">
      <rect x="${W - 220}" y="90" width="260" height="8" fill="#c4262b" opacity="0.5"/>
      <rect x="${W - 180}" y="118" width="150" height="4" fill="#c4262b" opacity="0.3"/>
    </g>
    ${silhouette(bulk, tint)}
    <text x="48" y="${H - 96}" font-family="Impact, 'Arial Narrow', sans-serif" font-size="66"
          letter-spacing="2" fill="#f5f3f1">${label}</text>
    <text x="50" y="${H - 56}" font-family="Arial, Helvetica, sans-serif" font-size="24"
          letter-spacing="6" fill="#8a8a90">${sub}</text>
    <text x="${W - 48}" y="64" text-anchor="end" font-family="Arial, Helvetica, sans-serif"
          font-size="20" letter-spacing="4" fill="#5d5d64">SAMPLE</text>
  </svg>`);
}

const pairs = [
  { slug: "rahul", weeks: 14 },
  { slug: "priya", weeks: 20 },
  { slug: "arjun", weeks: 12 },
  { slug: "meera", weeks: 24 },
];

for (const { slug, weeks } of pairs) {
  writeFileSync(
    join(OUT, `${slug}-before.jpg`),
    await sharp(card({ label: "BEFORE", bulk: 1, accent: false, sub: "WEEK 0" }))
      .jpeg({ quality: 82 })
      .toBuffer(),
  );
  writeFileSync(
    join(OUT, `${slug}-after.jpg`),
    await sharp(card({ label: "AFTER", bulk: 0.12, accent: true, sub: `WEEK ${weeks}` }))
      .jpeg({ quality: 82 })
      .toBuffer(),
  );
  console.log(`→ ${slug}-before.jpg / ${slug}-after.jpg`);
}

// Coach portraits — square, neutral.
for (const [i, name] of ["coach-mack", "coach-dietician", "coach-trainer"].entries()) {
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="700" height="700">
    <rect width="700" height="700" fill="#111114"/>
    <circle cx="350" cy="268" r="96" fill="#2f2f37"/>
    <path d="M 120 700 Q 350 400 580 700 Z" fill="#2f2f37"/>
    <rect x="0" y="676" width="700" height="24" fill="${i === 0 ? "#c4262b" : "#1f1f25"}"/>
    <text x="350" y="640" text-anchor="middle" font-family="Arial, Helvetica, sans-serif"
          font-size="22" letter-spacing="5" fill="#5d5d64">SAMPLE</text>
  </svg>`);
  writeFileSync(join(OUT, `${name}.jpg`), await sharp(svg).jpeg({ quality: 84 }).toBuffer());
  console.log(`→ ${name}.jpg`);
}

// Wide hero backdrop.
const hero = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1200">
  <defs>
    <radialGradient id="g" cx="52%" cy="34%" r="72%">
      <stop offset="0%" stop-color="#26262e"/>
      <stop offset="62%" stop-color="#0d0d10"/>
      <stop offset="100%" stop-color="#050505"/>
    </radialGradient>
  </defs>
  <rect width="1920" height="1200" fill="url(#g)"/>
  <g opacity="0.16">
    <circle cx="960" cy="430" r="250" fill="#3a3a44"/>
    <path d="M 470 1200 Q 960 520 1450 1200 Z" fill="#31313b"/>
  </g>
  <g transform="skewX(-18)" opacity="0.5">
    <rect x="1320" y="190" width="620" height="16" fill="#c4262b" opacity="0.42"/>
    <rect x="1400" y="234" width="360" height="8" fill="#c4262b" opacity="0.26"/>
    <rect x="120" y="980" width="420" height="12" fill="#c4262b" opacity="0.2"/>
  </g>
</svg>`);
writeFileSync(join(OUT, "hero.jpg"), await sharp(hero).jpeg({ quality: 86 }).toBuffer());
console.log("→ hero.jpg");

console.log("\n✓ placeholders written to public/placeholder/");
