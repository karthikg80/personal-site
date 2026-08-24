const FORBIDDEN_TAGS = [
  'script',
  'iframe',
  'object',
  'embed',
  'form',
  'base',
  'link',
  'meta',
  'style',
  'svg',
  'math',
] as const;

const URL_ATTRS = new Set(['href', 'src', 'poster', 'action', 'formaction', 'xlink:href']);

export function prepareReviewBodyHtml(
  html: string,
  input: { futureUrl: string }
): string {
  let out = html.replace(/<!--[\s\S]*?-->/g, '');
  for (const tag of FORBIDDEN_TAGS) {
    out = out.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi'), '');
    out = out.replace(new RegExp(`<${tag}\\b[^>]*\\/?>`, 'gi'), '');
  }
  return out.replace(/<([a-zA-Z][a-zA-Z0-9:-]*)(\s[^>]*?)(\/?)>/g, (_full, name: string, attrs: string, slash: string) => {
    return `<${name}${rewriteAttrs(attrs, input.futureUrl)}${slash}>`;
  });
}

function rewriteAttrs(raw: string, futureUrl: string): string {
  return raw.replace(
    /\s([^\s=/>]+)(\s*=\s*)(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g,
    (full, name: string, eq: string, double?: string, single?: string, unquoted?: string) => {
      const attr = name.toLowerCase();
      if (attr.startsWith('on') || attr === 'srcdoc') return '';
      const value = double ?? single ?? unquoted ?? '';
      const quote = double !== undefined ? '"' : single !== undefined ? "'" : '';
      if (URL_ATTRS.has(attr) || attr === 'srcset') {
        if (attr === 'srcset') {
          const next = rewriteSrcset(value, futureUrl);
          if (next === null) return '';
          return quote ? ` ${name}${eq}${quote}${escapeAttr(next)}${quote}` : ` ${name}${eq}${escapeAttr(next)}`;
        }
        const next = rewriteUrl(value, futureUrl);
        if (next === null) return '';
        return quote ? ` ${name}${eq}${quote}${escapeAttr(next)}${quote}` : ` ${name}${eq}${escapeAttr(next)}`;
      }
      return full;
    }
  );
}

function rewriteSrcset(value: string, futureUrl: string): string | null {
  const parts = value.split(',').map((entry) => entry.trim()).filter(Boolean);
  const rewritten: string[] = [];
  for (const part of parts) {
    const [url, ...rest] = part.split(/\s+/);
    if (!url) continue;
    const next = rewriteUrl(url, futureUrl);
    if (next === null) return null;
    rewritten.push([next, ...rest].join(' '));
  }
  return rewritten.join(', ');
}

export function rewriteUrl(value: string, futureUrl: string): string | null {
  const trimmed = value.trim();
  if (trimmed === '' || trimmed.startsWith('#')) return trimmed;

  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('javascript:')
    || lower.startsWith('vbscript:')
    || lower.startsWith('data:')
    || lower.startsWith('file:')
  ) {
    return null;
  }

  if (trimmed.startsWith('//')) return null;

  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    if (lower.startsWith('https:') || lower.startsWith('http:') || lower.startsWith('mailto:')) {
      return trimmed;
    }
    return null;
  }

  if (trimmed.startsWith('/')) return trimmed;

  try {
    return new URL(trimmed, futureUrl).toString();
  } catch {
    return null;
  }
}

function escapeAttr(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
    .replaceAll('<', '&lt;');
}
