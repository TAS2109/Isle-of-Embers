// Isle of Embers ランキングAPI（Cloudflare Pages Functions + D1）
// 置き場所: リポジトリ直下の functions/api/rank.js
// 必要な設定: D1データベースをバインディング名「DB」で紐づける

const BAD = ['http', 'www', '@', '.com', '.jp'];
const J = (o, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });

// 一覧を返す  例: /api/rank?sort=score  /api/rank?daily=2026-10-26&sort=assets
export async function onRequestGet({ request, env }) {
  const u = new URL(request.url);
  // 並べ替え：pop（最大人口）／score／assets（総資産）／years（継続年）。省略時は最大人口
  const sort = ['pop', 'score', 'assets', 'years'].includes(u.searchParams.get('sort')) ? u.searchParams.get('sort') : 'pop';
  const daily = u.searchParams.get('daily');
  const q = daily
    ? env.DB.prepare(`SELECT name,score,assets,years,pop FROM ranks WHERE daily=? ORDER BY ${sort} DESC, score DESC, created ASC LIMIT 100`).bind(daily)
    : env.DB.prepare(`SELECT name,score,assets,years,pop FROM ranks ORDER BY ${sort} DESC, score DESC, created ASC LIMIT 100`);
  const { results } = await q.all();
  return J(results);
}

// 記録する
export async function onRequestPost({ request, env }) {
  let b;
  try { b = await request.json(); } catch { return J({ error: 'bad json' }, 400); }

  const name = String(b.name || '').trim().slice(0, 12);
  const n = (v) => Math.max(0, Math.floor(Number(v) || 0));
  const score = n(b.score), assets = n(b.assets), years = n(b.years), pop = n(b.pop);
  const daily = b.daily ? String(b.daily).slice(0, 10) : null;

  if (!name || BAD.some((w) => name.toLowerCase().includes(w))) return J({ error: 'name' }, 400);
  if (b.adm) return J({ error: 'admin' }, 400);
  // 上限値は仮です。実際の最高スコアに合わせて調整してください
  if (score > 100000 || pop > 2000000 || years > 500 || assets > 1e12) return J({ error: 'range' }, 400);

  // 簡易の連投制限（同じ接続元は1分に3件まで）
  const ip = request.headers.get('CF-Connecting-IP') || '';
  const now = Date.now();
  const key = ip + '|' + Math.floor(now / 60000);
  globalThis.__rl = globalThis.__rl || new Map();
  const c = (globalThis.__rl.get(key) || 0) + 1;
  globalThis.__rl.set(key, c);
  if (c > 3) return J({ error: 'rate' }, 429);

  await env.DB.prepare('INSERT INTO ranks (name,score,assets,years,pop,daily,created) VALUES (?,?,?,?,?,?,?)')
    .bind(name, score, assets, years, pop, daily, now).run();

  const r = daily
    ? await env.DB.prepare('SELECT COUNT(*)+1 AS rank FROM ranks WHERE score>? AND daily=?').bind(score, daily).first()
    : await env.DB.prepare('SELECT COUNT(*)+1 AS rank FROM ranks WHERE score>?').bind(score).first();
  return J({ rank: r.rank <= 100 ? r.rank : 0 });
}
