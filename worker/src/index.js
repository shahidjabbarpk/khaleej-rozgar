/**
 * Khaleej Rozgar Worker (Cloudflare free plan).
 *
 * The auto-update loop:
 *   phone (active user) checks the official sources -> finds jobs not in the hourly feed -> POST /found
 *   -> we check them (App Check token, allow-listed official hosts, scam words, rate limit)
 *   -> new ones (D1 `seen`) are pushed to the FCM topic -> every other user gets "New job…"
 *   -> the hourly feed builder pulls them from GET /finds so phones that were offline see them too.
 */
import { SCAM_WORDS } from './scam.js';

const COUNTRIES = ['sa', 'ae', 'qa', 'kw', 'om', 'bh'];
const COUNTRY_EN = { sa: 'Saudi Arabia', ae: 'UAE', qa: 'Qatar', kw: 'Kuwait', om: 'Oman', bh: 'Bahrain' };
const CATEGORIES = ['driver', 'construction', 'cleaning', 'hotel', 'security', 'sales', 'office', 'it', 'health', 'engineering',
  'teaching', 'delivery', 'factory', 'other'];
/** A phone may only report jobs whose link is on the official host of that source. */
const HOSTS = {
  dubaicareers: ['jobs.dubaicareers.ae'],
  greenhouse: ['boards.greenhouse.io', 'job-boards.greenhouse.io'],
  smartrecruiters: ['jobs.smartrecruiters.com'],
  workable: ['apply.workable.com'],
  lever: ['jobs.lever.co'],
};
const MAX_FINDS_PER_IP_PER_DAY = 40;
const MAX_PUSHES_PER_CALL = 6;

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
});

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    try {
      if (req.method === 'POST' && url.pathname === '/found') return await found(req, env);
      if (req.method === 'GET' && url.pathname === '/finds') return await finds(req, env);
      if (url.pathname === '/seen') return await seen(req, env, url);
      if (url.pathname === '/delete-account') return await deleteAccountPage(req, env);
      if (url.pathname === '/') return json({ ok: true, app: 'khaleej-rozgar' });
      return json({ error: 'not found' }, 404);
    } catch (e) {
      return json({ error: String(e?.message ?? e) }, 500);
    }
  },
};

// ---------------------------------------------------------------- /found

export function validJob(j) {
  if (!j || typeof j !== 'object') return false;
  if (typeof j.id !== 'string' || !/^[a-z]{2}-[0-9a-f]{16}$/.test(j.id)) return false;
  if (!HOSTS[j.source] || !COUNTRIES.includes(j.country) || !CATEGORIES.includes(j.category)) return false;
  if (typeof j.title !== 'string' || j.title.length < 2 || j.title.length > 140) return false;
  if (typeof j.organization !== 'string' || j.organization.length > 100) return false;
  let host;
  try {
    const u = new URL(j.url);
    if (u.protocol !== 'https:') return false;
    host = u.hostname;
  } catch {
    return false;
  }
  if (!HOSTS[j.source].includes(host)) return false;
  const text = `${j.title} ${j.organization} ${j.description ?? ''}`.toLowerCase();
  return !SCAM_WORDS.some((w) => text.includes(w));
}

/** Only the fields the app needs, trimmed (never trust what a phone sends). */
const clean = (j) => ({
  id: j.id, source: j.source, sector: j.source === 'dubaicareers' ? 'govt' : 'private',
  title: j.title.slice(0, 140), organization: j.organization.slice(0, 100), category: j.category, country: j.country,
  cities: Array.isArray(j.cities) ? j.cities.filter((c) => typeof c === 'string').slice(0, 3).map((c) => c.slice(0, 40)) : [],
  eligibility: ['locals', 'expats', 'visa', 'anyone'].includes(j.eligibility) ? j.eligibility : 'unknown',
  url: j.url, applyUrl: j.url, description: typeof j.description === 'string' ? j.description.slice(0, 1500) : undefined,
  postedDate: typeof j.postedDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(j.postedDate) ? j.postedDate : undefined,
  jobType: typeof j.jobType === 'string' ? j.jobType.slice(0, 40) : undefined,
  firstSeen: new Date().toISOString(),
});

async function found(req, env) {
  if (env.REQUIRE_APP_CHECK !== 'false' && !(await appCheckOk(req.headers.get('x-firebase-appcheck'), env))) {
    return json({ error: 'app check' }, 401);
  }
  const ip = req.headers.get('cf-connecting-ip') ?? 'unknown';
  const body = await req.json().catch(() => ({}));
  const list = (Array.isArray(body.jobs) ? body.jobs : []).slice(0, 25).filter(validJob).map(clean);
  if (!list.length) return json({ accepted: 0 });
  if (!(await rateOk(env, `ip:${ip}`, list.length))) return json({ error: 'rate' }, 429);

  const now = Date.now();
  const fresh = [];
  for (const j of list) {
    const r = await env.DB.prepare('INSERT OR IGNORE INTO seen (id, first_seen) VALUES (?, ?)').bind(j.id, now).run();
    if (r.meta?.changes) {
      fresh.push(j);
      await env.DB.prepare('INSERT OR REPLACE INTO finds (id, job, at) VALUES (?, ?, ?)').bind(j.id, JSON.stringify(j), now).run();
    }
  }
  const pushes = fresh.length ? await pushJobs(env, fresh) : 0;
  return json({ accepted: list.length, fresh: fresh.length, pushes });
}

async function rateOk(env, key, add) {
  const day = new Date().toISOString().slice(0, 10);
  const row = await env.DB.prepare('SELECT n, day FROM rate WHERE key = ?').bind(key).first();
  const n = row && row.day === day ? row.n : 0;
  if (n + add > MAX_FINDS_PER_IP_PER_DAY) return false;
  await env.DB.prepare('INSERT OR REPLACE INTO rate (key, n, day) VALUES (?, ?, ?)').bind(key, n + add, day).run();
  return true;
}

// ---------------------------------------------------------------- /finds + /seen (feed builder)

const feedKeyOk = (req, env) => !!env.FEED_KEY && req.headers.get('x-feed-key') === env.FEED_KEY;

async function finds(req, env) {
  if (!feedKeyOk(req, env)) return json({ error: 'key' }, 401);
  const week = Date.now() - 7 * 86400000;
  await env.DB.prepare('DELETE FROM finds WHERE at < ?').bind(week).run();
  await env.DB.prepare('DELETE FROM seen WHERE first_seen < ?').bind(Date.now() - 60 * 86400000).run();
  const rows = await env.DB.prepare('SELECT job FROM finds ORDER BY at DESC LIMIT 500').all();
  return json({ jobs: (rows.results ?? []).map((r) => JSON.parse(r.job)) });
}

/** GET ?ids=a,b -> which were already pushed. POST {ids:[]} (feed key) -> mark as pushed. */
async function seen(req, env, url) {
  if (req.method === 'POST') {
    if (!feedKeyOk(req, env)) return json({ error: 'key' }, 401);
    const { ids = [] } = await req.json().catch(() => ({}));
    const now = Date.now();
    for (const id of ids.slice(0, 2000)) {
      if (typeof id === 'string' && id.length < 40) await env.DB.prepare('INSERT OR IGNORE INTO seen (id, first_seen) VALUES (?, ?)').bind(id, now).run();
    }
    return json({ ok: true });
  }
  const ids = (url.searchParams.get('ids') ?? '').split(',').filter(Boolean).slice(0, 200);
  if (!ids.length) return json({ seen: [] });
  const q = await env.DB.prepare(`SELECT id FROM seen WHERE id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all();
  return json({ seen: (q.results ?? []).map((r) => r.id) });
}

// ---------------------------------------------------------------- account deletion web page (Play policy)

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const page = (body) => new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Delete your Khaleej Rozgar account</title><style>body{font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1d2420;line-height:1.55}
h1{color:#0B6E4F;font-size:24px}input,textarea{width:100%;box-sizing:border-box;padding:12px;margin:6px 0 14px;border:1px solid #cfd8d3;border-radius:10px;font-size:16px}
button{background:#0B6E4F;color:#fff;border:0;border-radius:10px;padding:14px 20px;font-size:16px;width:100%}small{color:#5f6b64}</style></head><body>${body}</body></html>`,
  { headers: { 'content-type': 'text/html; charset=utf-8' } });

/**
 * GET: form. POST: saves the request; the admin deletes the account by hand (Firebase console) within 30 days.
 * In the app the user can also delete it at once: Me -> Delete my account.
 */
async function deleteAccountPage(req, env) {
  if (req.method === 'POST') {
    const f = await req.formData();
    const email = String(f.get('email') ?? '').trim().slice(0, 120);
    const note = String(f.get('note') ?? '').trim().slice(0, 500);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return page('<h1>Please go back and enter a valid email.</h1>');
    const ip = req.headers.get('cf-connecting-ip') ?? 'unknown';
    if (!(await rateOk(env, `del:${ip}`, 1))) return page('<h1>Too many requests. Please try again tomorrow.</h1>');
    await env.DB.prepare('INSERT INTO deletion_requests (email, note, at) VALUES (?, ?, ?)').bind(email, note, Date.now()).run();
    return page(`<h1>Request received</h1><p>We will delete the Khaleej Rozgar account for <b>${esc(email)}</b> and its posts within 30 days.</p>`);
  }
  return page(`<h1>Delete your Khaleej Rozgar account</h1>
<p>Fastest way: open the app → <b>Me</b> → <b>Delete my account</b>. It deletes your login, profile, job posts and "I need a job" posts at once.</p>
<p>No longer have the app? Send this form and we delete them within 30 days.</p>
<p><small>Kept for fraud prevention: reports you sent about other posts (without your name), for up to 12 months. Nothing else is kept.</small></p>
<form method="post"><label>Email you used to log in</label><input name="email" type="email" required>
<label>Note (optional)</label><textarea name="note" rows="3"></textarea><button type="submit">Request account deletion</button></form>
<p><small>Questions: support@itgreenservices.com</small></p>`);
}

// ---------------------------------------------------------------- FCM topic push (HTTP v1)

const topicFor = (j) => `jobs_${j.country}_${j.sector === 'govt' ? 'govt' : j.category}`;

async function pushJobs(env, jobs) {
  if (!env.FIREBASE_SERVICE_ACCOUNT) return 0;
  const sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
  const token = await googleToken(sa);
  const byTopic = new Map();
  for (const j of jobs) byTopic.set(topicFor(j), [...(byTopic.get(topicFor(j)) ?? []), j]);
  let sent = 0;
  for (const [topic, list] of byTopic) {
    if (sent >= MAX_PUSHES_PER_CALL) break;
    const one = list.length === 1;
    const j = list[0];
    const title = one ? `🆕 ${j.title}` : `🔔 ${list.length} new ${j.sector === 'govt' ? 'government ' : ''}jobs in ${COUNTRY_EN[j.country]}`;
    const body = one ? `${j.organization} • ${j.cities[0] ?? COUNTRY_EN[j.country]}` : list.slice(0, 3).map((x) => `• ${x.title}`).join('\n');
    const r = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        message: {
          topic,
          notification: { title, body },
          data: one ? { jobId: j.id } : { screen: '/' },
          android: { priority: 'high', ttl: '86400s', notification: { channel_id: j.sector === 'govt' ? 'govt-jobs' : 'new-jobs', color: '#0B6E4F', tag: one ? j.id : topic } },
        },
      }),
    });
    if (r.ok) sent++;
  }
  return sent;
}

const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const b64urlStr = (s) => b64url(new TextEncoder().encode(s));

let cachedToken = null;
async function googleToken(sa) {
  if (cachedToken && cachedToken.exp > Date.now() + 60000) return cachedToken.value;
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64urlStr(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64urlStr(JSON.stringify({
    iss: sa.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  }))}`;
  const pem = sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${b64url(sig)}` }),
  });
  if (!r.ok) throw new Error(`oauth ${r.status}`);
  const d = await r.json();
  cachedToken = { value: d.access_token, exp: Date.now() + d.expires_in * 1000 };
  return cachedToken.value;
}

// ---------------------------------------------------------------- Firebase App Check (Play Integrity)

let jwks = null;
async function appCheckOk(token, env) {
  if (!token || !env.FIREBASE_PROJECT_NUMBER) return false;
  try {
    const [h, p, s] = token.split('.');
    const head = JSON.parse(atob(h.replace(/-/g, '+').replace(/_/g, '/')));
    const claims = JSON.parse(atob(p.replace(/-/g, '+').replace(/_/g, '/')));
    const proj = `projects/${env.FIREBASE_PROJECT_NUMBER}`;
    if (claims.iss !== `https://firebaseappcheck.googleapis.com/${env.FIREBASE_PROJECT_NUMBER}`) return false;
    if (!(Array.isArray(claims.aud) ? claims.aud : [claims.aud]).includes(proj)) return false;
    if (claims.exp * 1000 < Date.now()) return false;
    jwks ??= (await (await fetch('https://firebaseappcheck.googleapis.com/v1/jwks')).json()).keys;
    const jwk = jwks.find((k) => k.kid === head.kid);
    if (!jwk) return false;
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const sig = Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
    return await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, sig, new TextEncoder().encode(`${h}.${p}`));
  } catch {
    return false;
  }
}
