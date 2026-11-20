import { View } from 'react-native';
import { JobList } from '@/components/JobList';
import { ScreenHeader } from '@/components/ScreenHeader';
import { EmptyState, useStatusBar } from '@/components/ui';
import { BottomBanner } from '@/lib/ads';
import { useI18n } from '@/lib/i18n';
import { useApp } from '@/lib/store';
import { useTheme } from '@/lib/theme';

export default function Saved() {
  useStatusBar('plain');
  const c = useTheme();
  const { t } = useI18n();
  const saved = useApp((s) => Object.values(s.saved));
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScreenHeader title={t('savedJobs')} />
      <JobList jobs={saved} header={<View style={{ height: 12 }} />}
        empty={<EmptyState icon="heart-outline" title={t('savedEmpty')} hint={t('savedEmptyHint')} />} />
      <BottomBanner />
    </View>
  );
}
