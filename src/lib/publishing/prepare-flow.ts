import {
  findNoteByObjectId,
  getNoteFile,
  getNotesConfig,
  GitHubNotesError,
  putNoteFile,
  type GitHubNotesConfig,
  type NoteBlob,
  type RecoveredNoteFile,
} from './github-notes.js';
import { parseCanonicalNoteFile } from './note-markdown.js';
import { parsePrepareRequest, type ParsedPrepare } from './prepare-request.js';

export type PrepareResult =
  | {
      ok: true;
      created: boolean;
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

export type PrepareNotesAccess = {
  getNotesConfig: () => GitHubNotesConfig | null;
  getNoteFile: (config: GitHubNotesConfig, slug: string) => Promise<NoteBlob | null>;
  findNoteByObjectId: (
    config: GitHubNotesConfig,
    objectId: string
  ) => Promise<RecoveredNoteFile | null>;
  putNoteFile: (
    config: GitHubNotesConfig,
    input: { slug: string; text: string; message: string; sha?: string }
  ) => Promise<{ sha: string; commitSha: string }>;
};

const defaultAccess: PrepareNotesAccess = {
  getNotesConfig,
  getNoteFile,
  findNoteByObjectId,
  putNoteFile,
};

function fail(status: number, error: string): PrepareResult {
  return { ok: false, status, error };
}

function noteUrl(slug: string): string {
  return `https://karthikg.in/notes/${slug}/`;
}

function success(input: {
  created: boolean;
  slug: string;
  objectId: string;
  blobSha: string;
  commitSha?: string;
}): PrepareResult {
  return {
    ok: true,
    created: input.created,
    slug: input.slug,
    objectId: input.objectId,
    blobSha: input.blobSha,
    commitSha: input.commitSha,
    url: noteUrl(input.slug),
  };
}

function inspectExisting(parsed: ParsedPrepare, existing: NoteBlob): PrepareResult | null {
  let current;
  try {
    current = parseCanonicalNoteFile(existing.text);
  } catch {
    return fail(409, 'Slug already exists. Choose another slug.');
  }

  if (current.fields.id !== parsed.canonicalId) {
    return fail(409, 'Slug already exists. Choose another slug.');
  }
  if (current.draft === false) {
    return fail(409, 'Prepare cannot modify a published Note.');
  }
  if (existing.text === parsed.markdown) {
    return success({
      created: false,
      slug: parsed.slug,
      objectId: parsed.canonicalId,
      blobSha: existing.sha,
    });
  }
  return null;
}

async function updatePrepared(
  access: PrepareNotesAccess,
  config: GitHubNotesConfig,
  parsed: ParsedPrepare,
  existing: NoteBlob
): Promise<PrepareResult> {
  const blocked = inspectExisting(parsed, existing);
  if (blocked) return blocked;

  const written = await access.putNoteFile(config, {
    slug: parsed.slug,
    text: parsed.markdown,
    message: `draft(note): prepare ${parsed.slug}`,
    sha: existing.sha,
  });

  return success({
    created: false,
    slug: parsed.slug,
    objectId: parsed.canonicalId,
    blobSha: written.sha,
    commitSha: written.commitSha,
  });
}

async function createPrepared(
  access: PrepareNotesAccess,
  config: GitHubNotesConfig,
  parsed: ParsedPrepare
): Promise<PrepareResult> {
  try {
    const written = await access.putNoteFile(config, {
      slug: parsed.slug,
      text: parsed.markdown,
      message: `draft(note): prepare ${parsed.slug}`,
    });
    return success({
      created: true,
      slug: parsed.slug,
      objectId: parsed.canonicalId,
      blobSha: written.sha,
      commitSha: written.commitSha,
    });
  } catch (error) {
    if (!(error instanceof GitHubNotesError) || error.status !== 422) {
      throw error;
    }
    const appeared = await access.getNoteFile(config, parsed.slug);
    if (!appeared) {
      return fail(409, 'The canonical file changed. Reload and try again.');
    }
    return updatePrepared(access, config, parsed, appeared);
  }
}

export async function executePrepare(
  input: unknown,
  access: PrepareNotesAccess = defaultAccess
): Promise<PrepareResult> {
  let parsed: ParsedPrepare;
  try {
    parsed = parsePrepareRequest(input);
  } catch (error) {
    return fail(400, error instanceof Error ? error.message : 'Invalid Prepare request.');
  }

  const config = access.getNotesConfig();
  if (!config) {
    return fail(503, 'Publication is not configured.');
  }

  try {
    const existing = await access.getNoteFile(config, parsed.slug);
    if (existing) {
      return await updatePrepared(access, config, parsed, existing);
    }
    const elsewhere = await access.findNoteByObjectId(config, parsed.canonicalId);
    if (elsewhere) {
      return fail(409, 'This ObjectId already exists at another path.');
    }
    return await createPrepared(access, config, parsed);
  } catch (error) {
    if (error instanceof GitHubNotesError) {
      if (error.status === 409 || error.status === 422) {
        return fail(409, 'The canonical file changed. Reload and try again.');
      }
      return fail(502, 'GitHub Contents request failed.');
    }
    throw error;
  }
}
