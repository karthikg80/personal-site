import type { APIRoute } from 'astro';

import {
  draftingSession,
  isDraftingConfigured,
  verifyDraftingSession,
} from '../../../lib/drafting-auth';
import { executeCanonicalLookup } from '../../../lib/publishing/publish-flow';

export const prerender = false;

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
    },
  });
}

export const GET: APIRoute = async ({ request, cookies }) => {
  if (!isDraftingConfigured()) return json({ error: 'Not found.' }, 404);
  if (!await verifyDraftingSession(cookies.get(draftingSession.cookieName)?.value)) {
    return json({ error: 'Not found.' }, 404);
  }

  const url = new URL(request.url);
  const id = url.searchParams.get('id') ?? '';
  const slug = url.searchParams.get('slug') ?? undefined;

  const result = await executeCanonicalLookup(id, slug);
  if (!result.ok) {
    return json({ error: result.error }, result.status);
  }

  return json({
    id: result.id,
    slug: result.slug,
    draft: result.draft,
    privacyReviewed: result.privacyReviewed,
    sha: result.sha,
    url: result.url,
  });
};
