import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { datasetFor, normalisePostalCode } from '../src/datasets';
import { checkFeatureCollection, issueKinds } from '../src/contract';

/**
 * Offline tests for the fixtures in tests/fixtures/geojson.
 *
 * The same files are bundled as resources in SupportFinder_CS and used by
 * Sync_LoadSampleData and the in-platform BDD tests. These tests make sure each
 * fixture still demonstrates what it is named after.
 */

const FIXTURES = join(__dirname, '..', 'fixtures', 'geojson');
const read = (file: string): string => readFileSync(join(FIXTURES, file), 'utf8');
const readJson = (file: string): unknown => JSON.parse(read(file));

test.describe('valid samples', () => {
  const cases = [
    { file: 'fsc-sample.geojson', type: 'FSC' as const },
    { file: 'sso-sample.geojson', type: 'SSO' as const },
    { file: 'studentcare-sample.geojson', type: 'StudentCare' as const },
  ];

  for (const c of cases) {
    test(`${c.file} maps cleanly`, () => {
      const result = checkFeatureCollection(readJson(c.file), datasetFor(c.type));
      expect(result.issues).toEqual([]);
      expect(result.records.length).toBeGreaterThanOrEqual(5);
      for (const r of result.records) {
        expect(r.postalCode).toMatch(/^\d{6}$/);
        expect(r.sourceKey).not.toBe('');
      }
    });
  }

  test('postal codes that lost their leading zero are restored', () => {
    const result = checkFeatureCollection(readJson('fsc-sample.geojson'), datasetFor('FSC'));
    const raw = (readJson('fsc-sample.geojson') as { features: { properties: { ADDRESSPOSTALCODE: string } }[] }).features;
    const shortOnes = raw.filter((f) => f.properties.ADDRESSPOSTALCODE.length === 5);

    expect(shortOnes.length).toBeGreaterThan(0); // the fixture must keep exercising this case
    for (const f of shortOnes) {
      const padded = `0${f.properties.ADDRESSPOSTALCODE}`;
      expect(result.records.some((r) => r.postalCode === padded)).toBeTruthy();
    }
  });
});

test.describe('failure samples', () => {
  test('empty-collection trips the minimum-records guard only', () => {
    const result = checkFeatureCollection(readJson('empty-collection.geojson'), datasetFor('FSC'));
    expect(issueKinds(result)).toEqual(['too-few-features']);
  });

  test('missing-fields flags each broken record and keeps the good one', () => {
    const result = checkFeatureCollection(readJson('missing-fields.geojson'), datasetFor('FSC'));
    expect(issueKinds(result)).toEqual(['empty-name', 'invalid-geometry', 'invalid-postal-code', 'too-few-features']);

    const badIndexes = new Set(result.issues.filter((i) => 'index' in i).map((i) => (i as { index: number }).index));
    expect(badIndexes).toEqual(new Set([0, 1, 2]));
  });

  test('malformed file is not valid JSON', () => {
    expect(() => JSON.parse(read('malformed.geojson'))).toThrow();
  });

  test('API error body is rejected as not a FeatureCollection', () => {
    const result = checkFeatureCollection(readJson('not-geojson.json'), datasetFor('FSC'));
    expect(issueKinds(result)).toEqual(['not-a-feature-collection']);
  });
});

test.describe('normalisePostalCode', () => {
  const cases: [unknown, string][] = [
    ['640516', '640516'],
    ['88995', '088995'],
    [88995, '088995'],
    [' 520 123 ', '520123'],
    ['ABC123', ''],
    ['1234', ''],
    ['1234567', ''],
    ['', ''],
    [null, ''],
  ];

  for (const [input, expected] of cases) {
    test(`${JSON.stringify(input)} -> "${expected}"`, () => {
      expect(normalisePostalCode(input)).toBe(expected);
    });
  }
});
