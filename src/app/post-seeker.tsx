import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { Field, PrimaryButton, useProfile } from '@/components/community';
import { Dropdown } from '@/components/Dropdown';
import { PostGate } from '@/components/PostGate';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Icon, type IconName, useStatusBar } from '@/components/ui';
import { track } from '@/lib/analytics';
import { createSeeker, type SeekerInput } from '@/lib/community';
import { useI18n } from '@/lib/i18n';
import { CITIES, COUNTRIES, COUNTRY_META, countryName } from '@/lib/places';
import { checkPost } from '@/lib/scam';
import { ALL_CATEGORIES, useApp } from '@/lib/store';
import { CATEGORY_META, useTheme } from '@/lib/theme';
import type { Category, Country } from '@/lib/types';

/** "I need a job" - one short form (trade, experience, where, languages, a few lines, WhatsApp). */
export default function PostSeeker() {
  useStatusBar('plain');
  const c = useTheme();
  const { t } = useI18n();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScreenHeader title={t('needJob')} />
      <PostGate onCancel={() => router.back()}><Form /></PostGate>
    </View>
  );
}

function Form() {
  const c = useTheme();
  const { t, tf, lang } = useI18n();
  const [profile] = useProfile();
  const home = useApp((s) => s.country);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [exp, setExp] = useState('');
  const [f, setF] = useState<SeekerInput>({
    name: profile?.name ?? '', category: 'driver', experience: 0, country: home ?? 'sa', city: null,
    languages: '', text: '', whatsapp: profile?.whatsapp ?? '',
  });
  const upd = <K extends keyof SeekerInput>(k: K) => (v: SeekerInput[K]) => setF((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    setErr(null);
    if (f.name.trim().length < 2 || !f.whatsapp.trim()) return setErr(t('required'));
    const chk = checkPost(`${f.text} ${f.languages}`);
    if (!chk.ok) return setErr(chk.word ? t('scamBlocked').replace('{word}', chk.word) : t('linkBlocked'));
    setBusy(true);
    try {
      await createSeeker({ ...f, experience: Number(exp) || 0 });
      track('seeker_post', { country: f.country, category: f.category });
      router.replace('/my-posts');
    } catch (e) {
      setErr((e as Error)?.message === 'daily-limit' ? t('dailyLimit') : t('errorGeneric'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 2 }} keyboardShouldPersistTaps="handled">
        <Field label={t('yourName')} value={f.name} onChange={upd('name')} required maxLength={60} />
        <Dropdown full noAll searchable label={t('category')} icon="shape" value={f.category}
          options={ALL_CATEGORIES.map((k) => ({ value: k, label: t(`cat.${k}`), icon: CATEGORY_META[k].icon as IconName }))}
          onChange={(v) => v && upd('category')(v as Category)} />
        <View style={{ height: 12 }} />
        <Field label={t('experienceYears')} value={exp} onChange={(v) => setExp(v.replace(/\D/g, '').slice(0, 2))} keyboard="numeric" />
        <Dropdown full noAll label={t('country')} icon="earth" value={f.country}
          options={COUNTRIES.map((cc) => ({ value: cc, label: `${COUNTRY_META[cc].flag}  ${countryName(cc, lang)}` }))}
          onChange={(v) => v && setF((p) => ({ ...p, country: v as Country, city: null }))} />
        <View style={{ height: 10 }} />
        <Dropdown full searchable label={t('city')} icon="map-marker" value={f.city} allLabel={t('allCities')}
          options={CITIES[f.country].map((x) => ({ value: x, label: x }))} onChange={upd('city')} />
        <View style={{ height: 12 }} />
        <Field label={t('languages')} value={f.languages} onChange={upd('languages')} placeholder={t('languagesPh')} maxLength={80} />
        <Field label={t('aboutMe')} value={f.text} onChange={upd('text')} placeholder={t('aboutMePh')} multiline maxLength={600} />
        <Field label={t('whatsapp')} value={f.whatsapp} onChange={upd('whatsapp')} keyboard="phone-pad" placeholder="+92 3XX XXXXXXX" required maxLength={20} />
        {!!err && (
          <View style={{ flexDirection: 'row', gap: 8, padding: 12, borderRadius: 12, backgroundColor: c.dangerSoft, alignItems: 'center' }}>
            <Icon name="alert-circle" size={20} color={c.danger} />
            <Text style={[tf(), { color: c.danger, flex: 1, fontSize: 14 }]}>{err}</Text>
          </View>
        )}
        <View style={{ marginTop: 14 }}>
          <PrimaryButton label={busy ? t('posting') : t('publish')} onPress={submit} busy={busy} icon="check" />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
