import { readFileSync } from 'node:fs';
import { flagString } from './query.js';

export const readJsonValue = (raw: string): unknown => {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new Error('Invalid JSON');
  }
};

export const readJsonFromFile = (path: string): unknown => {
  const text = readFileSync(path, 'utf8');
  return readJsonValue(text);
};

/**
 * Resolve a JSON payload from `--body` (inline JSON) or `--file` (path).
 * Exactly one must be provided unless `optional` is true.
 */
export const resolveJsonPayload = (
  flags: Record<string, string | boolean>,
  opts: { optional?: boolean; emptyObjectWhenMissing?: boolean } = {},
): unknown => {
  const body = flagString(flags, 'body');
  const file = flagString(flags, 'file');
  if (body && file) {
    throw new Error('Provide only one of --body or --file');
  }
  if (body) return readJsonValue(body);
  if (file) return readJsonFromFile(file);
  if (opts.optional) return opts.emptyObjectWhenMissing ? {} : undefined;
  throw new Error('Missing --body <json> or --file <path>');
};

export const requireFlag = (
  flags: Record<string, string | boolean>,
  name: string,
  label = `--${name}`,
): string => {
  const v = flagString(flags, name);
  if (!v) throw new Error(`Missing ${label}`);
  return v;
};
