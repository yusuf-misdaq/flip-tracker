export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.APP_PASSWORD) {
    return new Response(JSON.stringify({ error: 'Server not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Bad request' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const ok = body.password === env.APP_PASSWORD;
  if (!ok) {
    return new Response(JSON.stringify({ error: 'Incorrect password' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return new Response(JSON.stringify({ token: env.APP_PASSWORD }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
