/**
 * AdMob - Shahid's rules (same spirit as PakJobs), kept gentle so users aren't annoyed:
 *   1. App start: ONE App Open ad on a cold start (AdMob's own format for app launch - interstitials on
 *      launch are not allowed). Never on the very first launch (onboarding), never when the app was
 *      opened from a notification, at most once every APP_OPEN_GAP_MS.
 *   2. Job opens: NOT every click. 1st and 2nd job free, 3rd job shows an interstitial, and so on
 *      (JOB_OPENS_PER_AD). An ad that isn't ready stays "due" for the next open.
 *   3. "Apply Now": an interstitial, then the apply page opens after it closes (straight away if no ad).
 *   4. Safety nets: no interstitial in the first LAUNCH_GRACE_MS, and FULLSCREEN_GAP_MS between any two
 *      full-screen ads. Never on forms, Back, exit, or a notification open. Call/WhatsApp never get one.
 *   5. Banner at the bottom of list screens + job detail; one native card every NATIVE_AD_EVERY jobs.
 * Test ads in __DEV__ or while PROD_AD_UNITS is empty.
 */
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import mobileAds, {
  AdEventType,
  AdsConsent,
  AppOpenAd,
  BannerAd,
  BannerAdSize,
  InterstitialAd,
  NativeAd,
  NativeAdView,
  NativeAsset,
  NativeAssetType,
  NativeMediaView,
  TestIds,
} from 'react-native-google-mobile-ads';
import { Image } from 'expo-image';
import { APP_OPEN_GAP_MS, FULLSCREEN_GAP_MS, JOB_OPENS_PER_AD, LAUNCH_GRACE_MS, PROD_AD_UNITS } from './config';
import { useI18n } from './i18n';
import { useApp } from './store';
import { font, useTheme } from './theme';

const prod = PROD_AD_UNITS.android;
const test = (real: string, t: string) => (__DEV__ || !real ? t : real);
const AD_UNITS = {
  appOpen: test(prod.appOpen, TestIds.APP_OPEN),
  banner: test(prod.banner, TestIds.ADAPTIVE_BANNER),
  native: test(prod.native, TestIds.NATIVE),
  interstitial: test(prod.interstitial, TestIds.INTERSTITIAL),
};

const launchedAt = Date.now();
let started = false;
/** Set when the app was opened by tapping a notification: no App Open ad for that start. */
let openedFromNotification = false;
export const markOpenedFromNotification = () => { openedFromNotification = true; };

export function startAds() {
  if (started || Platform.OS === 'web') return;
  started = true;
  (async () => {
    // Google UMP consent (EEA/UK users see Google's form; elsewhere it returns at once)
    try {
      await AdsConsent.gatherConsent();
    } catch {}
    await mobileAds().initialize();
    loadInterstitial();
    maybeShowAppOpen();
  })().catch(() => {});
}

// ---------------------------------------------------------------- 1. App Open (cold start)

function maybeShowAppOpen() {
  const s = useApp.getState();
  // first launch = onboarding; second+ launches only
  if (!s.onboarded || s.launches < 2 || openedFromNotification) return;
  if (Date.now() - s.lastAppOpenAd < APP_OPEN_GAP_MS) return;
  if (Date.now() - s.selfRestartAt < 60_000) return; // we just restarted for a language change
  const ad = AppOpenAd.createForAdRequest(AD_UNITS.appOpen);
  const giveUpAt = Date.now() + 6000; // a slow ad must not pop up in the middle of using the app
  ad.addAdEventListener(AdEventType.LOADED, () => {
    if (Date.now() > giveUpAt || openedFromNotification) return;
    useApp.getState().set({ lastAppOpenAd: Date.now(), lastInterstitial: Date.now() });
    ad.show().catch(() => {});
  });
  ad.addAdEventListener(AdEventType.ERROR, () => {});
  ad.load();
}

// ---------------------------------------------------------------- interstitial

let interstitial: InterstitialAd | null = null;
let interstitialReady = false;
let afterAd: (() => void) | null = null;

function loadInterstitial() {
  interstitial = InterstitialAd.createForAdRequest(AD_UNITS.interstitial);
  interstitialReady = false;
  interstitial.addAdEventListener(AdEventType.LOADED, () => { interstitialReady = true; });
  interstitial.addAdEventListener(AdEventType.CLOSED, () => {
    afterAd?.();
    afterAd = null;
    loadInterstitial();
  });
  interstitial.addAdEventListener(AdEventType.ERROR, () => {
    interstitialReady = false;
    // an ad that fails mid-show must not swallow what the user tapped
    afterAd?.();
    afterAd = null;
    setTimeout(loadInterstitial, 60_000);
  });
  interstitial.load();
}

function canShowFullScreen(): boolean {
  const now = Date.now();
  return !!interstitial && interstitialReady && now - launchedAt > LAUNCH_GRACE_MS
    && now - useApp.getState().lastInterstitial > FULLSCREEN_GAP_MS;
}

function showFullScreen(then?: () => void): boolean {
  if (!canShowFullScreen()) return false;
  useApp.getState().set({ lastInterstitial: Date.now() });
  interstitialReady = false;
  afterAd = then ?? null;
  interstitial!.show().catch(() => {
    afterAd = null;
    then?.();
    loadInterstitial();
  });
  return true;
}

// ---------------------------------------------------------------- 2. job opens (every 3rd)

let jobOpens = 0;

/**
 * Call when the user opens a job from a list. 1st + 2nd free, 3rd shows an ad, 4th + 5th free...
 * Not for opens from a notification (call nothing there).
 */
export function adOnJobOpen(then?: () => void) {
  jobOpens += 1;
  if (jobOpens >= JOB_OPENS_PER_AD && showFullScreen(then)) {
    jobOpens = 0;
    return;
  }
  then?.();
}

// ---------------------------------------------------------------- 3. Apply Now

/** Interstitial, then `then` (open the apply page). Skipped inside the 60 s floor. */
export function adOnApply(then: () => void) {
  if (!showFullScreen(then)) then();
}

// ---------------------------------------------------------------- 5. banner

export function BottomBanner() {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <View style={{ alignItems: 'center', paddingTop: 4 }}>
      <BannerAd unitId={AD_UNITS.banner} size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER} onAdFailedToLoad={() => setFailed(true)} />
    </View>
  );
}

/** Medium rectangle inside long screens (job detail, under the description). */
export function InlineBanner() {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <View style={{ alignItems: 'center', marginVertical: 12 }}>
      <BannerAd unitId={AD_UNITS.banner} size={BannerAdSize.MEDIUM_RECTANGLE} onAdFailedToLoad={() => setFailed(true)} />
    </View>
  );
}

// ---------------------------------------------------------------- 5. native (in-feed)

export function NativeAdCard() {
  const c = useTheme();
  const { t } = useI18n();
  const [ad, setAd] = useState<NativeAd | null>(null);

  useEffect(() => {
    let alive = true;
    let loaded: NativeAd | null = null;
    NativeAd.createForAdRequest(AD_UNITS.native)
      .then((a) => {
        loaded = a;
        if (alive) setAd(a);
        else a.destroy();
      })
      .catch(() => {});
    return () => {
      alive = false;
      loaded?.destroy();
    };
  }, []);

  if (!ad) return null;
  return (
    <NativeAdView nativeAd={ad} style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
      <View style={styles.row}>
        {ad.icon && (
          <NativeAsset assetType={NativeAssetType.ICON}>
            <Image source={{ uri: ad.icon.url }} style={styles.icon} />
          </NativeAsset>
        )}
        <View style={{ flex: 1 }}>
          <View style={styles.row}>
            <Text style={[styles.badge, { backgroundColor: c.gold }]}>{t('sponsored')}</Text>
            {ad.advertiser && (
              <NativeAsset assetType={NativeAssetType.ADVERTISER}>
                <Text style={[styles.adv, { color: c.faint }]} numberOfLines={1}>{ad.advertiser}</Text>
              </NativeAsset>
            )}
          </View>
          <NativeAsset assetType={NativeAssetType.HEADLINE}>
            <Text style={[styles.head, { color: c.text }]} numberOfLines={2}>{ad.headline}</Text>
          </NativeAsset>
        </View>
      </View>
      {ad.body && (
        <NativeAsset assetType={NativeAssetType.BODY}>
          <Text style={[styles.body, { color: c.sub }]} numberOfLines={2}>{ad.body}</Text>
        </NativeAsset>
      )}
      <NativeMediaView style={styles.media} resizeMode="cover" />
      {ad.callToAction && (
        <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
          <Text style={[styles.cta, { backgroundColor: c.primary }]}>{ad.callToAction}</Text>
        </NativeAsset>
      )}
    </NativeAdView>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, marginBottom: 12, borderRadius: 16, padding: 14, borderWidth: 1, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 42, height: 42, borderRadius: 10 },
  badge: { fontFamily: font.semi, fontSize: 10, color: '#1A1300', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, overflow: 'hidden' },
  adv: { fontFamily: font.regular, fontSize: 11, flex: 1 },
  head: { fontFamily: font.semi, fontSize: 14.5, marginTop: 2 },
  body: { fontFamily: font.regular, fontSize: 12.5 },
  media: { width: '100%', aspectRatio: 1.91, borderRadius: 12, overflow: 'hidden' },
  cta: { fontFamily: font.semi, color: '#fff', textAlign: 'center', paddingVertical: 10, borderRadius: 12, overflow: 'hidden' },
});
