/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === "production";

const nextConfig = {
  ...(isProd ? { output: "standalone" } : {}),
  transpilePackages: ["@renis/database", "@renis/core"],
  serverExternalPackages: [
    "@prisma/client",
    "@aws-sdk/client-s3",
    "@aws-sdk/s3-request-presigner",
    "puppeteer-core",
    "@sparticuz/chromium",
  ],
  webpack: (config, { dev }) => {
    if (dev && process.env.WATCHPACK_POLLING === "true") {
      config.watchOptions = {
        poll: Number(process.env.WATCHPACK_POLLING_INTERVAL || 1000),
        aggregateTimeout: 300,
      };
    }
    return config;
  },
};

export default nextConfig;
