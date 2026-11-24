import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { JobCard } from '@/components/JobCard';
import { ScreenHeader } from '@/components/ScreenHeader';
import { confirmAction, EmptyState, SectionTitle, Tap, useStatusBar } from '@/components/ui';
import { banUser, dismissReport, fetchHidden, fetchReports, moderatePost } from '@/lib/community';
import { useI18n } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';
import type { Job, Report } from '@/lib/types';

/** Admin only (admins/{uid} doc). Review auto-hidden posts and reports. */
export default function Admin() {
  useStatusBar('plain');
  const c = useTheme();
  const { t, tf } = useI18n();
  const [hidden, setHidden] = useState<Job[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const load = useCallback(() => {
    fetchHidden().then(setHidden).catch(() => {});
    fetchReports().then(setReports).catch(() => {});
  }, []);
  useFocusEffect(load);

  const Btn = ({ label, onPress, color }: { label: string; onPress: () => void; color: string }) => (
    <Tap onPress={onPress} style={[styles.btn, { borderColor: color }]}>
      <Text style={[tf('bold'), { color, fontSize: 13 }]}>{label}</Text>
    </Tap>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScreenHeader title={t('adminTitle')} />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <SectionTitle title={`${t('hiddenPosts')} (${hidden.length})`} />
        {!hidden.length && <EmptyState icon="check-all" title={t('nothingHere')} hint="" />}
        {hidden.map((j) => (
          <View key={j.id}>
            <JobCard job={j} />
            <View style={styles.row}>
              <Btn label={t('restore')} color={c.ok} onPress={() => moderatePost(j.id, 'active').then(load)} />
              <Btn label={t('delete')} color={c.danger} onPress={() => confirmAction(t('deleteConfirm'), t('delete'), t('cancel'), () => { moderatePost(j.id, 'expired').then(load).catch(() => {}); })} />
              {!!j.ownerUid && <Btn label={t('ban')} color={c.danger} onPress={() => confirmAction(t('banConfirm'), t('ban'), t('cancel'), () => { banUser(j.ownerUid!).then(load).catch(() => {}); })} />}
            </View>
          </View>
        ))}
        <SectionTitle title={`${t('reports')} (${reports.length})`} />
        {reports.map((r) => (
          <View key={r.id} style={[styles.rep, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={[tf('bold'), { color: c.text }]}>{r.kind} • {r.reason}</Text>
            <Text style={{ color: c.sub, fontSize: 12 }}>{r.postId} • {new Date(r.createdAt).toLocaleString()}</Text>
            <View style={styles.row}><Btn label={t('dismiss')} color={c.sub} onPress={() => dismissReport(r.id).then(load)} /></View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginBottom: 14 },
  btn: { paddingHorizontal: 14, height: 40, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  rep: { marginHorizontal: 16, marginBottom: 10, padding: 12, borderRadius: 12, borderWidth: 1, gap: 4 },
});
