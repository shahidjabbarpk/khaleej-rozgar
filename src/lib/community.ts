/**
 * Firestore-backed community features: employer job posts, "I need a job" posts, reports/blocks,
 * auto-hide, admin moderation. Every user gets an anonymous Firebase account on first use; posting
 * needs a real login (Google or email/password) + accepted terms. Access control: firebase/firestore.rules.
 */
import {
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  linkWithCredential,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut,
  type AuthCredential,
  type User,
} from '@firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  increment,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore';
import { AUTO_HIDE_REPORTS, FIREBASE_CONFIG, MAX_POSTS_PER_DAY, POST_LIFETIME_DAYS } from './config';
import { fb } from './firebase';
import { googleCredential, googleSignOut } from './google';
import type { Category, Country, Eligibility, Job, PostStatus, Profile, Report, Seeker } from './types';

let signingIn: Promise<string> | null = null;

/** Signed-in uid; concurrent callers share one sign-in so only one anonymous account is ever made. */
export function ensureUser(): Promise<string> {
  let auth: ReturnType<typeof fb>['auth'];
  try {
    auth = fb().auth;
  } catch (e) {
    return Promise.reject(e);
  }
  if (auth.currentUser) return Promise.resolve(auth.currentUser.uid);
  signingIn ??= (async () => {
    // wait for the persisted session to load before deciding to create a new anonymous account
    await auth.authStateReady();
    const restored = auth.currentUser as { uid: string } | null;
    if (restored) return restored.uid;
    return (await signInAnonymously(auth)).user.uid;
  })().finally(() => {
    signingIn = null;
  });
  return signingIn;
}

export const currentUid = () => {
  try {
    return fb().auth.currentUser?.uid ?? null;
  } catch {
    return null;
  }
};

/** True when Firebase is configured for this build. */
export const communityReady = () => !!FIREBASE_CONFIG;

// ------------------------------------------------------------------ accounts (Google / email)

export interface AuthUser { uid: string; guest: boolean; email: string | null; name: string | null }

const toAuthUser = (u: User | null): AuthUser | null =>
  u && { uid: u.uid, guest: u.isAnonymous, email: u.email, name: u.displayName };

/** Calls back with the signed-in user (null while signed out); returns the unsubscribe. */
export function watchAuth(cb: (u: AuthUser | null) => void): () => void {
  try {
    return onAuthStateChanged(fb().auth, (u) => cb(toAuthUser(u)));
  } catch {
    cb(null);
    return () => {};
  }
}

/** A guest's posts stay theirs: link the new login onto the anonymous account when possible. */
async function linkOrSignIn(cred: AuthCredential) {
  const { auth } = fb();
  const cur = auth.currentUser;
  if (cur?.isAnonymous) {
    try {
      await linkWithCredential(cur, cred);
      return;
    } catch (e: any) {
      // that Google account already has a Khaleej Rozgar account: just sign into it
      if (e?.code !== 'auth/credential-already-in-use') throw e;
    }
  }
  await signInWithCredential(auth, cred);
}

export async function signUpEmail(email: string, password: string) {
  await ensureUser().catch(() => {});
  const cur = fb().auth.currentUser;
  if (cur?.isAnonymous) await linkWithCredential(cur, EmailAuthProvider.credential(email.trim(), password));
  else await createUserWithEmailAndPassword(fb().auth, email.trim(), password);
}

export async function signInEmail(email: string, password: string) {
  await signInWithEmailAndPassword(fb().auth, email.trim(), password);
}

/** False when the user closed the Google account picker. */
export async function signInGoogle(): Promise<boolean> {
  await ensureUser().catch(() => {});
  const cred = await googleCredential();
  if (!cred) return false;
  await linkOrSignIn(cred);
  return true;
}

export const resetPassword = (email: string) => sendPasswordResetEmail(fb().auth, email.trim());

/** Back to a fresh guest session. */
export async function signOutUser() {
  await signOut(fb().auth);
  await googleSignOut();
  await ensureUser().catch(() => {});
}

/**
 * Permanently deletes the logged-in account: every job / seeker post it made, its blocks, profile, then
 * the login itself, and starts a fresh guest session. Firebase refuses to delete a login that was
 * not used recently; that surfaces as 'auth/requires-recent-login' (log out, log in, try again).
 */
export async function deleteAccount() {
  const { auth, db } = fb();
  const user = auth.currentUser;
  if (!user || user.isAnonymous) throw new Error('not-logged-in');
  const uid = user.uid;
  const refs = [
    ...(await getDocs(query(collection(db, 'jobs'), where('ownerUid', '==', uid)))).docs.map((d) => d.ref),
    ...(await getDocs(query(collection(db, 'seekers'), where('ownerUid', '==', uid)))).docs.map((d) => d.ref),
    ...(await getDocs(collection(db, 'profiles', uid, 'blocked'))).docs.map((d) => d.ref),
    doc(db, 'profiles', uid),
  ];
  // a batch holds at most 500 writes
  for (let i = 0; i < refs.length; i += 450) {
    const batch = writeBatch(db);
    refs.slice(i, i + 450).forEach((r) => batch.delete(r));
    await batch.commit();
  }
  await deleteUser(user);
  await googleSignOut();
  await ensureUser().catch(() => {});
}

// ------------------------------------------------------------------ profile / roles

export async function loadProfile(): Promise<Profile | null> {
  const uid = await ensureUser();
  const snap = await getDoc(doc(fb().db, 'profiles', uid));
  return snap.exists() ? (snap.data() as Profile) : null;
}

export async function saveProfile(p: Profile): Promise<void> {
  const uid = await ensureUser();
  await setDoc(doc(fb().db, 'profiles', uid), { name: p.name.trim(), whatsapp: p.whatsapp.trim(), country: p.country ?? null, updatedAt: serverTimestamp() }, { merge: true });
}

export async function isAdmin(): Promise<boolean> {
  const uid = await ensureUser();
  try {
    return (await getDoc(doc(fb().db, 'admins', uid))).exists();
  } catch {
    return false;
  }
}

// ------------------------------------------------------------------ terms (UGC policy)

/** Has this account accepted the Terms of Use + Posting Rules? */
export async function hasAcceptedTerms(): Promise<boolean> {
  const uid = await ensureUser();
  const snap = await getDoc(doc(fb().db, 'profiles', uid));
  return !!snap.data()?.acceptedTermsAt;
}

export async function acceptTerms(): Promise<void> {
  const uid = await ensureUser();
  await setDoc(doc(fb().db, 'profiles', uid), { acceptedTermsAt: serverTimestamp() }, { merge: true });
}

// ------------------------------------------------------------------ job posts (employers + admin govt posts)

export const POST_PREFIX = 'u-';

export interface PostInput {
  title: string;
  company: string;
  category: Category;
  country: Country;
  city: string | null;
  eligibility: Eligibility;
  salary: string;
  description: string;
  whatsapp: string;
  phone: string;
  email: string;
  /** admin-only: an official government job with its official link */
  govt?: boolean;
  officialUrl?: string;
}

const DAY = 86_400_000;
/** UTC day number - the Firestore rules compute the same from request.time. */
const today = () => Math.floor(Date.now() / DAY);

export function postToJob(id: string, d: DocumentData): Job {
  const created = d.createdAt instanceof Timestamp ? d.createdAt.toDate().toISOString() : new Date().toISOString();
  return {
    id: POST_PREFIX + id,
    source: d.govt ? 'admin' : 'user',
    sector: d.govt ? 'govt' : 'private',
    title: d.title,
    organization: d.company,
    category: d.category,
    country: d.country,
    cities: d.city ? [d.city] : [],
    eligibility: d.eligibility ?? 'unknown',
    url: d.officialUrl ?? '',
    applyUrl: d.officialUrl || undefined,
    description: d.description,
    salary: d.salary || undefined,
    whatsapp: d.whatsapp || undefined,
    phone: d.phone || undefined,
    email: d.email || undefined,
    postedDate: created.slice(0, 10),
    firstSeen: created,
    ownerUid: d.ownerUid,
    ownerName: d.ownerName,
    verified: !!d.verified,
    status: d.status,
    expiresAt: typeof d.expiresAt === 'number' ? d.expiresAt : undefined,
  };
}

/**
 * Daily limit: profiles/{uid}.postDay / postCount. Firestore rules check the same counter, so a
 * modified app can't post more than MAX_POSTS_PER_DAY a day either.
 */
async function bumpDailyCounter(batch: ReturnType<typeof writeBatch>, uid: string) {
  const ref = doc(fb().db, 'profiles', uid);
  const p = (await getDoc(ref)).data() ?? {};
  const count = p.postDay === today() ? (p.postCount ?? 0) : 0;
  if (count >= MAX_POSTS_PER_DAY) throw new Error('daily-limit');
  batch.set(ref, { postDay: today(), postCount: count + 1 }, { merge: true });
}

const clean = (i: PostInput) => ({
  title: i.title.trim().slice(0, 100),
  company: i.company.trim().slice(0, 80),
  category: i.category,
  country: i.country,
  city: i.city,
  eligibility: i.eligibility,
  salary: i.salary.trim().slice(0, 60),
  description: i.description.trim().slice(0, 2000),
  whatsapp: i.whatsapp.trim().slice(0, 20),
  phone: i.phone.trim().slice(0, 20),
  email: i.email.trim().slice(0, 80),
  govt: !!i.govt,
  officialUrl: i.officialUrl?.trim().slice(0, 300) ?? '',
});

export async function createPost(input: PostInput, ownerName: string, verified: boolean): Promise<string> {
  const uid = await ensureUser();
  const { db } = fb();
  const ref = doc(collection(db, 'jobs'));
  const batch = writeBatch(db);
  await bumpDailyCounter(batch, uid);
  batch.set(ref, {
    ...clean(input),
    ownerUid: uid,
    ownerName: ownerName.trim().slice(0, 60),
    verified,
    status: 'active',
    reportCount: 0,
    createdAt: serverTimestamp(),
    expiresAt: Date.now() + POST_LIFETIME_DAYS * DAY,
  });
  await batch.commit();
  return POST_PREFIX + ref.id;
}

export async function updatePost(jobId: string, input: PostInput) {
  await updateDoc(doc(fb().db, 'jobs', jobId.replace(POST_PREFIX, '')), clean(input));
}

/** Another 30 days. */
export async function renewPost(jobId: string) {
  await updateDoc(doc(fb().db, 'jobs', jobId.replace(POST_PREFIX, '')), {
    expiresAt: Date.now() + POST_LIFETIME_DAYS * DAY, status: 'active',
  });
}

export async function deletePost(jobId: string) {
  await deleteDoc(doc(fb().db, 'jobs', jobId.replace(POST_PREFIX, '')));
}

/** Active, unexpired posts, 1 page (keeps Firestore reads inside the free plan). */
export async function fetchActivePosts(country: Country | null, max = 60): Promise<Job[]> {
  const { db } = fb();
  await ensureUser();
  const cons = [where('status', '==', 'active'), where('expiresAt', '>', Date.now())];
  if (country) cons.push(where('country', '==', country));
  const snap = await getDocs(query(collection(db, 'jobs'), ...cons, orderBy('expiresAt', 'desc'), limit(max)));
  const blocked = new Set(await blockedUids());
  return snap.docs.map((d) => postToJob(d.id, d.data())).filter((j) => !blocked.has(j.ownerUid ?? ''));
}

export async function fetchMyPosts(): Promise<Job[]> {
  const uid = await ensureUser();
  const snap = await getDocs(query(collection(fb().db, 'jobs'), where('ownerUid', '==', uid)));
  return snap.docs.map((d) => postToJob(d.id, d.data()));
}

// ------------------------------------------------------------------ "I need a job" posts

export interface SeekerInput {
  name: string;
  category: Category;
  experience: number;
  country: Country;
  city: string | null;
  languages: string;
  text: string;
  whatsapp: string;
}

const toSeeker = (id: string, x: DocumentData): Seeker => ({
  id, ownerUid: x.ownerUid, name: x.name, category: x.category, experience: x.experience ?? 0, country: x.country,
  city: x.city ?? null, languages: x.languages ?? '', text: x.text ?? '', whatsapp: x.whatsapp ?? '',
  createdAt: x.createdAt instanceof Timestamp ? x.createdAt.toMillis() : Date.now(),
});

export async function createSeeker(input: SeekerInput): Promise<string> {
  const uid = await ensureUser();
  const { db } = fb();
  const ref = doc(collection(db, 'seekers'));
  const batch = writeBatch(db);
  await bumpDailyCounter(batch, uid);
  batch.set(ref, {
    name: input.name.trim().slice(0, 60),
    category: input.category,
    experience: Math.max(0, Math.min(50, Math.round(input.experience))),
    country: input.country,
    city: input.city,
    languages: input.languages.trim().slice(0, 80),
    text: input.text.trim().slice(0, 600),
    whatsapp: input.whatsapp.trim().slice(0, 20),
    ownerUid: uid,
    status: 'active',
    reportCount: 0,
    createdAt: serverTimestamp(),
    expiresAt: Date.now() + POST_LIFETIME_DAYS * DAY,
  });
  await batch.commit();
  return ref.id;
}

export async function fetchSeekers(country: Country | null, max = 40): Promise<Seeker[]> {
  const { db } = fb();
  await ensureUser();
  const cons = [where('status', '==', 'active'), where('expiresAt', '>', Date.now())];
  if (country) cons.push(where('country', '==', country));
  const snap = await getDocs(query(collection(db, 'seekers'), ...cons, orderBy('expiresAt', 'desc'), limit(max)));
  const blocked = new Set(await blockedUids());
  return snap.docs.map((d) => toSeeker(d.id, d.data())).filter((s) => !blocked.has(s.ownerUid));
}

export async function fetchMySeekers(): Promise<Seeker[]> {
  const uid = await ensureUser();
  const snap = await getDocs(query(collection(fb().db, 'seekers'), where('ownerUid', '==', uid)));
  return snap.docs.map((d) => toSeeker(d.id, d.data()));
}

export async function deleteSeeker(id: string) {
  await deleteDoc(doc(fb().db, 'seekers', id));
}

// ------------------------------------------------------------------ reports / blocks

export const REPORT_REASONS = ['scam', 'money', 'fakeGovt', 'wrong', 'offensive', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

/**
 * One report per user per post (doc id = postId_uid). The post's report counter goes up by one;
 * at AUTO_HIDE_REPORTS the post hides itself (the rules allow exactly that +1 / hide write).
 */
export async function report(kind: 'job' | 'seeker', postId: string, reason: ReportReason, note = '') {
  const uid = await ensureUser();
  const { db } = fb();
  const id = postId.replace(POST_PREFIX, '');
  const repRef = doc(db, 'reports', `${id}_${uid}`);
  if ((await getDoc(repRef)).exists()) return;
  const postRef = doc(db, kind === 'job' ? 'jobs' : 'seekers', id);
  const post = (await getDoc(postRef)).data();
  const batch = writeBatch(db);
  batch.set(repRef, { kind, postId: id, reason, note: note.slice(0, 300), uid, createdAt: serverTimestamp() });
  if (post) {
    const n = (post.reportCount ?? 0) + 1;
    batch.update(postRef, { reportCount: increment(1), ...(n >= AUTO_HIDE_REPORTS ? { status: 'hidden' } : {}) });
  }
  await batch.commit();
}

let blockedCache: string[] | null = null;

export async function blockUser(otherUid: string) {
  const uid = await ensureUser();
  await setDoc(doc(fb().db, 'profiles', uid, 'blocked', otherUid), { at: serverTimestamp() });
  blockedCache = null;
}

async function blockedUids(): Promise<string[]> {
  if (blockedCache) return blockedCache;
  try {
    const uid = await ensureUser();
    blockedCache = (await getDocs(collection(fb().db, 'profiles', uid, 'blocked'))).docs.map((d) => d.id);
  } catch {
    blockedCache = [];
  }
  return blockedCache;
}

// ------------------------------------------------------------------ verified employers

export async function requestVerification(company: string, companyEmail: string, crNumber: string) {
  const uid = await ensureUser();
  await setDoc(doc(fb().db, 'verifyRequests', uid), {
    company: company.trim().slice(0, 80), companyEmail: companyEmail.trim().slice(0, 80),
    crNumber: crNumber.trim().slice(0, 40), createdAt: serverTimestamp(),
  });
}

/** Set by the admin only (verified/{uid} doc, by hand in the Firebase console). */
export async function isVerifiedEmployer(): Promise<boolean> {
  const uid = await ensureUser();
  try {
    return (await getDoc(doc(fb().db, 'verified', uid))).exists();
  } catch {
    return false;
  }
}

// ------------------------------------------------------------------ admin moderation

export async function fetchHidden(): Promise<Job[]> {
  const snap = await getDocs(query(collection(fb().db, 'jobs'), where('status', '==', 'hidden'), limit(100)));
  return snap.docs.map((d) => postToJob(d.id, d.data()));
}

export async function fetchReports(): Promise<Report[]> {
  const snap = await getDocs(query(collection(fb().db, 'reports'), orderBy('createdAt', 'desc'), limit(100)));
  return snap.docs.map((d) => {
    const x = d.data();
    return { id: d.id, kind: x.kind, postId: x.postId, reason: x.reason, uid: x.uid,
      createdAt: x.createdAt instanceof Timestamp ? x.createdAt.toMillis() : 0 } as Report;
  });
}

export async function moderatePost(jobId: string, status: PostStatus) {
  await updateDoc(doc(fb().db, 'jobs', jobId.replace(POST_PREFIX, '')), { status, ...(status === 'active' ? { reportCount: 0 } : {}) });
}

export async function dismissReport(id: string) {
  await deleteDoc(doc(fb().db, 'reports', id));
}

export async function banUser(uid: string) {
  await setDoc(doc(fb().db, 'banned', uid), { at: serverTimestamp() });
}
