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
      const inspectStep = document.querySelector<HTMLElement>('[data-review-step="inspect"]');
      const publishStep = document.querySelector<HTMLElement>('[data-review-step="publish"]');
      inspectStep?.classList.add('complete');
      inspectStep?.removeAttribute('aria-current');
      publishStep?.setAttribute('aria-current', 'step');
      const publishStepStatus = publishStep?.querySelector('small');
      if (publishStepStatus) publishStepStatus.textContent = 'committed';
      const publicationState = document.getElementById('review-publication-state');
      if (publicationState) publicationState.textContent = 'Publish committed · Deployment pending';
    } catch {
      status.textContent = 'Publish failed.';
      button.disabled = false;
    }
  });
}
