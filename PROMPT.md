# Khaleej Rozgar: Gulf Jobs — build prompt (v2, 2026-11-20)

Base: Shahid's Claude-chat prompt (`Downloads\Gulf job app Claude Code prompt.txt`), merged with what PakJobs Daily already does and Shahid's own rules.
**Where this file differs from the original prompt, THIS file wins.** Sections marked 🆕 are new. Sections marked ✏️ change the original.

> Status: DRAFT. Shahid has to OK it before any code is written.

---

## 0. Ground rules (read first)

- **3-phase rule (Shahid):**
  1. **Code.** Write the code, then give a SHORT Roman Urdu summary. Do NOT build an APK or AAB.
  2. **Build.** Only when Shahid says "AAB or APK file bna do". Build once, then test it on the emulator (`Medium_Phone_API_37.0`).
  3. **Upload.** Ask "Console par upload kar doon?" before any Play Console upload.
- Replies to Shahid: Roman Urdu, short.
- Everything goes on **E:** (`E:\Projects\khaleej-rozgar`). Never put anything on C:, not even temp builds or backups.
- **Never change `E:\Projects\pakjobs-daily`.** Copy code out of it; never edit it in place.
- **All developer accounts are Shahid's own "shahidjabbarpk" Google account**, the same one PakJobs uses: Firebase/GCP, AdMob, Expo, GitHub, Play. Never use the mdanishsi543 account or the PakJobs Firebase project.
- Everything stays on free tiers. Never pay for anything.
- When something needs Shahid's own login or password, add a row to `E:\Claude-Handover\SHAHID-TODO.md` and keep working on the other parts.
- Lists with more than about 6 items (country, city, category, nationality) must be **searchable dropdowns** (bottom sheet + search box). Never a wall of chips. Copy `src/components/Dropdown.tsx` from PakJobs.
- Look: professional. No bouncy or zoom entrance animations. Light theme is the default, with only a Dark switch.

## 1. ✏️ Stack and project setup (replaces original STEP 0)

PakJobs is **Expo 57 / React Native 0.86**, not Flutter or Kotlin. Use the same stack: expo-router (`src/app`), zustand + expo-sqlite kv, Reanimated, react-native-google-mobile-ads, expo-notifications, expo-background-task, @react-native-firebase/app + analytics + messaging, and the firebase JS SDK for Firestore/Auth.

1. Copy `E:\Projects\pakjobs-daily` to `E:\Projects\khaleej-rozgar`. Do NOT copy `node_modules`, `android/`, `release/`, `credentials/`, `google-services.json`, `*.log`, `data/` or `marketing/`.
2. Remove the Pakistan-only parts:
   - Remove: NJP/PPSC/FPSC/Army/Navy/PAF/NTS sources, Exam Center, MCQs, past papers, BPS/domicile fields, Easypaisa "Featured", PakJobs keys and IDs.
   - Keep: the job list, job detail, search, Dropdown, ads.tsx, notify.ts, background.ts, feed.ts, detect.ts (re-target it), CV maker, share, saved jobs, store-review prompt, analytics events.
3. **App identity:**
   - name `Khaleej Rozgar`
   - slug `khaleej-rozgar`
   - scheme `khaleejrozgar`
   - Android package **`com.khaleejrozgar.jobs.mza`** (pattern `com.<x>.mza`)
   - version 1.0.0, versionCode 1
4. Run `git init`, then create a **private** GitHub repo `shahidjabbarpk/khaleej-rozgar`. A public data repo is also needed for the feed (see §5). Option: make the app repo private and add a small **public** repo `shahidjabbarpk/khaleej-rozgar-feed` that holds only `data/*.json` plus the Actions workflow.
5. Create an upload keystore in `credentials/` and back it up to `E:\Projects\_backups\khaleej-rozgar-keystore`. `keystore.properties` stays gitignored.
6. Build commands: copy the PakJobs pattern (`npm run apk` / `npm run aab` run `make-seed` → `expo prebuild --clean` → gradle; JDK 17, `ANDROID_HOME=E:\Android\Sdk`). Run them ONLY in phase 2.

## 2. ✏️ Language (changes original STEP 1.1)

- Languages: English (en), Arabic (ar), Urdu (ur), Hindi (hi), Bangla (bn).
- **The default is always English** after install. The app does NOT switch itself to the phone's language.
- The user changes the language in **Settings → Language**. Show each language in its own script: English, العربية, اردو, हिन्दी, বাংলা. Add the same picker as an optional row on the first onboarding screen, with English already selected.
- Extend PakJobs' own `src/lib/i18n.ts` (today it only has `Lang = 'en' | 'ur'`) to all 5 languages. Keep all strings in one file per language. Mark machine-written strings `// TODO native check`.
- **RTL for ar/ur:** call `I18nManager.forceRTL` and then reload the app with `expo-updates` `reloadAsync` or `DevSettings`. Use `start`/`end` in styles, never `left`/`right`. Mirror arrow icons. Check every screen in Arabic and Urdu.
- **Fonts:**
  - Urdu: Noto Nastaliq Urdu (already in PakJobs)
  - Arabic: Noto Naskh Arabic or Noto Sans Arabic
  - Hindi: Noto Sans Devanagari
  - Bangla: Noto Sans Bengali
  - Load them through `@expo-google-fonts/*`.
- Add `android:localeConfig` (Expo config plugin) so the Android 13+ system "App languages" setting lists the 5 languages too.

Onboarding (original STEP 1.5) stays at most 3 screens:
(a) language row (English preselected) and country (6 flag buttons; city through the searchable Dropdown, with "All cities"),
(b) job categories + "Who are you?",
(c) "Turn on job alerts" (§6).

## 3. UI, categories, local vs expat — keep the original STEPs 2 and 3

Keep them as written, with these changes:
- Bottom tabs: **Jobs · Govt Jobs 🆕 · Post (+) · Alerts · Me**.
- The "Workers" ("I need a job") list moves under Jobs as a segment: `Jobs | Workers`. Govt jobs get their own tab because they are a big search term.
- The "Who can apply" tags stay: Locals only / Expats welcome / Visa provided / Anyone / Not stated. Govt jobs from nationals-only portals are tagged **Locals only** automatically.

## 4. 🆕 Government jobs (replaces original STEP 3.3 "admin only, no scraping")

Research done on 2026-11-20. These are the official free sources. **None of them has a public API or RSS feed.** Most of them are in Arabic, and most are **for citizens only**.

| Country | Official source | Who can apply | How the app uses it |
|---|---|---|---|
| Saudi Arabia | **Jadarat** jadarat.sa (HRDF, unified govt + private employment platform; replaced Taqat/Jadarah) | Saudi nationals only | Public job search pages, if they exist without login → detector. Otherwise link + admin posts |
| Saudi Arabia | Military/ministry recruitment announcements (MOD, MOI, National Guard portals) | Nationals | Admin posts with the official link only (portals change every intake) |
| UAE | **Dubai Careers** dubaicareers.ae (Digital Dubai, 45+ Dubai govt entities: RTA, DHA, Police…) | **Residents AND international applicants (expats OK)** | Best source → detector (public listing pages) |
| UAE | Federal (FAHR) / Abu Dhabi government careers | Mostly nationals | Phase 1: verify URLs; link + admin posts |
| Qatar | **Kawader** (Ministry of Labour national employment platform, govt + private) | Mainly Qatari nationals | Public listing if available → detector, else link |
| Kuwait | Civil Service Commission (csc.gov.kw) + e.gov.kw employment services | Kuwaiti nationals | Link + admin posts (no public vacancy list found) |
| Oman | Ministry of Labour single-window job portal (civil + military + private) | Mainly Omani nationals | Verify in phase 1 → detector or link |
| Bahrain | Civil Service Bureau vacancies on **bahrain.bh** (National Portal) + LMRA Talent Portal for expats (private) | CSB = nationals; LMRA = expats | bahrain.bh public vacancy pages → detector if possible |

**Rules for govt jobs:**
1. **Phase-1 source check:** before writing any parser, open every source above. Record in `docs/GOVT-SOURCES.md`:
   - whether a public listing exists without login,
   - its URL or JSON endpoint,
   - what `robots.txt` allows,
   - whether the site's terms forbid automated access,
   - whether GitHub/AWS/Cloudflare IPs get geo-blocked. PakJobs lesson: PPSC/Army/Navy blocked foreign servers, and only the phone could read them.

   Only automate pages that are public and allowed. Fetch politely: at most 1 request per source every 30 minutes, and use the real app User-Agent.
2. Every govt job keeps `sourceUrl` (the original advert) and `applyUrl` (the official portal). "Apply" always opens the official site in a Custom Tab.
3. Disclaimer on the Govt tab, on every govt job, and in the store listing: *"Khaleej Rozgar is not affiliated with any government. Information is taken from public official websites (jadarat.sa, dubaicareers.ae, …). Always apply on the official website. Never pay any fee."* No government logos, emblems or flags in the icon or title.
4. Sources with no public list still show up on the Govt tab as an **"Official portals" directory**: one card per country with the portal link and a note on who is eligible. On top of that, the admin (Shahid's uid, `admins/{uid}` like PakJobs) can post a govt job by hand. Each admin post must include the official link.
5. An Arabic-only advert gets the ML Kit translation (original STEP 6) with "Auto-translated" + "Show original".

## 5. 🆕 Auto-update: one device finds a new job → everyone gets notified

PakJobs today only notifies **the same phone** that found the job (local notification). Khaleej Rozgar must alert **all** users. Every part below is free.

```
             ┌────────────── GitHub Actions (hourly, public feed repo) ──────────────┐
 govt sites ─┤ scraper/scrape.py → data/jobs.json, data/govt.json                     │
 Careerjet  ─┤ (through the relay, see §8)                                            │
             │ new ids → FCM HTTP v1 topic push  (service-account JSON = GH secret)   │
             └──────────────────────────────┬────────────────────────────────────────┘
                                            │ raw.githubusercontent / jsDelivr feed
  phone A (active) ─ feed + phone-only sources (geo-blocked from servers)
        │  finds job X that isn't in the feed
        ▼
  POST /found  (Cloudflare Worker, free 100k req/day)
     • checks Firebase App Check token (Play Integrity, free)
     • schema + max lengths, source host allow-list (only official govt hosts)
     • dedupe: D1 (free SQLite, 100k writes/day) table seen(id, firstSeen)
     • rate limit: max 20 finds/device/day
     • new → write to Firestore `deviceFinds/{id}` + FCM topic push
  ▼
  FCM topics  jobs_all, jobs_<cc>  (cc = sa ae qa kw om bh),  jobs_<cc>_govt, jobs_<cc>_<category>
  ▼
  phones B, C, D … get "New job: …" → tap → job detail (deep link, NO ad on this open)
```

- The **feed workflow** pushes for every job it finds itself. The Worker pushes for jobs a phone finds. Both use the same job id (sha1 of `source+url+title`), so a job is never pushed twice. The Worker checks D1, and the workflow checks the `seen` ids in `data/meta.json` and also asks the Worker `/seen?ids=`.
- The next feed run merges `deviceFinds` (read through the Firestore REST API) into `data/jobs.json`, so a phone that was offline still sees the job later.
- Phone side: copy PakJobs `refreshJobs` + `mergePhoneSources` + the `expo-background-task` 30-minute task. Then:
  - after `ingest()`, the phone reports the new phone-only finds to `/found`;
  - the phone does NOT show its own local notification for a job it reported, because the topic push will arrive.
- Fallback: if the Worker cron or FCM signing goes over the free limits, the GitHub Actions workflow does all the pushing every hour (5-minute schedule = still free on a public repo).
- Topic subscription: `@react-native-firebase/messaging` `subscribeToTopic`. When country, city or categories change, re-subscribe and unsubscribe from the old topics.
- Free-tier budget:
  - FCM: unlimited
  - Worker: 100k requests/day
  - D1: 5M reads + 100k writes/day
  - Firestore: 50k reads + 20k writes/day
  - App Check (Play Integrity): 10k/day standard
  - **Rule:** the app never reads Firestore just to list feed jobs. The list comes from the JSON feed; Firestore is only for user posts.

## 6. ✏️ Notifications: ON by default (replaces original STEP 5.1–5.2)

This is the PakJobs lesson (its next update fixes it too): alerts were effectively OFF until the user enabled them, so few people opened the app.

1. The store default is `notify: true`, with all categories on for the chosen country. Subscribe to the FCM topics **right after onboarding**, with no extra tap.
2. **Android 13+:** on the **first launch** (onboarding "Turn on job alerts" step), show one simple line, *"We'll tell you when new jobs come in your country"*, and then request `POST_NOTIFICATIONS` at runtime. Below Android 13 nothing needs to be asked.
3. If the user denies it, never nag. The Alerts tab shows a small bell banner, "Alerts are off – Turn on", which opens the system notification settings. Check `getPermissionsAsync()` before scheduling anything.
4. **Settings → Notifications:**
   - a master switch (unsubscribes from all topics)
   - a separate "Govt jobs" switch
   - category switches
   - a "Deadline reminders" switch
5. Android channels: `new-jobs` (HIGH), `govt-jobs` (HIGH), `my-posts`, `reminders`. Notification colour = brand colour.
6. Tapping a notification deep-links to the job (`khaleejrozgar://job/<id>`). **No interstitial on that open.**
7. Keep the PakJobs deadline reminders (3 days + 1 day before `lastDate`) for saved jobs that have a last date.

## 7. ✏️ Ads — PakJobs style (replaces original STEP 9.6)

These are Shahid's rules, and they override the "no interstitial" line in the original prompt. Use **REAL AdMob IDs** from Shahid's own AdMob account. The publisher is `pub-2214888899948620`, the same account as PakJobs.

1. Create a new AdMob app "Khaleej Rozgar" (Android) with 5 units:
   - App Open
   - Banner
   - Native
   - Interstitial (display only, no long video)
   - Rewarded (spare)

   Use test IDs in `__DEV__`, like PakJobs `useTest`. The real IDs go in `src/lib/config.ts` → `PROD_AD_UNITS` and `app.json` `androidAppId`.
2. **App start:** one **App Open ad** on a cold start, after the splash.
   - Use the App Open format, not an interstitial. AdMob forbids interstitials on app launch, but allows App Open ads.
   - Never on the very first launch (onboarding).
   - Never when the app was opened from a notification.
   - At most once every 4 hours.
3. **Job opens:** NOT every click. Job opens 1 and 2 are free, the **3rd open shows an interstitial**, then 4 and 5 are free and the 6th shows one, and so on. Use PakJobs `adOnOpen()` with the counter changed to every 3rd. If an ad isn't ready, it stays "due" for the next open.
4. **"Apply Now":** an interstitial when the user taps Apply. The Careerjet or official page opens **after the ad closes**. If the ad fails, the page opens straight away (the PakJobs `afterAd` pattern).
   - Skip the ad if any full-screen ad showed in the last 60 s.
   - Call / WhatsApp buttons on user posts get no ad.
5. **So the user isn't annoyed:**
   - No full-screen ad in the first 30 s after launch, except App Open.
   - A 60-second floor between any two full-screen ads (`FULLSCREEN_GAP_MS`).
   - At most 1 per screen change.
   - Never during the posting forms, onboarding, Back, app exit, or a notification open.
6. Banner: anchored adaptive banner at the bottom of the list screens, with padding so it doesn't touch the tabs or buttons.
7. Native: one native card every 8 jobs in the list, clearly marked "Ad"/"Sponsored".
8. Add Google UMP consent for EEA/UK users. Ask for no other tracking permission.
9. **app-ads.txt:** `https://itgreenservices.com/app-ads.txt` already has `google.com, pub-2214888899948620, DIRECT, f08c47fec0942fa0` (checked 2026-11-20). The Play listing website must be `https://itgreenservices.com`. After Play publishing, AdMob → app → "Verify app".

## 8. ✏️ Data sources — private jobs (changes original STEP 4A)

- Careerjet v4: locales en_SA, en_AE, en_QA, en_KW, en_OM. **Bahrain has no locale**, so Bahrain shows user posts + govt (bahrain.bh) jobs + a note.
- ⚠️ **Careerjet requires declared FIXED server IPs** (the PakJobs lesson). A Cloudflare Worker has no fixed IP, so Careerjet calls go through the existing relay on the marketing-bot EC2 (`cj.18.139.102.249.sslip.io`, declared IP 18.139.102.249).
  - Add a route for this app; do not touch the bot.
  - The Worker (or a Vercel function, as in PakJobs `proxy/`) caches the results for 30–60 min.
- Careerjet terms tie a key to a registered website. Khaleej Rozgar needs its own site and approved key:
  - The site: a small Vercel site `khaleej-rozgar.vercel.app`, with job pages + SEO like PakJobs `proxy/build.mjs`, later also used for marketing.
  - **Never use the itgreenservices Careerjet key.**
- The rest of STEP 4 stays as written (Firebase Spark, Firestore collections, strict rules + emulator tests, no phone OTP, text-only posts).
- The Firebase project is new, on Shahid's own account (e.g. `khaleej-rozgar-sj`). Not the PakJobs project.

## 9. Keep the original STEPs 6, 7, 8, 10 as written

That is ML Kit translation, posting, anti-scam, and tests. For Expo, use `@react-native-ml-kit/identify-languages` + `@react-native-ml-kit/translate-text`, or a small config plugin if those don't fit Expo 57. In tests, add unit tests for:
- the ad counter (3rd open, Apply, App Open rules)
- the topic-name builder
- the `/found` validation (Worker)
- the dedupe

## 10. 🆕 Logo and store graphics

- Professional and simple, and readable at 48 px.
- **Concept:** a white briefcase whose handle is a stylised **arch/dome** (Gulf architecture), with a small rising-sun/location dot. Background: deep **teal-green → emerald gradient** (#0B6E4F → #08A045) with a thin **gold** (#D4A017) accent.
- No text in the icon. No country flags, government emblems or religious symbols.
- **Deliverables:**
  - an SVG master in `assets/brand/`
  - generated with a script (sharp/resvg):
    - `icon.png` 1024
    - adaptive `android-icon-foreground.png` (safe zone 66%) + background colour
    - monochrome icon
    - `notification-icon.png` (white silhouette)
    - `splash-icon.png`
  - `store-listing/icon-512.png`
  - `store-listing/feature-graphic-1024x500.png` (logo + "Gulf Jobs · وظائف الخليج · گلف نوکریاں" + the 6 country names; no flags)
- Show Shahid 2–3 icon options as PNGs first, and use the one he picks.

## 11. 🆕 ASO store listing (draft; finalise in `store-listing/listing.md`)

Rules learned on PakJobs:
- No "free", "best", "#1", "top" or "new" in the title or short description (Play flags promo words).
- Repeat the main keywords 3–5 times, naturally, in the full description.
- Country names go in the title or short description because those are what people search.

**Keywords:**
- English: gulf jobs, jobs in saudi arabia, saudi jobs, ksa jobs, riyadh jobs, jeddah jobs, dubai jobs, uae jobs, abu dhabi jobs, sharjah jobs, qatar jobs, doha jobs, kuwait jobs, oman jobs, muscat jobs, bahrain jobs, government jobs, govt jobs, driver jobs, visa jobs, overseas jobs, job alert, gulf naukri, saudi naukri, dubai naukri
- Arabic: وظائف، وظائف الخليج، وظائف السعودية، وظائف دبي، وظائف الإمارات، وظائف قطر، وظائف الكويت، وظائف عمان، وظائف البحرين، وظائف حكومية، وظائف شاغرة
- Urdu: گلف نوکری، سعودی عرب نوکری، دبئی نوکری، سرکاری نوکریاں

### English (en-US, default)
- **Title (25/30):** `Khaleej Rozgar: Gulf Jobs`
- **Short (76/80):** `Gulf jobs: Saudi Arabia, Dubai UAE, Qatar, Kuwait, Oman, Bahrain & govt jobs`
- **Full description outline:**
  - **Hook line:** "Find jobs in Saudi Arabia, Dubai & UAE, Qatar, Kuwait, Oman and Bahrain – private and government jobs, job alerts, in English, Arabic, Urdu, Hindi and Bangla."
  - **Sections (text only, no flag images):**
    - "JOBS IN SAUDI ARABIA (KSA): Riyadh, Jeddah, Dammam…"
    - "DUBAI & UAE JOBS: Dubai, Abu Dhabi, Sharjah…"
    - "QATAR JOBS: Doha…"
    - "KUWAIT JOBS"
    - "OMAN JOBS: Muscat…"
    - "BAHRAIN JOBS: Manama…"
    - "GOVERNMENT JOBS (from official portals)"
    - "Driver, construction, cleaning, hotel, security, sales, office, IT, nursing, engineering jobs"
    - "Locals only / Expats welcome / Visa provided labels"
    - "Job alerts"
    - "Post a job / I need a job – free"
    - "Auto-translate"
    - "Safety: never pay any fee"
    - "CV maker"
  - **Then** the non-affiliation disclaimer + source list + "never pay to get a job".
  - Website https://itgreenservices.com · Privacy https://itgreenservices.com/app/privacy

### Arabic (ar) translation
- **Title (25):** `خليج روزگار: وظائف الخليج` (or keep the Latin brand: `Khaleej Rozgar: وظائف الخليج`; pick whichever fits 30)
- **Short (78):** `وظائف الخليج: السعودية، دبي الإمارات، قطر، الكويت، عمان، البحرين ووظائف حكومية`
- Full: a native-quality Arabic version of the English text, not a word-for-word copy, with the disclaimer.

### Urdu (ur) translation
- **Title (24):** `خلیج روزگار: گلف نوکریاں`
- **Short (77):** `گلف نوکریاں: سعودی عرب، دبئی یو اے ای، قطر، کویت، عمان، بحرین، سرکاری نوکریاں`
- Full: Urdu version + disclaimer.

Optional later: hi-IN and bn-BD translations (large worker audiences).

**Graphics:** feature graphic (§10) + 6–8 phone screenshots with captions in English (and Arabic/Urdu sets for those listings). Capture them from the emulator in phase 2.

## 12. ✏️ Play Console and policy (changes original STEP 9)

- **Store settings:**
  - email `support@itgreenservices.com`
  - website `https://itgreenservices.com`
  - tags such as Job seeking, Job interview, Productivity, Lifestyle (pick the ones that fit)
- **Privacy policy URL:** `https://itgreenservices.com/app/privacy` (terms: `/app/terms`). The in-app links point there too. No GitHub/vercel privacy page.
- **Content rating questionnaire email:** `zahidlatif.dev@gmail.com`. The IARC Terms tick is Shahid's own.
- **New-app setup:** fill every App content form truthfully, without asking:
  - ads = yes
  - target audience 18+
  - data safety: Firebase Auth/Firestore, FCM token, AdMob (approx location, device IDs), crash logs/diagnostics, app interactions, user-posted content, email for login
  - encrypted in transit = yes
  - deletion = in app + web link
  - government info = Yes, with sources
  - UGC
  - AI declaration
- **Account deletion:** in-app + a web form (original STEP 9.2).
- **Internal testing:** testers = the **"Fsd"** email list. Claude may roll out internal testing itself.
- **Production:** upload the AAB, fill everything, and **save it as a DRAFT only**. Never press "Send for review" or "Start rollout" for production; Shahid submits it himself. Report "draft ready".
- Shahid ticks the Google Create-app declaration checkboxes himself.
- After Play upload: add the Play App Signing SHA-1 to Firebase. Link the Play app to AdMob.

## 13. Deliverables (phase 1 = code only)

- `E:\Projects\khaleej-rozgar` app code (separate from PakJobs), passing `npm run typecheck` + unit tests + Firestore rules emulator tests
- `scraper/` + `.github/workflows/scrape.yml` (feed + FCM push), `worker/` (`/found`, `/seen`, D1 schema, wrangler.toml), relay route, Vercel site
- `docs/GOVT-SOURCES.md`, `README.md` (simple English)
- `store-listing/listing.md` (en/ar/ur), data-safety answers, logo options
- **NO APK/AAB until Shahid says "AAB or APK file bna do". NO Play upload until he says "haan".**

## 14. Items only Shahid can do (row in SHAHID-TODO.md when reached)

- Cloudflare account login (`wrangler login`)
- Careerjet publisher login → register the Khaleej Rozgar site → paste the new API key
- Firebase console ToS acceptance for the new project (if asked)
- Play Console Create-app checkboxes + IARC Terms tick + the final production "Send for review"
