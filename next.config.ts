import type { NextConfig } from 'next'
import path from 'node:path'

const nextConfig: NextConfig = {
  // Pin workspace root so Next doesn't crawl up to ~ and pick up a stray lockfile.
  outputFileTracingRoot: path.resolve(__dirname),
}

export default nextConfig
