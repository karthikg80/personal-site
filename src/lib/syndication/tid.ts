const S32 = '234567abcdefghijklmnopqrstuvwxyz';

function s32encode(value: number): string {
  if (value <= 0) return '';
  let remaining = value;
  let encoded = '';
  while (remaining > 0) {
    encoded = S32[remaining % 32] + encoded;
    remaining = Math.floor(remaining / 32);
  }
  return encoded;
}

function s32pad(value: number, length: number): string {
  const encoded = s32encode(value) || '2';
  return encoded.padStart(length, '2');
}

function uuidHex(uuid: string): string {
  return uuid.replaceAll('-', '').toLowerCase();
}

/** UUIDv7 unix timestamp in milliseconds (first 48 bits). */
export function uuidV7TimestampMs(uuid: string): number {
  return Number.parseInt(uuidHex(uuid).slice(0, 12), 16);
}

/** 10-bit clock id taken from UUIDv7 `rand_a`, so the TID is deterministic. */
export function uuidV7ClockId(uuid: string): number {
  return Number.parseInt(uuidHex(uuid).slice(13, 16), 16) & 0x3ff;
}

/**
 * Bluesky `app.bsky.feed.post` record keys must be TIDs, not raw UUIDs.
 * Same ObjectId always maps to the same 13-character TID.
 */
export function tidFromObjectId(objectId: string): string {
  const timestampUs = uuidV7TimestampMs(objectId) * 1000;
  const clockId = uuidV7ClockId(objectId);
  const tid = `${s32pad(timestampUs, 11)}${s32pad(clockId, 2)}`;
  if (!/^[234567abcdefghij][234567abcdefghijklmnopqrstuvwxyz]{12}$/.test(tid)) {
    throw new Error(`ObjectId did not produce a TID-compatible rkey: ${objectId}`);
  }
  return tid;
}
