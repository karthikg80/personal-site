# Personal Web Core — Implementation Plan

**Status:** Approved — **M1 complete**; M2+ not started  
**Design authority:** [`personal-web-core-design.md`](./personal-web-core-design.md)  
**Principles:** incremental, behavior-preserving first, deployable after every step, no database, no deferred protocols.

---

## Overview

| Milestone | Name | Primary outcome |
| --- | --- | --- |
| M1 | Stable identity foundation | `id` in all content files; CI enforcement; `legacyRssGuid` on legacy public notes |
| M2 | Domain + storage mapping | Mappers; module-level query functions |
| M3 | RSS identity compatibility | Feeds adapter GUID policy; verify legacy GUIDs unchanged |
| M4 | Adapter extraction | Atomic split of `indieweb.ts`; import boundaries |
| M5 | Person centralization | `person.yaml` → pages |
| M6 | Canonical Project pages | `/projects/<slug>/`; first-party `u-url` |
| M7 | Relationship migration | `reply-to` / `bookmark-of` only; verify-then-minimum fallback |
| M8 | Historical slug + redirects | `previousSlugs`; Astro/Vercel redirects; WM historical targets |

**PR order:** M1 → M2 → M3 → M4 → M5 → M6 → M7 → M8.

Lock RSS feed identity in **M3** soon after domain mapping exists — not deferred to late milestones.

---

## Verified redirect mechanism (M8 prep — Astro 7.2.4 + @astrojs/vercel 11.0.7)

**Evidence:**

- `astro.config.mjs` `redirects` map is supported with the Vercel adapter in static output (`node_modules/astro/dist/types/public/config.d.ts`:239–293).
- `RedirectConfig` allows explicit `status` ∈ `{ 301, 302, 303, 307, 308, … }` (`config.d.ts`:47–50; `constants.js`: `REDIRECT_STATUS_CODES`).
- Default GET redirect status is **301** when `status` is omitted (`computeRedirectStatus` in `redirects/render.d.ts`; Astro routing docs).
- `@astrojs/vercel` `getRedirects()` writes Vercel `redirects` with `statusCode` from config (`node_modules/@astrojs/vercel/dist/lib/redirects.js`:61–81).
- **308 is explicitly supported** when set: `{ status: 308, destination: '/notes/new-slug/' }`.

**Preferred M8 approach:**

1. **Prebuild script** `scripts/generate-slug-redirects.ts` parses note/project frontmatter (not Astro config-time collections — `astro.config.mjs` cannot cleanly async-load content collections).
2. Emits `src/generated/slug-redirects.mjs` exporting a redirect map from `previousSlugs` → current slug.
3. `astro.config.mjs` imports and spreads into `redirects`.
4. Each entry uses explicit permanent status:

```javascript
'/notes/old-slug/': { status: 308, destination: '/notes/new-slug/' }
```

**Tradeoff:** 301 is Astro’s default for GET and is acceptable for permanent slug moves; **308** is preferred when explicitly configured for method-preserving permanent redirects. Both are valid on Vercel via the adapter.

**Not preferred:** meta-refresh HTML redirects (static without adapter — not applicable here). **Not preferred:** SSR `Astro.redirect()` for static note routes.

**Highest implementation risk:** M8 — content-derived redirects through prebuild + Astro config + Vercel routing, not RSS GUID policy.

---

## Validation gates

### Gate A — No behavior change

After **M2** and again after **M4**:

- [ ] All existing tests pass
- [ ] Published note count unchanged
- [ ] Every existing note canonical URL unchanged
- [ ] `/rss.xml` item links and **legacy GUIDs** unchanged (verified in M3)
- [ ] Sitemap note URLs unchanged
- [ ] Webmention discovery unchanged
- [ ] Bluesky POSSE CLI permalink behavior unchanged

### Gate B — Identity correctness

After **M1** (continuous in CI):

- [ ] Every Person, Note, Project has exactly one `id` in its file
- [ ] No IDs generated during `npm run build`
- [ ] Duplicate IDs fail CI
- [ ] Slug rename in fixture does not change `id`

### Gate C — RSS identity (M3)

- [ ] Every legacy public note emits the same RSS `<guid>` as before migration
- [ ] New notes (no `legacyRssGuid`) emit `urn:karthikg.in:note:{id}`
- [ ] GUID for each note immutable across slug-rename fixtures

### Gate D — Dependency direction (M4)

- [ ] `src/core/domain/**` imports no Astro or protocol code
- [ ] Adapters depend toward domain only

### Gate E — Project canonicalization (M6)

- [ ] Project detail canonical URL = first-party `/projects/{slug}/`
- [ ] Card `u-url` = first-party; live product URL = secondary link

### Gate F — Redirects + migration (M8)

- [ ] Redirect fixtures: `/notes/old-slug/` → `/notes/new-slug/` with configured status
- [ ] WM adapter fetches historical + canonical URLs
- [ ] Syndication frontmatter byte-for-byte unchanged

---

## Scope guardrails — reject

ActivityPub; Mastodon; ATProto PDS; custom Lexicons; WebFinger; IndieAuth; JSON-LD; JSON Feed; agent APIs; `llms.txt`; first-party Webmention receiver; automated POSSE; graph/tag pages; revision UI; protocol plugin framework; runtime database.

---

## Milestone 1 — Stable identity foundation

**Status:** Implement now.

### M1.1 ObjectId validation (`src/core/domain/ids.ts`) — done

### M1.2 Shared UUIDv7 generation (`src/core/authoring/generate-object-id.ts`) — done

### M1.3 Schema (`src/content.config.ts`) — done

### M1.4 One-time migration (`scripts/migrate-assign-ids.ts`) — done

### M1.5 Drafting handoff — done

### M1.6 Authoring docs — done

### M1.7 Validation/CI (`src/core/storage/validate-canonical-ids.ts`) — done

---

## Milestone 2 — Domain + storage mapping

**No class/interface required.** Prefer module-level query functions:

```typescript
getPerson()
getNotes()
getPublishedNotes()
getProjects()
getNoteById()
getProjectById()
getNoteBySlug()
getProjectBySlug()
```

### M2.1 Domain types

- `PublicationState`: `'draft' | 'awaiting-privacy-review' | 'public'` — derived once from `draft` + `privacyReviewed`
- `Note`, `Project`, `Person`, `Relationship` (`reply-to` | `bookmark-of` only), `SyndicationCopy`
- Domain holds `slug`, `previousSlugs`, optional `legacyRssGuid` — **no route builders**

### M2.2 Mappers

- `map-note.ts`, `map-project.ts`, `map-person.ts`
- Legacy `inReplyTo`/`bookmarkOf`: **grep repo first**; implement minimum fallback only if records exist

### M2.3 Query module (`src/core/storage/content.ts` or similar)

- Wraps `getCollection()`; temporary wrappers in `src/lib/notes.ts` until M4

**Gate A** after M2.

---

## Milestone 3 — RSS identity compatibility

Implement feeds adapter GUID rule:

```text
if note.legacyRssGuid exists → emit as isPermaLink=true GUID (permanent)
else → urn:karthikg.in:note:{id} isPermaLink=false
```

- `<link>` always current canonical URL (built in adapter from slug)
- Slug rename must not change `<guid>`

**Gate C** — compare against pre-M1 RSS GUID capture for `first-note-probably`.

---

## Milestone 4 — Adapter extraction

**Prefer atomic change:** move helper → update all callers → tests/build → delete `src/lib/indieweb.ts`.

Temporary re-exports only if a demonstrated sequencing blocker exists.

| Symbol | Destination |
| --- | --- |
| `isPublishedNote` | `core/domain/publication.ts` |
| `classifyNote` | `core/domain/note.ts` |
| `hostLabel` | `adapters/presentation/host-label.ts` |
| `normalizeSyndicationUrl` | **Delete** if unused |
| WM discovery/send | `adapters/webmention/` |
| `buildBlueskyPostText` | `adapters/syndication/bluesky/post-text.ts` |

Import-boundary test on `core/domain`.

**Gate A + Gate D** after M4.

---

## Milestone 5 — Person centralization

Wire `Layout.astro`, `index.astro`, `contact.astro` from `person.yaml`. Page prose stays in templates.

---

## Milestone 6 — Canonical Project pages

- `src/pages/projects/[slug].astro`
- First-party canonical + `u-url`; external live URL = “Visit project”
- Sitemap adds project detail URLs
- Migrate `link` → `links[kind=live]`

**Gate E.**

---

## Milestone 7 — Relationship migration

- Schema: `relationships` with `reply-to` | `bookmark-of` only
- **Verify first:** current repo has no `inReplyTo`/`bookmarkOf` on published notes — minimum fallback only if needed
- Microformat + outbound WM extraction from relationships

---

## Milestone 8 — Historical slug + redirects

- `previousSlugs` append on rename
- `scripts/generate-slug-redirects.ts` → `src/generated/slug-redirects.mjs`
- `astro.config.mjs` merges redirects (explicit `status: 308`)
- WM adapter builds target URLs from `slug` + `previousSlugs` (not domain WM API)
- Fixture tests only — no production slug rename required

**Gate F.**

---

## PR sizing

| PR | Scope |
| --- | --- |
| PR-1 | **M1** (this milestone) |
| PR-2 | M2 domain + mappers + query |
| PR-3 | M3 RSS adapter |
| PR-4 | M4 adapter extraction |
| PR-5 | M5 Person |
| PR-6 | M6 Projects |
| PR-7 | M7 Relationships |
| PR-8 | M8 Redirects + WM historical |

---

## Highest-risk step

**M8 — Historical slug redirects** via prebuild-generated `astro.config.mjs` redirects and Vercel routing. RSS GUID policy is deterministic and locked in M3.

---

## Files touched (cumulative)

| Area | Files |
| --- | --- |
| M1 | `src/core/domain/ids.ts`, `src/core/authoring/generate-object-id.ts`, `src/core/storage/validate-canonical-ids.ts`, `scripts/migrate-assign-ids.ts`, `src/content.config.ts`, content markdown, `person.yaml`, drafting handoff, docs |
| M2+ | `src/core/domain/*`, `src/core/storage/*`, `src/adapters/**`, pages |
| M8 | `scripts/generate-slug-redirects.ts`, `src/generated/slug-redirects.mjs`, `astro.config.mjs` |

---

**M1 complete when Gate B passes and build/test succeed with unchanged public URLs.**
