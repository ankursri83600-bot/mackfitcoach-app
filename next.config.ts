import type { NextConfig } from "next";

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
  images: {
    // AVIF first — roughly 20–30% smaller than WebP on the photographic
    // before/after shots, which are the heaviest payload on this site.
    formats: ["image/avif", "image/webp"],
    // Next 16 only honours qualities declared here; anything else silently
    // coerces to 75, which is why the decorative badge asks for 45.
    qualities: [45, 60, 75, 80, 90],
    // Client photos are uploaded under an immutable random key and never
    // overwritten, so a long cache is safe.
    minimumCacheTTL: 60 * 60 * 24 * 30,
    remotePatterns: supabaseHost
      ? [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/**" }]
      : [],
  },

  // Trim the client bundle: without this every lucide-react import pulls the
  // whole barrel file through the graph in dev.
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
