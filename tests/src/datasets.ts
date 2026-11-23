/**
 * Field mapping for each MSF dataset, as implemented by the SupportFinder_IS module.
 *
 * The three datasets do not share a schema, so each one has its own mapping.
 * If data.gov.sg changes a field name, the contract tests fail before the
 * nightly sync does.
 */

export type ServiceType = 'FSC' | 'SSO' | 'StudentCare';

export type GeoFeature = {
  type: string;
  geometry: { type: string; coordinates: number[] } | null;
  properties: Record<string, unknown>;
};

export type ServiceCentreRecord = {
  sourceKey: string;
  name: string;
  address: string;
  postalCode: string;
  phone: string;
  latitude: number;
  longitude: number;
};

export type DatasetDefinition = {
  serviceType: ServiceType;
  datasetId: string;
  title: string;
  /** Property names that must exist on every feature. */
  requiredProperties: string[];
  map: (p: Record<string, unknown>) => Omit<ServiceCentreRecord, 'latitude' | 'longitude'>;
};

const text = (v: unknown): string => (v === null || v === undefined ? '' : String(v).trim());

/**
 * Some records lose the leading zero (088995 arrives as "88995").
 * Only an all-digit value of 5 or 6 digits is accepted; anything else returns ''
 * so the record is skipped rather than stored with a made-up postal code.
 */
export function normalisePostalCode(v: unknown): string {
  const s = text(v).replace(/\s/g, '');
  if (!/^\d{5,6}$/.test(s)) return '';
  return s.padStart(6, '0');
}

const joinAddress = (...parts: string[]): string => parts.filter((x) => x.length > 0).join(' ');

const unit = (floor: string, unitNo: string): string => {
  if (!floor && !unitNo) return '';
  const f = floor.replace(/^#/, '').replace(/-$/, '');
  return `#${f}-${unitNo}`;
};

export const DATASETS: DatasetDefinition[] = [
  {
    serviceType: 'FSC',
    datasetId: 'd_add23c06f7267e799185c79ccaa2099b',
    title: 'Family Services (GEOJSON)',
    requiredProperties: ['NAME', 'ADDRESSPOSTALCODE', 'ADDRESSSTREETNAME', 'ADDRESSBLOCKHOUSENUMBER', 'TELEPHONE'],
    map: (p) => {
      const postalCode = normalisePostalCode(p.ADDRESSPOSTALCODE);
      return {
        sourceKey: `${text(p.NAME).toUpperCase()}|${postalCode}`,
        name: text(p.NAME),
        address: joinAddress(
          text(p.ADDRESSBLOCKHOUSENUMBER),
          text(p.ADDRESSSTREETNAME),
          unit(text(p.ADDRESSFLOORNUMBER), text(p.ADDRESSUNITNUMBER)),
          text(p.ADDRESSBUILDINGNAME),
        ),
        postalCode,
        phone: text(p.TELEPHONE),
      };
    },
  },
  {
    serviceType: 'SSO',
    datasetId: 'd_22cfe2aed0bf20a679ab59bcaf0f8248',
    title: 'Social Service Offices (GEOJSON)',
    requiredProperties: ['NAME', 'POSTALCODE', 'STREETNAME', 'BLOCKHOUSENUMBER'],
    map: (p) => {
      const postalCode = normalisePostalCode(p.POSTALCODE);
      return {
        sourceKey: `${text(p.NAME).toUpperCase()}|${postalCode}`,
        name: text(p.NAME),
        address: joinAddress(
          text(p.BLOCKHOUSENUMBER),
          text(p.STREETNAME),
          unit(text(p.FLOORNUMBER), text(p.UNITNUMBER)),
          text(p.BUILDINGNAME),
        ),
        postalCode,
        phone: '',
      };
    },
  },
  {
    serviceType: 'StudentCare',
    datasetId: 'd_77e6e0d58ce4743dab1f26dfcbbeb6f4',
    title: 'Student Care Services (GEOJSON)',
    requiredProperties: ['UNIQUE_ID', 'NAME_OF_STUDENT_CARE_CENTRE', 'SCC_ADDRESS', 'SCC_POSTAL_CODE', 'SCC_TELEPHONE'],
    map: (p) => ({
      sourceKey: text(p.UNIQUE_ID),
      name: text(p.NAME_OF_STUDENT_CARE_CENTRE),
      address: text(p.SCC_ADDRESS),
      postalCode: normalisePostalCode(p.SCC_POSTAL_CODE),
      phone: text(p.SCC_TELEPHONE),
    }),
  },
];

export const datasetFor = (t: ServiceType): DatasetDefinition => {
  const d = DATASETS.find((x) => x.serviceType === t);
  if (!d) throw new Error(`Unknown service type ${t}`);
  return d;
};
