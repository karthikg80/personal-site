import type { APIRoute } from 'astro';

import {
  draftingSession,
  isAllowedDraftingOrigin,
  isDraftingConfigured,
  verifyDraftingSession,
} from '../../../lib/drafting-auth';
import { executePrepare } from '../../../lib/publishing/prepare-flow';

export const prerender = false;

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isDraftingConfigured()) return json({ error: 'Not found.' }, 404);
  if (!await verifyDraftingSession(cookies.get(draftingSession.cookieName)?.value)) {
    return json({ error: 'Your writing-room session has expired.' }, 401);
  }
  if (!isAllowedDraftingOrigin(request)) return json({ error: 'Invalid request origin.' }, 403);

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'The Prepare request could not be read.' }, 400);
  }

  const result = await executePrepare(payload);
  if (!result.ok) {
    return json({ error: result.error }, result.status);
  }

  console.info('drafting prepare', {
    slug: result.slug,
    objectId: result.objectId,
    result: result.created ? 'created' : 'updated',
  });

  return json({
    ok: true,
    slug: result.slug,
    objectId: result.objectId,
    blobSha: result.blobSha,
    commitSha: result.commitSha,
    url: result.url,
  });
};
