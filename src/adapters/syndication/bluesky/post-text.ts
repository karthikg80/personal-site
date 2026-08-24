const BLUESKY_POST_LIMIT = 300;

export function buildBlueskyPostText(input: {
  title: string;
  url: string;
  summary?: string;
}): { text: string } {
  const permalink = input.url;
  const reserve = permalink.length + 2;
  const limit = BLUESKY_POST_LIMIT - reserve;
  const summary = input.summary?.trim();
  let lead = input.title.trim();

  if (summary && lead.length + 3 + summary.length <= limit) {
    lead = `${lead}\n${summary}`;
  } else if (lead.length > limit) {
    lead = `${lead.slice(0, Math.max(1, limit - 1)).trimEnd()}…`;
  }

  return { text: `${lead}\n\n${permalink}` };
}
