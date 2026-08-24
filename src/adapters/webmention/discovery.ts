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
