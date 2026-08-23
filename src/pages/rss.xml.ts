import type { APIRoute } from 'astro';
import { getPublishedNotes, notePath } from '../lib/notes';

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function escapeCdata(value: string): string {
  return value.replaceAll(']]>', ']]]]><![CDATA[>');
}

export const GET: APIRoute = async ({ site }) => {
  const origin = (site ?? new URL('https://karthikg.in')).toString().replace(/\/$/, '');
  const notes = await getPublishedNotes();

  const items = notes
    .map((note) => {
      const path = notePath(note);
      const link = `${origin}${path}`;
      const content = note.rendered?.html ?? '';

      return [
        '<item>',
        `<title>${escapeXml(note.data.title)}</title>`,
        `<link>${escapeXml(link)}</link>`,
        `<guid isPermaLink="true">${escapeXml(link)}</guid>`,
        `<pubDate>${note.data.date.toUTCString()}</pubDate>`,
        `<description>${escapeXml(note.data.summary ?? `A workbench note from ${note.data.date.toDateString()}.`)}</description>`,
        `<content:encoded><![CDATA[${escapeCdata(content)}]]></content:encoded>`,
        '</item>',
      ].join('');
    })
    .join('');

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">',
    '<channel>',
    '<title>Workbench Notes by Karthik Gurumoorthy</title>',
    `<link>${escapeXml(origin)}/notes</link>`,
    `<atom:link href="${escapeXml(origin)}/rss.xml" rel="self" type="application/rss+xml" />`,
    '<description>Short notes about making software, noticing things, and wandering the web.</description>',
    '<language>en-us</language>',
    items,
    '</channel>',
    '</rss>',
  ].join('');

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
    },
  });
};
