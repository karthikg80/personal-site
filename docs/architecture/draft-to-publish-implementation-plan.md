# Draft-to-Publish Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the Drafting Room create a privacy-reviewed unpublished canonical Note in Git, then publish it to karthikg.in with a separate `draft: false` commit, without ever writing unreviewed Note text to the public repository or flipping both gates in one action.

**Architecture:** Extract testable publishing helpers under `src/lib/publishing/`. Prepare and Publish are session-authenticated Astro API routes that mutate only `src/content/notes/<slug>.md` via the GitHub Contents API on `main`. Prepare requires `privacyAcknowledgement: true` and writes `draft: true` + `privacyReviewed: true`. Publish requires an expected blob SHA and existing `privacyReviewed: true`, then flips only `draft`. An authenticated SSR review route renders that Git blob. The editorial agent is unchanged and has no mutation tools.

**Tech Stack:** Astro 7 API routes, existing drafting HMAC session, GitHub Contents REST (`fetch`, no Octokit), `uuid` / `yaml` already in the repo, Vitest.

**Spec:** [`docs/architecture/draft-to-publish-workflow-design.md`](./draft-to-publish-workflow-design.md)

**Approved for implementation.** Task 8A (rendering parity) remains an explicit stop/go gate. Execute **Tasks 1–3 first and checkpoint** — they fix the durable-ID defect, the RSS validator defect, and establish the publishing primitives, without GitHub mutation. Do not start Tasks 4–11 in the same run.

## Global Constraints

- Start from **origin/main after Personal Web Core M1–M8** (`1c75ef9` or later). If this checkout is behind, update before writing code.
- Do **not** implement against the rejected design (`privacyReviewed: false` committed to public Git).
- Dual gates stay: public iff `!draft && privacyReviewed`. Do not add a `published` flag.
- Prepare never writes `draft: false`. Publish never writes `privacyReviewed`.
- Prepare refuses without `privacyAcknowledgement: true`.
- Publish refuses if `privacyReviewed !== true`.
- ObjectId is UUIDv7 via `generateObjectId()` / `parseObjectIdV7`. Never use notebook `Draft.id` (UUIDv4) as `frontmatter.id`. Never regenerate `canonicalId`.
- New Notes omit `legacyRssGuid`. Filename is `src/content/notes/<slug>.md`. Slug `README` is forbidden.
- Without `GITHUB_NOTES_TOKEN`, mutation routes authenticate, validate, then return **503**. Never 200 with a validated body that could be mistaken for Prepared.
- Copy/Download fallback **always** writes `draft: true` and `privacyReviewed: false`. Only the Prepare endpoint may write `privacyReviewed: true`.
- Prepare JSON contains **no** `draft` or `privacyReviewed` keys. Reject them. Publish JSON is only `{ objectId, slug, expectedBlobSha }`; reject `privacyAcknowledgement` and other unknown fields when practical.
- Serialization APIs are narrow: `serializePreparedNote(fields)` (always `draft: true`, `privacyReviewed: true`) and `publishCanonicalNote(raw)` (verify privacy review, flip only `draft`). No generic `serializeCanonicalNote(fields, gates)`.
- Dirty-state UI uses a local normalized editorial snapshot / deep equality. It is not identity and not concurrency. Do not SHA-256 fingerprint as a second content identity. Do not return a fingerprint from the server.
- Canonical recovery: GET known slug first; ObjectId directory scan only if slug is missing.
- Review rendering must use the same Markdown pipeline as published Notes. Do not add `marked` or any second engine without a passing parity test against `render(entry)`.
- Canonical GET and the review page require a drafting session but **must not** require `Origin`. Prepare and Publish POSTs require session + allowed Origin.
- `canonicalId` is identity only. A Git object exists only when `preparedAt` / `blobSha` is set. Copy/Download may assign an ID without preparing.
- Prepare may upgrade an existing unpublished file (`draft: true`, same ObjectId and slug), including `privacyReviewed: false` → `true`. Prepare must never modify `draft: false` files.
- Task 8A (rendering parity spike) is a **stop/go gate**. Do not restructure production Note rendering to make review convenient. If parity needs an invasive production change, stop and revisit review architecture.
- GitHub token is server-only (`GITHUB_NOTES_TOKEN`). Never send it to the browser.
- Path writes: only `src/content/notes/<validated-slug>.md`. Reject traversal.
- Agent route (`POST /api/drafting/agent`) must not gain Prepare/Publish capabilities.
- Webmention and Bluesky POSSE stay CLI-only. Do not call them from Publish.
- Do not add a draft database, CMS, GitHub App, or PR workflow.
- Follow existing Vitest style (`src/lib/indieweb.test.ts`, `src/core/domain/publication.test.ts`).
- Do not commit secrets. Do not force-push. Do not skip hooks.

## File map

| File | Responsibility |
| --- | --- |
| `src/lib/publishing/canonical-id.ts` | Assign-once UUIDv7 helper for notebook drafts |
| `src/lib/publishing/handoff.ts` | Fallback Markdown; reuse `canonicalId`; **always** closed gates |
| `src/lib/publishing/note-path.ts` | Slug → allowlisted Git path |
| `src/lib/publishing/note-markdown.ts` | `serializePreparedNote`, `publishCanonicalNote`, parse |
| `src/lib/publishing/prepare-request.ts` | Validate Prepare JSON (no gate fields); require acknowledgement |
| `src/lib/publishing/publish-request.ts` | Validate Publish JSON (`objectId`, `slug`, `expectedBlobSha` only) |
| `src/lib/publishing/github-notes.ts` | GitHub Contents GET/PUT; slug-first lookup |
| `src/lib/publishing/note-body-html.ts` | Shared production Markdown renderer for review (and parity tests) |
| `src/pages/api/drafting/prepare.ts` | Prepare endpoint |
| `src/pages/api/drafting/publish.ts` | Publish endpoint |
| `src/pages/api/drafting/canonical.ts` | ObjectId lookup |
| `src/pages/drafting/review/[slug].astro` | Authenticated canonical preview + Publish chrome |
| `src/scripts/drafting-room.ts` | Persist `canonicalId`; Prepare UX; dirty-content resets acknowledgement |
| `src/pages/drafting.astro` | Review-stage markup for acknowledgement / Prepare / states |
| `src/core/storage/validate-canonical-ids.ts` | Allow public Notes without `legacyRssGuid` |
| `.env.example`, editorial docs, README | Token + workflow copy |

---

### Task 1: Stable canonical ObjectId (prerequisite defect)

**Files:**
- Create: `src/lib/publishing/canonical-id.ts`
- Create: `src/lib/publishing/canonical-id.test.ts`
- Create: `src/lib/publishing/handoff.ts`
- Create: `src/lib/publishing/handoff.test.ts`
- Modify: `src/scripts/drafting-room.ts` (M8 version on origin/main: `Draft` type, `blankDraft`, `markdownHandoff`)

**Interfaces:**
- Consumes: `generateObjectId()` from `src/core/authoring/generate-object-id.ts`; `parseObjectIdV7` from `src/core/domain/ids.ts`
- Produces:
  - `ensureCanonicalId(existing: string | undefined): string`
  - `type HandoffInput` / `buildHandoffMarkdown(input: HandoffInput): { filename: string; content: string }`

This task does **not** call GitHub. It stops minting a new UUIDv7 on every copy/download.

`canonicalId` on the notebook draft is **not** “canonical draft prepared.” Wiring in this task may persist the ID on Copy/Download; the UI (Task 9) must treat `preparedAt` / `blobSha` as the only Git-exists signals.

- [ ] **Step 1: Write the failing canonical-id tests**

```ts
import { describe, expect, it } from 'vitest';
import { version as uuidVersion } from 'uuid';

import { ensureCanonicalId } from './canonical-id.js';
import { parseObjectIdV7 } from '../../core/domain/ids.js';

describe('ensureCanonicalId', () => {
  it('returns an existing UUIDv7 unchanged', () => {
    const id = '018f3b2a-7c4e-7b3a-b123-456789abcdef';
    expect(ensureCanonicalId(id)).toBe(id);
  });

  it('assigns a UUIDv7 when missing', () => {
    const id = ensureCanonicalId(undefined);
    expect(uuidVersion(id)).toBe(7);
    expect(parseObjectIdV7(id)).toBe(id);
  });

  it('rejects a UUIDv4 instead of adopting it', () => {
    expect(() => ensureCanonicalId('550e8400-e29b-41d4-a716-446655440000')).toThrow(/UUIDv7/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/publishing/canonical-id.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement `ensureCanonicalId`**

```ts
import { generateObjectId } from '../../core/authoring/generate-object-id.js';
import { parseObjectIdV7 } from '../../core/domain/ids.js';

export function ensureCanonicalId(existing: string | undefined): string {
  if (existing == null || existing.trim() === '') {
    return generateObjectId();
  }
  return parseObjectIdV7(existing);
}
```

- [ ] **Step 4: Run tests and confirm they pass**

Run: `npx vitest run src/lib/publishing/canonical-id.test.ts`

Expected: PASS.

- [ ] **Step 5: Write failing handoff tests**

`buildHandoffMarkdown` must:

- reuse `canonicalId` (never call `generateObjectId` internally)
- **always** set `draft: true` and `privacyReviewed: false`
- have **no** `privacyAcknowledged` parameter — the checkbox is irrelevant to Copy/Download
- omit `legacyRssGuid`
- include `slug`, `previousSlugs: []`, `relationships: []`, `syndication: []`
- preserve body text after the second `---`

Tests must include: even if a caller hypothetically wanted reviewed flags, the function cannot emit `privacyReviewed: true`. Two builds with the same `canonicalId` produce the same `id:` line.

A detached export can be edited before a manual Git commit, so it must not carry the Prepare acknowledgement.

- [ ] **Step 6: Implement `handoff.ts` using the same YAML field order as the M8 handoff, plus `canonicalId`**

Use `JSON.stringify` for title/slug strings as today’s `yamlString()` does. Filename `${slug}.md`.

- [ ] **Step 7: Wire `drafting-room.ts`**

On M8 `src/scripts/drafting-room.ts`:

- Add optional `canonicalId?: string` to `Draft`.
- In `markdownHandoff`, set `draft.canonicalId = ensureCanonicalId(draft.canonicalId)` then call `buildHandoffMarkdown`.
- Do **not** call `generateObjectId()` in `markdownHandoff`.
- Keep notebook `id: crypto.randomUUID()` as the local list key.

Copy/Download keep working with the new builder. Do not pass acknowledgement into the handoff. Task 9 adds the Prepare checkbox separately.

- [ ] **Step 8: Run `npx vitest run src/lib/publishing/canonical-id.test.ts src/lib/publishing/handoff.test.ts src/core/authoring/generate-object-id.test.ts`**

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/lib/publishing/canonical-id.ts src/lib/publishing/canonical-id.test.ts \
  src/lib/publishing/handoff.ts src/lib/publishing/handoff.test.ts src/scripts/drafting-room.ts
git commit -m "$(cat <<'EOF'
fix(drafting): persist a UUIDv7 canonicalId across Markdown handoffs

EOF
)"
```

---

### Task 2: Align `legacyRssGuid` validation with PWC §8.5 (prerequisite)

**Files:**
- Modify: `src/core/storage/validate-canonical-ids.ts` (the `else if (isPublic)` branch that currently requires `legacyRssGuid` on every public Note)
- Modify: `src/core/storage/validate-canonical-ids.test.ts`
- Create: `src/adapters/feeds/rss.test.ts` already covers URN vs legacy; do not change `rssGuidForNote`

**Interfaces:**
- Consumes: existing `loadCanonicalIdentityRecords`, `rssGuidForNote`
- Produces: public Notes without `legacyRssGuid` are valid; present `legacyRssGuid` still validated and still forbidden on non-public Notes

- [ ] **Step 1: Write a failing unit test that documents the new rule**

Add to `validate-canonical-ids.test.ts` (pure function test of the rule, not a fake filesystem), **or** extract the legacy-guid check:

The current function reads the real content tree. Prefer extracting:

```ts
export function assertLegacyRssGuidRule(input: {
  isPublic: boolean;
  slug: string;
  previousSlugs: string[];
  legacyRssGuid?: string;
}): void
```

Tests:

```ts
it('allows a public note without legacyRssGuid (new notes use URN GUIDs)', () => {
  expect(() =>
    assertLegacyRssGuidRule({
      isPublic: true,
      slug: 'building-for-the-web-of-2030',
      previousSlugs: [],
    })
  ).not.toThrow();
});

it('still requires a karthikg.in notes URL when legacyRssGuid is present', () => {
  expect(() =>
    assertLegacyRssGuidRule({
      isPublic: true,
      slug: 'first-note-probably',
      previousSlugs: [],
      legacyRssGuid: 'https://example.com/nope',
    })
  ).toThrow(/legacyRssGuid/);
});

it('forbids legacyRssGuid on non-public notes', () => {
  expect(() =>
    assertLegacyRssGuidRule({
      isPublic: false,
      slug: 'wip',
      previousSlugs: [],
      legacyRssGuid: 'https://karthikg.in/notes/wip/',
    })
  ).toThrow(/only allowed on public notes/);
});
```

- [ ] **Step 2: Run the new test; expect FAIL** (helper missing or old throw still in place)

- [ ] **Step 3: Replace `else if (isPublic) { throw public note must include legacyRssGuid }` with “omit is allowed.”** Keep the `if (record.legacyRssGuid)` validations. Call `assertLegacyRssGuidRule` from `validateCanonicalIdentities`.

- [ ] **Step 4: Run** `npx vitest run src/core/storage/validate-canonical-ids.test.ts src/adapters/feeds/rss.test.ts`

Expected: PASS. `first-note-probably` still validates. A hypothetical new public Note without the field would pass.

- [ ] **Step 5: Commit**

```bash
git add src/core/storage/validate-canonical-ids.ts src/core/storage/validate-canonical-ids.test.ts
git commit -m "$(cat <<'EOF'
fix(notes): allow public notes to omit legacyRssGuid

EOF
)"
```

---

### Task 3: Note path and narrow markdown operations

**Files:**
- Create: `src/lib/publishing/note-path.ts`
- Create: `src/lib/publishing/note-path.test.ts`
- Create: `src/lib/publishing/note-markdown.ts`
- Create: `src/lib/publishing/note-markdown.test.ts`

**Interfaces:**
- Consumes: `contentSlugSchema` from `src/core/storage/slug-schema.ts`; `parseObjectIdV7`; `mapNote`; `noteRelationshipSchema`
- Produces:
  - `NOTES_DIR = 'src/content/notes'`
  - `noteRepoPath(slug: string): string` → `src/content/notes/${slug}.md`
  - `type CanonicalNoteFields` (id, slug, title, date, tags, presentation, summary?, relationships, body)
  - `serializePreparedNote(fields: CanonicalNoteFields): string` — **only** `draft: true` + `privacyReviewed: true`; omit `legacyRssGuid`; `previousSlugs: []`; `syndication: []`
  - `parseCanonicalNoteFile(raw: string): { fields: CanonicalNoteFields; draft: boolean; privacyReviewed: boolean; body: string }`
  - `publishCanonicalNote(raw: string): string` — verifies `privacyReviewed === true` and `draft === true`, then returns the same file with **only** `draft: false`; body bytes unchanged; does not set `privacyReviewed`

Do **not** export `serializeCanonicalNote(fields, gates)` or any helper that accepts arbitrary gate combinations. The invariant lives in the API names.

Do **not** add SHA-256 fingerprints here. Editorial dirty-state is a client snapshot in Task 9. Concurrency is Git blob SHA.

- [ ] **Step 1: Write path tests**

```ts
import { noteRepoPath } from './note-path.js';

it('builds a notes path from a valid slug', () => {
  expect(noteRepoPath('first-note-probably')).toBe('src/content/notes/first-note-probably.md');
});

it('rejects README', () => {
  expect(() => noteRepoPath('README')).toThrow(/reserved/i);
});

it('rejects traversal and extra segments', () => {
  expect(() => noteRepoPath('../projects/x')).toThrow();
  expect(() => noteRepoPath('a/b')).toThrow();
  expect(() => noteRepoPath('')).toThrow();
});
```

Implementation: parse slug with `contentSlugSchema`; if `slug === 'README'` throw; return `` `src/content/notes/${slug}.md` ``. Never concatenate unvalidated input.

- [ ] **Step 2: Implement `note-path.ts` and pass path tests**

- [ ] **Step 3: Write markdown tests covering `serializePreparedNote` → `mapNote` round trip, body preservation, and `publishCanonicalNote`**

Critical `publishCanonicalNote` cases:

- Input has `draft: true` and `privacyReviewed: true` → output `draft: false`, `privacyReviewed: true`, same body, same `id`, slug, relationships, syndication.
- Input has `privacyReviewed: false` → throw `/privacyReviewed/`.
- Input already `draft: false` + `privacyReviewed: true` → throw `/already public/`; the Publish route short-circuits before calling this helper.

`serializePreparedNote` must always contain `draft: true` and `privacyReviewed: true`. It must not accept gate arguments. After serialize, `mapNote` on parsed YAML must succeed.

Do not add fingerprint tests.

- [ ] **Step 4: Implement `note-markdown.ts`**

Parse with the same `---\n` split used in `validate-canonical-ids.ts` plus `yaml` parse. Serialize with a fixed key order matching the spec example in §6.2.

- [ ] **Step 5: Run** `npx vitest run src/lib/publishing/note-path.test.ts src/lib/publishing/note-markdown.test.ts src/core/storage/map-note.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/publishing/note-path.ts src/lib/publishing/note-path.test.ts \
  src/lib/publishing/note-markdown.ts src/lib/publishing/note-markdown.test.ts
git commit -m "$(cat <<'EOF'
feat(publishing): serialize canonical notes and restrict Git paths

EOF
)"
```

---

### Task 4: Prepare request validation (acknowledgement + forced gates)

**Files:**
- Create: `src/lib/publishing/prepare-request.ts`
- Create: `src/lib/publishing/prepare-request.test.ts`

**Interfaces:**
- Consumes: `ensureCanonicalId` / `parseObjectIdV7`, `contentSlugSchema`, `noteRelationshipSchema`, `serializePreparedNote`
- Produces:
  - `type PrepareRequest` — **no** `draft` or `privacyReviewed` properties
  - `parsePrepareRequest(input: unknown): ParsedPrepare`
  - `ParsedPrepare` includes `privacyAcknowledgement: true`, `canonicalId`, `slug`, `markdown` from `serializePreparedNote`

`parsePrepareRequest` must:

- Require `privacyAcknowledgement === true` (boolean, not string `"true"`).
- **Reject** if `draft` or `privacyReviewed` keys exist (`Publication flags are not accepted on Prepare.`).
- Reject other unknown keys when practical (allowlist of known fields).
- Require non-empty title.
- Require `date` as UTC `YYYY-MM-DD`; reject invalid dates.
- Body: `body.trim()` or fallback `sparks.trim()`; if both empty, 400 `Add a draft body.`
- Relationships: default `[]`; parse with `noteRelationshipSchema`. v1 allows `[]` or external reply/bookmark only.

Tests:

```ts
it('refuses without privacyAcknowledgement', () => {
  expect(() => parsePrepareRequest({ ...valid, privacyAcknowledgement: false })).toThrow(/Privacy acknowledgement/);
});

it('rejects draft or privacyReviewed if the client sends them', () => {
  expect(() => parsePrepareRequest({ ...valid, draft: false })).toThrow(/not accepted/);
  expect(() => parsePrepareRequest({ ...valid, privacyReviewed: true })).toThrow(/not accepted/);
});

it('serialized markdown is always unpublished and privacy-reviewed', () => {
  const parsed = parsePrepareRequest(valid);
  expect(parsed.markdown).toMatch(/^---[\s\S]*draft: true/m);
  expect(parsed.markdown).toMatch(/^privacyReviewed: true/m);
  expect(parsed.markdown).not.toMatch(/legacyRssGuid/);
});

it('rejects README slug', () => {
  expect(() => parsePrepareRequest({ ...valid, slug: 'README' })).toThrow(/reserved/i);
});
```

`valid` has UUIDv7 `canonicalId`, slug `building-for-the-web-of-2030`, title, date `2026-08-24`, body, empty tags, `presentation: 'note'`, `privacyAcknowledgement: true`. No gate fields.

- [ ] **Step 1: Write the failing tests**
- [ ] **Step 2: Run; expect FAIL**
- [ ] **Step 3: Implement `parsePrepareRequest`**
- [ ] **Step 4: Run** `npx vitest run src/lib/publishing/prepare-request.test.ts`
- [ ] **Step 5: Commit**

```bash
git add src/lib/publishing/prepare-request.ts src/lib/publishing/prepare-request.test.ts
git commit -m "$(cat <<'EOF'
feat(publishing): require privacy acknowledgement before canonical Markdown

EOF
)"
```

---

### Task 5: GitHub Contents client (notes only)

**Files:**
- Create: `src/lib/publishing/github-notes.ts`
- Create: `src/lib/publishing/github-notes.test.ts`

**Interfaces:**
- Consumes: `noteRepoPath(slug)`
- Produces:
  - `type GitHubNotesConfig { token: string; owner: string; repo: string; branch: string }`
  - `getNotesConfig(): GitHubNotesConfig | null` — from `GITHUB_NOTES_TOKEN`, optional `GITHUB_NOTES_OWNER` default `karthikg80`, `GITHUB_NOTES_REPO` default `personal-site`, branch default `main`
  - `getNoteFile(config, slug): Promise<{ sha: string; text: string } | null>`
  - `putNoteFile(config, input: { slug: string; text: string; message: string; sha?: string }): Promise<{ sha: string; commitSha: string }>`
  - `findNoteByObjectId(config, objectId: string): Promise<{ slug: string; sha: string; text: string } | null>`
  - `recoverNoteFile(config, input: { objectId: string; slug?: string }): Promise<... | null>`

HTTP: `fetch('https://api.github.com/repos/{owner}/{repo}/contents/{path}?ref={branch}')`.

PUT body: `{ message, content: base64(utf8 text), branch, sha? }`. `content` is the full Markdown file, base64, no wrapping newlines.

`recoverNoteFile` (common path):

1. If `slug` is present, `getNoteFile(slug)`. If found and frontmatter `id` matches `objectId` → return it. If found and id mismatches → not a recovery match (null or 409 at a higher layer).
2. **Only if slug is missing**, call `findNoteByObjectId` (directory list + fetch). Do not scan on every retry when the client still has the slug.

`findNoteByObjectId` remains available but is not the default recovery path.

Tests with a fake `fetch`:

- `getNoteFile` 404 → `null`
- `getNoteFile` 200 → decode base64 content + sha
- `putNoteFile` uses `noteRepoPath`; never send a path the test did not derive from slug
- **do not export a generic `putRepoFile(path)`**
- `recoverNoteFile` with slug does **not** GET the directory
- `recoverNoteFile` without slug falls back to scan

Never log `token` or file body. Errors: throw typed `GitHubNotesError` with status.

- [ ] **Step 1: Write failing tests with `vi.stubGlobal('fetch', …)`**
- [ ] **Step 2: Implement client**
- [ ] **Step 3: Run** `npx vitest run src/lib/publishing/github-notes.test.ts`
- [ ] **Step 4: Commit**

```bash
git add src/lib/publishing/github-notes.ts src/lib/publishing/github-notes.test.ts
git commit -m "$(cat <<'EOF'
feat(publishing): add path-limited GitHub Contents access for notes

EOF
)"
```

---

### Task 6: Prepare API route

**Files:**
- Create: `src/pages/api/drafting/prepare.ts`
- Create: `src/lib/publishing/prepare-flow.ts`
- Create: `src/lib/publishing/prepare-flow.test.ts`

**Interfaces:**
- Consumes: `verifyDraftingSession`, `isAllowedDraftingOrigin`, `isDraftingConfigured`, `draftingSession` from `src/lib/drafting-auth.ts`; `parsePrepareRequest`; GitHub helpers; `parseCanonicalNoteFile`
- Produces: `executePrepare(input): Promise<PrepareResult>` used by the route so tests do not boot Astro

`executePrepare` algorithm (spec §14):

1. Parse request (acknowledgement + `serializePreparedNote`). Gate keys already rejected.
2. If `getNotesConfig()` is null → `{ ok: false, status: 503, error: 'Publication is not configured.' }` — **not** 200. Tests assert the client-facing status is 503.
3. `existing = await getNoteFile(config, slug)`
4. If existing:
   - parse; if `id !== canonicalId` → 409 slug collision
   - if `draft === false` → 409 cannot overwrite a Note that is not unpublished (`Prepare cannot modify a published Note.`)
   - if `draft === true` and same ObjectId: **allowed**, including upgrading `privacyReviewed: false` (manual Copy/Download commit) to `privacyReviewed: true`
   - if file bytes equal `parsed.markdown` → `{ ok: true, created: false, slug, objectId, blobSha: existing.sha }` no PUT
   - else PUT with `sha: existing.sha`, message `draft(note): prepare ${slug}`
5. If missing: PUT create without sha. On 422, GET and retry as update once.
6. Return `{ ok: true, slug, objectId, blobSha, commitSha, url: https://karthikg.in/notes/${slug}/ }`

Do not return a fingerprint. Do not include serialized markdown in the success JSON (the client already has the working copy; Git SHA is enough).

Route (`prepare.ts`): copy JSON/`Cache-Control: no-store` pattern from `src/pages/api/drafting/agent.ts`.

Auth:

- If `!isDraftingConfigured()` → 404 `{ error: 'Not found.' }`
- **Do not** use `isLocalDraftingBypass()`.
- Session via `verifyDraftingSession(cookie)`.
- Origin via `isAllowedDraftingOrigin`.
- `prerender = false`

Log: `console.info('drafting prepare', { slug, objectId, result })` — not body, not token.

- [ ] **Step 1: Write `prepare-flow.test.ts` with in-memory fake GitHub** covering: create; identical update no commit; body change updates; **upgrade unpublished `privacyReviewed: false` to `true`**; slug collision; reject `draft: false` target; missing token → 503
- [ ] **Step 2: Implement `executePrepare` + thin route**
- [ ] **Step 3: Run** `npx vitest run src/lib/publishing/prepare-flow.test.ts src/lib/publishing/prepare-request.test.ts`
- [ ] **Step 4: Commit**

```bash
git add src/lib/publishing/prepare-flow.ts src/lib/publishing/prepare-flow.test.ts \
  src/pages/api/drafting/prepare.ts
git commit -m "$(cat <<'EOF'
feat(drafting): add Prepare endpoint that commits privacy-reviewed unpublished notes

EOF
)"
```

---

### Task 7: Canonical lookup + Publish flow

**Files:**
- Create: `src/lib/publishing/publish-request.ts`
- Create: `src/lib/publishing/publish-request.test.ts`
- Create: `src/lib/publishing/publish-flow.ts`
- Create: `src/lib/publishing/publish-flow.test.ts`
- Create: `src/pages/api/drafting/publish.ts`
- Create: `src/pages/api/drafting/canonical.ts`

**Interfaces:**
- Consumes: `parseObjectIdV7`, `noteRepoPath`, `parseCanonicalNoteFile`, `publishCanonicalNote`, GitHub client
- Produces:
  - `parsePublishRequest(input: unknown): { objectId: string; slug: string; expectedBlobSha: string }`
  - `executePublish(...)`
  - `executeCanonicalLookup(objectId: string, slug?: string)`

`parsePublishRequest`: require objectId (v7), slug (path schema, not README), expectedBlobSha (non-empty git sha hex). **Reject** if `privacyAcknowledgement` is present. Reject unknown keys when practical (allowlist those three fields). Privacy acknowledgement belongs only to Prepare.

`executePublish`:

1. GET file; 404 → 404
2. If `sha !== expectedBlobSha` → 409 stale
3. Parse; if `id !== objectId` or slug mismatch → 409
4. If `privacyReviewed !== true` → 409 `This canonical Note is not privacy-reviewed.`
5. If `draft === false` && `privacyReviewed === true` → 200 idempotent, no PUT
6. Else `text = publishCanonicalNote(raw)`; PUT message `publish(note): ${slug}` with expected sha
7. Return `{ ok: true, slug, objectId, blobSha, url }`

`executeCanonicalLookup`: call `recoverNoteFile` (slug first). Return `{ id, slug, draft, privacyReviewed, sha, url }` or 404.

GET canonical: `id` required; `slug` optional query param.

GET canonical route: session required; **do not** call `isAllowedDraftingOrigin`. 404 if drafting unconfigured. Query: `id` required, `slug` optional.

Publish/Prepare POSTs: configured + session + origin + no local bypass.

- [ ] **Step 1: Tests for parse + executePublish** (stale sha, unreviewed refuse, idempotent public, happy path only flips draft in the PUT body)
- [ ] **Step 2: Implement helpers and routes**
- [ ] **Step 3: Assert a unit test that the PUT text still contains `privacyReviewed: true` and `draft: false` and the original body paragraph. Assert `parsePublishRequest({ ...valid, privacyAcknowledgement: true })` throws.**
- [ ] **Step 4: Run** `npx vitest run src/lib/publishing/publish-request.test.ts src/lib/publishing/publish-flow.test.ts`
- [ ] **Step 5: Commit**

```bash
git add src/lib/publishing/publish-request.ts src/lib/publishing/publish-request.test.ts \
  src/lib/publishing/publish-flow.ts src/lib/publishing/publish-flow.test.ts \
  src/pages/api/drafting/publish.ts src/pages/api/drafting/canonical.ts
git commit -m "$(cat <<'EOF'
feat(drafting): add Publish (draft only) and canonical ObjectId lookup

EOF
)"
```

---

### Task 8A: Rendering feasibility spike (stop/go)

**This is a gate, not an implementation assumption.** Astro’s content renderer is tied to content entries and build processing. There may be no supported API that accepts arbitrary Markdown from GitHub and produces the same HTML as `render(entry)`.

**Prove, then stop if you cannot:**

```text
GitHub Markdown body
       ↓
candidate renderer
       ↓
same body HTML as Astro render(entry)
```

**Files (spike only):**
- Create: `src/lib/publishing/note-body-html.test.ts`
- Create: `src/lib/publishing/note-body-html.ts` only if a **non-invasive** candidate exists

**Hard rules:**
- Do not add `marked`, `markdown-it`, or any second Markdown engine.
- Do **not** restructure the production rendering path (`[...slug].astro` / `render(entry)`) just to make review convenient.
- If the only way to achieve perfect body-HTML parity is an invasive change to existing Note rendering, **stop**. Do not pull that change into this workflow. Revisit review architecture (iframe of a private preview, build-time artifact, or a later Astro API) in a new design pass.

**Spike procedure:**
1. Identify what `render(entry)` uses for `.md` bodies (likely `@astrojs/markdown-remark` / content-layer default). `astro.config.mjs` has no custom `markdown` config.
2. Attempt the smallest candidate that applies those semantics to a raw Markdown string.
3. Compare against `render(entry)` for `src/content/notes/first-note-probably.md` (or a saved production HTML fixture from `npm run build`). Normalize only insignificant whitespace if the harness requires it. Do not weaken to “looks similar.”
4. If the test cannot pass without invasive production changes, commit nothing for Task 8, report the blocker, and skip Task 8B.

- [ ] **Step 1: Write the failing parity test**
- [ ] **Step 2: Try a non-invasive candidate; make the test pass or stop**
- [ ] **Step 3: If pass, proceed to Task 8B. If fail, checkpoint and do not implement the review route**

Do not commit a divergent renderer.

---

### Task 8B: Authenticated canonical review route (only after 8A passes)

**Files:**
- Create: `src/lib/publishing/review-note.ts`
- Create: `src/lib/publishing/review-note.test.ts`
- Create: `src/pages/drafting/review/[slug].astro`
- Modify: `src/layouts/NoteLayout.astro` only to add `showWebmentions?: boolean` (default true)
- Keep: `note-body-html.ts` from 8A

**Interfaces:**
- Consumes: drafting auth (same session as `src/pages/drafting.astro`; **no Origin requirement**), `getNoteFile`, `parseCanonicalNoteFile`, `mapNote`, `noteRepoPath`, the 8A helper
- Produces: SSR page at `/drafting/review/<slug>` whose body HTML matches published Note rendering

Other route behavior from spec §15:

- `export const prerender = false`
- If drafting unconfigured → 404 like `/drafting`
- If session invalid → 404 (do not leak that the slug exists)
- Load GitHub file; 404 if missing
- Verify frontmatter slug matches param
- Headers: `no-store`, `X-Robots-Tag: noindex, nofollow, noarchive`
- Chrome: Unpublished · Privacy-reviewed (this Git revision), future URL, Publish (no privacy checkbox). If `privacyReviewed !== true`, hide Publish.
- `showWebmentions={false}`
- Not in sitemap

Optional later: point published `[...slug].astro` at the same helper **only if** the parity test stays green and public HTML does not change. Not required for v1.

- [ ] **Step 1: Implement `review-note.ts` + the Astro page**
- [ ] **Step 2: `npx vitest run src/lib/publishing/note-body-html.test.ts src/lib/publishing/review-note.test.ts` and `npm run check`**
- [ ] **Step 3: Commit**

```bash
git add src/lib/publishing/note-body-html.ts src/lib/publishing/note-body-html.test.ts \
  src/lib/publishing/review-note.ts src/lib/publishing/review-note.test.ts \
  src/pages/drafting/review/\[slug\].astro src/layouts/NoteLayout.astro
git commit -m "$(cat <<'EOF'
feat(drafting): review canonical Git notes with production Markdown rendering

EOF
)"
```

---

### Task 9: Drafting Room states and Prepare UX

**Files:**
- Modify: `src/pages/drafting.astro` (review stage: acknowledgement checkbox, Prepare/Update buttons, status, link to review route)
- Modify: `src/scripts/drafting-room.ts` (linkage fields, dirty snapshot, Prepare/Publish fetches)

**Interfaces:**
- Consumes: `ensureCanonicalId`, `buildHandoffMarkdown`
- Produces: UI states in spec §3, including dirty working copy vs still-reviewed Git revision

Client `Draft` additive fields (notebook v1 stays `version: 1`):

```ts
canonicalId?: string;
slug?: string;
blobSha?: string;
commitSha?: string;
preparedAt?: string;
publishedAt?: string;
lastPreparedSnapshot?: {
  title: string;
  date: string;
  tags: string[];
  presentation: string;
  summary: string;
  body: string;
  relationships: unknown[];
};
privacyAcknowledged?: boolean;
```

Dirty detection: deep-equal current editorial fields to `lastPreparedSnapshot`. **Not** a cryptographic fingerprint, **not** returned by the server, **not** used as concurrency (Git `blobSha` is).

Behavior:

- Assign `canonicalId` on first Prepare **or** first Copy/Download (`ensureCanonicalId`). **Do not** set `preparedAt` or `blobSha` on Copy/Download.
- “Canonical draft prepared” UI requires `preparedAt` (or `blobSha`) from a successful Prepare. `canonicalId` alone is still a working draft.
- Slug input: default `slugify(title)`; editable until `preparedAt`; then locked.
- Privacy checkbox: required to enable Prepare. When the working copy diverges from `lastPreparedSnapshot`, uncheck it and show:

```text
Canonical draft: Privacy reviewed
Working copy: Changed since Prepare — not reviewed
```

Do not imply the Git object lost `privacyReviewed`.

- `POST /api/drafting/prepare` with editorial fields + `privacyAcknowledgement: true` only (no gate fields).
- On success, store linkage + snapshot; show prepared state + link `/drafting/review/${slug}`.
- After `publishedAt` or lookup showing `draft: false`, disable Prepare.
- Copy/Download: `buildHandoffMarkdown` **always** closed gates; optional status: “Exported with publication disabled. Do not treat this file as privacy-reviewed.”
- Publish stays on the review page: `POST /api/drafting/publish` with `{ objectId, slug, expectedBlobSha }` only.
- Missing token: show the 503 error. Do not treat validation-only as Prepared.

- [ ] **Step 1: Add review-stage markup: acknowledgement checkbox, canonical vs working-copy status, Prepare/Update**
- [ ] **Step 2: Implement client state + Prepare fetch; disable Prepare while checkbox off or working copy dirty without acknowledgement**
- [ ] **Step 3: On the review page, implement Publish fetch; on 409 stale, reload**
- [ ] **Step 4: Smoke `npm run dev`: checkbox off → Prepare disabled; Copy still `privacyReviewed: false`; no GitHub token → 503, UI does not show Prepared**
- [ ] **Step 5: Commit**

```bash
git add src/pages/drafting.astro src/scripts/drafting-room.ts src/pages/drafting/review/\[slug\].astro
git commit -m "$(cat <<'EOF'
feat(drafting): prepare unpublished canonical notes after privacy acknowledgement

EOF
)"
```

---

### Task 10: Docs, env, editorial contract

**Files:**
- Modify: `.env.example`
- Modify: `docs/editorial-and-privacy.md` publication sequence
- Modify: `README.md` Drafting Room + “Draft or publish a Workbench Note” (the M8 README on origin/main)
- Modify: `docs/workbench-note-template.md` only if it still says both flags stay false at Git entry — Git entry is now `privacyReviewed: true` after Prepare

**Interfaces:** none.

`.env.example` add:

```
# Server-only. Fine-grained PAT, Contents R/W, this repo only. Never expose to the browser.
GITHUB_NOTES_TOKEN=
GITHUB_NOTES_OWNER=karthikg80
GITHUB_NOTES_REPO=personal-site
```

Editorial sequence becomes:

1. Draft in the room.
2. Review the exact publication-bound text.
3. Check privacy acknowledgement (safe for the public repository).
4. Prepare → Git `draft: true`, `privacyReviewed: true`.
5. Review `/drafting/review/<slug>`.
6. Publish → `draft: false`.
7. Confirm public URL.
8. Optional CLI webmentions / POSSE.

State that Copy/Download always emits `privacyReviewed: false` and must not be committed as a reviewed canonical Note. Ordinary publishing is Prepare, not paste.

- [ ] **Step 1: Update the three doc files and `.env.example`**
- [ ] **Step 2: Run full** `npm test && npm run check`
- [ ] **Step 3: Commit**

```bash
git add .env.example docs/editorial-and-privacy.md README.md docs/workbench-note-template.md
git commit -m "$(cat <<'EOF'
docs: describe privacy-before-Git Prepare and draft-only Publish

EOF
)"
```

---

### Task 11: Editorial state-transition integration test

**Files:**
- Create: `src/lib/publishing/editorial-transition.integration.test.ts`

**Interfaces:**
- Consumes: `parsePrepareRequest`, `serializePreparedNote` (via parse), `publishCanonicalNote`, `mapNote`, `isPublicNote` / `derivePublicationState`, `getPublishedNotes` **or** the same publication predicate used by storage (`isPublicNote` on mapped notes)
- Produces: one test that the Personal Web Core boundary matches the product workflow

Do **not** call live GitHub. Use in-memory markdown strings.

The test must encode:

```text
Prepare succeeds
    ↓
Git file = draft:true + privacyReviewed:true
    ↓
publication predicate excludes it (not public)
    ↓
Publish flips only draft
    ↓
same ObjectId
same slug
same body
same relationships
same syndication
same privacyReviewed
    ↓
publication predicate includes it (public)
```

Concrete assertions after Prepare parse/serialize:

- `mapNote(...).publication === 'draft'`
- `isPublicNote(note) === false`

After `publishCanonicalNote`:

- `draft === false`, `privacyReviewed === true`
- `id`, `slug`, `body`, `relationships`, `syndication` unchanged
- `mapNote(...).publication === 'public'`
- `isPublicNote(note) === true`

Also assert Copy/Download (`buildHandoffMarkdown`) on the same editorial fields is `privacyReviewed: false` even after a successful Prepare acknowledgement would have been given.

- [ ] **Step 1: Write the failing integration test**
- [ ] **Step 2: Run** `npx vitest run src/lib/publishing/editorial-transition.integration.test.ts` — FAIL until helpers exist; after Tasks 1–7 it must PASS
- [ ] **Step 3: Commit** (with the last implementation commit if helpers already exist, or as its own commit when green)

```bash
git add src/lib/publishing/editorial-transition.integration.test.ts
git commit -m "$(cat <<'EOF'
test(publishing): prove Prepare stays unpublished and Publish flips only draft

EOF
)"
```

If this test is written early, keep it skipped until Task 3 serializers exist, then unskip. Prefer writing it immediately after Task 3 so it guides later tasks.

---

## Verification (after all tasks)

Run:

```sh
npm test
npm run check
npm run build
```

Expected: tests pass; `validateCanonicalIdentities` still accepts current production notes; first-note-probably unchanged; no `legacyRssGuid` in serialized **new** notes; agent API files unmodified except if you must share a tiny JSON helper (prefer not).

### astro check baseline (do not clean in this PR)

`origin/main` at `1c75ef9` (2026-08-24) is already red. This branch must not add **errors** relative to that snapshot. Compare by file + `ts(code)` + message, not by file count (`astro check` scans more files on this branch).

Captured on a clean `origin/main` worktree vs this branch after the GitHub fetch-mock typing fix:

| | `origin/main` `1c75ef9` | this branch |
| --- | --- | --- |
| Errors | 8 | 8 (same set) |
| Hints | 5 | 6 |

**Errors present on `origin/main` (out of scope):**

- `astro.config.mjs:11` `ts(2322)` — empty `slugRedirects` vs `Record<string, RedirectConfig>`
- `src/adapters/webmention/discovery.test.ts:68` `ts(2352)` — `fetchMock.mock.calls[0] as [string, RequestInit]`
- `src/core/domain/ids.test.ts:39,40,47` `ts(2322)` — string vs branded `ObjectId` (four diagnostics)
- `src/core/storage/slug-schema.ts:36,37` `ts(2339)` — `slug` / `previousSlugs` on a generic Zod shape

**Hints present on `origin/main`:** unused `legacyRssGuidCount` in `scripts/migrate-assign-ids.ts`; Zod `.url()` / `.uuid()` deprecations in `src/content.config.ts` and `note-relationship-schema.ts`; unused `z` import in `slug-schema.test.ts`.

**Hint introduced by this branch (false positive, not an error):** `src/pages/drafting/review/[slug].astro` `ts(6133)` unused `notFound`. The function is used by frontmatter early `return notFound()`; Astro’s checker does not count those. Do not rename or inline it just to silence the hint.

Manual (production-like):

1. Configure drafting secrets + `GITHUB_NOTES_TOKEN` locally or on Vercel preview **only after** Task 6+.
2. Prepare without checkbox → no commit.
3. Prepare with checkbox → file on `main` with `draft: true`, `privacyReviewed: true`.
4. Public `/notes/<slug>/` still 404.
5. `/drafting/review/<slug>` shows the Note.
6. Edit body: Git still “Privacy reviewed”; working copy “Changed since Prepare — not reviewed”; Update requires acknowledgement.
7. Publish → `draft: false`; after deploy, public URL works.
8. `npm run posse:bluesky` still refuses until both flags are open (already true).

---

## Spec coverage

| Spec area | Task |
| --- | --- |
| Stable ObjectId / closed handoff | 1 |
| `legacyRssGuid` prerequisite | 2 |
| Path allowlist; `serializePreparedNote` / `publishCanonicalNote` | 3 |
| Prepare payload with no gate fields | 4, 6 |
| GitHub Contents; slug-first recovery | 5, 7 |
| Collision / idempotency / blob SHA | 6, 7 |
| Canonical lookup | 7 |
| Publish `draft` only; reject privacy acknowledgement | 7 |
| Review with production Markdown pipeline | 8 |
| UX: dirty working copy vs reviewed Git revision | 9 |
| Docs / env / closed Copy-Download | 10 |
| End-to-end editorial transition | 11 |
| Agent cannot publish | 6–7 (no agent changes); 9 (no agent buttons) |
| 503 when token missing | 6, 9 |
| No unpublish UI / no POSSE on Publish | 10 + Publish flow |
