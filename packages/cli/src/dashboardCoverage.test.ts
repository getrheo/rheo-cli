import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const routesDir = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../apps/api/src/routes/dashboard',
);
const cliSrcDir = resolve(dirname(fileURLToPath(import.meta.url)));

const EXCLUDED_FILES = new Set(['admin.ts', 'admin-engage-workers.ts', 'index.ts']);

const EXCLUDED_PATH_PREFIXES = [
  '/billing/checkout',
  '/billing/portal',
  '/billing/downgrade',
] as const;

const REQUIRED_PREFIXES = [
  '/customers',
  '/banners',
  '/workspace-api-keys',
  '/billing/status',
  '/members',
  '/content-blocks',
  '/rheo-agent',
  '/usage',
] as const;

type ScrapedRoute = { method: string; path: string; file: string };

/** Find `app.(get|post|…)` then the next quoted path (handles nested generics). */
const scrapeRoutesFromSource = (source: string, file: string): ScrapedRoute[] => {
  const routes: ScrapedRoute[] = [];
  const methodRe = /app\.(get|post|put|patch|delete)/g;
  let match: RegExpExecArray | null;
  while ((match = methodRe.exec(source))) {
    const method = match[1]!.toUpperCase();
    let i = match.index + match[0].length;
    if (source[i] === '<') {
      let depth = 0;
      for (; i < source.length; i += 1) {
        const ch = source[i];
        if (ch === '<') depth += 1;
        else if (ch === '>') {
          depth -= 1;
          if (depth === 0) {
            i += 1;
            break;
          }
        }
      }
    }
    while (i < source.length && /\s/.test(source[i]!)) i += 1;
    if (source[i] !== '(') continue;
    i += 1;
    while (i < source.length && /\s/.test(source[i]!)) i += 1;
    const quote = source[i];
    if (quote !== "'" && quote !== '"') continue;
    i += 1;
    let path = '';
    while (i < source.length && source[i] !== quote) {
      path += source[i];
      i += 1;
    }
    if (!path.startsWith('/')) continue;
    routes.push({ method, path, file });
  }
  return routes;
};

const listTsFilesRecursive = (dir: string): string[] => {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name.includes('Schemas')) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...listTsFilesRecursive(full));
      continue;
    }
    if (name.endsWith('.ts')) out.push(full);
  }
  return out;
};

const scrapeDashboardRoutes = (): ScrapedRoute[] => {
  const files = listTsFilesRecursive(routesDir);
  const routes: ScrapedRoute[] = [];
  for (const full of files) {
    const file = full.slice(routesDir.length + 1).replaceAll('\\', '/');
    const base = file.split('/').pop() ?? file;
    if (EXCLUDED_FILES.has(base) || base.startsWith('admin') || file.includes('/admin')) {
      continue;
    }
    const source = readFileSync(full, 'utf8');
    routes.push(...scrapeRoutesFromSource(source, file));
  }
  return routes.filter((route) => {
    if (route.file === 'billing.ts' || route.file.endsWith('/billing.ts')) {
      return route.method === 'GET' && route.path === '/billing/status';
    }
    return !EXCLUDED_PATH_PREFIXES.some((prefix) => route.path.startsWith(prefix));
  });
};

const loadCliSourceBlob = (): string => {
  const parts: string[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, name.name);
      if (name.isDirectory()) {
        walk(full);
        continue;
      }
      if (!name.name.endsWith('.ts') || name.name.endsWith('.d.ts')) continue;
      // Coverage map itself is not evidence of a command.
      if (name.name === 'dashboardCoverage.test.ts') continue;
      parts.push(readFileSync(full, 'utf8'));
    }
  };
  walk(cliSrcDir);
  return parts.join('\n');
};

/**
 * Contiguous path shape: `/static/${param}/leaf` (or Fastify `:param`).
 * Misses base+suffix (`${base}/draft`) and dynamic leaves (`/analytics/${kind}`).
 */
const contiguousPathCovered = (routePath: string, cliBlob: string): boolean => {
  const segments = routePath.split('/').filter((part) => part.length > 0);
  let pattern = '';
  for (const seg of segments) {
    pattern += '\\/';
    if (seg.startsWith(':')) {
      pattern += '(?:\\$\\{[^}]+\\}|:[A-Za-z0-9_]+|[^\\\\/`\'"\\s]+)';
    } else {
      pattern += seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(pattern).test(cliBlob);
};

/**
 * Ordered static segments as `/seg` (allows `${base}/leaf`).
 * Param segments are skipped; each static segment must appear later in the blob.
 */
const orderedStaticSegmentsCovered = (routePath: string, cliBlob: string): boolean => {
  const staticSegs = routePath
    .split('/')
    .filter((part) => part.length > 0 && !part.startsWith(':'));
  let from = 0;
  for (const seg of staticSegs) {
    const needle = `/${seg}`;
    const idx = cliBlob.indexOf(needle, from);
    if (idx < 0) return false;
    from = idx + needle.length;
  }
  return staticSegs.length > 0;
};

const quotedPathOrLeaf = (value: string, cliBlob: string): boolean =>
  cliBlob.includes(`'${value}'`) ||
  cliBlob.includes(`"${value}"`) ||
  cliBlob.includes(`path: '${value}'`) ||
  cliBlob.includes(`path: "${value}"`);

/** `/analytics/${kind}` + `'overview'` in a kind/view allowlist. */
const dynamicLeafCovered = (routePath: string, cliBlob: string): boolean => {
  const segs = routePath.split('/').filter((part) => part.length > 0);
  if (segs.length < 2) return false;
  const leaf = segs[segs.length - 1]!;
  if (leaf.startsWith(':')) return false;
  const parent = `/${segs.slice(0, -1).join('/')}/:dyn`;
  return contiguousPathCovered(parent, cliBlob) && quotedPathOrLeaf(leaf, cliBlob);
};

/**
 * Prefix path contiguous + suffix documented as `path: '/leaf…'`
 * (e.g. `…/product-analytics${spec.path}` with `path: '/retention/series'`).
 */
const prefixSuffixCovered = (routePath: string, cliBlob: string): boolean => {
  const segs = routePath.split('/').filter((part) => part.length > 0);
  for (let cut = segs.length - 1; cut >= 1; cut -= 1) {
    const suffixSegs = segs.slice(cut);
    if (suffixSegs.some((s) => s.startsWith(':'))) continue;
    const prefix = `/${segs.slice(0, cut).join('/')}`;
    const suffix = `/${suffixSegs.join('/')}`;
    if (contiguousPathCovered(prefix, cliBlob) && quotedPathOrLeaf(suffix, cliBlob)) {
      return true;
    }
  }
  return false;
};

/**
 * True when CLI source encodes the route via contiguous templates, base+suffix
 * ordered segments, dynamic kind/view leaves, or prefix + `path:` suffix maps.
 */
const pathCoveredInCli = (routePath: string, cliBlob: string): boolean => {
  if (routePath.includes('/engage/campaigns')) {
    return cliBlob.includes('/engage/broadcasts');
  }
  return (
    contiguousPathCovered(routePath, cliBlob) ||
    orderedStaticSegmentsCovered(routePath, cliBlob) ||
    dynamicLeafCovered(routePath, cliBlob) ||
    prefixSuffixCovered(routePath, cliBlob)
  );
};

/** Method must also be referenced near typical HTTP helpers for mutating verbs. */
const methodLikelyCovered = (method: string, cliBlob: string): boolean => {
  if (method === 'GET') return true;
  const needles: Record<string, string[]> = {
    POST: ["method: 'POST'", 'method: "POST"', 'http.post', ".post(", "'POST'", '"POST"'],
    PUT: ["method: 'PUT'", 'method: "PUT"', 'http.put', ".put(", "'PUT'", '"PUT"'],
    PATCH: ["method: 'PATCH'", 'method: "PATCH"', 'http.patch', ".patch(", "'PATCH'", '"PATCH"'],
    DELETE: [
      "method: 'DELETE'",
      'method: "DELETE"',
      'http.delete',
      ".delete(",
      "'DELETE'",
      '"DELETE"',
    ],
  };
  return (needles[method] ?? []).some((n) => cliBlob.includes(n));
};

describe('dashboard route coverage', () => {
  const routes = scrapeDashboardRoutes();
  const cliBlob = loadCliSourceBlob();

  it('scrapes workspace dashboard routes including nested flows/ (excluding admin and Stripe checkout)', () => {
    expect(routes.length).toBeGreaterThan(100);
    expect(routes.some((r) => r.file.startsWith('admin') || r.file.includes('/admin'))).toBe(
      false,
    );
    expect(routes.some((r) => r.path.includes('checkout'))).toBe(false);
    expect(routes.some((r) => r.path.includes('portal'))).toBe(false);
    expect(routes.some((r) => r.path.includes('downgrade'))).toBe(false);
    expect(routes.some((r) => r.file.includes('flowRouteHandlers') || r.file.includes('flows/'))).toBe(
      true,
    );
    expect(routes.filter((r) => r.path === '/billing/status')).toEqual([
      expect.objectContaining({ method: 'GET', path: '/billing/status' }),
    ]);
  });

  it('requires key product prefixes to be present in scraped routes', () => {
    for (const prefix of REQUIRED_PREFIXES) {
      expect(
        routes.some((r) => r.path.includes(prefix)),
        `missing scraped route for ${prefix}`,
      ).toBe(true);
    }
  });

  it('CLI source encodes every non-excluded dashboard route path (ordered static segments)', () => {
    const missing: string[] = [];
    for (const route of routes) {
      if (!pathCoveredInCli(route.path, cliBlob)) {
        missing.push(`${route.method} ${route.path} (${route.file})`);
      }
    }
    expect(missing, missing.join('\n')).toEqual([]);
  });

  it('CLI source uses HTTP helpers for every mutating method that appears on the allowlist', () => {
    const methods = new Set(routes.map((r) => r.method));
    for (const method of methods) {
      expect(methodLikelyCovered(method, cliBlob), `missing HTTP helper for ${method}`).toBe(
        true,
      );
    }
  });
});
