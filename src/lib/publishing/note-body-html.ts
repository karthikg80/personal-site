import { createSatteriMarkdownProcessor } from '@astrojs/markdown-satteri';

/**
 * Render a Note Markdown body with Astro 7's default Sätteri processor.
 *
 * This is the same engine `render(entry)` uses when `astro.config.mjs` has no
 * `markdown` block. It does not replace the production `[...slug].astro` path.
 *
 * Parity is guaranteed for the constructs in `fixtures/` (headings, links,
 * emphasis, lists, code, quotes, raw HTML). Local Astro image-pipeline paths
 * (`./photo.jpg` and similar) are rejected: GitHub-fetched Markdown cannot run
 * Vite's `__ASTRO_IMAGE_` rewrite, so review must fail clearly rather than
 * silently diverge from production.
 */
let renderer: Awaited<ReturnType<typeof createSatteriMarkdownProcessor>> | undefined;

export const LOCAL_IMAGE_REVIEW_ERROR =
  'This canonical draft includes a local image. GitHub-fetched review Markdown cannot use the Astro image pipeline.';

async function getRenderer() {
  renderer ??= await createSatteriMarkdownProcessor();
  return renderer;
}

export async function renderNoteBodyHtml(markdownBody: string): Promise<string> {
  const { code, metadata } = await (await getRenderer()).render(markdownBody);
  const localImagePaths = metadata.localImagePaths ?? [];
  if (localImagePaths.length > 0 || code.includes('__ASTRO_IMAGE_')) {
    throw new Error(LOCAL_IMAGE_REVIEW_ERROR);
  }
  return code;
}
