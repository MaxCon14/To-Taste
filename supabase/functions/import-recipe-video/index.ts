import { createClient } from 'npm:@supabase/supabase-js@2.119.0';
import { encodeBase64 } from 'jsr:@std/encoding@1/base64';
import { analyzeRecipeVideo } from './analyze.mjs';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
};
const maxBytes = 20 * 1024 * 1024;
const formats = new Set(['video/mp4', 'video/quicktime', 'video/webm']);

Deno.serve(async (request) => {
  const reply = (status: number, body: object) => Response.json(body, { status, headers });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return reply(405, { error: 'Use POST.' });
  const token = request.headers.get('Authorization')?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token) return reply(401, { error: 'Sign in to analyze a video.' });
  const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!);
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user || data.user.is_anonymous) return reply(401, { error: 'Sign in to analyze a video.' });
  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) return reply(503, { error: 'Video analysis is unavailable. You can still paste the caption.' });
  const mimeType = request.headers.get('content-type') ?? '';
  if (!formats.has(mimeType)) return reply(415, { error: 'Choose an MP4, MOV, or WebM video.' });
  if (!request.body) return reply(400, { error: 'Choose a video to upload.' });
  try {
    const bytes = new Uint8Array(maxBytes);
    let offset = 0;
    const reader = request.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (offset + value.length > maxBytes) {
          await reader.cancel();
          return reply(413, { error: 'Choose a video under 20 MB.' });
        }
        bytes.set(value, offset);
        offset += value.length;
      }
    } finally {
      reader.releaseLock();
    }
    if (!offset) return reply(400, { error: 'Choose a video to upload.' });
    const recipe = await analyzeRecipeVideo(key, mimeType, encodeBase64(bytes.subarray(0, offset)));
    return reply(recipe.error ? 422 : 200, recipe);
  } catch {
    return reply(502, { error: 'To Taste couldn’t analyze this video. Try a shorter clip or paste the recipe text.' });
  }
});
