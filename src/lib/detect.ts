/**
 * On-device detector: the phone runs the same free sources as the server (lib/sources.ts).
 *
 * When does a phone check the sources itself?
 *   - the hosted feed can't be reached, or
 *   - the feed is older than STALE_MS (GitHub Actions late / a source blocks foreign servers),
 *   and this phone hasn't checked in the last PHONE_GAP_MS (so 1000 phones don't hammer the sites).
 *
 * New jobs it finds are POSTed to the Worker (/found). The Worker checks them (App Check, allow-listed
 * official hosts, de-duplicates in D1) and pushes them to the FCM topic -> every other user is notified.
 * The feed builder then picks them up from /finds on its next run.
 */
import { Platform } from 'react-native';
import { WORKER_URL } from './config';
import { dedupe, fetchAllSources } from './sources';
import { useApp } from './store';
import type { Job } from './types';

const STALE_MS = 2 * 3600_000;
const PHONE_GAP_MS = 60 * 60_000;
let lastPhoneCheck = 0;

export function shouldDetectOnPhone(feedUpdatedAt: string): boolean {
  const stale = Date.now() - Date.parse(feedUpdatedAt) > STALE_MS;
  return stale && Date.now() - lastPhoneCheck > PHONE_GAP_MS;
}

/** Feed jobs + whatever the official sources show right now (new ones are reported to the Worker). */
export async function detectOnDevice(known: Job[]): Promise<Job[]> {
  if (Platform.OS === 'web') return known; // browsers block these APIs (CORS)
  lastPhoneCheck = Date.now();
  const results = await fetchAllSources();
  const found = results.flatMap((r) => r.jobs);
  if (!found.length) return known;
  const knownIds = new Map(known.map((j) => [j.id, j]));
  const seen = new Set(useApp.getState().seenIds);
  const fresh = found.filter((j) => !knownIds.has(j.id) && !seen.has(j.id));
  if (fresh.length) reportFinds(fresh).catch(() => {});
  // keep the first time we saw a job, not the time of this check
  const merged = found.map((j) => ({ ...j, firstSeen: knownIds.get(j.id)?.firstSeen ?? j.firstSeen }));
  // sources that failed now keep their old jobs
  const failed = new Set(results.filter((r) => r.error).map((r) => r.name.split(':')[0]));
  return dedupe([...merged, ...known.filter((j) => failed.has(j.source))]);
}

/** Jobs this phone reported, so its own local alert isn't doubled by the topic push. */
export const reportedByMe = new Set<string>();

async function appCheckToken(): Promise<string> {
  try {
    // App Check (Play Integrity) proves the request comes from our real app on a real phone
    const mod = require('@react-native-firebase/app-check');
    const ac = mod.getAppCheck ? mod.getAppCheck() : mod.default();
    const res = await (mod.getToken ? mod.getToken(ac, false) : ac.getToken(false));
    return res?.token ?? '';
  } catch {
    return '';
  }
}

async function reportFinds(jobs: Job[]): Promise<void> {
  if (!WORKER_URL) return;
  const batch = jobs.slice(0, 25);
  const r = await fetch(`${WORKER_URL.replace(/\/$/, '')}/found`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Firebase-AppCheck': await appCheckToken() },
    body: JSON.stringify({ jobs: batch }),
  });
  if (r.ok) batch.forEach((j) => reportedByMe.add(j.id));
}
