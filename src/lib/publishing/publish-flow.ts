import { parseObjectIdV7 } from '../../core/domain/ids.js';
import { contentSlugSchema } from '../../core/storage/slug-schema.js';
import {
  getNoteFile,
  getNotesConfig,
  GitHubNotesError,
  putNoteFile,
  recoverNoteFile,
  type GitHubNotesConfig,
  type NoteBlob,
  type RecoveredNoteFile,
} from './github-notes.js';
import { parseCanonicalNoteFile, publishCanonicalNote } from './note-markdown.js';
import { noteRepoPath } from './note-path.js';
import { parsePublishRequest, type ParsedPublish } from './publish-request.js';

export type PublishResult =
  | {
      ok: true;
      slug: string;
      objectId: string;
      blobSha: string;
      commitSha?: string;
      url: string;
    }
  | {
      ok: false;
      status: number;
      error: string;
    };

export type CanonicalLookupResult =
  | {
      ok: true;
      id: string;
      slug: string;
      draft: boolean;
      privacyReviewed: boolean;
      sha: string;
      url: string;
    }
  | {
      ok: false;
      status: number;
      error: string;
    };

export type PublishNotesAccess = {
  getNotesConfig: () => GitHubNotesConfig | null;
  getNoteFile: (config: GitHubNotesConfig, slug: string) => Promise<NoteBlob | null>;
  putNoteFile: (
    config: GitHubNotesConfig,
    input: { slug: string; text: string; message: string; sha?: string }
  ) => Promise<{ sha: string; commitSha: string }>;
  recoverNoteFile: (
    config: GitHubNotesConfig,
    input: { objectId: string; slug?: string }
  ) => Promise<RecoveredNoteFile | null>;
};

const defaultAccess: PublishNotesAccess = {
  getNotesConfig,
  getNoteFile,
  putNoteFile,
  recoverNoteFile,
};

function fail(status: number, error: string): PublishResult {
  return { ok: false, status, error };
}

function noteUrl(slug: string): string {
  return `https://karthikg.in/notes/${slug}/`;
}

function mapGitHubError(error: unknown): PublishResult {
  if (error instanceof GitHubNotesError) {
    if (error.status === 409 || error.status === 422) {
      return fail(409, 'The canonical file changed. Reload and try again.');
    }
    return fail(502, 'GitHub Contents request failed.');
  }
  throw error;
}

export async function executePublish(
  input: unknown,
  access: PublishNotesAccess = defaultAccess
): Promise<PublishResult> {
  let parsed: ParsedPublish;
  try {
    parsed = parsePublishRequest(input);
  } catch (error) {
    return fail(400, error instanceof Error ? error.message : 'Invalid Publish request.');
  }

  const config = access.getNotesConfig();
  if (!config) {
    return fail(503, 'Publication is not configured.');
  }

  try {
    const existing = await access.getNoteFile(config, parsed.slug);
    if (!existing) {
      return fail(404, 'Canonical Note not found.');
    }
    if (existing.sha.toLowerCase() !== parsed.expectedBlobSha) {
      return fail(409, 'The canonical file changed. Reload and try again.');
    }

    let current;
    try {
      current = parseCanonicalNoteFile(existing.text);
    } catch {
      return fail(409, 'Canonical identity does not match this file.');
    }

    if (current.fields.id !== parsed.objectId || current.fields.slug !== parsed.slug) {
      return fail(409, 'Canonical identity does not match this file.');
    }
    if (current.privacyReviewed !== true) {
      return fail(409, 'This canonical Note is not privacy-reviewed.');
    }
    if (current.draft === false) {
      return {
        ok: true,
        slug: parsed.slug,
        objectId: parsed.objectId,
        blobSha: existing.sha,
        url: noteUrl(parsed.slug),
      };
    }

    const text = publishCanonicalNote(existing.text);
    const written = await access.putNoteFile(config, {
      slug: parsed.slug,
      text,
      message: `publish(note): ${parsed.slug}`,
      sha: parsed.expectedBlobSha,
    });

    return {
      ok: true,
      slug: parsed.slug,
      objectId: parsed.objectId,
      blobSha: written.sha,
      commitSha: written.commitSha,
      url: noteUrl(parsed.slug),
    };
  } catch (error) {
    return mapGitHubError(error);
  }
}

export async function executeCanonicalLookup(
  objectIdRaw: string,
  slugRaw: string | undefined,
  access: PublishNotesAccess = defaultAccess
): Promise<CanonicalLookupResult> {
  let objectId: string;
  try {
    objectId = parseObjectIdV7(objectIdRaw);
  } catch {
    return { ok: false, status: 400, error: 'ObjectId must be UUIDv7.' };
  }

  let slug: string | undefined;
  if (slugRaw !== undefined && slugRaw.trim() !== '') {
    try {
      slug = contentSlugSchema.parse(slugRaw.trim());
      noteRepoPath(slug);
    } catch (error) {
      const message = error instanceof Error && /reserved/i.test(error.message)
        ? error.message
        : 'Slug must be a single URL segment.';
      return { ok: false, status: 400, error: message };
    }
  }

  const config = access.getNotesConfig();
  if (!config) {
    return { ok: false, status: 503, error: 'Publication is not configured.' };
  }

  try {
    const recovered = await access.recoverNoteFile(config, { objectId, slug });
    if (!recovered) {
      return { ok: false, status: 404, error: 'Canonical Note not found.' };
    }
    const parsed = parseCanonicalNoteFile(recovered.text);
    return {
      ok: true,
      id: parsed.fields.id,
      slug: recovered.slug,
      draft: parsed.draft,
      privacyReviewed: parsed.privacyReviewed,
      sha: recovered.sha,
      url: noteUrl(recovered.slug),
    };
  } catch (error) {
    if (error instanceof GitHubNotesError) {
      return { ok: false, status: 502, error: 'GitHub Contents request failed.' };
    }
    throw error;
  }
}
