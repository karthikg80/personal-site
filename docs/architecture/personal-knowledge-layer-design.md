# Personal Knowledge Layer — Design Specification

**Status:** Design only — not approved for implementation  
**Builds on:** [`personal-web-core-design.md`](./personal-web-core-design.md) (M1–M8 complete)  
**Repository baseline:** post-merge `main` after Personal Web Core (Astro 7.2.4, Git Markdown collections, no runtime DB)  
**Constraint for this document:** specification only; no production code; no implementation plan.

---

## 1. Executive summary

Personal Web Core made `karthikg.in` a durable personal site with stable identity (`ObjectId`), first-party Project pages, protocol-neutral `Relationship` edges for `reply-to` / `bookmark-of`, and URL continuity via `previousSlugs`.

The **Personal Knowledge Layer (PKL)** asks a narrower question:

> Can the site express how writing, projects, ideas, and external sources relate—while remaining a calm, human-readable personal website?

After auditing the committed corpus, the answer is:

**The architecture is ready. The corpus is not.**

There is currently **one** published Note, **zero** authored `relationships[]` edges, **zero** Markdown links between Notes/Projects, and only soft prose hints of product lineage (especially Homebase ↔ studio apps). Tag overlap among Projects is real but is categorization, not authored meaning.

Therefore this specification:

1. Records the content audit honestly.
2. Proposes a **small, evidence-shaped vocabulary** for when real writing appears (`about`, optionally later `builds-on`).
3. Rejects premature types (`related-to`, `references`, `supersedes`, `part-of` as first-wave edges).
4. Recommends **waiting for content** before implementing PKL code.

**Recommendation: B** — core ready; wait for more content before implementing semantic relationships. See §25–§26.

---

## 2. Current post-M8 architecture relevant to knowledge relationships

### 2.1 Domain already present

| Concept | State |
| --- | --- |
| `Person`, `Note`, `Project` | Operational |
| `ObjectId` | Required on all content objects |
| `slug` / `previousSlugs` | Operational; redirects 308 |
| `Relationship` | Shape operational; types = `reply-to` \| `bookmark-of` only |
| Internal target `{ kind: 'internal', id, expectedKind? }` | Schema/mapper support exists; **unused in content** |
| External target `{ kind: 'external', url }` | Used by reply/bookmark projections (no production instances yet) |
| `Note.relationships[]` | Canonical storage; production Notes use `[]` |
| `Project.relationships` | **Does not exist** on domain Project |
| Topics/tags | Separate from relationships |

### 2.2 Dependency direction (locked)

```text
domain (protocol-neutral)
  ↑
storage / resolution
  ↑
presentation / routing / Webmention / feeds / POSSE adapters
```

Domain must not learn routes, microformats, Webmention, schema.org, or Astro.

### 2.3 What PKL would add (conceptually)

Not a graph database. Not RDF. An authored edge vocabulary plus:

```text
resolve ObjectId → current object + location (adapters)
query incoming edges at build time (storage)
restrained human UI on Note/Project pages (presentation)
integrity checks in CI/build
```

---

## 3. Actual content relationship inventory

### 3.1 Corpus size

| Kind | Files | Published | Notes |
| --- | --- | --- | --- |
| Notes | 2 | 1 | `first-note-probably` public; `README` draft/docs-only |
| Projects | 5 | 5 | Neighborbook, Homebase, Thea Kitchen, Pantry Mojo, Sai Parayan Tracker |

### 3.2 Explicit relationships

| Source | Field | Value |
| --- | --- | --- |
| All Notes | `relationships` | `[]` |
| All Projects | n/a | no relationships field |
| Production | `reply-to` / `bookmark-of` | **none** |

### 3.3 Inventory table (implicit / prose / links)

| Source | Target | Current expression | Possible semantic relationship | Confidence |
| --- | --- | --- | --- | --- |
| Note `first-note-probably` | (generic) projects on the site | Prose: “The projects are still here.” | none — not about a specific Project | n/a — reject as edge |
| Note `first-note-probably` | this site / personal writing practice | Whole note is about starting the notebook | could later be `about` a future “site” Project — **no such Project exists** | low / speculative |
| Note `first-note-probably` | any external URL | no Markdown links; no bare URLs in body | none | — |
| Note `README` | authoring process | docs text; not published | none (not a public Note) | — |
| Project Homebase | “smaller apps” / studio collection | description + body prose | soft product lineage / platform role — **not typed today** | medium as *future* `builds-on` **or** editorial prose only |
| Project Neighborbook | Homebase | shared stack tags (`Next.js`, `Supabase`); no prose link | tag overlap ≠ relationship | reject |
| Project Neighborbook | Sai Parayan Tracker | shared tag `Communities` | tag overlap ≠ relationship | reject |
| Project Thea Kitchen | Neighborbook | shared tag `Privacy` | tag overlap ≠ relationship | reject |
| Now page | Neighborbook / Sai Parayan / Homebase | links to **external product URLs**, not `/projects/<slug>/` | page navigation / status — not content-graph edges | reject for PKL |
| About / Resume | Homebase | prose mentions | first-party page copy — not Note/Project edges | reject for PKL |
| Project `links[]` | external live apps | `links[{kind:live,url}]` | product location, not semantic Relationship | already modeled as `ProjectLink` |

### 3.4 Distinctions applied

**Explicit semantic relationship:** authored assertion in `relationships[]` (or a deliberate future equivalent). **Count today: 0.**

**Two objects share a topic:** Project tag overlaps (`Next.js`, `Supabase`, `Privacy`, `Communities`). Useful for browsing; **not** graph edges.

**Ordinary hyperlink:** almost none between first-party objects in Markdown bodies. Now/About link to external product hosts.

**Intellectual plausibility ≠ evidence:** Homebase “sits above” smaller apps is true product language, but encoding `Homebase → builds-on → Neighborbook` (or the reverse) without an authored editorial decision would invent meaning.

---

## 4. Evidence for / against implementing PKL now

### For (architecture readiness)

- `Relationship` + internal `ObjectId` targets already exist from Personal Web Core.
- Project detail pages exist (`/projects/<slug>/`) and can host restrained “Writing about this project” UI later.
- Note layout already has a **context** pattern for reply/bookmark (“In reply to…”, “Bookmarked…”).
- Build-time scanning of ≤10 objects (and even ≤1,000) is trivial.

### Against (content readiness)

- One published Note; it does not discuss any named Project.
- No Note→Note lineage to express.
- No reply/bookmark instances to extend.
- No internal Markdown link graph to “upgrade.”
- Implementing UI/query/validation now either ships **empty chrome** or pressures fake edges.

### Verdict

Architecture can wait. Content should lead. See recommendation **B**.

---

## 5. Proposed relationship vocabulary (when content justifies it)

Keep a **single shared** `Relationship` value object for Notes (and only add Project-authored edges if evidence later requires them).

### Accepted for future PKL-1 (when first real examples exist)

| Type | Priority | Why |
| --- | --- | --- |
| `reply-to` | already shipped | IndieWeb reply semantics |
| `bookmark-of` | already shipped | IndieWeb bookmark semantics |
| `about` | first new type | Clear human meaning; strongest Project↔Note bridge |
| `builds-on` | second new type | Clear lineage meaning; only when writing shows extension |

### Not accepted in first wave

`related-to`, `references`, `supersedes`, `part-of`, `documented-by` (as stored reverse), `mentions`, `tag`, quotes, etc. — see §6.

---

## 6. Rejected / deferred relationship types

| Type | Decision | Why |
| --- | --- | --- |
| `related-to` | **Defer indefinitely** unless a concrete counterexample appears | Dumping ground; weaker than tags + prose; no corpus need |
| `references` | **Defer** | Ordinary Markdown links already express citation; no distinct behavior identified (UI/Webmention/kind) that requires a typed edge |
| `supersedes` | **Defer** | No revised/replaced Notes exist; premature |
| `part-of` | **Defer** | Containment ≠ discussion; a Note *about* Neighborbook is not structurally part of Neighborbook; Homebase “platform” role is better left as prose until a clear containment model is needed |
| `documented-by` | **Do not store** | Inverse of `about`; derive at query time |
| `continued-in` | **Do not store** | Inverse of `builds-on`; derive at query time |
| Auto edges from tags | **Never** | Topics ≠ relationships |
| Auto edges from Markdown links | **Not in PKL-1** | Ordinary backlinks are a possible later layer (§10) |

---

## 7. Precise semantics for accepted types

### 7.1 `reply-to` (existing)

1. **Meaning:** This Note is a reply to the target.
2. **Sources:** Note
3. **Targets:** external URL (current behavior); internal Note allowed by schema but unused — keep allowed if needed later
4. **Direction:** stored outbound on Note
5. **Inverse UI:** none required today
6. **External targets:** yes (primary)
7. **Example:** reply to someone’s post URL
8. **Counterexample:** casually linking an article in the body without reply intent
9. **Projections:** `deriveNoteKind` → `reply`; `u-in-reply-to`; outbound Webmention eligible

### 7.2 `bookmark-of` (existing)

1. **Meaning:** This Note bookmarks the target as a saved resource worth keeping.
2. **Sources:** Note
3. **Targets:** external URL (primary)
4. **Direction:** outbound on Note
5. **Inverse UI:** none required today
6. **External targets:** yes
7. **Example:** bookmark Note pointing at an essay
8. **Counterexample:** a passing Markdown link inside a longer essay Note
9. **Projections:** kind `bookmark`; `u-bookmark-of`; outbound Webmention eligible

### 7.3 `about` (proposed — first new type)

1. **Meaning:** The source **substantially discusses or documents** the target. The target is a primary subject of the source, not a passing mention.
2. **Sources:** Note (initially)
3. **Targets:** Project (primary); possibly Note later if a meta-note is substantially about another Note
4. **Direction:** store Note → target; derive Project “Writing about this project”
5. **Inverse UI:** yes, on Project pages
6. **External targets:** **no** for v1 (use Markdown links / later `references` if ever justified)
7. **Example:** a Note titled “Why I built Neighborbook” targeting Neighborbook’s `ObjectId`
8. **Counterexample:** “The projects are still here” in `first-note-probably`; listing Projects in a roundup; shared tags; Now-page status links
9. **Projections:** presentation context on Note; incoming list on Project; **not** Webmention by default; **not** note-kind change

### 7.4 `builds-on` (proposed — second new type)

1. **Meaning:** The source **meaningfully extends** an earlier idea or work. Intellectual or product lineage, not mere similarity.
2. **Sources:** Note (primary); Project only if future content clearly requires Project→Project lineage
3. **Targets:** Note (primary); Project→Project deferred until authored need
4. **Direction:** store newer → older; derive “Continued in” on the older Note
5. **Inverse UI:** yes, on Note pages
6. **External targets:** no for v1
7. **Example:** Note B develops a question opened in Note A
8. **Counterexample:** two Notes that share topic `personal web`; Homebase and Neighborbook sharing Supabase without an authored lineage claim
9. **Projections:** presentation lineage; **not** Webmention; **not** note-kind change

---

## 8. Source / target compatibility matrix

| Type | Note→Note | Note→Project | Project→Note | Project→Project | Note→external | Project→external |
| --- | --- | --- | --- | --- | --- | --- |
| `reply-to` | allowed (unused) | no | no | no | **yes** | no |
| `bookmark-of` | no* | no | no | no | **yes** | no |
| `about` | maybe later | **yes (primary)** | no (derive inverse) | no | no (v1) | no |
| `builds-on` | **yes (primary)** | deferred | no | deferred | no | no |

\* Bookmarking an internal Note is not a current product need; keep out of v1.

Project as **author** of `relationships[]`: **not required** for PKL-1 if incoming `about` discovery is enough (§11).

---

## 9. Internal ObjectId resolution model

### 9.1 Canonical storage

```yaml
relationships:
  - type: about
    target:
      kind: internal
      id: 01a03192-07d8-729c-8080-fcafaf73f46d
      expectedKind: project
```

Targets are **ObjectId**, never slug/URL/filename/title.

### 9.2 Resolution ownership

| Layer | Responsibility |
| --- | --- |
| Domain | holds `Relationship` with `ObjectId` |
| Storage | `getObjectById`, load Notes/Projects, validate IDs exist |
| Presentation / routing adapters | map object → current path/URL (`/notes/<slug>/`, `/projects/<slug>/`) |
| Domain | **must not** construct paths |

### 9.3 Resolution moments

At **build time** (static generation):

1. Load all Notes/Projects into memory.
2. Index by `ObjectId`.
3. For each relationship target, resolve to domain object + adapter path.
4. Fail build on missing/mismatched targets (§13).

No runtime graph service.

---

## 10. Incoming / reverse relationship derivation

**Store one direction. Derive the inverse.**

| Stored edge | Derived UI |
| --- | --- |
| `Note → about → Project` | Project: “Writing about this project” |
| `Note B → builds-on → Note A` | Note A: “Continued in” / similar calm copy |
| `Note → reply-to / bookmark-of → URL` | existing Note context only |

Authors must not maintain `documented-by` or `continued-in` fields.

---

## 11. Should Project gain `relationships[]`?

### Evidence

- No Project currently needs to assert edges.
- The highest-value Project UI (“Writing about this…”) is **incoming** from Notes.
- Homebase’s platform role is currently prose; encoding Project→Project edges now would be speculative.

### Decision

**Do not add `Project.relationships[]` in PKL-1.**

Revisit only if a Project must author an edge that cannot be expressed as Note→Project / Note→Note (e.g., explicit Project lineage that Notes cannot carry).

---

## 12. Storage / frontmatter examples

### Empty (current production)

```yaml
relationships: []
```

### Future: Note about a Project

```yaml
relationships:
  - type: about
    target:
      kind: internal
      id: 01a03192-07d8-729c-8080-fcafaf73f46d
      expectedKind: project
```

### Future: Note builds on earlier Note

```yaml
relationships:
  - type: builds-on
    target:
      kind: internal
      id: 01a03192-07d5-76ce-8aa7-6a9dd5f9a4d5
      expectedKind: note
```

### Existing: reply / bookmark (unchanged)

```yaml
relationships:
  - type: reply-to
    target:
      kind: external
      url: https://example.com/post
```

Authors maintain **one** representation — never dual legacy fields.

---

## 13. Integrity-validation rules (when implemented)

| Rule | Action |
| --- | --- |
| Internal `id` missing | fail build/CI |
| `expectedKind` mismatches actual object kind | fail |
| Self `about` / self `builds-on` | fail |
| Duplicate identical edge (same type+target) on one object | fail |
| `about` targeting external URL (v1) | fail schema |
| `builds-on` cycle A↔B | **optional** at first; worth a cheap pairwise check if easy; not a general graph engine |
| Broken slug after rename | N/A if edges use ObjectId (correct by design) |

Do not build a generalized ontology validator.

---

## 14. Query / index approach

Stay consistent with module-level storage queries (no required Repository class).

### Smallest useful queries for proposed UI

```text
getPublishedNotes()
getProjectRecords()
findNotesAboutProject(projectId)   # Notes with about → projectId
findNotesBuildingOn(noteId)        # Notes with builds-on → noteId
resolveObjectId(id)                # Note | Project | undefined
```

### Scale

| Scale | Approach |
| --- | --- |
| Current (~7 objects) | in-memory scan during `getStaticPaths` / page render |
| 100 Notes | same |
| 1,000 Notes | build an in-memory Map once per build |
| 10,000 Notes | still plausible for static generation; revisit only with measured build pain |

**No database proposal.** Git Markdown remains authoritative.

Concrete use case requiring queries: Project page listing Notes that `about` it. Without that UI, even the query is premature.

---

## 15. Human-visible UX proposal (restrained)

Fit the notebook aesthetic already used for reply/bookmark **context** lines — not a new “graph panel.”

Avoid: node diagrams, Obsidian-style backlink walls, badges everywhere, UUID display, relationship emoji, dense metadata strips in the hero.

### Principles

- One short section, one purpose.
- Show titles + links only.
- Appear **only when at least one edge exists** (no empty “Writing about this project” stubs).
- Prefer footer/context adjacency over hero clutter.

---

## 16. Note-page behavior

When present (future):

**About** (from outbound `about`):

```text
About
Neighborbook
```

as a calm context line near existing reply/bookmark context — or a single footer line — matching site tone.

**Builds on** (outbound `builds-on`):

```text
Builds on
First note, probably
```

**Continued in** (derived incoming `builds-on`):

```text
Continued in
Later note title
```

Exact copy should be edited against live layout when implementing; do not invent a second visual system.

Reply/bookmark presentation remains unchanged.

---

## 17. Project-page behavior

When Notes `about` this Project:

```text
Writing about this project

• Why I built Neighborbook
• Designing contribution loops
```

Placement: project footer, after body, before/near topics — analogous to Note footer structure. Omit section entirely when empty.

No graph of related Projects from tags.

---

## 18. Authoring ergonomics

Canonical storage remains ObjectId-based.

### Friction today

**None in practice** — there are no internal relationships to author.

### Options (defer until friction appears)

| Option | When |
| --- | --- |
| No helper | **default now** — Cursor/agents can read `id` from frontmatter |
| `npm run content:list-ids` | if manual authoring of multiple edges becomes common |
| Checked-in human index | only if list-ids is insufficient |

Do **not** weaken canonical storage to slugs for convenience.

Do **not** invent draft-room relationship UI in PKL-1.

---

## 19. Interaction with reply / bookmark / Webmention

| Concern | Rule |
| --- | --- |
| Shared `Relationship` type | yes — same primitive |
| `deriveNoteKind` | continues to inspect only `reply-to` / `bookmark-of` |
| Microformats | only reply/bookmark classes today |
| Outbound Webmention | **only** types explicitly marked eligible (`reply-to`, `bookmark-of` today) |
| `about` / `builds-on` → Webmention | **no** by default |
| Historical Note WM targets | unchanged (`slug` + `previousSlugs`) |

Separate **relationship meaning** from **Webmention eligibility**.

---

## 20. RSS / POSSE compatibility

| Surface | PKL stance |
| --- | --- |
| RSS GUID / identity | **unchanged** (M3 lock) |
| RSS item body | default: **do not** inject relationship chrome into feed HTML |
| Bluesky POSSE text | **unchanged**; do not auto-append “About…” / “Builds on…” |
| Sitemap | current canonical URLs only |

Avoid feed churn for empty-or-sparse relationship UI.

---

## 21. Future machine-readable projection path (design only)

Domain stays protocol-neutral. Later adapters could project:

```text
Note --about--> Project
  → JSON-LD (e.g. schema.org about / mainEntity)
  → public content JSON export
  → agent-readable edge list
```

without changing canonical frontmatter.

**Not in this phase:** JSON-LD, WebFinger, content API, RDF store.

---

## 22. Migration impact on existing content

| Content | Impact if PKL deferred |
| --- | --- |
| All Notes/Projects | **none** — `relationships: []` already valid |
| Schema | no change required to wait |
| When first `about` arrives | add one edge; no corpus rewrite |

No fake edges. No speculative backfill from tags or Now-page links.

If Homebase↔apps lineage is someday authored, that is a **new editorial decision**, not a mechanical migration.

---

## 23. Suggested PKL milestone sequence (boundaries only)

Not an implementation plan — phase boundaries triggered by content:

### PKL-0 — Wait / observe (now)

Write Notes. Prefer first-party `/projects/<slug>/` links in new writing when discussing products. Do not implement relationship code.

### PKL-1 — Semantic foundation (trigger: first real `about` or `builds-on` need)

Extend vocabulary + schema validation + ObjectId integrity + resolution helpers. Still no UI requirement if content lands first in private drafts — but public edges should not ship without human display.

### PKL-2 — Human-visible context

Project incoming `about` list; Note `about` / `builds-on` / derived “Continued in.” Empty states omitted.

### PKL-3 — Authoring ergonomics

Only if UUID friction is real.

### PKL-4 — Machine-readable projections

JSON/JSON-LD/etc., after human UX exists.

Ordinary Markdown backlinks remain a **later optional layer**, not PKL-1.

---

## 24. Risks and over-engineering traps

1. Building graph machinery for one Note.
2. Adopting `related-to` because it feels complete.
3. Treating tag overlap as knowledge.
4. Storing inverse edges.
5. Putting routes or schema.org in domain.
6. Auto-Webmention for every new type.
7. Empty UI sections that make the site feel unfinished.
8. Inventing Notes solely to exercise `about`.
9. Premature Project.relationships symmetry.
10. General cycle detection / graph query language.

---

## 25. Explicit non-goals

- Graph database / RDF store / ontology framework
- Generic triples UI
- AI-inferred relationships
- ActivityPub / ATProto / IndieAuth / JSON-LD implementation
- First-party Webmention persistence
- Public content API
- Changing RSS identity or POSSE behavior
- Ordinary-link backlink engine (this phase)
- Manufacturing content to validate architecture

---

## 26. Open decisions requiring approval

1. **Timing:** Approve recommendation **B** (wait) vs A/C?
2. When content appears, is **`about` (Note→Project)** accepted as the first new type?
3. Is **`builds-on` (Note→Note)** accepted as the second type, or wait for a concrete pair?
4. Confirm **no Project.relationships[]** until proven necessary.
5. Confirm **`about`/`builds-on` are not Webmention-eligible** unless separately approved.
6. Confirm ordinary Markdown backlinks stay out of PKL-1.
7. Preferred Project UI copy: “Writing about this project” vs alternatives?

---

## 27. What concrete use case requires each new abstraction?

| Abstraction | Required by current corpus? | Near-term use case |
| --- | --- | --- |
| Shared `Relationship` primitive | already exists | reply/bookmark + future types |
| `about` | **no examples yet** | first Note that substantially documents a Project |
| `builds-on` | **no examples yet** | second Note that extends an earlier Note |
| Incoming edge index | no | Project page listing |
| Project.relationships | no | none identified |
| `related-to` / `references` | no | none identified |
| Authoring CLI | no | none identified |
| JSON-LD | no | future machine layer only |

If there is no convincing near-term use case, **defer**.

---

## 28. Recommendation

### B — The core is ready, but wait for more content before implementing semantic relationships.

**Evidence:**

- Published Notes: **1**
- Authored semantic edges: **0**
- High-confidence Note→Project `about` candidates: **0**
- High-confidence Note→Note `builds-on` candidates: **0**
- Personal Web Core already provides the storage shape and internal target model needed later

**What to do until then:**

1. Keep writing Notes under existing dual gates.
2. When a Note is substantially about a Project, that is the trigger to approve PKL-1 with `about`.
3. When a Note clearly extends an earlier Note, that is the trigger to add `builds-on`.
4. Do not add empty relationship UI, query APIs, or vocabulary expansions “for completeness.”

**Rejected for now:**

- **A** (implement PKL-1 now) — would optimize for architectural completeness over a 2030-shaped corpus.
- **C** (smaller precursor code) — the only honest precursor is this design + continued writing; more code without edges adds surface area without human value.

---

*End of design specification. No implementation plan. No production code changes accompanying this document beyond adding this file.*
