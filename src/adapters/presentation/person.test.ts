import { describe, expect, it } from 'vitest';

import { parseObjectId } from '../../core/domain/ids.js';
import type { Person } from '../../core/domain/person.js';
import {
  contactPageCards,
  externalIdentity,
  headRelMeLinks,
  primaryEmail,
  siteDisplayHost,
} from './person.js';

const person: Person = {
  id: parseObjectId('01a03192-07db-70a9-a4da-03a139669a11'),
  siteUrl: 'https://karthikg.in',
  name: 'Karthik Gurumoorthy',
  displayName: 'Karthik',
  tagline: 'I build useful software for families and everyday life.',
  avatarPath: '/avatar.svg',
  organization: { name: 'Thea Foundry', url: 'https://theafoundry.com' },
  contactMethods: [{ kind: 'email', value: 'karthi@hey.com', rel: ['me'] }],
  externalIdentities: [
    {
      kind: 'github',
      label: 'GitHub',
      url: 'https://github.com/karthikg80',
      rel: ['me'],
    },
    {
      kind: 'atproto',
      label: 'Bluesky',
      url: 'https://bsky.app/profile/karthikg.in',
      rel: ['me', 'atproto'],
      identifiers: {
        handle: 'karthikg.in',
        did: 'did:plc:k25m3ebqwdr32ojecqpjfzbh',
      },
    },
    {
      kind: 'linkedin',
      label: 'LinkedIn',
      url: 'https://www.linkedin.com/in/karthikg80/',
      rel: ['me'],
    },
    {
      kind: 'website',
      label: 'Thea Foundry',
      url: 'https://theafoundry.com',
      rel: ['me'],
    },
  ],
  interests: ['personal web'],
};

describe('headRelMeLinks', () => {
  it('emits historical Layout head order and rel values', () => {
    expect(headRelMeLinks(person)).toEqual([
      { href: 'https://github.com/karthikg80', rel: 'me' },
      { href: 'https://bsky.app/profile/karthikg.in', rel: 'me atproto' },
      { href: 'https://www.linkedin.com/in/karthikg80/', rel: 'me' },
      { href: 'https://theafoundry.com', rel: 'me' },
      { href: 'mailto:karthi@hey.com', rel: 'me' },
    ]);
  });

  it('does not duplicate identity URLs', () => {
    const hrefs = headRelMeLinks(person).map((link) => link.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});

describe('contactPageCards', () => {
  it('emits historical contact card order, labels, and rel values', () => {
    expect(contactPageCards(person)).toEqual([
      {
        kind: 'email',
        href: 'mailto:karthi@hey.com',
        rel: 'me',
        label: 'Email',
        detail: 'karthi@hey.com',
        className: 'u-email',
        openInNewTab: false,
      },
      {
        kind: 'atproto',
        href: 'https://bsky.app/profile/karthikg.in',
        rel: 'me atproto noopener noreferrer',
        label: 'Bluesky',
        detail: '@karthikg.in',
        openInNewTab: true,
      },
      {
        kind: 'github',
        href: 'https://github.com/karthikg80',
        rel: 'me noopener noreferrer',
        label: 'GitHub',
        detail: 'karthikg80',
        openInNewTab: true,
      },
      {
        kind: 'linkedin',
        href: 'https://www.linkedin.com/in/karthikg80/',
        rel: 'me noopener noreferrer',
        label: 'LinkedIn',
        detail: 'Connect professionally',
        openInNewTab: true,
      },
      {
        kind: 'website',
        href: 'https://theafoundry.com',
        rel: 'me noopener noreferrer',
        label: 'Thea Foundry',
        detail: 'theafoundry.com',
        openInNewTab: true,
      },
    ]);
  });
});

describe('Person presentation helpers', () => {
  it('exposes primary email and ATProto identity metadata', () => {
    expect(primaryEmail(person)?.value).toBe('karthi@hey.com');
    expect(externalIdentity(person, 'atproto')?.identifiers).toEqual({
      handle: 'karthikg.in',
      did: 'did:plc:k25m3ebqwdr32ojecqpjfzbh',
    });
    expect(siteDisplayHost(person)).toBe('karthikg.in');
  });
});
