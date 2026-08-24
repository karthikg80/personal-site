import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';

import { mapPerson, type PersonStorageData } from '../storage/map-person.js';

describe('Person ATProto DID consistency', () => {
  it('keeps person.yaml DID equal to the static .well-known file', () => {
    const personRaw = readFileSync(
      join(import.meta.dirname, '../../content/person.yaml'),
      'utf8'
    );
    const person = mapPerson(parseYaml(personRaw) as PersonStorageData);
    const atproto = person.externalIdentities.find((identity) => identity.kind === 'atproto');
    const didFile = readFileSync(
      join(import.meta.dirname, '../../../public/.well-known/atproto-did'),
      'utf8'
    ).trim();

    expect(atproto?.identifiers?.did).toBe(didFile);
    expect(didFile).toBe('did:plc:k25m3ebqwdr32ojecqpjfzbh');
  });
});
