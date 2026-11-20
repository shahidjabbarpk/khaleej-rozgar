/**
 * Anti-scam word list. Fake Gulf recruiters ask workers for "visa fee", "processing fee", deposits…
 * A post containing any of these is blocked before it is saved. The same list lives in
 * worker/src/scam.js (checked again server-side) - keep both in sync when you add words.
 * Lower-case; matched as substrings on lower-cased text with spaces collapsed.
 */
export const SCAM_WORDS: string[] = [
  // English
  'visa fee', 'visa charges', 'visa charge', 'visa cost', 'processing fee', 'registration fee', 'registration charges',
  'application fee', 'training fee', 'medical fee', 'ticket fee', 'service charges', 'service fee', 'agent fee',
  'security deposit', 'refundable deposit', 'deposit first', 'pay first', 'advance payment', 'pay in advance',
  'send money', 'western union', 'moneygram', 'money gram', 'easypaisa', 'jazzcash', 'bkash', 'paytm',
  'gift card', 'bitcoin', 'crypto', 'usdt',
  // Roman Urdu / Roman Hindi
  'fees jama', 'fee jama', 'paise jama', 'paisay jama', 'pehle paise', 'pehle payment', 'advance paise', 'visa ke paise',
  'visa ki fees', 'registration ki fees', 'jama karwain', 'jama karayen', 'jama karo',
  // Arabic
  'رسوم التأشيرة', 'رسوم الفيزا', 'رسوم التسجيل', 'رسوم معالجة', 'دفع مقدم', 'دفعة مقدمة', 'تحويل مبلغ', 'ويسترن يونيون', 'تأمين مسترد',
  // Urdu
  'ویزا فیس', 'ویزہ فیس', 'رجسٹریشن فیس', 'فیس جمع', 'پیسے جمع', 'ایڈوانس', 'پروسیسنگ فیس',
  // Hindi
  'वीज़ा फीस', 'वीजा फीस', 'रजिस्ट्रेशन फीस', 'प्रोसेसिंग फीस', 'पैसे जमा', 'एडवांस',
  // Bangla
  'ভিসা ফি', 'রেজিস্ট্রেশন ফি', 'প্রসেসিং ফি', 'টাকা জমা', 'অগ্রিম',
];

const LINK = /(https?:\/\/|www\.|\.com\b|\.net\b|bit\.ly|t\.me\/|wa\.me\/)/i;

export interface ScamCheck {
  ok: boolean;
  word?: string;     // the blocked word
  link?: boolean;    // a link in the text (only verified employers may add links)
}

/** Blocks fee/payment wording; links are blocked unless `allowLinks` (verified employers). */
export function checkPost(text: string, allowLinks = false): ScamCheck {
  const t = text.toLowerCase().replace(/\s+/g, ' ');
  const word = SCAM_WORDS.find((w) => t.includes(w));
  if (word) return { ok: false, word };
  if (!allowLinks && LINK.test(text)) return { ok: false, link: true };
  return { ok: true };
}
