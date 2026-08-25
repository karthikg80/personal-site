import { buildPublishRequest } from '../lib/publishing/drafting-prepare-state';

const button = document.querySelector<HTMLButtonElement>('[data-publish]');
const status = document.getElementById('publish-status');
if (button && status) {
  button.addEventListener('click', async () => {
    const payload = buildPublishRequest({
      objectId: button.dataset.objectId ?? '',
      slug: button.dataset.slug ?? '',
      expectedBlobSha: button.dataset.expectedBlobSha ?? '',
    });

    button.disabled = true;
    status.textContent = 'publishing this revision…';

    try {
      const response = await fetch('/api/drafting/publish', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json() as { ok?: boolean; error?: string; url?: string };

      if (response.status === 409) {
        status.textContent = result.error ?? 'The canonical file changed. Reloading…';
        window.location.reload();
        return;
      }

      if (!response.ok || !result.ok) {
        status.textContent = result.error ?? 'Publish failed.';
        button.disabled = false;
        return;
      }

      status.textContent = result.url
        ? `Publish committed. The public page will appear after deploy: ${result.url}`
        : 'Publish committed. The public page will appear after deploy.';
      button.hidden = true;
      const stageLabel = document.getElementById('review-stage-label');
      const stageName = document.getElementById('review-stage-name');
      const progress = document.getElementById('review-progress');
      const progressBar = document.getElementById('review-progress-bar');
      if (stageLabel) stageLabel.textContent = 'Step 4 of 4';
      if (stageName) stageName.textContent = 'Publish';
      progress?.setAttribute('aria-valuenow', '4');
      if (progressBar) progressBar.style.width = '100%';
      const publicationState = document.getElementById('review-publication-state');
      if (publicationState) publicationState.textContent = 'Publish committed · Deployment pending';
    } catch {
      status.textContent = 'Publish failed.';
      button.disabled = false;
    }
  });
}
