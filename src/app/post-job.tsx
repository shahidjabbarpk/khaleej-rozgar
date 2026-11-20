import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useProfile, Field, PrimaryButton } from '@/components/community';
import { Dropdown } from '@/components/Dropdown';
import { PostGate } from '@/components/PostGate';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SwitchRow } from '@/components/SwitchRow';
import { EligibilityTag, Icon, type IconName, useStatusBar } from '@/components/ui';
import { track } from '@/lib/analytics';
import { createPost, fetchMyPosts, isVerifiedEmployer, type PostInput, updatePost } from '@/lib/community';
import { refreshJobs } from '@/lib/feed';
import { useI18n } from '@/lib/i18n';
import { CITIES, COUNTRIES, COUNTRY_META, countryName } from '@/lib/places';
import { checkPost } from '@/lib/scam';
import { ALL_CATEGORIES, useApp } from '@/lib/store';
import { CATEGORY_META, font, useTheme } from '@/lib/theme';
import type { Category, Country, Eligibility } from '@/lib/types';

const ELIG: Eligibility[] = ['expats', 'visa', 'anyone', 'locals'];

/** "Post a job" in 3 short steps: (1) type + title, (2) place, who can apply, salary, description, (3) contact + preview. */
export default function PostJob() {
  useStatusBar('plain');
  const c = useTheme();
  const { t } = useI18n();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScreenHeader title={t('postJob')} />
      <PostGate onCancel={() => router.back()}><Form /></PostGate>
    </View>
  );
}

function Form() {
  const c = useTheme();
  const { t, tf, lang } = useI18n();
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const admin = useApp((s) => s.admin);
  const home = useApp((s) => s.country);
  const [profile, saveProfile] = useProfile();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [f, setF] = useState<PostInput>({
    title: '', company: '', category: 'driver', country: home ?? 'sa', city: null, eligibility: 'expats',
    salary: '', description: '', whatsapp: profile?.whatsapp ?? '', phone: '', email: '', govt: false, officialUrl: '',
  });
  const upd = <K extends keyof PostInput>(k: K) => (v: PostInput[K]) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    isVerifiedEmployer().then(setVerified).catch(() => {});
    if (!edit) return;
    fetchMyPosts().then((list) => {
      const j = list.find((x) => x.id === edit);
      if (j) setF({ title: j.title, company: j.organization, category: j.category, country: j.country, city: j.cities[0] ?? null,
        eligibility: j.eligibility, salary: j.salary ?? '', description: j.description ?? '', whatsapp: j.whatsapp ?? '',
        phone: j.phone ?? '', email: j.email ?? '', govt: j.sector === 'govt', officialUrl: j.applyUrl ?? '' });
    }).catch(() => {});
  }, [edit]);

  const next = () => {
    setErr(null);
    if (step === 1 && (f.title.trim().length < 3 || f.company.trim().length < 2)) return setErr(t('required'));
    if (step === 2) {
      if (f.description.trim().length < 30) return setErr(t('tooShort'));
      const chk = checkPost(`${f.title} ${f.company} ${f.salary} ${f.description}`, verified || admin);
      if (!chk.ok) return setErr(chk.word ? t('scamBlocked').replace('{word}', chk.word) : t('linkBlocked'));
    }
    setStep(step + 1);
  };

  const submit = async () => {
    setErr(null);
    if (!f.whatsapp.trim() && !f.phone.trim() && !f.email.trim()) return setErr(t('contactNeeded'));
    if (f.govt && !/^https:\/\//.test(f.officialUrl ?? '')) return setErr(t('officialLink'));
    setBusy(true);
    try {
      if (!profile) await saveProfile({ name: f.company, whatsapp: f.whatsapp, country: f.country });
      if (edit) await updatePost(edit, f);
      else await createPost(f, profile?.name ?? f.company, verified);
      track('job_post', { country: f.country, category: f.category });
      refreshJobs().catch(() => {});
      router.replace('/my-posts');
    } catch (e) {
      setErr((e as Error)?.message === 'daily-limit' ? t('dailyLimit') : t('errorGeneric'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={styles.steps}>
          {[1, 2, 3].map((n) => (
            <View key={n} style={[styles.stepDot, { backgroundColor: n <= step ? c.primary : c.border }]} />
          ))}
        </View>
        <Text style={[styles.stepText, tf('bold'), { color: c.sub }]}>{t('step')} {step}/3</Text>

        {step === 1 && (
          <>
            <Label text={t('category')} />
            <Dropdown full noAll searchable label={t('category')} icon="shape" value={f.category}
              options={ALL_CATEGORIES.map((k) => ({ value: k, label: t(`cat.${k}`), icon: CATEGORY_META[k].icon as IconName }))}
              onChange={(v) => v && upd('category')(v as Category)} />
            <View style={{ height: 14 }} />
            <Field label={t('jobTitle')} value={f.title} onChange={upd('title')} placeholder={t('jobTitlePh')} required maxLength={100} />
            <Field label={t('company')} value={f.company} onChange={upd('company')} required maxLength={80} />
            {admin && <SwitchRow icon="bank" label={t('govtPostToggle')} value={!!f.govt} onChange={upd('govt')} />}
          </>
        )}

        {step === 2 && (
          <>
            <Label text={t('country')} />
            <Dropdown full noAll label={t('country')} icon="earth" value={f.country}
              options={COUNTRIES.map((cc) => ({ value: cc, label: `${COUNTRY_META[cc].flag}  ${countryName(cc, lang)}` }))}
              onChange={(v) => v && setF((p) => ({ ...p, country: v as Country, city: null }))} />
            <View style={{ height: 10 }} />
            <Dropdown full searchable label={t('city')} icon="map-marker" value={f.city} allLabel={t('allCities')}
              options={CITIES[f.country].map((x) => ({ value: x, label: x }))} onChange={upd('city')} />
            <View style={{ height: 14 }} />
            <Label text={t('whoCanApply')} />
            <Dropdown full noAll label={t('whoCanApply')} icon="account-check" value={f.eligibility}
              options={ELIG.map((k) => ({ value: k, label: t(`elig.${k}`) }))} onChange={(v) => v && upd('eligibility')(v as Eligibility)} />
            <View style={{ height: 14 }} />
            <Field label={t('salary')} value={f.salary} onChange={upd('salary')} placeholder={t('salaryPh')} maxLength={60} />
            <Field label={t('description')} value={f.description} onChange={upd('description')} placeholder={t('descriptionPh')} multiline required maxLength={2000} />
            {f.govt && <Field label={t('officialLink')} value={f.officialUrl ?? ''} onChange={upd('officialUrl')} keyboard="url" placeholder="https://" required />}
          </>
        )}

        {step === 3 && (
          <>
            <Text style={[styles.h, tf('bold'), { color: c.text }]}>{t('contact')}</Text>
            <Field label={t('whatsapp')} value={f.whatsapp} onChange={upd('whatsapp')} keyboard="phone-pad" placeholder="+966 5X XXX XXXX" maxLength={20} />
            <Field label={t('phone')} value={f.phone} onChange={upd('phone')} keyboard="phone-pad" maxLength={20} />
            <Field label={t('email')} value={f.email} onChange={upd('email')} keyboard="email-address" maxLength={80} />
            <Text style={[styles.h, tf('bold'), { color: c.text }]}>{t('preview')}</Text>
            <View style={[styles.preview, { backgroundColor: c.card, borderColor: c.border }]}>
              <Text style={[styles.pTitle, { color: c.text }]}>{f.title}</Text>
              <Text style={[styles.pOrg, { color: c.sub }]}>{f.company} • {COUNTRY_META[f.country].flag} {f.city ?? countryName(f.country, lang)}</Text>
              <View style={{ flexDirection: 'row', marginTop: 6 }}>
                <EligibilityTag job={{ eligibility: f.eligibility } as never} />
              </View>
              {!!f.salary && <Text style={[styles.pOrg, { color: c.ok, marginTop: 6 }]}>{f.salary}</Text>}
              <Text style={[styles.pDesc, { color: c.text }]} numberOfLines={6}>{f.description}</Text>
            </View>
          </>
        )}

        {!!err && (
          <View style={[styles.err, { backgroundColor: c.dangerSoft }]}>
            <Icon name="alert-circle" size={20} color={c.danger} />
            <Text style={[tf(), { color: c.danger, flex: 1, fontSize: 14 }]}>{err}</Text>
          </View>
        )}

        <View style={styles.nav}>
          {step > 1 && (
            <View style={{ flex: 1 }}><PrimaryButton label={t('back')} onPress={() => setStep(step - 1)} color={c.sub} icon="arrow-left" /></View>
          )}
          <View style={{ flex: 2 }}>
            {step < 3 ? <PrimaryButton label={t('next')} onPress={next} icon="arrow-right" />
              : <PrimaryButton label={busy ? t('posting') : t('publish')} onPress={submit} busy={busy} icon="check" />}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Label({ text }: { text: string }) {
  const c = useTheme();
  const { tf } = useI18n();
  return <Text style={[{ fontSize: 13, marginBottom: 6, color: c.sub }, tf('bold')]}>{text}</Text>;
}

const styles = StyleSheet.create({
  steps: { flexDirection: 'row', gap: 6 },
  stepDot: { flex: 1, height: 5, borderRadius: 3 },
  stepText: { fontSize: 13, marginTop: 8, marginBottom: 14 },
  h: { fontSize: 16, marginBottom: 10, marginTop: 4 },
  preview: { borderRadius: 16, borderWidth: 1, padding: 14 },
  pTitle: { fontFamily: font.semi, fontSize: 17 },
  pOrg: { fontFamily: font.medium, fontSize: 13.5, marginTop: 2 },
  pDesc: { fontFamily: font.regular, fontSize: 14, marginTop: 8, lineHeight: 20 },
  err: { flexDirection: 'row', gap: 8, padding: 12, borderRadius: 12, marginTop: 12, alignItems: 'center' },
  nav: { flexDirection: 'row', gap: 10, marginTop: 18 },
});
