import { createSatteriMarkdownProcessor } from '@astrojs/markdown-satteri';

/**
 * Render a Note Markdown body with Astro 7's default Sätteri processor.
 *
 * This is the same engine `render(entry)` uses when `astro.config.mjs` has no
 * `markdown` block. It does not replace the production `[...slug].astro` path.
 */
let renderer: Awaited<ReturnType<typeof createSatteriMarkdownProcessor>> | undefined;

async function getRenderer() {
  renderer ??= await createSatteriMarkdownProcessor();
  return renderer;
}

export async function renderNoteBodyHtml(markdownBody: string): Promise<string> {
  const { code } = await (await getRenderer()).render(markdownBody);
  return code;
}
