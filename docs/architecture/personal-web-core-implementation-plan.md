# Personal Web Core — Implementation Plan

**Status:** Pending review (do not implement until approved)  
**Design authority:** [`personal-web-core-design.md`](./personal-web-core-design.md) (approved for implementation planning)  
**Principles:** incremental, behavior-preserving first, deployable after every major step, no database, no deferred protocols.

---

## Overview

| Milestone | Name | Primary outcome |
| --- | --- | --- |
| M1 | Stable identity foundation | `id` in all content files; CI enforcement |
| M2 | Domain + storage mapping | ContentStore; domain objects from Markdown |
| M3 | Adapter extraction | Split `indieweb.ts`; import boundaries |
| M4 | Person centralization | Single `person.yaml` → pages |
| M5 | Canonical Project pages | `/projects/<slug>/` |
| M6 | Relationship migration | `relationships` frontmatter; legacy fallback |
| M7 | Historical slug support | Redirects; WM adapter targets |
| M8 | RSS identity hardening | Frozen legacy GUIDs; URN for new notes |

**Suggested PR order:** M1 → M2 → M3 (can split M3 per adapter) → M4 → M5 → M6 → M7 → M8.  
M7 and M8 may ship after M5 if desired, but M8 should land before any slug rename in production.

---

## Validation gates

### Gate A — No behavior change

Run after **M2** and again after **M3**:

- [ ] `npm test` — all existing tests pass
- [ ] Published note count unchanged
- [ ] Every existing note canonical URL unchanged (`/notes/{slug}/`)
- [ ] `/rss.xml` item links unchanged for legacy notes
- [ ] Sitemap contains same note URLs as before
- [ ] Layout Webmention discovery links unchanged
- [ ] `npm run posse:bluesky -- first-note-probably` (dry review) — same post text shape and permalink

### Gate B — Identity correctness

Run after **M1** and continuously in CI:

- [ ] Every Person, Note, Project has exactly one `id` in its file
- [ ] No IDs generated during `npm run build`
- [ ] Duplicate IDs fail CI
- [ ] Slug change in test fixture does not change `id`

### Gate C — Dependency direction

Run after **M3**:

- [ ] `src/core/domain/**` imports no `astro:`, `adapters/`, or protocol paths
- [ ] Webmention/Bluesky/feeds modules import from `core/domain` only (not vice versa)
- [ ] No Bluesky 300-char limit or webmention.io URLs in `core/domain`

### Gate D — Project canonicalization

Run after **M5**:

- [ ] Every project has `/projects/{slug}/` detail page
- [ ] `/projects` cards link to first-party detail URL
- [ ] External live URL present as secondary “Visit project” link
- [ ] Detail page canonical link is first-party URL

### Gate E — Migration compatibility

Run after **M7** and **M8**:

- [ ] Existing Bluesky `syndication` URLs in frontmatter untouched
- [ ] Legacy note URLs unchanged at migration
- [ ] Redirect fixtures: `/notes/old-slug/` → `/notes/new-slug/` (308)
- [ ] Legacy note RSS GUID unchanged after slug rename in fixture
- [ ] New note URN GUID unchanged after slug rename in fixture

---

## Scope guardrails — explicitly reject

Do not implement in Personal Web Core PRs:

- ActivityPub, Mastodon, ATProto PDS, custom Lexicons, WebFinger, IndieAuth
- JSON-LD, JSON Feed, agent APIs, `llms.txt`
- First-party Webmention persistence/receiver
- Automated POSSE, cross-platform edit/delete
- Graph visualization, tag index pages, revision UI
- Protocol plugin framework, runtime database

---

## Milestone 1 — Stable identity foundation

**Goal:** Authoritative `id` in every canonical object file; UUIDv7 at authoring/migration time only.

### M1.1 — ObjectId helpers

- [ ] Add `src/core/domain/ids.ts`
  - `type ObjectId = string & { __brand: 'ObjectId' }`
  - `parseObjectId(value: string): ObjectId` — validates UUID format
  - `assertUniqueIds(ids: ObjectId[]): void` — throws on duplicate
- [ ] Add `src/core/domain/generate-id.ts` (or `scripts/lib/generate-id.ts` **only for scripts/handoff**, not imported by build)
  - `generateObjectId(): ObjectId` — UUIDv7 via `uuid` package v10+ (`v7()`) or minimal RFC9562 implementation
  - **Must not** be called from Astro pages, ContentStore, or adapters
- [ ] Add dependency: `uuid` (dev/runtime for scripts only) OR implement v7 in `scripts/` without adding to build graph
- **Tests:** `ids.test.ts` — valid UUID accepted; invalid rejected; duplicate assertion fails
- **Behavior:** none visible
- **Rollback:** delete new files

### M1.2 — Zod schema: require `id`

- [ ] Update `src/content.config.ts`
  - Notes: add `id: z.string().uuid()`, `slug: z.string()`, `previousSlugs: z.array(z.string()).default([])`, `rssItemGuid: z.string().url().optional()`
  - Projects: add `id`, `slug`, `previousSlugs` (same pattern)
  - Keep existing fields; `slug` defaults from filename in migration if omitted initially — **prefer explicit slug in frontmatter after migration**
- [ ] Add `src/content/person.schema.ts` (Zod) for `person.yaml` — includes required `id`
- **Prerequisite:** M1.1
- **Behavior:** build fails until IDs present — coordinate with M1.3 in same PR or temporarily `.optional()` for one commit only if needed (avoid if possible)
- **Rollback:** revert schema

### M1.3 — One-time ID migration script

- [ ] Add `scripts/migrate-assign-ids.ts`
  - For each `src/content/notes/*.md` and `src/content/projects/*.md` missing `id`:
    - Generate UUIDv7
    - Write `id`, `slug` (= filename stem), `previousSlugs: []` into frontmatter
    - For **public** notes (`draft: false`, `privacyReviewed: true`): also set `rssItemGuid` to `https://karthikg.in/notes/{slug}/`
  - Create `src/content/person.yaml` with generated `id` and identity facts from current pages
  - Optional: write `docs/migration/id-assignment-{date}.json` log (human review); **not imported by app**
- [ ] Run script; commit resulting frontmatter changes
- [ ] Command: `npx tsx scripts/migrate-assign-ids.ts`
- **Behavior:** additive frontmatter only; URLs unchanged
- **Rollback:** revert content commits; remove ids from frontmatter

### M1.4 — CI: ID presence and uniqueness

- [ ] Add `src/core/storage/id-validation.test.ts` or `scripts/validate-ids.test.ts`
  - Load all notes, projects, person.yaml
  - Assert every object has `id`
  - Assert no duplicate IDs repo-wide
- [ ] Add npm script: `"validate:ids": "vitest run src/core/storage/id-validation.test.ts"`
- [ ] Wire into `"test"` script or CI check
- **Behavior:** CI fails on missing/duplicate IDs
- **Rollback:** remove test

### M1.5 — Drafting handoff UUIDv7

- [ ] Update `src/scripts/drafting-room.ts` `markdownHandoff()`
  - Generate `id` via `crypto.randomUUID()` is v4 — **use UUIDv7** from a small browser-safe v7 snippet or document that handoff uses script post-processing
  - Preferred: add `src/scripts/uuid-v7.ts` usable in browser bundle (minimal)
  - Emit `id: {uuidv7}` in handoff YAML
  - Emit `slug:` derived from title (author may rename file to match)
- [ ] Update `docs/workbench-note-template.md` with `id` placeholder comment
- **Behavior:** new handoffs include `id`; author commits with file
- **Rollback:** revert handoff template

### M1.6 — Archive temporary migration artifacts

- [ ] If migration log was written, move to `docs/migration/` with README stating **not used at runtime**
- [ ] Confirm no import of migration log anywhere (`grep -r id-assignment`)
- [ ] Delete any `src/content/.object-id-registry.json` if created in earlier drafts — **must not exist in final M1**
- **Gate B** checklist after M1

---

## Milestone 2 — Domain + storage mapping

**Goal:** Map Astro records → domain objects; ContentStore retrieval.

### M2.1 — Domain types

- [ ] Add `src/core/domain/publication.ts`
  - `PublicationState` type
  - `derivePublicationState(draft, privacyReviewed): PublicationState`
  - `isPublicNote(note: { publication: PublicationState }): boolean`
- [ ] Add `src/core/domain/note.ts` — `Note` interface, `deriveNoteKind(note)`
- [ ] Add `src/core/domain/project.ts` — `Project` interface
- [ ] Add `src/core/domain/person.ts` — `Person`, `ExternalIdentity`
- [ ] Add `src/core/domain/relationship.ts` — types only `reply-to` | `bookmark-of`
- [ ] Add `src/core/domain/syndication.ts` — `SyndicationCopy`
- [ ] Add `src/core/domain/urls.ts`
  - `canonicalNotePath(note)`, `canonicalProjectPath(project)`
  - `locationPaths(entity): string[]` — `/notes/{s}/` for each previousSlug + current slug
- **Tests:** port `isPublishedNote` → `isPublicNote` matrix; port `classifyNote` → `deriveNoteKind`
- **Behavior:** none visible (no consumers yet)

### M2.2 — Storage mappers

- [ ] Add `src/core/storage/map-note.ts`
  - Input: Astro collection entry + raw frontmatter flags
  - Derive `publication` once via `derivePublicationState`
  - Map `syndication` string[] → `SyndicationCopy[]`
  - Pass through `rssItemGuid`
  - Legacy: synthesize relationships from `inReplyTo`/`bookmarkOf` if `relationships` empty
- [ ] Add `src/core/storage/map-project.ts`
- [ ] Add `src/core/storage/map-person.ts` — reads `person.yaml`
- **Tests:** fixture markdown → expected domain object; publication states; legacy relationship synthesis

### M2.3 — ContentStore

- [ ] Add `src/core/storage/content-store.ts`
  - `createContentStore(): Promise<ContentStore>` using `getCollection()`
  - Implement all retrieval methods per design §12.2
  - `getPublishedNotes()` filters `isPublicNote`
- **Tests:** mock collection entries; verify lookup by id/slug

### M2.4 — Compatibility wrappers

- [ ] Refactor `src/lib/notes.ts`
  - `getPublishedNotes()` delegates to ContentStore
  - `notePath(note)` → use domain `canonicalNotePath` or accept domain Note
  - Keep exports stable for pages during migration
- [ ] Document removal target: wrappers removed after M3 when pages import store/domain directly
- **Gate A** after M2.4

---

## Milestone 3 — Adapter extraction

**Goal:** Break up `src/lib/indieweb.ts`; enforce dependency direction.

### M3.1 — Presentation adapter

- [ ] Add `src/adapters/presentation/host-label.ts` — move `hostLabel`
- [ ] Add `src/adapters/presentation/microformats.ts` — helpers for `u-in-reply-to`, etc. (extract from NoteLayout logic as pure functions)

### M3.2 — Webmention adapter

- [ ] Add `src/adapters/webmention/discovery.ts` — `discoverWebmentionEndpoint`, `sendWebmention`
- [ ] Add `src/adapters/webmention/webmention-io.ts` — `webmentionReceiverUrl`, `webmentionFeedUrl`
- [ ] Add `src/adapters/webmention/outbound-targets.ts` — `extractOutboundLinks`, `markdownToLinkHtml`
- [ ] Update `src/lib/send-webmentions.ts` imports → adapters

### M3.3 — Bluesky adapter

- [ ] Add `src/adapters/syndication/bluesky/post-text.ts` — `buildBlueskyPostText`
- [ ] Move `src/lib/posse-bluesky.ts` → `src/adapters/syndication/bluesky/posse-cli.ts` (or keep path, update imports)
- [ ] Update `package.json` script path if moved

### M3.4 — Remove dead code

- [ ] Delete `normalizeSyndicationUrl` unless a caller exists after grep
- [ ] Split `src/lib/indieweb.test.ts` → domain tests + adapter tests

### M3.5 — Temporary re-exports

- [ ] `src/lib/indieweb.ts` re-exports from new locations (deprecation comment)
- [ ] Follow-up PR (same milestone): update all imports to direct paths; delete `indieweb.ts`

### M3.6 — Import boundary enforcement

- [ ] Add `src/core/domain/import-boundary.test.ts`
  - Scan `src/core/domain/**/*.ts` for forbidden import patterns
- [ ] Optional: ESLint `no-restricted-imports` for `src/core/domain/**`
- **Gate A** + **Gate C** after M3

---

## Milestone 4 — Person centralization

**Goal:** Machine-readable identity from `person.yaml`.

### M4.1 — Wire Person into Layout

- [ ] `src/layouts/Layout.astro` — load Person via ContentStore (or build-time import)
  - Generate `rel="me"` links from `externalIdentities` + `contactMethods`
  - Remove hardcoded GitHub/Bluesky/LinkedIn/mailto URLs
- **Before/after:** same `rel` targets in HTML head

### M4.2 — Homepage h-card

- [ ] `src/pages/index.astro` — Person drives name, tagline, avatar, org, email link, site URL
- **Before/after:** same h-card fields and classes

### M4.3 — Contact page

- [ ] `src/pages/contact.astro` — cards from Person `contactMethods` + `externalIdentities`
- **Before/after:** same five contact methods visible

### M4.4 — Identity regression tests

- [ ] Add `src/adapters/presentation/person-projection.test.ts`
  - Assert sorted `rel="me"` hrefs match expected set from fixture Person
- **User-visible change:** none if migrated correctly

---

## Milestone 5 — Canonical Project pages

**Goal:** `/projects/<slug>/` as canonical Project identity.

### M5.1 — Project detail route

- [ ] Add `src/pages/projects/[slug].astro`
  - `getStaticPaths` from ContentStore `getProjects()`
  - Render title, description, body (Markdown), links, topics
  - `<link rel="canonical">` = first-party URL
  - `h-entry` with `u-url` = first-party URL
- **New URLs:** additive

### M5.2 — ProjectCard updates

- [ ] `src/components/ProjectCard.astro`
  - Primary link → `/projects/{slug}/`
  - `u-url` = first-party URL
  - “Visit project →” → `links[kind=live]`
  - GitHub → `links[kind=github]`
- [ ] Migrate frontmatter `link` → `links: [{ kind: live, url: ... }]` in all project files (data migration in same PR)

### M5.3 — Sitemap

- [ ] `src/pages/sitemap.xml.ts` — add `canonicalProjectPath` for each project
- **Before/after:** note URLs unchanged; project detail URLs added

### M5.4 — Tests

- [ ] Static paths count = project count
- [ ] Canonical path helper matches page output
- **Gate D**

---

## Milestone 6 — Relationship migration

**Goal:** `relationships` frontmatter with legacy fallback.

### M6.1 — Schema

- [ ] `content.config.ts` — add `relationships` array schema; validate `type` enum `reply-to` | `bookmark-of`
- [ ] Keep `inReplyTo` / `bookmarkOf` optional temporarily

### M6.2 — Migrate existing note data

- [ ] For `first-note-probably.md` (and any note with legacy fields): add `relationships: []` or convert if applicable
- [ ] No notes currently use `inReplyTo`/`bookmarkOf` in repo — verify via grep before edit

### M6.3 — Presentation

- [ ] `NoteLayout.astro` — use presentation adapter for `u-in-reply-to` / `u-bookmark-of` from domain relationships
- [ ] `deriveNoteKind` uses relationships (reply/bookmark precedence unchanged)

### M6.4 — Webmention outbound

- [ ] `outbound-targets.ts` — include external relationship URLs
- [ ] `send-webmentions.ts` — use domain Note from ContentStore
- **Tests:** parity with existing `extractOutboundLinks` tests

### M6.5 — Remove legacy frontmatter (optional follow-up PR)

- [ ] Remove `inReplyTo`/`bookmarkOf` from schema after all content migrated
- [ ] Mapper fallback can remain one release or be removed

---

## Milestone 7 — Historical slug support

**Goal:** Redirects and location history without production slug rename required.

### M7.1 — Routing adapter

- [ ] Add `src/adapters/routing/redirects.ts`
  - `deriveSlugRedirects(notes, projects): Record<string, { status: 308, destination: string }>`
  - Validate no slug collisions
- **Tests:** fixture with `previousSlugs: ['old-slug']`, slug `new-slug` → redirect entry

### M7.2 — Astro redirect integration

- [ ] Add `scripts/generate-redirects.ts` OR integrate in `astro.config.mjs` via async config
  - Import redirects from routing adapter fed by ContentStore at config time
  - **Challenge:** Astro config may need `vite` plugin or prebuild step to load content collections
  - **Preferred:** prebuild script writes `src/generated/redirects.json`; `astro.config.mjs` imports it
- [ ] Document: run `npm run build` generates redirects; 308 permanent

### M7.3 — Webmention mention targets

- [ ] Add `src/adapters/webmention/mention-targets.ts`
  - `mentionTargetUrls(note, siteOrigin)` using `locationPaths()` from domain
- [ ] Update `src/components/Webmentions.astro`
  - Fetch JF2 for each target URL; merge/dedupe client-side
- **Tests:** adapter unit test; no domain WM imports

### M7.4 — Fixture-only slug rename test

- [ ] Test fixtures in `src/core/storage/__fixtures__/` — renamed note; assert redirect + WM targets + id stable
- **No production content slug rename required**
- **Gate E** (partial — redirects + WM targets)

---

## Milestone 8 — RSS identity hardening

**Goal:** Implement permanent RSS GUID policy from design §8.5.

### M8.1 — Feeds adapter

- [ ] Add/refactor `src/adapters/feeds/rss.ts`
  - `rssGuidForNote(note): { guid: string; isPermaLink: boolean }`
    - If `note.rssItemGuid` set → `{ guid: rssItemGuid, isPermaLink: true }`
    - Else → `{ guid: 'urn:karthikg.in:note:' + note.id, isPermaLink: false }`
  - `rssLinkForNote(note, origin)` → current canonical URL (updates on slug rename)
- [ ] Update `src/pages/rss.xml.ts` to use adapter

### M8.2 — Legacy migration verification

- [ ] Confirm all **currently public** notes received `rssItemGuid` in M1.3
- [ ] `first-note-probably.md` has frozen `rssItemGuid: https://karthikg.in/notes/first-note-probably/`

### M8.3 — RSS tests

- [ ] Legacy fixture: slug rename in domain → GUID unchanged, link changed
- [ ] New note fixture (no `rssItemGuid`): slug rename → URN GUID unchanged, link changed
- [ ] GUID immutability test: same note twice → same GUID

### M8.4 — Authoring rule for new notes

- [ ] Update `docs/workbench-note-template.md`: do **not** set `rssItemGuid` on new notes
- [ ] Drafting handoff does not emit `rssItemGuid`
- **Gate A** (RSS) + **Gate E** after M8

---

## PR sizing guide

| PR | Suggested scope |
| --- | --- |
| PR-1 | M1.1–M1.4 (ids + schema + migration script + CI) |
| PR-2 | M1.5–M1.6 + M2.1–M2.2 (handoff + domain types + mappers) |
| PR-3 | M2.3–M2.4 (ContentStore + wrappers) — **Gate A** |
| PR-4 | M3 (adapter extraction) — **Gate C** |
| PR-5 | M4 (Person) |
| PR-6 | M5 (Projects) — **Gate D** |
| PR-7 | M6 (Relationships) |
| PR-8 | M7 (Redirects + WM targets) — **Gate E** partial |
| PR-9 | M8 (RSS GUID) — **Gate E** complete |

Each PR should pass `npm run build` and `npm test`.

---

## Rollback strategy

- **Content migration (M1):** revert Git commit adding frontmatter IDs
- **Domain layer (M2–M3):** wrappers keep old import paths until stable
- **Person/Projects (M4–M5):** revert page wiring; data files remain harmless
- **RSS GUID (M8):** highest risk to feed readers — deploy separately; do not change legacy `rssItemGuid` values once set

---

## Highest-risk step

**M8 — RSS identity hardening** combined with **M7 — slug rename mechanics**: incorrect GUID policy causes feed reader duplication or broken subscriptions. Mitigate with fixture tests proving GUID immutability before any production slug rename.

---

## Files touched (summary)

| Area | Add/change |
| --- | --- |
| Domain | `src/core/domain/*` |
| Storage | `src/core/storage/*`, `src/content.config.ts` |
| Adapters | `src/adapters/**` |
| Content | `src/content/notes/*.md`, `projects/*.md`, `person.yaml` |
| Pages | `Layout.astro`, `index.astro`, `contact.astro`, `projects/[slug].astro`, `rss.xml.ts`, `sitemap.xml.ts` |
| Components | `ProjectCard.astro`, `Webmentions.astro`, `NoteLayout.astro` |
| Scripts | `scripts/migrate-assign-ids.ts`, `scripts/generate-redirects.ts` |
| Remove | `src/lib/indieweb.ts` (after import migration), `normalizeSyndicationUrl` if unused |
| Docs | `workbench-note-template.md`, optional `docs/migration/` log |

---

**Awaiting implementation plan approval before any production code changes.**
