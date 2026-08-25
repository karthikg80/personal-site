import { loadGithubEventPayload, runDistributePublishedNote } from '../lib/publishing/distribute-flow.js';

const payload = await loadGithubEventPayload();
const commitSha = process.env.DISTRIBUTE_COMMIT?.trim() || undefined;

await runDistributePublishedNote({ payload, commitSha });
