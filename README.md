# Personal Site

A personal IndieWeb-style website built with [Astro](https://astro.build) for projects, notes, identity, and links around the web.

## Design

The site uses a warm, text-first visual language inspired by personal notebooks: a paper palette, system serif type, hand-drawn details, simple lists, and no external font or image dependencies. Shared design tokens and page typography live in `src/styles/global.css`; the header, footer, and homepage contain the more expressive site-specific details.

## Tech Stack

- Astro 7 with the Vercel adapter for one private on-demand route
- TypeScript (strict Astro config)
- Markdown content collections for projects and Workbench Notes
- Vercel AI SDK for explicit, server-side editorial-agent requests

## Local Development

```sh
npm install
npm run dev
```

The dev server runs at `http://localhost:4321` by default.

## Build and Preview

```sh
npm run build
npm run preview
```

`npm run build` regenerates slug redirects (`src/generated/slug-redirects.mjs`) from Note/Project `previousSlugs`, then runs `astro build`. Historical paths redirect with HTTP **308** to the current slug. Production content currently has empty `previousSlugs`, so no public redirects are emitted.

The Vercel adapter assembles the deployable build in `.vercel/output/` while preserving static output for all public pages.

## Private Drafting Room

`/drafting` is a deliberately unlinked, `noindex` writing room. In production it returns `404` until both `DRAFTING_ACCESS_KEY` and `DRAFTING_SESSION_SECRET` are configured. The access phrase must be at least 16 characters and the session secret at least 32.

Drafts are encrypted in browser storage with AES-GCM and a key derived from the notebook phrase. The key stays in memory only while the tab is unlocked. Drafts are device-local: there is no server-side draft database or cross-device sync.

Agent moves are opt-in. The current note is sent to OpenAI only when the writer clicks an agent action. The server reads `OPENAI_API_KEY`; the key is never exposed to the browser. Requests use the Responses API with `store: false`, which prevents the generated response from being stored for later API retrieval. The default model is `gpt-5.6-luna`, overridable with `DRAFTING_MODEL`.

Ordinary publishing from this room is **Prepare**, then review, then **Publish**:

1. Draft in the room.
2. Review the exact publication-bound text.
3. Check the repository-entry privacy acknowledgement.
4. Prepare writes an unpublished Git Note: `draft: true`, `privacyReviewed: true`.
5. Review `/drafting/review/<slug>/` (the Git blob, production Markdown).
6. Publish flips only `draft` to `false`.
7. Confirm the public URL after deploy. If the note opted in at Prepare, a GitHub Action then sends Webmentions and/or creates a Bluesky copy and writes `syndication`.
8. Optional CLI fallback: `npm run webmentions:send -- --slug=<slug>` and `npm run posse:bluesky -- <slug>`.

The interface keeps two kinds of progress separate. **Gather → Shape → Ready** describes the private writing loop. **Draft → Prepare → Inspect → Publish** describes movement across trust boundaries: device-only text, an unpublished Git revision, inspection of that exact revision, and finally the public site. The agent stays in the editorial margin and cannot advance the publication workflow.

Prepare and Publish are session-authenticated server routes. They use a server-only `GITHUB_NOTES_TOKEN` (fine-grained PAT, Contents R/W, this repo only) and never expose that token to the browser. Without the token, Prepare/Publish validate then return `503` — they do not pretend the Note is prepared. The editorial agent cannot Prepare or Publish. Webmentions and Bluesky are not part of those requests: they run after Vercel promotes the publish commit, if the note opted in at Prepare.

Copy/Download remains a recovery handoff. It always exports:

```yaml
draft: true
privacyReviewed: false
```

Do not commit that file as a privacy-reviewed canonical Note. `canonicalId` on a local draft is identity only; a Git object exists only after a successful Prepare stores `preparedAt` and `blobSha`.

## Project Structure

```text
.
├── docs/                    # Editorial contract and note template
├── public/                  # Static assets (resume PDF, favicon, etc.)
├── src/
│   ├── components/          # Reusable Astro components
│   ├── content.config.ts    # Content collection schema and loaders
│   ├── content/
│   │   ├── notes/           # Draft and published Workbench Notes
│   │   └── projects/        # Project markdown entries
│   ├── layouts/             # Page layouts and global metadata
│   ├── pages/               # Route-based pages
│   └── styles/              # Global CSS
├── astro.config.mjs
└── package.json
```

## Content Updates

### Add or edit a project

1. Create or update a markdown file in `src/content/projects/`.
2. Include frontmatter matching `src/content.config.ts`:
   - `title` (string)
   - `description` (string)
   - `date` (date)
   - `tags` (string[])
   - `link` (optional URL)
   - `github` (optional URL)
   - `featured` (optional boolean)

### Draft or publish a Workbench Note

1. Keep raw observations and sensitive source material outside this repository.
2. Draft in `/drafting`, or from `docs/workbench-note-template.md` in private storage. This checkout provides a Git-ignored `private-notes/` folder for non-sensitive local review.
3. Follow `docs/editorial-and-privacy.md` for the factual, editorial, and privacy review of the exact text.
4. Prepare from the drafting room after the repository-entry acknowledgement. That commits `src/content/notes/<slug>.md` with:

   ```yaml
   draft: true
   privacyReviewed: true
   ```

   The Note is still unpublished on karthikg.in.
5. Review `/drafting/review/<slug>/`, then Publish. Publish flips only `draft: false`. Do not paste a Copy/Download file into Git as if it were privacy-reviewed; that handoff always has `privacyReviewed: false`.
6. After Vercel promotes that commit to production, the Distribute published note Action verifies the live URL, sends Webmentions for that slug, and/or creates an idempotent Bluesky copy (`putRecord` keyed by a TID derived from the ObjectId). It commits the Bluesky URL into `syndication` with `GITHUB_TOKEN`. Opt in at Prepare:

   ```yaml
   distribution:
     webmentions: true
     bluesky: true
   ```

7. CLI fallback, after the public URL is live:

   ```sh
   npm run webmentions:send -- --slug=<slug>
   npm run posse:bluesky -- <slug>
   ```

   Then add the printed Bluesky URL to `syndication` if the Action did not. Webmention and Bluesky are not part of the Prepare or Publish HTTP requests.

A reply uses a `relationships` entry with `type: reply-to`; a bookmark uses `type: bookmark-of`. Both stay behind the same publication gate.

The archive is at `/notes`, individual notes use `/notes/<slug>`, and the full-text feed is `/rss.xml`. Prepared unpublished notes (`draft: true`) and unreviewed notes are excluded from routes, the homepage, RSS, and the sitemap.

### Update profile content

- Homepage hero: `src/pages/index.astro`
- About page: `src/pages/about.astro`
- Now page: `src/pages/now.astro` (update the dated `updated` value when the facts change)
- Wander page: replace `src/data/feeds.opml` (a Reeder/OPML export) and rebuild
- Colophon: `src/pages/colophon.astro`
- Resume page: `src/pages/resume.astro`
- Contact links: `src/pages/contact.astro` and `src/components/Footer.astro`

### Identity and AT Protocol

- Homepage uses a scoped `h-card` with name, URL, email, org, and `u-photo` / `u-logo`. Footer and `<head>` use `rel="me"` for GitHub, Bluesky, LinkedIn, and Thea Foundry; Bluesky also uses `rel="atproto"` for IndieLogin.
- The shared footer contains the required previous, home, and next links for the IndieWeb Webring.
- Notes advertise a Webmention endpoint via [webmention.io](https://webmention.io). Sign in there once with `https://karthikg.in` so incoming mentions are stored. Display and the manual send form are already on each note.
- Full-text Workbench Notes RSS is at `/rss.xml`, also marked `rel="feed"`.
- `public/.well-known/atproto-did` publishes `did:plc:k25m3ebqwdr32ojecqpjfzbh`. The public handle is `@karthikg.in`.
- Sitemap is `/sitemap.xml`. `public/robots.txt` points crawlers at it.

## SEO and Canonical URL

- Canonical and social URLs are generated from Astro's `site` config.
- Current value is in `astro.config.mjs`.
- Update `site` when switching domains.

## Deployment Notes

Production is the Vercel project `karthikg80s-projects/personal-site`, deploying from `main`. The `karthikg.in` zone stays on DigitalOcean DNS; only the apex `A` record points at Vercel (`76.76.21.21`). Do not move nameservers.

Post-publish distribution is `.github/workflows/distribute-published-note.yml`. It listens for Vercel `repository_dispatch` type `vercel.deployment.promoted`, then verifies `https://karthikg.in/notes/<slug>/` contains the ObjectId before sending Webmentions or creating a Bluesky copy. Enable repository dispatch in the Vercel project Git settings. Store `BLUESKY_APP_PASSWORD` as a GitHub Actions secret. The Action uses `GITHUB_TOKEN` with `contents: write` only to append `syndication`.
