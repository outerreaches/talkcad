import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import { resolve } from 'path';

/**
 * Injects a Content-Security-Policy into the built index.html.
 * Dev needs inline scripts (React refresh preamble) and the HMR websocket;
 * production does not.
 */
function cspPlugin(): Plugin {
  let isDev = false;
  return {
    name: 'talkcad-csp',
    configResolved(config) {
      isDev = config.command === 'serve';
    },
    transformIndexHtml(html) {
      const policy = [
        "default-src 'self' file:",
        isDev
          ? "script-src 'self' file: 'unsafe-inline' 'wasm-unsafe-eval'"
          : "script-src 'self' file: 'wasm-unsafe-eval'",
        "style-src 'self' file: 'unsafe-inline'",
        "img-src 'self' file: data: blob: https:",
        "font-src 'self' file: data:",
        "media-src 'self' file: blob:",
        "worker-src 'self' file: blob:",
        "object-src 'none'",
        "base-uri 'none'",
        "form-action 'none'",
        isDev
          ? "connect-src 'self' https: http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*"
          : "connect-src 'self' https: http://localhost:* http://127.0.0.1:*",
      ].join('; ');

      return html.replace(
        '</head>',
        `    <meta http-equiv="Content-Security-Policy" content="${policy}">\n  </head>`
      );
    },
  };
}

export default defineConfig({
  plugins: [
    cspPlugin(),
    react(),
    electron([
      {
        entry: 'electron/main.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              // Keep native-ish / complex CJS deps external to avoid bundler interop issues.
              // (potrace pulls in Jimp and relies on constructor semantics for instanceof checks)
              external: ['electron', 'potrace'],
            },
          },
        },
      },
      {
        entry: 'electron/preload.ts',
        onstart(args) {
          args.reload();
        },
        vite: {
          build: {
            outDir: 'dist-electron',
          },
        },
      },
    ]),
    renderer(),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
