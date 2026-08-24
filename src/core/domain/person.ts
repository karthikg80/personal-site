import type { ObjectId } from './ids.js';

export interface Organization {
  name: string;
  url: string;
}

export interface ContactMethod {
  kind: 'email' | 'url';
  value: string;
  label?: string;
  rel?: string[];
}

export interface ExternalIdentity {
  kind: string;
  label: string;
  url: string;
  rel: string[];
  identifiers?: Record<string, string>;
}

export interface Person {
  id: ObjectId;
  siteUrl: string;
  /** Full canonical name used in titles, copyright, and author h-cards. */
  name: string;
  /** Short public identity used in the homepage h-card p-name. */
  displayName: string;
  tagline: string;
  avatarPath: string;
  organization: Organization;
  contactMethods: ContactMethod[];
  externalIdentities: ExternalIdentity[];
  interests: string[];
}
