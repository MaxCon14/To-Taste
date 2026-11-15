import { createClient } from 'npm:@supabase/supabase-js@2.119.0';
import { fetchPinnedPage } from './pinned-page.mjs';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
};

export default {
  async fetch(request: Request) {
    const reply = (status: number, body: object) => Response.json(body, { status, headers });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return reply(405, { error: 'Use POST.' });
    const token = request.headers.get('Authorization')?.match(/^Bearer (\S+)$/i)?.[1];
    if (!token) return reply(401, { error: 'Sign in to import a recipe.' });
    const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!);
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user || data.user.is_anonymous) return reply(401, { error: 'Sign in to import a recipe.' });
    try {
      if (!request.body) return reply(400, { error: 'Enter a recipe link.' });
      const reader = request.body.getReader();
      const bytes = new Uint8Array(2048);
      let length = 0;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (length + value.length > bytes.length) {
            await reader.cancel();
            return reply(400, { error: 'Enter a valid recipe link.' });
          }
          bytes.set(value, length);
          length += value.length;
        }
      } finally {
        reader.releaseLock();
      }
      if (!length) return reply(400, { error: 'Enter a recipe link.' });
      const raw = new TextDecoder().decode(bytes.subarray(0, length));
      return reply(200, await fetchPinnedPage(raw, AbortSignal.timeout(11000)));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message.split('\n')[0].replace(/https?:\/\/\S+/g, '[URL]') : 'Unknown upstream error';
      console.warn('Recipe page request failed', message);
      return reply(422, { error: 'This page couldn’t be imported.' });
    }
  },
};
