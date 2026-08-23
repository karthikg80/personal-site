import type { APIRoute } from 'astro';
import opmlSource from '../data/feeds.opml?raw';

export const GET: APIRoute = () =>
  new Response(opmlSource, {
    headers: {
      'Content-Type': 'text/x-opml; charset=utf-8',
      'Content-Disposition': 'inline; filename="feeds.opml"',
    },
  });
