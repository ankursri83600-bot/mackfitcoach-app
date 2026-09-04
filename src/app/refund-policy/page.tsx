import type { Metadata } from "next";

import { LegalPage } from "@/components/legal";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = { title: "Refund policy" };

export default function RefundPolicyPage() {
  return (
    <LegalPage title="REFUND POLICY" updated="August 2026">
      <h2>Full refund</h2>
      <p>
        If you have not unlocked your full plan and no consultation has taken place, write to us
        within <strong>7 days</strong> of purchase and we will refund you in full.
      </p>

      <h2>Partial refund</h2>
      <p>
        If you have used some of your consultations, we refund the unused portion pro rata. The diet
        chart itself is non-refundable once the full week has been unlocked, because it is delivered
        immediately and in full.
      </p>

      <h2>What is not refundable</h2>
      <ul>
        <li>Consultations that were attended, or missed without at least 4 hours notice.</li>
        <li>Plans unlocked more than 7 days ago.</li>
      </ul>

      <h2>How refunds are paid</h2>
      <p>
        Refunds go back through Razorpay to the original payment method, normally within 5–7 working
        days. When a refund is processed your plan access is revoked automatically.
      </p>

      <h2>How to ask</h2>
      <p>
        Email {siteConfig.contact.email} or message us on WhatsApp with your payment reference. No
        forms, no arguing.
      </p>
    </LegalPage>
  );
}
