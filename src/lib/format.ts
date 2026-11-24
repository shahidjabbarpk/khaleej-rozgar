import type { Job } from './types';

const DAY = 86_400_000;

/** End of the last day in Gulf time (UTC+3; UAE/Oman are +4 - one hour does not matter for a deadline). */
export function deadlineMs(job: Job): number | null {
  if (!job.lastDate) return null;
  return Date.parse(`${job.lastDate}T23:59:59+03:00`);
}

export function daysLeft(job: Job, now = Date.now()): number | null {
  const end = deadlineMs(job);
  if (end == null) return null;
  return Math.floor((end - now) / DAY);
}

export type Urgency = 'closed' | 'today' | 'urgent' | 'soon' | 'ok' | 'open';

export function urgency(job: Job, now = Date.now()): Urgency {
  const end = deadlineMs(job);
  if (end == null) return 'open';
  if (end < now) return 'closed';
  const d = Math.floor((end - now) / DAY);
  if (d === 0) return 'today';
  if (d <= 3) return 'urgent';
  if (d <= 7) return 'soon';
  return 'ok';
}

/** Jobs older than this never show (and the feed drops them): a 223-day-old job is not a live job. */
export const MAX_JOB_AGE_DAYS = 60;

/** Days since the job was posted (posted date, else the first time we saw it). */
export function jobAgeDays(job: Job, now = Date.now()): number {
  const t = job.postedDate ? Date.parse(`${job.postedDate}T00:00:00+03:00`) : Date.parse(job.firstSeen);
  const first = Date.parse(job.firstSeen);
  const at = Number.isFinite(t) ? t : first;
  return Number.isFinite(at) ? Math.max(0, (now - at) / DAY) : 0;
}

/** Too old to show: posted more than MAX_JOB_AGE_DAYS ago, unless its last date is still ahead. */
export function isStale(job: Job, now = Date.now()): boolean {
  const end = deadlineMs(job);
  if (end && end >= now) return false;
  return jobAgeDays(job, now) > MAX_JOB_AGE_DAYS;
}

export function isNew(job: Job, now = Date.now()): boolean {
  return now - Date.parse(job.firstSeen) < DAY;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function prettyDate(iso?: string): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${d} ${MONTHS[(m ?? 1) - 1]} ${y}`;
}

/** "2h", "3d" since the job was posted / first seen. */
export function ago(job: Job, now = Date.now()): string {
  const t = job.postedDate ? Date.parse(`${job.postedDate}T08:00:00+03:00`) : Date.parse(job.firstSeen);
  const mins = Math.max(0, Math.round((now - Math.min(t, Date.parse(job.firstSeen) || t)) / 60000));
  if (mins < 60) return `${Math.max(1, mins)}m`;
  if (mins < 1440) return `${Math.round(mins / 60)}h`;
  return `${Math.round(mins / 1440)}d`;
}

export function initials(name: string): string {
  return name
    .replace(/\b(of|the|and|for|&|llc|co)\b/gi, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}

export function sortJobs(jobs: Job[], by: 'newest' | 'deadline'): Job[] {
  const copy = [...jobs];
  if (by === 'deadline') {
    const far = Number.MAX_SAFE_INTEGER;
    const now = Date.now();
    copy.sort((a, b) => {
      const ea = deadlineMs(a) ?? far;
      const eb = deadlineMs(b) ?? far;
      return (ea < now ? far : ea) - (eb < now ? far : eb);
    });
  } else {
    copy.sort((a, b) => (b.postedDate ?? b.firstSeen.slice(0, 10)).localeCompare(a.postedDate ?? a.firstSeen.slice(0, 10))
      || b.firstSeen.localeCompare(a.firstSeen));
  }
  return copy;
}

/** Local Gulf/South-Asian number -> international digits for wa.me (keeps numbers that already have a code). */
export function toIntl(n: string): string {
  const d = n.replace(/\D/g, '');
  if (d.startsWith('00')) return d.slice(2);
  return d;
}

/** decodeURI throws on stray '%', so fall back to the raw string. */
export function safeUrl(url: string): string {
  try {
    return encodeURI(decodeURI(url));
  } catch {
    return url.replace(/ /g, '%20');
  }
}
