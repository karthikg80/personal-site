const WEBMENTION_IO_ORIGIN = 'https://webmention.io';

export function webmentionReceiverUrl(domain = 'karthikg.in'): string {
  return `${WEBMENTION_IO_ORIGIN}/${domain}/webmention`;
}

export function webmentionPingbackUrl(domain = 'karthikg.in'): string {
  return `${WEBMENTION_IO_ORIGIN}/${domain}/xmlrpc`;
}

export function webmentionFeedUrl(target: string): string {
  return `${WEBMENTION_IO_ORIGIN}/api/mentions.jf2?per-page=50&target=${encodeURIComponent(target)}`;
}
