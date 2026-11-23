import { expect, test } from '@playwright/test';
import { DATASETS } from '../src/datasets';
import { checkFeatureCollection } from '../src/contract';
import { getWithBackoff, pollDownloadUrl } from '../src/datagov';

/**
 * Live contract tests against data.gov.sg.
 *
 * These check the assumptions SupportFinder_IS is built on. They run on every
 * push and once a day before the 02:00 SGT sync timer, so an upstream change
 * shows up as a failed pipeline instead of a failed sync in production.
 *
 * One poll per dataset keeps the run well inside the anonymous rate limit.
 */

test.describe.configure({ mode: 'serial', timeout: 120_000 });

for (const dataset of DATASETS) {
  test(`${dataset.serviceType}: ${dataset.title} matches the sync's field mapping`, async ({ request }) => {
    const poll = await getWithBackoff(request, pollDownloadUrl(dataset.datasetId));

    // The API answers 201, not 200. The REST consume must accept any 2xx.
    expect(poll.status(), await poll.text()).toBeGreaterThanOrEqual(200);
    expect(poll.status()).toBeLessThan(300);

    const body = await poll.json();
    expect(body.code).toBe(0);
    expect(body.data?.url).toMatch(/^https:\/\//);

    const file = await request.get(body.data.url);
    expect(file.ok()).toBeTruthy();

    const result = checkFeatureCollection(await file.json(), dataset);

    // Missing columns or broken structure are hard failures: the mapping must change.
    const structural = result.issues.filter((i) =>
      ['not-a-feature-collection', 'too-few-features', 'missing-property', 'duplicate-source-key'].includes(i.kind),
    );
    expect(structural, JSON.stringify(structural.slice(0, 5), null, 2)).toEqual([]);

    // Bad individual records are tolerated (the sync skips them) but must stay rare.
    const recordLevel = result.issues.length - structural.length;
    const rate = recordLevel / Math.max(result.records.length, 1);
    expect(rate, `${recordLevel} of ${result.records.length} records would be skipped`).toBeLessThan(0.05);
  });
}

test('unknown dataset returns 404 with an error message', async ({ request }) => {
  const res = await getWithBackoff(request, pollDownloadUrl('d_doesnotexist'));

  // SupportFinder_IS relies on this to surface "dataset not found" in SyncRun.ErrorMessage.
  expect(res.status()).toBe(404);
  const body = await res.json();
  expect(typeof body.error).toBe('string');
});
