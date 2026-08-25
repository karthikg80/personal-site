# Workbench Note Template

Keep working drafts outside Git. This checkout ignores `private-notes/` for local review, but sensitive sources should live in encrypted storage.

Ordinary Git entry is **Prepare** from the private `/drafting` room: after the repository-entry privacy acknowledgement, the canonical file is `draft: true` and `privacyReviewed: true`. That unpublished Note is still hidden from public routes, RSS, and the sitemap until **Publish** flips only `draft`.

Copy/Download is recovery, not the ordinary path. The template below matches that handoff: both gates stay closed (`privacyReviewed: false`). Do not commit a Copy/Download file as a privacy-reviewed canonical Note.

The drafting room is device-local, not a home for prohibited sensitive material. The editorial agent cannot Prepare or Publish.

## Identity fields

- `id` is an immutable UUIDv7 assigned once at creation (handoff or migration). **Never regenerate it** when editing, renaming, or moving a note.
- `slug` is the current URL segment (`/notes/<slug>/`). When renaming a published note, append the old value to `previousSlugs`, set the new `slug`, and rename the file to match if needed. Build emits a **308** redirect from each historical path to the current path.
- `legacyRssGuid` is **migration-only** compatibility metadata for notes that were already public before Personal Web Core. **Do not add it to new notes.** After a rename, leave it unchanged — RSS GUID stays frozen while `<link>` follows the new slug.
- `previousSlugs` stays `[]` until a slug rename occurs. Never put the current slug in `previousSlugs`.

```md
---
id: 018f0000-0000-7000-8000-000000000000
title: "Week ending Month Day"
slug: week-ending-month-day
date: YYYY-MM-DD
previousSlugs: []
summary: "One sentence that says what is inside."
tags:
  - making
presentation: note # use scrap for an intentionally rough, notebook-like page
relationships: []
# relationships:
#   - type: reply-to
#     target:
#       kind: external
#       url: https://example.com/post
#   - type: bookmark-of
#     target:
#       kind: external
#       url: https://example.com/page
# distribution:
#   webmentions: true
#   bluesky: true
syndication: []
draft: true
privacyReviewed: false
---

An opening observation. Start with what actually happened rather than a general lesson.

## Made

- Something built, repaired, or clarified.

## Noticed

- A detail, question, or change of mind.

## Enjoyed

- A public link, book, meal, walk, or other non-sensitive moment.

## Next

- Curiosity or direction, not a promise.
```

Every heading is optional. Three paragraphs and two links are enough for a note.
