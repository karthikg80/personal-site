import { parseObjectId } from '../domain/ids.js';
import type {
  ContactMethod,
  ExternalIdentity,
  Organization,
  Person,
} from '../domain/person.js';

export type PersonStorageData = {
  id: string;
  siteUrl: string;
  name: string;
  displayName: string;
  tagline: string;
  avatarPath: string;
  organization: Organization;
  contactMethods: ContactMethod[];
  externalIdentities: ExternalIdentity[];
  interests: string[];
};

export function mapPerson(data: PersonStorageData): Person {
  return {
    id: parseObjectId(data.id),
    siteUrl: data.siteUrl,
    name: data.name,
    displayName: data.displayName,
    tagline: data.tagline,
    avatarPath: data.avatarPath,
    organization: { ...data.organization },
    contactMethods: data.contactMethods.map((method) => ({
      ...method,
      rel: method.rel ? [...method.rel] : undefined,
    })),
    externalIdentities: data.externalIdentities.map((identity) => ({
      ...identity,
      rel: [...identity.rel],
      identifiers: identity.identifiers ? { ...identity.identifiers } : undefined,
    })),
    interests: [...data.interests],
  };
}
