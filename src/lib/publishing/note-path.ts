import { contentSlugSchema } from '../../core/storage/slug-schema.js';

export const NOTES_DIR = 'src/content/notes';

export function noteRepoPath(slug: string): string {
  const parsed = contentSlugSchema.parse(slug);
  if (parsed === 'README') {
    throw new Error('Slug “README” is reserved.');
  }
  return `${NOTES_DIR}/${parsed}.md`;
}
