# Drafting Room → Canonical Draft → Human Review → Publish

**Status:** Architecture approved after the public-repository / privacy ruling (2026-08-24). Implementation must follow this revision, not the earlier `privacyReviewed: false` → public Git draft.  
**Scope:** Replace the manual Markdown copy/paste step with two explicit product actions, without letting unpublished, unreviewed text enter the public repository, and without letting any Drafting Room action make a Note public on karthikg.in.  
**Baseline:** Personal Web Core M1–M8 on `origin/main` (`1c75ef9`, 2026-08-24).  
**Related:** [`personal-web-core-design.md`](./personal-web-core-design.md), [`docs/editorial-and-privacy.md`](../editorial-and-privacy.md), [`draft-to-publish-implementation-plan.md`](./draft-to-publish-implementation-plan.md).

---

## 1. Executive summary

The Drafting Room already produces a Markdown handoff. The remaining gap is mechanical: a human still copies that file into `src/content/notes/<slug>.md`, commits, reviews, flips flags, and deploys.

This specification adds two product actions with **split flag semantics**:

| Action | Meaning | Forced storage |
| --- | --- | --- |
| **Prepare for publication** | After a human privacy acknowledgement of the exact publication-bound text, create or update a canonical Note in the public Git repo | `draft: true`, `privacyReviewed: true` |
| **Publish** | Explicit human approval to show that Git revision on karthikg.in | `draft: false` only (`privacyReviewed` must already be `true`) |

**Architecture: Option A (corrected).** A server-side GitHub Contents integration commits privacy-reviewed, unpublished canonical Notes directly to `main`. Publish is a second commit that flips only `draft`. Git remains the system of record. Vercel production deploys from `main`. Dual publication gates keep the live site unchanged until Publish. Ordinary Note publishing does not use GitHub’s UI or a local Git checkout.

PRs are not a privacy fix: branches in this public repository are also public.

Central invariants:

> **No content may enter the public repository until a human privacy review has approved that exact publication-bound content.**

> **No Drafting Room action may make a Note public on karthikg.in; publication remains a separate explicit human action against a reviewed canonical Git revision.**

The editorial agent cannot Prepare or Publish.

---

## 2. Current manual workflow

Verified against the M8 tree.

```text
private observations
    → /drafting  (device-local AES-GCM notebook; no server draft DB)
    → human checklist in the Review stage
    → copy / download Markdown handoff
         draft: true
         privacyReviewed: false
         id: <new UUIDv7 generated on every click>
         slug: <slugify(title)>
    → paste into src/content/notes/<slug>.md   ← PUBLIC GIT, flags still closed
    → git commit / PR / merge to main
    → Vercel production build
         unpublished notes excluded from routes, RSS, sitemap, homepage
    → human flips both flags in Git
    → deploy
    → optional: npm run webmentions:send
    → optional: npm run posse:bluesky -- <slug>
    → paste Bluesky URL into syndication[] and redeploy
```

Relevant current facts:

- `/drafting` is unlinked, `noindex`, and returns 404 in production until `DRAFTING_ACCESS_KEY` and `DRAFTING_SESSION_SECRET` are set.
- Drafting APIs: `POST /api/drafting/session`, `DELETE /api/drafting/session`, `POST /api/drafting/agent`. None write content collections.
- Notebook state lives in `localStorage` (`kg-encrypted-drafting-room-v1`). There is no server-side mapping from a draft to a Note.
- Handoff always emits `draft: true` and `privacyReviewed: false`. It cannot publish on karthikg.in, but it **can** be committed to public Git before privacy review. That is the contradiction this revision removes.
- **Prerequisite defect:** `generateObjectId()` is called **on every copy/download**. The notebook `Draft.id` is a UUIDv4 from `crypto.randomUUID()` and is **not** the canonical ObjectId. This violates Personal Web Core §7.3 (“ID assigned at creation time; never regenerated”). Fix independently of Git mutation.
- Canonical Note schema (M8) requires `id`, `slug`, `previousSlugs`, plus editorial fields below.
- Publication truth: storage holds `draft` + `privacyReviewed`; domain derives `PublicationState` (`draft` | `awaiting-privacy-review` | `public`). Public iff `!draft && privacyReviewed`.
- GitHub repo `karthikg80/personal-site` is **public**. Vercel project `karthikg80s-projects/personal-site` deploys `main` to production. Branch/PR previews exist (observed on PR #7). `main` has **no** branch protection or rulesets.
- Server-side code has **no** GitHub client, **no** repository write API, and **no** filesystem writes under `src/pages/api`. A Vercel runtime write to `src/content/notes/` would not become Git history and would not survive the next deploy.
- Distribution CLIs remain local: `npm run webmentions:send`, `npm run posse:bluesky -- <slug>`.

This design removes copy/paste into Git. It does not collapse privacy review into Publish, and it does not auto-send Webmentions or POSSE.

---

## 3. Desired UX

One-person publishing. No CMS dashboard. States after the existing Gather / Shape / Review writing stages:

### 3.1 Working draft

Not in Git. Privacy not yet approved for this exact publication-bound text.

```text
Future URL: https://karthikg.in/notes/<slug>/

[ ] I reviewed this exact text for private/sensitive information
    and approve it entering the public source repository.

[Prepare for publication]
```

Slug, title, date, tags, presentation, optional summary, and optional relationships are editable **before** the first Prepare. Prepare is disabled until the privacy checkbox is on. Prepare does not publish on karthikg.in.

The five existing drafting checkboxes (firsthand, facts, people, location, voice) remain drafting hygiene. They are **not** `privacyReviewed`. The repository-entry acknowledgement is a separate, required control.

If those five checks are incomplete, warn and still allow Prepare once the repository-entry acknowledgement is on.

### 3.2 Canonical unpublished Note

```text
Canonical draft prepared

Future URL: https://karthikg.in/notes/<slug>/
Git revision: <short SHA>

Canonical draft:
  Unpublished on karthikg.in
  Privacy-reviewed (this Git revision)

Working copy:
  Unchanged                     ← or:
  Changed since Prepare — not reviewed

[Review canonical draft]
[Update canonical draft]     ← only while unpublished; requires a fresh
                               privacy acknowledgement if the working copy changed
```

The Git file is authoritative. A dirty browser working copy does **not** retract privacy review on the committed revision. Update requires a new acknowledgement because it would replace that Git revision with new text.

### 3.3 Canonical review → Publish

`/drafting/review/<slug>` renders the **Git** revision with production Note chrome.

```text
This is exactly the Note that will appear at
https://karthikg.in/notes/<slug>/

Status: Unpublished · Privacy-reviewed (repository)

[Publish]
```

There is **no** privacy checkbox on Publish. Privacy was the Prepare decision. Publish is disabled until the page has loaded a validated canonical file with `privacyReviewed: true` at a known Git blob SHA.

### 3.4 Published

```text
Published in Git.
https://karthikg.in/notes/<slug>/

Production usually updates within a minute.
Confirm the public URL before sending mentions.

Optional distribution (still local CLI in v1):
  npm run webmentions:send
  npm run posse:bluesky -- <slug>
```

GitHub UI is not part of the ordinary path. It remains the recovery and advanced path.

---

## 4. Architectural invariants

1. **Drafting Room ≠ canonical storage** until Prepare succeeds.
2. **After Prepare, Git Markdown is the canonical Note.** Frontmatter `id` is the durable identity.
3. **ObjectId ≠ slug ≠ URL.** ObjectId is never a public path segment. No step regenerates ObjectId.
4. **No content enters public Git until a human privacy acknowledgement of that exact publication-bound content.** Prepare is the Git-entry action and requires `privacyAcknowledgement: true`.
5. **No Drafting Room action may make a Note public on karthikg.in.** Publish is a separate endpoint that flips only `draft`, against a specific blob SHA, and only if `privacyReviewed` is already `true`.
6. **The agent cannot Prepare, Publish, or set `privacyReviewed`.**
7. **Publication truth stays dual-gate.** Do not collapse to `published: true`. Storage keeps `draft` + `privacyReviewed`. Domain keeps derived `PublicationState`.
8. **Flag meanings:**
   - `privacyReviewed: true` → this exact committed text is approved to exist in the public source repository.
   - `draft: false` → this object is visible on karthikg.in (only valid when `privacyReviewed` is already true).
9. **Canonical publication ≠ Bluesky POSSE ≠ Webmention sending.**
10. **Vercel filesystem is not Git.** Production mutation goes through the GitHub API to `karthikg80/personal-site`, not `fs.writeFile`.
11. **Writes are path-limited** to `src/content/notes/<slug>.md`. No projects, no `person.yaml`, no arbitrary paths, no `README.md`.
12. **Git is the audit log.** No parallel audit database.
13. **karthikg.in owns meaning.** GitHub is infrastructure. Vercel is hosting. Platforms are distribution. GitHub visibility is **not** a privacy control.

---

## 5. Canonical-draft definition

A **canonical unpublished Note** is a file in Git that:

- lives at `src/content/notes/<slug>.md`
- validates against the M8 `notesCollection` schema and storage mapper (`mapNote`)
- has a durable UUIDv7 `id`
- is **not** public on karthikg.in: `draft: true`
- **is** privacy-reviewed for repository entry: `privacyReviewed: true`
- therefore has domain `publication: 'draft'` (`derivePublicationState(true, true)` is still `'draft'`)
- is excluded from `getPublishedNotes()`, `/notes/<slug>/` static paths, RSS, sitemap, and homepage

It **is** world-readable on GitHub because the repository is public. That is acceptable **only after** the Prepare acknowledgement. Raw observations and prohibited sensitive material still must not be Prepared. That warning stays in `docs/editorial-and-privacy.md`.

The product workflow must not create:

```yaml
draft: true
privacyReviewed: false
```

in Git for new Notes. Manual Git can still produce that historical/handoff state; Publish must refuse it rather than “fix” it by flipping both flags.

The invalid/undesired **site** state remains:

```yaml
draft: false
privacyReviewed: false
```

Domain: `awaiting-privacy-review`. Still non-public (`isPublicPublication` is false). Prepare must not create it. Publish must not create it.

**Authority transfer:**

```text
before Prepare   → Drafting Room owns the working draft
after Prepare    → Git file owns the publication-bound draft
after Publish    → same Git file, public on karthikg.in after deploy
```

The Drafting Room copy may remain on the device. It is not authoritative after Prepare. **Update canonical draft** while unpublished is a one-way push that replaces the Git file, not a sync, and requires a fresh privacy acknowledgement if canonical content changed. After Publish, the room cannot mutate the Note.

---

## 6. Prepare-for-publication contract

### 6.1 Meaning

After a human privacy acknowledgement of the exact publication-bound text, turn the current drafting-room document into a canonical Note object owned by karthikg.in, kept unpublished on the site.

This is also the decision **“this material is safe to enter the public source repository.”**

### 6.2 Current schema (authoritative)

Prepare must produce a file that `mapNote` and the Zod collection schema accept. Required / defaulted frontmatter for a **new** Note:

```yaml
id: <UUIDv7 assigned once for this document>
title: "<title>"
slug: <url-segment>
date: YYYY-MM-DD
previousSlugs: []
summary: "<optional; omit if empty>"
tags: []                    # or user-supplied strings
presentation: note          # or scrap
relationships: []           # or validated reply-to / bookmark-of entries
syndication: []
draft: true                 # forced by server
privacyReviewed: true       # forced by server after acknowledgement
```

Do **not** write `legacyRssGuid` on new notes. RSS identity is `urn:karthikg.in:note:{id}` (Personal Web Core §8.5). `updated` is omitted on first Prepare.

Optional relationship shape (unchanged from M7/M8):

```yaml
relationships:
  - type: reply-to          # or bookmark-of
    target:
      kind: external
      url: https://example.com/post
```

Internal targets (`kind: internal`, `id`, optional `expectedKind`) are allowed by schema but are out of scope for the v1 Prepare form. v1 persists `[]` unless the writer supplies a valid external reply/bookmark.

### 6.3 ObjectId

| Rule | Decision |
| --- | --- |
| Source | Existing drafting `canonicalId` if present; otherwise `generateObjectId()` once when the document first enters publication preparation |
| Persistence | Store `canonicalId` (UUIDv7) on the encrypted notebook draft |
| Notebook `Draft.id` | Remains the local list key (existing UUIDv4 values stay local-only) |
| Regeneration | Forbidden after assignment, including re-Prepare, slug lock, Publish, copy, and download |
| Prerequisite defect | Today’s handoff calls `generateObjectId()` on every copy/download. Fix that **before** enabling Git mutation. Fallback Copy/Download must reuse `canonicalId`. |

Server validates with `parseObjectIdV7`. A v4 notebook id must never be used as `frontmatter.id`.

“Enters publication preparation” means the first time the writer is about to Prepare **or** the first Copy/Download after this fix — assign once, persist, reuse.

### 6.4 Slug

- Default: current Drafting Room `slugify(title)` (lowercase, `[^a-z0-9]+` → `-`).
- Must also pass `contentSlugSchema` (single path segment: letters, digits, `.`, `_`, `-`).
- User may edit slug **before the first successful Prepare**.
- After the canonical file exists, **slug is locked** for this workflow. Changing it while unpublished is a Git recovery / later enhancement, not v1 UI.
- Reserved: `README` (existing collection sentinel). Reject it.
- Filename always `src/content/notes/<slug>.md`. Filename stem must equal frontmatter `slug`.

### 6.5 Body

The Markdown body is the current Shape-stage text, falling back to Gather sparks if the body is empty — same as today’s handoff. **Body bytes are preserved.** Frontmatter is **not** byte-for-byte from the client: the server rebuilds YAML so gate values cannot be smuggled in.

Sparks, voice notes, agent notes, and checklist state are **not** written to Git.

### 6.6 Fields editable at Prepare

Default `date` is UTC `YYYY-MM-DD` (`toISOString().slice(0, 10)`), matching today’s handoff.

| Field | First Prepare | Later Prepare while unpublished |
| --- | --- | --- |
| title, date, tags, presentation, summary, body, relationships | yes | yes |
| slug | yes | no (locked) |
| id | assigned / reused; not editable | unchanged |
| previousSlugs | forced `[]` | forced `[]` until a published rename (out of scope) |
| syndication | forced `[]` | leave existing if already present (should still be `[]`) |
| draft | forced `true` | forced `true` |
| privacyReviewed | forced `true` after acknowledgement | forced `true` after acknowledgement |
| legacyRssGuid | omit | omit |

### 6.7 Server enforcement

Prepare **requires** `privacyAcknowledgement: true` in the JSON body. Missing or false → 400, no commit.

The Prepare payload **must not contain** `draft` or `privacyReviewed`. Those fields are not inputs. If either is present, 400 (`Publication flags are not accepted on Prepare.`). Extra unknown fields should also be rejected when practical.

The client sends only editorial fields plus acknowledgement:

```ts
PrepareRequest = {
  canonicalId,
  slug,
  title,
  date,
  tags,
  presentation,
  summary?,
  relationships,
  body,
  privacyAcknowledgement: true
}
```

The server constructs gates itself:

```text
draft = true
privacyReviewed = true
previousSlugs = []          # new notes
syndication = []
```

### 6.8 Validation failures

Return 400 with a short, field-level message. Do not commit. Surface in the Review stage status line. Examples:

- `Title is required.`
- `Slug must be a single URL segment.`
- `Slug “README” is reserved.`
- `ObjectId must be UUIDv7.`
- `Relationship URL is not valid.`
- `Privacy acknowledgement is required before this text can enter the public repository.`

Schema validation should reuse `contentSlugSchema`, `noteRelationshipSchema`, `parseObjectIdV7`, and the same YAML mapping `mapNote` expects — not a second ad-hoc parser.

### 6.9 Content change invalidates privacy approval

Canonical content is every editorial field that will be committed, excluding identity and gates:

```text
title, date, tags, presentation, summary, body, relationships
```

If the working copy differs from the last successfully Prepared **snapshot of editorial fields**:

1. Client: show “Working copy: Changed since Prepare — not reviewed.” Clear the privacy checkbox. Update stays disabled until it is checked again.
2. Git: the existing file **keeps** `privacyReviewed: true`. Dirty local text does not rewrite Git and does not recast the committed revision as unreviewed.
3. Server: any Prepare that writes **different** file bytes still requires `privacyAcknowledgement: true`. The new commit stores `privacyReviewed: true` for **that** revision only.

Forbidden:

```text
privacyReviewed: true in Git
  → Update canonical draft with different body
  → privacyReviewed remains true on the new commit without a new acknowledgement
```

Not forbidden: Git remaining privacy-reviewed while the browser holds newer unreviewed edits. That is the authority boundary.

Dirty-state comparison is a **client editorial marker** (normalized field snapshot / deep equality). It is not ObjectId, not Git blob SHA, and not concurrency control. The server must not expose a content fingerprint as identity. Concurrency is the Git blob SHA.

Idempotent retry of **identical** Git bytes (lost response, double-click): GET the known slug, compare bytes, return success without a new commit. Acknowledgement is still required on the request because Prepare always requires it; no second Git mutation.

After Publish, Prepare is disabled regardless of edits.

---

## 7. Publish contract

### 7.1 Meaning

After reviewing a **specific Git revision** of a canonical Note, explicitly approve visibility on karthikg.in.

This is **not** a privacy certification.

Only this action may transition:

```diff
-draft: true
+draft: false

 privacyReviewed: true
```

Domain state becomes `public`. Static routes, RSS, and sitemap include the Note on the next production build.

### 7.2 Narrow mutation

Publish changes **only** `draft`. It must not set `privacyReviewed`. It must not edit title, slug, body, tags, relationships, or other metadata.

Preconditions (all required):

- Valid drafting session + allowed origin
- File exists at `src/content/notes/<slug>.md` on `main`
- Frontmatter `id` equals request ObjectId
- Frontmatter `slug` equals request slug and filename stem
- `privacyReviewed === true` already
- `expectedBlobSha` matches current blob SHA
- `privacyAcknowledgement` **must not appear**. If present (or any unknown field, when practical) → 400. Publish means only: make this already privacy-reviewed Git blob public.

If `privacyReviewed === false`, **refuse** (409/422). Tell the writer to Prepare again with a privacy acknowledgement. Do not “helpfully” set `privacyReviewed: true` on Publish.

If `draft === false` and `privacyReviewed === true` already: **200 idempotent success.** No new commit.

### 7.3 Optimistic concurrency

Publish targets:

```text
path = src/content/notes/<slug>.md
expectedBlobSha = <sha from review load>
objectId = <canonicalId>
```

The server:

1. `GET` the file at `main`.
2. Apply the preconditions above.
3. Set `draft: false` only.
4. `PUT` with `sha = expectedBlobSha`.

If the Note changed after review, Publish does not flip `draft`. The writer re-reviews the new SHA.

`updated`: omit on first Publish of a new Note (`date` is the public timestamp). v1 has no UI unpublish.

### 7.4 Confirmations

- No privacy checkbox on the review surface.
- Show title, slug, and future URL on the Publish button row.
- Do not require re-typing the title. Do not require GitHub.

### 7.5 Agent exclusion

The agent API stays suggestion-only. Publish and Prepare are not agent tools, not agent modes, and not reachable from `POST /api/drafting/agent`. Agent copy must not claim privacy review or publication is complete.

---

## 8. Recommended Git mutation architecture

### Recommendation: **A** — privacy-reviewed unpublished Notes committed to `main`, then an explicit Publish commit

```text
                 PRIVATE / DEVICE

              Drafting Room
                    │
                    │ write / revise
                    ▼
             Publication Review
                    │
                    │ human checks exact text
                    │ privacyAcknowledgement=true
                    ▼

                 PUBLIC GIT

          Prepare canonical draft
                    │
                    ▼
        src/content/notes/<slug>.md
        id: stable UUIDv7
        draft: true
        privacyReviewed: true
                    │
                    ▼
       private canonical review route
         (renders exact Git revision)
                    │
                    │ expectedBlobSha
                    ▼
                 Publish
                    │
                    ▼
              draft: false
        privacyReviewed: true
                    │
                    ▼
               karthikg.in
                    │
             ┌──────┴──────┐
             ▼             ▼
        Webmentions      Bluesky
          optional       optional
```

Why A still fits after the privacy ruling:

| Factor | Why A wins here |
| --- | --- |
| Simplicity | Two endpoints, two commits, one branch. No PR lifecycle. |
| Privacy | Review happens **before** Git, so public `main` never receives unreviewed Note text through this product. |
| Public repo | PR branches are also public. A draft PR does not hide unreviewed Markdown. |
| Site safety | `draft: true` still hides the Note from production HTML. |
| Preview | Vercel Preview still runs `getPublishedNotes()`, so a draft PR would **not** show `/notes/<slug>/` without weakening gates. |
| Audit | Git history on `main` is the log. Messages distinguish prepare vs publish. |
| Latency | One Contents `PUT` then Vercel deploy. |
| Conflicts | Contents API `sha` is natural optimistic concurrency. |
| One operator | No review partner to merge a PR. |

**GitHub UI is not required** for ordinary Note publishing. Manual Git remains the recovery path.

Local development: if `GITHUB_NOTES_TOKEN` is unset, Prepare/Publish authenticate, validate, then return **503**. They do not return a success payload, do not write the Vercel filesystem, and do not add a second production path. Serialization is tested in unit tests, not via a pseudo-Prepared response.

---

## 9. Alternatives considered

### B — Branch/PR canonical draft; merge = Publish

Rejected for ordinary Notes. PRs do not solve repository privacy. Preview deployments still hide unpublished Notes. Merge-as-Publish would hide the site-visibility decision in GitHub. Revisit only if `main` later requires PRs.

### C — Local-only authoring helper

Documented recovery/offline path, not the production path.

### D — Private draft database / CMS

Rejected. Non-goal. Would move canonical storage off Git.

### Direct Vercel filesystem write

Rejected. Ephemeral, not Git.

### Original Option A (`privacyReviewed: false` on first Git commit)

**Rejected.** The site would hide the Note; GitHub would not. That weakens `privacyReviewed` to “not on karthikg.in,” which is what `draft` already means.

---

## 10. GitHub credential model

**v1:** a **fine-grained personal access token** stored only in Vercel (and local `.env`) as `GITHUB_NOTES_TOKEN`.

| Criterion | Fine-grained PAT | GitHub App | OAuth user token |
| --- | --- | --- | --- |
| Least privilege | This repo only; Contents: Read and write | Similar, more setup | Broader user scope risk |
| Path restriction | **Not available** at GitHub; must be in app code | Same | Same |
| Rotation | Calendar expiry (90 days suggested) | Installation tokens are short-lived | Refresh-token machinery |
| Browser exposure | Never; server env only | Never | Easy to leak to client if mis-wired |
| Complexity | Low | High for one repo | Medium, wrong threat model |
| Commit/PR ops | Contents API is enough for A | Needed more for B | Not needed |

No existing GitHub integration exists in this repository. Do not put the token in client JavaScript.

**Token must not be a classic PAT.**

Contents:write on a public repo is a high-value secret. Defense: repo-only scope + app-level path allowlist + no token in logs.

---

## 11. Auth/security analysis

### 11.1 Current drafting auth (verified)

- Shared access phrase (≥16 chars) compared in constant time.
- HMAC-SHA256 session cookie `kg_drafting_session`, payload `v1.<exp>`, 12-hour lifetime.
- Cookie: `httpOnly`, `SameSite=strict`, `secure` in production, `path=/`.
- Origin allowlist: `https://karthikg.in` in prod; localhost in DEV.
- Production `/drafting` is 404 if secrets are missing.
- DEV bypass: `import.meta.env.DEV && !isDraftingConfigured()`.
- Agent route also checks session + origin + 64 KB body cap.

Appropriate for hiding a private writing room. Shared-secret, not identity.

### 11.2 Git mutation strengthening (v1)

1. Prepare/Publish require a valid drafting session **and** allowed origin.
2. **Do not honor `isLocalDraftingBypass()` on mutation endpoints.**
3. Missing `GITHUB_NOTES_TOKEN`: request still authenticates and **validates**, then returns **503** `Publication is not configured.` That is a hard non-mutation. Do not return 200 with a validated payload that the client could treat as Prepared.
4. Prepare requires `privacyAcknowledgement: true` and **rejects** `draft` / `privacyReviewed` if sent. Publish has **no** privacy-acknowledgement field.
5. Path allowlist + schema validation + server-constructed gates on Prepare + SHA concurrency on Publish + Publish refuses `privacyReviewed: false` files.
6. Log `action`, `slug`, `objectId`, `commitSha`, `result` — not the Markdown body.
7. Keep `Cache-Control: no-store`.

**Not in v1:** new site-wide auth, OAuth, extra CSRF tokens beyond Origin + SameSite=strict, phrase re-entry, MFA.

### 11.3 CSRF

Keep Origin allowlist on **mutation POSTs** (Prepare, Publish). Do **not** require `Origin` on read-only `GET /api/drafting/canonical` or `GET /drafting/review/<slug>`. Browsers often omit `Origin` on ordinary same-origin GET. Those routes use the HMAC session, `Cache-Control: no-store`, and noindex.

### 11.4 Replay / double submit

ObjectId idempotency and Git blob SHA.

---

## 12. Drafting-document linkage

No database.

```ts
type DraftLinkage = {
  canonicalId: string;      // UUIDv7 — identity
  slug: string;
  blobSha?: string;         // Git blob SHA — concurrency
  commitSha?: string;
  preparedAt?: string;
  publishedAt?: string;
  lastPreparedSnapshot?: { // client dirty-state only; not identity
    title: string;
    date: string;
    tags: string[];
    presentation: string;
    summary: string;
    body: string;
    relationships: unknown[];
  };
};
```

Server correlation key remains frontmatter ObjectId. Concurrency is Git blob SHA. The snapshot is **only** for Drafting Room dirty-state UI. Do not treat it as canonical identity and do not return it from the server unless the UI cannot compare fields locally (it can).

**`canonicalId` is not proof of a Git object.** Copy/Download may assign `canonicalId` without touching Git.

```text
canonicalId            = this working document's future durable identity
preparedAt / blobSha   = a canonical Git object actually exists
```

`canonicalId` present and `preparedAt` absent is still a **working draft**. The UI must not show “Canonical draft prepared” from ID assignment alone.

Canonical lookup for lost-response recovery:

```text
GET /api/drafting/canonical?id=<objectId>&slug=<slug?>
```

1. If `slug` is present, GET that notes file directly. If it exists and `id` matches → recovered.
2. Only if slug linkage is missing, scan `src/content/notes/` by ObjectId.

**One-way after Publish.** Further Prepare disabled. Post-publish edits are Git.

**While unpublished:** repeated Prepare updates the same file (same ObjectId, same slug) with a fresh acknowledgement when content changed.

---

## 13. Slug/ObjectId collision rules

Lookups against `main` via GitHub Contents (`src/content/notes/`).

### Existing slug (`foo.md` already exists)

| File `id` | `draft` | Behavior |
| --- | --- | --- |
| Same ObjectId | `true` | **Update allowed**, including upgrading a manual Copy/Download commit from `privacyReviewed: false` to `true` after acknowledgement. Idempotent if bytes already match. SHA conflict rules apply. |
| Same ObjectId | `false` (public or awaiting-privacy-review) | **Reject.** Do not overwrite from Prepare |
| Different ObjectId | any | **Reject:** `Slug already exists. Choose another slug.` |
| Unreadable / invalid frontmatter | — | **Reject.** Do not overwrite |

Never silently overwrite another Note. Never overwrite `README.md`. Prepare must **never** touch a file with `draft: false`.

**Manual closed-draft upgrade:** If Git already has the same ObjectId and slug with `draft: true` and `privacyReviewed: false` (Copy/Download pasted by hand), Prepare after acknowledgement **replaces** that unpublished file with `draft: true` / `privacyReviewed: true`. That is the intended recovery path from the conservative fallback export.

### Existing ObjectId at a different path

**Reject.** Manual Git recovery. Do not move files in v1.

---

## 14. Idempotency / concurrency

**Correlation key:** ObjectId.

### Double-click Prepare

1. Require acknowledgement; validate payload; force `draft: true`, `privacyReviewed: true`.
2. `GET` `src/content/notes/<slug>.md`.
3. If 404: `PUT` create. If 422 (appeared), GET and treat as update.
4. If present, same ObjectId, `draft: true`: identical bytes → success, no commit; different bytes → `PUT` update with current SHA (acknowledgement already required).
5. SHA race: retry GET once; else 409.

### Retry after network failure

`GET /api/drafting/canonical?id=&slug=` — slug GET first; ObjectId directory scan only if slug is unavailable.

### Publish against stale revision

409. Reload review.

### Publish already public

200 idempotent if `draft: false` and `privacyReviewed: true`.

### Publish of unreviewed Git file

Reject. Do not flip `draft`. Do not set `privacyReviewed`.

---

## 15. Canonical preview / review design

Authenticated SSR route:

```text
/drafting/review/<slug>
```

- Same drafting session as `/drafting` (404 when unconfigured). **Do not require `Origin`.**
- `prerender = false`.
- `noindex`, `no-store`, `X-Robots-Tag: noindex`.
- Loads the file from **GitHub `main`**.
- Verifies frontmatter `slug` and UUIDv7 `id`.
- Renders with `NoteLayout` / `mapNote` / `deriveNoteKind` and the **same Markdown rendering pipeline as published Notes**. Do not introduce a second engine (`marked`, etc.) unless a parity test proves it matches `render(entry)` for current production notes. Prefer extracting the smallest shared renderer the content collection already uses.
- Review chrome and Publish (no privacy checkbox).
- Not in sitemap, RSS, or `getStaticPaths`.
- Ignores the public publication gate **only inside this authenticated route**.
- Hides the public Webmention form.

This previews the actual canonical Git object with production rendering. It does not recertify privacy.

**Local images:** Review rendering uses `renderNoteBodyHtml()` (Astro’s Sätteri processor on the GitHub blob). Parity with `render(entry)` is guaranteed for the Markdown constructs in the 8A fixtures. **Local Astro image-pipeline paths are not supported** for GitHub-fetched review Markdown. If a canonical draft contains such an image, review fails with a clear error instead of silently emitting `__ASTRO_IMAGE_` markup that production would rewrite.

---

## 16. Publication-state UX

| UX label | Where | Storage | Domain |
| --- | --- | --- | --- |
| Working draft | device | not in Git | — |
| Privacy review required | device (dirty or first time) | not in Git, or Git lags working copy | — |
| Unpublished canonical Note | Git + site hidden | `draft: true`, `privacyReviewed: true` | `draft` |
| Public | Git + karthikg.in | `draft: false`, `privacyReviewed: true` | `public` |

Do not display `awaiting-privacy-review` as a happy-path product state. Do not show ObjectId in primary UI; optional details line on the review page.

`draft: true` + `privacyReviewed: false` in Git is a **legacy / recovery** state, not something Prepare writes.

The Drafting Room shows one focused stage at a time: **Gather → Shape → Review → Prepare**. A compact `Step n of 4` indicator and Back/Continue controls replace an always-visible stage list. The active stage is stored inside each encrypted device-local draft; existing drafts without that field resume at Prepare when a canonical Git object exists and at Gather otherwise. The stage occupies the single persistent workspace. Draft navigation opens in a modal drawer, with working notes primary and published browser copies in a collapsed archive. Editorial assistance opens in a separate optional drawer and is unavailable during Prepare.

Review contains only the editorial prompts and voice note. Prepare contains canonical metadata, the repository-entry acknowledgement, optional post-live distribution intent, and a collapsed recovery section. After Prepare, the authenticated Git review page handles **Inspect → Publish** with the same compact one-stage indicator. It names the exact Git revision, keeps ObjectId/blob SHA in optional technical details, and says that its primary action publishes **this exact revision**.

---

## 17. Failure / recovery behavior

| Failure | UX | Recovery |
| --- | --- | --- |
| Invalid schema | 400; no commit | Fix fields; retry |
| Missing privacy acknowledgement | 400 | Check the box; retry Prepare |
| Slug collision (other Note) | 409 | Choose another slug |
| Duplicate ObjectId at another path | 409 | Git reconcile |
| GitHub auth / token missing | 503 `Publication is not configured.` | Set `GITHUB_NOTES_TOKEN`; or local Git (C) |
| SHA conflict | 409 stale | Reload review / re-Prepare |
| Lost Prepare response | Lookup by ObjectId | Idempotent |
| Lost Publish response | Lookup; if `draft: false`, Published | Idempotent Publish |
| Publish while `privacyReviewed: false` | Refuse | Prepare with acknowledgement |
| Vercel deploy fails after Prepare | Review still works (GitHub). Site unchanged | Retry Vercel deploy |
| Publish commit succeeds, deploy delayed | “Published in Git. Confirm the public URL.” | Refresh `https://karthikg.in/notes/<slug>/` |
| Unpublish | **No v1 UI** | Git: set `draft: true`. Redeploy |
| Delete mistaken canonical draft | No v1 UI | Git delete the file on `main` |
| Token stolen | Attacker can commit to this repo | Revoke PAT; rotate; `git log` |

Manual Git is always valid. SHA mismatch on the next UI action is the conflict signal.

---

## 18. Distribution boundary

v1 **does not** send Webmentions or POSSE as part of Publish.

After Published, the UI may show the existing CLI commands. It does not collect `BLUESKY_APP_PASSWORD` in the Drafting Room.

---

## 19. Auditability

```text
draft(note): prepare <slug>

publish(note): <slug>
```

Commit body may include `id: <uuidv7>`.

No branch naming in Option A.

---

## 20. File / API boundaries

| Surface | Role |
| --- | --- |
| `POST /api/drafting/prepare` | Require privacy acknowledgement; validate Note-shaped payload; force `draft: true`, `privacyReviewed: true`; create/update one file on `main` |
| `POST /api/drafting/publish` | Flip **only** `draft` to `false`; require expected SHA + ObjectId + existing `privacyReviewed: true` |
| `GET /api/drafting/canonical?id=&slug=` | Lookup: known slug first, ObjectId scan only as fallback |
| `GET /drafting/review/<slug>` | Authenticated canonical preview + Publish chrome |
| Server-only GitHub Contents helper | GET/PUT `src/content/notes/<slug>.md` only |

Payload rules:

- Accept Note-shaped JSON **without** `draft` or `privacyReviewed`. Reject those keys.
- Publish body is only `{ objectId, slug, expectedBlobSha }`. Reject `privacyAcknowledgement` and other unknown fields when practical.
- Reject path traversal. Allowlist `src/content/notes/<slug>.md` after slug validation.
- Reject `README`.
- Never send `GITHUB_NOTES_TOKEN` to the client.
- Agent route unchanged: no Git, no gates.

Client:

- Persist `canonicalId` once; Copy/Download reuse it.
- Privacy checkbox on Prepare only; clear it when the working copy diverges from `lastPreparedSnapshot`.
- Copy/Download is recovery only: **always** emit `draft: true` and `privacyReviewed: false`, even if the Prepare checkbox is checked. A detached export is not a reviewed canonical revision. Warn that the file must not be committed as privacy-reviewed.

---

## 21. Data-flow diagrams

### Prepare

```text
Browser notebook (encrypted)
        │  canonicalId, title, slug, body, …
        │  privacyAcknowledgement: true
        ▼
POST /api/drafting/prepare
        │  session cookie + Origin
        │  refuse unless acknowledgement
        │  force draft:true, privacyReviewed:true
        │  parseObjectIdV7, contentSlugSchema, mapNote-shaped YAML
        ▼
GitHub Contents API
        │  PUT src/content/notes/<slug>.md  (main)
        ▼
Git blob + commit on main
        │
        ├─► Vercel production build (Note still filtered: draft true)
        └─► response { slug, objectId, blobSha, commitSha, url }
                    ▼
            notebook linkage saved
```

### Review and Publish

```text
GET /drafting/review/<slug>
        │  session
        ▼
GitHub Contents GET
        │  parse + mapNote + render NoteLayout
        ▼
Human confirms this is the site-visible text
        ▼
POST /api/drafting/publish
        │  { objectId, slug, expectedBlobSha }
        │  require privacyReviewed:true; flip only draft
        ▼
GitHub Contents PUT (sha=expectedBlobSha)
        ▼
commit publish(note): <slug>
        ▼
Vercel production deploy → public /notes/<slug>/
```

### Authority

```text
working draft (browser)
    --privacy acknowledgement-->
Prepare --> Git Markdown (canonical, unpublished, privacy-reviewed)
    --Publish (draft only)--> public site
    --CLI--> Webmention / Bluesky
```

---

## 22. Threat model / security controls

| Threat | Control |
| --- | --- |
| Anonymous user hits Prepare | Session + 404 when drafting unconfigured |
| CSRF | Origin allowlist + SameSite=strict |
| Agent instructed to “publish this” | No tool; endpoints are human POSTs |
| Agent or client claims privacy complete | Prepare requires explicit acknowledgement field; agent cannot call Prepare |
| Client sends `privacyReviewed` or `draft` on Prepare | 400; keys are not in the contract |
| Unreviewed Note committed via Copy/Download + manual Git | Fallback always `privacyReviewed: false`; Publish refuses |
| Publish used to certify privacy | Publish cannot set `privacyReviewed`; refuses false |
| Path `src/content/projects/…` or `../` | Reject; path derived from validated slug |
| Overwrite `first-note-probably.md` | Slug/ObjectId collision; Prepare cannot touch `draft: false` files |
| Stale Publish | Blob SHA check |
| Token in browser | Env-only |
| Unreviewed Note leaked via public GitHub **through this product** | Prepare blocked without acknowledgement |
| Unpublished-on-site Note leaked via `/notes/<slug>/` | `draft: true` + `getPublishedNotes()` |
| Review route leaked to Google | `noindex`, unlinked, session |
| Local DEV bypass commits | Mutation endpoints ignore DEV bypass |

---

## 23. Migration impact

- **No change** to existing public URLs, ObjectIds, RSS GUIDs, or `previousSlugs`.
- **`first-note-probably`** stays a legacy public Note with `legacyRssGuid`. This workflow must not rewrite it.
- **Handoff ObjectId bug** is a **prerequisite defect**: persist UUIDv7 on the notebook draft; Copy/Download reuse it. Do not wait for the GitHub integration to fix this.
- **`validateCanonicalIdentities()` currently requires `legacyRssGuid` on every public Note.** That contradicts Personal Web Core §8.5. **Prerequisite:** allow public Notes without `legacyRssGuid` (URN GUID). Keep requiring/validating the field only when present (legacy notes).
- `collectMigrationSnapshot()` treats `legacyRssGuid` as a proxy for “published.” Migration-era; must not gate this workflow.
- Editorial docs replace “export with both flags false, then flip both in Git” with: privacy-acknowledge → Prepare (`draft: true`, `privacyReviewed: true`) → canonical review → Publish (`draft: false`).
- Existing device notebooks keep UUIDv4 `Draft.id`. New `canonicalId` is additive.
- Knowledge Layer (PR #8) is unrelated.

---

## 24. Implementation plan pointer

Bite-sized implementation tasks live in [`draft-to-publish-implementation-plan.md`](./draft-to-publish-implementation-plan.md).

Order of concern:

1. Stable `canonicalId` (prerequisite defect).
2. `legacyRssGuid` validator alignment (prerequisite).
3. Prepare (acknowledgement + Git create/update).
4. Canonical review route.
5. Publish (`draft` only).
6. Editorial docs.

---

## 25. Risks / over-engineering traps

- Building a CMS, draft database, or cross-device sync.
- Bidirectional sync between notebook and Git.
- Using PRs as a privacy mechanism.
- Using a second Markdown engine (`marked` or similar) for review without proven parity to `render(entry)`.
- Collapsing dual gates to one `published` boolean.
- Letting Publish set `privacyReviewed`.
- Letting Prepare write `privacyReviewed: true` without acknowledgement.
- Allowing Update to keep `privacyReviewed: true` across body changes without a new acknowledgement.
- Automatic POSSE or Webmentions on Publish.
- GitHub App + OAuth for a single operator in v1.
- Letting Prepare edit public Notes.
- Using notebook UUIDv4 as `frontmatter.id`.
- Writing files on the Vercel filesystem.
- Putting ObjectId in public URLs.
- Treating GitHub invisibility as a privacy control.

---

## 26. Approved decisions

| # | Decision | Approved position |
| --- | --- | --- |
| 1 | Git mutation | **A** — privacy-reviewed unpublished Notes to `main`; Publish is a second `main` commit |
| 2 | Flag split | **Prepare** sets `privacyReviewed: true` (with acknowledgement) and `draft: true`. **Publish** flips only `draft`. |
| 3 | Repeated Prepare | **Allowed while unpublished**, same ObjectId/slug; content changes require a new acknowledgement; frozen after Publish |
| 4 | Slug edits | **Editable before first Prepare; locked after** |
| 5 | Review surface | **Private `/drafting/review/<slug>`** loading GitHub `main`; Publish lives there; no privacy checkbox there |
| 6 | GitHub credentials | **Fine-grained PAT** `GITHUB_NOTES_TOKEN`, Contents R/W on this repo |
| 7 | Auth | **Reuse drafting session** + origin + Prepare acknowledgement; no new auth system |
| 8 | Unpublish | **Not in v1 UI**; Git `draft: true` |
| 9 | Distribution | **CLI only** after Publish |
| 10 | `legacyRssGuid` validator | **Prerequisite:** align with PWC §8.5 |
| 12 | Copy/Download | **Always** `draft: true`, `privacyReviewed: false`. Only Prepare writes `privacyReviewed: true`. |
| 13 | Prepare payload | **No gate fields.** Server constructs `draft` / `privacyReviewed`. |
| 14 | Review rendering | **Same production Markdown pipeline.** No second engine without proven parity. |
| 15 | Recovery lookup | **Known slug first**; ObjectId directory scan only if slug is missing. |
| 17 | GET auth | Canonical lookup and review page: **session only**, no required Origin. Prepare/Publish POSTs still require Origin. |
| 18 | `canonicalId` vs prepared | ID assignment ≠ Git object. Prepared state requires `preparedAt` / `blobSha`. |
| 19 | Closed-draft upgrade | Prepare may upgrade same ObjectId/slug `draft: true` + `privacyReviewed: false` to reviewed unpublished. Never `draft: false`. |
| 20 | Task 8 | **8A rendering spike is a stop/go gate.** Do not invade production Note rendering to force parity. |

---

## Recommendation

**Choose corrected A.** Commit **privacy-reviewed**, unpublished canonical Notes to `main`, then an explicit Publish commit that flips only `draft`.

This keeps Git as canonical storage, avoids a draft database and PR theatre, and gives the two flags distinct meanings that match a public repository: privacy review is permission to exist in Git; clearing `draft` is permission to exist on karthikg.in.
