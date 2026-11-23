import '@/lib/background'; // defines the background task at module scope
import { NotoNaskhArabic_400Regular, NotoNaskhArabic_700Bold } from '@expo-google-fonts/noto-naskh-arabic';
import { NotoNastaliqUrdu_400Regular, NotoNastaliqUrdu_700Bold } from '@expo-google-fonts/noto-nastaliq-urdu';
import { NotoSansBengali_400Regular, NotoSansBengali_700Bold } from '@expo-google-fonts/noto-sans-bengali';
import { NotoSansDevanagari_400Regular, NotoSansDevanagari_700Bold } from '@expo-google-fonts/noto-sans-devanagari';
import { Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold, useFonts } from '@expo-google-fonts/poppins';
import * as Notifications from 'expo-notifications';
import { router, Stack, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { markOpenedFromNotification, startAds } from '@/lib/ads';
import { startAppCheck } from '@/lib/appcheck';
import { track } from '@/lib/analytics';
import { registerBackgroundDetector } from '@/lib/background';
import { isAdmin } from '@/lib/community';
import { refreshJobs } from '@/lib/feed';
import { syncDirection } from '@/lib/i18n';
import { setupNotifications } from '@/lib/notify';
import { listenForegroundPushes, syncTopics } from '@/lib/push';
import { useApp, waitForHydration } from '@/lib/store';
import { useTheme } from '@/lib/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

let lastOpened = '';

/** Notification tap -> job detail (deep link). No ad on that open. */
function openFromData(data: Record<string, unknown> | undefined) {
  if (!data) return;
  const jobId = typeof data.jobId === 'string' ? data.jobId : null;
  const key = jobId ?? String(data.screen ?? '');
  if (!key || key === lastOpened) return;
  lastOpened = key;
  setTimeout(() => { lastOpened = ''; }, 4000);
  markOpenedFromNotification();
  track('notification_open', { kind: jobId ? 'job' : 'other' });
  if (jobId) router.push(`/job/${jobId}`);
  else if (typeof data.screen === 'string' && data.screen !== '/') router.push(data.screen as never);
}

function useNotificationTaps() {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const onResponse = (r: Notifications.NotificationResponse | null) => {
      if (!r) return;
      Notifications.clearLastNotificationResponse();
      openFromData(r.notification.request.content.data as Record<string, unknown>);
    };
    Notifications.getLastNotificationResponseAsync().then(onResponse).catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener(onResponse);
    // FCM pushes tapped while the app was in the background / closed
    let unsub = () => {};
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const m = require('@react-native-firebase/messaging');
      const msg = m.getMessaging();
      m.getInitialNotification(msg).then((n: { data?: Record<string, unknown> } | null) => openFromData(n?.data)).catch(() => {});
      unsub = m.onNotificationOpenedApp(msg, (n: { data?: Record<string, unknown> }) => openFromData(n?.data));
    } catch {}
    const fg = listenForegroundPushes();
    return () => {
      sub.remove();
      unsub();
      fg();
    };
  }, []);
}

export default function RootLayout() {
  const c = useTheme();
  const [loaded] = useFonts({
    Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold,
    NotoNastaliqUrdu_400Regular, NotoNastaliqUrdu_700Bold,
    NotoNaskhArabic_400Regular, NotoNaskhArabic_700Bold,
    NotoSansDevanagari_400Regular, NotoSansDevanagari_700Bold,
    NotoSansBengali_400Regular, NotoSansBengali_700Bold,
  });
  useNotificationTaps();

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(c.bg).catch(() => {});
  }, [c.bg]);
  useEffect(() => {
    if (loaded) SplashScreen.hideAsync().catch(() => {});
  }, [loaded]);

  const [hydrated, setHydrated] = useState(useApp.persist.hasHydrated());
  const onboarded = useApp((s) => s.onboarded);
  const segments = useSegments();

  useEffect(() => {
    waitForHydration().then(() => {
      const s = useApp.getState();
      syncDirection(s.lang);
      s.set({ launches: s.launches + 1 });
      setHydrated(true);
      refreshJobs().catch(() => {});
      isAdmin().then((admin) => useApp.getState().set({ admin })).catch(() => {});
      if (Platform.OS === 'web') return;
      startAppCheck();
      startAds();
      if (!s.onboarded) return; // onboarding asks for the permission itself
      setupNotifications(false)
        .catch(() => false)
        .then(() => syncTopics())
        .then(() => registerBackgroundDetector())
        .catch(() => {});
    });
  }, []);

  const ready = loaded && hydrated;
  useEffect(() => {
    if (ready && !onboarded && segments[0] !== 'onboarding') router.replace('/onboarding');
  }, [ready, onboarded, segments]);

  if (!ready) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg }, animation: 'slide_from_right' }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="job/[id]" options={{ animation: 'fade_from_bottom' }} />
        <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
        <Stack.Screen name="post" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="post-job" />
        <Stack.Screen name="post-seeker" />
        <Stack.Screen name="my-posts" />
        <Stack.Screen name="admin" />
        <Stack.Screen name="saved" />
        <Stack.Screen name="cv" />
        <Stack.Screen name="info" />
        <Stack.Screen name="verify" />
      </Stack>
    </GestureHandlerRootView>
  );
}
