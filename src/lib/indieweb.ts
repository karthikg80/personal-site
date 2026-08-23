export type NoteKind = 'note' | 'scrap' | 'reply' | 'bookmark';

export type NoteClassification = {
  presentation?: 'note' | 'scrap';
  inReplyTo?: string;
  bookmarkOf?: string;
};

export function isPublishedNote(data: { draft: boolean; privacyReviewed: boolean }): boolean {
  return !data.draft && data.privacyReviewed;
}

export function classifyNote(data: NoteClassification): NoteKind {
  if (data.inReplyTo) return 'reply';
  if (data.bookmarkOf) return 'bookmark';
  if (data.presentation === 'scrap') return 'scrap';
  return 'note';
}

export function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function normalizeSyndicationUrl(url: string): string {
  return new URL(url).toString().replace(/\/$/, url.endsWith('/') ? '/' : '');
}

export function extractOutboundLinks(
  html: string,
  siteOrigin: string,
  extra: { inReplyTo?: string; bookmarkOf?: string } = {}
): string[] {
  const origin = siteOrigin.replace(/\/$/, '');
  const found = new Set<string>();

  for (const match of html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)) {
    addHttpUrl(found, match[1], origin);
  }

  addHttpUrl(found, extra.inReplyTo, origin);
  addHttpUrl(found, extra.bookmarkOf, origin);

  return [...found];
}

export function markdownToLinkHtml(markdown: string): string {
  return markdown.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>');
}

function addHttpUrl(found: Set<string>, value: string | undefined, siteOrigin: string): void {
  if (!value) return;

  let parsed: URL;
  try {
    parsed = new URL(value, `${siteOrigin}/`);
  } catch {
    return;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return;
  if (parsed.origin === siteOrigin) return;

  found.add(parsed.toString());
}

export function discoverWebmentionEndpoint(input: {
  target: string;
  headers: Record<string, string | null | undefined>;
  html: string;
}): string | null {
  const header = input.headers.link ?? input.headers.Link;
  if (header) {
    const fromHeader = endpointFromLinkHeader(header, input.target);
    if (fromHeader) return fromHeader;
  }

  const markup = input.html.match(
    /<(?:link|a)\s+[^>]*(?:rel=["'][^"']*webmention[^"']*["'][^>]*href=["']([^"']+)["']|href=["']([^"']+)["'][^>]*rel=["'][^"']*webmention[^"']*["'])[^>]*>/i
  );

  const href = markup?.[1] ?? markup?.[2];
  return href ? resolveUrl(href, input.target) : null;
}

function endpointFromLinkHeader(header: string, base: string): string | null {
  for (const part of header.split(',')) {
    const urlMatch = part.match(/<([^>]+)>/);
    const relMatch = part.match(/rel=["']?([^"';,]+)/i);
    if (!urlMatch || !relMatch) continue;

    const relations = relMatch[1].toLowerCase().split(/\s+/);
    if (relations.includes('webmention') || relations.includes('http://webmention.org/')) {
      return resolveUrl(urlMatch[1], base);
    }
  }

  return null;
}

function resolveUrl(value: string, base: string): string {
  return new URL(value, base).toString();
}

export function buildBlueskyPostText(input: {
  title: string;
  url: string;
  summary?: string;
}): { text: string } {
  const permalink = input.url;
  const reserve = permalink.length + 2;
  const limit = 300 - reserve;
  const summary = input.summary?.trim();
  let lead = input.title.trim();

  if (summary && lead.length + 3 + summary.length <= limit) {
    lead = `${lead}\n${summary}`;
  } else if (lead.length > limit) {
    lead = `${lead.slice(0, Math.max(1, limit - 1)).trimEnd()}…`;
  }

  return { text: `${lead}\n\n${permalink}` };
}

export function webmentionReceiverUrl(domain = 'karthikg.in'): string {
  return `https://webmention.io/${domain}/webmention`;
}

export function webmentionFeedUrl(target: string): string {
  return `https://webmention.io/api/mentions.jf2?per-page=50&target=${encodeURIComponent(target)}`;
}

export async function sendWebmention(endpoint: string, source: string, target: string): Promise<number> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'karthikg.in webmention sender',
    },
    body: new URLSearchParams({ source, target }),
  });

  return response.status;
}
