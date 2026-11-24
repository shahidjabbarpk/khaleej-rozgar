import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Linking, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ReportSheet } from '@/components/community';
import {
  BookmarkButton, CategoryPill, confirmAction, DeadlineBadge, EligibilityTag, EmptyState, Icon, type IconName, OrgAvatar, Tap, useStatusBar,
} from '@/components/ui';
import { adOnApply, InlineBanner } from '@/lib/ads';
import { track } from '@/lib/analytics';
import { blockUser, currentUid } from '@/lib/community';
import { jobSaveToggled, storeLink } from '@/lib/engagement';
import { prettyDate, safeUrl, toIntl } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { scheduleDeadlineReminder } from '@/lib/notify';
import { COUNTRY_META, countryName } from '@/lib/places';
import { useApp } from '@/lib/store';
import { font, useTheme } from '@/lib/theme';
import { detectLanguage, hasPacks, mlkitHas, onWifi, translateText, translationAvailable } from '@/lib/translate';
import type { Job } from '@/lib/types';

export default function JobDetail() {
  useStatusBar('plain');
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useTheme();
  const { t, tf, lang, isRtl } = useI18n();
  const insets = useSafeAreaInsets();
  const job = useApp((s) => s.jobs.find((j) => j.id === id) ?? s.saved[id ?? '']);
  const saved = useApp((s) => !!(id && s.saved[id]));
  const toggleSave = useApp((s) => s.toggleSave);
  const [report, setReport] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (job) track('job_view', { source: job.source, category: job.category, country: job.country });
  }, [job?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2200);
  };

  if (!job) {
    return (
      <View style={[styles.screen, { backgroundColor: c.bg, paddingTop: insets.top + 40 }]}>
        <EmptyState icon="briefcase-remove-outline" title={t('jobNotFound')} hint="" />
        <Tap onPress={() => router.back()} style={[styles.apply, { backgroundColor: c.primary, marginHorizontal: 16 }]}>
          <Text style={[styles.applyText, tf('bold')]}>{t('back')}</Text>
        </Tap>
      </View>
    );
  }

  const isPost = job.source === 'user' || (job.source === 'admin' && !job.applyUrl);
  const mine = !!job.ownerUid && job.ownerUid === currentUid();
  const applyUrl = job.applyUrl || job.url;

  const apply = () => {
    track('job_apply_click', { source: job.source, category: job.category });
    // interstitial first (skipped inside the 60 s floor); the page opens after it closes
    adOnApply(() => WebBrowser.openBrowserAsync(safeUrl(applyUrl)).catch(() => Linking.openURL(applyUrl)));
  };
  const share = () => {
    track('job_share', { source: job.source });
    const link = job.source === 'user' ? storeLink('job_share') : applyUrl;
    Share.share({ message: `${t('shareJobMsg')} ${job.title} – ${job.organization} (${countryName(job.country, 'en')})\n${link}\n\n${t('appName')}: ${storeLink('job_share')}` }).catch(() => {});
  };
  const remind = async () => {
    if (await scheduleDeadlineReminder(job)) flash(t('reminderSet'));
  };

  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
      <View style={[styles.top, { paddingTop: insets.top + 6, backgroundColor: c.card, borderBottomColor: c.border }]}>
        <Tap onPress={() => router.back()} style={styles.iconBtn} accessibilityLabel={t('back')}>
          <Icon name="arrow-left" size={24} color={c.text} />
        </Tap>
        <Text style={[styles.topTitle, tf('bold'), { color: c.text }]} numberOfLines={1}>{t('jobDetails')}</Text>
        <Tap onPress={share} style={styles.iconBtn} accessibilityLabel={t('share')}><Icon name="share-variant" size={22} color={c.text} /></Tap>
        <BookmarkButton active={saved} onPress={() => (saved
          ? confirmAction(t('unsaveConfirm'), t('remove'), t('cancel'), () => jobSaveToggled(job, toggleSave(job)))
          : jobSaveToggled(job, toggleSave(job)))} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 130 }}>
        <View style={styles.head}>
          <OrgAvatar job={job} size={58} />
          <View style={{ flex: 1, gap: 4 }}>
            <View style={styles.pills}>
              {job.sector === 'govt'
                ? <Pill icon="bank" label={t('govtJob')} color={c.primary} />
                : <CategoryPill category={job.category} />}
              <EligibilityTag job={job} />
            </View>
            <Text style={[styles.title, { color: c.text }]}>{job.title}</Text>
            <View style={styles.orgRow}>
              <Text style={[styles.org, { color: c.sub }]}>{job.organization}</Text>
              {job.verified && <Icon name="check-decagram" size={16} color={c.gold} />}
            </View>
          </View>
        </View>

        {/* anti-scam banner, always */}
        <View style={[styles.banner, { backgroundColor: c.dangerSoft }]}>
          <Icon name="shield-alert" size={20} color={c.danger} />
          <Text style={[styles.bannerText, tf(), { color: c.text }]}>{t('scamBanner')}</Text>
        </View>
        {job.sector === 'govt' && (
          <View style={[styles.banner, { backgroundColor: c.primarySoft }]}>
            <Icon name="information" size={20} color={c.primary} />
            <Text style={[styles.bannerText, tf(), { color: c.text }]}>
              {job.eligibility === 'locals' ? `${t('localsNote')} ` : ''}{t('govtDisclaimer')}
            </Text>
          </View>
        )}

        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
          <Row icon="map-marker" label={t('location')}
            value={`${COUNTRY_META[job.country].flag} ${[job.cities.join(', '), countryName(job.country, lang)].filter(Boolean).join(' – ')}`} />
          <Row icon="account-check" label={t('whoCanApply')} value={t(`elig.${job.eligibility}`)} />
          {!!job.salary && <Row icon="cash" label={t('salary')} value={job.salary} />}
          {!!job.jobType && <Row icon="clock-outline" label={t('jobType')} value={job.jobType} />}
          <Row icon="calendar" label={t('posted')} value={prettyDate(job.postedDate ?? job.firstSeen)} />
          {!!job.lastDate && <Row icon="calendar-alert" label={t('lastDate')} value={prettyDate(job.lastDate)} />}
          <Row icon="web" label={t('source')} value={t(`src.${job.source}`)} />
          {!!job.lastDate && <View style={{ marginTop: 6 }}><DeadlineBadge job={job} /></View>}
        </View>

        {!!job.description && <Description job={job} />}

        <InlineBanner />

        {!!job.lastDate && (
          <Tap onPress={remind} style={[styles.secondary, { borderColor: c.border, backgroundColor: c.card }]}>
            <Icon name="bell-ring-outline" size={20} color={c.primary} />
            <Text style={[styles.secondaryText, tf('bold'), { color: c.text }]}>{t('remindMe')}</Text>
          </Tap>
        )}
        {!isPost && (
          <Tap onPress={() => Clipboard.setStringAsync(applyUrl).then(() => flash(t('linkCopied')))}
            style={[styles.secondary, { borderColor: c.border, backgroundColor: c.card }]}>
            <Icon name="link-variant" size={20} color={c.primary} />
            <Text style={[styles.secondaryText, tf('bold'), { color: c.text }]}>{t('copyLink')}</Text>
          </Tap>
        )}
        {(job.source === 'user' || job.source === 'admin') && !mine && (
          <View style={styles.modRow}>
            <Tap onPress={() => setReport(true)} style={[styles.secondary, styles.half, { borderColor: c.border, backgroundColor: c.card }]}>
              <Icon name="flag-outline" size={20} color={c.danger} />
              <Text style={[styles.secondaryText, tf('bold'), { color: c.danger }]}>{t('report')}</Text>
            </Tap>
            {!!job.ownerUid && (
              <Tap style={[styles.secondary, styles.half, { borderColor: c.border, backgroundColor: c.card }]}
                onPress={() => Alert.alert(t('blockUser'), '', [
                  { text: t('cancel'), style: 'cancel' },
                  { text: t('blockUser'), style: 'destructive', onPress: () => blockUser(job.ownerUid!).then(() => { flash(t('blocked')); router.back(); }).catch(() => {}) },
                ])}>
                <Icon name="account-cancel-outline" size={20} color={c.sub} />
                <Text style={[styles.secondaryText, tf('bold'), { color: c.sub }]}>{t('blockUser')}</Text>
              </Tap>
            )}
          </View>
        )}
      </ScrollView>

      {/* sticky actions */}
      <View style={[styles.actions, { backgroundColor: c.card, borderTopColor: c.border, paddingBottom: Math.max(insets.bottom, 10) }]}>
        {isPost ? (
          <>
            {!!job.whatsapp && <Action icon="whatsapp" label={t('whatsapp')} color="#25D366"
              onPress={() => Linking.openURL(`https://wa.me/${toIntl(job.whatsapp!)}?text=${encodeURIComponent(`${job.title} – Khaleej Rozgar`)}`).catch(() => {})} />}
            {!!job.phone && <Action icon="phone" label={t('call')} color={c.primary} onPress={() => Linking.openURL(`tel:${job.phone}`).catch(() => {})} />}
            {!!job.email && <Action icon="email" label={t('email')} color={c.primaryDark}
              onPress={() => Linking.openURL(`mailto:${job.email}?subject=${encodeURIComponent(job.title)}`).catch(() => {})} />}
          </>
        ) : (
          <Tap onPress={apply} style={[styles.apply, { backgroundColor: c.primary }]}>
            <Icon name="send" size={20} color="#fff" />
            <Text style={[styles.applyText, tf('bold')]}>{job.sector === 'govt' ? t('openOfficial') : t('applyNow')}</Text>
          </Tap>
        )}
      </View>

      {toast && (
        <View style={[styles.toast, { bottom: 100 + insets.bottom }]}>
          <Text style={[tf(), { color: '#fff', fontSize: 13.5 }]}>{toast}</Text>
        </View>
      )}
      <ReportSheet visible={report} onClose={() => setReport(false)} kind="job" postId={job.id} />
    </View>
  );
}

function Pill({ icon, label, color }: { icon: IconName; label: string; color: string }) {
  const { tf } = useI18n();
  return (
    <View style={[styles.pill, { backgroundColor: color + '18' }]}>
      <Icon name={icon} size={11} color={color} />
      <Text style={[tf('bold'), { color, fontSize: 10.5 }]}>{label}</Text>
    </View>
  );
}

function Row({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  const c = useTheme();
  const { tf } = useI18n();
  return (
    <View style={styles.row}>
      <Icon name={icon} size={19} color={c.primary} />
      <Text style={[styles.rowLabel, tf(), { color: c.sub }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: c.text }]}>{value}</Text>
    </View>
  );
}

function Action({ icon, label, color, onPress }: { icon: IconName; label: string; color: string; onPress: () => void }) {
  const { tf } = useI18n();
  return (
    <Tap onPress={onPress} style={[styles.apply, { backgroundColor: color }]}>
      <Icon name={icon} size={20} color="#fff" />
      <Text style={[styles.applyText, tf('bold')]}>{label}</Text>
    </Tap>
  );
}

/** Description with on-device translation ("Auto-translated" label + Show original toggle). */
function Description({ job }: { job: Job }) {
  const c = useTheme();
  const { t, tf, lang } = useI18n();
  const mobileData = useApp((s) => s.translateOnMobile);
  const [src, setSrc] = useState<string>('und');
  const [out, setOut] = useState<string | null>(null);
  const [showOut, setShowOut] = useState(true);
  const [busy, setBusy] = useState(false);
  const text = useMemo(() => `${job.title}\n\n${job.description ?? ''}`, [job]);

  useEffect(() => {
    if (translationAvailable()) detectLanguage(text).then(setSrc).catch(() => {});
  }, [text]);

  // ML Kit has no Malayalam, Nepali, Sinhala or Pashto pack: those users get no translate button
  const canTranslate = translationAvailable() && mlkitHas(lang) && src !== lang;
  const run = async (sourceLang: string) => {
    setBusy(true);
    try {
      setOut(await translateText(job.id, job.description ?? '', sourceLang, lang));
      setShowOut(true);
    } catch {
      Alert.alert(t('translateFailed'));
    } finally {
      setBusy(false);
    }
  };
  const ask = async () => {
    // 'und' (not sure) - assume English for job boards, Arabic for Arabic script
    const source = src !== 'und' ? src : /[؀-ۿ]/.test(text) ? 'ar' : 'en';
    if (await hasPacks(source, lang)) return run(source);
    if (!mobileData && !(await onWifi())) return Alert.alert(t('translateDownloadTitle'), t('translateDownloadBody'));
    Alert.alert(t('translateDownloadTitle'), t('translateDownloadBody'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('download'), onPress: () => run(source) },
    ]);
  };

  return (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
      <View style={styles.descHead}>
        <Text style={[styles.cardTitle, tf('bold'), { color: c.text }]}>{t('description')}</Text>
        {canTranslate && !out && (
          <Tap onPress={ask} disabled={busy} style={[styles.trBtn, { backgroundColor: c.primarySoft }]}>
            <Icon name="translate" size={16} color={c.primary} />
            <Text style={[tf('bold'), { color: c.primary, fontSize: 12.5 }]}>{busy ? t('translating') : t('translate')}</Text>
          </Tap>
        )}
        {!!out && (
          <Tap onPress={() => setShowOut(!showOut)} style={[styles.trBtn, { backgroundColor: c.primarySoft }]}>
            <Icon name="swap-horizontal" size={16} color={c.primary} />
            <Text style={[tf('bold'), { color: c.primary, fontSize: 12.5 }]}>{showOut ? t('showOriginal') : t('showTranslation')}</Text>
          </Tap>
        )}
      </View>
      {!!out && showOut && (
        <View style={[styles.trNote, { backgroundColor: c.cardAlt }]}>
          <Text style={[tf('bold'), { color: c.sub, fontSize: 11.5 }]}>{t('autoTranslated')} • {t('googleTranslateAttr')}</Text>
          <Text style={[tf(), { color: c.warn, fontSize: 12, marginTop: 2 }]}>{t('translateWarn')}</Text>
        </View>
      )}
      <Text style={[styles.desc, { color: c.text }, !!out && showOut && tf()]} selectable>
        {out && showOut ? out : job.description}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  topTitle: { flex: 1, fontSize: 17 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  head: { flexDirection: 'row', gap: 14, marginBottom: 14 },
  pills: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  title: { fontFamily: font.bold, fontSize: 20, lineHeight: 27 },
  orgRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  org: { fontFamily: font.medium, fontSize: 14.5 },
  banner: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: 14, marginBottom: 10, alignItems: 'flex-start' },
  bannerText: { flex: 1, fontSize: 13.5, lineHeight: 20 },
  card: { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 12, gap: 8 },
  cardTitle: { fontSize: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 30 },
  rowLabel: { fontSize: 13.5, width: 110 },
  rowValue: { flex: 1, fontFamily: font.medium, fontSize: 14.5 },
  descHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  trBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, height: 34, borderRadius: 17 },
  trNote: { padding: 10, borderRadius: 10 },
  desc: { fontFamily: font.regular, fontSize: 15, lineHeight: 23 },
  secondary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: 14, borderWidth: 1, marginBottom: 10 },
  secondaryText: { fontSize: 14.5 },
  modRow: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  actions: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  apply: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 54, borderRadius: 14 },
  applyText: { color: '#fff', fontSize: 16 },
  toast: { position: 'absolute', alignSelf: 'center', backgroundColor: '#000C', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
});
