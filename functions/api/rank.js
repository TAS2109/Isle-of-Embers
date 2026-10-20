// Cloudflare Pages Function: /api/rank  (D1 binding: DB)
const J=(o,st=200)=>new Response(JSON.stringify(o),{status:st,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
const int=(v,max)=>{v=Math.floor(Number(v));return Number.isFinite(v)&&v>=0&&v<=max?v:null};

export async function onRequestGet({request,env}){
  const u=new URL(request.url),sort=u.searchParams.get('sort')==='score'?'score':'assets',dy=u.searchParams.get('daily');
  const st=dy&&/^\d{4}-\d\d-\d\d$/.test(dy)?env.DB.prepare(`SELECT name,assets,score,years,pop FROM ranks WHERE daily=? ORDER BY ${sort} DESC LIMIT 50`).bind(dy):env.DB.prepare(`SELECT name,assets,score,years,pop FROM ranks WHERE daily IS NULL ORDER BY ${sort} DESC LIMIT 50`);
  const {results}=await st.all();
  return J(results);
}

export async function onRequestPost({request,env}){
  let b;try{b=await request.json()}catch{return J({error:'bad'},400)}
  const name=String(b.name||'').replace(/[\u0000-\u001f<>&"']/g,'').trim().slice(0,12);
  const assets=int(b.assets,1e9),score=int(b.score,1e6),years=int(b.years,1000),pop=int(b.pop,1e6);
  let daily=b.daily??null;if(daily!==null){const t=Date.now();const ok=[t-864e5,t,t+864e5].map(x=>new Date(x+9*36e5).toISOString().slice(0,10));if(typeof daily!=='string'||!ok.includes(daily))return J({error:'invalid'},400)}
  if(!name||[assets,score,years,pop].includes(null))return J({error:'invalid'},400);

  // Turnstile 検証（env.TURNSTILE_SECRET が設定されている場合のみ）
  if(env.TURNSTILE_SECRET){
    const f=new FormData();f.append('secret',env.TURNSTILE_SECRET);f.append('response',String(b.token||''));f.append('remoteip',request.headers.get('CF-Connecting-IP')||'');
    const v=await(await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:f})).json().catch(()=>({}));
    if(!v.success)return J({error:'captcha'},403);
  }
  // 簡易レート制限: 同一IPは1分に3件まで
  const ip=request.headers.get('CF-Connecting-IP')||'x';
  const h=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ip+(env.SALT||''))))].slice(0,8).map(x=>x.toString(16).padStart(2,'0')).join('');
  const now=Math.floor(Date.now()/1000);
  const r=await env.DB.prepare('SELECT COUNT(*) c FROM ranks WHERE ip=? AND ts>?').bind(h,now-60).first();
  if(r.c>=3)return J({error:'rate'},429);

  await env.DB.prepare('INSERT INTO ranks(name,assets,score,years,pop,ip,ts,daily) VALUES(?,?,?,?,?,?,?,?)').bind(name,assets,score,years,pop,h,now,daily).run();
  const k=await env.DB.prepare('SELECT COUNT(*)+1 AS rank FROM ranks WHERE assets>? AND daily IS ?').bind(assets,daily).first();
  return J({rank:k.rank<=100?k.rank:null});
}
