import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '@/lib/i18n';
import { COUNTRIES, COUNTRY_META, countryName } from '@/lib/places';
import { useApp } from '@/lib/store';
import { useTheme } from '@/lib/theme';
import { syncTopics } from '@/lib/push';
import { Dropdown } from './Dropdown';

/** Gradient header used by the tab screens. */
export function Hero({ title, subtitle, right, children }: { title: string; subtitle?: string; right?: ReactNode; children?: ReactNode }) {
  const c = useTheme();
  const { tf } = useI18n();
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient colors={[c.heroA, c.heroB]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={[styles.hero, { paddingTop: insets.top + 10 }]}>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, tf('bold')]} numberOfLines={2}>{title}</Text>
          {!!subtitle && <Text style={[styles.sub, tf()]} numberOfLines={2}>{subtitle}</Text>}
        </View>
        {right}
      </View>
      {children}
    </LinearGradient>
  );
}

/** Country picker shown as a flag button in the header (also changes the alert topics). */
export function CountryButton() {
  const { t, lang } = useI18n();
  const country = useApp((s) => s.country);
  const set = useApp((s) => s.set);
  return (
    <Dropdown
      label={t('country')}
      icon="earth"
      value={country}
      allLabel={`🌍 ${t('allGulf')}`}
      options={COUNTRIES.map((cc) => ({ value: cc, label: `${COUNTRY_META[cc].flag}  ${countryName(cc, lang)}` }))}
      onChange={(v) => {
        set({ country: (v as typeof country) ?? null, city: null });
        syncTopics().catch(() => {});
      }}
      light
    />
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: 16, paddingBottom: 14, borderBottomLeftRadius: 22, borderBottomRightRadius: 22 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { color: '#fff', fontSize: 21 },
  sub: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 2 },
});
