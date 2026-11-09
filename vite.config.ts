import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { defineConfig, loadEnv, type Plugin } from 'vite';

/**
 * Serves api/*.ts during `npm run dev`, the same files Vercel deploys as serverless functions.
 * Handlers use the Web signature: `export async function POST(request: Request): Promise<Response>`.
 */
function apiDevServer(): Plugin {
  return {
    name: 'agusta-api-dev',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next();
        const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);
        const name = url.pathname.replace(/^\/api\//, '').replace(/\/$/, '');
        const file = path.resolve(__dirname, 'api', `${name}.ts`);
        if (!/^[a-z0-9-]+$/.test(name) || !fs.existsSync(file)) return next();
        try {
          const mod = await server.ssrLoadModule(file);
          const handler = mod[req.method ?? 'GET'];
          if (typeof handler !== 'function') {
            res.statusCode = 405;
            return res.end('Method Not Allowed');
          }
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);
          const headers = new Headers();
          for (const [k, v] of Object.entries(req.headers)) {
            if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(', ') : v);
          }
          const hasBody = req.method !== 'GET' && req.method !== 'HEAD' && chunks.length > 0;
          const response: Response = await handler(new Request(url, { method: req.method, headers, body: hasBody ? Buffer.concat(chunks) : undefined }));
          res.statusCode = response.status;
          response.headers.forEach((value, key) => res.setHeader(key, value));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (e) {
          server.config.logger.error(`[api] ${name}: ${(e as Error).stack ?? e}`);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Terjadi kesalahan di server lokal.' }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Make .env / .env.local values (incl. server-only secrets) visible to the dev API handlers.
  const env = loadEnv(mode, process.cwd(), '');
  for (const [k, v] of Object.entries(env)) if (process.env[k] === undefined) process.env[k] = v;

  return {
    plugins: [react(), tailwindcss(), apiDevServer()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
