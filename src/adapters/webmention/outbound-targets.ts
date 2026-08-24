export function extractOutboundLinks(
  html: string,
  siteOrigin: string,
  relationshipUrls: string[] = []
): string[] {
  const origin = siteOrigin.replace(/\/$/, '');
  const found = new Set<string>();

  for (const match of html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)) {
    addHttpUrl(found, match[1], origin);
  }

  for (const url of relationshipUrls) {
    addHttpUrl(found, url, origin);
  }

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
