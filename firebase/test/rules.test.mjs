// Firestore security-rules tests (Firebase emulator). Run from the repo root:
//   npx firebase-tools emulators:exec --only firestore --project demo-khaleej "node firebase/test/rules.test.mjs"
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, increment, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';
import { readFileSync } from 'node:fs';

const env = await initializeTestEnvironment({
  projectId: 'demo-khaleej',
  firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') },
});

const user = (uid, provider = 'password') => env.authenticatedContext(uid, { firebase: { sign_in_provider: provider } }).firestore();
const alice = user('alice');
const bob = user('bob');
const carol = user('carol');
const dave = user('dave');
const boss = user('boss');
const guest = user('guest', 'anonymous');
const anon = env.unauthenticatedContext().firestore();
const DAY = 86400000;
const today = () => Math.floor(Date.now() / DAY);

const job = (owner, extra = {}) => ({
  title: 'Heavy Driver', company: 'Abc Transport', category: 'driver', country: 'sa', city: 'Riyadh', eligibility: 'expats',
  salary: '2500 SAR', description: 'Heavy driver needed in Riyadh, room and food provided, Saudi license.',
  whatsapp: '+966500000000', phone: '', email: '', govt: false, officialUrl: '',
  ownerUid: owner, ownerName: 'Alice', verified: false, status: 'active', reportCount: 0,
  createdAt: serverTimestamp(), expiresAt: Date.now() + 30 * DAY, ...extra,
});
const seeker = (owner, extra = {}) => ({
  name: 'Bob', category: 'driver', experience: 5, country: 'ae', city: null, languages: 'Urdu, English', text: 'Light driver, 5 years.',
  whatsapp: '+923001234567', ownerUid: owner, status: 'active', reportCount: 0, createdAt: serverTimestamp(), expiresAt: Date.now() + 30 * DAY, ...extra,
});

/** Same batch the app writes: bump the daily counter + create the post. */
async function post(db, uid, id, data, col = 'jobs', count = 1) {
  const b = writeBatch(db);
  b.set(doc(db, 'profiles', uid), { postDay: today(), postCount: count }, { merge: true });
  b.set(doc(db, col, id), data);
  return b.commit();
}

let passed = 0;
async function t(name, fn) {
  try {
    await fn();
    passed++;
    console.log('  ✓', name);
  } catch (e) {
    console.log('  ✗', name, '\n   ', e.message);
    process.exitCode = 1;
  }
}

await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, 'admins/boss'), { at: 1 });
  for (const u of ['alice', 'bob', 'carol', 'dave', 'boss']) await setDoc(doc(db, 'profiles', u), { name: u, acceptedTermsAt: 1 });
  await setDoc(doc(db, 'profiles/noterms'), { name: 'x' });
  await setDoc(doc(db, 'banned/carol'), { at: 1 });
  await setDoc(doc(db, 'jobs/seed'), job('alice'));
  await setDoc(doc(db, 'seekers/seedS'), seeker('bob'));
});

console.log('Posting');
await t('logged-in user with terms can post a job', () => assertSucceeds(post(alice, 'alice', 'j1', job('alice'))));
await t('guest (anonymous) cannot post', () => assertFails(post(guest, 'guest', 'j2', job('guest'))));
await t('user without accepted terms cannot post', () => assertFails(post(user('noterms'), 'noterms', 'j3', job('noterms'))));
await t('banned user cannot post', () => assertFails(post(carol, 'carol', 'j4', job('carol'))));
await t('cannot post for someone else', () => assertFails(post(bob, 'bob', 'j5', job('alice'))));
await t('cannot give yourself the verified badge', () => assertFails(post(bob, 'bob', 'j6', job('bob', { verified: true }))));
await t('cannot post a govt job (admin only)', () => assertFails(post(bob, 'bob', 'j7', job('bob', { govt: true, officialUrl: 'https://x.gov' }))));
await t('admin can post a govt job with official link', () => assertSucceeds(post(boss, 'boss', 'g1', job('boss', { govt: true, officialUrl: 'https://jadarat.sa/x' }))));
await t('short description is refused', () => assertFails(post(bob, 'bob', 'j8', job('bob', { description: 'too short' }))));
await t('post without any contact is refused', () => assertFails(post(bob, 'bob', 'j9', job('bob', { whatsapp: '' }))));
await t('cannot set expiry beyond 31 days', () => assertFails(post(bob, 'bob', 'j10', job('bob', { expiresAt: Date.now() + 90 * DAY }))));
await t('a post without bumping the daily counter is refused', () => assertFails(setDoc(doc(dave, 'jobs/j11'), job('dave'))));
await t('4th post of the day is refused', async () => {
  await assertSucceeds(post(dave, 'dave', 'd1', job('dave'), 'jobs', 1));
  await assertSucceeds(post(dave, 'dave', 'd2', job('dave'), 'jobs', 2));
  await assertSucceeds(post(dave, 'dave', 'd3', job('dave'), 'jobs', 3));
  await assertFails(post(dave, 'dave', 'd4', job('dave'), 'jobs', 4));
});
await t('"I need a job" post works', () => assertSucceeds(post(bob, 'bob', 's1', seeker('bob'), 'seekers')));

console.log('Reading');
await t('anyone can read an active job', () => assertSucceeds(getDoc(doc(anon, 'jobs/seed'))));
await t('active-jobs query is allowed', () => assertSucceeds(getDocs(query(collection(anon, 'jobs'), where('status', '==', 'active')))));
await t('my-posts query is allowed', () => assertSucceeds(getDocs(query(collection(alice, 'jobs'), where('ownerUid', '==', 'alice')))));
await t('others cannot read a hidden job', async () => {
  await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'jobs/hid'), job('alice', { status: 'hidden' })));
  await assertFails(getDoc(doc(bob, 'jobs/hid')));
  await assertSucceeds(getDoc(doc(alice, 'jobs/hid')));
  await assertSucceeds(getDoc(doc(boss, 'jobs/hid')));
});

console.log('Editing');
await t('owner can edit and renew', () => assertSucceeds(updateDoc(doc(alice, 'jobs/seed'), { title: 'Heavy Truck Driver', expiresAt: Date.now() + 30 * DAY })));
await t('owner cannot set verified / reportCount', () => assertFails(updateDoc(doc(alice, 'jobs/seed'), { verified: true })));
await t('owner cannot un-hide a hidden post', () => assertFails(updateDoc(doc(alice, 'jobs/hid'), { status: 'active' })));
await t('others cannot edit', () => assertFails(updateDoc(doc(bob, 'jobs/seed'), { title: 'Hacked title' })));
await t('owner can delete', () => assertSucceeds(deleteDoc(doc(alice, 'jobs/j1'))));
await t('others cannot delete', () => assertFails(deleteDoc(doc(bob, 'jobs/seed'))));

console.log('Reports + auto-hide');
const reportBatch = (db, uid, id, n, hide = false) => {
  const b = writeBatch(db);
  b.set(doc(db, 'reports', `${id}_${uid}`), { kind: 'job', postId: id, reason: 'scam', note: '', uid, createdAt: serverTimestamp() });
  b.update(doc(db, 'jobs', id), { reportCount: increment(1), ...(hide ? { status: 'hidden' } : {}) });
  return b.commit();
};
await t('reporter can check their own (missing) report doc', () => assertSucceeds(getDoc(doc(bob, 'reports/seed_bob'))));
await t('report + counter +1 works', () => assertSucceeds(reportBatch(bob, 'bob', 'seed', 1)));
await t('second report by the same user is refused', () => assertFails(reportBatch(bob, 'bob', 'seed', 2)));
await t('reporter cannot hide before 3 reports', () => assertFails(reportBatch(dave, 'dave', 'seed', 2, true)));
await t('report without the report doc cannot bump the counter', () => assertFails(updateDoc(doc(dave, 'jobs/seed'), { reportCount: increment(1) })));
await t('3rd report hides the post', async () => {
  await assertSucceeds(reportBatch(dave, 'dave', 'seed', 2));
  await assertSucceeds(reportBatch(boss, 'boss', 'seed', 3, true));
});
await t('reports are admin-only to list', async () => {
  await assertFails(getDocs(collection(bob, 'reports')));
  await assertSucceeds(getDocs(collection(boss, 'reports')));
});

console.log('Verified / admin / account deletion');
await t('users cannot create verified/{uid}', () => assertFails(setDoc(doc(bob, 'verified/bob'), { at: 1 })));
await t('admin can verify an employer', () => assertSucceeds(setDoc(doc(boss, 'verified/bob'), { at: 1 })));
await t('user can request verification', () => assertSucceeds(setDoc(doc(bob, 'verifyRequests/bob'), { company: 'Abc LLC', companyEmail: 'hr@abc.com', crNumber: '1010123456', createdAt: serverTimestamp() })));
await t('user can block someone (own subcollection)', () => assertSucceeds(setDoc(doc(bob, 'profiles/bob/blocked/alice'), { at: 1 })));
await t('user cannot read another profile', () => assertFails(getDoc(doc(bob, 'profiles/alice'))));
await t('owner can delete own seeker post + profile', async () => {
  await assertSucceeds(deleteDoc(doc(bob, 'seekers/s1')));
  await assertSucceeds(deleteDoc(doc(bob, 'profiles/bob')));
});

console.log(`\n${passed} passed${process.exitCode ? ', some FAILED' : ''}`);
await env.cleanup();
