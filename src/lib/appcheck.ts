/**
 * Firebase App Check (Play Integrity): proves Worker /found calls come from our real app on a real phone.
 * The Worker only enforces it once REQUIRE_APP_CHECK = "true" (after the Play listing is linked in
 * Firebase console -> App Check). Until then a missing token is fine.
 */
let started = false;

export function startAppCheck() {
  if (started) return;
  started = true;
  try {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { getApp } = require('@react-native-firebase/app');
    const ac = require('@react-native-firebase/app-check');
    const provider = new ac.ReactNativeFirebaseAppCheckProvider();
    provider.configure({ android: { provider: __DEV__ ? 'debug' : 'playIntegrity' } });
    Promise.resolve(ac.initializeAppCheck(getApp(), { provider, isTokenAutoRefreshEnabled: true })).catch(() => {});
  } catch {
    /* App Check unavailable - the app keeps working */
  }
}
