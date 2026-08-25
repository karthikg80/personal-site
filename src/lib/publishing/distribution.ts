import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

import { parseCanonicalNoteFile } from './note-markdown.js';
import { parseDistributionIntent, type DistributionIntent } from './distribution-intent.js';

export type { DistributionIntent };
export { parseDistributionIntent };

export type PublishTransition = {
  objectId: string;
  slug: string;
  path: string;
  intent: DistributionIntent;
  syndication: string[];
};

const NOTES_PREFIX = 'src/content/notes/';

export function readPromotedCommitSha(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const record = payload as Record<string, unknown>;
  const git = record.git;
  if (git && typeof git === 'object' && !Array.isArray(git)) {
    const sha = (git as Record<string, unknown>).sha;
    if (typeof sha === 'string' && /^[0-9a-f]{40}$/i.test(sha)) return sha.toLowerCase();
  }
  const meta = record.meta;
  if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
    const sha = (meta as Record<string, unknown>).githubCommitSha;
    if (typeof sha === 'string' && /^[0-9a-f]{40}$/i.test(sha)) return sha.toLowerCase();
  }
  const deployment = record.deployment;
  if (deployment && typeof deployment === 'object' && !Array.isArray(deployment)) {
    const deploymentMeta = (deployment as Record<string, unknown>).meta;
    if (deploymentMeta && typeof deploymentMeta === 'object' && !Array.isArray(deploymentMeta)) {
      const sha = (deploymentMeta as Record<string, unknown>).githubCommitSha;
      if (typeof sha === 'string' && /^[0-9a-f]{40}$/i.test(sha)) return sha.toLowerCase();
    }
  }
  return null;
}

export function detectPublishTransition(
  path: string,
  before: string | null,
  after: string
): PublishTransition | null {
  if (!path.startsWith(NOTES_PREFIX) || !path.endsWith('.md')) return null;
  const slug = path.slice(NOTES_PREFIX.length, -3);
  if (!slug || slug === 'README') return null;
  if (before === null) return null;

  let previous;
  let current;
  try {
    previous = parseCanonicalNoteFile(before);
    current = parseCanonicalNoteFile(after);
  } catch {
    return null;
  }

  if (previous.draft !== true || current.draft !== false) return null;
  if (current.privacyReviewed !== true) return null;
  if (previous.fields.id !== current.fields.id || current.fields.slug !== slug) return null;

  const afterYaml = after.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1];
  const parsedYaml = afterYaml ? parseYaml(afterYaml) : {};
  const record = parsedYaml && typeof parsedYaml === 'object' && !Array.isArray(parsedYaml)
    ? parsedYaml as Record<string, unknown>
    : {};
  const syndication = Array.isArray(record.syndication)
    ? record.syndication.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    : [];

  return {
    objectId: current.fields.id,
    slug,
    path,
    intent: current.fields.distribution ?? parseDistributionIntent(undefined),
    syndication,
  };
}

export function shouldDistribute(transition: PublishTransition): boolean {
  return transition.intent.webmentions || transition.intent.bluesky;
}

export function shouldCreateBlueskyCopy(transition: PublishTransition): boolean {
  return transition.intent.bluesky && transition.syndication.length === 0;
}

export function appendSyndicationUrl(markdown: string, url: string): { text: string; changed: boolean } {
  const match = markdown.match(/^(---\r?\n)([\s\S]*?)(\r?\n---(?:\r?\n)?)([\s\S]*)$/);
  if (!match) {
    throw new Error('Missing YAML frontmatter.');
  }
  const parsed = parseYaml(match[2]!);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Frontmatter must be a YAML mapping.');
  }
  const record = parsed as Record<string, unknown>;
  const existing = Array.isArray(record.syndication)
    ? record.syndication.filter((entry): entry is string => typeof entry === 'string')
    : [];
  if (existing.includes(url)) {
    return { text: markdown, changed: false };
  }

  const next = { ...record, syndication: [...existing, url] };
  const yaml = stringifyYaml(next, { lineWidth: 0 }).trimEnd();
  return { text: `${match[1]}${yaml}${match[3]}${match[4]}`, changed: true };
}

export function liveNoteHasObjectId(html: string, objectId: string): boolean {
  return html.includes(`data-object-id="${objectId}"`);
}
