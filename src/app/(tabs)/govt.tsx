import * as WebBrowser from 'expo-web-browser';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { CountryButton, Hero } from '@/components/Header';
import { JobList } from '@/components/JobList';
import { EmptyState, Icon, SectionTitle, Tap, useStatusBar } from '@/components/ui';
import { BottomBanner } from '@/lib/ads';
import { refreshJobs } from '@/lib/feed';
import { sortJobs } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { COUNTRY_META, GOVT_PORTALS } from '@/lib/places';
import { useApp } from '@/lib/store';
import { font, useTheme } from '@/lib/theme';

export default function Govt() {
  useStatusBar('hero');
  const c = useTheme();
  const { t, tf } = useI18n();
  const jobs = useApp((s) => s.jobs);
  const country = useApp((s) => s.country);
  const syncing = useApp((s) => s.syncing);
  const [q, setQ] = useState('');

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return sortJobs(jobs.filter((j) => j.sector === 'govt' && (!country || j.country === country)
      && (!s || `${j.title} ${j.organization}`.toLowerCase().includes(s))), 'newest');
  }, [jobs, country, q]);
  const portals = GOVT_PORTALS.filter((p) => !country || p.country === country);

  const portalCards = (
    <View>
      <SectionTitle title={t('officialPortals')} />
      <Text style={[styles.hint, tf(), { color: c.sub }]}>{t('officialPortalsHint')}</Text>
      {portals.map((p) => (
        <Tap key={p.url} onPress={() => WebBrowser.openBrowserAsync(p.url).catch(() => {})}
          style={[styles.portal, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={styles.flag}>{COUNTRY_META[p.country].flag}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.pName, { color: c.text }]} numberOfLines={2}>{p.name}</Text>
            <Text style={[styles.pWho, tf(), { color: c.sub }]}>{t(`who.${p.who}`)}</Text>
          </View>
          <Icon name="open-in-new" size={20} color={c.primary} />
        </Tap>
      ))}
    </View>
  );

  const header = (
    <View>
      <Hero title={t('govtTitle')} subtitle={t('govtHint')} right={<CountryButton />}>
        <View style={[styles.search, { backgroundColor: c.card }]}>
          <Icon name="magnify" size={20} color={c.faint} />
          <TextInput value={q} onChangeText={setQ} placeholder={t('searchPlaceholder')} placeholderTextColor={c.faint}
            style={[styles.input, { color: c.text }]} autoCorrect={false} />
        </View>
      </Hero>
      <View style={[styles.disc, { backgroundColor: c.primarySoft }]}>
        <Icon name="shield-check" size={18} color={c.primary} />
        <Text style={[styles.discText, tf(), { color: c.text }]}>{t('govtDisclaimer')}</Text>
      </View>
      {!list.length && portalCards}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <JobList
        jobs={list}
        header={header}
        footer={list.length ? portalCards : undefined}
        loading={syncing && !jobs.length}
        refreshing={syncing}
        onRefresh={() => refreshJobs().catch(() => {})}
        empty={<EmptyState icon="bank-outline" title={t('noGovtJobs')} hint={t('noGovtJobsHint')} />}
      />
      <BottomBanner />
    </View>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 48, borderRadius: 14, paddingHorizontal: 12, marginTop: 14 },
  input: { flex: 1, fontFamily: font.regular, fontSize: 15 },
  disc: { flexDirection: 'row', gap: 8, margin: 16, marginBottom: 8, padding: 12, borderRadius: 12 },
  discText: { flex: 1, fontSize: 12.5, lineHeight: 18 },
  hint: { fontSize: 13, marginHorizontal: 16, marginTop: -6, marginBottom: 10 },
  portal: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginBottom: 10, padding: 14, borderRadius: 14, borderWidth: 1 },
  flag: { fontSize: 26 },
  pName: { fontFamily: font.semi, fontSize: 14.5 },
  pWho: { fontSize: 12.5, marginTop: 2 },
});
