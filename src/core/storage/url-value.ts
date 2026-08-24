/** Normalize Astro/Zod URL | string values to plain strings. */
export function asUrlString(value: string | URL): string {
  return typeof value === 'string' ? value : value.toString();
}

export function asOptionalUrlString(value: string | URL | undefined): string | undefined {
  if (value === undefined) return undefined;
  return asUrlString(value);
}
