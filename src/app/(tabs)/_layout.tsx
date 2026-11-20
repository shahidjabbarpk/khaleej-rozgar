import { router, Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Icon, type IconName, TAB_BAR_H, Tap, useBottomInset } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import type { Key } from '@/lib/lang/en';
import { useApp } from '@/lib/store';
import { font, useTheme } from '@/lib/theme';

type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const TABS: { name: string; icon: IconName; active: IconName; label: Key }[] = [
  { name: 'index', icon: 'briefcase-search-outline', active: 'briefcase-search', label: 'tabJobs' },
  { name: 'govt', icon: 'bank-outline', active: 'bank', label: 'tabGovt' },
  { name: 'post', icon: 'plus', active: 'plus', label: 'tabPost' },
  { name: 'alerts', icon: 'bell-outline', active: 'bell', label: 'tabAlerts' },
  { name: 'me', icon: 'account-circle-outline', active: 'account-circle', label: 'tabMe' },
];

function TabBar({ state, navigation }: BottomTabBarProps) {
  const c = useTheme();
  const { t, tf } = useI18n();
  const bottom = useBottomInset();
  const unread = useApp((s) => s.alertHistory.filter((a) => a.at > s.alertsSeenAt).length);
  const current = state.routes[state.index]?.name;

  return (
    <View style={[styles.bar, { backgroundColor: c.card, borderTopColor: c.border, paddingBottom: bottom, height: TAB_BAR_H + bottom }]}>
      {TABS.map((tab) => {
        const focused = tab.name === current;
        if (tab.name === 'post') {
          return (
            <Tap key={tab.name} style={styles.tab} onPress={() => router.push('/post')} accessibilityLabel={t('tabPost')}>
              <View style={[styles.plus, { backgroundColor: c.primary, shadowColor: c.primary }]}>
                <Icon name="plus" size={30} color="#fff" />
              </View>
            </Tap>
          );
        }
        const badge = tab.name === 'alerts' ? unread : 0;
        return (
          <Tap key={tab.name} style={styles.tab} onPress={() => !focused && navigation.navigate(tab.name)} accessibilityLabel={t(tab.label)}>
            <View>
              <Icon name={focused ? tab.active : tab.icon} size={25} color={focused ? c.primary : c.faint} />
              {badge > 0 && (
                <View style={[styles.count, { backgroundColor: c.danger, borderColor: c.card }]}>
                  <Text style={styles.countText}>{badge > 99 ? '99' : badge}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.label, tf(focused ? 'bold' : 'regular'), { color: focused ? c.primary : c.sub }]} numberOfLines={1}>
              {t(tab.label)}
            </Text>
          </Tap>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs tabBar={(p) => <TabBar {...p} />} screenOptions={{ headerShown: false, animation: 'shift' }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="govt" />
      <Tabs.Screen name="alerts" />
      <Tabs.Screen name="me" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 6 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, minHeight: 48 },
  plus: {
    width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', marginTop: -18,
    shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  label: { fontSize: 11.5 },
  count: { position: 'absolute', top: -5, right: -11, minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', borderWidth: 2, paddingHorizontal: 3 },
  countText: { color: '#fff', fontSize: 9.5, fontFamily: font.bold },
});
