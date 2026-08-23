import type { APIRoute } from 'astro';
import {
  createDraftingSession,
  draftingSession,
  isAllowedDraftingOrigin,
  isDraftingConfigured,
  verifyDraftingAccessKey,
} from '../../../lib/drafting-auth';

export const prerender = false;

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isDraftingConfigured()) return json({ error: 'Not found.' }, 404);
  if (!isAllowedDraftingOrigin(request)) return json({ error: 'Invalid request origin.' }, 403);

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'Enter the access phrase.' }, 400);
  }

  const accessKey = typeof payload === 'object' && payload !== null && 'accessKey' in payload
    ? String(payload.accessKey)
    : '';

  if (!verifyDraftingAccessKey(accessKey)) {
    await new Promise((resolve) => setTimeout(resolve, 450));
    return json({ error: 'That access phrase did not work.' }, 401);
  }

  cookies.set(draftingSession.cookieName, await createDraftingSession(), {
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: 'strict',
    path: '/',
    maxAge: draftingSession.maxAge,
  });

  return json({ ok: true });
};

export const DELETE: APIRoute = async ({ request, cookies }) => {
  if (!isAllowedDraftingOrigin(request)) return json({ error: 'Invalid request origin.' }, 403);

  cookies.delete(draftingSession.cookieName, { path: '/' });
  return json({ ok: true });
};
