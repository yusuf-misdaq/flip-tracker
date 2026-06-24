// Simple shared-secret auth. The password is stored as a Cloudflare
// environment variable (APP_PASSWORD) — never hardcoded here.
// The client sends it as a Bearer token on every request.

export function checkAuth(request, env) {
  const header = request.headers.get('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!env.APP_PASSWORD) {
    // Fail safe: if no password is configured, deny everything rather
    // than silently running open.
    return false;
  }
  return token === env.APP_PASSWORD;
}

export function unauthorized() {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}
