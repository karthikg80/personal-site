# Current Personal Web Architecture — karthikg.in

**Status:** Read-only audit of the repository as of the review commit on `main` (architecture report branch).  
**Scope:** What the code and config actually implement. Not a redesign proposal.  
**Evidence labels:** **Verified** = observed in code/config/tests; **Inferred** = reasonable architectural reading; **Not found** = searched and absent.

---

## 1. Executive summary

karthikg.in is a mostly static Astro 7 site on Vercel. Canonical public content lives as Markdown in Git (`src/content/notes`, `src/content/projects`). Profile and “now” prose are hardcoded in Astro pages. There is no application database.

Publishing is a human Git workflow with dual frontmatter gates (`draft` + `privacyReviewed`). After deploy, two optional CLI scripts handle outbound Webmentions and Bluesky POSSE. Incoming Webmentions are delegated to webmention.io and rendered client-side. AT Protocol identity is proven via `/.well-known/atproto-did` and DNS (documented), not by hosting an ATProto repository in this codebase. ActivityPub, IndieAuth, WebFinger, JSON-LD Person, Atom, JSON Feed, and `llms.txt` are **not found**.

Relative to the long-term principle (“karthikg.in is the system of record; platforms are distribution”), the site is **partially aligned**: notes are first-party Markdown with stable slug URLs and `u-syndication` back-links, but identity and profile data are fragmented across pages and providers, Webmention state lives off-site, POSSE is manual and Bluesky-only, and there is no protocol-neutral domain layer with durable IDs independent of filenames.

---

## 2. Architecture diagram

```text
                         ┌──────────────────────────────────────┐
                         │  Human + Git (system of record)      │
                         │  src/content/{notes,projects}/*.md   │
                         │  src/pages/*.astro (profile/now)     │
                         └──────────────────┬───────────────────┘
                                            │ push / deploy
                                            v
┌────────────────┐   static HTML/CSS/JS   ┌─────────────────────┐
│ Browser        │ <───────────────────── │ Astro 7 build       │
│ + client WM    │                        │ (@astrojs/vercel)   │
│   fetch to     │                        │ site: karthikg.in   │
│   webmention.io│                        └──────────┬──────────┘
└───────▲────────┘                                   │
        │                                            │ host
        │                                            v
        │                                 ┌─────────────────────┐
        │                                 │ Vercel              │
        │                                 │  • static pages     │
        │                                 │  • /drafting SSR    │
        │                                 │  • drafting APIs    │
        │                                 └──────────┬──────────┘
        │                                            │
        │              DNS (DigitalOcean)            │
        │              apex A → Vercel               │
        │                                            │
┌───────┴────────┐                      ┌────────────┴──────────┐
│ webmention.io  │                      │ Optional CLIs (local) │
│ receive+store  │                      │ npm run webmentions:  │
│ JF2 feed API   │                      │   send                │
└────────────────┘                      │ npm run posse:bluesky │
                                        └────────────┬──────────┘
                                                     │
                           ┌─────────────────────────┼──────────────────┐
                           v                         v                  v
                    Bluesky XRPC              target WM endpoints   (OpenAI for
                    createSession/            discovered per link    /drafting only)
                    createRecord
```

### High-level architecture (plain English)

| Concern | Current implementation | Evidence |
| --- | --- | --- |
| Framework / runtime | Astro 7, TypeScript, Node for scripts and one SSR route | `package.json`, `astro.config.mjs` |
| Rendering model | Default static; `/drafting` and drafting APIs set `prerender = false` | `src/pages/drafting.astro:10`, `src/pages/api/drafting/*.ts` |
| Content storage | Git Markdown via Astro content collections | `src/content.config.ts`, `src/content/**` |
| Databases | None in this repo | `src/pages/colophon.astro:24` (**Verified** statement); no DB client deps in `package.json` |
| Auth / editorial | Phrase + HMAC cookie for private drafting; publication via Git flags | `src/lib/drafting-auth.ts`, `src/content.config.ts:30-31` |
| Background / scheduled jobs | None; manual npm scripts | `package.json` scripts `webmentions:send`, `posse:bluesky` |
| External services | Vercel hosting; webmention.io; Bluesky (`bsky.social`); OpenAI (drafting only) | Layout links, `posse-bluesky.ts`, `agent.ts` |
| Deployment | Vercel from `main`; DigitalOcean DNS apex A record | `vercel.json`, `README.md`, `colophon.astro:29-37` |
| Major boundaries | Content collections vs page prose; static public site vs SSR drafting; CLI adapters vs build | **Inferred** from structure |

---

## 3. Current domain model

What actually exists (do not invent entities):

```text
Person (implicit; prose + microformats on pages, not a stored entity)
 ├── Content
 │    ├── Note          # Astro collection "notes" — Markdown + frontmatter
 │    │    kinds: note | scrap | reply | bookmark  (derived)
 │    └── Project       # Astro collection "projects" — Markdown + frontmatter
 ├── Topic              # string tags on notes/projects only; no Topic entity
 ├── Relationship       # only inReplyTo / bookmarkOf URLs on notes
 ├── Interaction        # Webmentions: external JF2 from webmention.io (not local)
 └── Syndication        # note.syndication: URL[] of platform copies
```

**Not present as domain types:** Essay (separate from Note), Media library, Revision entity, Follower graph, ActivityPub Actor, ATProto Record repository owned by this site, structured Profile/Person collection.

### Collections schema (verified)

**Note** (`notesCollection` in `src/content.config.ts:18-33`):

- `title`, `date`, optional `updated`, optional `summary`
- `tags: string[]`
- `presentation: 'note' | 'scrap'`
- optional `inReplyTo`, `bookmarkOf` (URLs)
- `syndication: URL[]`
- `draft` (default `true`), `privacyReviewed` (default `false`)

**Project** (`projectsCollection` in `src/content.config.ts:5-16`):

- `title`, `description`, `date`, `tags`
- optional `link`, `github`
- `featured` boolean

**Publication gate** (`isPublishedNote` in `src/lib/indieweb.ts:9-11`): public only when `!draft && privacyReviewed`.

**Kind derivation** (`classifyNote` in `src/lib/indieweb.ts:13-18`): reply > bookmark > scrap > note.

---

## 4. Content lifecycle

```text
private observations
    → /drafting (optional; device-local encrypted IndexedDB/local storage)
    → Markdown handoff with draft:true, privacyReviewed:false
    → human review (docs/editorial-and-privacy.md)
    → copy into src/content/notes/<slug>.md
    → set draft:false && privacyReviewed:true
    → git commit + deploy (Vercel)
    → optional: npm run webmentions:send
    → optional: npm run posse:bluesky -- <slug>
    → human pastes Bluesky URL into syndication[] and redeploys
```

**Verified:** Drafting cannot publish (`README.md`, handoff in `src/scripts/drafting-room.ts:449-467` always emits closed gates).  
**Verified:** Routes/RSS/sitemap use `getPublishedNotes()` (`src/lib/notes.ts:9-16`).  
**Not found:** Automated scheduled publishing, edit-propagation to Bluesky, or delete-syndication.

---

## 5. Identity model

| Mechanism | Present? | Where | Role |
| --- | --- | --- | --- |
| Canonical site URL | Yes | `astro.config.mjs` `site: 'https://karthikg.in'` | Root for canonical/OG/RSS |
| `rel="me"` | Yes | `Layout.astro:47-51`, Footer, Contact | GitHub, Bluesky (+ `atproto`), LinkedIn, Thea Foundry, mailto |
| Homepage `h-card` | Yes | `index.astro:16-34` | `p-name`, `p-note`, `p-org`, `u-url`/`u-uid`, `u-email`, `u-photo`/`u-logo` |
| Note author `h-card` | Yes | `NoteLayout.astro:61-64` | Visually clipped; microformats present |
| JSON-LD Person | **Not found** | — | — |
| WebFinger | **Not found** | — | — |
| IndieAuth endpoints | **Not found** | — | Bluesky link marked `rel="me atproto"` for IndieLogin (**Verified** comment in colophon); no token endpoint here |
| OAuth (site-owned) | Drafting only | Phrase HMAC cookie, not OAuth | `drafting-auth.ts` |
| ATProto handle/DID | Yes | `public/.well-known/atproto-did` = `did:plc:k25m3ebqwdr32ojecqpjfzbh`; handle `@karthikg.in` | Identity proof for Bluesky account; site does not own PDS repo logic |
| ActivityPub actor | **Not found** | — | — |
| Email | Yes | `mailto:karthi@hey.com` with `rel="me"` | hey.com identity linked from site |
| Social links | Yes | Contact + Footer + head | Discovery, not systems of record for content |

**Root identity assessment (verified + inferred):**

- The domain is treated as the intended identity home in copy (`now.astro`, colophon, README).
- Machine-readable identity is **IndieWeb-leaning microformats + rel-me**, not a single Person record.
- ATProto DID is bound to the domain via well-known file, but content authority for posts is still Git Markdown; Bluesky holds syndicated copies.
- Identity is therefore **site-centered but fragmented**: profile facts duplicated across `index.astro`, `about.astro`, `now.astro`, `contact.astro`, and external profiles.

---

## 6. Canonical content model

| Content type | Stored where | Primary identifier | Canonical URL | URL stable if storage/frontend changes? | Platform IDs in domain? |
| --- | --- | --- | --- | --- | --- |
| Essays / long-form | **No essay type.** Notes fill “writing” | — | — | — | — |
| Notes / short-form | `src/content/notes/<slug>.md` | Astro entry `note.id` = file path/slug (`notePath` → `/notes/${note.id}/`) | `https://karthikg.in/notes/<slug>/` | **Weak:** renaming the file changes `id` and URL | Syndication stores Bluesky **public URLs**, not AT URIs, in frontmatter |
| Projects | `src/content/projects/<file>.md` | Collection entry id (filename) | **No first-party project page**; listed on `/projects`; external `link` is `u-url` | Project cards do not mint `/projects/<id>` | Optional `github` / `link` URLs only |
| Profile / about | Hardcoded Astro pages | Path (`/`, `/about`, `/now`) | Path-based | Coupled to page files | None |
| Media | `public/` static files (`avatar.svg`, `favicon.svg`, `resume.pdf`) | Path | Absolute path under site | Path-stable if file kept | None |
| Tags / topics | Frontmatter `tags: string[]` | Tag string | **No tag routes** | N/A | None |
| Revisions | Optional `updated` date; Git history | Commit history | Same note URL | Content history = Git, not domain | None |
| Social interactions | webmention.io JF2 API | Provider mention records | Target = note canonical URL | Interactions not in Git | Provider-owned |

### Places external platforms look like canonical state

| Area | Assessment | Evidence |
| --- | --- | --- |
| Bluesky POSSE | **Projection** after publish; site remains source for text; mapping is manual URL list | `posse-bluesky.ts`, `syndication` in schema |
| Webmention inbox | **External system of record** for interactions | `webmentionReceiverUrl` / `webmentionFeedUrl` → webmention.io |
| ATProto DID file | Domain proves handle ownership; **does not** make ATProto the content store | `public/.well-known/atproto-did` |
| Wander OPML | Reader export mirrored into site; not outbound identity | `src/data/feeds.opml` |

---

## 7. POSSE

### Adapters present

| Adapter | Path | Status |
| --- | --- | --- |
| Bluesky | `src/lib/posse-bluesky.ts` (+ `buildBlueskyPostText` in `indieweb.ts`) | **Verified** |
| Mastodon / others | — | **Not found** |

### Bluesky flow

```text
canonical Note (Markdown in Git, published flags open)
    ↓ parseFrontmatter (title, summary, draft, privacyReviewed)
    ↓ buildBlueskyPostText({ title, summary, url })  // 300-char budget, permalink appended
    ↓ XRPC com.atproto.server.createSession
    ↓ XRPC com.atproto.repo.createRecord  (app.bsky.feed.post + link facet)
    ↓ print https://bsky.app/profile/<handle>/post/<rkey>
    ↓ human adds URL to note frontmatter syndication[]
    ↓ redeploy → NoteLayout renders <a class="u-syndication">
```

| Aspect | Behavior | Evidence |
| --- | --- | --- |
| Trigger | Manual CLI: `npm run posse:bluesky -- <slug>` | `package.json`, `posse-bluesky.ts:55-61` |
| Transformation | Title (+ optional summary) + canonical permalink; truncates to Bluesky limit | `buildBlueskyPostText` `indieweb.ts:108-126` |
| API / client | Raw `fetch` to `bsky.social` XRPC (no SDK dependency) | `posse-bluesky.ts:99-121` |
| Outbound ID stored | Human-copied **bsky.app URL** into `syndication` | Example: `first-note-probably.md:9-10`; CLI prints instructions `posse-bluesky.ts:132-133` |
| Retry | None (exit on failure) | `posse-bluesky.ts:104-126` |
| Failure | stderr + `process.exit(1)` | same |
| Edit / update | **Not found** (always `createRecord`) | — |
| Delete | **Not found** | — |
| Sync vs async | Synchronous CLI; not part of build/deploy | — |
| Syndicated copy points home? | Yes: post text + facet link to `https://karthikg.in/notes/<slug>/` | `posse-bluesky.ts:77-96` |
| Site authoritative? | Yes for note body; Bluesky is a copy; no pull-from-Bluesky | Publication gate before POSSE |

`normalizeSyndicationUrl` exists and is tested but **is not called** from POSSE or layouts (**Verified** via grep) — dead helper relative to runtime path.

---

## 8. Webmention

### Outgoing

| Step | Implementation | Evidence |
| --- | --- | --- |
| Discovery | Fetch target; prefer `Link` header; else HTML `rel=webmention` | `discoverWebmentionEndpoint` `indieweb.ts:70-87`; used in `send-webmentions.ts:40-50` |
| Targets | Outbound http(s) links from Markdown-ish HTML + `inReplyTo`/`bookmarkOf`; excludes same-origin | `extractOutboundLinks` |
| Send | `POST` `application/x-www-form-urlencoded` `source`/`target` | `sendWebmention` `indieweb.ts:136-147` |
| Trigger | Manual `npm run webmentions:send` [--dry-run] after deploy | `send-webmentions.ts` |
| Retries / queue | **Not found** | — |
| Dedup of sends | **Not found** (re-running resends) | — |
| Spam protection (outbound) | N/A beyond User-Agent string | — |

### Incoming

| Step | Implementation | Evidence |
| --- | --- | --- |
| Endpoint advertisement | Site-wide `<link rel="webmention">` and pingback to webmention.io | `Layout.astro:44-45` |
| Receive endpoint | **Not first-party**; `https://webmention.io/karthikg.in/webmention` | `webmentionReceiverUrl` |
| Validation / source verify / target validate | Delegated to webmention.io (**not implemented here**) | **Inferred** from absence of local receiver |
| Persistence | External provider | colophon + API URLs |
| Moderation | **Not found** in repo | — |
| Rendering | Client-side fetch of JF2 feed; groups likes/reposts, replies, others | `Webmentions.astro:85-156` |
| Deduplication | **Not found** locally | — |
| Update / delete semantics | **Not found** locally | — |
| Manual submit form | POST source to webmention.io with hidden target | `Webmentions.astro:36-50` |
| Spam protections | Rel `nofollow` on rendered author links; no local ACL | `Webmentions.astro:106` |

**Domain modeling:** Webmentions are **implementation-specific projections** (JF2 from a SaaS), not first-class Git/domain `Interaction` records. They vanish from the site if the provider or client script is unavailable (empty state retained on fetch failure).

---

## 9. Feeds and machine-readable interfaces

| Output | Path / location | From canonical model? | Notes |
| --- | --- | --- | --- |
| RSS 2.0 (full content) | `/rss.xml` → `src/pages/rss.xml.ts` | Yes — `getPublishedNotes()` | `guid isPermaLink=true` = note URL; includes `content:encoded` |
| Atom feed | — | — | **Not found** (only `atom:link` self on RSS channel) |
| JSON Feed | — | — | **Not found** |
| Sitemap | `/sitemap.xml` | Static paths + published notes | `sitemap.xml.ts` |
| robots.txt | `public/robots.txt` | Independent static | Points at sitemap |
| JSON-LD / schema.org | — | — | **Not found** |
| Microformats | Home `h-card`; notes `h-entry` / `h-feed`; projects `h-entry` | Rendered from content/pages | |
| Open Graph / Twitter cards | `Layout.astro` | Page props | |
| oEmbed | — | — | **Not found** |
| Public content API | — | — | **Not found** |
| Content JSON dumps | — | — | **Not found** |
| WebFinger | — | — | **Not found** |
| ActivityStreams / ActivityPub | — | — | **Not found** |
| ATProto records (site-hosted) | — | — | POSSE writes to Bluesky PDS only |
| `llms.txt` / agent knowledge | — | — | **Not found** |
| OPML (subscriptions I follow) | `/feeds.opml` | From `src/data/feeds.opml` | Not an outbound content feed |
| Private drafting APIs | `/api/drafting/session`, `/api/drafting/agent` | Drafting only | Not public machine interface |

RSS/sitemap are **generated from the same published-notes helper** as HTML routes (**Verified**).

---

## 10. ATProto / ActivityPub

### ATProto / Bluesky

| Topic | Current state | Evidence |
| --- | --- | --- |
| Authentication | App password + `createSession` in CLI | `posse-bluesky.ts`, `.env.example` |
| DID / handle | DID file + handle `karthikg.in` / `@karthikg.in` | `public/.well-known/atproto-did`; env default identifier |
| Lexicons / record types | Hardcoded `app.bsky.feed.post` + richtext link facet | `posse-bluesky.ts:85-120` |
| Repository ownership | Bluesky account PDS (`repo: session.did`) | CLI |
| rkey strategy | Server-assigned; URL derived from `uri` | `posse-bluesky.ts:129-130` |
| Canonical URL mapping | Permalink embedded in post; reverse map = manual `syndication` URLs | |
| Update / delete | **Not found** | |
| Stored identifiers | bsky.app HTTPS URLs in frontmatter (not `at://` URIs) | `first-note-probably.md` |
| Authoritative store | **Website Markdown** for note content; ATProto for syndicated projection | Publication gate before POSSE |
| Adapter isolation | Partially: CLI script is separate from pages; **Bluesky text builder lives in shared `indieweb.ts`** | Coupling audit below |

### ActivityPub / Mastodon

**Not found.** No actor, inbox/outbox, signing, followers, or AS objects in this repository.

---

## 11. Content relationships / knowledge graph

| Relationship | Modeled? | Persistence | Rendering |
| --- | --- | --- | --- |
| Tags | Yes (flat strings) | Frontmatter arrays | `p-category` lists; no tag index |
| Reply-to | Yes | `inReplyTo` URL | `u-in-reply-to` |
| Bookmark-of | Yes | `bookmarkOf` URL | `u-bookmark-of` |
| Related posts | **Not found** | — | — |
| Quotes / builds-on / supersedes | **Not found** | — | — |
| Project ↔ essay/note | **Not found** as structured link | Only narrative/prose | — |
| Person ↔ project | Implicit via site ownership | Projects collection | Project cards |

**Verified:** Beyond tags and the two IndieWeb URL fields, relationships are **not** a graph—only inferred through Markdown links and shared tag strings.

---

## 12. Protocol coupling audit

| Dependency | Location (path + symbol) | Classification | Rationale |
| --- | --- | --- | --- |
| Bluesky post text length / shaping | `src/lib/indieweb.ts` `buildBlueskyPostText` | **Domain leakage** | Protocol limit (300) in shared “indieweb” module used by content helpers/tests |
| Bluesky XRPC + `app.bsky.feed.post` literals | `src/lib/posse-bluesky.ts` `main` | **Clean adapter** (CLI boundary) with **acceptable infrastructure coupling** to `bsky.social` | Isolated from Astro pages; still embeds lexicon types |
| webmention.io receive/feed URLs | `indieweb.ts` `webmentionReceiverUrl`, `webmentionFeedUrl`; `Layout.astro:44-45`; `Webmentions.astro` | **Acceptable infrastructure coupling** leaning **domain leakage** | Provider baked into site-wide head and UI; swapping inbox requires code edits |
| Outgoing WM discovery/send | `indieweb.ts` + `send-webmentions.ts` | **Clean adapter** (CLI) | Protocol details confined to scripts/helpers |
| `syndication: URL[]` | `content.config.ts` notes schema | **Acceptable infrastructure coupling** | Stores opaque URLs of copies; does not use platform IDs as primary keys |
| ATProto DID well-known | `public/.well-known/atproto-did` | **Acceptable infrastructure coupling** | Identity proof, not content PK |
| OpenAI / AI SDK | `src/pages/api/drafting/agent.ts` | **Acceptable infrastructure coupling** | Private editorial tool; not public content path |
| RSS XML assembly | `src/pages/rss.xml.ts` | **Acceptable infrastructure coupling** | Feed format at presentation edge |
| ActivityPub / Mastodon SDK | — | **Not found** | — |
| `@atproto` / Bluesky SDK packages | — | **Not found** in `package.json` | Raw fetch only |

**High-risk architectural coupling:** **Not found** for protocol SDKs inside UI/content loaders. The highest practical risks are (1) **slug-as-identity**, (2) **webmention.io as interaction store**, (3) **Bluesky helpers mixed into shared indieweb utilities**.

---

## 13. Strengths

Verified alignments with a durable personal-web architecture:

1. **First-party Markdown in Git** as the publishable store for notes and projects (`src/content/**`, no content DB).
2. **Explicit dual publication gate** before public routes/feeds (`isPublishedNote`).
3. **Canonical URLs** derived from `site` config + path (`Layout.astro` canonical link; RSS permalink GUIDs).
4. **POSSE posture** for Bluesky: publish on site first, syndicate with permalink, store `u-syndication` (**Verified** in CLI + note layout + published note).
5. **IndieWeb surface area:** `h-card`, `h-entry`/`h-feed`, `rel="me"`, Webmention discovery links, webring footer.
6. **Full-text RSS** from the same published-notes query as HTML.
7. **ATProto handle proof** on the domain without making Bluesky the CMS.
8. **Drafting room isolated** from public collections (cannot publish; closed handoff flags).
9. **Protocol CLIs** are mostly outside the request path (Webmention send + Bluesky POSSE).
10. **Tests** cover publication gate, classification, WM discovery, link extraction, Bluesky text builder (`indieweb.test.ts`; 12 tests passing in this review environment).

---

## 14. Architectural debt

### Critical

1. **No stable content ID independent of slug/filename.** `note.id` drives routes and URLs (`notes.ts:18-19`, `[...slug].astro:10`). Renames break permalinks, syndication mappings, and WM targets.
2. **Incoming interactions are not first-party data.** webmention.io is the store and API; the site only mirrors JF2 in the browser. Provider loss or policy change drops correspondence history from the public record.

### Important

3. **No protocol-neutral domain/service layer.** Content, IndieWeb helpers, Bluesky shaping, and WM provider URLs share `indieweb.ts` / frontmatter without a clear Content → Projection boundary.
4. **Profile/identity is not a portable structured object.** Duplicated prose across pages; no Person JSON/JSON-LD/WebFinger; machine consumers must scrape HTML microformats.
5. **POSSE is incomplete as an operational system:** manual trigger, no retries, no update/delete, no stored `at://` URI, human edits frontmatter, single destination.
6. **Projects lack first-party canonical URLs** on karthikg.in; external product URLs are the `u-url`, so the personal site is a catalog, not the project system of record.
7. **Outgoing Webmentions are fire-and-forget** with no send log, idempotency, or failure queue in-repo.

### Nice to improve

8. Dead / unused `normalizeSyndicationUrl` runtime path.
9. No Atom/JSON Feed/JSON-LD/`llms.txt` despite IndieWeb/RSS investment.
10. Tags are display-only (no indexes or relationships).
11. `updated` is a timestamp only—no revision bodies or changelogs in the domain model.
12. Bluesky character-limit logic lives beside generic IndieWeb helpers (naming/boundary clarity).

---

## 15. 2030-readiness map

| Capability | Current state | Evidence | Gap |
| --- | --- | --- | --- |
| Domain as root identity | **Partial** | `site` config, h-card, rel-me, DID file; profile also on GitHub/LinkedIn/Bluesky/hey.com | No single machine-readable Person root; identity facts duplicated |
| Stable canonical objects | **Partial** | Slug URLs + RSS permalinks | No immutable ID; rename risk |
| Protocol-neutral content core | **Coupled** | Shared `indieweb.ts`; frontmatter mixes IndieWeb + syndication URLs | Need Content vs Adapter separation |
| POSSE | **Partial** | Bluesky CLI + `u-syndication` | One platform; manual; no lifecycle |
| Webmention | **Partial** | Outbound CLI + inbound via webmention.io + UI | No first-party inbox; no send ledger |
| RSS/Atom/JSON Feed | **Partial** | RSS 2.0 full text | No Atom/JSON Feed |
| Machine-readable profile | **Partial** | Microformats + rel-me | No JSON-LD/WebFinger/IndieAuth |
| Structured content API | **Missing** | Only private drafting APIs | No public content/graph API |
| Explicit relationships | **Partial** | `inReplyTo`, `bookmarkOf`, tags | No richer typed graph |
| Protocol adapter boundary | **Partial** | CLIs exist; helpers leak Bluesky/WM provider into shared modules | Formal ports/adapters missing |
| ATProto projection | **Partial** | DID proof + createRecord POSSE | No repo ownership, updates, or `at://` mapping store |
| ActivityPub projection | **Missing** | — | No AP stack |
| Agent-readable knowledge | **Missing** | No `llms.txt` / content JSON | Agents scrape HTML/RSS only |
| Revision history | **Partial** | Git + optional `updated` | No public revision objects |
| Portable public data | **Partial** | Git Markdown is portable | Interactions & profile not equally portable |

---

## 16. Top 5 architectural decisions we need to make next

These are decisions, not implementation plans:

1. **Should canonical content have an immutable ID independent of its URL slug?**  
2. **Should incoming Webmentions (and other interactions) be first-party durable records on karthikg.in, or is a delegated provider an acceptable long-term projection store?**  
3. **What is the single structured representation of “Person / public identity,” and which formats (microformats, JSON-LD, WebFinger, etc.) are projections of it versus sources?**  
4. **Where is the hard adapter boundary between protocol-neutral content and POSSE/Webmention/ATProto/feed serializers—and may shared modules contain destination-specific rules?**  
5. **Are projects and profile pages first-class canonical objects on this domain (with their own stable URLs and metadata), or will karthikg.in remain a person node that merely points at external systems of record for products?**

---

## Appendix A — Key file index

| Area | Files |
| --- | --- |
| Config | `astro.config.mjs`, `vercel.json`, `.env.example`, `package.json` |
| Content schema | `src/content.config.ts` |
| Notes access | `src/lib/notes.ts` |
| IndieWeb / POSSE helpers | `src/lib/indieweb.ts`, `src/lib/indieweb.test.ts` |
| POSSE CLI | `src/lib/posse-bluesky.ts` |
| WM send CLI | `src/lib/send-webmentions.ts` |
| WM UI | `src/components/Webmentions.astro` |
| Layouts | `src/layouts/Layout.astro`, `src/layouts/NoteLayout.astro` |
| Feeds | `src/pages/rss.xml.ts`, `src/pages/sitemap.xml.ts`, `src/pages/feeds.opml.ts` |
| ATProto proof | `public/.well-known/atproto-did` |
| Drafting | `src/pages/drafting.astro`, `src/lib/drafting-auth.ts`, `src/pages/api/drafting/*`, `src/scripts/drafting-room.ts` |
| Editorial contract | `docs/editorial-and-privacy.md`, `docs/workbench-note-template.md` |

## Appendix B — Verification notes

- `npm test` (vitest): **12 passed** for `src/lib/indieweb.test.ts` in the review environment.
- Searched repository for ActivityPub, WebFinger, IndieAuth endpoints, JSON-LD, Atom/JSON Feed, oEmbed, `llms.txt`: **not found**.
- DNS `_atproto` TXT record is **documented** in README/colophon; not verifiable from this repo alone (**unknown** at runtime).
