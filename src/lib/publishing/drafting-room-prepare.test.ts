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
    expect(draftingPage).toContain('id="prepare-reply-to"');
    expect(draftingPage).toContain('id="prepare-canonical"');
  });

  it('Prepare sends reply-to from the room instead of wiping relationships', () => {
    expect(draftingRoom).toContain('replyToUrl:');
    expect(draftingRoom).toContain('relationshipsFromReplyToUrl');
    expect(draftingRoom).not.toMatch(/relationships:\s*\[\s*\]/);
  });

  it('shows Gather, Shape, Review, and Prepare one stage at a time', () => {
    expect(draftingPage).toContain('id="stage-progress-label"');
    expect(draftingPage).toContain('data-panel="gather"');
    expect(draftingPage).toContain('data-panel="shape" hidden');
    expect(draftingPage).toContain('data-panel="review" hidden');
    expect(draftingPage).toContain('data-panel="prepare" hidden');
    expect(draftingPage).not.toContain('class="workflow-map');
    expect(draftingPage).not.toContain('class="stage-button');
    expect(draftingRoom).toContain("type WritingStage = 'gather' | 'shape' | 'review' | 'prepare'");
    expect(draftingRoom).toContain('activeStage?: WritingStage');
  });
});
