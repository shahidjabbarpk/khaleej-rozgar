import { useApp } from './store';
import type { Category } from './types';

// Brand: deep Gulf teal-green (#0B6E4F, trust) + emerald (#08A045) + desert gold (#D4A017).
const light = {
  dark: false,
  bg: '#F7F8F6',
  card: '#FFFFFF',
  cardAlt: '#F0F2EF',
  text: '#1D2420',
  sub: '#5F6B64',
  faint: '#A7B0AA',
  border: '#E6EAE6',
  primary: '#0B6E4F',
  primaryDark: '#07513A',
  primarySoft: '#E2F2EB',
  accent: '#08A045',
  accentSoft: '#DCF5E5',
  gold: '#D4A017',
  danger: '#D93838',
  dangerSoft: '#FCEBEB',
  warn: '#E89B0C',
  ok: '#089A45',
  heroA: '#053D2C',
  heroB: '#0B6E4F',
  heroC: '#08A045',
  shadow: '#0A2A1E',
  tabBar: 'rgba(255,255,255,0.86)',
  glassBorder: 'rgba(255,255,255,0.9)',
};

const dark: typeof light = {
  dark: true,
  bg: '#111413',
  card: '#1C201E',
  cardAlt: '#252A27',
  text: '#EEF2EF',
  sub: '#A2ACA6',
  faint: '#6B746F',
  border: '#2B302D',
  primary: '#2BC48A',
  primaryDark: '#0B6E4F',
  primarySoft: '#12302A',
  accent: '#2BC48A',
  accentSoft: '#12302A',
  gold: '#E8BC3E',
  danger: '#FF6B6B',
  dangerSoft: '#3A1E1E',
  warn: '#FBBF24',
  ok: '#2EE57A',
  heroA: '#021A12',
  heroB: '#053D2C',
  heroC: '#0B6E4F',
  shadow: '#000000',
  tabBar: 'rgba(28,32,30,0.86)',
  glassBorder: 'rgba(255,255,255,0.08)',
};

export type Theme = typeof light;

export function useTheme(): Theme {
  // light unless the user switched Dark mode on (the phone's own theme is ignored)
  return useApp((s) => s.theme) === 'dark' ? dark : light;
}

export const CATEGORY_META: Record<Category, { icon: string; colors: [string, string] }> = {
  driver: { icon: 'steering', colors: ['#0B6E4F', '#08A045'] },
  construction: { icon: 'hard-hat', colors: ['#B45309', '#F59E0B'] },
  cleaning: { icon: 'broom', colors: ['#0E7490', '#22D3EE'] },
  hotel: { icon: 'silverware-fork-knife', colors: ['#9D174D', '#F472B6'] },
  security: { icon: 'shield-account', colors: ['#1E3A8A', '#3B82F6'] },
  sales: { icon: 'storefront', colors: ['#C2410C', '#FB923C'] },
  office: { icon: 'briefcase', colors: ['#334155', '#64748B'] },
  it: { icon: 'laptop', colors: ['#4338CA', '#818CF8'] },
  health: { icon: 'hospital-box', colors: ['#BE123C', '#FB7185'] },
  engineering: { icon: 'cog', colors: ['#3F6212', '#84CC16'] },
  teaching: { icon: 'school', colors: ['#7C3AED', '#C084FC'] },
  delivery: { icon: 'moped', colors: ['#B91C1C', '#F87171'] },
  factory: { icon: 'factory', colors: ['#57534E', '#A8A29E'] },
  other: { icon: 'dots-horizontal-circle', colors: ['#0F766E', '#2DD4BF'] },
};

export const font = {
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semi: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
  urdu: 'NotoNastaliqUrdu_400Regular',
  urduBold: 'NotoNastaliqUrdu_700Bold',
  arabic: 'NotoNaskhArabic_400Regular',
  arabicBold: 'NotoNaskhArabic_700Bold',
  hindi: 'NotoSansDevanagari_400Regular',
  hindiBold: 'NotoSansDevanagari_700Bold',
  bangla: 'NotoSansBengali_400Regular',
  banglaBold: 'NotoSansBengali_700Bold',
  malayalam: 'NotoSansMalayalam_400Regular',
  malayalamBold: 'NotoSansMalayalam_700Bold',
  tamil: 'NotoSansTamil_400Regular',
  tamilBold: 'NotoSansTamil_700Bold',
  sinhala: 'NotoSansSinhala_400Regular',
  sinhalaBold: 'NotoSansSinhala_700Bold',
};
