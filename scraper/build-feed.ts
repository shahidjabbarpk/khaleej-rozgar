/**
 * Hourly feed builder (GitHub Actions -> .github/workflows/feed.yml).
 *   1. fetch every free source (src/lib/sources.ts - the same code the phone runs)
 *   2. add jobs that phones found and reported to the Worker (/finds), when WORKER_URL is set
 *   3. keep firstSeen of known jobs, drop jobs that left their source (expired)
 *   4. write data/jobs.json + data/meta.json
 *   5. push NEW jobs to FCM topics (one push per topic; a summary when several) - skipped on the very first run
 * Run: node --experimental-strip-types scraper/build-feed.ts
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dedupe, fetchAllSources } from '../src/lib/sources.ts';
import { jobAgeDays, MAX_JOB_AGE_DAYS } from '../src/lib/format.ts';
import { pushText, topicFor } from '../src/lib/topics.ts';
import type { Feed, Job } from '../src/lib/types.ts';
import { sendPush, serviceAccount } from './fcm.ts';

const COUNTRY_EN: Record<string, string> = { sa: 'Saudi Arabia', ae: 'UAE', qa: 'Qatar', kw: 'Kuwait', om: 'Oman', bh: 'Bahrain' };
const OUT = 'data/jobs.json';
const META = 'data/meta.json';
const MAX_PUSHES_PER_RUN = 60;

function readJson<T>(p: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(p, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

const worker = () => process.env.WORKER_URL?.replace(/\/$/, '') ?? '';
const feedHeaders = () => ({ 'x-feed-key': process.env.FEED_KEY ?? '', 'content-type': 'application/json' });

/** Ids the Worker already pushed (a phone found them first) - never push those twice. */
async function workerSeen(ids: string[]): Promise<Set<string>> {
  if (!worker() || !ids.length) return new Set();
  const out = new Set<string>();
  for (let i = 0; i < ids.length; i += 150) {
    try {
      const r = await fetch(`${worker()}/seen?ids=${ids.slice(i, i + 150).join(',')}`);
      ((await r.json()) as { seen: string[] }).seen.forEach((x) => out.add(x));
    } catch {}
  }
  return out;
}

async function markWorkerSeen(ids: string[]) {
  if (!worker() || !ids.length) return;
  await fetch(`${worker()}/seen`, { method: 'POST', headers: feedHeaders(), body: JSON.stringify({ ids }) }).catch(() => {});
}

async function phoneFinds(): Promise<Job[]> {
  const url = process.env.WORKER_URL;
  if (!url) return [];
  try {
    const r = await fetch(`${url.replace(/\/$/, '')}/finds`, { headers: { 'x-feed-key': process.env.FEED_KEY ?? '' } });
    if (!r.ok) throw new Error(String(r.status));
    return ((await r.json()) as { jobs: Job[] }).jobs ?? [];
  } catch (e) {
    console.log('worker finds failed:', e);
    return [];
  }
}

async function main() {
  const now = new Date().toISOString();
  const firstRun = !existsSync(OUT);
  const prev = readJson<Feed>(OUT, { updatedAt: now, jobs: [] });
  const meta = readJson<{ pushed: string[] }>(META, { pushed: [] });
  const known = new Map(prev.jobs.map((j) => [j.id, j]));

  const results = await fetchAllSources(now);
  for (const r of results) console.log(`${r.name}: ${r.jobs.length}${r.error ? `  ERROR ${r.error}` : ''}`);
  const failed = new Set(results.filter((r) => r.error).map((r) => r.name.split(':')[0]));

  let jobs = dedupe([...results.flatMap((r) => r.jobs), ...(await phoneFinds())]);
  // a source that failed this hour keeps its old jobs instead of losing them all
  const keepOld = prev.jobs.filter((j) => failed.has(j.source) && !jobs.some((n) => n.id === j.id));
  jobs = [...jobs, ...keepOld].map((j) => ({ ...j, firstSeen: known.get(j.id)?.firstSeen ?? now }))
    // old jobs are not live jobs: drop anything posted more than MAX_JOB_AGE_DAYS ago
    .filter((j) => jobAgeDays(j) <= MAX_JOB_AGE_DAYS);
  jobs.sort((a, b) => (b.postedDate ?? b.firstSeen.slice(0, 10)).localeCompare(a.postedDate ?? a.firstSeen.slice(0, 10)));

  const fresh = jobs.filter((j) => !known.has(j.id));
  mkdirSync('data', { recursive: true });
  writeFileSync(OUT, JSON.stringify({ updatedAt: now, jobs } satisfies Feed));
  console.log(`feed: ${jobs.length} jobs, ${fresh.length} new`);

  // ---- push
  const pushed = new Set(meta.pushed);
  const byWorker = await workerSeen(fresh.map((j) => j.id));
  const toPush = fresh.filter((j) => !pushed.has(j.id) && !byWorker.has(j.id));
  const sa = serviceAccount();
  let sent = 0;
  if (firstRun) console.log('first run: no pushes (everything is "new")');
  else if (!sa) console.log('FIREBASE_SERVICE_ACCOUNT not set: no pushes');
  else {
    const byTopic = new Map<string, Job[]>();
    for (const j of toPush) byTopic.set(topicFor(j), [...(byTopic.get(topicFor(j)) ?? []), j]);
    for (const [topic, list] of byTopic) {
      if (sent >= MAX_PUSHES_PER_RUN) break;
      const { title, body } = pushText(list, COUNTRY_EN[list[0]!.country] ?? 'the Gulf');
      try {
        await sendPush(sa, {
          topic, title, body, channel: list[0]!.sector === 'govt' ? 'govt-jobs' : 'new-jobs',
          data: list.length === 1 ? { jobId: list[0]!.id } : { screen: '/' },
        });
        sent++;
        list.forEach((j) => pushed.add(j.id));
      } catch (e) {
        console.log(String(e));
      }
    }
  }
  if (firstRun) toPush.forEach((j) => pushed.add(j.id));
  await markWorkerSeen(fresh.map((j) => j.id));
  writeFileSync(META, JSON.stringify({
    updatedAt: now, total: jobs.length, new: fresh.length, pushes: sent,
    sources: Object.fromEntries(results.map((r) => [r.name, r.error ? `error: ${r.error}` : r.jobs.length])),
    pushed: [...pushed].slice(-8000),
  }, null, 1));
  console.log(`pushes sent: ${sent}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
