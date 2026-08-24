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
    status.textContent = 'publishing…';

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

      status.textContent = result.url ? `Published. ${result.url}` : 'Published.';
    } catch {
      status.textContent = 'Publish failed.';
      button.disabled = false;
    }
  });
}
