import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHttpClient } from './http.js';

describe('createHttpClient dry-run', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prints mutating requests without calling fetch', async () => {
    const lines: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      lines.push(String(chunk));
      return true;
    });
    const fetchImpl = vi.fn();
    const http = createHttpClient({
      apiUrl: 'https://api.example.test',
      apiKey: 'rheo_wk_test',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      dryRun: true,
    });
    const result = await http.post('/v1/dashboard/apps', { name: 'Acme' });
    expect(result).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(lines.join('')).toContain('dry-run POST https://api.example.test/v1/dashboard/apps');
    expect(lines.join('')).toContain('"name": "Acme"');
  });

  it('still fetches GET during dry-run', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const http = createHttpClient({
      apiUrl: 'https://api.example.test',
      apiKey: 'rheo_wk_test',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      dryRun: true,
    });
    const body = await http.get('/v1/dashboard/workspace');
    expect(body).toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalled();
  });
});

describe('createHttpClient stream', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes NDJSON lines to stdout', async () => {
    const lines: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      lines.push(String(chunk));
      return true;
    });
    const payload = '{"type":"token","text":"hi"}\n{"type":"done"}\n';
    const fetchImpl = vi.fn(
      async () =>
        new Response(payload, {
          status: 200,
          headers: { 'content-type': 'application/x-ndjson' },
        }),
    );
    const http = createHttpClient({
      apiUrl: 'https://api.example.test',
      apiKey: 'rheo_wk_test',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await http.stream('POST', '/v1/dashboard/flows/f1/rheo-agent', { prompt: 'hi' });
    expect(lines.join('')).toContain('"type":"token"');
    expect(lines.join('')).toContain('"type":"done"');
  });

  it('strips SSE data: prefixes', async () => {
    const lines: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      lines.push(String(chunk));
      return true;
    });
    const payload = 'event: message\ndata: {"ok":true}\n\n';
    const fetchImpl = vi.fn(
      async () =>
        new Response(payload, {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        }),
    );
    const http = createHttpClient({
      apiUrl: 'https://api.example.test',
      apiKey: 'rheo_wk_test',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await http.stream('POST', '/v1/dashboard/flows/f1/rheo-agent', {});
    expect(lines.join('')).toContain('{"ok":true}');
    expect(lines.join('')).not.toContain('event:');
  });
});
