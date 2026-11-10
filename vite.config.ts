import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import fs from 'node:fs';
import path from 'node:path';

function excludeAiStudioAssets(): Plugin {
  return {
    name: 'exclude-aistudio-assets',
    closeBundle() {
      // Prompt attachment screenshots uploaded to chat are saved by the platform into public/assets/aistudio
      // They must NEVER be bundled into production web dist or Android APK assets.
      const distAiStudio = path.resolve(__dirname, 'dist/assets/aistudio');
      if (fs.existsSync(distAiStudio)) {
        fs.rmSync(distAiStudio, { recursive: true, force: true });
      }
    }
  };
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    excludeAiStudioAssets()
  ],
  server: {
    host: '0.0.0.0',
    port: 3000
  }
});
