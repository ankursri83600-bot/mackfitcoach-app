import type { Metadata } from "next";

import { LegalPage } from "@/components/legal";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = { title: "Terms of service" };

export default function TermsPage() {
  return (
    <LegalPage title="TERMS OF SERVICE" updated="August 2026">
      <h2>Not medical advice</h2>
      <p>
        <strong>
          {siteConfig.name} provides general fitness and nutrition guidance, not medical treatment.
        </strong>{" "}
        The diet charts are generated automatically from the information you provide. They are not a
        diagnosis and not a substitute for care from a doctor or registered dietician.
      </p>
      <p>
        Consult a doctor before starting any plan if you are pregnant or breastfeeding, are under 18,
        or manage a condition such as diabetes, thyroid disorder, kidney disease, an eating disorder,
        or heart disease. Stop and seek medical help if you feel unwell.
      </p>

      <h2>Your responsibilities</h2>
      <ul>
        <li>Give accurate information — the plan is only as good as the numbers you enter.</li>
        <li>Tell us about medical conditions and allergies.</li>
        <li>Do not share your account or resell the plans.</li>
      </ul>

      <h2>Results</h2>
      <p>
        Results vary and depend on adherence, training, sleep, genetics and medical factors. Any
        timeline shown in a plan is a straight-line estimate, not a promise.
      </p>

      <h2>Payments</h2>
      <p>
        Prices are in Indian rupees and include applicable taxes. Payments are handled by Razorpay.
        See our refund policy for cancellations.
      </p>

      <h2>Contact</h2>
      <p>Questions about these terms: {siteConfig.contact.email}</p>
    </LegalPage>
  );
}
