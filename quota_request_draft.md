# YouTube API quota extension: how to apply, and draft answers

**Form:** https://support.google.com/youtube/contact/yt_api_form
("YouTube Data API Services – Audit and Quota Extension Form")

## Before you submit
1. **Sign in** with the Google account that owns the Cloud project of your API key.
2. **Find your project number and ID:** console.cloud.google.com → select the project → Dashboard
   ("Project info" card). Google identifies your quota by the project *number*.
3. **Have a public URL** for Section 4 (reviewers check the live app). Publish the site on
   GitHub Pages first; if you can't yet, attach screenshots and a short screen recording instead.
4. **Compliance basics the reviewer looks for** (Claude can add these to the site on request):
   - a footer line: "This site uses YouTube API Services", with links to the
     YouTube Terms of Service (https://www.youtube.com/t/terms) and the
     Google Privacy Policy (https://policies.google.com/privacy);
   - a short privacy note for the site (no accounts, no tracking; likes are kept in your own browser);
   - stored view/like counts refreshed at least every 30 days (one cheap `videos.list` run a month).
5. **Don't** create extra Cloud projects or API keys to multiply the quota; the policies forbid it
   and it can get every key suspended.

Expect a reply by email in days to a few weeks; they may ask follow-up questions.

---

## Section 1 – Request type
**Complete a compliance audit to request for additional quota**

## Section 2 – Organization and contact information
- Organization: *Individual (personal project)*, or your own name if an organization name is required
- Contact name / email: *your name*, *your email*
- Country: India

## Section 3 – Business model
- Business model: **None / non-commercial.** No revenue, no ads, no paid features, no data sales.
- Google contacts: none

## Section 4 – API client overview and access
- API client name: **Anandadhara (আনন্দধারা) – Rabindrasangeet archive**
- URL: *https://smaju78.github.io/Anandadhara/* (or "not yet public; screenshots attached")
- Project number: *<project number>*  Project ID: *<project id>*
- Access: public website, no login required.

**Description of the API client**
> Anandadhara is a free, non-commercial static website that catalogues the ~2,160 songs written by
> Rabindranath Tagore (Rabindrasangeet). Each song has its own page with its classification
> (parjay, season, raag, taal), Bengali lyrics and transliteration, and up to three existing YouTube
> performances of that song, played with the official YouTube IFrame Player. A "jukebox" page
> plays these embedded videos one after another, filtered by mood or season. The site does not
> download, re-host, modify or monetize any YouTube content, and it has no user accounts.

## Section 5 – Use cases and quota extension
**Which API services and how they are used**
> Server-side only, from a single offline script run by me. For each song the script calls
> `search.list` once (occasionally a second time with the English title) to find embeddable
> performances, then `videos.list` (part=snippet,contentDetails,statistics,status) to check
> embeddability and duration and get view and like counts. It keeps the top three relevant videos
> per song. Only video IDs, titles, channel names, durations and view/like counts are stored.
> Website visitors never call the Data API; they only watch through the embedded IFrame Player.

**Why the current quota is not enough**
> Indexing is a one-time job: about 2,120 songs × ~125 units ≈ 265,000 units. At the default
> 10,000 units a day that takes about 27 days. After that, usage drops to a monthly
> `videos.list` refresh of the stored statistics (well under 1,000 units a month).

**Quota requested:** **100,000 units per day** (finishes the indexing in about 3 days).
If that is too much, 50,000 units per day (about 6 days) would also work.

**Data retention / refresh**
> Statistics are refreshed with `videos.list` at least every 30 days. Videos that are deleted or
> no longer embeddable are removed at each refresh.

## Section 6 – Evidence
Attach: screenshots of a song page (recordings section), the jukebox playing, and the site footer
with the YouTube Terms / Google Privacy links. A link to the public code repository also helps.

## Section 7 – Attestations
Read and tick the attestations (YouTube API Services Terms of Service and Developer Policies),
then Submit.
