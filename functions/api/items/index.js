import { checkAuth, unauthorized } from './_auth.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!checkAuth(request, env)) return unauthorized();

  const { results } = await env.DB.prepare(
    'SELECT * FROM items ORDER BY date_acquired DESC, id DESC'
  ).all();

  return new Response(JSON.stringify({ items: results }), {
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

  if (!name || !date_acquired) {
    return new Response(
      JSON.stringify({ error: 'name and date_acquired are required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const result = await env.DB.prepare(
    `INSERT INTO items (name, category, cost, sold_price, date_acquired, date_sold, notes, source_url, listing_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
      listing_url ?? null
    )
    .run();

  return new Response(JSON.stringify({ id: result.meta.last_row_id }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
}
