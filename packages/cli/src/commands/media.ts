import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import type { HttpClient } from '../http.js';
import { CliHttpError } from '../http.js';
import { printJson, printTable } from '../format.js';

type MediaItem = {
  id: string;
  name?: string | null;
  type?: string;
  contentType?: string;
  sizeBytes?: number;
  archivedAt?: string | null;
};

const guessContentType = (filename: string): string => {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.mp4')) return 'video/mp4';
  if (lower.endsWith('.webm')) return 'video/webm';
  if (lower.endsWith('.json')) return 'application/json';
  if (lower.endsWith('.woff2')) return 'font/woff2';
  if (lower.endsWith('.woff')) return 'font/woff';
  if (lower.endsWith('.ttf')) return 'font/ttf';
  return 'application/octet-stream';
};

const guessMediaType = (contentType: string): string => {
  if (contentType.startsWith('image/')) return 'image';
  if (contentType.startsWith('video/')) return 'video';
  if (contentType.startsWith('font/')) return 'font';
  if (contentType === 'application/json') return 'lottie';
  return 'image';
};

export const runMediaList = async (opts: {
  http: HttpClient;
  json?: boolean;
}): Promise<number> => {
  const body = (await opts.http.get('/v1/dashboard/media')) as { items: MediaItem[] };
  if (opts.json) {
    printJson(body);
    return 0;
  }
  printTable(
    body.items.map((m) => ({
      id: m.id,
      name: m.name ?? '',
      type: m.type ?? '',
      contentType: m.contentType ?? '',
      sizeBytes: m.sizeBytes ?? '',
      archived: m.archivedAt ? 'yes' : 'no',
    })),
  );
  return 0;
};

export const runMediaSignUpload = async (opts: {
  http: HttpClient;
  body: unknown;
}): Promise<number> => {
  printJson(await opts.http.post('/v1/dashboard/media/sign-upload', opts.body));
  return 0;
};

export const runMediaConfirm = async (opts: {
  http: HttpClient;
  body: unknown;
}): Promise<number> => {
  printJson(await opts.http.post('/v1/dashboard/media/confirm', opts.body));
  return 0;
};

export const runMediaUpload = async (opts: {
  http: HttpClient;
  filePath: string;
  type?: string;
  contentType?: string;
  name?: string;
  fetchImpl?: typeof fetch;
}): Promise<number> => {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const bytes = readFileSync(opts.filePath);
  const filename = basename(opts.filePath);
  const contentType = opts.contentType ?? guessContentType(filename);
  const type = opts.type ?? guessMediaType(contentType);

  const signed = (await opts.http.post('/v1/dashboard/media/sign-upload', {
    type,
    contentType,
    sizeBytes: bytes.byteLength,
    filename: opts.name ?? filename,
  })) as {
    assetId: string;
    uploadUrl: string;
    headers?: Record<string, string>;
  };

  const uploadHeaders: Record<string, string> = {
    'content-type': contentType,
    ...(signed.headers ?? {}),
  };
  const put = await fetchImpl(signed.uploadUrl, {
    method: 'PUT',
    headers: uploadHeaders,
    body: bytes,
  });
  if (!put.ok) {
    const text = await put.text();
    throw new CliHttpError(put.status, text, `Upload failed: HTTP ${put.status}`);
  }

  const confirmed = await opts.http.post('/v1/dashboard/media/confirm', {
    assetId: signed.assetId,
    name: opts.name ?? filename,
  });
  printJson(confirmed);
  return 0;
};

export const runMediaRename = async (opts: {
  http: HttpClient;
  assetId: string;
  nameStem: string;
}): Promise<number> => {
  printJson(
    await opts.http.patch(`/v1/dashboard/media/${opts.assetId}`, { nameStem: opts.nameStem }),
  );
  return 0;
};

export const runMediaArchive = async (opts: {
  http: HttpClient;
  assetId: string;
}): Promise<number> => {
  printJson(await opts.http.delete(`/v1/dashboard/media/${opts.assetId}`));
  return 0;
};
