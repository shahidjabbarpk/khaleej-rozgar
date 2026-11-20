/**
 * Hourly feed built by scraper/build-feed.ts (GitHub Actions, public repo).
 * jsDelivr mirrors GitHub for free and is fast in the Gulf; raw GitHub is the fallback.
 */
export const FEED_URLS = [
  process.env.EXPO_PUBLIC_FEED_URL ?? 'https://raw.githubusercontent.com/shahidjabbarpk/khaleej-rozgar/main/data/jobs.json',
  'https://cdn.jsdelivr.net/gh/shahidjabbarpk/khaleej-rozgar@main/data/jobs.json',
];

/**
 * Cloudflare Worker (worker/ folder): /found (a phone reports a job it found -> push to everyone),
 * /seen, /careerjet. Empty = the phone keeps working on its own (feed + local alerts only).
 */
export const WORKER_URL = process.env.EXPO_PUBLIC_WORKER_URL ?? '';

export const STORE_URL = 'https://play.google.com/store/apps/details?id=com.khaleejrozgar.jobs.mza';
export const SITE_URL = 'https://itgreenservices.com';
export const PRIVACY_URL = 'https://itgreenservices.com/app/privacy';
export const TERMS_URL = 'https://itgreenservices.com/app/terms';
export const SUPPORT_EMAIL = 'support@itgreenservices.com';

export const BACKGROUND_TASK = 'khaleej-detect-new-jobs';
export const BACKGROUND_INTERVAL_MIN = 30; // Android treats this as a minimum, not exact

// ---------------------------------------------------------------- ads (see lib/ads.tsx)
/** Safety floor between any two full-screen ads. */
export const FULLSCREEN_GAP_MS = 60 * 1000;
/** No interstitial in the first seconds after launch (the App Open ad covers the start). */
export const LAUNCH_GRACE_MS = 30 * 1000;
/** Interstitial on every Nth job opened (1st, 2nd free, 3rd ad…). */
export const JOB_OPENS_PER_AD = 3;
/** App Open ad at most this often. */
export const APP_OPEN_GAP_MS = 4 * 3600 * 1000;
/** A native ad card after every N jobs in lists. */
export const NATIVE_AD_EVERY = 8;

/**
 * REAL AdMob units (AdMob app "Khaleej Rozgar", publisher pub-2214888899948620).
 * Empty = Google test ads. Filled in when the AdMob app is created (build phase).
 */
export const PROD_AD_UNITS = {
  android: {
    appOpen: '',
    banner: '',
    native: '',
    interstitial: '',
  },
};

/** Firebase web config of the Khaleej Rozgar project (NOT PakJobs). null = community features show "being set up". */
export const FIREBASE_CONFIG: {
  apiKey: string; authDomain: string; projectId: string; storageBucket: string; messagingSenderId: string; appId: string;
} | null = {
  apiKey: 'AIzaSyDPhkKYeSO3Oqqsfiuzvef0yXat0IJgKAY',
  authDomain: 'khaleej-rozgar-sj.firebaseapp.com',
  projectId: 'khaleej-rozgar-sj',
  storageBucket: 'khaleej-rozgar-sj.firebasestorage.app',
  messagingSenderId: '18725941989',
  appId: '1:18725941989:web:75f3e1311fcc1f7b451a0c',
};

export const GOOGLE_WEB_CLIENT_ID = '';

/** User job posts stay visible this long. */
export const POST_LIFETIME_DAYS = 30;
/** Max new posts per user per day (also enforced in Firestore rules). */
export const MAX_POSTS_PER_DAY = 3;
/** A post with this many reports hides itself until the admin checks it. */
export const AUTO_HIDE_REPORTS = 3;
