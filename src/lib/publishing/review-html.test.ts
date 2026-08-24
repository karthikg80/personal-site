import { describe, expect, it } from 'vitest';

import { renderNoteBodyHtml } from './note-body-html.js';
import { prepareReviewBodyHtml } from './review-html.js';

const futureUrl = 'https://karthikg.in/notes/building-for-the-web-of-2030/';

async function reviewHtml(markdown: string): Promise<string> {
  return prepareReviewBodyHtml(await renderNoteBodyHtml(markdown), { futureUrl });
}

describe('prepareReviewBodyHtml', () => {
  it('strips raw script tags that Sätteri would otherwise preserve', async () => {
    const raw = await renderNoteBodyHtml('<script>fetch("/api/drafting/publish")</script>\n');
    expect(raw).toMatch(/<script/i);
    const html = prepareReviewBodyHtml(raw, { futureUrl });
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toContain('fetch("/api/drafting/publish")');
  });

  it('strips event handlers and javascript: links', async () => {
    const html = await reviewHtml(
      '<a href="javascript:alert(1)" onclick="alert(1)">go</a>\n[click](javascript:alert(2))\n'
    );
    expect(html).not.toMatch(/javascript:/i);
    expect(html).not.toMatch(/\son\w+=/i);
  });

  it('rewrites path-relative links against the future public URL', async () => {
    const rendered = await renderNoteBodyHtml('[other](other)\n');
    expect(rendered).toContain('href="other"');
    const html = prepareReviewBodyHtml(rendered, { futureUrl });
    expect(html).toContain('href="https://karthikg.in/notes/building-for-the-web-of-2030/other"');
    expect(html).not.toMatch(/href="other"/);
  });

  it('leaves site-absolute and in-page fragment links unchanged', async () => {
    const html = await reviewHtml('[archive](/notes/)\n[here](#heading)\n');
    expect(html).toContain('href="/notes/"');
    expect(html).toContain('href="#heading"');
  });
});
