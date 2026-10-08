import { describe, expect, it } from 'vitest';
import { preferJson } from './output.js';

describe('preferJson', () => {
  it('honors --json over TTY and --table', () => {
    expect(preferJson({ json: true, table: true }, { isTTY: true })).toBe(true);
    expect(preferJson({ json: true }, { isTTY: true })).toBe(true);
  });

  it('honors --table when --json is off', () => {
    expect(preferJson({ table: true }, { isTTY: false })).toBe(false);
  });

  it('defaults to JSON when stdout is not a TTY', () => {
    expect(preferJson({}, { isTTY: false })).toBe(true);
    expect(preferJson({}, { isTTY: true })).toBe(false);
  });
});
