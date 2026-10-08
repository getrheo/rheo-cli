import { appendQueryParams, type QueryParams } from './query.js';

export type { QueryParams };

export class CliHttpError extends Error {
  override readonly name = 'CliHttpError';
  constructor(
    public readonly status: number,
    public readonly body: string,
    message: string,
  ) {
    super(message);
  }
}

export type HttpClient = {
  get: (path: string, query?: QueryParams) => Promise<unknown>;
  /** Raw response body. Used for CSV exports that are not JSON. */
  getText: (path: string, query?: QueryParams) => Promise<string>;
  post: (path: string, body?: unknown, query?: QueryParams) => Promise<unknown>;
  patch: (path: string, body?: unknown, query?: QueryParams) => Promise<unknown>;
  put: (path: string, body?: unknown, query?: QueryParams) => Promise<unknown>;
  delete: (path: string, body?: unknown, query?: QueryParams) => Promise<unknown>;
  /** Stream NDJSON / SSE bodies to stdout (Rheo Agent endpoints). */
  stream: (
    method: string,
    path: string,
    body?: unknown,
    query?: QueryParams,
  ) => Promise<void>;
};

const MUTATING = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

const buildUrl = (apiUrl: string, path: string, query?: QueryParams): string => {
  const params = new URLSearchParams();
  if (query) appendQueryParams(params, query);
  const qs = params.toString();
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${apiUrl.replace(/\/$/, '')}${normalized}${qs ? `?${qs}` : ''}`;
};

const parseErrorMessage = (status: number, text: string): string => {
  let message = `HTTP ${status}`;
  try {
    const json = JSON.parse(text) as { message?: string; error?: string };
    message = json.message || json.error || message;
  } catch {
    if (text.trim()) message = text.trim().slice(0, 200);
  }
  return message;
};

const writeDryRun = (method: string, url: string, body?: unknown): void => {
  process.stdout.write(`dry-run ${method} ${url}\n`);
  if (body !== undefined) {
    process.stdout.write(`${JSON.stringify(body, null, 2)}\n`);
  }
};

const emitStreamLine = (line: string): void => {
  const trimmed = line.replace(/\r$/, '');
  if (!trimmed) return;
  if (trimmed.startsWith('data:')) {
    const data = trimmed.slice(5).trimStart();
    process.stdout.write(`${data}\n`);
    return;
  }
  if (trimmed.startsWith('event:') || trimmed.startsWith(':') || trimmed.startsWith('id:')) {
    return;
  }
  process.stdout.write(`${trimmed}\n`);
};

export const createHttpClient = (opts: {
  apiUrl: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
  dryRun?: boolean;
}): HttpClient => {
  const fetchImpl = opts.fetchImpl ?? fetch;

  const requestText = async (
    method: string,
    path: string,
    body?: unknown,
    query?: QueryParams,
  ): Promise<string> => {
    const url = buildUrl(opts.apiUrl, path, query);
    if (opts.dryRun && MUTATING.has(method)) {
      writeDryRun(method, url, body);
      return '';
    }
    const headers: Record<string, string> = {
      authorization: `Bearer ${opts.apiKey}`,
      accept: 'application/json, text/csv',
    };
    let payload: string | undefined;
    if (body !== undefined) {
      headers['content-type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    const res = await fetchImpl(url, { method, headers, body: payload });
    const text = await res.text();
    if (!res.ok) {
      throw new CliHttpError(res.status, text, parseErrorMessage(res.status, text));
    }
    return text;
  };

  const requestJson = async (
    method: string,
    path: string,
    body?: unknown,
    query?: QueryParams,
  ): Promise<unknown> => {
    const text = await requestText(method, path, body, query);
    if (!text) return null;
    return JSON.parse(text) as unknown;
  };

  const stream = async (
    method: string,
    path: string,
    body?: unknown,
    query?: QueryParams,
  ): Promise<void> => {
    const url = buildUrl(opts.apiUrl, path, query);
    if (opts.dryRun && MUTATING.has(method)) {
      writeDryRun(method, url, body);
      return;
    }
    const headers: Record<string, string> = {
      authorization: `Bearer ${opts.apiKey}`,
      accept: 'application/x-ndjson, text/event-stream, application/json',
    };
    let payload: string | undefined;
    if (body !== undefined) {
      headers['content-type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    const res = await fetchImpl(url, { method, headers, body: payload });
    if (!res.ok) {
      const text = await res.text();
      throw new CliHttpError(res.status, text, parseErrorMessage(res.status, text));
    }
    if (!res.body) {
      const text = await res.text();
      for (const line of text.split('\n')) emitStreamLine(line);
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n');
      buffer = parts.pop() ?? '';
      for (const line of parts) emitStreamLine(line);
    }
    buffer += decoder.decode();
    if (buffer) emitStreamLine(buffer);
  };

  return {
    get: (path, query) => requestJson('GET', path, undefined, query),
    getText: (path, query) => requestText('GET', path, undefined, query),
    post: (path, body, query) => requestJson('POST', path, body ?? {}, query),
    patch: (path, body, query) => requestJson('PATCH', path, body ?? {}, query),
    put: (path, body, query) => requestJson('PUT', path, body ?? {}, query),
    delete: (path, body, query) => requestJson('DELETE', path, body, query),
    stream,
  };
};
