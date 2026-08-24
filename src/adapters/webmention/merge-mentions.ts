export type WebmentionMention = {
  url?: string;
  published?: string;
  author?: {
    name?: string;
    url?: string;
    photo?: string;
  };
  content?: { text?: string; html?: string };
  'wm-property'?: string;
  'wm-id'?: number | string;
};

/**
 * Merge JF2 mention batches from multiple target lookups.
 * Dedupes by wm-id when present, otherwise by url + wm-property + author url.
 */
export function mergeWebmentionMentions(
  batches: ReadonlyArray<ReadonlyArray<WebmentionMention>>
): WebmentionMention[] {
  const merged: WebmentionMention[] = [];
  const seen = new Set<string>();

  for (const batch of batches) {
    for (const mention of batch) {
      const key = mentionKey(mention);
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(mention);
    }
  }

  return merged;
}

function mentionKey(mention: WebmentionMention): string {
  if (mention['wm-id'] !== undefined && mention['wm-id'] !== null) {
    return `id:${mention['wm-id']}`;
  }
  return [
    'fallback',
    mention.url ?? '',
    mention['wm-property'] ?? '',
    mention.author?.url ?? '',
    mention.published ?? '',
  ].join('|');
}
