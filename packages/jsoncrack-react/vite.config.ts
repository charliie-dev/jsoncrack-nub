import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      // Two entries: the full component, and a palette-only module with no renderer
      // dependencies so hosts can read colours without loading reaflow on the server.
      entry: {
        index: resolve(__dirname, "src/index.ts"),
        palette: resolve(__dirname, "src/palette.ts"),
      },
      formats: ["es"],
    },
    rolldownOptions: {
      external: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "reaflow",
        "react-zoomable-ui",
        "jsonc-parser",
      ],
      output: {
        assetFileNames: "index[extname]",
      },
    },
  },
});
