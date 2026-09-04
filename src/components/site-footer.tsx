import { Mail, Phone } from "lucide-react";
import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { Container, HealthDisclaimer, Rule } from "@/components/ui";
import { siteConfig } from "@/lib/site-config";

const COLUMNS = [
  {
    title: "Programme",
    links: [
      { href: "/diet", label: "Free diet chart" },
      { href: "/plans", label: "Pricing" },
      { href: "/book", label: "Book a consult" },
      { href: "/transformations", label: "Transformations" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About the coach" },
      { href: "/coaches", label: "Our coaches" },
      { href: "/contact", label: "Contact" },
      { href: "/faq", label: "FAQ" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/privacy-policy", label: "Privacy policy" },
      { href: "/refund-policy", label: "Refund policy" },
      { href: "/terms", label: "Terms of service" },
    ],
  },
] as const;

/** lucide-react v1 dropped brand marks, so the social glyphs are inline. */
function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.7 3.7 0 0 1-1.38-.9c-.42-.42-.68-.82-.9-1.38-.16-.42-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16Zm0 1.98c-3.15 0-3.5.01-4.74.07-.95.04-1.44.2-1.77.33-.42.16-.7.35-1 .66-.31.3-.5.58-.66 1-.13.33-.29.82-.33 1.77-.06 1.23-.07 1.59-.07 4.74s.01 3.5.07 4.74c.04.95.2 1.44.33 1.77.16.42.35.7.66 1 .3.31.58.5 1 .66.33.13.82.29 1.77.33 1.23.06 1.59.07 4.74.07s3.5-.01 4.74-.07c.95-.04 1.44-.2 1.77-.33.42-.16.7-.35 1-.66.31-.3.5-.58.66-1 .13-.33.29-.82.33-1.77.06-1.23.07-1.59.07-4.74s-.01-3.5-.07-4.74c-.04-.95-.2-1.44-.33-1.77a2.7 2.7 0 0 0-.66-1c-.3-.31-.58-.5-1-.66-.33-.13-.82-.29-1.77-.33-1.23-.06-1.59-.07-4.74-.07Zm0 3.37a4.49 4.49 0 1 1 0 8.98 4.49 4.49 0 0 1 0-8.98Zm0 1.98a2.51 2.51 0 1 0 0 5.02 2.51 2.51 0 0 0 0-5.02Zm5.72-2.2a1.05 1.05 0 1 1-2.1 0 1.05 1.05 0 0 1 2.1 0Z" />
    </svg>
  );
}

function YoutubeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M21.58 7.19c-.23-.86-.91-1.54-1.77-1.77C18.25 5 12 5 12 5s-6.25 0-7.81.42c-.86.23-1.54.91-1.77 1.77C2 8.75 2 12 2 12s0 3.25.42 4.81c.23.86.91 1.54 1.77 1.77C5.75 19 12 19 12 19s6.25 0 7.81-.42a2.5 2.5 0 0 0 1.77-1.77C22 15.25 22 12 22 12s0-3.25-.42-4.81ZM10 15.5v-7l6 3.5-6 3.5Z" />
    </svg>
  );
}

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-hairline bg-ink print:hidden">
      <Container className="py-16">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Logo variant="stacked" size={72} href={null} className="items-start" />
            <p className="mt-5 max-w-xs text-caption leading-relaxed text-ash">
              {siteConfig.description}
            </p>
            <div className="mt-5 flex items-center gap-3">
              <a
                href={siteConfig.social.instagram}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="grid size-10 place-items-center rounded-sm border border-hairline text-ash transition-colors hover:border-blood hover:text-blood-bright"
              >
                <InstagramIcon className="size-4" />
              </a>
              <a
                href={siteConfig.social.youtube}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="YouTube"
                className="grid size-10 place-items-center rounded-sm border border-hairline text-ash transition-colors hover:border-blood hover:text-blood-bright"
              >
                <YoutubeIcon className="size-4" />
              </a>
            </div>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="font-display text-[0.75rem] tracking-[0.24em] text-bone">
                {col.title}
              </h3>
              <ul className="mt-5 space-y-3">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-caption text-ash transition-colors hover:text-bone"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <Rule className="my-10" />

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <a
              href={`mailto:${siteConfig.contact.email}`}
              className="inline-flex items-center gap-2 text-caption text-ash transition-colors hover:text-bone"
            >
              <Mail className="size-3.5" aria-hidden="true" />
              {siteConfig.contact.email}
            </a>
            <a
              href={`tel:${siteConfig.contact.whatsapp}`}
              className="inline-flex items-center gap-2 text-caption text-ash transition-colors hover:text-bone"
            >
              <Phone className="size-3.5" aria-hidden="true" />
              {siteConfig.contact.phoneLabel}
            </a>
          </div>
          <p className="text-caption text-ash-dim">
            © {year} {siteConfig.name}. All rights reserved.
          </p>
        </div>

        <HealthDisclaimer className="mt-8 max-w-3xl" />
      </Container>
    </footer>
  );
}
