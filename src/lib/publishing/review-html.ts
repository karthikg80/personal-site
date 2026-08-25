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

const ALLOWED_URL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

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
  const decoded = decodeHtmlAttr(value).trim();
  if (decoded === '' || decoded.startsWith('#')) return decoded;
  // Keep site-absolute paths as written so review can differ from production.
  if (decoded.startsWith('/') && !decoded.startsWith('//')) return decoded;

  try {
    const url = new URL(decoded, futureUrl);
    if (!ALLOWED_URL_PROTOCOLS.has(url.protocol)) return null;
    return url.href;
  } catch {
    return null;
  }
}

function decodeHtmlAttr(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt);/gi, (entity, name: string) => {
    const lower = name.toLowerCase();
    if (lower === 'amp') return '&';
    if (lower === 'quot') return '"';
    if (lower === 'apos') return "'";
    if (lower === 'lt') return '<';
    if (lower === 'gt') return '>';
    const code = lower.startsWith('#x')
      ? Number.parseInt(lower.slice(2), 16)
      : Number.parseInt(lower.slice(1), 10);
    if (!Number.isInteger(code) || code < 0 || code > 0x10ffff) return entity;
    try {
      return String.fromCodePoint(code);
    } catch {
      return entity;
    }
  });
}

function escapeAttr(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
    .replaceAll('<', '&lt;');
}
