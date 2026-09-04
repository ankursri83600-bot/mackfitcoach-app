"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui";

/** Client wrapper so the router push isn't wired through a server action stub. */
export function DemoUnlockButton({
  planId,
  tierSlug,
  className,
}: {
  planId?: string;
  tierSlug: string;
  className?: string;
}) {
  const router = useRouter();

  return (
    <Button
      className={className}
      onClick={() => {
        const target = planId
          ? `/diet/${planId}?unlocked=1`
          : `/checkout/success?tier=${tierSlug}`;
        router.push(target);
      }}
    >
      Simulate purchase (demo)
    </Button>
  );
}
