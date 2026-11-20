import { useFocusEffect, router } from 'expo-router';
import { useCallback, useState } from 'react';
import { AppState, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SwitchRow } from '@/components/SwitchRow';
import { Hero } from '@/components/Header';
import { EmptyState, Icon, type IconName, SectionTitle, Tap, useStatusBar } from '@/components/ui';
import { BottomBanner } from '@/lib/ads';
import { track } from '@/lib/analytics';
import { useI18n } from '@/lib/i18n';
import { notificationsAllowed, setupNotifications } from '@/lib/notify';
import { syncTopics } from '@/lib/push';
import { ALL_CATEGORIES, useApp } from '@/lib/store';
import { CATEGORY_META, font, useTheme } from '@/lib/theme';
import type { Category } from '@/lib/types';

const ago = (ms: number) => {
  const m = Math.round((Date.now() - ms) / 60000);
  if (m < 60) return `${Math.max(1, m)}m`;
  if (m < 1440) return `${Math.round(m / 60)}h`;
  return `${Math.round(m / 1440)}d`;
};

export default function Alerts() {
  useStatusBar('hero');
  const c = useTheme();
  const { t, tf } = useI18n();
  const history = useApp((s) => s.alertHistory);
  const notify = useApp((s) => s.notify);
  const notifyGovt = useApp((s) => s.notifyGovt);
  const cats = useApp((s) => s.alertCategories);
  const set = useApp((s) => s.set);
  const [allowed, setAllowed] = useState(true);

  const check = useCallback(() => {
    notificationsAllowed().then(setAllowed).catch(() => {});
  }, []);
  useFocusEffect(useCallback(() => {
    check();
    set({ alertsSeenAt: Date.now() });
    // coming back from the system settings screen
    const sub = AppState.addEventListener('change', (st) => st === 'active' && check());
    return () => sub.remove();
  }, [check, set]));

  const turnOn = async () => {
    // asks once if Android still allows it, otherwise opens the app's notification settings
    if (await setupNotifications(true)) {
      setAllowed(true);
      track('alert_setup', { where: 'alerts_tab' });
    } else Linking.openSettings().catch(() => {});
  };
  const toggleCat = (k: Category) => {
    set({ alertCategories: cats.includes(k) ? cats.filter((x) => x !== k) : [...cats, k] });
    syncTopics().catch(() => {});
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 16 }}>
        <Hero title={t('alertsTitle')} />
        {(!allowed || !notify) && (
          <View style={[styles.off, { backgroundColor: c.card, borderColor: c.warn }]}>
            <Icon name="bell-off" size={26} color={c.warn} />
            <View style={{ flex: 1 }}>
              <Text style={[tf('bold'), { color: c.text, fontSize: 15 }]}>{t('alertsOff')}</Text>
              <Text style={[tf(), { color: c.sub, fontSize: 13 }]}>{t('alertsOffHint')}</Text>
            </View>
            <Tap onPress={() => { if (!notify) { set({ notify: true }); syncTopics().catch(() => {}); } turnOn(); }}
              style={[styles.onBtn, { backgroundColor: c.primary }]}>
              <Text style={[tf('bold'), { color: '#fff', fontSize: 14 }]}>{t('turnOn')}</Text>
            </Tap>
          </View>
        )}

        <SectionTitle title={t('recentAlerts')} />
        {history.length ? history.slice(0, 40).map((a) => (
          <Tap key={a.id} onPress={() => a.jobId && router.push(`/job/${a.jobId}`)}
            style={[styles.item, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={[styles.dot, { backgroundColor: c.primarySoft }]}><Icon name="briefcase" size={18} color={c.primary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.itemTitle, { color: c.text }]} numberOfLines={2}>{a.title}</Text>
              <Text style={[styles.itemBody, { color: c.sub }]} numberOfLines={2}>{a.body}</Text>
            </View>
            <Text style={[styles.time, { color: c.faint }]}>{ago(a.at)}</Text>
          </Tap>
        )) : <EmptyState icon="bell-outline" title={t('noAlerts')} hint={t('noAlertsHint')} />}

        <SectionTitle title={t('alertSettings')} />
        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
          <SwitchRow icon="bell-ring" label={t('newJobAlerts')} value={notify}
            onChange={(v) => { set({ notify: v }); syncTopics().catch(() => {}); }} />
          <SwitchRow icon="bank" label={t('govtJobAlerts')} value={notifyGovt}
            onChange={(v) => { set({ notifyGovt: v }); syncTopics().catch(() => {}); }} />
        </View>
        <Text style={[styles.sub, tf('bold'), { color: c.sub }]}>{t('alertCategories')}</Text>
        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
          {ALL_CATEGORIES.map((k) => (
            <SwitchRow key={k} icon={CATEGORY_META[k].icon as IconName} label={t(`cat.${k}`)} value={cats.includes(k)} onChange={() => toggleCat(k)} />
          ))}
        </View>
      </ScrollView>
      <BottomBanner />
    </View>
  );
}

const styles = StyleSheet.create({
  off: { flexDirection: 'row', alignItems: 'center', gap: 12, margin: 16, marginBottom: 0, padding: 14, borderRadius: 16, borderWidth: 1.5 },
  onBtn: { paddingHorizontal: 14, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  item: { flexDirection: 'row', gap: 12, alignItems: 'center', marginHorizontal: 16, marginBottom: 8, padding: 12, borderRadius: 14, borderWidth: 1 },
  dot: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  itemTitle: { fontFamily: font.semi, fontSize: 14.5 },
  itemBody: { fontFamily: font.regular, fontSize: 13 },
  time: { fontFamily: font.medium, fontSize: 11.5 },
  card: { marginHorizontal: 16, borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 4 },
  sub: { marginHorizontal: 18, marginTop: 16, marginBottom: 8, fontSize: 13 },
});
