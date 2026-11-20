import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { deadlineMs } from './format';
import { translate } from './i18n';
import { jobInArea } from './places';
import { useApp } from './store';
import type { Job } from './types';

export const CHANNEL = 'new-jobs';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function createChannels() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: 'New jobs', importance: Notifications.AndroidImportance.HIGH, vibrationPattern: [0, 220, 120, 220], lightColor: '#0B6E4F',
  });
  await Notifications.setNotificationChannelAsync('govt-jobs', {
    name: 'Government jobs', importance: Notifications.AndroidImportance.HIGH, lightColor: '#0B6E4F',
  });
  await Notifications.setNotificationChannelAsync('my-posts', { name: 'My posts', importance: Notifications.AndroidImportance.DEFAULT });
  await Notifications.setNotificationChannelAsync('reminders', { name: 'Deadline reminders', importance: Notifications.AndroidImportance.HIGH });
}

export async function notificationsAllowed(): Promise<boolean> {
  try {
    return (await Notifications.getPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

/**
 * Alerts are ON by default. On Android 13+ the system still needs POST_NOTIFICATIONS: we ask once,
 * on the first launch (onboarding "Turn on job alerts"). Below Android 13 this returns true at once.
 * If the user says no we never ask again - the Alerts tab shows a small "Turn on" banner instead.
 */
export async function setupNotifications(ask: boolean): Promise<boolean> {
  await createChannels().catch(() => {});
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  if (!ask || !cur.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

/** Only what the user wants: country/city, category, govt switch. */
export function matchesAlerts(job: Job): boolean {
  const { alertCategories, country, city, notifyGovt } = useApp.getState();
  if (!jobInArea(job, country, city)) return false;
  if (job.sector === 'govt') return notifyGovt;
  return alertCategories.includes(job.category);
}

/**
 * Local alerts for jobs this phone found itself (background task). Jobs from the hourly feed /
 * the Worker arrive as FCM topic pushes instead, so `skip` holds those ids to avoid doubles.
 */
export async function notifyNewJobs(jobs: Job[], skip: Set<string> = new Set()): Promise<void> {
  const { notify, lang, addAlert } = useApp.getState();
  if (!notify) return;
  const wanted = jobs.filter((j) => matchesAlerts(j) && !skip.has(j.id));
  if (!wanted.length || !(await notificationsAllowed())) return;
  const channelId = (j: Job) => (j.sector === 'govt' ? 'govt-jobs' : CHANNEL);
  if (wanted.length <= 3) {
    for (const j of wanted) {
      const title = `🆕 ${j.title}`;
      const body = `${j.organization}${j.cities[0] ? ` • ${j.cities[0]}` : ''}`;
      addAlert({ id: j.id, title, body, jobId: j.id, at: Date.now() });
      await Notifications.scheduleNotificationAsync({
        content: { title, body, data: { jobId: j.id } },
        trigger: Platform.OS === 'android' ? { channelId: channelId(j) } : null,
      });
    }
  } else {
    const title = `🔔 ${wanted.length} ${translate(lang, 'notifTitleMany')}`;
    const body = wanted.slice(0, 4).map((j) => `• ${j.title}`).join('\n');
    addAlert({ id: `many-${Date.now()}`, title, body, at: Date.now() });
    await Notifications.scheduleNotificationAsync({
      content: { title, body, data: { screen: '/' } },
      trigger: Platform.OS === 'android' ? { channelId: CHANNEL } : null,
    });
  }
}

/** Local reminders at 9 AM Gulf time, 3 days and 1 day before the last date. False if both are past. */
export async function scheduleDeadlineReminder(job: Job): Promise<boolean> {
  const end = deadlineMs(job);
  if (end == null || !useApp.getState().notifyReminders) return false;
  await cancelReminder(job.id);
  const { lang } = useApp.getState();
  const ids: string[] = [];
  for (const days of [3, 1]) {
    const at = new Date(Date.parse(`${job.lastDate}T09:00:00+03:00`) - days * 86_400_000);
    if (at.getTime() < Date.now() + 60_000) continue;
    ids.push(await Notifications.scheduleNotificationAsync({
      content: {
        title: days === 1 ? `⏰ ${translate(lang, 'reminderTitle')}` : `⏳ ${days} ${translate(lang, 'daysLeft')}`,
        body: `${job.title} — ${job.organization}`,
        data: { jobId: job.id },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: 'reminders' },
    }));
  }
  if (!ids.length) return false;
  const { reminders, set } = useApp.getState();
  set({ reminders: { ...reminders, [job.id]: ids.join(',') } });
  return true;
}

export async function cancelReminder(jobId: string) {
  const { reminders, set } = useApp.getState();
  const stored = reminders[jobId];
  if (!stored) return;
  for (const id of stored.split(',')) await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
  const next = { ...reminders };
  delete next[jobId];
  set({ reminders: next });
}
