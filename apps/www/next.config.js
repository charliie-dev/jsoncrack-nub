const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
});

/**
 * @type {import('next').NextConfig}
 */
const config = {
  output: "export",
  // monaco's ESM modules import their own CSS, which the pages router refuses to accept
  // from node_modules unless the package is transpiled as first-party source.
  transpilePackages: ["monaco-editor"],
  reactStrictMode: false,
  productionBrowserSourceMaps: false,
  compiler: {
    styledComponents: true,
  },
  // Only consulted when running without --webpack, which neither `dev` nor `build` does
  // today. Switching to turbopack would also need monaco's worker chunks wired up here.
  turbopack: {
    resolveAlias: {
      fs: {
        browser: "./shims/empty.ts",
      },
    },
  },
  webpack: (config, { isServer }) => {
    config.resolve.fallback = { fs: false };
    config.output.webassemblyModuleFilename = "static/wasm/[modulehash].wasm";
    config.experiments = { asyncWebAssembly: true, layers: true };

    if (!isServer) {
      config.output.environment = { ...config.output.environment, asyncFunction: true };
    }

    return config;
  },
};

const configExport = () => {
  if (process.env.ANALYZE === "true") return withBundleAnalyzer(config);
  return config;
};

module.exports = configExport();
