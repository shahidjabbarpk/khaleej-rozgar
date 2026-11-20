/** The 6 Gulf countries. */
export type Country = 'sa' | 'ae' | 'qa' | 'kw' | 'om' | 'bh';

/** Trade / job type (icons in theme.ts CATEGORY_META). */
export type Category =
  | 'driver' | 'construction' | 'cleaning' | 'hotel' | 'security' | 'sales' | 'office'
  | 'it' | 'health' | 'engineering' | 'teaching' | 'delivery' | 'factory' | 'other';

/** Who may apply. Feed jobs that don't say are 'unknown' ("Not stated") - never guessed. */
export type Eligibility = 'locals' | 'expats' | 'visa' | 'anyone' | 'unknown';

/**
 * Where a job came from.
 *  dubaicareers  - Dubai Government (official Taleo portal, public JSON)
 *  greenhouse / lever / smartrecruiters / workable - companies' own public job-board APIs (free, no key)
 *  careerjet     - Careerjet v4 (only when the relay has a key)
 *  admin         - govt job posted by the admin with an official link
 *  user          - posted inside the app by an employer
 */
export type Source =
  | 'dubaicareers' | 'greenhouse' | 'lever' | 'smartrecruiters' | 'workable' | 'careerjet' | 'admin' | 'user';

export type Sector = 'govt' | 'private';

export interface Job {
  id: string;
  source: Source;
  sector: Sector;
  title: string;
  organization: string;
  category: Category;
  country: Country;
  cities: string[];
  eligibility: Eligibility;
  url: string;          // original advert
  applyUrl?: string;    // official / company apply page
  description?: string;
  salary?: string;
  jobType?: string;     // Full-time, Contract…
  postedDate?: string;  // YYYY-MM-DD
  lastDate?: string;    // YYYY-MM-DD
  logo?: string;
  firstSeen: string;    // ISO timestamp the detector first saw it
  // user / admin posts only
  phone?: string;
  whatsapp?: string;
  email?: string;
  ownerUid?: string;
  ownerName?: string;
  verified?: boolean;
  status?: PostStatus;
  expiresAt?: number;
}

export type PostStatus = 'active' | 'hidden' | 'expired';

export interface Profile {
  name: string;
  whatsapp: string;
  country: Country | null;
}

/** "I need a job" post from a job seeker. */
export interface Seeker {
  id: string;
  ownerUid: string;
  name: string;
  category: Category;
  experience: number;
  country: Country;
  city: string | null;
  languages: string;
  text: string;
  whatsapp: string;
  createdAt: number;
}

export interface Report {
  id: string;
  kind: 'job' | 'seeker';
  postId: string;
  reason: string;
  uid: string;
  createdAt: number;
}

export interface Feed {
  updatedAt: string;
  jobs: Job[];
}

/** One entry in the Alerts tab history. */
export interface AlertItem {
  id: string;
  title: string;
  body: string;
  jobId?: string;
  at: number;
}
