# Khaleej Rozgar v1.0.1: fix list (from Shahid's phone test, 2026-11-24)

Source: `E:\Projects\APP-TESTING-CHECKLIST.md`.
**Status: plan only.** No code changes and no build yet. Start this after the Europe app, and only when Shahid says so. Then do one AAB/APK build at the end.

| # | Point | File(s) | What to change |
|---|---|---|---|
| 1 | Full localization | `src/lib/lang/*.ts`, every screen in `src/app/**`, `src/components/**` | Find hard-coded English (`grep "'[A-Z][a-z]"` in tsx). Add every key to `en.ts` and all other languages. |
| 2 | Gulf nationality languages | `src/lib/i18n.ts` (`Lang`, `LANGS`, `dicts`, `fontsFor`), new `src/lib/lang/{ne,si,ta,ps,ml,tl}.ts`, `src/lib/theme.ts` (fonts), `app.json` (font assets) | Add Nepali, Sinhala, Tamil, Pashto (RTL), Malayalam and Tagalog. Add `ps` to `isRtlLang`. Load Noto fonts for Sinhala, Tamil and Malayalam. |
| 3 | Europe languages | – | Not for this app; that's the Europe app. |
| 4 | Default = device language | `src/lib/store.ts` (initial `lang`), `src/lib/i18n.ts`, add `expo-localization` | On first launch, use `getLocales()[0].languageCode` if it is in `LANGS`, otherwise `en`. The current comment says "never switches by itself", so change that. |
| 5 | Switch in 1–2 s, no restart | `src/lib/i18n.ts` `applyLanguage` (now `forceRTL` + `react-native-restart`), `src/lib/store.ts` `selfRestartAt`, `src/lib/ads.tsx` (restart skip) | Drop `forceRTL`/restart. Keep `I18nManager` LTR and do RTL ourselves: `direction: rtl ? 'rtl' : 'ltr'` on the root View, plus `flexDirection: 'row-reverse'` and `textAlign` via a `useI18n().rtl` helper in `ui.tsx` and the cards. Check that strings and fonts don't reload slowly; dicts are static imports. |
| 6 | Listing in every app language + ASO | `store-listing/listing-i18n.json`, Play Console | Add the new languages from #2 (ne, si, ta, ps, ml, fil). |
| 7 | Screenshots in each language's own UI | `store-listing/screenshots/<lang>/` (new) | On the emulator, switch language → take 5 shots per language → crop out the ads (PIL), then do tablet composites. Upload a feature graphic for each language. |
| 8 | Banner space only when the ad has loaded | `src/lib/ads.tsx` `BottomBanner` / `InlineBanner` | Add a `loaded` state set in `onAdLoaded`. Until then, the wrapper gets `height: 0` / `overflow: hidden` (the BannerAd must stay mounted to load). The current code only hides it on failure. |
| 9 | Never test ads in release | `src/lib/ads.tsx` line 37 `test()`, `src/lib/config.ts` `PROD_AD_UNITS`, `app.json` `androidAppId` | Check that `PROD_AD_UNITS` has all 4 real ids. Make `test()` use only `__DEV__`, so an empty id means no ad rather than a test ad. Check `androidAppId` isn't the test app id. |
| 10 | Banner height = ad, last item visible | `src/lib/ads.tsx`, `src/components/JobList.tsx` (`contentContainerStyle`), `src/app/saved.tsx`, tab screens | Size the banner from `onAdLoaded` (or the adaptive size). Make sure the banner sits under the list as a sibling and not over it, and the list has bottom padding. |
| 11 | Proper native ads that look like a job card | `src/lib/ads.tsx` `NativeAdCard` (line ~177), `src/components/JobList.tsx` (every 8 items) | Rebuild with `NativeAdView` + `NativeMediaView` + `NativeAsset` (headline, body, icon, CTA, advertiser, "Ad" badge), styled like `JobCard`. Follow the AdMob native policy: the AdChoices corner and asset views must be registered. |
| 12 | Virtualized lists | `src/app/(tabs)/index.tsx:131` (workers `ScrollView` + `.map`), `src/app/admin.tsx`, `src/app/my-posts.tsx`, `src/app/(tabs)/alerts.tsx`, `src/app/(tabs)/govt.tsx` | Replace `ScrollView` + `map` with `FlatList`. Jobs already use `JobList` (FlatList). |
| 13 | Home = categories chosen in onboarding, "All Jobs" for the rest | `src/app/onboarding.tsx` (category step, stores `alertCategories`), `src/lib/store.ts`, `src/app/(tabs)/index.tsx` `list` useMemo | Add a store field `homeCategories` (from onboarding). Home filters to it by default, with an "All Jobs" chip or tab that removes the filter. `alertCategories` defaults to ALL today. |
| 14 | Date filter + hide old jobs | `src/app/(tabs)/index.tsx` (filters row, `list`), `src/lib/format.ts` (`sortJobs`, add `ageDays`), `src/lib/feed.ts` / `scraper/build-feed.ts` (drop items older than 60 days at the source) | Add chips for Today / 3 / 7 / 30 days, default 30. Drop anything without a date or older than 60 days in the feed builder, so a 223-day-old job can't come back. |
| 15 | City filter OK | `src/lib/places.ts`, `jobInArea` | Don't touch. Re-test after #13/#14. |
| 16 | Confirm before every delete or remove | `src/app/(tabs)/me.tsx:93` (`deletePacks`, no confirm), `src/app/(tabs)/alerts.tsx` (remove alert/topic), `src/app/saved.tsx` / `JobCard` unsave, `src/app/admin.tsx` (hide/delete), `src/app/cv.tsx` (clear) | Wrap them in the same `Alert.alert(t('deleteConfirm'), …)` pattern as `my-posts.tsx:29`. Account delete and my-posts are already done. |
| 17 | Back goes one step | `src/app/post.tsx:23` (`router.replace` → `push`), `src/app/post-job.tsx:85` and `post-seeker.tsx:54` (`replace('/my-posts')` after posting, OK), `src/app/my-posts.tsx:42` (`replace('/post')` → `push`) | Use `push` for forward navigation. Keep `replace` only after a successful submit and in onboarding. |
| 18 | Saved Jobs on Home | `src/components/Header.tsx` / `Hero` in `src/app/(tabs)/index.tsx`, maybe `(tabs)/_layout.tsx` | Add a heart icon with a count badge in the Home hero (next to `CountryButton`) that opens `/saved`. Keep the Me row too. |
| 19 | **Crash when opening a saved job** | `src/app/saved.tsx:16` `useApp((s) => Object.values(s.saved))`, and `src/app/job/[id].tsx:30` | The likely cause is the selector: it returns a NEW array on every store read, so zustand loops ("Maximum update depth" / getSnapshot), which shows when the store updates on open. Fix: `useApp(useShallow((s) => Object.values(s.saved)))`, or select `s.saved` and run `useMemo(Object.values)`. Also check that old saved items match the `Job` shape (missing `cities`/`title` → `.join` crash in `JobCard`). Reproduce on the release build first. |
| 20 | Google login fails | Firebase console (SHA-1), `google-services.json`, `src/lib/google.ts` (`GOOGLE_WEB_CLIENT_ID` in `config.ts`) | Add both SHA-1s in Firebase → Android app: the upload key `E8:44:C3:…:45:D1` and the Play App Signing key (Play Console → App integrity). Download a new `google-services.json` and check that `webClientId` is the OAuth **web** client. Needs a rebuild. |
| 21 | Forgot password: email only, clear UI | `src/components/AuthCard.tsx:89` (`forgot`), `src/lib/lang/*` | Make it its own small screen/modal with only an email field. Use a loose check (contains `@` and a dot after it). After sending, show a success panel ("Reset link sent to x@y – check spam too") with a Back-to-login button. Don't send to the password field's validation. Map Firebase errors (`auth/invalid-email`, `auth/too-many-requests`); `user-not-found` should still show "sent", for privacy. |
| 22 | Delivery = APK only | – | For v1.0.1: give an APK to install directly. Play upload only when Shahid says. |

**Extra (noted earlier):** Delivery Hero near-duplicate jobs. Normalize the title (lowercase, collapse spaces) in the dedupe key in `src/lib/sources.ts`. This is a feed-only fix, no app build needed.

**Order when we start:**
1. Crash #19, Google login #20, ads #8–11.
2. Language #4–5.
3. Jobs #13–14, UX #16–18, #21, lists #12.
4. New languages #2 + #1.
5. Test on the emulator.
6. One build: APK, plus AAB if Shahid asks.
7. Localized screenshots and listing #6–7.
