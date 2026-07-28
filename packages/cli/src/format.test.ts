import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  dim,
  printKv,
  printTable,
  supportsColor,
} from './format.js';

const ESC = String.fromCharCode(27);
const hasAnsi = (text: string): boolean => text.includes(ESC);

describe('supportsColor', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is false when NO_COLOR is set', () => {
    vi.stubEnv('NO_COLOR', '1');
    const stream = { isTTY: true } as NodeJS.WriteStream;
    expect(supportsColor(stream, { NO_COLOR: '1' })).toBe(false);
  });

  it('is true when FORCE_COLOR is set even without TTY', () => {
    const stream = { isTTY: false } as NodeJS.WriteStream;
    expect(supportsColor(stream, { FORCE_COLOR: '1' })).toBe(true);
  });

  it('follows TTY when neither env is set', () => {
    const tty = { isTTY: true } as NodeJS.WriteStream;
    const pipe = { isTTY: false } as NodeJS.WriteStream;
    expect(supportsColor(tty, {})).toBe(true);
    expect(supportsColor(pipe, {})).toBe(false);
  });
});

describe('printTable / printKv', () => {
  it('printTable renders plain header and rows when color is off', () => {
    const chunks: string[] = [];
    const write = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      chunks.push(String(chunk));
      return true;
    });
    printTable([{ id: 'a', name: 'App' }], { color: false });
    write.mockRestore();
    const out = chunks.join('');
    expect(out).toContain('id');
    expect(out).toContain('name');
    expect(out).toContain('a');
    expect(out).toContain('App');
    expect(hasAnsi(out)).toBe(false);
  });

  it('printTable prints (none) for empty rows', () => {
    const chunks: string[] = [];
    const write = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      chunks.push(String(chunk));
      return true;
    });
    printTable([], { color: false });
    write.mockRestore();
    expect(chunks.join('')).toBe('(none)\n');
  });

  it('printKv aligns keys without ANSI when color is off', () => {
    const chunks: string[] = [];
    const write = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      chunks.push(String(chunk));
      return true;
    });
    printKv(
      [
        ['id', 'abc'],
        ['name', 'App'],
      ],
      { color: false },
    );
    write.mockRestore();
    const out = chunks.join('');
    expect(out).toBe('id    abc\nname  App\n');
    expect(hasAnsi(out)).toBe(false);
  });

  it('dim wraps with ANSI only when enabled', () => {
    expect(dim('x', false)).toBe('x');
    expect(dim('x', true)).toBe(`${ESC}[2mx${ESC}[0m`);
  });
});
