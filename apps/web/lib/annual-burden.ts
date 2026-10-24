import type { AnnualRecord } from './research-types';

export function parseAnnualRecords(value: unknown): AnnualRecord[] {
  if (!Array.isArray(value) || value.length !== 142) throw Error('Annual data must contain 142 source records.');
  const ids = new Set<string>();
  for (const record of value) {
    if (!record || typeof record !== 'object' || typeof record.ADM4_PCODE !== 'string' ||
      !/^PH1307404\d{3}$/.test(record.ADM4_PCODE) || ids.has(record.ADM4_PCODE) || typeof record.Barangay !== 'string')
      throw Error('Annual barangay identifiers failed validation.');
    ids.add(record.ADM4_PCODE);
    for (let year = 2010; year <= 2025; year++) {
      const count = record[`DC_${year}`];
      if (count !== null && (typeof count !== 'number' || !Number.isFinite(count) || !Number.isInteger(count) || count < 0))
        throw Error('Annual source counts failed validation.');
    }
  }
  return value as AnnualRecord[];
}
