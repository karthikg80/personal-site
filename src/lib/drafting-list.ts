export type LocalDraftListItem = {
  publishedAt?: string;
  updatedAt: string;
};

export function partitionLocalDrafts<T extends LocalDraftListItem>(drafts: readonly T[]): {
  workingDrafts: T[];
  publishedDrafts: T[];
} {
  const sorted = [...drafts].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  return {
    workingDrafts: sorted.filter((draft) => !draft.publishedAt),
    publishedDrafts: sorted.filter((draft) => Boolean(draft.publishedAt)),
  };
}
