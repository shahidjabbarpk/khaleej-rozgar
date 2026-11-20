import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Field, PrimaryButton } from '@/components/community';
import { PostGate } from '@/components/PostGate';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useStatusBar } from '@/components/ui';
import { requestVerification } from '@/lib/community';
import { useI18n } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';

/** Employer asks for the verified badge; the admin checks by hand and creates verified/{uid}. */
export default function Verify() {
  useStatusBar('plain');
  const c = useTheme();
  const { t, tf } = useI18n();
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [cr, setCr] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const send = async () => {
    if (company.trim().length < 2 || !/@/.test(email) || cr.trim().length < 4) return setMsg(t('required'));
    setBusy(true);
    try {
      await requestVerification(company, email, cr);
      setMsg(t('verifySent'));
      setTimeout(() => router.back(), 1500);
    } catch {
      setMsg(t('errorGeneric'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScreenHeader title={t('verifyEmployer')} />
      <PostGate onCancel={() => router.back()}>
        <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
          <Text style={[tf(), { color: c.sub, fontSize: 14, marginBottom: 14 }]}>{t('verifyHint')}</Text>
          <Field label={t('verifyCompany')} value={company} onChange={setCompany} required maxLength={80} />
          <Field label={t('verifyEmail')} value={email} onChange={setEmail} keyboard="email-address" required maxLength={80} />
          <Field label={t('verifyCr')} value={cr} onChange={setCr} required maxLength={40} />
          {!!msg && <Text style={[tf(), { color: c.primary, marginBottom: 10 }]}>{msg}</Text>}
          <PrimaryButton label={t('reportSend')} onPress={send} busy={busy} icon="send" />
        </ScrollView>
      </PostGate>
    </View>
  );
}
