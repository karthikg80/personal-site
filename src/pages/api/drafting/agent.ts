import type { APIRoute } from 'astro';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import {
  draftingSession,
  isAllowedDraftingOrigin,
  isLocalDraftingBypass,
  verifyDraftingSession,
} from '../../../lib/drafting-auth';

export const prerender = false;

const modes = {
  interview: 'Ask four short, specific questions that could reveal concrete details, tension, or uncertainty. Do not draft the note yet.',
  shapes: 'Offer three genuinely different possible shapes for this material. Keep each shape concise and explain what it foregrounds.',
  draft: 'Shape the material into a short personal note. Preserve uncertainty and unusual phrasing. Do not add facts, scenes, feelings, or conclusions.',
  privacy: 'Perform a strict privacy and factual review. List concrete concerns, unsupported claims, timing risks, and safer rewrites. Say clearly when no concern is found.',
  voice: 'Reflect on the voice. Identify what feels natural, what may feel performed, and one experiment for the next revision. Do not prescribe a permanent house style.',
  custom: 'Respond to the writer’s request while following the editorial and privacy contract.',
} as const;

type AgentMode = keyof typeof modes;

type AgentPayload = {
  mode?: unknown;
  title?: unknown;
  sparks?: unknown;
  draft?: unknown;
  message?: unknown;
  conversation?: unknown;
};

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function cleanText(value: unknown, maximum: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maximum) : '';
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const authorized = isLocalDraftingBypass()
    || await verifyDraftingSession(cookies.get(draftingSession.cookieName)?.value);

  if (!authorized) return json({ error: 'Your writing-room session has expired.' }, 401);
  if (!isAllowedDraftingOrigin(request)) return json({ error: 'Invalid request origin.' }, 403);

  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > 64_000) return json({ error: 'This request is too large for the writing room.' }, 413);

  let payload: AgentPayload;
  try {
    payload = await request.json() as AgentPayload;
  } catch {
    return json({ error: 'The agent request could not be read.' }, 400);
  }

  const mode = typeof payload.mode === 'string' && payload.mode in modes
    ? payload.mode as AgentMode
    : null;
  if (!mode) return json({ error: 'Choose a valid agent move.' }, 400);

  const title = cleanText(payload.title, 160);
  const sparks = cleanText(payload.sparks, 8_000);
  const draft = cleanText(payload.draft, 14_000);
  const message = cleanText(payload.message, 2_000);
  const conversation = Array.isArray(payload.conversation)
    ? payload.conversation.slice(-6).map((item) => cleanText(item, 1_500)).filter(Boolean)
    : [];

  if (!sparks && !draft && !message) {
    return json({ error: 'Add an observation or a question before asking the agent.' }, 400);
  }

  if (!process.env.OPENAI_API_KEY) {
    return json({ error: 'The agent connection has not been configured yet.' }, 503);
  }

  const prompt = [
    `Requested move: ${modes[mode]}`,
    title ? `Working title:\n${title}` : '',
    sparks ? `Private observations supplied for this request:\n${sparks}` : '',
    draft ? `Current draft:\n${draft}` : '',
    conversation.length > 0 ? `Recent agent exchange:\n${conversation.join('\n\n')}` : '',
    message ? `Writer's request:\n${message}` : '',
  ].filter(Boolean).join('\n\n---\n\n');

  try {
    const result = await generateText({
      model: openai.responses(process.env.DRAFTING_MODEL ?? 'gpt-5.6-luna'),
      instructions: [
        'You are Karthik’s editorial collaborator inside a private drafting room.',
        'Use only firsthand material supplied in this request. Never invent experiences, opinions, facts, certainty, or a neat conclusion.',
        'Do not imitate any named writer. Help the writer discover an evolving voice through concrete questions and meaningfully different shapes.',
        'Prefer plain language, fragments, lists, and honest uncertainty when they fit.',
        'Treat family details, children, locations, schedules, health, finances, employers, customers, credentials, private documents, and other people’s stories as sensitive.',
        'Nothing you produce is approved for publication. Do not claim that a privacy review or factual check is complete.',
      ].join(' '),
      prompt,
      maxOutputTokens: 1_500,
      timeout: 45_000,
      providerOptions: {
        openai: { store: false },
      },
    });

    return json({ text: result.text, mode });
  } catch (error) {
    console.error('Drafting agent request failed', error instanceof Error ? error.name : 'UnknownError');
    return json({ error: 'The agent could not respond just now. Your draft is still safe in this browser.' }, 502);
  }
};
