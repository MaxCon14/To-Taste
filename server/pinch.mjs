import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const file = process.env.PINCH_DB ?? resolve('.pinch', 'pinch.sqlite');
if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
const db = new DatabaseSync(file);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
    password TEXT NOT NULL, diet TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS recipes (
    user_id TEXT NOT NULL REFERENCES users(id), id TEXT NOT NULL, data TEXT NOT NULL,
    PRIMARY KEY (user_id, id)
  );
  CREATE TABLE IF NOT EXISTS community (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), recipe_id TEXT NOT NULL,
    data TEXT NOT NULL, created INTEGER NOT NULL, UNIQUE (user_id, recipe_id)
  );
`);

const derive = promisify(scrypt);
const cookieName = 'pinch_session';
const sessionSeconds = 60 * 60 * 24 * 30;
const diets = ['any', 'vegan', 'vegetarian', 'pescatarian'];
const recipeDiets = diets.slice(1);
const hash = (token) => createHash('sha256').update(token).digest('hex');
const publicUser = ({ id, name, diet }) => ({ id, name, diet });
const authAttempts = new Map();

function fail(status, message) {
  throw Object.assign(new Error(message), { status });
}

function send(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(data));
}

async function body(req) {
  if (!req.headers['content-type']?.startsWith('application/json')) fail(415, 'Expected JSON.');
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1024 * 1024) fail(413, 'This recipe book is too large to send.');
    chunks.push(chunk);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  } catch {}
  fail(400, 'The request could not be read.');
}

function rateLimit(req) {
  const now = Date.now();
  for (const [key, entry] of authAttempts) if (entry.until <= now) authAttempts.delete(key);
  const key = req.socket.remoteAddress ?? '';
  const entry = authAttempts.get(key) ?? { count: 0, until: now + 60000 };
  if (entry.count >= 12) fail(429, 'Too many attempts. Try again in a minute.');
  entry.count++;
  authAttempts.set(key, entry);
}

function cookie(req, token, age) {
  const secure = process.env.PINCH_SECURE_COOKIES === '1' || req.socket.encrypted;
  return `${cookieName}=${token}; Path=/; Max-Age=${age}; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
}

function session(req) {
  const token = req.headers.authorization?.match(/^Bearer ([a-f0-9]{64})$/)?.[1]
    ?? req.headers.cookie?.match(/(?:^|;\s*)pinch_session=([a-f0-9]{64})(?:;|$)/)?.[1];
  if (!token) return {};
  const tokenHash = hash(token);
  const user = db.prepare('SELECT u.id, u.name, u.diet FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires > ?').get(tokenHash, Date.now());
  return { user, tokenHash };
}

function library(userId) {
  return db.prepare('SELECT data FROM recipes WHERE user_id = ? ORDER BY rowid DESC').all(userId).map(({ data }) => JSON.parse(data));
}

function cleanRecipe(input) {
  if (!input || typeof input !== 'object') fail(400, 'The recipe is missing.');
  const { id, title, minutes, servings, ingredients, instructions } = input;
  if (typeof id !== 'string' || !/^[a-z0-9:-]{1,100}$/i.test(id) ||
      typeof title !== 'string' || !title.trim() || title.length > 240 ||
      typeof minutes !== 'string' || minutes.length > 12 ||
      typeof servings !== 'string' || servings.length > 100 ||
      typeof ingredients !== 'string' || !ingredients.trim() || ingredients.length > 24000 ||
      typeof instructions !== 'string' || instructions.length > 50000) fail(400, 'Check the recipe title, ingredients, and field lengths.');
  const recipe = { id, title: title.trim(), minutes, servings, ingredients, instructions, favorite: input.favorite === true };
  for (const key of ['source', 'photo']) {
    if (typeof input[key] !== 'string' || input[key].length > 2048) continue;
    try {
      const url = new URL(input[key]);
      if (url.protocol === 'https:' && !url.username && !url.password) recipe[key] = url.href;
    } catch {}
  }
  if (['pasta', 'chicken', 'pancakes', 'chickpeas', 'salmon'].includes(input.cover)) recipe.cover = input.cover;
  if (input.discovery && typeof input.discovery.author === 'string') {
    recipe.discovery = {
      author: input.discovery.author.slice(0, 80),
      diet: recipeDiets.includes(input.discovery.diet) ? input.discovery.diet : undefined,
      onePan: input.discovery.onePan === true,
      weekend: input.discovery.weekend === true,
    };
  }
  return recipe;
}

function merge(userId, recipes) {
  const insert = db.prepare('INSERT OR IGNORE INTO recipes (user_id, id, data) VALUES (?, ?, ?)');
  db.exec('BEGIN');
  try {
    for (const input of [...recipes].reverse()) {
      const recipe = cleanRecipe(input);
      insert.run(userId, recipe.id, JSON.stringify(recipe));
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

async function authenticate(req, res, signup) {
  rateLimit(req);
  const { email: rawEmail, name: rawName, password, diet } = await body(req);
  const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
  const name = typeof rawName === 'string' ? rawName.trim() : '';
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || typeof password !== 'string' || password.length > 128) {
    fail(400, 'Enter a valid email and password.');
  }
  let user;
  if (signup) {
    if (!name || name.length > 60 || password.length < 10) fail(400, 'Enter a display name and use at least 10 characters for your password.');
    user = { id: randomUUID(), name, diet: diets.includes(diet) ? diet : 'any' };
    const salt = randomBytes(16).toString('hex');
    const digest = (await derive(password, salt, 64)).toString('hex');
    const result = db.prepare('INSERT OR IGNORE INTO users VALUES (?, ?, ?, ?, ?)').run(user.id, email, name, `${salt}:${digest}`, user.diet);
    if (!result.changes) fail(409, 'An account already exists for this email. Sign in to continue.');
  } else {
    user = db.prepare('SELECT id, name, diet, password FROM users WHERE email = ?').get(email);
    const [salt, digest] = (user?.password ?? `${'0'.repeat(32)}:${'0'.repeat(128)}`).split(':');
    const actual = await derive(password, salt, 64);
    if (!timingSafeEqual(actual, Buffer.from(digest, 'hex')) || !user) fail(401, 'That email and password don’t match.');
  }
  const token = randomBytes(32).toString('hex');
  db.prepare('DELETE FROM sessions WHERE expires <= ?').run(Date.now());
  db.prepare('INSERT INTO sessions VALUES (?, ?, ?)').run(hash(token), user.id, Date.now() + sessionSeconds * 1000);
  if (req.headers['x-pinch-native'] !== '1') res.setHeader('Set-Cookie', cookie(req, token, sessionSeconds));
  send(res, { user: publicUser(user), recipes: library(user.id), ...(req.headers['x-pinch-native'] === '1' ? { token } : {}) }, signup ? 201 : 200);
}

export async function handlePinchApi(req, res, path) {
  try {
    if (req.headers['sec-fetch-site'] === 'cross-site') fail(403, 'This request must come from To Taste.');
    const { method } = req;
    if (path === '/api/pinch/community' && method === 'GET') {
      const rows = db.prepare('SELECT c.id, c.data, u.name FROM community c JOIN users u ON u.id = c.user_id ORDER BY c.created DESC LIMIT 100').all();
      return send(res, rows.map(({ id, data, name }) => {
        const recipe = JSON.parse(data);
        return { ...recipe, id: `community:${id}`, favorite: false, discovery: { ...recipe.discovery, author: name } };
      }));
    }
    if (path === '/api/pinch/register' && method === 'POST') return await authenticate(req, res, true);
    if (path === '/api/pinch/login' && method === 'POST') return await authenticate(req, res, false);
    const { user, tokenHash } = session(req);
    if (path === '/api/pinch/session' && method === 'GET') return send(res, user ? { user, recipes: library(user.id) } : { user: null, recipes: [] });
    if (!user) fail(401, 'Sign in to continue.');
    if (path === '/api/pinch/logout' && method === 'POST') {
      db.prepare('DELETE FROM sessions WHERE token = ?').run(tokenHash);
      res.setHeader('Set-Cookie', cookie(req, '', 0));
      return send(res, {});
    }
    if (path === '/api/pinch/preferences' && method === 'PUT') {
      const { diet } = await body(req);
      if (!diets.includes(diet)) fail(400, 'Choose a diet preference.');
      db.prepare('UPDATE users SET diet = ? WHERE id = ?').run(diet, user.id);
      return send(res, { ...user, diet });
    }
    if (path === '/api/pinch/merge' && method === 'POST') {
      const { recipes } = await body(req);
      if (!Array.isArray(recipes) || recipes.length > 250) fail(400, 'The recipe book could not be merged.');
      merge(user.id, recipes);
      return send(res, library(user.id));
    }
    if (path === '/api/pinch/recipe' && method === 'PUT') {
      const recipe = cleanRecipe(await body(req));
      db.prepare('INSERT INTO recipes VALUES (?, ?, ?) ON CONFLICT(user_id, id) DO UPDATE SET data = excluded.data').run(user.id, recipe.id, JSON.stringify(recipe));
      return send(res, recipe);
    }
    if (path === '/api/pinch/recipe' && method === 'DELETE') {
      const { id } = await body(req);
      if (typeof id !== 'string') fail(400, 'Choose a recipe.');
      db.exec('BEGIN');
      try {
        db.prepare('DELETE FROM community WHERE user_id = ? AND recipe_id = ?').run(user.id, id);
        db.prepare('DELETE FROM recipes WHERE user_id = ? AND id = ?').run(user.id, id);
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
      return send(res, {});
    }
    if (path === '/api/pinch/share' && method === 'POST') {
      const { id, diet, onePan, weekend } = await body(req);
      if (typeof id !== 'string' || id.startsWith('community:')) fail(400, 'Choose one of your own recipes.');
      const row = db.prepare('SELECT data FROM recipes WHERE user_id = ? AND id = ?').get(user.id, id);
      if (!row) fail(404, 'Save the recipe before sharing it.');
      const recipe = JSON.parse(row.data);
      recipe.discovery = { diet: recipeDiets.includes(diet) ? diet : undefined, onePan: onePan === true, weekend: weekend === true };
      db.prepare('INSERT INTO community VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id, recipe_id) DO UPDATE SET data = excluded.data')
        .run(randomUUID(), user.id, id, JSON.stringify(recipe), Date.now());
      return send(res, {});
    }
    if (path === '/api/pinch/share' && method === 'GET') {
      const rows = db.prepare('SELECT recipe_id, data FROM community WHERE user_id = ?').all(user.id);
      return send(res, Object.fromEntries(rows.map(({ recipe_id, data }) => {
        const { diet = 'any', onePan = false, weekend = false } = JSON.parse(data).discovery ?? {};
        return [recipe_id, { diet, onePan, weekend }];
      })));
    }
    if (path === '/api/pinch/share' && method === 'DELETE') {
      const { id } = await body(req);
      if (typeof id !== 'string') fail(400, 'Choose a recipe.');
      db.prepare('DELETE FROM community WHERE user_id = ? AND recipe_id = ?').run(user.id, id);
      return send(res, {});
    }
    fail(404, 'That action isn’t available.');
  } catch (error) {
    if (!error.status) console.error('To Taste API:', error.message);
    if (!res.headersSent) send(res, { message: error.status ? error.message : 'To Taste couldn’t complete the request. Try again.' }, error.status ?? 500);
  }
}
