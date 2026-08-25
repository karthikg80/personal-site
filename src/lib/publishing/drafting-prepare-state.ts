export type EditorialSnapshot = {
  title: string;
  date: string;
  tags: string[];
  presentation: string;
  summary: string;
  body: string;
  relationships: unknown[];
};

export type PrepareLinkage = {
  canonicalId?: string;
  slug?: string;
  blobSha?: string;
  commitSha?: string;
  preparedAt?: string;
  publishedAt?: string;
  lastPreparedSnapshot?: EditorialSnapshot;
  privacyAcknowledged?: boolean;
};

export type PrepareUiKind = 'working' | 'prepared' | 'prepared-dirty' | 'published';

export type PrepareUiState = {
  kind: PrepareUiKind;
  canPrepare: boolean;
  prepareLabel: 'Prepare for publication' | 'Update canonical draft';
  slugLocked: boolean;
  reviewHref?: string;
  gitStatus: string;
  workingStatus: string;
};

export function captureEditorialSnapshot(input: {
  title: string;
  date: string;
  tags: string[];
  presentation: string;
  summary: string;
  body: string;
  sparks: string;
  relationships?: unknown[];
}): EditorialSnapshot {
  return {
    title: input.title,
    date: input.date,
    tags: [...input.tags],
    presentation: input.presentation,
    summary: input.summary,
    body: input.body.trim() || input.sparks.trim(),
    relationships: input.relationships ? structuredClone(input.relationships) : [],
  };
}

export function isWorkingCopyDirty(
  current: EditorialSnapshot,
  last?: EditorialSnapshot
): boolean {
  if (!last) return false;
  return JSON.stringify(current) !== JSON.stringify(last);
}

/** Git object exists. canonicalId alone is still a working draft. */
export function isCanonicalPrepared(linkage: PrepareLinkage): boolean {
  return Boolean(linkage.preparedAt && linkage.blobSha);
}

export function applyPrepareSuccess(
  previous: PrepareLinkage,
  response: { objectId: string; slug: string; blobSha: string; commitSha?: string },
  snapshot: EditorialSnapshot,
  preparedAt: string
): PrepareLinkage {
  return {
    ...previous,
    canonicalId: response.objectId,
    slug: response.slug,
    blobSha: response.blobSha,
    commitSha: response.commitSha,
    preparedAt,
    lastPreparedSnapshot: snapshot,
    privacyAcknowledged: true,
  };
}

export function buildPublishRequest(input: {
  objectId: string;
  slug: string;
  expectedBlobSha: string;
}): { objectId: string; slug: string; expectedBlobSha: string } {
  return {
    objectId: input.objectId,
    slug: input.slug,
    expectedBlobSha: input.expectedBlobSha,
  };
}

export function relationshipsFromReplyToUrl(url?: string): Array<{
  type: 'reply-to';
  target: { kind: 'external'; url: string };
}> {
  const trimmed = url?.trim() ?? '';
  if (!trimmed) return [];
  return [{ type: 'reply-to', target: { kind: 'external', url: trimmed } }];
}

export function buildPrepareRequest(fields: {
  canonicalId: string;
  slug: string;
  title: string;
  date: string;
  tags: string[];
  presentation: 'note' | 'scrap';
  summary?: string;
  body: string;
  sparks: string;
  replyToUrl?: string;
  distribution?: { webmentions: boolean; bluesky: boolean };
}): Record<string, unknown> {
  const request: Record<string, unknown> = {
    canonicalId: fields.canonicalId,
    slug: fields.slug,
    title: fields.title,
    date: fields.date,
    tags: fields.tags,
    presentation: fields.presentation,
    relationships: relationshipsFromReplyToUrl(fields.replyToUrl),
    body: fields.body,
    sparks: fields.sparks,
    privacyAcknowledgement: true,
    distribution: {
      webmentions: fields.distribution?.webmentions === true,
      bluesky: fields.distribution?.bluesky === true,
    },
  };
  const summary = fields.summary?.trim();
  if (summary) request.summary = summary;
  return request;
}

export function derivePrepareUi(input: {
  linkage: PrepareLinkage;
  snapshot: EditorialSnapshot;
  privacyAcknowledged: boolean;
}): PrepareUiState {
  const { linkage, snapshot, privacyAcknowledged } = input;
  const prepared = isCanonicalPrepared(linkage);
  const dirty = prepared && isWorkingCopyDirty(snapshot, linkage.lastPreparedSnapshot);
  const reviewHref = prepared && linkage.slug ? `/drafting/review/${linkage.slug}` : undefined;

  if (linkage.publishedAt) {
    return {
      kind: 'published',
      canPrepare: false,
      prepareLabel: 'Update canonical draft',
      slugLocked: true,
      reviewHref,
      gitStatus: 'Published in Git',
      workingStatus: dirty ? 'Changed since Prepare — not reviewed' : 'Unchanged',
    };
  }

  if (!prepared) {
    return {
      kind: 'working',
      canPrepare: privacyAcknowledged,
      prepareLabel: 'Prepare for publication',
      slugLocked: false,
      gitStatus: 'Not in Git',
      workingStatus: 'Not reviewed for repository entry',
    };
  }

  if (dirty) {
    return {
      kind: 'prepared-dirty',
      canPrepare: privacyAcknowledged,
      prepareLabel: 'Update canonical draft',
      slugLocked: true,
      reviewHref,
      gitStatus: 'Canonical draft: Unpublished · Privacy reviewed',
      workingStatus: 'Working copy: Changed since Prepare — not reviewed',
    };
  }

  return {
    kind: 'prepared',
    canPrepare: privacyAcknowledged,
    prepareLabel: 'Update canonical draft',
    slugLocked: true,
    reviewHref,
    gitStatus: 'Canonical draft: Unpublished · Privacy reviewed',
    workingStatus: 'Working copy: Unchanged',
  };
}
