export type Feed = {
  title: string;
  url: string;
};

export type FeedGroup = {
  title: string;
  feeds: Feed[];
};

function decodeEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'");
}

function attributes(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([A-Za-z_:][\w:.-]*)="([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(raw))) {
    out[match[1]] = decodeEntities(match[2]);
  }
  return out;
}

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    const path = parsed.pathname.replace(/\/$/, '');
    return `${parsed.protocol}//${parsed.host}${path}`.toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

function displayTitle(attrs: Record<string, string>, url: string): string {
  const title = attrs.title || attrs.text;
  if (title) return title;
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function parseOpml(xml: string): FeedGroup[] {
  const seen = new Set<string>();
  const groups: FeedGroup[] = [];
  const ungrouped: Feed[] = [];
  const stack: FeedGroup[] = [];

  const tokenRe = /<outline\b([^>]*?)\s*\/>|<outline\b([^>]*)>|<\/outline>/gi;
  let match: RegExpExecArray | null;

  while ((match = tokenRe.exec(xml))) {
    if (match[0].startsWith('</')) {
      stack.pop();
      continue;
    }

    const attrs = attributes(match[1] ?? match[2] ?? '');
    const feedUrl = attrs.xmlUrl;
    const siteUrl = attrs.htmlUrl || feedUrl;

    if (feedUrl || attrs.type === 'rss') {
      if (!siteUrl) continue;
      const key = normalizeUrl(feedUrl || siteUrl);
      if (seen.has(key)) continue;
      seen.add(key);

      const feed = { title: displayTitle(attrs, siteUrl), url: siteUrl };
      const parent = stack.at(-1);
      if (parent) parent.feeds.push(feed);
      else ungrouped.push(feed);
      continue;
    }

    const group: FeedGroup = {
      title: attrs.title || attrs.text || 'Untitled',
      feeds: [],
    };
    groups.push(group);
    stack.push(group);
  }

  const named = groups.filter((group) => group.feeds.length > 0);
  if (ungrouped.length > 0) {
    named.unshift({ title: 'Elsewhere', feeds: ungrouped });
  }
  return named;
}

export function feedCount(groups: FeedGroup[]): number {
  return groups.reduce((total, group) => total + group.feeds.length, 0);
}
