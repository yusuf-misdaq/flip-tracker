import { checkAuth, unauthorized } from '../_auth.js';

// Goals are tracked per-month so increasing the target later doesn't
// rewrite history. goal_history stores { "2026-07": 1000, "2026-08": 1500 }
// as JSON in the settings table. If a month has no explicit entry, the
// most recent prior month's goal carries forward.

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!checkAuth(request, env)) return unauthorized();

  const row = await env.DB.prepare(
    "SELECT value FROM settings WHERE key = 'goal_history'"
  ).first();

  let history = {};
  if (row) {
    try {
      history = JSON.parse(row.value);
    } catch {
      history = {};
    }
  }

  // Backward compatibility: if old single 'monthly_goal' exists and no
  // history yet, seed history with it for the current month.
  if (Object.keys(history).length === 0) {
    const legacy = await env.DB.prepare(
      "SELECT value FROM settings WHERE key = 'monthly_goal'"
    ).first();
    const goal = legacy ? Number(legacy.value) : 1000;
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    history[monthKey] = goal;
  }

  return new Response(JSON.stringify({ history }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!checkAuth(request, env)) return unauthorized();

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Bad request' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { monthKey, goal } = body;
  if (!monthKey || typeof goal !== 'number') {
    return new Response(
      JSON.stringify({ error: 'monthKey and numeric goal are required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const row = await env.DB.prepare(
    "SELECT value FROM settings WHERE key = 'goal_history'"
  ).first();

  let history = {};
  if (row) {
    try {
      history = JSON.parse(row.value);
    } catch {
      history = {};
    }
  }

  history[monthKey] = goal;

  await env.DB.prepare(
    "INSERT INTO settings (key, value) VALUES ('goal_history', ?) " +
      'ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  )
    .bind(JSON.stringify(history))
    .run();

  return new Response(JSON.stringify({ ok: true, history }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
