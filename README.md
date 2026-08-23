# Personal Site

A personal IndieWeb-style website built with [Astro](https://astro.build) for projects, notes, identity, and links around the web.

## Design

The site uses a warm, text-first visual language inspired by personal notebooks: a paper palette, system serif type, hand-drawn details, simple lists, and no external font or image dependencies. Shared design tokens and page typography live in `src/styles/global.css`; the header, footer, and homepage contain the more expressive site-specific details.

## Tech Stack

- Astro 5
- TypeScript (strict Astro config)
- Markdown content collections for projects and Workbench Notes

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

Production files are generated in `dist/`.

## Project Structure

```text
.
├── docs/                    # Editorial contract and note template
├── public/                  # Static assets (resume PDF, favicon, etc.)
├── src/
│   ├── components/          # Reusable Astro components
│   ├── content/
│   │   ├── config.ts        # Content collection schema
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
2. Include frontmatter matching `src/content/config.ts`:
   - `title` (string)
   - `description` (string)
   - `date` (date)
   - `tags` (string[])
   - `link` (optional URL)
   - `github` (optional URL)
   - `featured` (optional boolean)

### Draft or publish a Workbench Note

1. Keep raw observations and sensitive source material outside this repository.
2. Draft from `docs/workbench-note-template.md` in private storage. This checkout provides a Git-ignored `private-notes/` folder for non-sensitive local review.
3. After editorial approval, copy the publishable draft into `src/content/notes/<slug>.md` with both publication controls still at their safe defaults:

   ```yaml
   draft: true
   privacyReviewed: false
   ```

4. Follow `docs/editorial-and-privacy.md` for the factual, editorial, and privacy review.
5. Publish only after explicit approval by setting both `draft: false` and `privacyReviewed: true`.

The archive is at `/notes`, individual notes use `/notes/<slug>`, and the full-text feed is `/rss.xml`. Draft or unreviewed notes are excluded from routes, the homepage, RSS, and the sitemap.

### Update profile content

- Homepage hero: `src/pages/index.astro`
- About page: `src/pages/about.astro`
- Now page: `src/pages/now.astro` (update the dated `updated` value when the facts change)
- Wander page: replace `src/data/feeds.opml` (a Reeder/OPML export) and rebuild
- Colophon: `src/pages/colophon.astro`
- Resume page: `src/pages/resume.astro`
- Contact links: `src/pages/contact.astro` and `src/components/Footer.astro`

### Identity and AT Protocol

- Homepage uses an `h-card`. Footer and `<head>` use `rel="me"` for GitHub, Bluesky, LinkedIn, and Thea Foundry.
- Full-text Workbench Notes RSS is at `/rss.xml`.
- `public/.well-known/atproto-did` publishes `did:plc:k25m3ebqwdr32ojecqpjfzbh`. The public handle is `@karthikg.in`.
- Sitemap is `/sitemap.xml`. `public/robots.txt` points crawlers at it.

## SEO and Canonical URL

- Canonical and social URLs are generated from Astro's `site` config.
- Current value is in `astro.config.mjs`.
- Update `site` when switching domains.

## Deployment Notes

Production is the Vercel project `karthikg80s-projects/personal-site`, deploying from `main`. The `karthikg.in` zone stays on DigitalOcean DNS; only the apex `A` record points at Vercel (`76.76.21.21`). Do not move nameservers.
