import { absoluteUrl, notePathFromSlug } from '../routing/paths.js';

/**
 * Fully-qualified Webmention lookup targets for a Note.
 * Current canonical URL first, then historical URLs in previousSlugs order.
 * Defensive dedupe prevents duplicate network requests.
 */
export function noteMentionTargets(
  note: { slug: string; previousSlugs: string[] },
  siteOrigin = 'https://karthikg.in'
): string[] {
  const paths = [note.slug, ...note.previousSlugs];
  const urls: string[] = [];
  const seen = new Set<string>();

  for (const slug of paths) {
    const url = absoluteUrl(siteOrigin, notePathFromSlug(slug));
    if (seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
  }

  return urls;
}
