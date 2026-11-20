import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from '@/components/community';
import { JobCard } from '@/components/JobCard';
import { ScreenHeader } from '@/components/ScreenHeader';
import { EmptyState, Icon, Tap, useStatusBar } from '@/components/ui';
import { WorkerCard } from '@/components/WorkerCard';
import { communityReady, deletePost, deleteSeeker, fetchMyPosts, fetchMySeekers, renewPost } from '@/lib/community';
import { prettyDate } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';
import type { Job, Seeker } from '@/lib/types';

export default function MyPosts() {
  useStatusBar('plain');
  const c = useTheme();
  const { t, tf } = useI18n();
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [seekers, setSeekers] = useState<Seeker[]>([]);

  const load = useCallback(() => {
    if (!communityReady()) return setJobs([]);
    fetchMyPosts().then(setJobs).catch(() => setJobs([]));
    fetchMySeekers().then(setSeekers).catch(() => {});
  }, []);
  useFocusEffect(load);

  const confirmDelete = (fn: () => Promise<void>) => Alert.alert(t('deleteConfirm'), '', [
    { text: t('cancel'), style: 'cancel' },
    { text: t('delete'), style: 'destructive', onPress: () => fn().then(load).catch(() => {}) },
  ]);

  const empty = jobs && !jobs.length && !seekers.length;
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScreenHeader title={t('myPosts')} />
      <ScrollView contentContainerStyle={{ paddingVertical: 14, paddingBottom: 40 }}>
        {empty && (
          <>
            <EmptyState icon="briefcase-plus-outline" title={t('myPostsEmpty')} hint="" />
            <View style={{ marginHorizontal: 16 }}><PrimaryButton label={t('tabPost')} icon="plus" onPress={() => router.replace('/post')} /></View>
          </>
        )}
        {jobs?.map((j) => (
          <View key={j.id}>
            <JobCard job={j} />
            <View style={[styles.bar, { borderColor: c.border }]}>
              {j.status === 'hidden' ? (
                <Text style={[tf(), styles.meta, { color: c.danger }]}>{t('hiddenByReports')}</Text>
              ) : (
                <Text style={[tf(), styles.meta, { color: c.sub }]}>{t('expires')}: {j.expiresAt ? prettyDate(new Date(j.expiresAt).toISOString()) : '—'}</Text>
              )}
              <Tap onPress={() => router.push({ pathname: '/post-job', params: { edit: j.id } })} style={styles.btn}>
                <Icon name="pencil" size={20} color={c.primary} />
              </Tap>
              <Tap onPress={() => renewPost(j.id).then(load).catch(() => {})} style={styles.btn} accessibilityLabel={t('renew')}>
                <Icon name="refresh" size={20} color={c.primary} />
              </Tap>
              <Tap onPress={() => confirmDelete(() => deletePost(j.id))} style={styles.btn} accessibilityLabel={t('delete')}>
                <Icon name="delete-outline" size={20} color={c.danger} />
              </Tap>
            </View>
          </View>
        ))}
        {seekers.map((s) => (
          <View key={s.id}>
            <WorkerCard seeker={s} />
            <View style={[styles.bar, { borderColor: c.border }]}>
              <View style={{ flex: 1 }} />
              <Tap onPress={() => confirmDelete(() => deleteSeeker(s.id))} style={styles.btn} accessibilityLabel={t('delete')}>
                <Icon name="delete-outline" size={20} color={c.danger} />
              </Tap>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: -6, marginBottom: 14, gap: 4 },
  meta: { flex: 1, fontSize: 12.5 },
  btn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
