/**
 * First-party project path helper.
 * Routing stays outside domain; M8 will own redirect policy later.
 */
export function projectPath(slug: string): string {
  return `/projects/${slug}/`;
}
