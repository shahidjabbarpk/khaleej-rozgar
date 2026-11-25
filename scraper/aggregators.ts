/**
 * Extra job sources for the hourly feed only (never in the app): big official job-search APIs that carry the
 * blue-collar jobs company boards don't have (drivers, labour/helpers, cleaners, security + safety/HSE officers,
 * electricians, cooks, warehouse...). Each one switches on by itself once its key is in the GitHub secrets.
 *
 *  - Amazon jobs (no key): amazon.jobs public search JSON, Gulf countries only.
 *  - Careerjet (CAREERJET_KEY): https://www.careerjet.com/partners/api - one publisher key, all 6 Gulf locales.
 *  - Jooble (JOOBLE_KEYS = {"ae":"key","sa":"key",...}): one free key per country site, 100 requests/day each.
 *
 * Queries rotate by the hour so the free limits are never hit; build-feed.ts keeps aggregator jobs for a few
 * days so a query that didn't run this hour doesn't make its jobs vanish.
 */
import { make } from '../src/lib/sources.ts';
import type { Country, Job, Source } from '../src/lib/types.ts';

const UA = 'Mozilla/5.0 (compatible; KhaleejRozgarFeed/1.0; +https://itgreenservices.com)';
const COUNTRIES: Country[] = ['ae', 'sa', 'qa', 'kw', 'om', 'bh'];
const COUNTRY_NAME: Record<Country, string> = {
  ae: 'United Arab Emirates', sa: 'Saudi Arabia', qa: 'Qatar', kw: 'Kuwait', om: 'Oman', bh: 'Bahrain',
};

/** Every trade the app has, written the way Gulf job ads write them. */
export const TRADE_QUERIES = [
  'driver', 'heavy driver', 'labour helper', 'cleaner housekeeping', 'security guard', 'safety officer',
  'HSE officer', 'electrician', 'plumber', 'welder', 'mason carpenter', 'cook', 'waiter', 'warehouse',
  'forklift operator', 'delivery rider', 'technician', 'mechanic', 'nurse', 'salesman', 'cashier',
  'accountant', 'receptionist', 'teacher', 'factory worker', 'AC technician',
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function get(url: string, init: RequestInit = {}): Promise<Response> {
  const r = await fetch(url, { ...init, headers: { 'User-Agent': UA, ...(init.headers ?? {}) }, signal: AbortSignal.timeout(60000) });
  if (!r.ok) throw new Error(`${r.status} ${url.split('?')[0]}`);
  return r;
}
const isoDay = (s?: string) => (s && !Number.isNaN(Date.parse(s)) ? new Date(s).toISOString().slice(0, 10) : undefined);
const hourSlot = (n: number, size: number) => {
  // which `size` items of n run this hour (all of them over a day)
  const h = new Date().getUTCHours();
  const start = (h * size) % n;
  return Array.from({ length: Math.min(size, n) }, (_, i) => (start + i) % n);
};

// ---------------------------------------------------------------- Amazon (no key)

const AMAZON_CC: Record<Country, string> = { ae: 'ARE', sa: 'SAU', qa: 'QAT', kw: 'KWT', om: 'OMN', bh: 'BHR' };

export async function fetchAmazon(now: string): Promise<Job[]> {
  const out: Job[] = [];
  for (const cc of COUNTRIES) {
    const d = (await (await get(`https://www.amazon.jobs/en/search.json?normalized_country_code%5B%5D=${AMAZON_CC[cc]}&result_limit=100&offset=0&sort=recent`)).json()) as
      { jobs?: { id_icims: string; title: string; city?: string; normalized_location?: string; posted_date?: string; job_path: string;
        description_short?: string; basic_qualifications?: string; job_schedule_type?: string }[] };
    for (const j of d.jobs ?? []) {
      out.push(make({ source: 'amazon', key: j.id_icims, title: j.title, organization: 'Amazon', country: cc,
        location: j.normalized_location || j.city || COUNTRY_NAME[cc], url: `https://www.amazon.jobs${j.job_path}`,
        postedDate: isoDay(j.posted_date), jobType: j.job_schedule_type,
        description: `${j.description_short ?? ''}\n\n${(j.basic_qualifications ?? '').replace(/<br\/?>/g, '\n')}`.trim().slice(0, 1500), now }));
    }
    await sleep(500);
  }
  return out;
}

// ---------------------------------------------------------------- Careerjet (CAREERJET_KEY)

let myIp = '';
async function publicIp(): Promise<string> {
  if (!myIp) myIp = (await (await get('https://api.ipify.org')).text()).trim();
  return myIp;
}

export async function fetchCareerjet(now: string, key = process.env.CAREERJET_KEY): Promise<Job[]> {
  if (!key) return [];
  const auth = `Basic ${Buffer.from(`${key}:`).toString('base64')}`;
  const ip = await publicIp();
  const out: Job[] = [];
  // 6 countries x 4 trades per hour -> every trade in every country about once every 6-7 hours
  for (const qi of hourSlot(TRADE_QUERIES.length, 4)) {
    for (const cc of COUNTRIES) {
      const q = new URLSearchParams({ locale_code: `en_${cc.toUpperCase()}`, keywords: TRADE_QUERIES[qi]!, sort: 'date', page_size: '50',
        fragment_size: '400', user_ip: ip, user_agent: UA });
      try {
        const d = (await (await get(`https://search.api.careerjet.net/v4/query?${q}`, { headers: { Authorization: auth } })).json()) as
          { type?: string; jobs?: { title: string; company?: string; date?: string; description?: string; locations?: string; salary?: string; url: string }[] };
        for (const j of d.jobs ?? []) {
          out.push(make({ source: 'careerjet', key: j.url.replace(/^https?:\/\/[^/]+\//, ''), title: j.title,
            organization: j.company || 'Employer', country: cc, location: j.locations || COUNTRY_NAME[cc], url: j.url,
            postedDate: isoDay(j.date), description: [j.salary ? `Salary: ${j.salary}` : '', j.description ?? ''].filter(Boolean).join('\n\n'), now }));
        }
      } catch (e) {
        console.log(`careerjet ${cc} "${TRADE_QUERIES[qi]}": ${(e as Error).message}`);
      }
      await sleep(400);
    }
  }
  return out;
}

// ---------------------------------------------------------------- Jooble (JOOBLE_KEYS)

export async function fetchJooble(now: string, raw = process.env.JOOBLE_KEYS): Promise<Job[]> {
  if (!raw) return [];
  let keys: Partial<Record<Country, string>>;
  try {
    keys = JSON.parse(raw);
  } catch {
    return [];
  }
  const out: Job[] = [];
  // free plan: 100 requests/day per country key -> 4 per hourly run (96/day)
  for (const cc of COUNTRIES) {
    const key = keys[cc];
    if (!key) continue;
    for (const qi of hourSlot(TRADE_QUERIES.length, 4)) {
      try {
        const d = (await (await get(`https://${cc}.jooble.org/api/${key}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keywords: TRADE_QUERIES[qi], location: COUNTRY_NAME[cc], page: 1, ResultOnPage: 50 }),
        })).json()) as { jobs?: { id: number | string; title: string; location?: string; snippet?: string; salary?: string; type?: string; link: string; company?: string; updated?: string }[] };
        for (const j of d.jobs ?? []) {
          out.push(make({ source: 'jooble', key: `${cc}/${j.id}`, title: j.title.replace(/<[^>]+>/g, ''), organization: j.company || 'Employer',
            country: cc, location: j.location || COUNTRY_NAME[cc], url: j.link, postedDate: isoDay(j.updated), jobType: j.type || undefined,
            description: [j.salary ? `Salary: ${j.salary}` : '', (j.snippet ?? '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ')].filter(Boolean).join('\n\n'), now }));
        }
      } catch (e) {
        console.log(`jooble ${cc} "${TRADE_QUERIES[qi]}": ${(e as Error).message}`);
      }
      await sleep(400);
    }
  }
  return out;
}

/** Aggregator sources: their jobs are kept a few days between runs because queries rotate. */
export const ROTATING: Source[] = ['careerjet', 'jooble'];
