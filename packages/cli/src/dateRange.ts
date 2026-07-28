/** Default analytics/stats window when --start/--end are omitted. */
export const DEFAULT_RANGE_DAYS = 7;

export type DateRange = {
  startDate: string;
  endDate: string;
};

/**
 * Resolve ISO datetime range. If either bound is omitted, use the last
 * {@link DEFAULT_RANGE_DAYS} UTC days ending at `now` (inclusive calendar days).
 */
export const resolveDateRange = (
  opts: { start?: string; end?: string; now?: Date } = {},
): DateRange => {
  if (opts.start && opts.end) {
    return { startDate: normalizeIso(opts.start), endDate: normalizeIso(opts.end) };
  }
  if (opts.start || opts.end) {
    throw new Error('Provide both --start and --end, or omit both for the last 7 UTC days');
  }
  const now = opts.now ?? new Date();
  const end = new Date(now);
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (DEFAULT_RANGE_DAYS - 1)),
  );
  start.setUTCHours(0, 0, 0, 0);
  return { startDate: start.toISOString(), endDate: end.toISOString() };
};

const normalizeIso = (raw: string): string => {
  const trimmed = raw.trim();
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid date: ${raw}`);
  }
  // If caller passed date-only (YYYY-MM-DD), keep as midnight UTC via Date parse.
  return d.toISOString();
};
