import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { SlideInDown } from 'react-native-reanimated';
import { acceptTerms, loadProfile, report, REPORT_REASONS, type ReportReason, saveProfile } from '@/lib/community';
import { useI18n } from '@/lib/i18n';
import { useApp } from '@/lib/store';
import { font, useTheme } from '@/lib/theme';
import type { Profile } from '@/lib/types';
import { Icon, Tap } from './ui';

/** Cached profile; fetched from Firestore once if this device has none yet. */
export function useProfile(): [Profile | null, (p: Profile) => Promise<void>] {
  const profile = useApp((s) => s.profile);
  const set = useApp((s) => s.set);
  useEffect(() => {
    if (!profile) loadProfile().then((p) => p && set({ profile: p })).catch(() => {});
  }, [profile, set]);
  const save = async (p: Profile) => {
    await saveProfile(p);
    set({ profile: p });
  };
  return [profile, save];
}

export function Field({ label, value, onChange, placeholder, multiline, keyboard, required, maxLength, error }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean;
  keyboard?: 'default' | 'phone-pad' | 'numeric' | 'email-address' | 'url'; required?: boolean; maxLength?: number;
  error?: string | null; // shown under the box, which turns red
}) {
  const c = useTheme();
  const { tf } = useI18n();
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={[styles.label, tf('bold'), { color: c.sub }]}>{label}{required ? ' *' : ''}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={c.faint}
        multiline={multiline}
        keyboardType={keyboard}
        autoCapitalize={keyboard === 'email-address' || keyboard === 'url' ? 'none' : undefined}
        maxLength={maxLength}
        style={[styles.input, multiline && styles.multi, { backgroundColor: c.card, borderColor: error ? c.danger : c.border, color: c.text }]}
      />
      {!!error && <Text style={[tf(), { color: c.danger, fontSize: 12.5, marginTop: 4 }]}>{error}</Text>}
    </View>
  );
}

export function PrimaryButton({ label, onPress, busy, icon, color, disabled }: {
  label: string; onPress: () => void; busy?: boolean; icon?: React.ComponentProps<typeof Icon>['name']; color?: string; disabled?: boolean;
}) {
  const c = useTheme();
  const { tf } = useI18n();
  return (
    <Tap onPress={onPress} disabled={busy || disabled}
      style={[styles.btn, { backgroundColor: color ?? c.primary, opacity: disabled ? 0.5 : 1 }]}>
      {busy ? <ActivityIndicator color="#fff" /> : (
        <View style={styles.btnRow}>
          {icon && <Icon name={icon} size={20} color="#fff" />}
          <Text style={[styles.btnText, tf('bold')]}>{label}</Text>
        </View>
      )}
    </Tap>
  );
}

// ------------------------------------------------------------------ terms (shown before the first post)

export function TermsSheet({ visible, onClose }: { visible: boolean; onClose: (accepted: boolean) => void }) {
  const c = useTheme();
  const { t, tf } = useI18n();
  const [tick, setTick] = useState(false);
  const [busy, setBusy] = useState(false);
  const agree = async () => {
    setBusy(true);
    try {
      await acceptTerms();
      onClose(true);
    } catch {
      onClose(false);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => onClose(false)}>
      <Pressable style={styles.backdrop} onPress={() => onClose(false)}>
        <Animated.View entering={SlideInDown.duration(220)} style={[styles.sheet, { backgroundColor: c.card }]}>
          <Pressable>
            <ScrollView style={{ maxHeight: 460 }}>
              <Text style={[styles.title, tf('bold'), { color: c.text }]}>{t('termsTitle')}</Text>
              <Text style={[tf(), { color: c.text, fontSize: 15, lineHeight: 24 }]}>{t('termsBody')}</Text>
            </ScrollView>
            <Tap onPress={() => setTick(!tick)} style={styles.tickRow}>
              <Icon name={tick ? 'checkbox-marked' : 'checkbox-blank-outline'} size={26} color={tick ? c.primary : c.sub} />
              <Text style={[tf(), { color: c.text, fontSize: 14, flex: 1 }]}>{t('termsAgree')}</Text>
            </Tap>
            <PrimaryButton label={t('agree')} onPress={agree} busy={busy} disabled={!tick} icon="check" />
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

// ------------------------------------------------------------------ report

export function ReportSheet({ visible, onClose, kind, postId }: {
  visible: boolean; onClose: (done: boolean) => void; kind: 'job' | 'seeker'; postId: string;
}) {
  const c = useTheme();
  const { t, tf } = useI18n();
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState('');
  const [done, setDone] = useState(false);
  const close = (ok: boolean) => {
    setReason(null);
    setNote('');
    setDone(false);
    onClose(ok);
  };
  const send = async () => {
    if (!reason) return;
    setBusy(true);
    try {
      await report(kind, postId, reason, note);
      setDone(true);
      setTimeout(() => close(true), 1200);
    } catch {
      close(false);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => close(false)}>
      <Pressable style={styles.backdrop} onPress={() => close(false)}>
        <Animated.View entering={SlideInDown.duration(220)} style={[styles.sheet, { backgroundColor: c.card }]}>
          <Pressable>
            <Text style={[styles.title, tf('bold'), { color: c.text }]}>{done ? t('reportDone') : t('reportTitle')}</Text>
            {!done && (
              <>
                {REPORT_REASONS.map((r) => (
                  <Tap key={r} disabled={busy} onPress={() => setReason(r)} style={[styles.reason, { borderColor: c.border }]}>
                    <Icon name={reason === r ? 'radiobox-marked' : 'radiobox-blank'} size={22} color={reason === r ? c.danger : c.sub} />
                    <Text style={[tf(), { color: c.text, fontSize: 15, flex: 1 }]}>{t(`reason.${r}`)}</Text>
                  </Tap>
                ))}
                <TextInput value={note} onChangeText={setNote} placeholder={t('reportNote')} placeholderTextColor={c.faint} maxLength={300}
                  style={[styles.input, { backgroundColor: c.bg, borderColor: c.border, color: c.text, marginVertical: 12 }]} />
                <PrimaryButton label={t('reportSend')} onPress={send} busy={busy} disabled={!reason} color={c.danger} icon="flag" />
              </>
            )}
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, fontFamily: font.regular, fontSize: 16 },
  multi: { minHeight: 120, textAlignVertical: 'top' },
  btn: { height: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnText: { color: '#fff', fontSize: 16 },
  backdrop: { flex: 1, backgroundColor: '#0008', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 34 },
  title: { fontSize: 18, marginBottom: 12 },
  reason: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth },
  tickRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14 },
});
