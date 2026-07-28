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

export type QueryParams = Record<string, string | number | boolean | undefined | null>;

export type HttpClient = {
  get: (path: string, query?: QueryParams) => Promise<unknown>;
  post: (path: string, body?: unknown, query?: QueryParams) => Promise<unknown>;
  patch: (path: string, body?: unknown, query?: QueryParams) => Promise<unknown>;
  put: (path: string, body?: unknown, query?: QueryParams) => Promise<unknown>;
  delete: (path: string, body?: unknown, query?: QueryParams) => Promise<unknown>;
};

const buildUrl = (apiUrl: string, path: string, query?: QueryParams): string => {
  const params = new URLSearchParams();
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      params.set(key, String(value));
    }
  }
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

export const createHttpClient = (opts: {
  apiUrl: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
}): HttpClient => {
  const fetchImpl = opts.fetchImpl ?? fetch;

  const request = async (
    method: string,
    path: string,
    body?: unknown,
    query?: QueryParams,
  ): Promise<unknown> => {
    const url = buildUrl(opts.apiUrl, path, query);
    const headers: Record<string, string> = {
      authorization: `Bearer ${opts.apiKey}`,
      accept: 'application/json',
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
    if (!text || res.status === 204) return null;
    return JSON.parse(text) as unknown;
  };

  return {
    get: (path, query) => request('GET', path, undefined, query),
    post: (path, body, query) => request('POST', path, body ?? {}, query),
    patch: (path, body, query) => request('PATCH', path, body ?? {}, query),
    put: (path, body, query) => request('PUT', path, body ?? {}, query),
    delete: (path, body, query) => request('DELETE', path, body, query),
  };
};
