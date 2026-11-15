import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import { Buffer } from 'node:buffer';
import ipaddr from 'ipaddr.js';

const maxBytes = 4 * 1024 * 1024;

export async function fetchRecipePage(input, signal, redirects = 0) {
  const url = new URL(input);
  if (url.protocol !== 'https:' || url.username || url.password || url.port || redirects > 4 || url.href.length > 2048
    || !url.hostname.includes('.') || ipaddr.isValid(url.hostname)) {
    throw new Error('Only public HTTPS pages can be imported.');
  }
  const addresses = await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some(({ address }) => ipaddr.process(address).range() !== 'unicast')) {
    throw new Error('Only public HTTPS pages can be imported.');
  }
  const destination = addresses.find(({ family }) => family === 4) ?? addresses[0];

  return new Promise((resolvePage, rejectPage) => {
    // Connect to the vetted IP. Preserve the original TLS and HTTP hostname.
    const upstream = request({
      hostname: destination.address, servername: url.hostname, family: destination.family,
      path: url.pathname + url.search, agent: false, signal,
      headers: { Host: url.host, Accept: 'text/html', 'Accept-Encoding': 'identity', 'User-Agent': 'To Taste Recipe Import/1.0' },
    }, incoming => {
      incoming.on('error', rejectPage);
      const status = incoming.statusCode ?? 0;
      if ([301, 302, 303, 307, 308].includes(status) && incoming.headers.location) {
        incoming.destroy();
        try { resolvePage(fetchRecipePage(new URL(incoming.headers.location, url), signal, redirects + 1)); }
        catch (error) { rejectPage(error); }
        return;
      }
      if (status < 200 || status >= 300 || !/text\/html|application\/xhtml\+xml/i.test(incoming.headers['content-type'] ?? '')) {
        incoming.destroy();
        rejectPage(new Error('Recipe page unavailable.'));
        return;
      }
      const chunks = [];
      let size = 0;
      incoming.on('data', chunk => {
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
