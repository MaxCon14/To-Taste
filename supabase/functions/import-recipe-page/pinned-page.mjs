import { Buffer } from 'node:buffer';
import { HTTPParser } from 'npm:http-parser-js@0.5.10';
import { maxRecipePageBytes, publicRecipeDestination } from '../_shared/recipe-page.mjs';

export async function fetchPinnedPage(input, signal, redirects = 0) {
  const { url, destination } = await publicRecipeDestination(input, redirects);
  signal.throwIfAborted();
  const tcp = await Deno.connect({ hostname: destination.address, port: 443, signal });
  let socket = tcp;
  const close = () => { try { socket.close(); } catch { /* connection already closed */ } };
  signal.addEventListener('abort', close, { once: true });
  let destinationLink;
  try {
    // Deno's HTTPS shim uses the URL host for TLS. Start TLS explicitly to pin the address and keep hostname verification.
    socket = await Deno.startTls(tcp, { hostname: url.hostname, alpnProtocols: ['http/1.1'] });
    signal.throwIfAborted();
    const request = new TextEncoder().encode(
      `GET ${url.pathname}${url.search} HTTP/1.1\r\nHost: ${url.host}\r\nUser-Agent: To Taste Recipe Import/1.0\r\nAccept: text/html\r\nAccept-Encoding: identity\r\nConnection: close\r\n\r\n`,
    );
    for (let written = 0; written < request.length;) written += await socket.write(request.subarray(written));
    const parser = new HTTPParser(HTTPParser.RESPONSE);
    let complete = false;
    let size = 0;
    const chunks = [];
    parser[HTTPParser.kOnHeadersComplete] = ({ headers, statusCode }) => {
      const metadata = new Map();
      for (let i = 0; i < headers.length; i += 2) metadata.set(headers[i].toLowerCase(), headers[i + 1]);
      if ([301, 302, 303, 307, 308].includes(statusCode) && metadata.get('location')) {
        destinationLink = new URL(metadata.get('location'), url);
        return 2;
      }
      if (statusCode < 200 || statusCode >= 300 || !/text\/html|application\/xhtml\+xml/i.test(metadata.get('content-type') ?? '')) {
        throw new Error(`Upstream returned HTTP ${statusCode} or a non-HTML response.`);
      }
    };
    parser[HTTPParser.kOnBody] = (chunk, offset, length) => {
      size += length;
      if (size > maxRecipePageBytes) throw new Error('Recipe page is too large.');
      chunks.push(Buffer.from(chunk.subarray(offset, offset + length)));
    };
    parser[HTTPParser.kOnMessageComplete] = () => { complete = true; };
    const buffer = new Uint8Array(32 * 1024);
    while (!complete && !destinationLink) {
      const count = await socket.read(buffer);
      if (count === null) {
        const error = parser.finish();
        if (error) throw error;
        break;
      }
      const result = parser.execute(Buffer.from(buffer.subarray(0, count)));
      if (result instanceof Error) throw result;
    }
    if (!destinationLink) {
      if (!complete || !size) throw new Error('Recipe page response was incomplete.');
      return { html: Buffer.concat(chunks).toString('utf8'), url: url.href };
    }
  } finally {
    signal.removeEventListener('abort', close);
    close();
  }
  return fetchPinnedPage(destinationLink, signal, redirects + 1);
}
