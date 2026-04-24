/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  turbopack: {
    resolveAlias: {
      // mupdf has a Node-only `await import("module")` for createRequire that
      // browsers don't have. Stub it with an empty module so Turbopack can build.
      module: { browser: './stubs/empty-module.js' },
    },
  },
  serverExternalPackages: ['mupdf', '@huggingface/transformers'],
};

export default nextConfig;
