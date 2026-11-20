import * as StoreReview from 'expo-store-review';
import { Linking, Platform, Share } from 'react-native';
import { track } from './analytics';
import { STORE_URL } from './config';
import { useApp } from './store';
import type { Job } from './types';

const REVIEW_GAP_MS = 30 * 86_400_000;

/**
 * Google Play's in-app review sheet, only at a happy moment (2nd saved job, a posted job)
 * and at most once every 30 days. Never called on launch. Play itself may still decide not to show it.
 */
export async function maybeAskReview() {
  if (Platform.OS !== 'android') return;
  const { reviewAskedAt, set } = useApp.getState();
  if (reviewAskedAt && Date.now() - reviewAskedAt < REVIEW_GAP_MS) return;
  try {
    if (!(await StoreReview.isAvailableAsync())) return;
    set({ reviewAskedAt: Date.now() });
    await StoreReview.requestReview();
  } catch {}
}

/** Call after toggleSave: counts saves for the review prompt and logs job_save. */
export function jobSaveToggled(job: Job, nowSaved: boolean) {
  if (!nowSaved) return;
  const savesTotal = useApp.getState().savesTotal + 1;
  useApp.getState().set({ savesTotal });
  track('job_save', { source: job.source, category: job.category });
  if (savesTotal >= 2) maybeAskReview();
}

/** Play Store link that tells Google Play (and Google Ads) the install came from a share. */
export const storeLink = (medium: 'job_share' | 'app_share') =>
  `${STORE_URL}&referrer=${encodeURIComponent(`utm_source=app_share&utm_medium=${medium}&utm_campaign=organic_share`)}`;

/** Feed jobs have no page on a website yet (no site for this app); shares use the Play link. */
export function jobPageUrl(_job: Job): string | null {
  return null;
}

/** "Share app" from Settings. */
export async function shareApp(message: string) {
  track('app_share');
  await Share.share({ message: `${message}\n${storeLink('app_share')}` }).catch(() => {});
}

/** "Rate app": the Play listing itself (the in-app sheet is reserved for the happy moments above). */
export function openStoreListing() {
  Linking.openURL('market://details?id=com.khaleejrozgar.jobs.mza').catch(() => Linking.openURL(STORE_URL));
}
