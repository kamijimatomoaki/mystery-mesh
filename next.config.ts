import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // React Strict Mode for better error detection
  reactStrictMode: true,

  // Enable compression
  compress: true,

  // Image optimization
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "storage.googleapis.com",
        pathname: "/**",
      },
    ],
    formats: ["image/avif", "image/webp"], // Modern formats
    deviceSizes: [640, 750, 828, 1080, 1200, 1920], // Common breakpoints
  },

  // Experimental features for optimization
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
    // Optimize package imports
    optimizePackageImports: [
      "@/components",
      "@/core",
      "@/features",
      "lucide-react",
    ],
  },

  // Production optimizations
  poweredByHeader: false, // Remove X-Powered-By header
  generateEtags: true, // Generate ETags for caching

  // Output configuration
  output: "standalone", // For Docker/containerization
};

export default nextConfig;
