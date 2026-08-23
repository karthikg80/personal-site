const SESSION_COOKIE = 'kg_drafting_session';
const SESSION_LIFETIME_SECONDS = 60 * 60 * 12;
const encoder = new TextEncoder();

type DraftingSecrets = {
  accessKey: string;
  sessionSecret: string;
};

function getSecrets(): DraftingSecrets | null {
  const accessKey = process.env.DRAFTING_ACCESS_KEY?.trim();
  const sessionSecret = process.env.DRAFTING_SESSION_SECRET?.trim();

  if (!accessKey || !sessionSecret || accessKey.length < 16 || sessionSecret.length < 32) {
    return null;
  }

  return { accessKey, sessionSecret };
}

function toBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64url');
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  const length = Math.max(leftBytes.length, rightBytes.length);
  let difference = leftBytes.length ^ rightBytes.length;

  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }

  return difference === 0;
}

async function sign(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return toBase64Url(new Uint8Array(signature));
}

export function isDraftingConfigured(): boolean {
  return getSecrets() !== null;
}

export function isLocalDraftingBypass(): boolean {
  return import.meta.env.DEV && !isDraftingConfigured();
}

export function verifyDraftingAccessKey(candidate: string): boolean {
  const secrets = getSecrets();
  return secrets ? constantTimeEqual(candidate, secrets.accessKey) : false;
}

export async function createDraftingSession(): Promise<string> {
  const secrets = getSecrets();
  if (!secrets) throw new Error('Drafting room is not configured.');

  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_LIFETIME_SECONDS;
  const payload = `v1.${expiresAt}`;
  return `${payload}.${await sign(payload, secrets.sessionSecret)}`;
}

export async function verifyDraftingSession(token: string | undefined): Promise<boolean> {
  const secrets = getSecrets();
  if (!secrets || !token) return false;

  const [version, expiresAtRaw, signature] = token.split('.');
  const expiresAt = Number(expiresAtRaw);
  if (version !== 'v1' || !signature || !Number.isSafeInteger(expiresAt)) return false;
  if (expiresAt <= Math.floor(Date.now() / 1000)) return false;

  const payload = `${version}.${expiresAt}`;
  const expected = await sign(payload, secrets.sessionSecret);
  return constantTimeEqual(signature, expected);
}

export function isAllowedDraftingOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;

  if (origin === 'https://karthikg.in') return true;
  if (!import.meta.env.DEV) return false;

  try {
    const parsed = new URL(origin);
    return parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname);
  } catch {
    return false;
  }
}

export const draftingSession = {
  cookieName: SESSION_COOKIE,
  maxAge: SESSION_LIFETIME_SECONDS,
};
