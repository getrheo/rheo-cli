const ESC = '\u001b[';
const RESET = `${ESC}0m`;

const isTruthyForceColor = (value: string | undefined): boolean => {
  if (value === undefined || value === '') return false;
  return value !== '0';
};

/** True when ANSI color is allowed for the given stream (default: stdout). */
export const supportsColor = (
  stream: NodeJS.WriteStream = process.stdout,
  env: NodeJS.ProcessEnv = process.env,
): boolean => {
  if (env.NO_COLOR !== undefined && env.NO_COLOR !== '') return false;
  if (isTruthyForceColor(env.FORCE_COLOR)) return true;
  return Boolean(stream.isTTY);
};

const paint = (code: string, text: string, enabled: boolean): string =>
  enabled ? `${ESC}${code}m${text}${RESET}` : text;

export const dim = (text: string, enabled = supportsColor()): string => paint('2', text, enabled);

export const bold = (text: string, enabled = supportsColor()): string => paint('1', text, enabled);

export const cyan = (text: string, enabled = supportsColor()): string => paint('36', text, enabled);

export const green = (text: string, enabled = supportsColor()): string => paint('32', text, enabled);

export const red = (text: string, enabled = supportsColor()): string =>
  paint('31', text, enabled);

export const printJson = (value: unknown): void => {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
};

export const printTable = (
  rows: Array<Record<string, string | number | null | undefined>>,
  opts?: { color?: boolean },
): void => {
  if (rows.length === 0) {
    process.stdout.write(`${dim('(none)', opts?.color ?? supportsColor())}\n`);
    return;
  }
  const color = opts?.color ?? supportsColor();
  const keys = Object.keys(rows[0] ?? {});
  const widths = keys.map((k) =>
    Math.max(k.length, ...rows.map((r) => String(r[k] ?? '').length)),
  );
  const line = (values: string[]) =>
    values.map((v, i) => v.padEnd(widths[i] ?? 0)).join('  ');
  process.stdout.write(`${dim(line(keys), color)}\n`);
  process.stdout.write(`${dim(line(widths.map((w) => '-'.repeat(w))), color)}\n`);
  for (const row of rows) {
    process.stdout.write(`${line(keys.map((k) => String(row[k] ?? '')))}\n`);
  }
};

export const printKv = (
  rows: Array<[string, string | number | null | undefined]>,
  opts?: { color?: boolean },
): void => {
  const color = opts?.color ?? supportsColor();
  const keyWidth = Math.max(0, ...rows.map(([k]) => k.length));
  for (const [key, value] of rows) {
    const label = dim(key.padEnd(keyWidth), color);
    process.stdout.write(`${label}  ${value ?? ''}\n`);
  }
};

export const printSuccess = (message: string, opts?: { color?: boolean }): void => {
  const color = opts?.color ?? supportsColor();
  process.stdout.write(`${green(message, color)}\n`);
};

export const printError = (message: string, opts?: { color?: boolean }): void => {
  const color = opts?.color ?? supportsColor(process.stderr);
  process.stderr.write(`${red(message, color)}\n`);
};

export const writeOutFile = async (path: string, value: unknown): Promise<void> => {
  const { writeFileSync, mkdirSync } = await import('node:fs');
  const { dirname } = await import('node:path');
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
};
