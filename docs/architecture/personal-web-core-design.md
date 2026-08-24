# Personal Web Core — Design Specification

**Status:** Approved for implementation planning  
**Implementation:** Not approved until [`personal-web-core-implementation-plan.md`](./personal-web-core-implementation-plan.md) is reviewed  
**Builds on:** [`current-personal-web-architecture.md`](./current-personal-web-architecture.md)  
**Repository baseline:** Astro 7 + Vercel, Git Markdown collections, `note.id` = filename slug (`src/lib/notes.ts:18-19`), no runtime DB.

---

## 1. Context

karthikg.in is a static-first personal site with first-party Markdown, dual publication gates, IndieWeb markup, delegated Webmentions, and manual Bluesky POSSE. The audit identified strengths (Git storage, slug URLs, RSS from published notes) and gaps (slug-as-identity, fragmented Person data, projects without first-party detail URLs, protocol helpers in `src/lib/indieweb.ts`).

**Personal Web Core** adds a protocol-neutral domain layer and stable object identity while preserving current public behavior. No database, no new protocols, no change to Webmention.io or Bluesky POSSE operation.

---

## 2. Goals

1. Immutable **ObjectId** for Person, Note, and Project — independent of slug, file, and presentation.
2. **One canonical Person** source for identity projections.
3. **First-party Project URLs** at `/projects/<slug>/` as canonical project identity.
4. **Relationships** for `reply-to` and `bookmark-of` with stable internal ID targets.
5. **Dependency direction:** adapters → domain ← storage mappers ← Git files.
6. **Build-time domain instantiation**; Git Markdown remains storage.
7. **Incremental migration** with deployable steps.

---

## 3. Non-goals

ActivityPub; self-hosted ATProto PDS; custom Lexicons; new DID infrastructure; IndieAuth server; first-party Webmention receiver; Webmention persistence migration; additional POSSE destinations; graph DB; VC; decentralized storage; public API auth; agent endpoints; `llms.txt`; JSON Feed; runtime database; automated POSSE lifecycle; cross-platform edit/delete reconciliation.

**Must keep working:** existing note URLs (at migration), RSS endpoint, sitemap note URLs, h-entry/h-card, Webmention discovery/render/send, Bluesky POSSE CLI, `u-syndication`, static `public/.well-known/atproto-did`, drafting room, dual publication gates, Vercel deployment.

---

## 4. Architectural invariants

1. **ObjectId ≠ slug ≠ canonical URL ≠ external protocol ID.** IDs are not public URL path segments in this milestone.
2. **Frontmatter/data `id` is the sole durable identity source** after migration (§7).
3. **Domain contains no protocol concepts** — no RSS, microformats, Webmention, Bluesky, ATProto, ActivityPub, or Astro types in `src/core/domain/`.
4. **Protocols depend on domain; domain never depends on protocols.**
5. **karthikg.in owns meaning; platforms are distribution and interaction surfaces.**
6. **Publication truth:** storage holds `draft` + `privacyReviewed`; domain holds a single derived `PublicationState` (§6.3).
7. **Public notes:** `draft: false` AND `privacyReviewed: true` — unchanged editorial contract.

---

## 5. Current-to-target architecture

```text
Git Markdown / person.yaml
            │
            ▼
      Astro/Zod records
            │
            ▼
       storage mappers
            │
            ▼
       domain objects
            │
       ┌────┼──────────────┐
       ▼    ▼              ▼
 presentation feeds    social/web adapters
       │    │              │
       ▼    ▼              ▼
     HTML  RSS      Webmention / Bluesky
            │
            ▼
     routing adapter → Astro/Vercel redirects
```

**Internal change:** pages/CLIs consume domain objects through mappers and adapters.  
**External stability:** URL paths, feed location, Webmention endpoints, POSSE commands unchanged at migration.

---

## 6. Domain model

### 6.1 Core types

| Symbol | Kind | Purpose |
| --- | --- | --- |
| `ObjectId` | value object | Immutable UUIDv7 identity |
| `PublicationState` | value object | Single derived publication state for notes |
| `Relationship` | value object | Typed edge (`reply-to` \| `bookmark-of`) |
| `SyndicationCopy` | value object | External copy locator (`url`) |
| `Person` | entity | Canonical public identity |
| `Note` | entity | Workbench note |
| `Project` | entity | First-party project description |

Topics remain `string[]` on Note and Project — not relationships.

There is no generic `Content` entity class. Note and Project share helpers (`Identified`, URL path builders) only.

```typescript
type ObjectId = string & { readonly __brand: 'ObjectId' };

type PublicationState =
  | 'draft'
  | 'awaiting-privacy-review'
  | 'public';

interface Identified {
  id: ObjectId;
  slug: string;
  previousSlugs: string[];
}
```

### 6.2 Person

**Purpose:** Single source of truth for public identity facts on karthikg.in.

| Field | Mutable | Notes |
| --- | --- | --- |
| `id` | no | UUIDv7, assigned once |
| `siteUrl` | rarely | `https://karthikg.in` |
| `name` | yes | Display name |
| `tagline` | yes | Short description for meta/home |
| `avatarPath` | yes | Site-relative, e.g. `/avatar.svg` |
| `organization` | yes | `{ name, url }` |
| `contactMethods` | yes | `{ kind: 'email', value, label?, rel? }[]` |
| `externalIdentities` | yes | See below |
| `interests` | yes | Optional short strings |

**External identity** (general model — no protocol-privileged top-level fields):

```typescript
interface ExternalIdentity {
  kind: string;           // e.g. 'website', 'atproto', 'github'
  label: string;
  url: string;
  rel: string[];
  identifiers?: Record<string, string>;  // protocol-specific attrs, e.g. handle, did
}
```

ATProto (Bluesky) is one `externalIdentities` entry with `kind: 'atproto'` and `identifiers: { handle, did }`. The domain does not treat ATProto as special.

**Canonical URL:** `/` (person represented at site root; no `/person/<id>/` route).

**Storage:** `src/content/person.yaml` — validated data file, not an Astro collection.

**Identity facts vs page prose:**

| In `Person` | In page templates |
| --- | --- |
| Name, tagline, avatar, org | Long bio on `/about` |
| Contact + external identities | Focus areas, narrative sections |
| | `/now` dated activities |
| | Colophon hosting/DNS details |

`/now` stays an independent `h-entry` page.

**Static `public/.well-known/atproto-did`:** unchanged in this milestone; not generated from Person.

### 6.3 Note

| Field | Mutable | Notes |
| --- | --- | --- |
| `id` | no | UUIDv7 — authoritative in frontmatter |
| `slug` | yes | Current URL segment |
| `previousSlugs` | append-only | Historical slugs for redirects |
| `title`, `summary`, `body` | yes | Body is Markdown source |
| `presentation` | yes | `'note' \| 'scrap'` |
| `relationships` | yes | `reply-to` / `bookmark-of` only (§11) |
| `topics` | yes | string[] |
| `syndication` | yes | `SyndicationCopy[]` |
| `publication` | yes | Derived `PublicationState` (§6.7) |
| `legacyRssGuid` | no | Optional; migration-only RSS compatibility URL (§8.5) |
| `createdAt`, `updatedAt` | yes | From `date` / `updated` |

**Derived at map time (not stored):** `noteKind: 'note' \| 'scrap' \| 'reply' \| 'bookmark'` via `deriveNoteKind()` — same precedence as today’s `classifyNote`.

**Canonical URL path:** `/notes/{slug}/` (trailing slash preserved).

**Public:** `publication === 'public'` only.

**Storage:** `src/content/notes/{slug}.md` with `id` in frontmatter. Filename tracks `slug` through this milestone.

### 6.4 Project

| Field | Mutable | Notes |
| --- | --- | --- |
| `id` | no | UUIDv7 |
| `slug` | yes | |
| `previousSlugs` | append-only | |
| `title`, `description`, `body` | yes | |
| `featured` | yes | |
| `topics` | yes | |
| `links` | yes | `{ kind: 'live' \| 'github' \| 'other', url, label? }[]` |
| `relationships` | yes | Empty at milestone; same type as notes |
| `createdAt`, `updatedAt` | yes | |

**Canonical URL:** `https://karthikg.in/projects/{slug}/` — **the Project object’s canonical first-party identity.**

- Detail page `<link rel="canonical">` = first-party URL.
- Listing card `u-url` = first-party project URL.
- `links[kind=live]` = “Visit project →” secondary link.
- `links[kind=github]` = GitHub link.
- External product URL is **never** the Project’s canonical identity.

**Storage:** `src/content/projects/{slug}.md`. No draft gate (all current projects are public).

### 6.5 Relationship

Extensible shape; **milestone vocabulary is only:**

```typescript
type RelationshipType = 'reply-to' | 'bookmark-of';

type RelationshipTarget =
  | { kind: 'internal'; id: ObjectId }
  | { kind: 'external'; url: string };

interface Relationship {
  type: RelationshipType;
  target: RelationshipTarget;
}
```

Future types are added when a concrete content requirement exists — not predeclared in schema or types.

Internal targets reference **ObjectId**, not slug. Build-time resolution maps ID → current slug for presentation.

**Tags remain separate** from relationships.

### 6.6 SyndicationCopy

```typescript
interface SyndicationCopy {
  url: string;
}
```

`Note.id` is canonical identity; syndication URLs locate **copies**, not alternate primary keys.

### 6.7 Publication state

**Storage (editorial workflow — unchanged):**

```yaml
draft: true | false
privacyReviewed: true | false
```

**Domain (single representation):**

```typescript
type PublicationState =
  | 'draft'                    # draft: true
  | 'awaiting-privacy-review'  # draft: false, privacyReviewed: false
  | 'public';                  # draft: false, privacyReviewed: true
```

**Mapper derives `publication` exactly once** in `map-note.ts`:

```text
draft === true                          → 'draft'
draft === false && !privacyReviewed     → 'awaiting-privacy-review'
draft === false && privacyReviewed      → 'public'
```

Domain helpers: `isPublicNote(note)` ≡ `note.publication === 'public'`.

The domain **does not** carry both `visibility` and raw `draft`/`privacyReviewed`. Storage mappers may read raw flags; domain consumers see only `publication`.

**Editorial workflow ends at storage.** Domain publication state is derived fact for filtering and adapters.

---

## 7. ID strategy

### 7.1 Choice: UUIDv7 (RFC 9562)

Locally generated, time-sortable, standard, frontmatter-friendly, no infrastructure. **Never derived from slug or content hash.** Not placed in public URL paths.

### 7.2 Authoritative identity rule

```text
frontmatter/data.id  →  authoritative immutable identity
```

After migration:

- Every Person, Note, and Project **must** have `id` in its file.
- Normal builds **require** `id`; missing `id` fails validation.
- **No runtime/build fallback** to any registry or manifest.
- **No permanent dual-source** (frontmatter ↔ registry) validation architecture.

### 7.3 One-time migration assignment

A **temporary migration script** may assign UUIDv7 values and write them into frontmatter. Optionally, a **temporary manifest** (e.g. `scripts/migration/id-assignment-log.json`) records assignments for human review during the migration PR — **not loaded by builds**.

Workflow:

1. Run `scripts/migrate-assign-ids.ts` once — generates UUIDv7 per file, writes `id` into frontmatter/YAML.
2. Human reviews Git diff; IDs are committed in content files.
3. CI validates: all objects have `id`; no duplicate IDs across repo.
4. Delete or archive migration manifest **outside runtime path** (e.g. `docs/migration/` or omit entirely).

**New content:** author or drafting handoff generates UUIDv7 at creation time; ID is committed with the file. **No ID generation during normal `astro build`.**

### 7.4 Drafting handoff

Exported Markdown includes a new `id:` field (UUIDv7 generated in browser at handoff time). Publication gates remain `draft: true`, `privacyReviewed: false`.

---

## 8. URL, location history, and redirects

### 8.1 Concepts (domain — protocol-neutral)

| Concept | Domain API (illustrative) |
| --- | --- |
| Current slug | `note.slug` / `project.slug` |
| Historical slugs | `note.previousSlugs` / `project.previousSlugs` |
| Canonical path | `canonicalNotePath(note)` → `/notes/{slug}/` |
The domain holds **`slug`** and **`previousSlugs`** only. Constructing `/notes/<slug>/`, historical absolute URLs, redirect paths, and protocol fetch targets belongs in routing/presentation/protocol adapters — not in `src/core/domain`.

### 8.2 Initial migration

- `slug` = current filename stem for each existing note/project.
- Canonical URLs unchanged (e.g. `/notes/first-note-probably/`).
- `previousSlugs: []`.

### 8.3 Slug rename

1. Keep `id` unchanged.
2. Append the old slug to `previousSlugs` (never remove history; never include the current slug).
3. Set `slug` to the new value.
4. Rename the Markdown file to match the new slug if repository convention requires it.
5. Run `npm test` and `npm run build` (build regenerates `src/generated/slug-redirects.mjs`).
6. Verify the generated redirect: `/notes/<old>/` → `/notes/<new>/` with status **308** (direct to current; no chains).
7. Verify RSS GUID unchanged (`legacyRssGuid` or URN) while `<link>` uses the new canonical URL.
8. Deploy.

Canonical URL, sitemap `<loc>`, and new POSSE permalinks use the **new** slug only. Historical URLs must not appear in the sitemap. Existing Bluesky syndication URLs are untouched; old note URLs redirect to the new location. The Webmention adapter fetches mentions for the current URL plus every historical Note URL.

### 8.4 Redirect implementation

```text
ContentStore → domain objects (slug + previousSlugs)
                    ↓
            routing adapter (deriveSlugRedirects)
                    ↓
         scripts/generate-slug-redirects.ts
                    ↓
         src/generated/slug-redirects.mjs
                    ↓
         astro.config.mjs redirects (status: 308)
                    ↓
         @astrojs/vercel → Vercel redirects
```

**Generated artifact policy:** `src/generated/slug-redirects.mjs` is committed and regenerated on every `npm run build` / `npm run generate:redirects` so clean checkouts and Astro config imports always succeed. Empty history yields `export const slugRedirects = {};`.

No runtime DB. Collision validation: within each collection, no slug may appear as both a current slug and a previousSlug of a different object; duplicate historical sources fail loudly. `/notes/foo/` and `/projects/foo/` may coexist.

### 8.5 RSS item identity (permanent policy)

**Rule: each note’s RSS GUID is assigned once and never changes after Personal Web Core migration.**

Two deterministic GUID classes:

| Class | Determination | RSS output |
| --- | --- | --- |
| **Legacy** | Notes **public before PWC migration** | `<guid isPermaLink="true">{legacyRssGuid}</guid>` where `legacyRssGuid` = historically emitted URL, stored in frontmatter |
| **New** | Notes **created after PWC migration** | `<guid isPermaLink="false">urn:karthikg.in:note:{id}</guid>`; no `legacyRssGuid` field |

**Legacy notes at migration:**

- Set frontmatter `legacyRssGuid: https://karthikg.in/notes/{slug}/` (frozen forever).
- Even if slug later renames, `legacyRssGuid` stays the migration-time URL; `<link>` updates to current canonical URL.

**New notes:**

- Omit `legacyRssGuid`; feeds adapter computes URN from `id` (immutable under slug rename).

**Slug rename behavior:**

| Field | Changes on rename? |
| --- | --- |
| `<link>` | yes → new canonical URL |
| `<guid>` | **never** |
| `legacyRssGuid` (legacy) | **never** |
| URN guid (new) | **never** (tied to `id`) |

**Feed-reader duplication risk:** Legacy notes keep URL GUIDs to avoid reappearing as new items in readers that already subscribed. New notes use stable URN from creation. No mixed policy per rename event — policy is fixed at note creation/migration.

**Storage/domain:** stores optional `legacyRssGuid?: string` on Note as opaque migration compatibility metadata. **Feeds adapter** owns RSS GUID emission rules.

---

## 9. Person storage example

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
  - kind: github
    label: GitHub
    url: https://github.com/karthikg80
    rel: [me]
  - kind: atproto
    label: Bluesky
    url: https://bsky.app/profile/karthikg.in
    rel: [me, atproto]
    identifiers:
      handle: karthikg.in
      did: did:plc:k25m3ebqwdr32ojecqpjfzbh
  - kind: linkedin
    label: LinkedIn
    url: https://www.linkedin.com/in/karthikg80/
    rel: [me]
  - kind: website
    label: Thea Foundry
    url: https://theafoundry.com
    rel: [me]
interests:
  - personal web
  - calm software
  - household tools
```

---

## 10. Project storage example

`src/content/projects/neighborbook.md`:

```yaml
id: 018f3b2a-8d11-7b3a-b123-456789abcdef
slug: neighborbook
title: Neighborbook
description: Private, invite-only community memory...
date: 2026-07-30
tags: [Communities, Privacy, Next.js, Supabase]
featured: true
links:
  - kind: live
    url: https://neighborbook.theafoundry.com
previousSlugs: []
relationships: []
```

**Microformat behavior:**

- `/projects/neighborbook/` detail: canonical = first-party URL; `h-entry` with `u-url` = first-party.
- `/projects` card: `u-url` = `/projects/neighborbook/`; “Visit project →” links to `links[kind=live].url`.

---

## 11. Relationship model

### 11.1 Frontmatter

```yaml
relationships:
  - type: reply-to
    target:
      kind: external
      url: https://example.com/post
  - type: bookmark-of
    target:
      kind: internal
      id: 018f3b2a-7c4e-7b3a-b123-456789abcdef
```

Zod validates `type` ∈ `{ reply-to, bookmark-of }` only.

### 11.2 Legacy migration

Mapper fallback while legacy fields exist:

```text
relationships empty && inReplyTo   → synthesize reply-to external
relationships empty && bookmarkOf  → synthesize bookmark-of external
relationships present              → use relationships; ignore legacy fields
```

### 11.3 Projections

- **Presentation adapter:** `u-in-reply-to`, `u-bookmark-of`; resolve internal IDs to URLs at build time.
- **Webmention adapter:** extract external targets from relationships + body links — domain unaware.

---

## 12. Storage and query layer

### 12.1 Flow

```text
Markdown / YAML → Astro/Zod records → mappers → domain objects → adapters
```

### 12.2 Query functions (retrieval only)

Module-level functions (a literal `ContentStore` class/interface is optional):

```typescript
getPerson(): Person;
getNotes(): Note[];
getPublishedNotes(): Note[];
getProjects(): Project[];
getNoteById(id: ObjectId): Note | undefined;
getProjectById(id: ObjectId): Project | undefined;
getNoteBySlug(slug: string): Note | undefined;
getProjectBySlug(slug: string): Project | undefined;
```

No routing, redirect, or protocol methods in the storage query layer.

Build-time instantiation wraps `getCollection()` + `person.yaml` parse. Domain objects materialized once per build/CLI invocation.

### 12.3 Responsibilities

| Concern | Location |
| --- | --- |
| Parse/validate | `content.config.ts`, person YAML schema |
| Map to domain | `src/core/storage/map-{person,note,project}.ts` |
| Derive `publication` | `map-note.ts` only |
| Derive `noteKind` | `src/core/domain/note.ts` |
| Redirect derivation | `src/adapters/routing/redirects.ts` (from slug/previousSlugs) |
| Publication filter | `getPublishedNotes()` uses `isPublicNote()` |

---

## 13. Adapter and module boundaries

### 13.1 Directory structure

```text
src/
  core/
    domain/
      ids.ts
      publication.ts          # PublicationState, isPublicNote()
      person.ts
      note.ts                 # deriveNoteKind()
      project.ts
      relationship.ts
      syndication.ts
    storage/
      content-store.ts
      map-person.ts
      map-note.ts
      map-project.ts
  adapters/
    presentation/
      microformats.ts
      host-label.ts
    feeds/
      rss.ts                  # GUID policy, XML generation
    routing/
      redirects.ts            # deriveSlugRedirects(notes, projects)
    webmention/
      discovery.ts
      webmention-io.ts
      outbound-targets.ts
      mention-targets.ts      # builds WM fetch URLs from domain location history
    syndication/
      bluesky/
        post-text.ts
        posse-cli.ts
  lib/                        # temporary re-exports during migration
  scripts/
    migrate-assign-ids.ts     # one-time; not imported by build
```

### 13.2 Dependencies

```text
pages, components, CLIs → adapters, core/storage
adapters → core/domain
core/storage → core/domain, astro:content (storage layer only)
core/domain → standard library only
```

**Forbidden:** `core/domain` importing adapters, Astro, or protocol modules.

### 13.3 Webmention target selection (adapter)

```typescript
// adapters/webmention/mention-targets.ts — illustrative
function mentionTargetUrls(note: Note, siteOrigin: string): string[] {
  const slugs = [...note.previousSlugs, note.slug];
  return slugs.map((s) => `${siteOrigin}/notes/${s}/`);
}
```

Adapter constructs URLs from domain `slug` / `previousSlugs`; domain has no Webmention concepts.

### 13.4 `indieweb.ts` decomposition

| Symbol | Destination |
| --- | --- |
| `isPublishedNote` | `core/domain/publication.ts` → `isPublicNote()` |
| `classifyNote` | `core/domain/note.ts` → `deriveNoteKind()` |
| `hostLabel` | `adapters/presentation/host-label.ts` |
| `normalizeSyndicationUrl` | **Delete** if still unused |
| `extractOutboundLinks`, `markdownToLinkHtml` | `adapters/webmention/outbound-targets.ts` |
| `discoverWebmentionEndpoint`, `sendWebmention` | `adapters/webmention/discovery.ts` |
| `buildBlueskyPostText` | `adapters/syndication/bluesky/post-text.ts` |
| `webmentionReceiverUrl`, `webmentionFeedUrl` | `adapters/webmention/webmention-io.ts` |

---

## 14. Syndication representation

**Storage (unchanged):**

```yaml
syndication:
  - https://bsky.app/profile/karthikg.in/post/3mtrz4v5yut2a
```

Mapper accepts string or `{ url: string }`. Domain: `SyndicationCopy[]`.

POSSE CLI unchanged — human pastes URL into frontmatter. No operational automation.

---

## 15. Backward compatibility

| Requirement | Compliance |
| --- | --- |
| Existing note URLs at migration | Unchanged slugs |
| Legacy RSS GUIDs | Frozen `legacyRssGuid` in frontmatter |
| New note RSS GUIDs | URN from `id`; immutable |
| Slug rename | `<link>` updates; GUID frozen |
| Sitemap | Same note URLs at migration; adds project detail URLs |
| h-entry / h-card | Presentation adapter preserves classes |
| Webmention discovery | webmention.io via Layout |
| Inbound WM | Adapter fetches legacy + historical + canonical URLs |
| Outgoing WM CLI | Same command |
| Bluesky POSSE | Same command; permalink from current canonical URL |
| u-syndication | Unchanged |
| ATProto DID file | Static; untouched |
| Drafting / gates | Unchanged |
| Project external URLs | Still linked; not canonical identity |

---

## 16. Migration sequence (design-level)

1. **IDs in frontmatter** — one-time script; validate; archive temp manifest.
2. **Domain + mappers + query functions** — wrappers preserve public output.
3. **Adapter extraction** — split `indieweb.ts`.
4. **Person centralization** — pages read Person.
5. **Project detail pages** — first-party canonical URLs.
6. **Relationship migration** — `relationships` + legacy fallback.
7. **Historical slugs + routing adapter** — redirects; WM adapter targets.
3. **RSS identity compatibility** — feeds adapter; `legacyRssGuid` on legacy public notes.

Detailed PR-by-PR tasks: [`personal-web-core-implementation-plan.md`](./personal-web-core-implementation-plan.md).

---

## 17. Test strategy

- **Identity:** slug rename does not change `id`; missing/duplicate `id` fails CI; no build-time ID generation.
- **Publication:** same truth table as current `isPublishedNote` tests.
- **RSS GUID:** legacy fixture keeps URL guid after slug rename in fixture; new fixture keeps URN after rename; GUID never mutates.
- **Projections:** same Note → same canonical path in URLs helper, RSS `<link>`, POSSE permalink.
- **Redirects:** routing adapter emits 308 for `previousSlugs` fixtures.
- **Webmention adapter:** mention targets include historical paths; domain has no WM imports.
- **Import boundaries:** `core/domain` import scan in CI.
- **Migration safety:** `first-note-probably` URL unchanged; published count unchanged.

---

## 18. Risks and tradeoffs

| Risk | Mitigation |
| --- | --- |
| Legacy vs new RSS GUID split | Explicit `legacyRssGuid` field; tests per class |
| Astro filename coupling | Filename = slug through milestone |
| WM on renamed slugs | Adapter queries all location paths |
| Over-abstraction | Single ContentStore; no DI/graph/plugins |
| Accidental registry permanence | Build never reads manifest; docs state deletion |

---

## 19. Deferred (post–Personal Web Core)

Project draft gates; filename decoupled from slug; structured syndication (`at://`); Person-generated `atproto-did`; additional relationship types; Atom/JSON Feed; JSON-LD; WebFinger; ActivityPub; automated POSSE.

---

## Complexity justification

| Piece | Enables |
| --- | --- |
| UUIDv7 in frontmatter | Stable identity across slug/storage changes |
| `PublicationState` | Single domain truth from existing gates |
| `person.yaml` | One identity source for projections |
| Storage query module | Testable retrieval without protocol coupling |
| `reply-to` / `bookmark-of` only | Real relationships today without speculative vocabulary |
| Routing adapter | Redirects without bloating store |
| Frozen RSS GUID policy | Slug renames without feed item duplication |

**Not introduced:** event bus, plugin framework, graph DB, protocol registry, DI container, runtime API, permanent ID registry.

---

## Final review checklist

- [x] Existing public note URLs valid at migration
- [x] Git Markdown storage; no database
- [x] Domain protocol-free
- [x] Frontmatter `id` authoritative; no permanent registry
- [x] RSS GUID policy deterministic and immutable per note
- [x] No Webmention concepts in domain
- [x] Relationship vocabulary: `reply-to`, `bookmark-of` only
- [x] Storage query layer retrieval-only; redirects in routing adapter
- [x] Single `PublicationState` in domain
- [x] ATProto via `externalIdentities`
- [x] Project first-party URL canonical
- [x] Deferred protocols excluded

---

**Implementation requires approval of the implementation plan.**
