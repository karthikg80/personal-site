import type { ContactMethod, ExternalIdentity, Person } from '../../core/domain/person.js';
import { absoluteUrl } from '../routing/paths.js';
import { hostLabel } from './host-label.js';

export type RelMeLink = {
  href: string;
  /** Space-separated rel tokens, matching historical head markup. */
  rel: string;
};

/**
 * Layout <head> order before M5:
 * github → atproto → linkedin → website → mailto email
 */
const HEAD_EXTERNAL_KIND_ORDER = ['github', 'atproto', 'linkedin', 'website'] as const;

/**
 * Contact page card order before M5:
 * email → Bluesky → GitHub → LinkedIn → Thea Foundry
 */
const CONTACT_EXTERNAL_KIND_ORDER = ['atproto', 'github', 'linkedin', 'website'] as const;

export function primaryEmail(person: Person): ContactMethod | undefined {
  return person.contactMethods.find((method) => method.kind === 'email');
}

export function externalIdentity(person: Person, kind: string): ExternalIdentity | undefined {
  return person.externalIdentities.find((identity) => identity.kind === kind);
}

export function mailtoHref(email: string): string {
  return `mailto:${email}`;
}

export function headRelMeLinks(person: Person): RelMeLink[] {
  const links: RelMeLink[] = [];

  for (const kind of HEAD_EXTERNAL_KIND_ORDER) {
    const identity = externalIdentity(person, kind);
    if (!identity) continue;
    links.push({
      href: identity.url,
      rel: identity.rel.join(' '),
    });
  }

  const email = primaryEmail(person);
  if (email?.rel?.includes('me')) {
    links.push({
      href: mailtoHref(email.value),
      rel: email.rel.join(' '),
    });
  }

  return links;
}

export type ContactCardModel = {
  kind: string;
  href: string;
  rel: string;
  label: string;
  detail: string;
  className?: string;
  openInNewTab: boolean;
};

function contactDetailFor(identity: ExternalIdentity): string {
  if (identity.kind === 'atproto') {
    const handle = identity.identifiers?.handle;
    return handle ? `@${handle}` : identity.url;
  }
  if (identity.kind === 'github') {
    try {
      return new URL(identity.url).pathname.replace(/^\//, '');
    } catch {
      return identity.label;
    }
  }
  if (identity.kind === 'linkedin') {
    return 'Connect professionally';
  }
  if (identity.kind === 'website') {
    return hostLabel(identity.url);
  }
  return identity.label;
}

/**
 * Presentation projection for /contact cards.
 * Icons stay in the page; this only maps Person facts → existing card fields.
 */
export function contactPageCards(person: Person): ContactCardModel[] {
  const cards: ContactCardModel[] = [];
  const email = primaryEmail(person);

  if (email) {
    cards.push({
      kind: 'email',
      href: mailtoHref(email.value),
      rel: (email.rel ?? ['me']).join(' '),
      label: 'Email',
      detail: email.value,
      className: 'u-email',
      openInNewTab: false,
    });
  }

  for (const kind of CONTACT_EXTERNAL_KIND_ORDER) {
    const identity = externalIdentity(person, kind);
    if (!identity) continue;
    cards.push({
      kind: identity.kind,
      href: identity.url,
      rel: [...identity.rel, 'noopener', 'noreferrer'].join(' '),
      label: identity.label,
      detail: contactDetailFor(identity),
      openInNewTab: true,
    });
  }

  return cards;
}

export function siteDisplayHost(person: Person): string {
  return hostLabel(person.siteUrl);
}

/** Absolute avatar URL for h-card photo/logo (IndieWebify and Bridgy prefer absolutes). */
export function personAvatarUrl(person: Person): string {
  if (/^https?:\/\//i.test(person.avatarPath)) return person.avatarPath;
  return absoluteUrl(person.siteUrl, person.avatarPath.startsWith('/') ? person.avatarPath : `/${person.avatarPath}`);
}
