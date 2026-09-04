import type { Metadata } from "next";

import { LegalPage } from "@/components/legal";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = { title: "Privacy policy" };

export default function PrivacyPolicyPage() {
  return (
    <LegalPage title="PRIVACY POLICY" updated="August 2026">
      <h2>What we collect</h2>
      <p>
        To generate a diet chart we collect your age, biological sex, height, weight, activity level,
        goal, dietary preferences, allergies and any medical notes you choose to share. If you create
        an account we also store your name, email and phone number.
      </p>

      <h2>Health data</h2>
      <p>
        <strong>Your body measurements and medical notes are sensitive personal data.</strong> We use
        them only to generate and review your plan. They are never sold, never used for advertising,
        and are visible only to you and to our coaching staff. We do not log them in analytics.
      </p>

      <h2>Payments</h2>
      <p>
        Payments are processed by Razorpay. We never see or store your card number, UPI PIN or bank
        credentials — we store only a payment reference, the amount, and whether it succeeded.
      </p>

      <h2>Client photos</h2>
      <p>
        Before and after photographs are only published with written consent, and our database
        enforces that: a story cannot appear publicly unless consent has been recorded against it.
        You may withdraw consent at any time and we will remove the images.
      </p>

      <h2>Retention</h2>
      <p>
        Plans and intake records are kept while your account is active. Write to{" "}
        {siteConfig.contact.email} to request deletion and we will remove your personal data,
        retaining only the minimum transaction records required by law.
      </p>

      <h2>Your rights</h2>
      <p>
        You may request access to, correction of, or deletion of your data by emailing{" "}
        {siteConfig.contact.email}.
      </p>
    </LegalPage>
  );
}
