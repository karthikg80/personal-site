# Workbench Note Template

Keep working drafts outside Git. This checkout ignores `private-notes/` for local review, but sensitive sources should live in encrypted storage. Copy only an approved, publishable draft into `src/content/notes/<slug>.md`.

The private `/drafting` room can shape ordinary working notes with an agent and export this template with both publication gates closed. It is device-local, not a home for prohibited sensitive material.

```md
---
title: "Week ending Month Day"
date: YYYY-MM-DD
summary: "One sentence that says what is inside."
tags:
  - making
presentation: note # use scrap for an intentionally rough, notebook-like page
# inReplyTo: https://example.com/post   # a reply; markup becomes u-in-reply-to
# bookmarkOf: https://example.com/page  # a bookmark; markup becomes u-bookmark-of
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
