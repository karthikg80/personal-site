/**
 * Collection path helpers — routing adapter only.
 * Domain must not import these.
 */

export function notePathFromSlug(slug: string): string {
  return `/notes/${slug}/`;
}

export function projectPathFromSlug(slug: string): string {
  return `/projects/${slug}/`;
}

export function absoluteUrl(origin: string, path: string): string {
  return `${origin.replace(/\/$/, '')}${path}`;
}
