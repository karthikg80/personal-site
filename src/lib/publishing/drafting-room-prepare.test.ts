import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const draftingRoom = readFileSync(join(import.meta.dirname, '../../scripts/drafting-room.ts'), 'utf8');
const draftingPage = readFileSync(join(import.meta.dirname, '../../pages/drafting.astro'), 'utf8');

describe('Drafting Room Prepare wiring', () => {
  it('uses the allowlisted Prepare payload helper', () => {
    expect(draftingRoom).toContain('buildPrepareRequest');
    expect(draftingRoom).not.toMatch(/JSON\.stringify\(\{[\s\S]*draft:\s*(true|false)/);
    expect(draftingRoom).not.toMatch(/privacyReviewed:\s*(true|false)/);
  });

  it('does not mark Prepared on a 503 GitHub-token failure', () => {
    const handler = draftingRoom.slice(draftingRoom.indexOf("prepareButton.addEventListener"));
    const failClosed = handler.indexOf('response.status === 503');
    const applySuccess = handler.indexOf('applyPrepareSuccess');
    expect(failClosed).toBeGreaterThan(-1);
    expect(applySuccess).toBeGreaterThan(failClosed);
  });

  it('Copy/Download still goes through closed-gate handoff', () => {
    expect(draftingRoom).toContain('buildHandoffMarkdown');
    expect(draftingPage).toContain('id="privacy-acknowledgement"');
    expect(draftingPage).toContain('id="distribute-webmentions"');
    expect(draftingPage).toContain('id="distribute-bluesky"');
    expect(draftingPage).toContain('id="prepare-canonical"');
  });
});
