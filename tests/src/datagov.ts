import { APIRequestContext, APIResponse } from '@playwright/test';

export const API_BASE = process.env.DATAGOV_BASE_URL ?? 'https://api-open.data.gov.sg/v1/public/api';

const headers = (): Record<string, string> | undefined =>
  process.env.DATAGOV_API_KEY ? { 'x-api-key': process.env.DATAGOV_API_KEY } : undefined;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * GET with backoff on HTTP 429. Anonymous data.gov.sg calls are rate limited,
 * and the sync timer has to cope with the same thing.
 */
export async function getWithBackoff(request: APIRequestContext, url: string, attempts = 5): Promise<APIResponse> {
  let res = await request.get(url, { headers: headers() });
  for (let i = 1; i < attempts && res.status() === 429; i++) {
    const retryAfter = Number(res.headers()['retry-after']);
    await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2000 * 2 ** i);
    res = await request.get(url, { headers: headers() });
  }
  return res;
}

export const pollDownloadUrl = (datasetId: string): string => `${API_BASE}/datasets/${datasetId}/poll-download`;
