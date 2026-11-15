import { createServer } from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchRecipePage } from './supabase/functions/_shared/recipe-page.mjs';
import { handlePinchApi } from './server/pinch.mjs';
import { importVideoRecipe } from './server/recipe-video.mjs';

const root = fileURLToPath(new URL('./dist', import.meta.url));
const port = Number(process.env.PINCH_PORT ?? 4173);
const host = process.env.PINCH_HOST ?? '127.0.0.1';
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.ico': 'image/x-icon',
  '.ttf': 'font/ttf', '.css': 'text/css', '.json': 'application/json',
};

if (!existsSync(resolve(root, 'index.html'))) console.log('Build the web bundle with npm run build:web to enable the browser preview.');

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/api/import-video' && req.method === 'POST') {
      await importVideoRecipe(req, res);
      return;
    }
    if (url.pathname.startsWith('/api/pinch/')) {
      await handlePinchApi(req, res, url.pathname);
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405).end();
      return;
    }
    if (url.pathname === '/api/import' && req.method === 'GET') {
      const page = await fetchRecipePage(url.searchParams.get('url'), AbortSignal.timeout(12000));
      res.writeHead(200, { 'Content-Type': types['.json'], 'Cache-Control': 'no-store' }).end(JSON.stringify(page));
      return;
    }
    const path = resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    if (!path.startsWith(root + sep) || !(await stat(path)).isFile()) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, {
      'Content-Type': types[extname(path)] ?? 'application/octet-stream',
      'Cache-Control': extname(path) === '.html' ? 'no-store' : 'no-cache',
    });
    if (req.method === 'HEAD') res.end();
    else createReadStream(path).on('error', () => res.destroy()).pipe(res);
  } catch {
    res.writeHead(404).end();
  }
}).listen(port, host, () => console.log(`To Taste is running at http://${host}:${port}`));
