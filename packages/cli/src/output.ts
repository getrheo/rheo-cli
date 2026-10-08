/**
 * Decide whether command output should be JSON.
 * `--json` wins; `--table` forces human output; otherwise JSON when stdout is not a TTY.
 */
export const preferJson = (
  opts: { json?: boolean; table?: boolean },
  stream: { isTTY?: boolean | undefined } = process.stdout,
): boolean => {
  if (opts.json) return true;
  if (opts.table) return false;
  return !stream.isTTY;
};
