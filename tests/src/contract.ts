import { DatasetDefinition, GeoFeature, ServiceCentreRecord } from './datasets';

/** Rough bounding box for mainland Singapore and nearby islands. */
const SG_BOUNDS = { minLng: 103.55, maxLng: 104.15, minLat: 1.15, maxLat: 1.5 };

/** Mirrors the Sync_MinRecordsGuard site property in SupportFinder_CS. */
export const MIN_RECORDS_GUARD = 5;

export type ContractIssue =
  | { kind: 'not-a-feature-collection'; detail: string }
  | { kind: 'too-few-features'; detail: string }
  | { kind: 'missing-property'; index: number; detail: string }
  | { kind: 'empty-name'; index: number; detail: string }
  | { kind: 'invalid-postal-code'; index: number; detail: string }
  | { kind: 'invalid-geometry'; index: number; detail: string }
  | { kind: 'duplicate-source-key'; index: number; detail: string };

export type ContractResult = {
  records: ServiceCentreRecord[];
  issues: ContractIssue[];
};

/**
 * Applies the same rules the sync applies before it writes to ServiceCentre:
 * structure, required fields, postal code, coordinates and key uniqueness.
 */
export function checkFeatureCollection(body: unknown, dataset: DatasetDefinition): ContractResult {
  const issues: ContractIssue[] = [];
  const records: ServiceCentreRecord[] = [];

  const fc = body as { type?: unknown; features?: unknown };
  if (!fc || fc.type !== 'FeatureCollection' || !Array.isArray(fc.features)) {
    issues.push({ kind: 'not-a-feature-collection', detail: 'Expected { type: "FeatureCollection", features: [] }' });
    return { records, issues };
  }

  const features = fc.features as GeoFeature[];
  if (features.length < MIN_RECORDS_GUARD) {
    issues.push({
      kind: 'too-few-features',
      detail: `${features.length} features, guard is ${MIN_RECORDS_GUARD}`,
    });
  }

  const seenKeys = new Map<string, number>();

  features.forEach((f, index) => {
    const props = f.properties ?? {};

    for (const name of dataset.requiredProperties) {
      if (!(name in props)) {
        issues.push({ kind: 'missing-property', index, detail: name });
      }
    }

    const mapped = dataset.map(props);

    if (mapped.name === '') {
      issues.push({ kind: 'empty-name', index, detail: 'name is empty' });
    }

    if (!/^\d{6}$/.test(mapped.postalCode)) {
      issues.push({ kind: 'invalid-postal-code', index, detail: JSON.stringify(props) });
    }

    const coords = f.geometry?.coordinates ?? [];
    const [lng, lat] = coords;
    const inBounds =
      f.geometry?.type === 'Point' &&
      typeof lng === 'number' &&
      typeof lat === 'number' &&
      lng >= SG_BOUNDS.minLng &&
      lng <= SG_BOUNDS.maxLng &&
      lat >= SG_BOUNDS.minLat &&
      lat <= SG_BOUNDS.maxLat;
    if (!inBounds) {
      issues.push({ kind: 'invalid-geometry', index, detail: JSON.stringify(f.geometry) });
    }

    if (mapped.sourceKey) {
      const first = seenKeys.get(mapped.sourceKey);
      if (first !== undefined) {
        issues.push({ kind: 'duplicate-source-key', index, detail: `same key as feature ${first}: ${mapped.sourceKey}` });
      } else {
        seenKeys.set(mapped.sourceKey, index);
      }
    }

    records.push({ ...mapped, latitude: lat ?? 0, longitude: lng ?? 0 });
  });

  return { records, issues };
}

export const issueKinds = (r: ContractResult): string[] => [...new Set(r.issues.map((i) => i.kind))].sort();
