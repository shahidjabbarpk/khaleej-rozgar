import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkPost } from '../src/lib/scam.ts';
import { categorize, dubaiEligibility, gulfCountry, jobId } from '../src/lib/sources.ts';
import { topicFor, topicsFor } from '../src/lib/topics.ts';
// @ts-expect-error plain JS module
import { validJob } from '../worker/src/index.js';

test('scam filter blocks fee wording in every language', () => {
  assert.equal(checkPost('Driver needed, visa fee 500 SAR').ok, false);
  assert.equal(checkPost('pehle paise jama karwain').ok, false);
  assert.equal(checkPost('مطلوب سائق رسوم التأشيرة').ok, false);
  assert.equal(checkPost('ڈرائیور چاہیے ویزا فیس').ok, false);
  assert.equal(checkPost('Heavy driver needed in Riyadh, salary 2500 SAR, room + food').ok, true);
});

test('links only for verified employers', () => {
  assert.equal(checkPost('apply at www.example.com').link, true);
  assert.equal(checkPost('apply at www.example.com', true).ok, true);
});

test('gulf country detection', () => {
  assert.equal(gulfCountry('Dubai, United Arab Emirates'), 'ae');
  assert.equal(gulfCountry('Riyadh'), 'sa');
  assert.equal(gulfCountry('Doha, Qatar'), 'qa');
  assert.equal(gulfCountry('Manama'), 'bh');
  assert.equal(gulfCountry('Berlin, Germany'), null);
});

test('category from title', () => {
  assert.equal(categorize('Heavy Truck Driver'), 'driver');
  assert.equal(categorize('Staff Nurse'), 'health');
  assert.equal(categorize('Senior Backend Software Engineer'), 'it');
  assert.equal(categorize('Electrician'), 'engineering');
  assert.equal(categorize('Housekeeping attendant'), 'cleaning');
});

test('Dubai Careers eligibility is read, never guessed', () => {
  assert.equal(dubaiEligibility('UAE Only'), 'locals');
  assert.equal(dubaiEligibility('All Nationalities (Priority for UAE National)'), 'anyone');
  assert.equal(dubaiEligibility(''), 'unknown');
});

test('same advert -> same id on every phone and the server', () => {
  assert.equal(jobId('dubaicareers', '26002046'), jobId('dubaicareers', '26002046'));
  assert.match(jobId('greenhouse', 'careem/1'), /^gr-[0-9a-f]{16}$/);
});

test('one topic per job, topics per device', () => {
  assert.equal(topicFor({ country: 'sa', sector: 'private', category: 'driver' }), 'jobs_sa_driver');
  assert.equal(topicFor({ country: 'ae', sector: 'govt', category: 'office' }), 'jobs_ae_govt');
  assert.deepEqual(topicsFor({ notify: true, notifyGovt: true, country: 'qa', categories: ['driver'] }), ['jobs_qa_driver', 'jobs_qa_govt']);
  assert.equal(topicsFor({ notify: true, notifyGovt: false, country: null, categories: ['it', 'driver'] }).length, 12);
  assert.deepEqual(topicsFor({ notify: false, notifyGovt: true, country: 'sa', categories: ['it'] }), []);
});

test('worker only accepts official hosts', () => {
  const ok = { id: 'du-0123456789abcdef', source: 'dubaicareers', country: 'ae', category: 'office', title: 'HR Officer',
    organization: 'Dubai Government', url: 'https://jobs.dubaicareers.ae/careersection/dubaicareers/jobdetail.ftl?job=1' };
  assert.equal(validJob(ok), true);
  assert.equal(validJob({ ...ok, url: 'https://evil.example/job' }), false);
  assert.equal(validJob({ ...ok, title: 'Driver, visa fee required' }), false);
  assert.equal(validJob({ ...ok, id: 'bad' }), false);
});
