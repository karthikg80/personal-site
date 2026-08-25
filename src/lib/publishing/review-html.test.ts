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

  it('allowlists protocol after WHATWG normalization, not the raw prefix', () => {
    const obfuscated = [
      'java\tscript:alert(1)',
      'java\nscript:alert(1)',
      '\u0000javascript:alert(1)',
    ];
    for (const href of obfuscated) {
      const html = prepareReviewBodyHtml(`<a href="${href}">go</a>`, { futureUrl });
      expect(html, href).not.toMatch(/javascript:/i);
      expect(html, href).not.toContain('alert(1)');
    }
  });

  it('serializes query ampersands once after decoding Sätteri attribute values', async () => {
    const rendered = await renderNoteBodyHtml('[q](other?a=1&b=2)\n');
    expect(rendered).toContain('href="other?a=1&amp;b=2"');
    const html = prepareReviewBodyHtml(rendered, { futureUrl });
    expect(html).toContain(
      'href="https://karthikg.in/notes/building-for-the-web-of-2030/other?a=1&amp;b=2"'
    );
    expect(html).not.toContain('&amp;amp;');
  });

  it('does not double-escape ampersands in absolute http and mailto URLs', () => {
    const html = prepareReviewBodyHtml(
      '<a href="https://example.com/x?a=1&amp;b=2">https</a><a href="mailto:a@example.com?subject=hi&amp;body=x">mail</a>',
      { futureUrl }
    );
    expect(html).toContain('href="https://example.com/x?a=1&amp;b=2"');
    expect(html).toContain('href="mailto:a@example.com?subject=hi&amp;body=x"');
    expect(html).not.toContain('&amp;amp;');
  });
});
