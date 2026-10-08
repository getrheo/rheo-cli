export type QueryValue = string | number | boolean | null | undefined;

/** Repeated keys are OR lists (product analytics cross filters). */
export type QueryParams = Record<string, QueryValue | readonly QueryValue[]>;

export const appendQueryParams = (params: URLSearchParams, query: QueryParams): void => {
  for (const [key, value] of Object.entries(query)) {
    const values = Array.isArray(value) ? value : [value];
    for (const item of values) {
      if (item === undefined || item === null || item === '') continue;
      params.append(key, String(item));
    }
  }
};

export const buildQueryPath = (path: string, query: QueryParams): string => {
  const params = new URLSearchParams();
  appendQueryParams(params, query);
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

export type CliFlagValue = string | boolean | string[];

export type CliFlags = Record<string, CliFlagValue>;

export const flagString = (flags: CliFlags, name: string): string | undefined => {
  const v = flags[name];
  return typeof v === 'string' ? v : undefined;
};

/** Values for a repeated flag. A single string is one value. */
export const flagStrings = (flags: CliFlags, name: string): string[] => {
  const v = flags[name];
  if (typeof v === 'string') return v.length > 0 ? [v] : [];
  if (Array.isArray(v)) return v.filter((item) => item.length > 0);
  return [];
};

export const flagBool = (flags: CliFlags, name: string): boolean =>
  flags[name] === true || flags[name] === 'true';
