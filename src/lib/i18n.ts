/**
 * App languages: English (default after install), Arabic, Urdu, Hindi, Bangla.
 * The app never switches by itself - the user picks a language in Settings (or onboarding).
 * Arabic + Urdu are right-to-left: switching to/from them restarts the app once (I18nManager).
 * Strings are in lang/*.ts; a missing key falls back to English.
 */
import { useCallback } from 'react';
import { DevSettings, I18nManager, Platform } from 'react-native';
import { ar } from './lang/ar';
import { bn } from './lang/bn';
import { en, type Key } from './lang/en';
import { hi } from './lang/hi';
import { ur } from './lang/ur';
import { useApp } from './store';
import { font } from './theme';

export type Lang = 'en' | 'ar' | 'ur' | 'hi' | 'bn';
export type { Key };

export const LANGS: { code: Lang; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'ar', label: 'العربية' },
  { code: 'ur', label: 'اردو' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'bn', label: 'বাংলা' },
];

const dicts: Record<Lang, Partial<Record<Key, string>>> = { en, ar, ur, hi, bn };

export const isRtlLang = (l: Lang) => l === 'ar' || l === 'ur';

/** Translate outside React (background task, notifications). */
export function translate(lang: Lang, key: Key): string {
  return dicts[lang]?.[key] ?? en[key];
}

/** Applies a language. Returns true when the app must restart for the RTL/LTR switch. */
export function applyLanguage(lang: Lang): boolean {
  useApp.getState().set({ lang });
  const rtl = isRtlLang(lang);
  if (Platform.OS === 'web' || I18nManager.isRTL === rtl) return false;
  I18nManager.allowRTL(rtl);
  I18nManager.forceRTL(rtl);
  // layout direction only changes after a JS reload
  setTimeout(() => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('react-native-restart').default.restart();
    } catch {
      DevSettings.reload();
    }
  }, 900);
  return true;
}

/** Keeps the native layout direction in sync with the saved language (call once on launch). */
export function syncDirection(lang: Lang) {
  if (Platform.OS === 'web') return;
  const rtl = isRtlLang(lang);
  if (I18nManager.isRTL !== rtl) {
    I18nManager.allowRTL(rtl);
    I18nManager.forceRTL(rtl);
  }
}

function fontsFor(lang: Lang) {
  switch (lang) {
    case 'ur': return [font.urdu, font.urduBold];
    case 'ar': return [font.arabic, font.arabicBold];
    case 'hi': return [font.hindi, font.hindiBold];
    case 'bn': return [font.bangla, font.banglaBold];
    default: return [font.regular, font.semi];
  }
}

export function useI18n() {
  const lang = useApp((s) => s.lang);
  const t = useCallback((key: Key) => dicts[lang]?.[key] ?? en[key], [lang]);
  const rtl = isRtlLang(lang);
  const [reg, bold] = fontsFor(lang);
  return {
    t,
    lang,
    isRtl: rtl,
    /** text style for UI strings in the current language (job titles from sources keep Poppins) */
    tf: (weight: 'regular' | 'bold' = 'regular') => ({
      fontFamily: weight === 'bold' ? bold : reg,
      // RN flips start/end itself once I18nManager is RTL; only the writing direction is set here
      ...(rtl ? { writingDirection: 'rtl' as const } : null),
    }),
  };
}
