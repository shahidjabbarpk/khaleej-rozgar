/**
 * FCM topic names - shared by the app (subscribe) and the feed builder / Worker (send).
 * Each job is pushed to exactly ONE topic, so nobody gets the same job twice:
 *   govt jobs    -> jobs_<cc>_govt
 *   private jobs -> jobs_<cc>_<category>
 * Plain `import type` only: also loaded by node --experimental-strip-types.
 */
import type { Category, Country, Job } from './types';

const ALL_CC: Country[] = ['sa', 'ae', 'qa', 'kw', 'om', 'bh'];

export function topicFor(job: Pick<Job, 'country' | 'sector' | 'category'>): string {
  return `jobs_${job.country}_${job.sector === 'govt' ? 'govt' : job.category}`;
}

/** Topics a device should be in. country null = all 6 countries. */
export function topicsFor(p: { notify: boolean; notifyGovt: boolean; country: Country | null; categories: Category[] }): string[] {
  if (!p.notify) return [];
  const ccs = p.country ? [p.country] : ALL_CC;
  const out: string[] = [];
  for (const cc of ccs) {
    for (const cat of p.categories) out.push(`jobs_${cc}_${cat}`);
    if (p.notifyGovt) out.push(`jobs_${cc}_govt`);
  }
  return out;
}

/** Push text in English (the app's default language). */
export function pushText(jobs: Job[], countryName: string): { title: string; body: string } {
  if (jobs.length === 1) {
    const j = jobs[0]!;
    return { title: `🆕 ${j.title}`, body: `${j.organization} • ${j.cities[0] ?? countryName}${j.sector === 'govt' ? ' • Govt job' : ''}` };
  }
  const govt = jobs[0]!.sector === 'govt';
  return {
    title: `🔔 ${jobs.length} new ${govt ? 'government ' : ''}jobs in ${countryName}`,
    body: jobs.slice(0, 3).map((j) => `• ${j.title}`).join('\n'),
  };
}
