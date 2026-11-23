import { useNetworkState } from 'expo-network';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Dropdown } from '@/components/Dropdown';
import { CountryButton, Hero } from '@/components/Header';
import { JobList } from '@/components/JobList';
import { EmptyState, Icon, Tap, useStatusBar } from '@/components/ui';
import { WorkerCard } from '@/components/WorkerCard';
import { BottomBanner } from '@/lib/ads';
import { communityReady, fetchSeekers } from '@/lib/community';
import { refreshJobs } from '@/lib/feed';
import { isNew, sortJobs } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { CITIES, jobInArea } from '@/lib/places';
import { ALL_CATEGORIES, useApp } from '@/lib/store';
import { CATEGORY_META, font, useTheme } from '@/lib/theme';
import type { Category, Eligibility, Seeker } from '@/lib/types';
import type { IconName } from '@/components/ui';

const ELIG: Eligibility[] = ['expats', 'visa', 'anyone', 'locals'];

export default function Jobs() {
  useStatusBar('hero');
  const c = useTheme();
  const { t, tf } = useI18n();
  const jobs = useApp((s) => s.jobs);
  const syncing = useApp((s) => s.syncing);
  const country = useApp((s) => s.country);
  const city = useApp((s) => s.city);
  const set = useApp((s) => s.set);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<Category | null>(null);
  const [elig, setElig] = useState<Eligibility | null>(null);
  const [seg, setSeg] = useState<'jobs' | 'workers'>('jobs');
  const [workers, setWorkers] = useState<Seeker[] | null>(null);
  const net = useNetworkState();
  const offline = net.isConnected === false;

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return sortJobs(jobs.filter((j) => j.sector === 'private' || j.source === 'user'), 'newest').filter((j) =>
      jobInArea(j, country, city)
      && (!cat || j.category === cat)
      && (!elig || j.eligibility === elig)
      && (!s || `${j.title} ${j.organization} ${j.cities.join(' ')}`.toLowerCase().includes(s)));
  }, [jobs, q, cat, elig, country, city]);
  const newCount = useMemo(() => list.filter((j) => isNew(j)).length, [list]);

  const loadWorkers = useCallback(() => {
    if (!communityReady()) return setWorkers([]);
    fetchSeekers(country).then(setWorkers).catch(() => setWorkers([]));
  }, [country]);
  useEffect(() => {
    if (seg === 'workers') loadWorkers();
  }, [seg, loadWorkers]);

  const filtered = !!(q || cat || elig || city);
  const header = (
    <View>
      <Hero title={t('appName')} subtitle={`${list.length} ${t('liveJobs')} • ${newCount} ${t('newToday')}`} right={<CountryButton />}>
        <View style={[styles.search, { backgroundColor: c.card }]}>
          <Icon name="magnify" size={20} color={c.faint} />
          <TextInput value={q} onChangeText={setQ} placeholder={t('searchPlaceholder')} placeholderTextColor={c.faint}
            style={[styles.input, { color: c.text }]} returnKeyType="search" autoCorrect={false} />
          {!!q && <Tap onPress={() => setQ('')}><Icon name="close-circle" size={18} color={c.faint} /></Tap>}
        </View>
      </Hero>

      <View style={[styles.seg, { backgroundColor: c.cardAlt }]}>
        {(['jobs', 'workers'] as const).map((k) => (
          <Tap key={k} onPress={() => setSeg(k)} style={[styles.segBtn, seg === k && { backgroundColor: c.card }]}>
            <Icon name={k === 'jobs' ? 'briefcase' : 'account-hard-hat'} size={18} color={seg === k ? c.primary : c.sub} />
            <Text style={[styles.segText, tf(seg === k ? 'bold' : 'regular'), { color: seg === k ? c.primary : c.sub }]}>
              {t(k === 'jobs' ? 'segJobs' : 'segWorkers')}
            </Text>
          </Tap>
        ))}
      </View>

      {seg === 'jobs' && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {country && (
            <Dropdown label={t('city')} icon="map-marker" value={city} allLabel={t('allCities')} searchable
              options={CITIES[country].map((x) => ({ value: x, label: x }))} onChange={(v) => set({ city: v })} />
          )}
          <Dropdown label={t('category')} icon="shape" value={cat} searchable
            options={ALL_CATEGORIES.map((k) => ({ value: k, label: t(`cat.${k}`), icon: CATEGORY_META[k].icon as IconName }))}
            onChange={(v) => setCat(v as Category | null)} />
          <Dropdown label={t('whoCanApply')} icon="account-check" value={elig}
            options={ELIG.map((k) => ({ value: k, label: t(`elig.${k}`) }))} onChange={(v) => setElig(v as Eligibility | null)} />
          {filtered && (
            <Tap onPress={() => { setQ(''); setCat(null); setElig(null); set({ city: null }); }} style={styles.clear}>
              <Text style={[tf(), { color: c.primary, fontSize: 13 }]}>{t('clearFilters')}</Text>
            </Tap>
          )}
        </ScrollView>
      )}
      {offline && (
        <View style={[styles.note, { backgroundColor: c.cardAlt }]}>
          <Icon name="wifi-off" size={18} color={c.sub} />
          <Text style={[styles.noteText, tf(), { color: c.text }]}>{t('offline')}</Text>
        </View>
      )}
      {country === 'bh' && seg === 'jobs' && (
        <View style={[styles.note, { backgroundColor: c.primarySoft }]}>
          <Icon name="information" size={18} color={c.primary} />
          <Text style={[styles.noteText, tf(), { color: c.text }]}>{t('bahrainNote')}</Text>
        </View>
      )}
      {seg === 'workers' && (
        <View style={[styles.note, { backgroundColor: c.dangerSoft }]}>
          <Icon name="shield-alert" size={18} color={c.danger} />
          <Text style={[styles.noteText, tf(), { color: c.text }]}>{t('workersHint')}</Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {seg === 'jobs' ? (
        <JobList
          jobs={list}
          header={header}
          loading={syncing && !jobs.length}
          refreshing={syncing}
          onRefresh={() => refreshJobs().catch(() => {})}
          empty={<EmptyState icon="briefcase-search-outline" title={t('noJobs')} hint={t('noJobsHint')} />}
        />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 16 }}>
          {header}
          {workers?.length ? workers.map((w) => <WorkerCard key={w.id} seeker={w} onBlocked={loadWorkers} />)
            : workers ? <EmptyState icon="account-search" title={t('noWorkers')} hint={t('noWorkersHint')} /> : null}
        </ScrollView>
      )}
      <BottomBanner />
    </View>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 48, borderRadius: 14, paddingHorizontal: 12, marginTop: 14 },
  input: { flex: 1, fontFamily: font.regular, fontSize: 15 },
  seg: { flexDirection: 'row', margin: 16, marginBottom: 6, borderRadius: 14, padding: 4 },
  segBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, borderRadius: 11 },
  segText: { fontSize: 14.5 },
  filters: { gap: 8, paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center' },
  clear: { paddingHorizontal: 8, height: 38, justifyContent: 'center' },
  note: { flexDirection: 'row', gap: 8, alignItems: 'center', marginHorizontal: 16, marginBottom: 10, padding: 12, borderRadius: 12 },
  noteText: { flex: 1, fontSize: 13, lineHeight: 19 },
});
