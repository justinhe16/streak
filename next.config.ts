import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    // Everything lives on one page now; old tab URLs land there.
    return ["/grid", "/goals", "/builds", "/reflections"].map((source) => ({
      source,
      destination: "/",
      permanent: false,
    }));
  },
};

export default nextConfig;
