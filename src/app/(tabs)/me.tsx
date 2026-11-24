import Constants from 'expo-constants';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AuthCard, isLoggedIn, useAuthUser } from '@/components/AuthCard';
import { Dropdown } from '@/components/Dropdown';
import { Hero } from '@/components/Header';
import { LinkRow, SwitchRow } from '@/components/SwitchRow';
import { confirmAction, SectionTitle, useStatusBar } from '@/components/ui';
import { BottomBanner } from '@/lib/ads';
import { communityReady, deleteAccount, signOutUser } from '@/lib/community';
import { PRIVACY_URL, SUPPORT_EMAIL, TERMS_URL } from '@/lib/config';
import { openStoreListing, shareApp } from '@/lib/engagement';
import { applyLanguage, LANGS, type Lang, useI18n } from '@/lib/i18n';
import { CITIES, COUNTRIES, COUNTRY_META, countryName } from '@/lib/places';
import { refreshJobs } from '@/lib/feed';
import { syncTopics } from '@/lib/push';
import { useApp } from '@/lib/store';
import { useTheme } from '@/lib/theme';
import { forgetPacks } from '@/lib/translate';
import type { Country } from '@/lib/types';

export default function Me() {
  useStatusBar('hero');
  const c = useTheme();
  const { t, tf, lang } = useI18n();
  const user = useAuthUser();
  const s = useApp();
  const savedCount = Object.keys(s.saved).length;

  const del = () => Alert.alert(t('deleteAccount'), t('deleteAccountConfirm'), [
    { text: t('cancel'), style: 'cancel' },
    {
      text: t('delete'), style: 'destructive',
      onPress: () => deleteAccount()
        .then(() => { s.set({ profile: null }); Alert.alert(t('deleteAccountDone')); })
        .catch((e) => Alert.alert(String(e?.code ?? '').includes('recent-login') ? t('deleteAccountRelogin') : t('errorGeneric'))),
    },
  ]);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 16 }}>
        <Hero title={t('me')} subtitle={isLoggedIn(user) ? `${t('loggedInAs')} ${user?.email ?? user?.name ?? ''}` : undefined} />

        <SectionTitle title={t('account')} />
        {communityReady() && !isLoggedIn(user) ? (
          <AuthCard />
        ) : (
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <LinkRow icon="briefcase-account" label={t('myPosts')} onPress={() => router.push('/my-posts')} />
            {s.role === 'employer' && <LinkRow icon="check-decagram" label={t('verifyEmployer')} onPress={() => router.push('/verify')} />}
            {isLoggedIn(user) && <LinkRow icon="logout" label={t('logout')} onPress={() => confirmAction(t('logoutConfirm'), t('logout'), t('cancel'), () => { signOutUser().catch(() => {}); })} />}
          </View>
        )}

        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border, marginTop: 12 }]}>
          <LinkRow icon="heart" label={t('savedJobs')} value={savedCount ? String(savedCount) : undefined} onPress={() => router.push('/saved')} />
          <LinkRow icon="file-account" label={t('cvMaker')} onPress={() => router.push('/cv')} />
        </View>

        <SectionTitle title={t('language')} />
        <View style={styles.pad}>
          <Dropdown full noAll label={t('language')} icon="translate" value={lang}
            options={LANGS.map((l) => ({ value: l.code, label: l.label }))}
            onChange={(v) => v && v !== lang && applyLanguage(v as Lang)} />
        </View>

        <SectionTitle title={t('country')} />
        <View style={[styles.pad, { gap: 10 }]}>
          <Dropdown full label={t('country')} icon="earth" value={s.country} allLabel={`🌍 ${t('allGulf')}`}
            options={COUNTRIES.map((cc) => ({ value: cc, label: `${COUNTRY_META[cc].flag}  ${countryName(cc, lang)}` }))}
            onChange={(v) => { s.set({ country: (v as Country) ?? null, city: null }); syncTopics().catch(() => {}); refreshJobs().catch(() => {}); }} />
          {s.country && (
            <Dropdown full searchable label={t('city')} icon="map-marker" value={s.city} allLabel={t('allCities')}
              options={CITIES[s.country].map((x) => ({ value: x, label: x }))} onChange={(v) => s.set({ city: v })} />
          )}
        </View>

        <SectionTitle title={t('notifications')} />
        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
          <SwitchRow icon="bell-ring" label={t('newJobAlerts')} value={s.notify}
            onChange={(v) => { s.set({ notify: v }); syncTopics().catch(() => {}); }} />
          <SwitchRow icon="bank" label={t('govtJobAlerts')} value={s.notifyGovt}
            onChange={(v) => { s.set({ notifyGovt: v }); syncTopics().catch(() => {}); }} />
          <SwitchRow icon="calendar-clock" label={t('deadlineReminders')} value={s.notifyReminders} onChange={(v) => s.set({ notifyReminders: v })} />
          <LinkRow icon="tune" label={t('alertCategories')} onPress={() => router.navigate('/alerts')} />
        </View>

        <SectionTitle title={t('translationPacks')} />
        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
          <SwitchRow icon="signal-cellular-3" label={t('translationMobileData')} value={s.translateOnMobile} onChange={(v) => s.set({ translateOnMobile: v })} />
          <LinkRow icon="delete-outline" label={t('deletePacks')} onPress={() => confirmAction(t('deletePacksConfirm'), t('delete'), t('cancel'), () => { forgetPacks().then(() => Alert.alert(t('packsDeleted'))).catch(() => {}); })} />
          <SwitchRow icon="weather-night" label={t('darkMode')} value={s.theme === 'dark'} onChange={(v) => s.set({ theme: v ? 'dark' : 'light' })} />
        </View>

        <SectionTitle title={t('about')} />
        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
          <LinkRow icon="shield-alert" label={t('safetyTips')} onPress={() => router.push({ pathname: '/info', params: { kind: 'safety' } })} />
          <LinkRow icon="information" label={t('about')} onPress={() => router.push({ pathname: '/info', params: { kind: 'about' } })} />
          <LinkRow icon="shield-lock" label={t('privacy')} onPress={() => WebBrowser.openBrowserAsync(PRIVACY_URL).catch(() => {})} />
          <LinkRow icon="file-document" label={t('terms')} onPress={() => WebBrowser.openBrowserAsync(TERMS_URL).catch(() => {})} />
          <LinkRow icon="email" label={t('contactUs')} onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Khaleej%20Rozgar`).catch(() => {})} />
          <LinkRow icon="share-variant" label={t('shareApp')} onPress={() => shareApp(t('shareAppMsg'))} />
          <LinkRow icon="star" label={t('rateApp')} onPress={openStoreListing} />
          {s.admin && <LinkRow icon="shield-account" label={t('admin')} onPress={() => router.push('/admin')} />}
          {isLoggedIn(user) && <LinkRow icon="account-remove" label={t('deleteAccount')} onPress={del} danger />}
        </View>
        <Text style={[styles.version, tf(), { color: c.faint }]}>{t('appName')} • {t('version')} {Constants.expoConfig?.version ?? ''}</Text>
      </ScrollView>
      <BottomBanner />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 2 },
  pad: { marginHorizontal: 16 },
  version: { textAlign: 'center', fontSize: 12, marginTop: 18 },
});
