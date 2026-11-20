import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  // The record is rendered per request: "today" is computed in the workbook's zone,
  // never frozen into a build artifact. Nothing is cached, because everything on the
  // page depends on a date that moves.
  cacheComponents: false,
  turbopack: { root: path.resolve(import.meta.dirname) },
  experimental: {
    optimizePackageImports: ['gsap'],
  },
};

export default nextConfig;
