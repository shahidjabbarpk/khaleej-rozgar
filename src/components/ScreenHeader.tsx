import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';
import { Icon, Tap } from './ui';

/** Plain top bar with a back arrow for stack screens. */
export function ScreenHeader({ title }: { title: string }) {
  const c = useTheme();
  const { t, tf, isRtl } = useI18n();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingTop: insets.top + 6, backgroundColor: c.card, borderBottomColor: c.border }]}>
      <Tap onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={styles.back} accessibilityLabel={t('back')}>
        <Icon name={isRtl ? 'arrow-right' : 'arrow-left'} size={24} color={c.text} />
      </Tap>
      <Text style={[styles.title, tf('bold'), { color: c.text }]} numberOfLines={1}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 18 },
});
