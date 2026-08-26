/** Rare editorial stamps — presentation vocabulary only, not note kind. */

export const NOTE_STAMPS = ['first-go', 'still-thinking', 'revised', 'short-one'] as const;

export type NoteStamp = (typeof NOTE_STAMPS)[number];

const STAMP_LABELS: Record<NoteStamp, string> = {
  'first-go': 'first go',
  'still-thinking': 'still thinking',
  revised: 'revised',
  'short-one': 'short one',
};

export function isNoteStamp(value: unknown): value is NoteStamp {
  return typeof value === 'string' && (NOTE_STAMPS as readonly string[]).includes(value);
}

export function stampLabel(stamp: NoteStamp): string {
  return STAMP_LABELS[stamp];
}
