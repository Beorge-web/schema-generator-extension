import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import * as path from "path";
import { fileURLToPath } from "url";
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Custom plugin to copy manifest.json and icons
const copyAssets = () => ({
  name: 'copy-assets',
  buildEnd() {
    // Copy icons
    const iconSizes = ['16', '48', '128'];
    iconSizes.forEach(size => {
      const iconPath = path.resolve(__dirname, `src/assets/icons/icon${size}.svg`);
      if (fs.existsSync(iconPath)) {
        const iconContent = fs.readFileSync(iconPath);
        this.emitFile({
          type: 'asset',
          fileName: `icons/icon${size}.svg`,
          source: iconContent
        });
      }
    });

    // Copy existing manifest.json
    const manifestPath = path.resolve(__dirname, 'manifest.json');
    if (fs.existsSync(manifestPath)) {
      const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
      this.emitFile({
        type: 'asset',
        fileName: 'manifest.json',
        source: manifestContent
      });
    }
  }
});

export default defineConfig({
  plugins: [preact(), copyAssets()],
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        popup: path.resolve(__dirname, "src/popup/index.html"),
        background: path.resolve(__dirname, "src/background/background.ts"),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          // Ensure background.ts is built as background.js
          return chunkInfo.name === "background"
            ? "background.js"
            : "[name].js";
        },
        chunkFileNames: "[name].js",
        assetFileNames: (assetInfo) => {
          // Keep HTML files at root level of dist
          if (assetInfo.name?.endsWith(".html")) {
            return "[name][extname]";
          }
          // All other assets go into their respective folders
          return "assets/[name][extname]";
        },
      },
    },
    // Ensure source maps are generated
    sourcemap: true,
  },
});
