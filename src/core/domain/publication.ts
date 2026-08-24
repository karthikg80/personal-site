export type PublicationState =
  | 'draft'
  | 'awaiting-privacy-review'
  | 'public';

/**
 * Editorial flags live in storage (frontmatter).
 * Domain exposes a single derived publication state.
 *
 * public iff !draft && privacyReviewed
 */
export function derivePublicationState(
  draft: boolean,
  privacyReviewed: boolean
): PublicationState {
  if (draft) return 'draft';
  if (!privacyReviewed) return 'awaiting-privacy-review';
  return 'public';
}

export function isPublicPublication(state: PublicationState): boolean {
  return state === 'public';
}
