/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  turbopack: {},
  serverExternalPackages: ['mupdf', '@huggingface/transformers'],
};

export default nextConfig;
