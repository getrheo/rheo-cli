export const buildQueryPath = (
  path: string,
  query: Record<string, string | number | boolean | undefined | null>,
): string => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  if (!qs) return path;
  return `${path}?${qs}`;
};

export type SdkEnvironment = 'test' | 'live';

export const parseEnvironment = (raw: string | undefined, fallback: SdkEnvironment = 'live'): SdkEnvironment => {
  const v = (raw ?? fallback).trim().toLowerCase();
  if (v !== 'test' && v !== 'live') {
    throw new Error(`--env must be test or live (got ${raw})`);
  }
  return v;
};

export const flagString = (
  flags: Record<string, string | boolean>,
  name: string,
): string | undefined => {
  const v = flags[name];
  return typeof v === 'string' ? v : undefined;
};

export const flagBool = (flags: Record<string, string | boolean>, name: string): boolean =>
  flags[name] === true || flags[name] === 'true';
