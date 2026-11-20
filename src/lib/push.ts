/**
 * FCM topics (free, unlimited): every device subscribes to the topics of its country + categories,
 * so a new job reaches ALL users the moment the feed builder or the Worker pushes it.
 * Re-run syncTopics() whenever country / categories / switches change.
 */
import { getMessaging, onMessage, subscribeToTopic, unsubscribeFromTopic } from '@react-native-firebase/messaging';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { useApp } from './store';
import { topicsFor } from './topics';

let syncing: Promise<void> | null = null;

export function syncTopics(): Promise<void> {
  syncing ??= (async () => {
    const s = useApp.getState();
    const want = new Set(topicsFor({ notify: s.notify, notifyGovt: s.notifyGovt, country: s.country, categories: s.alertCategories }));
    const have = new Set(s.subscribedTopics);
    const m = getMessaging();
    const done = new Set(have);
    for (const t of have) {
      if (want.has(t)) continue;
      try {
        await unsubscribeFromTopic(m, t);
        done.delete(t);
      } catch {}
    }
    for (const t of want) {
      if (have.has(t)) continue;
      try {
        await subscribeToTopic(m, t);
        done.add(t);
      } catch {}
    }
    useApp.getState().set({ subscribedTopics: [...done] });
  })().finally(() => {
    syncing = null;
  });
  return syncing;
}

/** A push that arrives while the app is open: show it like any other alert + keep it in Alerts history. */
export function listenForegroundPushes(): () => void {
  if (Platform.OS === 'web') return () => {};
  return onMessage(getMessaging(), async (msg) => {
    const title = msg.notification?.title ?? '';
    const body = msg.notification?.body ?? '';
    if (!title) return;
    const jobId = typeof msg.data?.jobId === 'string' ? msg.data.jobId : undefined;
    useApp.getState().addAlert({ id: msg.messageId ?? `${Date.now()}`, title, body, jobId, at: Date.now() });
    await Notifications.scheduleNotificationAsync({
      content: { title, body, data: msg.data ?? {} },
      trigger: Platform.OS === 'android' ? { channelId: msg.notification?.android?.channelId ?? 'new-jobs' } : null,
    }).catch(() => {});
  });
}
