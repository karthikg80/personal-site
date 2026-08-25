import { describe, expect, it } from 'vitest';

import { parseWebmentionCliArgs, webmentionJobsForNote } from './send-outbound.js';

const publicNote = `---
id: 018f3b2a-7c4e-7b3a-b123-456789abcdef
title: Example
slug: example
date: 2026-08-24
tags: []
presentation: note
relationships: []
syndication: []
draft: false
privacyReviewed: true
---
A paragraph with a [link](https://example.com/post).
`;

const draftNote = publicNote.replace('draft: false', 'draft: true');

describe('webmentionJobsForNote', () => {
  it('returns outbound targets only for public notes', () => {
    const job = webmentionJobsForNote(publicNote, 'example');
    expect(job?.source).toBe('https://karthikg.in/notes/example/');
    expect(job?.targets).toContain('https://example.com/post');
    expect(webmentionJobsForNote(draftNote, 'example')).toBeNull();
  });
});

describe('parseWebmentionCliArgs', () => {
  it('reads a single slug without scanning the rest of the archive', () => {
    expect(parseWebmentionCliArgs(['--slug=example', '--dry-run'])).toEqual({
      slug: 'example',
      dryRun: true,
    });
  });

  it('does not treat --dry-run as a slug', () => {
    expect(parseWebmentionCliArgs(['--dry-run'])).toEqual({
      slug: undefined,
      dryRun: true,
    });
  });
});
