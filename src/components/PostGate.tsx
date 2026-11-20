import { type ReactNode, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { communityReady, hasAcceptedTerms } from '@/lib/community';
import { useI18n } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';
import { AuthCard, isLoggedIn, useAuthUser } from './AuthCard';
import { TermsSheet } from './community';
import { EmptyState } from './ui';

/**
 * Play UGC policy: posting needs a real login AND accepted Terms of Use + Posting Rules.
 * Children render only when both are true.
 */
export function PostGate({ children, onCancel }: { children: ReactNode; onCancel: () => void }) {
  const c = useTheme();
  const { t } = useI18n();
  const user = useAuthUser();
  const [terms, setTerms] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isLoggedIn(user)) return;
    hasAcceptedTerms().then(setTerms).catch(() => setTerms(false));
  }, [user]);

  if (!communityReady()) return <EmptyState icon="cloud-off-outline" title={t('communityOff')} hint="" />;
  if (user === undefined) return <ActivityIndicator color={c.primary} style={{ marginTop: 40 }} />;
  if (!isLoggedIn(user)) return <View style={{ paddingTop: 8 }}><AuthCard /></View>;
  if (terms === null) return <ActivityIndicator color={c.primary} style={{ marginTop: 40 }} />;
  if (!terms) return <TermsSheet visible onClose={(ok) => (ok ? setTerms(true) : onCancel())} />;
  return <>{children}</>;
}
