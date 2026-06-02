/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === "production";

const basePath = isProd ? "/semiconductor-stock" : "";

const nextConfig = {
  output: "export",
  basePath,
  assetPrefix: basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

export default nextConfig;
