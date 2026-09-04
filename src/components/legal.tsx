import type { ReactNode } from "react";

import { Container, Eyebrow, Section } from "@/components/ui";

/** Shared shell + typography for the policy pages. */
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <Section>
      <Container className="max-w-3xl">
        <Eyebrow>Legal</Eyebrow>
        <h1 className="mt-4 font-display text-h2 text-bone">{title}</h1>
        <p className="mt-2 text-caption text-ash-dim">Last updated {updated}</p>

        <div
          className="mt-10 flex flex-col gap-5 text-caption leading-relaxed text-ash
                     [&_h2]:mt-6 [&_h2]:font-display [&_h2]:text-h4 [&_h2]:text-bone
                     [&_strong]:text-bone [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-2"
        >
          {children}
        </div>
      </Container>
    </Section>
  );
}
