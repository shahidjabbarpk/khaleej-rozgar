import { useMemo } from 'react';
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
  // select the stable map, not Object.values (a new array per read loops zustand v5 -> crash)
  const savedMap = useApp((s) => s.saved);
  const saved = useMemo(() => Object.values(savedMap).filter((j) => j && j.id && j.title), [savedMap]);
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScreenHeader title={t('savedJobs')} />
      <JobList jobs={saved} header={<View style={{ height: 12 }} />}
        empty={<EmptyState icon="heart-outline" title={t('savedEmpty')} hint={t('savedEmptyHint')} />} />
      <BottomBanner />
    </View>
  );
}
