import { FlatList, type ListRenderItem, View } from 'react-native';
import { type ReactElement, useMemo } from 'react';
import { NativeAdCard } from '@/lib/ads';
import { NATIVE_AD_EVERY } from '@/lib/config';
import type { Job } from '@/lib/types';
import { JobCard } from './JobCard';
import { brandRefreshControl, JobCardSkeleton, useTabBarSpace } from './ui';

type Row = { type: 'job'; job: Job } | { type: 'ad'; key: string };

/** Job list with a native ad card after every NATIVE_AD_EVERY jobs (clearly marked "Ad"). */
export function JobList({ jobs, header, footer, empty, refreshing, onRefresh, loading }: {
  jobs: Job[];
  header?: ReactElement;
  footer?: ReactElement;
  empty?: ReactElement;
  refreshing?: boolean;
  onRefresh?: () => void;
  loading?: boolean;
}) {
  const space = useTabBarSpace();
  const rows = useMemo(() => {
    const out: Row[] = [];
    jobs.forEach((job, i) => {
      out.push({ type: 'job', job });
      if ((i + 1) % NATIVE_AD_EVERY === 0) out.push({ type: 'ad', key: `ad-${i}` });
    });
    return out;
  }, [jobs]);

  const render: ListRenderItem<Row> = ({ item }) => (item.type === 'job' ? <JobCard job={item.job} /> : <NativeAdCard />);

  return (
    <FlatList
      data={rows}
      keyExtractor={(r) => (r.type === 'job' ? r.job.id : r.key)}
      renderItem={render}
      ListHeaderComponent={header}
      ListFooterComponent={footer}
      ListEmptyComponent={loading ? <View>{[0, 1, 2].map((i) => <JobCardSkeleton key={i} />)}</View> : empty}
      contentContainerStyle={{ paddingBottom: space }}
      refreshControl={onRefresh ? brandRefreshControl(!!refreshing, onRefresh) : undefined}
      initialNumToRender={8}
      windowSize={9}
      removeClippedSubviews
      keyboardShouldPersistTaps="handled"
    />
  );
}
