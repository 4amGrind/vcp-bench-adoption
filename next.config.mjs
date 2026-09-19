/** @type {import('next').NextConfig} */
const nextConfig = {
  // These load native or wasm files, so let Node load them directly.
  serverExternalPackages: ['pg', '@electric-sql/pglite'],
  poweredByHeader: false,
};
export default nextConfig;
