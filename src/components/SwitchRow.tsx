import { StyleSheet, Switch, Text, View } from 'react-native';
import { useI18n } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';
import { Icon, type IconName, Tap } from './ui';

export function SwitchRow({ icon, label, value, onChange }: { icon: IconName; label: string; value: boolean; onChange: (v: boolean) => void }) {
  const c = useTheme();
  const { tf } = useI18n();
  return (
    <View style={styles.row}>
      <Icon name={icon} size={21} color={c.primary} />
      <Text style={[styles.label, tf(), { color: c.text }]}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: c.primary, false: c.border }} thumbColor="#fff" />
    </View>
  );
}

/** Settings row that opens something. */
export function LinkRow({ icon, label, onPress, value, danger }: { icon: IconName; label: string; onPress: () => void; value?: string; danger?: boolean }) {
  const c = useTheme();
  const { tf } = useI18n();
  return (
    <Tap haptic={false} scaleTo={0.99} onPress={onPress} style={styles.row}>
      <Icon name={icon} size={21} color={danger ? c.danger : c.primary} />
      <Text style={[styles.label, tf(), { color: danger ? c.danger : c.text }]}>{label}</Text>
      {!!value && <Text style={[tf(), { color: c.sub, fontSize: 13 }]} numberOfLines={1}>{value}</Text>}
      <Icon name="chevron-right" size={20} color={c.faint} style={{ transform: [{ scaleX: 1 }] }} />
    </Tap>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 54 },
  label: { flex: 1, fontSize: 15 },
});
