import { createClient } from 'npm:@supabase/supabase-js@2.119.0';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
};

function reply(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers });
}

async function revokeAppleCode(code: string, identities: string[]) {
  const clientId = Deno.env.get('APPLE_NATIVE_CLIENT_ID');
  const secret = Deno.env.get('APPLE_NATIVE_CLIENT_SECRET');
  if (!clientId || !secret) return false;
  const tokenResponse = await fetch('https://appleid.apple.com/auth/token', {
    method: 'POST',
    body: new URLSearchParams({ grant_type: 'authorization_code', code, client_id: clientId, client_secret: secret }),
  });
  if (!tokenResponse.ok) return false;
  const tokens = await tokenResponse.json();
  if (!tokens.id_token || !tokens.refresh_token) return false;
  // The ID token comes directly from Apple's authenticated token endpoint.
  const part = tokens.id_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  const claims = JSON.parse(atob(part));
  if (claims.iss !== 'https://appleid.apple.com' || claims.aud !== clientId || !identities.includes(claims.sub)) return false;
  const response = await fetch('https://appleid.apple.com/auth/revoke', {
    method: 'POST',
    body: new URLSearchParams({ client_id: clientId, client_secret: secret, token: tokens.refresh_token, token_type_hint: 'refresh_token' }),
  });
  return response.ok;
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return reply({ error: 'Use POST.' }, 405);
  const token = request.headers.get('Authorization')?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token) return reply({ error: 'Sign in again before deleting your account.' }, 401);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) return reply({ error: 'Sign in again before deleting your account.' }, 401);

  const images = admin.storage.from('cook-profile-images');
  for (;;) {
    const { data: files, error: listError } = await images.list(user.id, { limit: 100 });
    if (listError) return reply({ error: 'We couldn’t remove your profile photos. Try again.' }, 500);
    if (!files.length) break;
    const { error: removeError } = await images.remove(files.map(file => `${user.id}/${file.name}`));
    if (removeError) return reply({ error: 'We couldn’t remove your profile photos. Try again.' }, 500);
    if (files.length < 100) break;
  }


  const appleIds = (user.identities ?? []).filter(identity => identity.provider === 'apple').map(identity => identity.id);
  const body = await request.json().catch(() => ({}));
  const revoked = appleIds.length && typeof body?.appleCode === 'string'
    ? await revokeAppleCode(body.appleCode, appleIds).catch(() => false)
    : false;
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return reply({ error: 'We couldn’t delete your account. Try again.' }, 500);
  return reply({ deleted: true, appleManualRevoke: appleIds.length > 0 && !revoked });
});
