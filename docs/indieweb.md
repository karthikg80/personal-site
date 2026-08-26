# IndieWeb on karthikg.in

Operational checklist for the three adoptions from
[Andros Fenollosa’s IndieWeb write-up](https://en.andros.dev/blog/0b8e451e/i-joined-the-indieweb-heres-what-i-learned/):
Bridgy backfeed, IndieWebify.me validation, and documenting on the IndieWeb wiki.

Public identity facts also live on `/colophon`.

## Already in the site

| Piece | Where |
| --- | --- |
| Domain identity | `https://karthikg.in` |
| Homepage `h-card` | `src/pages/index.astro` |
| Note / project `h-entry` | `NoteLayout.astro`, `projects/[slug].astro` |
| Notes `h-feed` | `src/pages/notes/index.astro` |
| `rel="me"` | Layout `<head>`, footer, contact |
| Webmention receive | webmention.io via Layout `<link rel="webmention">` |
| Webmention send | Distribute Action + `npm run webmentions:send` |
| POSSE → Bluesky | Distribute Action + `u-syndication` / `rel="syndication"` |
| Cool URIs | `previousSlugs` → HTTP 308 |

Skipped on purpose (same as Andros; also design non-goals): IndieAuth server, Micropub, WebSub, Bridgy Fed / ActivityPub.

## 1. Bridgy backfeed

POSSE already writes Bluesky copies and `u-syndication` on the note. Bridgy watches those copies and sends likes, replies, and reposts to webmention.io as webmentions. The correspondence tray on each note already renders whatever webmention.io stores.

### Markup this repo owns

- Each syndicated URL is an `<a class="u-syndication" rel="syndication" href="…">`.
- Notes keep a discoverable webmention endpoint so Bridgy can deliver.

### One-time owner step (cannot be done from this repo)

1. Open [brid.gy](https://brid.gy/).
2. Connect Bluesky with handle `karthikg.in` (prefer a Bluesky app password limited to Bridgy).
3. Confirm the Bridgy user page resolves (not “User not found”): `https://brid.gy/bluesky/karthikg.in`.
4. Like or reply to an existing syndicated note on Bluesky; wait for Bridgy’s poll; confirm the mention appears in [webmention.io](https://webmention.io/) and on the note’s correspondence tray.

Bridgy is not used for publishing here — first-party Bluesky POSSE stays in this repo.

## 2. IndieWebify.me validation

Re-check after deploys that touch identity or note markup:

- [Validate `rel=me`](https://indiewebify.me/validate-rel-me/?url=https://karthikg.in/)
- [Validate homepage `h-card`](https://indiewebify.me/validate-h-card/?url=https://karthikg.in/)
- [Validate a note `h-entry`](https://indiewebify.me/validate-h-entry/?url=https://karthikg.in/notes/after-the-drafting-room/)

Baseline checked 2026-08-26 against production:

| Check | Result | Follow-up |
| --- | --- | --- |
| Homepage `h-card` | Success | Absolute `u-photo` / `u-logo` |
| Note `h-entry` | Success | Absolute author photo, `rel="author"`, `rel="syndication"` |
| `rel=me` discovery | Finds GitHub, LinkedIn, Thea Foundry (+ Bluesky / mailto in HTML) | Reciprocal GitHub website was empty — set profile website to `https://karthikg.in` |

### Reciprocal `rel="me"` owner steps

- **GitHub:** Profile → Website → `https://karthikg.in` (API `blog` was empty at check time).
- **Bluesky:** Profile already uses the custom domain handle `@karthikg.in`.
- **LinkedIn / Thea Foundry:** Keep a public link back to `https://karthikg.in` where the product allows it.

Template regression guard: presentation tests cover `personAvatarUrl` and head `rel="me"` order.

## 3. IndieWeb wiki user page

Wikifying requires IndieAuth as `https://karthikg.in`. The MediaWiki source below is ready to paste.

1. Sign in at [indieweb.org](https://indieweb.org/) with your domain.
2. Open [User:Karthikg.in](https://indieweb.org/User:Karthikg.in) → Create.
3. Paste the block under **Ready-to-paste wiki markup**, save.
4. Optionally add yourself to [chat-names](https://indieweb.org/chat-names) and follow [wikifying](https://indieweb.org/wikifying).

### Ready-to-paste wiki markup

```mediawiki
{{Infobox person
| name = Karthik Gurumoorthy
| url = https://karthikg.in
| photo_url = https://karthikg.in/avatar.svg
| summary = Karthik Gurumoorthy builds calm software for families and everyday life at Thea Foundry, and publishes workbench notes on his own domain.
| elsewhere = [https://github.com/karthikg80 GitHub], [https://bsky.app/profile/karthikg.in Bluesky], [https://theafoundry.com Thea Foundry]
| contact = [mailto:karthi@hey.com karthi@hey.com]
}}

Karthik Gurumoorthy is a software builder. His personal site is https://karthikg.in.

== Itches ==
* Keep Bridgy Bluesky backfeed connected so silo replies return as webmentions
* Keep IndieWebify.me green after markup changes
* Document more of the drafting → publish → distribute flow on relevant wiki pages

== Working on ==
* Personal site IndieWeb surface: h-card, h-entry, webmention.io, Bluesky POSSE

== IndieWeb building blocks ==
* [[h-card]] on the homepage
* [[h-entry]] / [[h-feed]] on workbench notes
* [[rel-me]] to GitHub, Bluesky, LinkedIn, and Thea Foundry
* [[Webmention]] via webmention.io (send + receive)
* [[POSSE]] to Bluesky with [[u-syndication]]
* [[Bridgy]] backfeed for Bluesky interactions (owner-connected)
* IndieWeb Webring footer links
* AT Protocol handle <code>@karthikg.in</code>

== See also ==
* https://karthikg.in/colophon
* https://github.com/karthikg80/personal-site
```
