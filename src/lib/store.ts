import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import seed from '../data/seed.json';
import { isStale } from './format';
import { Storage } from './kv';
import type { Lang } from './i18n';
import type { AlertItem, Category, Country, Feed, Job, Profile } from './types';
import type { CvData } from './cv';

export const ALL_CATEGORIES: Category[] = ['driver', 'construction', 'cleaning', 'hotel', 'security', 'sales', 'office',
  'it', 'health', 'engineering', 'teaching', 'delivery', 'factory', 'other'];

interface AppState {
  jobs: Job[];
  updatedAt: string | null;   // feed generation time
  lastChecked: string | null; // last successful refresh on this device
  seenIds: string[];          // ids already notified/shown, for new-job detection
  saved: Record<string, Job>;
  reminders: Record<string, string>; // jobId -> scheduled notification ids
  lang: Lang;                 // always English after install; changed in Settings
  theme: 'light' | 'dark';
  // alerts are ON by default (Android 13+ still asks POST_NOTIFICATIONS on first launch)
  notify: boolean;
  notifyGovt: boolean;
  notifyReminders: boolean;
  translateOnMobile: boolean; // allow 30 MB ML Kit packs on mobile data
  alertCategories: Category[];
  subscribedTopics: string[]; // FCM topics this device is in now
  alertHistory: AlertItem[];
  country: Country | null;    // picked in onboarding; null = all Gulf
  city: string | null;
  role: 'seeker' | 'employer';
  cv: CvData | null;
  profile: Profile | null;
  admin: boolean;
  onboarded: boolean;
  lastInterstitial: number;
  lastAppOpenAd: number;
  selfRestartAt: number;      // app restarted itself (language / RTL switch) - no App Open ad right after
  launches: number;
  syncing: boolean;           // not persisted - drives skeleton loaders
  alertsSeenAt: number;
  savesTotal: number;
  reviewAskedAt: number | null;

  /** Merge a fresh feed in; returns the jobs never seen before on this device. */
  ingest: (feed: Feed) => Job[];
  toggleSave: (job: Job) => boolean;
  addAlert: (a: AlertItem) => void;
  set: (patch: Partial<AppState>) => void;
}

const rawSeed = seed as unknown as Feed;
// old jobs never show anywhere (Jobs, Govt, Alerts): drop them from the seed and every fresh feed
const seedFeed: Feed = { ...rawSeed, jobs: rawSeed.jobs.filter((j) => !isStale(j)) };

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      jobs: seedFeed.jobs,
      updatedAt: seedFeed.updatedAt,
      lastChecked: null,
      seenIds: seedFeed.jobs.map((j) => j.id),
      saved: {},
      reminders: {},
      lang: 'en',
      theme: 'light',
      notify: true,
      notifyGovt: true,
      notifyReminders: true,
      translateOnMobile: false,
      alertCategories: [...ALL_CATEGORIES],
      subscribedTopics: [],
      alertHistory: [],
      country: null,
      city: null,
      role: 'seeker',
      cv: null,
      profile: null,
      admin: false,
      onboarded: false,
      lastInterstitial: 0,
      lastAppOpenAd: 0,
      selfRestartAt: 0,
      launches: 0,
      syncing: false,
      alertsSeenAt: Date.now(),
      savesTotal: 0,
      reviewAskedAt: null,

      ingest: (rawFeed) => {
        const feed = { ...rawFeed, jobs: rawFeed.jobs.filter((j) => !isStale(j)) };
        const seen = new Set(get().seenIds);
        const fresh = feed.jobs.filter((j) => !seen.has(j.id));
        const saved = { ...get().saved };
        for (const j of feed.jobs) if (saved[j.id]) saved[j.id] = j;
        set({
          jobs: feed.jobs,
          updatedAt: feed.updatedAt,
          lastChecked: new Date().toISOString(),
          // remember ids after they leave the feed so they never re-alert
          seenIds: [...new Set([...feed.jobs.map((j) => j.id), ...get().seenIds])].slice(0, 6000),
          saved,
        });
        return fresh;
      },
      toggleSave: (job) => {
        const saved = { ...get().saved };
        const now = !saved[job.id];
        if (now) saved[job.id] = job;
        else delete saved[job.id];
        set({ saved });
        return now;
      },
      addAlert: (a) => {
        const rest = get().alertHistory.filter((x) => x.id !== a.id);
        set({ alertHistory: [a, ...rest].slice(0, 100) });
      },
      set: (patch) => set(patch),
    }),
    {
      name: 'khaleej-app',
      version: 1,
      storage: createJSONStorage(() => Storage),
      partialize: ({ ingest, toggleSave, addAlert, set, syncing, ...rest }) => rest,
    },
  ),
);

export function waitForHydration(): Promise<void> {
  if (useApp.persist.hasHydrated()) return Promise.resolve();
  return new Promise((resolve) => {
    const unsub = useApp.persist.onFinishHydration(() => {
      unsub();
      resolve();
    });
  });
}
