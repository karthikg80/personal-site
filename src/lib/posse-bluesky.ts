import { posseNoteToBluesky } from './syndication/bluesky.js';

const slug = process.argv[2]?.replace(/\.md$/, '');
if (!slug) {
  console.error('Usage: npm run posse:bluesky -- <note-slug>');
  process.exit(1);
}

try {
  const publicUrl = await posseNoteToBluesky(slug);
  console.log(publicUrl);
  console.log(`Add this to the note frontmatter:\n\nsyndication:\n  - ${publicUrl}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
