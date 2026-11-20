import { useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Icon, useStatusBar } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';

/** Text pages: /safety and /about redirect here (see safety.tsx / about.tsx). */
export function InfoPage({ kind }: { kind: 'safety' | 'about' }) {
  useStatusBar('plain');
  const c = useTheme();
  const { t, tf } = useI18n();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScreenHeader title={t(kind === 'safety' ? 'safetyTips' : 'about')} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        <View style={[styles.card, { backgroundColor: kind === 'safety' ? c.dangerSoft : c.primarySoft }]}>
          <Icon name={kind === 'safety' ? 'shield-alert' : 'information'} size={34} color={kind === 'safety' ? c.danger : c.primary} />
          <Text style={[tf('bold'), { color: c.text, fontSize: 16, flex: 1 }]}>{t(kind === 'safety' ? 'scamBanner' : 'appName')}</Text>
        </View>
        <Text style={[tf(), styles.body, { color: c.text }]}>{t(kind === 'safety' ? 'safetyBody' : 'aboutBody')}</Text>
        {kind === 'about' && <Text style={[tf(), styles.body, { color: c.sub }]}>{t('govtDisclaimer')}</Text>}
      </ScrollView>
    </View>
  );
}

export default function Info() {
  const { kind } = useLocalSearchParams<{ kind?: string }>();
  return <InfoPage kind={kind === 'about' ? 'about' : 'safety'} />;
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 16 },
  body: { fontSize: 16, lineHeight: 26 },
});
