import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Icon, type IconName, Tap, useStatusBar } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import type { Key } from '@/lib/lang/en';
import { useTheme } from '@/lib/theme';

/** "+" tab: choose what to post. Big, simple buttons. */
export default function PostChooser() {
  useStatusBar('plain');
  const c = useTheme();
  const { t, tf } = useI18n();
  const items: { icon: IconName; title: Key; hint: Key; href: '/post-job' | '/post-seeker'; color: string }[] = [
    { icon: 'briefcase-plus', title: 'postJob', hint: 'postJobHint', href: '/post-job', color: c.primary },
    { icon: 'account-search', title: 'needJob', hint: 'needJobHint', href: '/post-seeker', color: '#B45309' },
  ];
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScreenHeader title={t('postTitle')} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        {items.map((it) => (
          <Tap key={it.href} onPress={() => router.push(it.href)} style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={[styles.icon, { backgroundColor: it.color }]}><Icon name={it.icon} size={34} color="#fff" /></View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, tf('bold'), { color: c.text }]}>{t(it.title)}</Text>
              <Text style={[styles.hint, tf(), { color: c.sub }]}>{t(it.hint)}</Text>
            </View>
            <Icon name="chevron-right" size={26} color={c.faint} />
          </Tap>
        ))}
        <View style={[styles.warn, { backgroundColor: c.dangerSoft }]}>
          <Icon name="shield-alert" size={20} color={c.danger} />
          <Text style={[tf(), { color: c.text, flex: 1, fontSize: 13.5, lineHeight: 20 }]}>{t('scamBanner')}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 18, borderRadius: 18, borderWidth: 1, minHeight: 104 },
  icon: { width: 64, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 19 },
  hint: { fontSize: 14, marginTop: 2 },
  warn: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: 14 },
});
