# Personal Site

A portfolio website built with [Astro](https://astro.build) for showcasing projects, experience, and contact information.

## Tech Stack

- Astro 5
- TypeScript (strict Astro config)
- Markdown content collections for projects

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
├── public/                  # Static assets (resume PDF, favicon, etc.)
├── src/
│   ├── components/          # Reusable Astro components
│   ├── content/
│   │   ├── config.ts        # Content collection schema
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
- Project RSS is at `/rss.xml`.
- `public/.well-known/atproto-did` publishes `did:plc:k25m3ebqwdr32ojecqpjfzbh`. The public handle is `@karthikg.in`.
- Sitemap is `/sitemap.xml`. `public/robots.txt` points crawlers at it.

## SEO and Canonical URL

- Canonical and social URLs are generated from Astro's `site` config.
- Current value is in `astro.config.mjs`.
- Update `site` when switching domains.

## Deployment Notes

Production is the Vercel project `karthikg80s-projects/personal-site`, deploying from `main`. The `karthikg.in` zone stays on DigitalOcean DNS; only the apex `A` record points at Vercel (`76.76.21.21`). Do not move nameservers.
