import type { APIRoute } from 'astro';

const paths = [
  '/',
  '/about',
  '/now',
  '/projects',
  '/resume',
  '/contact',
  '/colophon',
];

export const GET: APIRoute = async ({ site }) => {
  const origin = (site ?? new URL('https://karthikg.in')).toString().replace(/\/$/, '');
  const urls = paths
    .map((path) => `<url><loc>${origin}${path === '/' ? '/' : path}</loc></url>`)
    .join('');

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls,
    '</urlset>',
  ].join('');

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  });
};
