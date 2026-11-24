/**
 * On-device translation with Google ML Kit (free, offline after the first model download, the job
 * text never leaves the phone). Models are ~30 MB each, so we ask first and use Wi-Fi only by default.
 * Arabic <-> Urdu etc. go through English, so English + the target model are needed.
 * Results are cached per job + language, so a post is never translated twice.
 */
import * as Network from 'expo-network';
import { Platform } from 'react-native';
import { Storage } from './kv';
import type { Lang } from './i18n';

type Mod = {
  translate: (o: { text: string; sourceLanguage: string; targetLanguage: string; downloadModelIfNeeded?: boolean }) => Promise<string>;
};
type IdMod = { identify: (text: string) => Promise<string> };

function mlkit(): { tr: Mod; id: IdMod } | null {
  if (Platform.OS === 'web') return null;
  try {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const tr = require('@react-native-ml-kit/translate-text').default as Mod;
    const id = require('@react-native-ml-kit/identify-languages').default as IdMod;
    return { tr, id };
  } catch {
    return null;
  }
}

export const translationAvailable = () => !!mlkit();

/** App languages that ML Kit can translate into (it has no ml / ne / si / ps models). */
const MLKIT_TARGETS = new Set(['en', 'ar', 'ur', 'hi', 'bn', 'ta', 'tl']);
export const mlkitHas = (l: Lang) => MLKIT_TARGETS.has(l);

/** 'ar', 'en', 'ur'… or 'und' when ML Kit isn't sure (Roman Urdu is often 'und' or 'en'). */
export async function detectLanguage(text: string): Promise<string> {
  const m = mlkit();
  if (!m) return 'und';
  try {
    return (await m.id.identify(text.slice(0, 500))) || 'und';
  } catch {
    return 'und';
  }
}

const packKey = (l: string) => `mlkit-pack-${l}`;

/** Models this phone already downloaded (we track them ourselves; ML Kit keeps them on disk). */
export async function hasPacks(source: string, target: Lang): Promise<boolean> {
  const need = [...new Set([source, target, 'en'])];
  for (const l of need) if (!(await Storage.getItem(packKey(l)))) return false;
  return true;
}

export async function onWifi(): Promise<boolean> {
  try {
    const s = await Network.getNetworkStateAsync();
    return s.type === Network.NetworkStateType.WIFI || s.type === Network.NetworkStateType.ETHERNET;
  } catch {
    return false;
  }
}

/** Never let translation change phone numbers, emails, links or amounts: protect them as tokens. */
function protect(text: string): { masked: string; parts: string[] } {
  const parts: string[] = [];
  const masked = text.replace(/(https?:\/\/\S+|[\w.+-]+@[\w-]+\.[\w.]+|\+?\d[\d\s-]{5,}\d|\d+(?:[.,]\d+)?)/g, (m) => {
    parts.push(m);
    return `⟦${parts.length - 1}⟧`;
  });
  return { masked, parts };
}
const restore = (t: string, parts: string[]) => t.replace(/⟦\s*(\d+)\s*⟧/g, (_m, i) => parts[Number(i)] ?? '');

export async function translateText(jobId: string, text: string, source: string, target: Lang): Promise<string> {
  const cacheKey = `tr-${target}-${jobId}`;
  const cached = await Storage.getItem(cacheKey);
  if (cached) return cached;
  const m = mlkit();
  if (!m) throw new Error('no-mlkit');
  const { masked, parts } = protect(text.slice(0, 4000));
  const out = restore(await m.tr.translate({ text: masked, sourceLanguage: source, targetLanguage: target, downloadModelIfNeeded: true }), parts);
  for (const l of new Set([source, target, 'en'])) await Storage.setItem(packKey(l), '1');
  await Storage.setItem(cacheKey, out);
  return out;
}

/** Forget downloaded packs (ML Kit re-downloads on the next translation after asking again). */
export async function forgetPacks() {
  for (const l of ['en', 'ar', 'ur', 'hi', 'bn']) await Storage.removeItem(packKey(l));
}
