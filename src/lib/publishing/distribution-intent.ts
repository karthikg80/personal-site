export type DistributionIntent = {
  webmentions: boolean;
  bluesky: boolean;
};

export function parseDistributionIntent(value: unknown): DistributionIntent {
  if (value === undefined) {
    return { webmentions: false, bluesky: false };
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('distribution must be a mapping of webmentions and bluesky booleans.');
  }
  const record = value as Record<string, unknown>;
  if (typeof record.webmentions !== 'boolean' || typeof record.bluesky !== 'boolean') {
    throw new Error('distribution.webmentions and distribution.bluesky must be booleans.');
  }
  return { webmentions: record.webmentions, bluesky: record.bluesky };
}
