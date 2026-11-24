/**
 * App languages: English + the languages of the people who work in the Gulf.
 * First launch: the phone's own language when the app has it, otherwise English. The user can change it
 * in onboarding or Settings. A switch is instant: NO app restart. Right-to-left languages (Arabic, Urdu,
 * Pashto) are laid out RTL by the root View's `direction` style (see _layout.tsx), not I18nManager, so
 * nothing has to reload. Strings are in lang/*.ts; a missing key falls back to English.
 */
import { useCallback } from 'react';
import { I18nManager, Platform } from 'react-native';
import { ar } from './lang/ar';
import { bn } from './lang/bn';
import { en, type Key } from './lang/en';
import { hi } from './lang/hi';
import { ml } from './lang/ml';
import { ne } from './lang/ne';
import { ps } from './lang/ps';
import { si } from './lang/si';
import { ta } from './lang/ta';
import { tl } from './lang/tl';
import { ur } from './lang/ur';
import { useApp } from './store';
import { font } from './theme';

export type Lang = 'en' | 'ar' | 'ur' | 'hi' | 'bn' | 'ne' | 'ml' | 'ta' | 'si' | 'ps' | 'tl';
export type { Key };

export const LANGS: { code: Lang; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'ar', label: 'العربية' },
  { code: 'ur', label: 'اردو' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'bn', label: 'বাংলা' },
  { code: 'ml', label: 'മലയാളം' },
  { code: 'ta', label: 'தமிழ்' },
  { code: 'ne', label: 'नेपाली' },
  { code: 'si', label: 'සිංහල' },
  { code: 'ps', label: 'پښتو' },
  { code: 'tl', label: 'Tagalog / Filipino' },
];

const dicts: Record<Lang, Partial<Record<Key, string>>> = { en, ar, ur, hi, bn, ne, ml, ta, si, ps, tl };

export const isRtlLang = (l: Lang) => l === 'ar' || l === 'ur' || l === 'ps';

/** The phone's language if the app has it (Filipino = Tagalog), else English. Used on first launch only. */
export function deviceLang(): Lang {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getLocales } = require('expo-localization') as typeof import('expo-localization');
    for (const l of getLocales()) {
      const code = (l.languageCode ?? '').toLowerCase();
      const c = (code === 'fil' ? 'tl' : code) as Lang;
      if (c in dicts) return c;
    }
  } catch {}
  return 'en';
}

/** Translate outside React (background task, notifications). */
export function translate(lang: Lang, key: Key): string {
  return dicts[lang]?.[key] ?? en[key];
}

/** Applies a language at once (no restart). */
export function applyLanguage(lang: Lang) {
  useApp.getState().set({ lang });
}

/**
 * v1.0.0 flipped the whole app with I18nManager.forceRTL + a restart. Undo that once so the native side is
 * always LTR and the root View decides the direction (takes effect on the next start; until then the
 * explicit root `direction` still wins).
 */
export function syncDirection() {
  if (Platform.OS === 'web') return;
  if (I18nManager.isRTL) {
    I18nManager.allowRTL(false);
    I18nManager.forceRTL(false);
  }
}

function fontsFor(lang: Lang) {
  switch (lang) {
    case 'ur': return [font.urdu, font.urduBold];
    case 'ar': return [font.arabic, font.arabicBold];
    case 'hi': return [font.hindi, font.hindiBold];
    case 'bn': return [font.bangla, font.banglaBold];
    case 'ne': return [font.hindi, font.hindiBold];
    case 'ps': return [font.arabic, font.arabicBold];
    case 'ml': return [font.malayalam, font.malayalamBold];
    case 'ta': return [font.tamil, font.tamilBold];
    case 'si': return [font.sinhala, font.sinhalaBold];
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
      ...(rtl ? { writingDirection: 'rtl' as const } : null),
      // Nastaliq is very tall: a fixed lineHeight made for Latin text cuts the 2nd line, so use the font's own
      ...(lang === 'ur' ? { lineHeight: undefined, paddingHorizontal: 3 } : null),
    }),
  };
}
