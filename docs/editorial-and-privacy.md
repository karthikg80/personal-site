# Editorial and Privacy Contract

Workbench Notes are authored from Karthik's firsthand observations and decisions. An agent may interview, organize, edit, and perform factual and privacy checks. It must not invent experiences, opinions, or certainty, and it must never publish without explicit human approval.

## A working voice, not a brand guide

The voice is expected to evolve. The first ten notes are experiments, not a promise that every future note will sound or look the same. After each note, record what felt natural, what felt performed, and what should change next time.

Start in first person and close to the source material. Prefer concrete details, fragments, lists, and honest uncertainty over a polished argument. A note may be warm, technical, spare, amused, or unfinished when that reflects the week.

Avoid corporate vocabulary, promotional claims, inspirational conclusions, forced cleverness, and imitating another writer's recognizable prose.

The agent should offer meaningfully different shapes rather than normalizing every draft into one house style. It should preserve awkward or unusual phrasing when Karthik identifies it as genuinely his, while still flagging unclear writing.

Every factual statement must be supported by Karthik's notes, an explicit statement from him, or a linked public source. Unknowns stay unknown.

## Privacy boundary

Normally publishable material includes public product work, design and engineering decisions, public links, general lessons, and non-identifying hobbies.

Family anecdotes, employer-related experiences, travel, local routines, home infrastructure, and screenshots require judgment. Generalize unnecessary identifiers, remove metadata, and publish after the event rather than in real time.

Never publish children's identities, faces, schools, or schedules; live location or upcoming travel; health or financial details; customer, employer, or internal company information; credentials; private documents; or another person's story without consent.

Raw observations and sensitive sources stay in encrypted private storage outside this repository. Only reviewed, publishable Markdown belongs in Git. Removing a page does not remove it from Git history.

The private drafting room is suitable for ordinary working notes, not the most sensitive source material. Its notebook is encrypted on the current device and has no server-side draft database. When Karthik explicitly asks an embedded agent for help, the current note is transmitted to the configured model provider for that request. Credentials, private documents, children's information, and other prohibited material must not be entered or sent there.

## Publication gate

A note is public only when both frontmatter conditions are satisfied:

```yaml
draft: false
privacyReviewed: true
```

The publishing sequence is:

1. Capture observations privately, either in encrypted private storage or the device-local drafting room when the material is suitable for an agent request.
2. Ask the agent to interview and offer possible shapes. Only the current draft is sent, and only after an explicit action. The agent cannot Prepare or Publish.
3. Select and edit a draft.
4. Ask what feels natural, what feels performed, and what this note teaches us about the evolving voice.
5. Verify claims, links, names, timing, images, and metadata.
6. Perform the privacy review of the exact publication-bound text.
7. In the drafting room, check the repository-entry acknowledgement: this exact text is safe to enter the public source repository. The five drafting hygiene checkboxes are not this acknowledgement.
8. **Prepare** writes the canonical Git file with `draft: true` and `privacyReviewed: true`. The Note is still excluded from public routes, RSS, and the sitemap. Ordinary publishing is Prepare, not paste.
9. Review the Git revision at `/drafting/review/<slug>/`. That page renders the canonical blob with production Markdown. Publish means this exact Git object, not the local working copy.
10. **Publish** flips only `draft` to `false`. `privacyReviewed` stays `true`. ObjectId, slug, body, relationships, and syndication do not change.
11. Confirm the public URL after deploy.
12. If Prepare recorded distribution intent, a GitHub Action runs after Vercel promotes that commit: verify the live ObjectId, send Webmentions for this note, create a Bluesky copy idempotently, and commit `syndication`. Manual CLI remains available:

    ```sh
    npm run webmentions:send -- --slug=<slug>
    npm run posse:bluesky -- <slug>
    ```

The room keeps the current writing stage as its only persistent work surface. Draft navigation and editorial assistance open in separate modal drawers. The Drafts drawer lists working notes first and keeps published device-local copies in a collapsed archive. Editorial assistance is hidden during Prepare so the repository decision has no competing panel.

Copy/Download is a recovery handoff. It always emits `draft: true` and `privacyReviewed: false`, even after a Prepare acknowledgement, and must not be committed as a reviewed canonical Note.

Replies (`relationships` with `type: reply-to`) and bookmarks (`type: bookmark-of`) are still notes. They use the same dual publication gate. Do not POSSE a note until it is public on this domain.

## Transparency

The colophon describes the standing relationship: Karthik keeps the observations and makes the editorial decisions; an agent helps ask questions, shape drafts, and check for privacy leaks; Karthik reviews and approves every published word.
