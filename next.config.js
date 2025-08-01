/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Added comment to trigger redeploy
};
module.exports = nextConfig;