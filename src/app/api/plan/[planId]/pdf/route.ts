import { NextResponse, type NextRequest } from "next/server";

import { getPlan } from "@/lib/diet/storage";
import { renderPlanPdf } from "@/lib/diet/pdf";
import { resolveAccess } from "@/lib/entitlements";
import { isRazorpayConfigured } from "@/lib/razorpay";

export const runtime = "nodejs";

/**
 * Streams the full plan as a PDF. Gated the same way as the plan page itself —
 * a downloadable file is not a loophole around the paywall, so the free tier
 * only ever gets Day 1.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ planId: string }> },
) {
  const { planId } = await params;
  const entry = await getPlan(planId);
  if (!entry) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  const searchParams = Object.fromEntries(request.nextUrl.searchParams);
  const access = await resolveAccess(entry, searchParams, isRazorpayConfigured());

  if (!access.canView) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  if (access.level !== "full") {
    return NextResponse.json(
      { error: "Unlock the full plan to download the PDF." },
      { status: 403 },
    );
  }

  const bytes = await renderPlanPdf(entry.plan);

  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="diet-chart-${planId.slice(0, 8)}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
