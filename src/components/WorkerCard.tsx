import { useState } from 'react';
import { Alert, Linking, StyleSheet, Text, View } from 'react-native';
import { blockUser, currentUid } from '@/lib/community';
import { toIntl } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { COUNTRY_META } from '@/lib/places';
import { CATEGORY_META, font, useTheme } from '@/lib/theme';
import type { Seeker } from '@/lib/types';
import { ReportSheet } from './community';
import { CategoryPill, Icon, type IconName, Tap } from './ui';

/** "I need a job" post. Contact is WhatsApp only (no ad on it). */
export function WorkerCard({ seeker, onBlocked }: { seeker: Seeker; onBlocked?: () => void }) {
  const c = useTheme();
  const { t, tf } = useI18n();
  const [report, setReport] = useState(false);
  const mine = seeker.ownerUid === currentUid();
  const place = [COUNTRY_META[seeker.country]?.flag, seeker.city ?? COUNTRY_META[seeker.country]?.en].filter(Boolean).join(' ');
  return (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
      <View style={styles.top}>
        <View style={[styles.avatar, { backgroundColor: CATEGORY_META[seeker.category].colors[0] }]}>
          <Icon name={CATEGORY_META[seeker.category].icon as IconName} size={24} color="#fff" />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>{seeker.name}</Text>
          <CategoryPill category={seeker.category} />
        </View>
      </View>
      <Text style={[styles.meta, tf(), { color: c.sub }]}>
        {place} • {seeker.experience} {t('yearsExp')}{seeker.languages ? ` • ${t('speaks')}: ${seeker.languages}` : ''}
      </Text>
      {!!seeker.text && <Text style={[styles.text, { color: c.text }]} numberOfLines={5}>{seeker.text}</Text>}
      <View style={styles.actions}>
        {!!seeker.whatsapp && (
          <Tap onPress={() => Linking.openURL(`https://wa.me/${toIntl(seeker.whatsapp)}`).catch(() => {})}
            style={[styles.btn, { backgroundColor: '#25D366' }]}>
            <Icon name="whatsapp" size={20} color="#fff" />
            <Text style={[styles.btnText, tf('bold')]}>{t('whatsapp')}</Text>
          </Tap>
        )}
        {!mine && (
          <>
            <Tap onPress={() => setReport(true)} style={[styles.icon, { backgroundColor: c.cardAlt }]} accessibilityLabel={t('report')}>
              <Icon name="flag-outline" size={20} color={c.danger} />
            </Tap>
            <Tap accessibilityLabel={t('blockUser')} style={[styles.icon, { backgroundColor: c.cardAlt }]}
              onPress={() => Alert.alert(t('blockUser'), '', [
                { text: t('cancel'), style: 'cancel' },
                { text: t('blockUser'), style: 'destructive', onPress: () => blockUser(seeker.ownerUid).then(onBlocked).catch(() => {}) },
              ])}>
              <Icon name="account-cancel-outline" size={20} color={c.sub} />
            </Tap>
          </>
        )}
      </View>
      <ReportSheet visible={report} onClose={() => setReport(false)} kind="seeker" postId={seeker.id} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, marginBottom: 12, borderRadius: 16, padding: 14, borderWidth: 1, gap: 8 },
  top: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  avatar: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: font.semi, fontSize: 16 },
  meta: { fontSize: 13 },
  text: { fontFamily: font.regular, fontSize: 14.5, lineHeight: 21 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  btn: { flex: 1, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', height: 48, borderRadius: 12 },
  btnText: { color: '#fff', fontSize: 15 },
  icon: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
