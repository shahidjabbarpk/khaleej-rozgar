import type { Country, Job } from './types';

export const COUNTRIES: Country[] = ['sa', 'ae', 'qa', 'kw', 'om', 'bh'];

/** Flag emoji are fine inside the app (store icon / title stay flag-free). */
export const COUNTRY_META: Record<Country, { flag: string; en: string; ar: string; ur: string; hi: string; bn: string }> = {
  sa: { flag: '🇸🇦', en: 'Saudi Arabia', ar: 'السعودية', ur: 'سعودی عرب', hi: 'सऊदी अरब', bn: 'সৌদি আরব' },
  ae: { flag: '🇦🇪', en: 'UAE (Dubai)', ar: 'الإمارات', ur: 'یو اے ای (دبئی)', hi: 'यूएई (दुबई)', bn: 'আরব আমিরাত (দুবাই)' },
  qa: { flag: '🇶🇦', en: 'Qatar', ar: 'قطر', ur: 'قطر', hi: 'क़तर', bn: 'কাতার' },
  kw: { flag: '🇰🇼', en: 'Kuwait', ar: 'الكويت', ur: 'کویت', hi: 'कुवैत', bn: 'কুয়েত' },
  om: { flag: '🇴🇲', en: 'Oman', ar: 'عُمان', ur: 'عمان', hi: 'ओमान', bn: 'ওমান' },
  bh: { flag: '🇧🇭', en: 'Bahrain', ar: 'البحرين', ur: 'بحرین', hi: 'बहरीन', bn: 'বাহরাইন' },
};

export const CITIES: Record<Country, string[]> = {
  sa: ['Riyadh', 'Jeddah', 'Makkah', 'Madinah', 'Dammam', 'Khobar', 'Dhahran', 'Jubail', 'Taif', 'Tabuk', 'Abha',
    'Khamis Mushait', 'Buraidah', 'Hail', 'Jazan', 'Najran', 'Yanbu', 'Al Ahsa', 'Qatif', 'NEOM'],
  ae: ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah', 'Fujairah', 'Umm Al Quwain', 'Al Ain'],
  qa: ['Doha', 'Al Rayyan', 'Al Wakrah', 'Lusail', 'Al Khor', 'Mesaieed', 'Ras Laffan'],
  kw: ['Kuwait City', 'Hawalli', 'Salmiya', 'Farwaniya', 'Jahra', 'Ahmadi', 'Fahaheel', 'Mubarak Al-Kabeer'],
  om: ['Muscat', 'Seeb', 'Sohar', 'Salalah', 'Nizwa', 'Sur', 'Duqm', 'Ibri', 'Barka'],
  bh: ['Manama', 'Muharraq', 'Riffa', 'Hamad Town', 'Isa Town', 'Sitra', 'Budaiya'],
};

/** Official portals listed on the Govt tab. Most are login-only and for citizens, so we only link to them. */
export const GOVT_PORTALS: { country: Country; name: string; url: string; who: 'locals' | 'expats' | 'mixed' }[] = [
  { country: 'ae', name: 'Dubai Careers (Dubai Government)', url: 'https://dubaicareers.ae/', who: 'mixed' },
  { country: 'ae', name: 'FAHR – UAE Federal Government', url: 'https://www.fahr.gov.ae/', who: 'locals' },
  { country: 'sa', name: 'Jadarat – National Employment Platform', url: 'https://jadarat.sa/', who: 'locals' },
  { country: 'qa', name: 'Ministry of Labour Qatar (Kawader)', url: 'https://www.mol.gov.qa/', who: 'locals' },
  { country: 'kw', name: 'Civil Service Commission Kuwait', url: 'https://www.csc.gov.kw/', who: 'locals' },
  { country: 'om', name: 'Ministry of Labour Oman – Job opportunities', url: 'https://mol.gov.om/', who: 'locals' },
  { country: 'bh', name: 'Civil Service Bureau Bahrain', url: 'https://www.csb.gov.bh/', who: 'locals' },
  { country: 'bh', name: 'LMRA Bahrain (expat work)', url: 'https://www.lmra.gov.bh/', who: 'expats' },
];

export function countryName(c: Country, lang: string): string {
  const m = COUNTRY_META[c] as unknown as Record<string, string>;
  return m[lang] ?? m.en!;
}

/** null country/city = everywhere. Country-wide jobs (no city) match any city. */
export function jobInArea(job: Job, country: Country | null, city: string | null): boolean {
  if (country && job.country !== country) return false;
  if (!city || !job.cities.length) return true;
  return job.cities.some((c) => c.toLowerCase() === city.toLowerCase());
}

/** Known city names inside a free-text location ("Riyadh, Saudi Arabia"). */
export function citiesIn(text: string, country: Country): string[] {
  const t = text.toLowerCase();
  return CITIES[country].filter((c) => t.includes(c.toLowerCase()));
}
