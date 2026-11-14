import { createServer } from 'node:http';
import { request } from 'node:https';
import { lookup } from 'node:dns/promises';
import { createReadStream, existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ipaddr from 'ipaddr.js';
import { handlePinchApi } from './server/pinch.mjs';

const root = fileURLToPath(new URL('./dist', import.meta.url));
const port = Number(process.env.PINCH_PORT ?? 4173);
const host = process.env.PINCH_HOST ?? '127.0.0.1';
const maxBytes = 6 * 1024 * 1024;
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.ico': 'image/x-icon',
  '.ttf': 'font/ttf', '.css': 'text/css', '.json': 'application/json',
};

async function fetchPage(input, signal, redirects = 0) {
  const url = new URL(input);
  if (url.protocol !== 'https:' || url.username || url.password || url.port || redirects > 4) {
    throw new Error('Only public HTTPS pages can be imported.');
  }
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = await lookup(host, { all: true });
  if (!addresses.length || addresses.some(({ address }) => ipaddr.process(address).range() !== 'unicast')) {
    throw new Error('Only public HTTPS pages can be imported.');
  }
  const destination = addresses.find(({ family }) => family === 4) ?? addresses[0];

  return new Promise((resolvePage, rejectPage) => {
    const upstream = request(url, {
      signal,
      family: destination.family,
      lookup: (_host, options, done) => options.all
        ? done(null, [destination])
        : done(null, destination.address, destination.family),
      headers: { Accept: 'text/html', 'User-Agent': 'To Taste Recipe Import/1.0' },
    }, (incoming) => {
      incoming.on('error', rejectPage);
      const status = incoming.statusCode ?? 0;
      if ([301, 302, 303, 307, 308].includes(status) && incoming.headers.location) {
        incoming.destroy();
        resolvePage(fetchPage(new URL(incoming.headers.location, url), signal, redirects + 1));
        return;
      }
      if (status < 200 || status >= 300 || !/text\/html|application\/xhtml\+xml/i.test(incoming.headers['content-type'] ?? '')) {
        incoming.destroy();
        rejectPage(new Error('Recipe page unavailable.'));
        return;
      }
      const chunks = [];
      let size = 0;
      incoming.on('data', (chunk) => {
        size += chunk.length;
        if (size > maxBytes) incoming.destroy(new Error('Recipe page is too large.'));
        else chunks.push(chunk);
      });
      incoming.on('end', () => resolvePage({ html: Buffer.concat(chunks).toString('utf8'), url: url.href }));
    });
    upstream.on('error', rejectPage);
    upstream.end();
  });
}

if (!existsSync(resolve(root, 'index.html'))) console.log('Build the web bundle with npm run build:web to enable the browser preview.');

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/pinch/')) {
      await handlePinchApi(req, res, url.pathname);
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405).end();
      return;
    }
    if (url.pathname === '/api/import' && req.method === 'GET') {
      const page = await fetchPage(url.searchParams.get('url'), AbortSignal.timeout(12000));
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
