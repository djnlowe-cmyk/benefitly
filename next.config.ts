import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Enables `unauthorized()` / `forbidden()` from `next/navigation` so
    // server components and route handlers can short-circuit with the
    // matching HTTP status. `notFound()` does not require this flag.
    authInterrupts: true,
  },
};

export default nextConfig;
