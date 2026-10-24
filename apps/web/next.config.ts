import type { NextConfig } from 'next';
import path from 'node:path';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants';
const nextConfig = (phase: string): NextConfig => ({
  // Development writes must never replace a running production build (or vice versa).
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? '.next-dev' : '.next',
  outputFileTracingRoot: path.resolve(__dirname),
});
export default nextConfig;
