# Personal Web Core — Design Specification

**Status:** Proposed milestone (specification only; no implementation)  
**Builds on:** [`current-personal-web-architecture.md`](./current-personal-web-architecture.md)  
**Repository state verified:** Astro 7 + Vercel, Git Markdown collections, `note.id` = filename slug (`src/lib/notes.ts:18-19`), no runtime DB, no existing redirects config (`vercel.json` is framework-only).

---

## 1. Context

karthikg.in already behaves as a static-first personal site with first-party Markdown, dual publication gates, IndieWeb markup, delegated Webmentions, and manual Bluesky POSSE. The audit identified durable strengths (Git storage, canonical slug URLs, RSS from published notes) and structural gaps (slug-as-identity, fragmented Person data, projects without first-party detail URLs, protocol helpers mixed in `src/lib/indieweb.ts`).

**Personal Web Core** introduces a **protocol-neutral domain layer** and **stable object identity** while preserving all current public URLs and operational workflows. It is intentionally small: no new protocols, no database, no change to how Webmention.io or Bluesky POSSE operate today.

---

## 2. Goals

1. Every canonical public object (Person, Note, Project) has an **immutable ID** independent of slug, storage file, and presentation.
2. **One structured Person source** feeds identity projections (homepage h-card, contact links, head `rel="me"`) without duplicating facts across Astro pages.
3. **Projects gain first-party canonical URLs** at `/projects/<slug>/` while keeping the existing listing page.
4. **Generalized relationships** subsume `inReplyTo` / `bookmarkOf` while preserving microformat output.
5. **Clear dependency direction:** domain ← storage mappers ← adapters (feeds, Webmention, Bluesky) ← Astro pages/CLIs.
6. **Git Markdown remains authoritative storage**; domain objects are instantiated at **build time** (and in CLIs via the same mappers).
7. **Incremental, reviewable migration** with no big-bang rewrite.

---

## 3. Non-goals

Explicitly out of scope for this milestone (unchanged from product direction):

ActivityPub; self-hosted ATProto PDS; custom Lexicons; new DID infrastructure; IndieAuth server; first-party Webmention receiver; Webmention persistence migration; additional POSSE destinations; graph DB; VC; private decentralized storage; public API auth; agent endpoints; `llms.txt`; JSON Feed; runtime database; automated POSSE lifecycle; cross-platform edit/delete reconciliation.

**Must continue working unchanged in behavior:** existing note URLs, RSS endpoint, sitemap, h-entry/h-card, Webmention discovery/render/send, Bluesky POSSE CLI, `u-syndication`, ATProto DID file, drafting room, publication gates, Vercel static deployment.

---

## 4. Architectural invariants

1. **Identity ≠ slug ≠ URL ≠ external protocol ID.** IDs never appear in public URL paths unless a future projection explicitly chooses that (not in this milestone).
2. **Domain types contain no protocol concepts.** No RSS, microformats, Webmention, Bluesky, ATProto, ActivityPub, or Astro types in `src/core/domain/`.
3. **Protocols depend on domain; domain never depends on protocols.**
4. **karthikg.in owns meaning; platforms are copies and interaction surfaces.**
5. **Storage is Git Markdown; domain is derived at build/CLI time**, not live-queried from a DB.
6. **Publication gate semantics are unchanged:** `draft: false` AND `privacyReviewed: true` for public notes.

---

## 5. Current-to-target architecture diagram

```text
TODAY                              TARGET (same runtime shape)
────────                           ─────────────────────────────

Markdown frontmatter               Markdown frontmatter
(implicit model)                   + id, slug, relationships, person.yaml
       │                                    │
       ▼                                    ▼
Astro collections directly         src/core/storage mappers
       │                                    │
       ▼                                    ▼
pages / CLIs import                src/core/domain objects
src/lib/indieweb.ts (mixed)               │
       │                          ┌───────┴────────┐
       ▼                          ▼                ▼
HTML / RSS / WM / POSSE      adapters:        adapters:
                             presentation     feeds / webmention /
                             (microformats)   syndication (bluesky)
                                     │                │
                                     └────────┬───────┘
                                              ▼
                                    Astro pages + CLIs (unchanged URLs)
```

**What changes internally:** pages and CLIs read domain objects through mappers and adapters instead of mixing domain rules with protocol code in `indieweb.ts`.

**What does not change externally:** URL paths, feed locations, Webmention endpoints, POSSE commands, drafting isolation.

---

## 6. Domain model

### 6.1 Overview

| Symbol | Kind | Public? | Purpose |
| --- | --- | --- | --- |
| `ObjectId` | value object | — | Immutable identifier for any canonical object |
| `Slug` | value object | — | Mutable URL segment |
| `Visibility` | value object | — | Publication / access state |
| `Topic` | value object (`string`) | — | Loose categorization; not a graph node |
| `Relationship` | value object | — | Typed edge to internal ID or external URL |
| `SyndicationCopy` | value object | — | Known copy of content on an external surface |
| `Person` | **domain entity** | yes | Canonical public identity |
| `Note` | **domain entity** | gated | Workbench note (short-form content) |
| `Project` | **domain entity** | yes | First-party description of shipped work |

There is **no separate `Content` entity class**. Instead, `Note` and `Project` share a small **structural type** for cross-cutting helpers (URL building, ID typing). This avoids a premature inheritance hierarchy.

```typescript
// Illustrative — specification only
type ObjectId = string & { readonly __brand: 'ObjectId' };

interface Identified {
  id: ObjectId;
  slug: string;
}

interface PublicObject extends Identified {
  createdAt: Date;
  updatedAt?: Date;
  topics: string[]; // Topic[]
}
```

### 6.2 Person

**Purpose:** Single source of truth for Karthik’s public identity on karthikg.in.

| Field | Mutable | Notes |
| --- | --- | --- |
| `id` | no | One well-known ID (assigned once; see §7) |
| `siteUrl` | rarely | `https://karthikg.in` |
| `name` | yes | Display name |
| `givenName` | yes | Optional; for structured exports later |
| `tagline` | yes | Short description for meta/home (not long bio prose) |
| `avatarPath` | yes | Site-relative path, e.g. `/avatar.svg` |
| `organization` | yes | `{ name, url }` — Thea Foundry |
| `contactMethods` | yes | Ordered list: `{ kind: 'email' \| 'url', value, label?, rel?: string[] }` |
| `externalIdentities` | yes | `{ label, url, rel: string[] }[]` for GitHub, Bluesky, LinkedIn, etc. |
| `atproto` | yes | `{ did, handle, profileUrl }` — identity facts, not content authority |
| `interests` | yes | Short public interest strings (optional; for future profile JSON) |

**Canonical URL:** `/` (site root represents the person). No `/person/<id>/` route in this milestone.

**Lifecycle:** Edited in Git; loaded at build; no draft gate (always public).

**Storage:** `src/content/person.yaml` (new file). Not an Astro content collection — a single validated data file to avoid “collection of one” ceremony.

**Boundary — identity facts vs page prose:**

| Belongs in `Person` | Stays in page templates |
| --- | --- |
| Name, tagline, avatar, org link | Long bio paragraphs on `/about` |
| Email, social URLs, `rel="me"` targets | Narrative “Focus Areas” sections |
| ATProto DID/handle references | `/now` dated activities and reading lists |
| Site URL | Colophon operational details (hosting, DNS) |

`/now` remains an **`h-entry` page** with its own prose and `dt-updated`; it is **not** part of Person.

### 6.3 Note

**Purpose:** Canonical workbench note (IndieWeb note/reply/bookmark/scrap).

| Field | Mutable | Notes |
| --- | --- | --- |
| `id` | no | UUIDv7 (§7) |
| `slug` | yes | Current URL segment; default = filename stem at migration |
| `previousSlugs` | append-only | For redirects (§8) |
| `title` | yes | |
| `summary` | yes | Optional |
| `body` | yes | Markdown source |
| `bodyFormat` | rarely | `'markdown'` (explicit for mapper) |
| `presentation` | yes | `'note' \| 'scrap'` |
| `relationships` | yes | General model (§11); includes reply/bookmark |
| `topics` | yes | string[] |
| `syndication` | yes | `SyndicationCopy[]` (§14) |
| `visibility` | yes | Derived from `draft` + `privacyReviewed` |
| `createdAt` | yes | from `date` |
| `updatedAt` | yes | optional |

**Derived (not stored in domain persistence):** `noteKind: 'note' \| 'scrap' \| 'reply' \| 'bookmark'` computed from `presentation` + relationships (same precedence as today’s `classifyNote`).

**Canonical URL:** `https://karthikg.in/notes/{slug}/` (trailing slash preserved).

**Lifecycle:** Draft → privacy review → publish (dual gate) → optional WM send → optional POSSE → optional slug rename with redirect.

**Storage:** `src/content/notes/<slug>.md` — **filename may diverge from `slug` field later**, but initially they match to reduce churn.

**Public?** Only when `visibility === 'public'`.

### 6.4 Project

**Purpose:** First-party canonical description of a project; external product URL is a link, not identity.

| Field | Mutable | Notes |
| --- | --- | --- |
| `id` | no | UUIDv7 |
| `slug` | yes | URL segment |
| `previousSlugs` | append-only | |
| `title` | yes | |
| `description` | yes | Short summary (card + meta) |
| `body` | yes | Markdown detail page content |
| `status` | yes | optional enum: `'active' \| 'maintained' \| 'archived'` — **optional field**, default unset |
| `featured` | yes | boolean |
| `topics` | yes | tags |
| `links` | yes | `{ kind: 'project' \| 'github' \| 'other', url, label? }[]` |
| `relationships` | yes | e.g. `about` links to notes later |
| `createdAt` | yes | from `date` |
| `updatedAt` | yes | optional |

**Canonical URL:** `https://karthikg.in/projects/{slug}/` (**new route**).

**Lifecycle:** Published when present in Git (no draft gate for projects in v1; see §19 open question).

**Storage:** `src/content/projects/<slug>.md` — existing files remain; add `id`, `slug`, optional `previousSlugs`.

**Public?** Always (all current projects are public).

### 6.5 Relationship (value object)

```typescript
type RelationshipType =
  | 'reply-to'
  | 'bookmark-of'
  | 'related-to'
  | 'about'
  | 'builds-on'
  | 'supersedes';

type RelationshipTarget =
  | { kind: 'internal'; id: ObjectId; expectedKind?: 'note' | 'project' }
  | { kind: 'external'; url: string };

interface Relationship {
  type: RelationshipType;
  target: RelationshipTarget;
}
```

**Implemented in milestone:** `reply-to`, `bookmark-of` (parity with today). Others are **typed but unused** until needed — no migration required for them now.

**Tags vs relationships:** **Tags remain separate.** Tags are non-directional labels (`topics: string[]`). Relationships are explicit typed edges. Do not model tags as `Relationship { type: 'tag' }`.

### 6.6 SyndicationCopy (value object)

Minimal now; structured enough to grow:

```typescript
interface SyndicationCopy {
  url: string; // required — preserves current behavior
}
```

Optional internal fields (not required in frontmatter yet): `destination` inferred from URL hostname at adapter layer.

---

## 7. ID strategy

### 7.1 Choice: **UUIDv7** (RFC 9562)

**Why UUIDv7 over ULID / plain UUIDv4 / namespaced strings:**

| Criterion | UUIDv7 |
| --- | --- |
| Locally generated | yes — `crypto`-based generator at authoring/migration time |
| No infrastructure | yes |
| Immutable | yes |
| Globally unique enough | yes for personal-site scale and export |
| Frontmatter-friendly | yes — `id: 018f3b2a-7c4e-7b3a-b123-456789abcdef` |
| Human debugging | time-ordered prefix aids sorting in logs/Git blame |
| Sortable | yes (unlike v4) |
| Federation-ready | standard URN/UUID interchange |

ULID is shorter but less universally recognized in YAML tooling; plain UUIDv4 lacks time ordering; **hash-of-slug is forbidden** (must not derive from slug).

**IDs are not placed in public URLs** in this milestone.

### 7.2 ID assignment rules

1. **New objects:** author generates UUIDv7 when creating content (editorial template + drafting handoff updated).
2. **Existing objects:** one-time assignment recorded in a **committed migration registry** (see §16).
3. **Validation:** Zod `z.string().uuid()` on `id` in content schemas.
4. **Person ID:** single constant in `person.yaml`, assigned during migration.

### 7.3 Migration registry (determinism)

File: `src/content/.object-id-registry.json` (committed to Git)

```json
{
  "version": 1,
  "notes": {
    "first-note-probably.md": "018f3b2a-7c4e-7b3a-b123-456789abcdef"
  },
  "projects": {
    "neighborbook.md": "018f3b2a-8d11-7b3a-b123-456789abcdef"
  },
  "person": "018f3b2a-0000-7b3a-b123-456789abcdef"
}
```

**Rules:**

- Registry keys are **stable storage paths** (filename), not slug.
- On first migration, a script assigns UUIDv7 per file and writes registry + frontmatter `id`.
- Subsequent builds **must** use registry if frontmatter `id` missing (safety) but normal state is id in frontmatter matching registry.
- **Never recompute** IDs from slug or content hash.
- CI test fails if registry and frontmatter disagree.

---

## 8. URL and redirect policy

### 8.1 Relationships

```text
ObjectId     — immutable identity (UUIDv7)
slug         — mutable routing key
canonicalUrl — https://karthikg.in/{collection}/{slug}/
previousSlugs— history for redirects only
```

### 8.2 Initial migration

- For every existing note: `slug` = current filename stem (e.g. `first-note-probably`).
- **Canonical URLs unchanged:** `/notes/first-note-probably/` etc.
- `previousSlugs: []`.

### 8.3 Slug rename behavior

When a note or project slug changes from `old-slug` to `new-slug`:

1. `id` unchanged.
2. Append `old-slug` to `previousSlugs` (dedupe; never remove).
3. Build generates **308 permanent redirect:** `/notes/old-slug/` → `/notes/new-slug/` (same for projects).
4. Canonical `<link rel="canonical">`, sitemap, and new POSSE permalinks use **new** URL.
5. **Existing syndicated Bluesky posts:** unchanged (still point to old URL if that was published URL). Old URL redirects to new — link still resolves. **No re-POSSE required.**
6. **Incoming Webmentions** targeting old URL: still valid; webmention.io stores target URL; browser fetches mentions for **current canonical URL** only (today’s behavior). After rename, note page at new URL should **also** query mentions for `previousSlugs` URLs OR rely on WM aggregator’s redirect following.

**Milestone requirement (adapter, not domain):** Webmention display adapter requests JF2 for **current canonical URL** plus each `previousSlugs` URL (merge/dedupe client-side). Domain exposes `allWebmentionTargetUrls(): string[]`.

### 8.4 Redirect implementation (static-friendly)

**No runtime DB.** At build time:

1. Mapper collects all `(previousSlug, currentSlug, collection)` tuples.
2. Script emits redirects into **`astro.config.mjs`** via generated partial, e.g. `src/generated/redirects.mjs` imported by config:

```javascript
// generated at build — example
export const slugRedirects = {
  '/notes/old-slug/': '/notes/new-slug/',
  '/projects/old-name/': '/projects/new-name/',
};
```

3. Astro `redirects` config merges these (Astro 7 supports static redirects with Vercel adapter).

Alternative acceptable path: merge into `vercel.json` `redirects` at build — choose one mechanism in implementation; spec requires **308 permanent**.

### 8.5 RSS GUID policy

| Phase | Behavior |
| --- | --- |
| Initial migration | **Keep** `<guid isPermaLink="true">{current canonical URL}</guid>` — unchanged URLs ⇒ unchanged GUIDs |
| After slug rename (future) | `<link>` = current URL; `<guid isPermaLink="false">urn:karthikg.in:note:{id}</guid>` to avoid duplicate feed items |

Domain provides `rssGuid(note): string` in **feeds adapter** (URN form uses ID), not in domain types as RSS-specific knowledge — adapter imports `ObjectId` only.

**Backward compatibility:** switch GUID strategy only when first slug rename occurs (or explicit follow-up migration). Initial Personal Web Core deploy does not change GUIDs.

### 8.6 Filename vs slug

**Initial convention:** keep filename = `{slug}.md` to minimize Astro glob surprises.

**Later:** optional decoupling (`018f....md` or `{slug}.md` with slug in frontmatter) — **deferred** unless needed. Spec recommends **filename tracks slug** through this milestone to preserve `note.id` Astro compatibility during transition.

---

## 9. Person model (storage example)

`src/content/person.yaml`:

```yaml
id: 018f3b2a-0000-7b3a-b123-456789abcdef
siteUrl: https://karthikg.in
name: Karthik Gurumoorthy
tagline: I build useful software for families and everyday life.
avatarPath: /avatar.svg
organization:
  name: Thea Foundry
  url: https://theafoundry.com
contactMethods:
  - kind: email
    value: karthi@hey.com
    rel: [me]
externalIdentities:
  - label: GitHub
    url: https://github.com/karthikg80
    rel: [me]
  - label: Bluesky
    url: https://bsky.app/profile/karthikg.in
    rel: [me, atproto]
  - label: LinkedIn
    url: https://www.linkedin.com/in/karthikg80/
    rel: [me]
  - label: Thea Foundry
    url: https://theafoundry.com
    rel: [me]
atproto:
  did: did:plc:k25m3ebqwdr32ojecqpjfzbh
  handle: karthikg.in
  profileUrl: https://bsky.app/profile/karthikg.in
interests:
  - personal web
  - calm software
  - household tools
```

**Projections (this milestone):**

- `Layout.astro` head links generated from `externalIdentities` + email
- `index.astro` h-card from Person
- `contact.astro` cards from `contactMethods` + `externalIdentities`
- `public/.well-known/atproto-did` **unchanged file** (still static); Person holds copy for future generation — optional later sync, not required now

---

## 10. Project model (storage example)

`src/content/projects/neighborbook.md` after migration:

```yaml
id: 018f3b2a-8d11-7b3a-b123-456789abcdef
slug: neighborbook
title: Neighborbook
description: Private, invite-only community memory...
date: 2026-07-30
tags: [Communities, Privacy, Next.js, Supabase]
featured: true
links:
  - kind: project
    url: https://neighborbook.theafoundry.com
previousSlugs: []
relationships: []
```

Body Markdown below frontmatter becomes detail page content.

**Listing page (`/projects`):** unchanged UX; cards link to **`/projects/{slug}/`** instead of only external URLs.

**External URL role:** `links[kind=project]` renders as “Visit project →”; `u-url` on listing may remain external for IndieWeb “syndicated product” semantics **or** switch first-party URL as `u-url` with external link secondary — **recommendation:** detail page uses first-party URL as canonical; card `u-url` = first-party project page (see §19).

---

## 11. Relationship model

### 11.1 Frontmatter (target)

Notes gain:

```yaml
relationships:
  - type: reply-to
    target:
      kind: external
      url: https://example.com/post
```

Internal example (future-friendly):

```yaml
relationships:
  - type: related-to
    target:
      kind: internal
      id: 018f3b2a-7c4e-7b3a-b123-456789abcdef
      expectedKind: note
```

### 11.2 Migration from legacy fields

During transition, mapper applies:

```text
if relationships empty and inReplyTo set
  → synthesize Relationship { type: reply-to, external url }
if relationships empty and bookmarkOf set
  → synthesize Relationship { type: bookmark-of, external url }
if relationships present
  → use relationships (legacy fields ignored)
```

**Microformat projection (presentation adapter):**

- `reply-to` external → `<a class="u-in-reply-to" href="...">`
- `bookmark-of` external → `<a class="u-bookmark-of" href="...">`
- internal targets → resolve slug at build time to URL in HTML

**Webmention CLI:** outbound targets = external URLs from `reply-to` / `bookmark-of` + links in body (same as today’s `extractOutboundLinks` + legacy fields).

### 11.3 Internal target stability

Internal relationships reference **`ObjectId`**, not slug. If target slug changes, resolution at build time uses ID → current slug map; relationship unchanged.

---

## 12. Storage / repository design

### 12.1 Principle

```text
Markdown / YAML files
        ↓  parse (Astro content + Zod)
Storage records (typed frontmatter + body)
        ↓  map
Domain objects (Person, Note, Project)
        ↓  project
Adapters (HTML, RSS, WM, POSSE)
```

### 12.2 Single repository module (prefer simplicity)

One module **`ContentStore`** (name illustrative) with functions:

```typescript
interface ContentStore {
  getPerson(): Person;
  getNotes(): Note[];
  getPublishedNotes(): Note[];
  getProjects(): Project[];
  getNoteBySlug(slug: string): Note | undefined;
  getProjectBySlug(slug: string): Project | undefined;
  getNoteById(id: ObjectId): Note | undefined;
  // slug redirect index
  getSlugRedirects(): Array<{ fromPath: string; toPath: string; permanent: true }>;
}
```

**Instantiation:** build-time singleton in Astro pages via `getStore()` that wraps `getCollection()` results — **still uses Astro content collections** for glob + schema validation.

### 12.3 Responsibilities

| Concern | Location |
| --- | --- |
| Parsing Markdown/YAML | Astro loaders + Zod in `content.config.ts` |
| Schema validation | `content.config.ts` |
| Publication filtering | domain function `isPublic(note)` (moved from `indieweb.ts`) |
| Entry → domain mapping | `src/core/storage/map-note.ts`, `map-project.ts`, `map-person.ts` |
| Domain rules (kind, URLs) | `src/core/domain/*.ts` |
| Astro `note.id` coupling | **Removed gradually** — pages use `note.slug` from domain |

### 12.4 What stays Astro-native

- Content collections for glob discovery and MDX/render
- `render(note)` for Markdown → HTML in note pages
- Static `getStaticPaths` for notes/projects

Domain stores **Markdown body** as string; rendered HTML remains an Astro/presentation concern for note pages.

---

## 13. Adapter / module boundaries

### 13.1 Directory structure

```text
src/
  core/
    domain/
      ids.ts              # ObjectId brand, uuid validation helpers
      person.ts             # Person type
      note.ts               # Note type, deriveNoteKind()
      project.ts            # Project type
      relationship.ts       # Relationship types
      syndication.ts        # SyndicationCopy
      visibility.ts         # isPublic(), publication gate
      urls.ts               # canonicalUrl(note|project, siteOrigin) — path only, no Astro
    storage/
      content-store.ts      # ContentStore implementation
      map-person.ts
      map-note.ts
      map-project.ts
      registry.ts           # .object-id-registry.json loader
  adapters/
    presentation/
      microformats.ts       # classify → CSS classes, u-* helpers
      host-label.ts         # generic URL hostname label
    feeds/
      rss.ts                # RSS XML from domain notes + rendered HTML input
    webmention/
      discovery.ts          # discoverWebmentionEndpoint, sendWebmention
      webmention-io.ts      # receiver + JF2 feed URL constants
      outbound-targets.ts   # extract links from body + relationships
    syndication/
      bluesky/
        post-text.ts        # buildBlueskyPostText (300 char limit)
        posse-cli.ts        # moved from src/lib/posse-bluesky.ts
  lib/                      # shrink to thin re-exports during migration, then remove
  pages/                    # consume core + adapters only
  scripts/
    migrate-assign-ids.ts   # one-time / CI check helper
    generate-redirects.ts   # optional explicit step
```

### 13.2 Allowed dependencies

```text
pages, components, scripts/CLI
    → adapters/*, core/storage, core/domain

adapters/*
    → core/domain (and core/storage for CLI)

core/storage
    → core/domain, astro:content (ONLY in storage layer)

core/domain
    → nothing except standard lib / zod types if needed

drafting-auth, drafting-room
    → isolated (no domain dependency required)
```

**Forbidden:** `core/domain` importing from `adapters/*`, `pages/*`, or protocol-specific modules.

### 13.3 `src/lib/indieweb.ts` decomposition

| Symbol today | New home |
| --- | --- |
| `isPublishedNote` | `core/domain/visibility.ts` → `isPublicNote()` |
| `classifyNote` / `NoteKind` | `core/domain/note.ts` → `deriveNoteKind()` |
| `hostLabel` | `adapters/presentation/host-label.ts` |
| `normalizeSyndicationUrl` | `adapters/syndication/bluesky/` or delete if still unused |
| `extractOutboundLinks`, `markdownToLinkHtml` | `adapters/webmention/outbound-targets.ts` |
| `discoverWebmentionEndpoint`, `sendWebmention` | `adapters/webmention/discovery.ts` |
| `buildBlueskyPostText` | `adapters/syndication/bluesky/post-text.ts` |
| `webmentionReceiverUrl`, `webmentionFeedUrl` | `adapters/webmention/webmention-io.ts` |

During migration, `src/lib/indieweb.ts` re-exports from new locations for one release cycle if needed.

---

## 14. Syndication representation

### 14.1 Now (milestone)

**Keep frontmatter as URL list** for backward compatibility:

```yaml
syndication:
  - https://bsky.app/profile/karthikg.in/post/3mtrz4v5yut2a
```

Domain maps to `SyndicationCopy[]` with `{ url }` only.

### 14.2 Optional forward-compatible form (accepted, not required)

```yaml
syndication:
  - url: https://bsky.app/profile/karthikg.in/post/3mtrz4v5yut2a
```

Mapper accepts **string OR `{ url }`** union.

### 14.3 Explicitly deferred

```yaml
# NOT in this milestone
# destination: bluesky
# externalId: at://...
# state: published
```

**Distinction:** `Note.id` is canonical identity; `SyndicationCopy.url` is an external locator of a **copy**, never an alternate primary key.

POSSE CLI continues to print URL for human to paste into `syndication` — no operational automation change.

---

## 15. Backward compatibility checklist

| Requirement | Design compliance |
| --- | --- |
| Existing note URLs | slug unchanged at migration |
| RSS URLs / item links | same URLs initially; same GUIDs initially |
| Sitemap | same note paths; adds project detail URLs |
| h-entry / h-card | presentation adapter preserves classes |
| Webmention discovery | still webmention.io via Layout head |
| Inbound WM render | JF2 fetch; extended to historical slug URLs |
| Outgoing WM CLI | same CLI command; uses adapters |
| Bluesky POSSE CLI | same command; resolves note by slug |
| u-syndication | from domain `syndication` |
| ATProto DID file | static file untouched |
| Drafting room | unchanged; handoff adds `id` field generation |
| Publication gates | domain `isPublicNote()` same logic |
| Vercel / no DB | build-time only |
| Existing Bluesky posts | old URLs redirect after rename; no recreate |

---

## 16. Migration sequence

Ordered by dependency graph (not arbitrary A–F labels):

### Stage 0 — Tooling & registry (no runtime change)

- Add `src/content/.object-id-registry.json` schema
- Add `scripts/migrate-assign-ids.ts` to assign UUIDv7 per file
- Add tests: registry ↔ frontmatter consistency

**Risk:** low  
**Runtime change:** none

### Stage 1 — Domain types + schemas

- Add `id`, `slug`, `previousSlugs`, `relationships` to Zod schemas
- Keep legacy `inReplyTo` / `bookmarkOf` optional in schema
- Run migration script on notes + projects; add `person.yaml`
- **Do not change pages yet**

**Files:** `content.config.ts`, content markdown, new `person.yaml`, registry  
**Risk:** low (additive frontmatter)  
**Tests:** schema validation, ID presence

### Stage 2 — Storage mappers + ContentStore

- Implement `core/domain/*`, `core/storage/*`
- `getPublishedNotes()` moves to ContentStore; thin wrapper in `lib/notes.ts` temporarily

**Risk:** low if wrappers preserve signatures  
**Tests:** map fixtures → domain objects; publication gate

### Stage 3 — Adapter extraction

- Split `indieweb.ts` per §13.3
- Update imports in pages, components, CLIs, tests
- **`indieweb.test.ts` → split** across domain + adapter tests

**Risk:** medium (import paths)  
**Tests:** existing 12 tests must pass (behavior parity)

### Stage 4 — Person centralization

- Wire `Layout.astro`, `index.astro`, `contact.astro` to Person from store
- Remove duplicated identity constants

**Risk:** low if fields match current output  
**Tests:** snapshot or DOM tests for `rel="me"` links optional; manual visual check

### Stage 5 — Project detail pages

- Add `src/pages/projects/[slug].astro`
- Update `ProjectCard` to link first-party URL
- Add project paths to sitemap

**Risk:** medium (new URLs — additive, not breaking)  
**Tests:** static paths count; canonical URL helper

### Stage 6 — Relationship frontmatter migration

- Convert `inReplyTo` / `bookmarkOf` to `relationships` in Git for existing notes (optional batch edit)
- Mapper keeps legacy fallback

**Risk:** low  
**Tests:** deriveNoteKind parity; microformat output

### Stage 7 — Slug redirect generation

- Implement `previousSlugs` + build-time redirect manifest
- Webmention UI fetches multiple target URLs

**Risk:** medium until first rename tested  
**Tests:** redirect map; WM target list includes historical slugs

### Stage 8 — RSS GUID hardening (optional, defer until first rename)

- Switch to URN guid when slug rename happens

**Risk:** feed reader duplication if misapplied — gate behind rename event

---

## 17. Test strategy

### 17.1 Domain tests (`core/domain`)

- `isPublicNote` — same matrix as current `isPublishedNote` test
- `deriveNoteKind` — reply/bookmark/scrap/note precedence
- `canonicalNotePath(slug)` → `/notes/{slug}/`
- Relationship resolution helpers (pure)

### 17.2 Storage tests

- Map legacy frontmatter (no `relationships`) → domain Note with synthesized edges
- Registry/frontmatter ID mismatch throws or fails CI
- **Identity stability:** same file parsed twice → same `id`

### 17.3 Identity / URL tests

- **Slug rename:** change slug in fixture → `id` unchanged, redirect entry emitted
- **Projection consistency:** same Note → same canonical URL from `urls.ts`, RSS adapter, POSSE adapter

### 17.4 Adapter tests

- Webmention discovery/send (move existing tests)
- Bluesky post text (move existing tests)
- Outbound target extraction includes relationship URLs

### 17.5 Import boundary test (lightweight)

Script or Vitest test scanning `src/core/domain/**/*.ts` imports — fail if any import path matches `/adapters/|astro:|indieweb/`.

Optional: ESLint `no-restricted-imports` rule per directory.

### 17.6 Migration safety integration

- Fixture note `first-note-probably` → canonical URL `/notes/first-note-probably/` before and after migration
- Published note count unchanged

---

## 18. Risks and tradeoffs

| Risk | Mitigation |
| --- | --- |
| Astro `note.id` filename coupling | Keep filename = slug through milestone; domain uses explicit `slug` field |
| RSS GUID change duplicates items | Defer URN guid until first rename |
| Webmentions on renamed URLs | Fetch JF2 for all known target URLs |
| Scope creep into POSSE automation | Syndication stays URL[]; CLI unchanged |
| Over-abstraction | Single ContentStore, no DI container, no plugin registry |
| Person YAML drift from pages | Migrate identity facts only; snapshot tests on head links |
| Project `u-url` semantics change | Document choice in implementation PR (§19) |

---

## 19. Deferred decisions

| Topic | Status |
| --- | --- |
| Project draft gate | Not needed today (all public); revisit if drafts added |
| Filename decoupled from slug | Defer |
| Structured syndication with `at://` | Defer |
| RSS URN guid | Defer until slug rename |
| Auto-generate `atproto-did` from Person | Defer |
| Internal `reply-to` between notes | Typed but unused |

---

## 20. Open questions

1. **Project card `u-url`:** Should listing cards use first-party `/projects/{slug}/` or external product URL as `u-url`? **Recommendation:** first-party URL as canonical `u-url`, external as separate link — aligns with “site owns description.” Confirm before Stage 5.

2. **Project body on listing vs detail:** Current cards use frontmatter `description` only; detail page adds body — no conflict. Confirm long-term.

3. **Registry location:** `.object-id-registry.json` under `src/content/` vs `src/core/storage/` — prefer `src/content/` adjacent to data it indexes.

---

## Complexity justification (abbreviated)

| Abstraction | Future change made easier |
| --- | --- |
| UUIDv7 + registry | Slug rename, export, stable internal references |
| Person.yaml | JSON-LD/WebFinger/profile JSON without hunting pages |
| ContentStore | Swap Astro collections later without touching adapters |
| Relationship model | `builds-on`, project↔note links without new frontmatter keys each time |
| Adapter split | Add syndication destination without touching publication rules |
| previousSlugs + redirects | Permalink evolution without breaking inbound links |

**Not introduced:** event bus, plugin system, graph DB, protocol registry, DI container, runtime API layer.

---

## Final review checklist

- [x] Existing public note URLs remain valid (slug unchanged at migration)
- [x] Git Markdown remains storage
- [x] No database
- [x] Domain types protocol-free
- [x] Object identity independent of slug
- [x] Person has one canonical source (`person.yaml`)
- [x] Projects gain `/projects/<slug>/`
- [x] Internal relationships target immutable IDs
- [x] Webmention behavior preserved (+ historical slug fetch)
- [x] Bluesky POSSE preserved
- [x] RSS preserved (GUID unchanged initially)
- [x] Draft/privacy gates unchanged
- [x] Deferred protocols not in scope
- [x] Each abstraction has concrete justification

---

**Do not implement until this spec is reviewed and approved.**
