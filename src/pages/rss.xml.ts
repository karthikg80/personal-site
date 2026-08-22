import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export const GET: APIRoute = async ({ site }) => {
  const origin = (site ?? new URL('https://karthikg.in')).toString().replace(/\/$/, '');
  const projects = (await getCollection('projects')).sort(
    (a, b) => b.data.date.getTime() - a.data.date.getTime()
  );

  const items = projects
    .map((project) => {
      const link = project.data.link ?? `${origin}/projects`;
      return [
        '<item>',
        `<title>${escapeXml(project.data.title)}</title>`,
        `<link>${escapeXml(link)}</link>`,
        `<guid isPermaLink="false">${escapeXml(project.id)}</guid>`,
        `<pubDate>${project.data.date.toUTCString()}</pubDate>`,
        `<description>${escapeXml(project.data.description)}</description>`,
        '</item>',
      ].join('');
    })
    .join('');

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    '<channel>',
    '<title>Karthik Gurumoorthy</title>',
    `<link>${escapeXml(origin)}</link>`,
    '<description>Selected work from Karthik Gurumoorthy and Thea Foundry.</description>',
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
