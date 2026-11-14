import { analyzeRecipeVideo } from '../supabase/functions/import-recipe-video/analyze.mjs';

const maxBytes = 20 * 1024 * 1024;
const formats = new Set(['video/mp4', 'video/quicktime', 'video/webm']);
let processing = false;

export async function importVideoRecipe(req, res) {
  const reply = (status, body) => res.writeHead(status, {
    'Content-Type': 'application/json', 'Cache-Control': 'no-store',
  }).end(JSON.stringify(body));
  // The prototype is available to the local preview only.
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress)
    || req.headers.origin !== `http://${req.headers.host}`) return reply(403, { error: 'Video import is available in the local preview.' });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return reply(503, { error: 'Video analysis needs a Gemini API key on the preview server.' });
  const mimeType = req.headers['content-type'];
  if (!formats.has(mimeType)) return reply(415, { error: 'Choose an MP4, MOV, or WebM video.' });
  const length = Number(req.headers['content-length']);
  if (!Number.isSafeInteger(length) || length <= 0 || length > maxBytes) {
    return reply(413, { error: 'Choose a video under 20 MB.' });
  }
  if (processing) return reply(429, { error: 'Another video is being analyzed. Try again in a moment.' });
  processing = true;
  try {
    const chunks = [];
    let received = 0;
    for await (const chunk of req) {
      received += chunk.length;
      if (received > length) throw new Error('Upload exceeded its declared size');
      chunks.push(chunk);
    }
    const recipe = await analyzeRecipeVideo(key, mimeType, Buffer.concat(chunks).toString('base64'));
    return reply(recipe.error ? 422 : 200, recipe);
  } catch {
    return reply(502, { error: 'To Taste couldn’t analyze this video. Try a shorter clip or paste the recipe text.' });
  } finally {
    processing = false;
  }
}
