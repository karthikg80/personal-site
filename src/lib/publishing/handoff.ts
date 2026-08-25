import { parseObjectIdV7 } from '../../core/domain/ids.js';

export type HandoffInput = {
  canonicalId: string;
  title: string;
  slug: string;
  date: string;
  body: string;
};

function yamlString(value: string): string {
  return JSON.stringify(value.trim() || 'Untitled note');
}

export function buildHandoffMarkdown(input: HandoffInput): {
  filename: string;
  content: string;
} {
  const id = parseObjectIdV7(input.canonicalId);
  const slug = input.slug.trim();
  const content = [
    '---',
    `id: ${id}`,
    `title: ${yamlString(input.title)}`,
    `slug: ${yamlString(slug)}`,
    `date: ${input.date}`,
    'previousSlugs: []',
    'tags: []',
    'presentation: note',
    'relationships: []',
    'syndication: []',
    'draft: true',
    'privacyReviewed: false',
    '---',
    '',
    input.body,
    '',
  ].join('\n');

  return { filename: `${slug}.md`, content };
}
