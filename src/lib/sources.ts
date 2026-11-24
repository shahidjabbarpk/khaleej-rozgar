/**
 * Job sources - ONE file used by both sides:
 *   - the phone (lib/detect.ts) when the hosted feed is down or a source blocks foreign servers;
 *   - the hourly GitHub Actions feed builder (scraper/build-feed.ts, run with node --experimental-strip-types).
 * So this file must only use fetch + plain TypeScript and `import type` (no app modules, no node modules).
 *
 * Every source here is FREE and public:
 *   - Dubai Careers: the Dubai Government's official Taleo portal; its job-board JSON is what the public site uses.
 *   - Greenhouse / SmartRecruiters / Workable / Lever: companies' own public job-board APIs (made for embedding, no key).
 */
import type { Category, Country, Eligibility, Job, Source } from './types';

const UA = 'Mozilla/5.0 (Linux; Android 14) KhaleejRozgar/1.0 (+https://itgreenservices.com)';

async function http(url: string, init: RequestInit = {}, timeoutMs = 25000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { ...init, headers: { 'User-Agent': UA, Accept: 'application/json', ...(init.headers ?? {}) }, signal: ctrl.signal });
    if (!r.ok) throw new Error(`${url} -> ${r.status}`);
    return r;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------- helpers

/** FNV-1a 64-bit -> 16 hex chars. Same id on every phone and on the server for the same advert. */
export function jobId(source: string, key: string): string {
  let h = 0xcbf29ce484222325n;
  const s = `${source}|${key}`;
  for (let i = 0; i < s.length; i++) {
    h ^= BigInt(s.charCodeAt(i));
    h = (h * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return `${source.slice(0, 2)}-${h.toString(16).padStart(16, '0')}`;
}

const COUNTRY_WORDS: [Country, RegExp][] = [
  ['ae', /\b(uae|u\.a\.e|united arab emirates|emirates|dubai|abu dhabi|sharjah|ajman|ras al khaimah|fujairah|al ain|umm al quwain)\b/i],
  ['sa', /\b(saudi|ksa|kingdom of saudi arabia|riyadh|jeddah|jiddah|dammam|khobar|dhahran|makkah|mecca|madinah|medina|jubail|tabuk|abha|neom|taif|buraidah|qassim)\b/i],
  ['qa', /\b(qatar|doha|lusail|al rayyan|al wakrah)\b/i],
  ['kw', /\b(kuwait|hawalli|salmiya|farwaniya|jahra|ahmadi)\b/i],
  ['om', /\b(oman|muscat|salalah|sohar|nizwa|duqm|seeb)\b/i],
  ['bh', /\b(bahrain|manama|muharraq|riffa)\b/i],
];

const ISO2: Record<string, Country> = { ae: 'ae', sa: 'sa', qa: 'qa', kw: 'kw', om: 'om', bh: 'bh' };

/** Gulf country of a free-text location, or null when it isn't in the Gulf. */
export function gulfCountry(location: string): Country | null {
  const t = location.trim();
  if (ISO2[t.toLowerCase()]) return ISO2[t.toLowerCase()]!;
  for (const [c, rx] of COUNTRY_WORDS) if (rx.test(t)) return c;
  return null;
}

const CITY_WORDS: Record<Country, string[]> = {
  sa: ['Riyadh', 'Jeddah', 'Makkah', 'Madinah', 'Dammam', 'Khobar', 'Dhahran', 'Jubail', 'Taif', 'Tabuk', 'Abha', 'NEOM', 'Buraidah', 'Yanbu'],
  ae: ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah', 'Fujairah', 'Al Ain'],
  qa: ['Doha', 'Lusail', 'Al Rayyan', 'Al Wakrah'],
  kw: ['Kuwait City', 'Hawalli', 'Salmiya', 'Farwaniya', 'Jahra', 'Ahmadi'],
  om: ['Muscat', 'Salalah', 'Sohar', 'Nizwa', 'Duqm', 'Seeb'],
  bh: ['Manama', 'Muharraq', 'Riffa'],
};

export function citiesOf(location: string, country: Country): string[] {
  const t = location.toLowerCase();
  const found = CITY_WORDS[country].filter((c) => t.includes(c.toLowerCase()));
  if (!found.length && country === 'kw' && /kuwait/i.test(location)) return ['Kuwait City'];
  return found.slice(0, 3);
}

const CATS: [Category, RegExp][] = [
  ['driver', /\bdriver|chauffeur|سائق|ڈرائیور/i],
  ['delivery', /\bdelivery|rider|courier|dispatch|توصيل|مندوب/i],
  ['security', /\bsecurity guard|security officer|guard\b|watchman|حارس|أمن/i],
  ['cleaning', /\bclean|housekeep|janitor|laundry|نظافة/i],
  ['hotel', /\bchef|cook|waiter|barista|kitchen|restaurant|hotel|hospitality|steward|f&b|food and beverage|طباخ/i],
  ['construction', /\bconstruction|labou?r|mason|carpenter|plumber|welder|scaffold|steel fixer|foreman|painter\b/i],
  ['factory', /\bfactory|warehouse|operator|picker|packer|forklift|logistics|inventory|production/i],
  ['health', /\bnurse|doctor|physician|pharmac|medical|clinic|health|dental|radiolog|therapist|ممرض|طبيب/i],
  ['teaching', /\bteacher|lecturer|professor|tutor|instructor|educat|school|معلم/i],
  ['it', /\bsoftware|developer|engineer.*(software|data|cloud|devops|backend|frontend|mobile|ml|ai)|data scien|devops|it support|network|cyber|programmer|qa engineer|product manager|ux|ui designer|android|ios\b/i],
  ['engineering', /\bengineer|technician|electrician|mechanic|hvac|maintenance|surveyor|draftsman|mep\b|civil|مهندس|فني/i],
  ['sales', /\bsales|cashier|retail|store|shop|merchandis|account manager|business development|marketing|customer success|بائع|مبيعات/i],
  ['office', /\baccount|finance|admin|secretary|receptionist|hr\b|human resources|recruit|clerk|legal|analyst|manager|officer|coordinator|assistant|customer service|call center|مدير|موظف|محاسب/i],
];

/** Trade from the job title (first match wins; office is the broad fallback before 'other'). */
export function categorize(title: string): Category {
  for (const [c, rx] of CATS) if (rx.test(title)) return c;
  return 'other';
}

const stripHtml = (s: string) =>
  s.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, '')
    .replace(/<(br|\/p|\/div|\/li|\/h\d)[^>]*>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();

export const snippet = (html: string | undefined, max = 1500) => (html ? stripHtml(html).slice(0, max) : undefined);

const isoDay = (s?: string | null) => (s && !Number.isNaN(Date.parse(s)) ? new Date(s).toISOString().slice(0, 10) : undefined);

function make(p: {
  source: Source; key: string; title: string; organization: string; country: Country; location: string; url: string;
  sector?: 'govt' | 'private'; eligibility?: Eligibility; description?: string; postedDate?: string; jobType?: string;
  logo?: string; now: string;
}): Job {
  return {
    id: jobId(p.source, p.key),
    source: p.source,
    sector: p.sector ?? 'private',
    title: p.title.trim().slice(0, 140),
    organization: p.organization.trim().slice(0, 100),
    category: categorize(p.title),
    country: p.country,
    cities: citiesOf(p.location, p.country),
    eligibility: p.eligibility ?? 'unknown',
    url: p.url,
    applyUrl: p.url,
    description: p.description,
    postedDate: p.postedDate,
    jobType: p.jobType,
    logo: p.logo,
    firstSeen: p.now,
  };
}

// ---------------------------------------------------------------- Dubai Government (official, Taleo)

const DC = 'https://jobs.dubaicareers.ae/careersection';
const DC_PORTAL = '40505100456';

/** "UAE Only" -> locals; "All Nationalities…" -> anyone (expats may apply). */
export function dubaiEligibility(col: string): Eligibility {
  if (/uae only|nationals only|emirati/i.test(col)) return 'locals';
  if (/all nationalit|expat|non.?national/i.test(col)) return 'anyone';
  return 'unknown';
}

/** dd/mm/yyyy -> yyyy-mm-dd */
const dmy = (s: string) => {
  const m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}` : undefined;
};

export async function fetchDubaiCareers(now: string, maxPages = 20): Promise<Job[]> {
  const out: Job[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const body = {
      multilineEnabled: false,
      sortingSelection: { sortBySelectionParam: '3', ascendingSortingOrder: 'false' },
      fieldData: { fields: { KEYWORD: '', LOCATION: '', ORGANIZATION: '' }, valid: true },
      filterSelectionParam: { searchFilterSelections: [{ id: 'POSTING_DATE', selectedValues: [] }, { id: 'ORGANIZATION', selectedValues: [] }, { id: 'JOB_FIELD', selectedValues: [] }] },
      advancedSearchFiltersSelectionParam: { searchFilterSelections: [] },
      pageNo: page,
    };
    const r = await http(`${DC}/rest/jobboard/searchjobs?lang=en&portal=${DC_PORTAL}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', tz: 'GMT+04:00' }, body: JSON.stringify(body),
    });
    const d = (await r.json()) as { requisitionList?: { jobId: string; contestNo: string; column: string[] }[]; pagingData?: { totalCount: number; pageSize: number } };
    const list = d.requisitionList ?? [];
    for (const j of list) {
      const [title = '', date = '', who = ''] = j.column;
      if (!title) continue;
      out.push(make({
        source: 'dubaicareers', key: j.contestNo || j.jobId, title, organization: 'Dubai Government', country: 'ae', location: 'Dubai',
        url: `${DC}/dubaicareers/jobdetail.ftl?job=${encodeURIComponent(j.contestNo)}&lang=en`,
        sector: 'govt', eligibility: dubaiEligibility(who), postedDate: dmy(date), now,
        description: who ? `Who can apply: ${who}` : undefined,
      }));
    }
    const total = d.pagingData?.totalCount ?? 0;
    if (!list.length || page * (d.pagingData?.pageSize ?? 25) >= total) break;
  }
  return out;
}

// ---------------------------------------------------------------- company job boards (public APIs)

export interface Board { ats: 'greenhouse' | 'smartrecruiters' | 'workable' | 'lever'; id: string; name: string }

/** Gulf employers with public job boards. Add more here; the feed picks them up on the next run. */
export const BOARDS: Board[] = [
  { ats: 'smartrecruiters', id: 'DeliveryHero', name: 'talabat / Delivery Hero' },
  { ats: 'greenhouse', id: 'careem', name: 'Careem' },
  { ats: 'greenhouse', id: 'tamara', name: 'Tamara' },
  { ats: 'workable', id: 'foodics', name: 'Foodics' },
  { ats: 'workable', id: 'salla', name: 'Salla' },
  { ats: 'workable', id: 'lucidya', name: 'Lucidya' },
];

async function greenhouse(b: Board, now: string): Promise<Job[]> {
  const d = (await (await http(`https://boards-api.greenhouse.io/v1/boards/${b.id}/jobs?content=true`)).json()) as
    { jobs?: { id: number; title: string; location?: { name?: string }; absolute_url: string; updated_at?: string; content?: string }[] };
  const out: Job[] = [];
  for (const j of d.jobs ?? []) {
    const loc = j.location?.name ?? '';
    const country = gulfCountry(loc);
    if (!country) continue;
    // Greenhouse returns the description HTML-escaped
    const html = j.content?.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
    out.push(make({ source: 'greenhouse', key: `${b.id}/${j.id}`, title: j.title, organization: b.name, country, location: loc,
      url: j.absolute_url, postedDate: isoDay(j.updated_at), description: snippet(html), now }));
  }
  return out;
}

async function smartrecruiters(b: Board, now: string): Promise<Job[]> {
  const out: Job[] = [];
  for (const cc of ['ae', 'sa', 'qa', 'kw', 'om', 'bh'] as Country[]) {
    for (let offset = 0; offset < 400; offset += 100) {
      const d = (await (await http(`https://api.smartrecruiters.com/v1/companies/${b.id}/postings?country=${cc}&limit=100&offset=${offset}`)).json()) as
        { totalFound?: number; content?: { id: string; name: string; releasedDate?: string; location?: { city?: string; country?: string; fullLocation?: string };
          company?: { name?: string }; typeOfEmployment?: { label?: string } }[] };
      for (const j of d.content ?? []) {
        const loc = j.location?.fullLocation ?? `${j.location?.city ?? ''} ${cc}`;
        out.push(make({ source: 'smartrecruiters', key: `${b.id}/${j.id}`, title: j.name, organization: j.company?.name || b.name, country: cc,
          location: loc, url: `https://jobs.smartrecruiters.com/${b.id}/${j.id}`, postedDate: isoDay(j.releasedDate),
          jobType: j.typeOfEmployment?.label, now }));
      }
      if (!d.content?.length || offset + 100 >= (d.totalFound ?? 0)) break;
    }
  }
  return out;
}

async function workable(b: Board, now: string): Promise<Job[]> {
  const d = (await (await http(`https://apply.workable.com/api/v1/widget/accounts/${b.id}`)).json()) as
    { name?: string; jobs?: { title: string; shortcode: string; country?: string; city?: string; url?: string; published_on?: string; employment_type?: string }[] };
  const out: Job[] = [];
  for (const j of d.jobs ?? []) {
    const loc = `${j.city ?? ''} ${j.country ?? ''}`;
    const country = gulfCountry(loc);
    if (!country) continue;
    out.push(make({ source: 'workable', key: `${b.id}/${j.shortcode}`, title: j.title, organization: d.name || b.name, country, location: loc,
      url: j.url ?? `https://apply.workable.com/${b.id}/j/${j.shortcode}/`, postedDate: isoDay(j.published_on), jobType: j.employment_type, now }));
  }
  return out;
}

async function lever(b: Board, now: string): Promise<Job[]> {
  const d = (await (await http(`https://api.lever.co/v0/postings/${b.id}?mode=json`)).json()) as
    { id: string; text: string; hostedUrl: string; createdAt?: number; categories?: { location?: string; commitment?: string }; descriptionPlain?: string }[];
  const out: Job[] = [];
  for (const j of d ?? []) {
    const loc = j.categories?.location ?? '';
    const country = gulfCountry(loc);
    if (!country) continue;
    out.push(make({ source: 'lever', key: `${b.id}/${j.id}`, title: j.text, organization: b.name, country, location: loc, url: j.hostedUrl,
      postedDate: j.createdAt ? new Date(j.createdAt).toISOString().slice(0, 10) : undefined, jobType: j.categories?.commitment,
      description: j.descriptionPlain?.slice(0, 1500), now }));
  }
  return out;
}

export function fetchBoard(b: Board, now: string): Promise<Job[]> {
  switch (b.ats) {
    case 'greenhouse': return greenhouse(b, now);
    case 'smartrecruiters': return smartrecruiters(b, now);
    case 'workable': return workable(b, now);
    case 'lever': return lever(b, now);
  }
}

// ---------------------------------------------------------------- all together

export interface SourceResult { name: string; jobs: Job[]; error?: string }

/** Every source in parallel; a failing source never stops the others. */
export async function fetchAllSources(now = new Date().toISOString()): Promise<SourceResult[]> {
  const tasks: [string, Promise<Job[]>][] = [
    ['dubaicareers', fetchDubaiCareers(now)],
    ...BOARDS.map((b) => [`${b.ats}:${b.id}`, fetchBoard(b, now)] as [string, Promise<Job[]>]),
  ];
  return Promise.all(tasks.map(async ([name, p]) => {
    try {
      return { name, jobs: await p };
    } catch (e) {
      return { name, jobs: [], error: String((e as Error)?.message ?? e) };
    }
  }));
}

const norm = (x: string | undefined) => (x ?? '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/**
 * Drop duplicates keeping the first: same id, or the same job posted twice by a company board with tiny
 * differences (extra space / punctuation / case in the title) - same org + title + country + first city.
 */
export function dedupe(jobs: Job[]): Job[] {
  const seen = new Set<string>();
  return jobs.filter((j) => {
    const sig = `~${norm(j.organization)}|${norm(j.title)}|${j.country}|${norm(j.cities?.[0])}`;
    if (seen.has(j.id) || seen.has(sig)) return false;
    seen.add(j.id);
    seen.add(sig);
    return true;
  });
}
