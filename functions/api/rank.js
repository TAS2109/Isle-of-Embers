const BAD = ['http', 'www', '@', '.com', '.jp'];
const J = (o, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });

export async function onRequestGet({ request, env }) {
  const u = new URL(request.url);
  const sort = u.searchParams.get('sort') === 'assets' ? 'assets' : 'score';
  const daily = u.searchParams.get('daily');
  const q = daily
    ? env.DB.prepare(`SELECT name,score,assets,years,pop FROM ranks WHERE daily=? ORDER BY ${sort} DESC LIMIT 100`).bind(daily)
    : env.DB.prepare(`SELECT name,score,assets,years,pop FROM ranks ORDER BY ${sort} DESC LIMIT 100`);
  const { results } = await q.all();
  return J(results);
}

export async function onRequestPost({ request, env }) {
  let b;
  try { b = await request.json(); } catch { return J({ error: 'bad json' }, 400); }
  const name = String(b.name || '').trim().slice(0, 12);
  const n = (v) => Math.max(0, Math.floor(Number(v) || 0));
  const score = n(b.score), assets = n(b.assets), years = n(b.years), pop = n(b.pop);
  const daily = b.daily ? String(b.daily).slice(0, 10) : null;

  if (!name || BAD.some((w) => name.toLowerCase().includes(w))) return J({ error: 'name' }, 400);
  if (b.adm) return J({ error: 'admin' }, 400);
  if (score > 10000000 || pop > 2000000 || years > 1000 || assets > 1e12) return J({ error: 'range' }, 400);

  // 同じ接続元からの連続投稿を制限（1分に3件まで）
  const ip = request.headers.get('CF-Connecting-IP') || '';
  const now = Date.now();
  const key = ip + '|' + Math.floor(now / 60000);
  globalThis.__rl = globalThis.__rl || new Map();
  const c = (globalThis.__rl.get(key) || 0) + 1;
  globalThis.__rl.set(key, c);
  if (c > 3) return J({ error: 'rate' }, 429);

  await env.DB.prepare('INSERT INTO ranks (name,score,assets,years,pop,daily,created) VALUES (?,?,?,?,?,?,?)')
    .bind(name, score, assets, years, pop, daily, now).run();

  const col = daily ? 'daily=?' : '1=1';
  const bind = daily ? [score, daily] : [score];
  const r = await env.DB.prepare(`SELECT COUNT(*)+1 AS rank FROM ranks WHERE score>? AND ${col}`).bind(...bind).first();
  return J({ rank: r.rank <= 100 ? r.rank : 0 });
}
