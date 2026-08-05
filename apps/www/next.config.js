const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
});

/**
 * @type {import('next').NextConfig}
 */
const config = {
  output: "export",
  // monaco-yaml is `type: module` with no exports map. Next.js classifies it as an ESM
  // external and refuses the `new Worker(new URL("monaco-yaml/yaml.worker.js", ...))`
  // specifier that emits the worker chunk, so YAML schema validation cannot build without
  // both of the next two settings. Verified by removing each in turn: transpilePackages
  // alone still fails on the same specifier.
  transpilePackages: ["monaco-yaml"],
  experimental: {
    // Next.js warns this "may disrupt module resolution" and it is not set lightly. The
    // failure it fixes is a hard build error, not a preference, and the alias below covers
    // the one resolution it does disrupt. Revisit if monaco-yaml ever ships an exports map.
    esmExternals: "loose",
  },
  reactStrictMode: false,
  productionBrowserSourceMaps: false,
  compiler: {
    styledComponents: true,
  },
  // Only consulted when running without --webpack, which neither `dev` nor `build` does
  // today. Switching to turbopack would also need the monaco-yaml worker and the
  // monaco-editor worker alias wired up here, or YAML schema validation silently stops
  // producing markers.
  turbopack: {
    resolveAlias: {
      fs: {
        browser: "./shims/empty.ts",
      },
    },
  },
  webpack: (config, { isServer }) => {
    config.resolve.fallback = { fs: false };

    // monaco-yaml's worker imports "monaco-editor/esm/vs/editor/editor.worker.js", which
    // monaco-editor's own exports map cannot resolve: the map rewrites "./*.js" to
    // "./esm/vs/*.js", so that specifier becomes ./esm/vs/esm/vs/editor/editor.worker.js
    // and misses. Resolving through a specifier the map does accept and aliasing the
    // written one onto it is what lets the worker build.
    config.resolve.alias = {
      ...config.resolve.alias,
      "monaco-editor/esm/vs/editor/editor.worker.js": require.resolve(
        "monaco-editor/editor/editor.worker.js"
      ),
    };
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
