export interface OrderWeightItem {
  postingNumber: string; offerId: string; sku: string; grams: number; shipmentAt: string; declaredGrams?: number;
}
export interface OrderWeightReport { items: OrderWeightItem[]; skipped: { postingNumber: string; reason: string }[] }

/** English postings report, kilograms. Only an unambiguous single item can supply a product weight. */
export function parseOrderWeightReport(input: string): OrderWeightReport {
  const rows = csvRows(input), headers = rows.shift()?.map(value => value.trim()) ?? [];
  const required = ['Shipment number', 'Article code', 'SKU', 'Quantity', 'Status', 'Cancellation date', 'Linked shipments', 'Actual date of handing over to delivery', 'Total actual weight of the shipment'];
  if (new Set(headers).size !== headers.length || required.some(name => !headers.includes(name))) throw new Error('WEIGHT_REPORT_COLUMNS_INVALID');
  const columns = new Map(headers.map((name, index) => [name, index]));
  const field = (row: string[], name: string) => row[columns.get(name) ?? -1]?.trim() ?? '';
  const groups = new Map<string, string[][]>();
  for (const row of rows) {
    if (row.length !== headers.length) throw new Error('WEIGHT_REPORT_COLUMNS_INVALID');
    const posting = field(row, 'Shipment number'), group = groups.get(posting) ?? [];
    group.push(row); groups.set(posting, group);
  }
  const result: OrderWeightReport = { items: [], skipped: [] };
  for (const [postingNumber, shipment] of groups) {
    const skip = (reason: string) => { result.skipped.push({ postingNumber, reason }); };
    if (!postingNumber) { skip('missing_posting_number'); continue; }
    if (shipment.some(row => field(row, 'Cancellation date') || /cancel/i.test(field(row, 'Status')))) { skip('cancelled_shipment'); continue; }
    if (shipment.some(row => field(row, 'Linked shipments'))) { skip('linked_shipments'); continue; }
    if (new Set(shipment.map(row => JSON.stringify([field(row, 'Article code'), field(row, 'SKU')]))).size !== 1) { skip('multiple_products'); continue; }
    const quantities = shipment.map(row => field(row, 'Quantity'));
    if (quantities.some(value => !/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) || quantities.reduce((sum, value) => sum + Number(value), 0) !== 1) { skip('not_single_item'); continue; }
    const row = shipment[0], offerId = field(row, 'Article code'), sku = field(row, 'SKU');
    if (!offerId || !/^[1-9]\d*$/.test(sku)) { skip('missing_product_identity'); continue; }
    const actual = field(row, 'Total actual weight of the shipment'), grams = kilogramsToGrams(actual);
    if (grams === undefined) { skip(actual ? 'invalid_actual_weight' : 'missing_actual_weight'); continue; }
    const handover = field(row, 'Actual date of handing over to delivery'), shipmentAt = utcTimestamp(handover);
    if (!shipmentAt) { skip(handover ? 'invalid_handover_date' : 'missing_handover_date'); continue; }
    const declared = field(row, 'Declared total weight of the shipment'), declaredGrams = kilogramsToGrams(declared);
    if (declared && declaredGrams === undefined) { skip('invalid_declared_weight'); continue; }
    result.items.push({ postingNumber, offerId, sku, grams, shipmentAt, ...(declaredGrams === undefined ? {} : { declaredGrams }) });
  }
  return result;
}

function kilogramsToGrams(value: string): number | undefined {
  if (!/^\d{1,13}(?:\.\d{1,12})?$/.test(value)) return undefined;
  const [whole, fraction = ''] = value.split('.');
  const grams = BigInt(whole) * 1000n + BigInt(fraction.slice(0, 3).padEnd(3, '0')) + (/[1-9]/.test(fraction.slice(3)) ? 1n : 0n);
  return grams > 0n && grams <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(grams) : undefined;
}

function utcTimestamp(value: string): string | undefined {
  const iso = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value) ? `${value.replace(' ', 'T')}Z` : value;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(iso) || !Number.isFinite(Date.parse(iso))) return undefined;
  const normalized = new Date(iso).toISOString();
  return normalized === (iso.includes('.') ? iso : iso.replace(/Z$/, '.000Z')) ? normalized : undefined;
}

/** Strict semicolon CSV, including quoted delimiters, quotes and multiline cells. */
function csvRows(input: string): string[][] {
  const csv = input.replace(/^\uFEFF/, ''), rows: string[][] = [];
  let row: string[] = [], cell = '', state: 'unquoted' | 'quoted' | 'closed' = 'unquoted';
  const endRow = () => { row.push(cell); if (row.some(value => value !== '')) rows.push(row); row = []; cell = ''; state = 'unquoted'; };
  for (let index = 0; index < csv.length; index++) {
    const char = csv[index];
    if (state === 'quoted') {
      if (char === '"') { if (csv[index + 1] === '"') { cell += '"'; index++; } else state = 'closed'; }
      else cell += char;
    } else if (char === ';') { row.push(cell); cell = ''; state = 'unquoted'; }
    else if (char === '\r' || char === '\n') { if (char === '\r' && csv[index + 1] === '\n') index++; endRow(); }
    else if (char === '"' && state === 'unquoted' && !cell.length) state = 'quoted';
    else { if (state === 'closed' || char === '"') throw new Error('WEIGHT_REPORT_CSV_INVALID'); cell += char; }
  }
  if (state === 'quoted') throw new Error('WEIGHT_REPORT_CSV_INVALID');
  if (cell.length || row.length || state === 'closed') endRow();
  return rows;
}
