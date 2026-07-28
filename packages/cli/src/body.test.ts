import { describe, expect, it } from 'vitest';
import { readJsonValue, resolveJsonPayload } from './body.js';

describe('readJsonValue', () => {
  it('parses objects', () => {
    expect(readJsonValue('{"a":1}')).toEqual({ a: 1 });
  });

  it('rejects invalid JSON', () => {
    expect(() => readJsonValue('{')).toThrow(/Invalid JSON/);
  });
});

describe('resolveJsonPayload', () => {
  it('reads --body', () => {
    expect(resolveJsonPayload({ body: '{"name":"x"}' })).toEqual({ name: 'x' });
  });

  it('rejects both --body and --file', () => {
    expect(() => resolveJsonPayload({ body: '{}', file: 'x.json' })).toThrow(/only one/);
  });

  it('allows optional empty object', () => {
    expect(resolveJsonPayload({}, { optional: true, emptyObjectWhenMissing: true })).toEqual({});
  });
});
