/**
 * First-party project path helper (current slug only).
 * Historical project paths are owned by the routing adapter.
 */
export function projectPath(slug: string): string {
  return `/projects/${slug}/`;
}
