# Government job sources – checked 2026-11-20

Rule: the app only fetches pages that are public (no login) and meant for the public. It fetches politely (the hourly feed + phones that check at most once an hour) and always links to the original page. Everything else is a **link only** on the Govt tab ("Official portals"), plus jobs the admin posts by hand with the official link.

| Country | Source | Public list without login? | How the app uses it |
|---|---|---|---|
| UAE | **Dubai Careers**, the Dubai Government portal (Taleo): `jobs.dubaicareers.ae/careersection/rest/jobboard/searchjobs?portal=40505100456` | **Yes.** The JSON the public site itself uses. About 320 jobs, each marked "UAE Only" or "All Nationalities" | **Automatic** (`fetchDubaiCareers` in `src/lib/sources.ts`). "UAE Only" → Locals only, "All Nationalities" → Anyone |
| UAE | FAHR, the federal government (fahr.gov.ae) | No public vacancy list was found | Link |
| Saudi Arabia | **Jadarat** (jadarat.sa, HRDF, the national platform for government + private jobs) | An OutSystems app. Its public "ExploreJobs" data call (`screenservices/UEP_CW/PublicJobs_CW/PublicList/DataActionGetData`) returned an empty list without login. Saudi nationals only | Link + admin posts. To re-check later: the call needs the right screen variables |
| Qatar | Kawader (Ministry of Labour) | The site was not reachable from here; needs a login | Link (mol.gov.qa) |
| Kuwait | Civil Service Commission (csc.gov.kw) + e.gov.kw | No public vacancy list (citizens apply via e-services) | Link |
| Oman | Ministry of Labour job portal (mol.gov.om) | "Job opportunities" redirects to the MOL single sign-on login | Link |
| Bahrain | Civil Service Bureau (csb.gov.bh) / bahrain.bh | The "Shawaghir" vacancy system needs a login | Link (+ LMRA for expats) |

## Private jobs: free public company job boards (no key)
`BOARDS` in `src/lib/sources.ts`. Only Gulf locations are kept.
- **SmartRecruiters:** DeliveryHero (talabat etc., about 100 Gulf jobs). Filtered by country code.
- **Greenhouse:** careem, tamara.
- **Workable:** foodics, salla, lucidya.

To add a company:
1. Find its board id. Examples: `boards-api.greenhouse.io/v1/boards/<id>/jobs`, `apply.workable.com/api/v1/widget/accounts/<id>`, `api.smartrecruiters.com/v1/companies/<id>/postings?country=ae`.
2. Add one line to `BOARDS`. The next hourly run picks it up.

**Careerjet** (thousands of jobs) needs Shahid's publisher key + a registered website. It can be added later through the existing EC2 relay (fixed IP 18.139.102.249).
