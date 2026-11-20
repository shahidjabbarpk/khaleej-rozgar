import { FEED_URLS } from './config';
import { fetchActivePosts } from './community';
import { detectOnDevice, shouldDetectOnPhone } from './detect';
import { useApp } from './store';
import type { Feed, Job } from './types';

export interface RefreshResult {
  fresh: Job[];
  via: 'feed' | 'device';
  /** new jobs that only this phone saw (not in the hosted feed) - candidates for a local alert */
  phoneOnly: Job[];
}

async function fetchJson(url: string): Promise<Feed> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    // cache-buster: raw GitHub / jsDelivr cache a few minutes
    const r = await fetch(`${url}?t=${Math.floor(Date.now() / 300000)}`, { signal: ctrl.signal });
    if (!r.ok) throw new Error(`feed ${r.status}`);
    const feed = (await r.json()) as Feed;
    if (!Array.isArray(feed.jobs)) throw new Error('bad feed');
    return feed;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchFeed(): Promise<Feed> {
  let last: unknown;
  for (const u of FEED_URLS) {
    try {
      return await fetchJson(u);
    } catch (e) {
      last = e;
    }
  }
  throw last;
}

let inflight: Promise<RefreshResult> | null = null;

/**
 * Hosted feed (built every hour) + employer posts (Firestore).
 * When the feed is down or stale, THIS phone checks the official sources itself (detect.ts) and
 * reports what it found to the Worker, which pushes it to every other user (see detect.ts).
 */
export function refreshJobs(): Promise<RefreshResult> {
  inflight ??= (async () => {
    const { jobs, ingest, country } = useApp.getState();
    useApp.getState().set({ syncing: true });
    const postsP = fetchActivePosts(country).catch(() => jobs.filter((j) => j.source === 'user' || j.source === 'admin'));
    const feedJobs = (list: Job[]) => list.filter((j) => j.source !== 'user' && j.source !== 'admin');
    try {
      const feed = await fetchFeed();
      const inFeed = new Set(feed.jobs.map((j) => j.id));
      let list = feed.jobs;
      if (shouldDetectOnPhone(feed.updatedAt)) list = await detectOnDevice(list);
      const fresh = ingest({ ...feed, jobs: [...(await postsP), ...list] });
      return { fresh, via: 'feed' as const, phoneOnly: feedJobs(fresh).filter((j) => !inFeed.has(j.id)) };
    } catch {
      const merged = await detectOnDevice(feedJobs(jobs));
      const fresh = ingest({ updatedAt: new Date().toISOString(), jobs: [...(await postsP), ...merged] });
      return { fresh, via: 'device' as const, phoneOnly: feedJobs(fresh) };
    }
  })().finally(() => {
    inflight = null;
    useApp.getState().set({ syncing: false });
  });
  return inflight;
}
