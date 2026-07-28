import { cyan, supportsColor } from './format.js';

/** Rheo wordmark block art for interactive CLI banners. */
export const RHEO_ASCII_LOGO = [
  "'||'''|, '||",
  ' ||   ||  ||',
  " ||...|'  ||''|, .|''|, .|''|,",
  ' || \\\\    ||  || ||..|| ||  ||',
  ".||  \\\\. .||  || `|...  `|..|'",
].join('\n');

/** Stable substring used by tests to assert the wordmark is present. */
export const RHEO_ASCII_MARKER = "'||'''|, '||";

/** True when a banner should print (interactive TTY; not gated on color). */
export const shouldPrintBanner = (
  stream: { isTTY?: boolean } = process.stdout,
): boolean => Boolean(stream.isTTY);

export const formatBanner = (opts?: { color?: boolean }): string => {
  const color = opts?.color ?? supportsColor();
  return cyan(RHEO_ASCII_LOGO, color);
};

export const printBanner = (
  stream: NodeJS.WritableStream & { isTTY?: boolean } = process.stdout,
  opts?: { color?: boolean },
): void => {
  if (!shouldPrintBanner(stream)) return;
  const color =
    opts?.color ??
    (stream === process.stderr
      ? supportsColor(process.stderr)
      : supportsColor(process.stdout));
  stream.write(`${formatBanner({ color })}\n\n`);
};
