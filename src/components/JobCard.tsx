import { router } from 'expo-router';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { adOnJobOpen } from '@/lib/ads';
import { ago, isNew, prettyDate } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { jobSaveToggled } from '@/lib/engagement';
import { COUNTRY_META } from '@/lib/places';
import { useApp } from '@/lib/store';
import { font, useTheme } from '@/lib/theme';
import type { Job } from '@/lib/types';
import { BookmarkButton, CategoryPill, DeadlineBadge, EligibilityTag, Icon, NewBadge, OrgAvatar, Tag, Tap } from './ui';

function JobCardBase({ job }: { job: Job }) {
  const c = useTheme();
  const { t, tf } = useI18n();
  const saved = useApp((s) => !!s.saved[job.id]);
  const toggleSave = useApp((s) => s.toggleSave);
  const place = [COUNTRY_META[job.country]?.flag, job.cities.slice(0, 2).join(', ') || COUNTRY_META[job.country]?.en]
    .filter(Boolean).join(' ');

  return (
    <Tap
      haptic={false}
      scaleTo={0.98}
      // every 3rd job opened from a list shows an interstitial first (lib/ads.tsx)
      onPress={() => adOnJobOpen(() => router.push(`/job/${job.id}`))}
      style={[styles.card, { backgroundColor: c.card, borderColor: job.verified ? c.gold : c.border, shadowColor: c.shadow },
        c.dark && styles.cardDark]}
    >
      <View style={styles.top}>
        <OrgAvatar job={job} />
        <View style={{ flex: 1, gap: 2 }}>
          <View style={styles.pills}>
            {job.sector === 'govt' ? (
              <View style={[styles.govt, { backgroundColor: c.primarySoft }]}>
                <Icon name="bank" size={11} color={c.primary} />
                <Text style={[styles.govtText, tf('bold'), { color: c.primary }]}>{t('govtJob')}</Text>
              </View>
            ) : <CategoryPill category={job.category} />}
            {job.source === 'user' && (
              <View style={[styles.govt, { backgroundColor: c.cardAlt }]}>
                <Icon name="account-edit" size={11} color={c.sub} />
                <Text style={[styles.govtText, tf('bold'), { color: c.sub }]}>{t('userPost')}</Text>
              </View>
            )}
            {isNew(job) && <NewBadge />}
          </View>
          <Text style={[styles.title, { color: c.text }]} numberOfLines={2}>{job.title}</Text>
          <View style={styles.orgRow}>
            <Text style={[styles.org, { color: c.sub }]} numberOfLines={1}>{job.organization}</Text>
            {job.verified && <Icon name="check-decagram" size={14} color={c.gold} />}
          </View>
        </View>
        <BookmarkButton active={saved} onPress={() => jobSaveToggled(job, toggleSave(job))} />
      </View>

      <View style={styles.tags}>
        <Tag icon="map-marker-outline" label={place} />
        <EligibilityTag job={job} />
        {!!job.salary && <Tag icon="cash" label={job.salary} tint={c.ok} />}
        {!!job.jobType && <Tag icon="clock-outline" label={job.jobType} />}
      </View>

      <View style={[styles.divider, { backgroundColor: c.border }]} />
      <View style={styles.bottom}>
        {job.lastDate ? <DeadlineBadge job={job} /> : (
          <Text style={[styles.date, { color: c.faint }]}>{t('posted')} {ago(job)}</Text>
        )}
        <Text style={[styles.date, { color: c.faint }]}>
          {job.lastDate ? `${t('lastDate')}: ${prettyDate(job.lastDate)}` : t(`src.${job.source}`)}
        </Text>
      </View>
    </Tap>
  );
}

export const JobCard = memo(JobCardBase);

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16, marginBottom: 12, borderRadius: 16, padding: 14, borderWidth: 1,
    shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  cardDark: { shadowOpacity: 0.4, elevation: 4 },
  top: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  pills: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' },
  govt: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  govtText: { fontSize: 10.5 },
  title: { fontFamily: font.semi, fontSize: 16, lineHeight: 22 },
  orgRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  org: { fontFamily: font.regular, fontSize: 13, flexShrink: 1 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  divider: { height: StyleSheet.hairlineWidth, marginTop: 12 },
  bottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, gap: 8 },
  date: { fontFamily: font.medium, fontSize: 11.5, flexShrink: 1 },
});
