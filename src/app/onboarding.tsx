import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PrimaryButton } from '@/components/community';
import { Dropdown } from '@/components/Dropdown';
import { Icon, type IconName, Tap, useStatusBar } from '@/components/ui';
import { track } from '@/lib/analytics';
import { applyLanguage, LANGS, type Lang, useI18n } from '@/lib/i18n';
import { setupNotifications } from '@/lib/notify';
import { CITIES, COUNTRIES, COUNTRY_META, countryName } from '@/lib/places';
import { syncTopics } from '@/lib/push';
import { registerBackgroundDetector } from '@/lib/background';
import { ALL_CATEGORIES, useApp } from '@/lib/store';
import { CATEGORY_META, font, useTheme } from '@/lib/theme';
import type { Category, Country } from '@/lib/types';

/**
 * First launch, max 3 screens:
 *   1. language (English preselected) + country (6 flags) + optional city
 *   2. job types + who are you
 *   3. "Turn on job alerts": alerts are ON by default; on Android 13+ this is where POST_NOTIFICATIONS is asked.
 */
export default function Onboarding() {
  useStatusBar('hero');
  const c = useTheme();
  const { t, tf, lang } = useI18n();
  const insets = useSafeAreaInsets();
  const s = useApp();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);

  const finish = async (ask: boolean) => {
    setBusy(true);
    const granted = await setupNotifications(ask).catch(() => false);
    track('alert_setup', { where: 'onboarding', granted });
    // alerts stay ON in the app either way; without the permission the Alerts tab shows "Turn on"
    useApp.getState().set({ onboarded: true, notify: true });
    syncTopics().catch(() => {});
    registerBackgroundDetector().catch(() => {});
    setBusy(false);
    router.replace('/');
  };

  const toggleCat = (k: Category) =>
    s.set({ alertCategories: s.alertCategories.includes(k) ? s.alertCategories.filter((x) => x !== k) : [...s.alertCategories, k] });

  return (
    <LinearGradient colors={[c.heroA, c.heroB, c.heroC]} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={[styles.wrap, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.dots}>
          {[0, 1, 2].map((i) => <View key={i} style={[styles.dot, { backgroundColor: i <= step ? '#fff' : 'rgba(255,255,255,0.3)' }]} />)}
        </View>

        {step === 0 && (
          <>
            <Text style={[styles.h1, tf('bold')]}>{t('onboardWelcome')}</Text>
            <Text style={[styles.p, tf()]}>{t('onboardHint')}</Text>
            <View style={[styles.card, { backgroundColor: c.card }]}>
              <Text style={[styles.label, tf('bold'), { color: c.sub }]}>{t('chooseLanguage')}</Text>
              <Dropdown full noAll label={t('chooseLanguage')} icon="translate" value={lang}
                options={LANGS.map((l) => ({ value: l.code, label: l.label }))}
                onChange={(v) => v && v !== lang && applyLanguage(v as Lang)} />
              <Text style={[styles.label, tf('bold'), { color: c.sub, marginTop: 16 }]}>{t('chooseCountry')}</Text>
              <View style={styles.flags}>
                {COUNTRIES.map((cc) => {
                  const on = s.country === cc;
                  return (
                    <Tap key={cc} onPress={() => s.set({ country: cc as Country, city: null })}
                      style={[styles.flag, { borderColor: on ? c.primary : c.border, backgroundColor: on ? c.primarySoft : c.bg }]}>
                      <Text style={styles.flagEmoji}>{COUNTRY_META[cc].flag}</Text>
                      <Text style={[styles.flagName, tf(on ? 'bold' : 'regular'), { color: on ? c.primary : c.text }]} numberOfLines={2}>
                        {countryName(cc, lang)}
                      </Text>
                    </Tap>
                  );
                })}
              </View>
              {s.country && (
                <>
                  <Text style={[styles.label, tf('bold'), { color: c.sub, marginTop: 14 }]}>{t('chooseCity')}</Text>
                  <Dropdown full searchable label={t('chooseCity')} icon="map-marker" value={s.city} allLabel={t('allCities')}
                    options={CITIES[s.country].map((x) => ({ value: x, label: x }))} onChange={(v) => s.set({ city: v })} />
                </>
              )}
              <View style={{ marginTop: 18 }}>
                <PrimaryButton label={t('continue')} icon="arrow-right" onPress={() => setStep(1)} />
              </View>
              {!s.country && (
                <Tap onPress={() => setStep(1)} style={{ alignSelf: 'center', padding: 10 }}>
                  <Text style={[tf(), { color: c.sub }]}>{t('allGulf')}</Text>
                </Tap>
              )}
            </View>
          </>
        )}

        {step === 1 && (
          <>
            <Text style={[styles.h1, tf('bold')]}>{t('chooseCategories')}</Text>
            <View style={[styles.card, { backgroundColor: c.card }]}>
              <View style={styles.cats}>
                {ALL_CATEGORIES.map((k) => {
                  const on = s.alertCategories.includes(k);
                  const col = CATEGORY_META[k].colors[0];
                  return (
                    <Tap key={k} onPress={() => toggleCat(k)}
                      style={[styles.cat, { borderColor: on ? col : c.border, backgroundColor: on ? col + '14' : c.bg }]}>
                      <Icon name={CATEGORY_META[k].icon as IconName} size={22} color={on ? col : c.faint} />
                      <Text style={[styles.catText, tf(on ? 'bold' : 'regular'), { color: on ? c.text : c.sub }]} numberOfLines={2}>{t(`cat.${k}`)}</Text>
                    </Tap>
                  );
                })}
              </View>
              <Text style={[styles.label, tf('bold'), { color: c.sub, marginTop: 16 }]}>{t('whoAreYou')}</Text>
              <View style={styles.roles}>
                {(['seeker', 'employer'] as const).map((r) => {
                  const on = s.role === r;
                  return (
                    <Tap key={r} onPress={() => s.set({ role: r })}
                      style={[styles.role, { borderColor: on ? c.primary : c.border, backgroundColor: on ? c.primarySoft : c.bg }]}>
                      <Icon name={r === 'seeker' ? 'account-hard-hat' : 'domain'} size={28} color={on ? c.primary : c.faint} />
                      <Text style={[tf(on ? 'bold' : 'regular'), { color: on ? c.primary : c.text, fontSize: 15 }]}>{t(r === 'seeker' ? 'jobSeeker' : 'employer')}</Text>
                    </Tap>
                  );
                })}
              </View>
              <View style={{ marginTop: 18 }}>
                <PrimaryButton label={t('continue')} icon="arrow-right" onPress={() => setStep(2)} disabled={!s.alertCategories.length} />
              </View>
            </View>
          </>
        )}

        {step === 2 && (
          <>
            <View style={styles.bell}><Icon name="bell-ring" size={64} color="#fff" /></View>
            <Text style={[styles.h1, tf('bold'), { textAlign: 'center' }]}>{t('alertsStepTitle')}</Text>
            <Text style={[styles.p, tf(), { textAlign: 'center' }]}>{t('alertsStepHint')}</Text>
            <View style={[styles.card, { backgroundColor: c.card }]}>
              <PrimaryButton label={t('getAlerts')} icon="bell" onPress={() => finish(true)} busy={busy} />
              <Tap onPress={() => finish(false)} style={{ alignSelf: 'center', padding: 12 }}>
                <Text style={[tf(), { color: c.sub, fontSize: 14 }]}>{t('skip')}</Text>
              </Tap>
            </View>
          </>
        )}

        <Text style={[styles.footer, tf()]}>{t('onboardFooter')}</Text>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 18, flexGrow: 1 },
  dots: { flexDirection: 'row', gap: 6, alignSelf: 'center', marginBottom: 22 },
  dot: { width: 28, height: 5, borderRadius: 3 },
  h1: { color: '#fff', fontSize: 25, marginBottom: 6 },
  p: { color: 'rgba(255,255,255,0.85)', fontSize: 15, marginBottom: 18, lineHeight: 22 },
  card: { borderRadius: 22, padding: 16 },
  label: { fontSize: 13, marginBottom: 8 },
  flags: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  flag: { width: '47.5%', flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, borderWidth: 1.5, minHeight: 56 },
  flagEmoji: { fontSize: 28 },
  flagName: { fontSize: 14, flexShrink: 1 },
  cats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cat: { width: '31.5%', alignItems: 'center', gap: 6, paddingVertical: 12, paddingHorizontal: 4, borderRadius: 14, borderWidth: 1.5, minHeight: 84 },
  catText: { fontSize: 11.5, textAlign: 'center' },
  roles: { flexDirection: 'row', gap: 10 },
  role: { flex: 1, alignItems: 'center', gap: 6, padding: 14, borderRadius: 14, borderWidth: 1.5 },
  bell: { alignSelf: 'center', width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginVertical: 20 },
  footer: { color: 'rgba(255,255,255,0.7)', fontSize: 12, textAlign: 'center', marginTop: 'auto', paddingTop: 20, fontFamily: font.regular },
});
