import { describe, expect, it } from 'vitest';
import {
  RHEO_ASCII_LOGO,
  RHEO_ASCII_MARKER,
  formatBanner,
  printBanner,
  shouldPrintBanner,
} from './banner.js';

const ESC = String.fromCharCode(27);
const hasAnsi = (text: string): boolean => text.includes(ESC);

describe('banner', () => {
  it('includes a stable wordmark marker', () => {
    expect(RHEO_ASCII_LOGO).toContain(RHEO_ASCII_MARKER);
    expect(RHEO_ASCII_LOGO.trim().length).toBeGreaterThan(0);
    expect(RHEO_ASCII_LOGO.split('\n')).toHaveLength(5);
  });

  it('formatBanner keeps the wordmark and skips ANSI when color is off', () => {
    const text = formatBanner({ color: false });
    expect(text).toContain(RHEO_ASCII_MARKER);
    expect(hasAnsi(text)).toBe(false);
  });

  it('shouldPrintBanner requires a TTY', () => {
    expect(shouldPrintBanner({ isTTY: true })).toBe(true);
    expect(shouldPrintBanner({ isTTY: false })).toBe(false);
    expect(shouldPrintBanner({})).toBe(false);
  });

  it('printBanner writes on TTY and skips on pipes', () => {
    const ttyChunks: string[] = [];
    const tty = {
      isTTY: true,
      write: (chunk: string) => {
        ttyChunks.push(chunk);
        return true;
      },
    };
    printBanner(tty as unknown as NodeJS.WriteStream, { color: false });
    expect(ttyChunks.join('')).toContain(RHEO_ASCII_MARKER);

    const pipeChunks: string[] = [];
    const pipe = {
      isTTY: false,
      write: (chunk: string) => {
        pipeChunks.push(chunk);
        return true;
      },
    };
    printBanner(pipe as unknown as NodeJS.WriteStream, { color: false });
    expect(pipeChunks).toEqual([]);
  });

  it('printBanner still prints logo when color is disabled', () => {
    const chunks: string[] = [];
    const stream = {
      isTTY: true,
      write: (chunk: string) => {
        chunks.push(chunk);
        return true;
      },
    };
    printBanner(stream as unknown as NodeJS.WriteStream, { color: false });
    const out = chunks.join('');
    expect(out).toContain(RHEO_ASCII_MARKER);
    expect(hasAnsi(out)).toBe(false);
  });
});
