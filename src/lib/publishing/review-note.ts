import type { NoteStorageData } from '../../core/storage/map-note.js';
import {
  getNoteFile,
  getNotesConfig,
  GitHubNotesError,
  type GitHubNotesConfig,
  type NoteBlob,
} from './github-notes.js';
import { LOCAL_IMAGE_REVIEW_ERROR, renderNoteBodyHtml } from './note-body-html.js';
import { prepareReviewBodyHtml } from './review-html.js';
import { parseCanonicalNoteFile } from './note-markdown.js';
import { NOTES_DIR, noteRepoPath } from './note-path.js';

export type ReviewNote = {
  objectId: string;
  slug: string;
  blobSha: string;
  draft: boolean;
  privacyReviewed: boolean;
  canPublish: boolean;
  futureUrl: string;
  bodyHtml: string;
  data: NoteStorageData;
};

export type ReviewResult =
  | { ok: true; note: ReviewNote }
  | { ok: false; status: number; error: string };

export type ReviewNotesAccess = {
  getNotesConfig: () => GitHubNotesConfig | null;
  getNoteFile: (config: GitHubNotesConfig, slug: string) => Promise<NoteBlob | null>;
};

const defaultAccess: ReviewNotesAccess = {
  getNotesConfig,
  getNoteFile,
};

function fail(status: number, error: string): ReviewResult {
  return { ok: false, status, error };
}

function notFound(): ReviewResult {
  return fail(404, 'Not found.');
}

function validatedSlug(slugParam: string): string | null {
  try {
    const path = noteRepoPath(slugParam);
    const prefix = `${NOTES_DIR}/`;
    if (!path.startsWith(prefix) || !path.endsWith('.md')) return null;
    return path.slice(prefix.length, -'.md'.length);
  } catch {
    return null;
  }
}

export async function loadReviewNote(
  slugParam: string,
  access: ReviewNotesAccess = defaultAccess
): Promise<ReviewResult> {
  const slug = validatedSlug(slugParam);
  if (!slug) return notFound();

  const config = access.getNotesConfig();
  if (!config) {
    return fail(503, 'Publication is not configured.');
  }

  try {
    const file = await access.getNoteFile(config, slug);
    if (!file) return notFound();

    let parsed;
    try {
      parsed = parseCanonicalNoteFile(file.text);
    } catch {
      return notFound();
    }

    if (parsed.fields.slug !== slug) return notFound();

    const futureUrl = `https://karthikg.in/notes/${slug}/`;

    let bodyHtml: string;
    try {
      bodyHtml = prepareReviewBodyHtml(await renderNoteBodyHtml(parsed.body), { futureUrl });
    } catch (error) {
      if (error instanceof Error && error.message === LOCAL_IMAGE_REVIEW_ERROR) {
        return fail(409, error.message);
      }
      throw error;
    }

    const data: NoteStorageData = {
      id: parsed.fields.id,
      slug: parsed.fields.slug,
      previousSlugs: [],
      title: parsed.fields.title,
      summary: parsed.fields.summary,
      presentation: parsed.fields.presentation,
      tags: parsed.fields.tags,
      draft: parsed.draft,
      privacyReviewed: parsed.privacyReviewed,
      relationships: parsed.fields.relationships,
      syndication: [],
      date: new Date(`${parsed.fields.date}T00:00:00.000Z`),
    };

    return {
      ok: true,
      note: {
        objectId: parsed.fields.id,
        slug,
        blobSha: file.sha,
        draft: parsed.draft,
        privacyReviewed: parsed.privacyReviewed,
        canPublish: parsed.privacyReviewed === true && parsed.draft === true,
        futureUrl,
        bodyHtml,
        data,
      },
    };
  } catch (error) {
    if (error instanceof GitHubNotesError) {
      return fail(502, 'GitHub Contents request failed.');
    }
    throw error;
  }
}
