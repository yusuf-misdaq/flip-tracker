import { checkAuth, unauthorized } from '../_auth.js';

export async function onRequestPut(context) {
  const { request, env, params } = context;
  if (!checkAuth(request, env)) return unauthorized();

  const id = params.id;
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Bad request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const {
    name,
    category,
    cost,
    sold_price,
    date_acquired,
    date_sold,
    notes,
    source_url,
    listing_url,
  } = body;

  await env.DB.prepare(
    `UPDATE items SET
       name = ?,
       category = ?,
       cost = ?,
       sold_price = ?,
       date_acquired = ?,
       date_sold = ?,
       notes = ?,
       source_url = ?,
       listing_url = ?
     WHERE id = ?`
  )
    .bind(
      name,
      category || 'Other',
      cost || 0,
      sold_price ?? null,
      date_acquired,
      date_sold ?? null,
      notes ?? null,
      source_url ?? null,
      listing_url ?? null,
      id
    )
    .run();

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequestDelete(context) {
  const { request, env, params } = context;
  if (!checkAuth(request, env)) return unauthorized();

  const id = params.id;
  await env.DB.prepare('DELETE FROM items WHERE id = ?').bind(id).run();

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
