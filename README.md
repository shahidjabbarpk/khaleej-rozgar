# Khaleej Rozgar: Gulf Jobs

A free Android app (Expo 57 / React Native) with jobs in Saudi Arabia, UAE, Qatar, Kuwait, Oman and Bahrain. It earns money from AdMob only, and everything runs on free plans.
Package: `com.khaleejrozgar.jobs.mza`. Prompt and decisions: `PROMPT.md`. Government sources: `docs/GOVT-SOURCES.md`. Store text: `store-listing/listing.md`.

## How new jobs reach every user (fully automatic, free)
1. **Every hour, GitHub Actions** (`.github/workflows/feed.yml`) runs `scraper/build-feed.ts`. It uses the same code as the app (`src/lib/sources.ts`) and:
   - reads Dubai Government jobs (official Dubai Careers JSON) and the company job boards;
   - writes `data/jobs.json`;
   - sends **one FCM topic push** per new job group (`jobs_<country>_<category>`, `jobs_<country>_govt`).
2. **Phones.** Every open app refreshes from the feed. If the feed is older than 2 hours, an active phone checks the sources itself (at most once an hour). It sends new finds to the **Cloudflare Worker** (`worker/`, `POST /found`). The Worker:
   - checks App Check, the official-host allow-list, the scam words and the rate limit;
   - removes duplicates in D1;
   - pushes to the same FCM topics, so all other users get the alert;
   - lets the next feed run collect the finds from `GET /finds`.
3. **Fallback.** Without Firebase/topics, the phone's 30-minute background task shows local alerts itself.

Notifications are **ON by default**: topics are subscribed right after onboarding. Android 13+ asks for POST_NOTIFICATIONS on the first launch. Settings and the Alerts tab can switch them off.

## Ads (`src/lib/ads.tsx`)
- **App Open ad** on a cold start. Not on the first launch, not when the app was opened from a notification, and at most once every 4 hours.
- **Interstitial** on every 3rd job opened, and on "Apply Now".
- **Banner** at the bottom of list screens, plus a rectangle banner on the job detail screen.
- **Native card** every 8 jobs.
- At least 60 s between full-screen ads, and none in the first 30 s.

Real AdMob ids go in `PROD_AD_UNITS` (src/lib/config.ts) and `androidAppId` (app.json). Until then the app shows Google test ads.

## Commands
```
npm install
npm run typecheck
npm test                  # scam filter, topics, sources, worker validation
npm run feed              # build data/jobs.json now (push only with FIREBASE_SERVICE_ACCOUNT)
npx expo start --web      # quick look in the browser (no ads/push on web)
npm run aab / npm run apk # ONLY when Shahid says "AAB or APK file bna do"
python scripts/make-icons.py --option a   # logo option a/b/c -> all icons + store images
node scripts/sync-scam.mjs                # after editing the scam word list
```

## Set up once (phase 2)
1. **Firebase:** create a new project on Shahid's account, e.g. `khaleej-rozgar-sj`, with an Android app `com.khaleejrozgar.jobs.mza`.
   - Put `google-services.json` in the root and the web config in `FIREBASE_CONFIG`.
   - Enable Anonymous + Google + Email login.
   - `firebase deploy --only firestore`.
   - Make admin: create `admins/<your uid>`. Verified employer: create `verified/<uid>`.
2. **App Check:** Play Integrity provider. Its project number goes in `worker/wrangler.toml`.
3. **GitHub:** create a public repo `shahidjabbarpk/khaleej-rozgar` (the feed must be public). Add these secrets:
   - `FIREBASE_SERVICE_ACCOUNT` (the service account JSON)
   - `WORKER_URL`
   - `FEED_KEY`
4. **Worker:** `cd worker && npx wrangler login && npx wrangler d1 create khaleej-rozgar`. Then:
   - set `database_id`;
   - run `npx wrangler d1 execute khaleej-rozgar --remote --file=schema.sql`;
   - add the secrets `FIREBASE_SERVICE_ACCOUNT` and `FEED_KEY`;
   - run `npx wrangler deploy`;
   - put the URL in `EXPO_PUBLIC_WORKER_URL` / `WORKER_URL`.
5. **AdMob:** create the app "Khaleej Rozgar" with 4 units (app open, banner, native, interstitial).
6. **Keystore:** `credentials/upload-keystore.jks`, with a backup in `E:\Projects\_backups\khaleej-rozgar-keystore`.

## Moderation
- Posts with 3 reports hide themselves. Review them in the app (Me → Admin) or in the Firebase console.
- Scam words: `src/lib/scam.ts`. After editing it, run `node scripts/sync-scam.mjs` for the Worker.
- Limits: 3 posts a day per user, posts expire after 30 days, and links only for verified employers.
- Account deletion: in the app (Me → Delete my account). It deletes the login, profile, posts and blocks. Reports are kept for fraud prevention.

## Play Console rules
- Contact email: support@itgreenservices.com. Website: itgreenservices.com. Privacy: https://itgreenservices.com/app/privacy.
- Internal testing: the "Fsd" testers list.
- **Production stays a DRAFT.** Shahid submits it himself.
