import "server-only";

import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";

import { siteConfig } from "@/lib/site-config";
import type { DietPlan } from "./types";

/**
 * Renders a diet plan to a downloadable PDF.
 *
 * Built with `pdf-lib` deliberately rather than a headless-browser print
 * (Puppeteer/Playwright): pdf-lib is pure JS with no native Chromium binary to
 * download and run, which matters directly for the "make the site fast"
 * constraint — a browser-per-request PDF pipeline would undo that. The
 * trade-off is that charts are hand-drawn vector primitives rather than a
 * screenshot of a chart component; the macro bar and BMI strip below are
 * simple enough that this is not a real limitation.
 */

const INK = rgb(0.02, 0.02, 0.02);
const ASH = rgb(0.42, 0.42, 0.45);
const BLOOD = rgb(0.77, 0.15, 0.17);
const LINE = rgb(0.85, 0.85, 0.85);

const PAGE_W = 595.28; // A4 at 72dpi
const PAGE_H = 841.89;
const MARGIN = 48;
const CONTENT_W = PAGE_W - MARGIN * 2;

interface Ctx {
  doc: PDFDocument;
  font: PDFFont;
  bold: PDFFont;
  page: PDFPage;
  y: number;
}

function newPage(ctx: Ctx) {
  ctx.page = ctx.doc.addPage([PAGE_W, PAGE_H]);
  ctx.y = PAGE_H - MARGIN;
}

function ensureSpace(ctx: Ctx, needed: number) {
  if (ctx.y - needed < MARGIN) newPage(ctx);
}

function text(
  ctx: Ctx,
  str: string,
  opts: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; x?: number } = {},
) {
  const size = opts.size ?? 10;
  const font = opts.font ?? ctx.font;
  ctx.page.drawText(str, {
    x: opts.x ?? MARGIN,
    y: ctx.y,
    size,
    font,
    color: opts.color ?? INK,
  });
}

function line(ctx: Ctx, color = LINE) {
  ctx.page.drawLine({
    start: { x: MARGIN, y: ctx.y },
    end: { x: PAGE_W - MARGIN, y: ctx.y },
    thickness: 0.75,
    color,
  });
}

/** Wraps text to `maxWidth`, returning each line. Simple greedy wrap. */
function wrap(str: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = str.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const trial = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(trial, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = trial;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function paragraph(ctx: Ctx, str: string, opts: { size?: number; color?: ReturnType<typeof rgb> } = {}) {
  const size = opts.size ?? 9;
  const lines = wrap(str, ctx.font, size, CONTENT_W);
  for (const l of lines) {
    ensureSpace(ctx, size + 4);
    text(ctx, l, { size, color: opts.color ?? ASH });
    ctx.y -= size + 4;
  }
}

/** Horizontal macro-split bar — the "chart" the plan page shows as a ring. */
function drawMacroBar(ctx: Ctx, proteinG: number, carbsG: number, fatG: number) {
  const proteinKcal = proteinG * 4;
  const carbsKcal = carbsG * 4;
  const fatKcal = fatG * 9;
  const total = proteinKcal + carbsKcal + fatKcal || 1;

  const barH = 16;
  const barY = ctx.y - barH;
  let x = MARGIN;

  const segments: [number, ReturnType<typeof rgb>, string][] = [
    [proteinKcal / total, BLOOD, `Protein ${proteinG}g`],
    [carbsKcal / total, rgb(0.55, 0.55, 0.57), `Carbs ${carbsG}g`],
    [fatKcal / total, rgb(0.15, 0.15, 0.15), `Fat ${fatG}g`],
  ];

  for (const [fraction, color] of segments) {
    const w = CONTENT_W * fraction;
    ctx.page.drawRectangle({ x, y: barY, width: w, height: barH, color });
    x += w;
  }

  ctx.y = barY - 14;
  let legendX = MARGIN;
  for (const [, color, label] of segments) {
    ctx.page.drawRectangle({ x: legendX, y: ctx.y, width: 8, height: 8, color });
    ctx.page.drawText(label, {
      x: legendX + 12,
      y: ctx.y - 1,
      size: 8,
      font: ctx.font,
      color: ASH,
    });
    legendX += ctx.font.widthOfTextAtSize(label, 8) + 36;
  }
  ctx.y -= 24;
}

/** BMI position marker on a labelled scale — the print equivalent of the gauge. */
function drawBmiStrip(ctx: Ctx, bmi: number) {
  const min = 14;
  const max = 40;
  const bands: [number, number, ReturnType<typeof rgb>][] = [
    [14, 18.5, rgb(0.31, 0.56, 0.97)],
    [18.5, 23, rgb(0.25, 0.72, 0.31)],
    [23, 25, rgb(0.82, 0.6, 0.13)],
    [25, 40, BLOOD],
  ];

  const barH = 10;
  const barY = ctx.y - barH;

  for (const [from, to, color] of bands) {
    const x0 = MARGIN + ((from - min) / (max - min)) * CONTENT_W;
    const x1 = MARGIN + ((to - min) / (max - min)) * CONTENT_W;
    ctx.page.drawRectangle({ x: x0, y: barY, width: x1 - x0, height: barH, color });
  }

  const markerX = MARGIN + ((Math.min(max, Math.max(min, bmi)) - min) / (max - min)) * CONTENT_W;
  ctx.page.drawLine({
    start: { x: markerX, y: barY - 3 },
    end: { x: markerX, y: barY + barH + 3 },
    thickness: 2,
    color: INK,
  });

  ctx.y = barY - 16;
}

export async function renderPlanPdf(plan: DietPlan): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${siteConfig.name} — 7-Day Diet Chart`);
  doc.setProducer(siteConfig.name);

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const ctx: Ctx = { doc, font, bold, page: doc.addPage([PAGE_W, PAGE_H]), y: PAGE_H - MARGIN };

  // ── Header ────────────────────────────────────────────────────────────
  text(ctx, siteConfig.name, { size: 18, font: bold });
  text(ctx, "7-DAY PERSONALISED DIET CHART", {
    size: 8,
    color: ASH,
    x: PAGE_W - MARGIN - bold.widthOfTextAtSize("7-DAY PERSONALISED DIET CHART", 8),
  });
  ctx.y -= 20;
  line(ctx, INK);
  ctx.y -= 24;

  // ── Summary ───────────────────────────────────────────────────────────
  const { metrics } = plan;
  text(ctx, "Summary", { size: 12, font: bold });
  ctx.y -= 18;

  const stats = [
    ["BMI", `${metrics.bmi} (${metrics.bmiCategoryAsian.replace(/_/g, " ")})`],
    ["BMR", `${metrics.bmr} kcal`],
    ["TDEE", `${metrics.tdee} kcal`],
    ["Target", `${metrics.targetKcal} kcal/day`],
    ["Water", `${(metrics.waterMl / 1000).toFixed(1)} L/day`],
    ["Diet type", plan.input.dietType.replace("_", "-")],
  ];
  const colW = CONTENT_W / 3;
  stats.forEach(([label, value], i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = MARGIN + col * colW;
    const y = ctx.y - row * 34;
    ctx.page.drawText(label.toUpperCase(), { x, y, size: 7.5, font, color: ASH });
    ctx.page.drawText(value, { x, y: y - 13, size: 11, font: bold, color: INK });
  });
  ctx.y -= 34 * Math.ceil(stats.length / 3) + 14;

  text(ctx, "BMI scale (Asian-Indian cutoffs)", { size: 8.5, color: ASH });
  ctx.y -= 12;
  drawBmiStrip(ctx, metrics.bmi);

  text(ctx, "Daily macro split", { size: 8.5, color: ASH });
  ctx.y -= 12;
  drawMacroBar(ctx, metrics.macros.proteinG, metrics.macros.carbsG, metrics.macros.fatG);

  if (metrics.appliedFloor) {
    ensureSpace(ctx, 20);
    paragraph(
      ctx,
      "Your calculated deficit would have gone below the safe minimum, so your target was raised to a safe floor.",
      { color: BLOOD },
    );
    ctx.y -= 6;
  }

  ensureSpace(ctx, 20);
  line(ctx);
  ctx.y -= 20;

  // ── Days ──────────────────────────────────────────────────────────────
  for (const day of plan.days) {
    ensureSpace(ctx, 60);
    text(ctx, `${day.label}${day.isNonVegDay ? "  ·  Non-veg day" : ""}`, { size: 13, font: bold });
    const totalsLabel = `${day.totals.kcal} kcal  ·  P${day.totals.protein}g  C${day.totals.carbs}g  F${day.totals.fat}g`;
    text(ctx, totalsLabel, {
      size: 8.5,
      color: ASH,
      x: PAGE_W - MARGIN - font.widthOfTextAtSize(totalsLabel, 8.5),
    });
    ctx.y -= 16;

    for (const meal of day.meals) {
      ensureSpace(ctx, 16 + meal.items.length * 12);
      text(ctx, `${meal.label} — ${meal.timeHint}`, { size: 9.5, font: bold });
      text(ctx, `${meal.totals.kcal} kcal`, {
        size: 8.5,
        color: ASH,
        x: PAGE_W - MARGIN - font.widthOfTextAtSize(`${meal.totals.kcal} kcal`, 8.5),
      });
      ctx.y -= 13;

      for (const item of meal.items) {
        ensureSpace(ctx, 12);
        text(ctx, `${item.name} — ${item.measure}`, { size: 8.5, color: INK, x: MARGIN + 8 });
        const kcalLabel = `${item.kcal} kcal`;
        text(ctx, kcalLabel, {
          size: 8.5,
          color: ASH,
          x: PAGE_W - MARGIN - font.widthOfTextAtSize(kcalLabel, 8.5),
        });
        ctx.y -= 12;
      }
      ctx.y -= 4;
    }

    ensureSpace(ctx, 10);
    line(ctx);
    ctx.y -= 16;
  }

  // ── Notes ─────────────────────────────────────────────────────────────
  ensureSpace(ctx, 40);
  text(ctx, "Notes", { size: 12, font: bold });
  ctx.y -= 16;
  for (const note of plan.notes) {
    ensureSpace(ctx, 14);
    paragraph(ctx, `•  ${note}`, { size: 8.5 });
    ctx.y -= 2;
  }

  ensureSpace(ctx, 40);
  ctx.y -= 8;
  paragraph(
    ctx,
    "Not medical advice. This chart is generated automatically for general fitness guidance and is not a " +
      "substitute for professional medical or dietetic care. Consult a doctor before starting any diet if " +
      "pregnant or breastfeeding, under 18, or managing a medical condition.",
    { size: 7.5, color: ASH },
  );

  return doc.save();
}
