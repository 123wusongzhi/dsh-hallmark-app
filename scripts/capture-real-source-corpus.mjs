import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.resolve(root, process.env.DSH_REAL_OUTPUT ?? 'artifacts/real-source-tests-20261013');
const provider = (process.env.DSH_REAL_PROVIDER ?? 'http://127.0.0.1:4280').replace(/\/$/, '');
const counts = { taobao_tmall: 20, alibaba_com: 20, pinduoduo: 1 };
const sha256 = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const array = value => Array.isArray(value) ? value : [];
const titleFamilies = [
  ['network-switch', /交换机|网络扩展/], ['textile-ribbon', /棉带|布彩带/],
  ['clothing-fasteners', /四合扣|子母扣|纽扣|腰带收缩/], ['pet-accessories', /狗狗|宠物|猫猫/],
  ['carabiners', /登山扣|保险扣/], ['zipper-parts', /拉链|拉锁/], ['automotive-tools', /汽修|套筒扳手/],
  ['garbage-bags', /垃圾袋/], ['phone-support', /手机支架|手机懒人|自拍杆/],
  ['signal-generator', /PWM|信号发生器/], ['charging-modules', /充电|升压模块/],
  ['digital-meter', /电压表|直流表头/], ['pen-parts', /替换笔|笔尖|笔头/],
  ['writing-pens', /中性笔|走珠笔/], ['game-chip-storage', /筹码/], ['hair-styling', /卷发/],
  ['coin-protection', /纪念币|银元|硬币/], ['robot-cleaner-parts', /扫地/],
  ['headphone-accessories', /耳机/], ['craft-feathers', /羽毛/], ['decorative-stickers', /手机贴纸/],
  ['cord-locks', /绳头|止绳/], ['pcb-electronics', /PCB|印刷电路板/], ['furniture-feet', /家具调节/],
  ['laundry-bags', /洗衣袋/], ['drain-cleaning', /下水道/], ['dish-storage', /碗碟|碗盘/],
  ['clothesline', /晾衣/], ['3d-printing-parts', /3[dD]打印|离型膜/], ['musical-tools', /古筝|古琴/],
  ['meat-grinder-parts', /绞肉机/], ['glass-mosaic', /玻璃|镜面|马赛克/],
];
function family(detail) {
  if (detail.source !== 'taobao_tmall') return null;
  return titleFamilies.find(([, match]) => match.test(detail.title ?? ''))?.[0] ?? 'other-title-family';
}
function structure(value, prefix = '', depth = 0, result = new Set()) {
  if (depth > 6) return result;
  if (Array.isArray(value)) {
    result.add(`${prefix}:array${value.length ? '' : ':empty'}`);
    for (const entry of value.slice(0, 3)) structure(entry, `${prefix}[]`, depth + 1, result);
  } else if (value && typeof value === 'object') {
    result.add(`${prefix}:object`);
    for (const [key, entry] of Object.entries(value)) structure(entry, `${prefix}.${key}`, depth + 1, result);
  } else result.add(`${prefix}:${value === null ? 'null' : typeof value}`);
  return result;
}
function features(detail, raw) {
  const skus = array(detail.skus), sd = object(detail.sourceDetails), packaging = object(sd.packaging);
  const pricing = object(sd.pricing), editor = object(sd.editorFields), result = [];
  result.push(skus.length === 0 ? 'sku:zero' : skus.length === 1 ? 'sku:one' : skus.length >= 25 ? 'sku:many-25-plus' : 'sku:multiple');
  result.push(`currency:${detail.currency ?? 'missing'}`);
  if (!Object.keys(object(detail.attributes)).length) result.push('attributes:empty');
  if (!array(detail.images).length || !detail.mainImage) result.push('image:main-missing');
  if (skus.some(sku => !sku.image)) result.push('image:sku-missing');
  if (skus.some(sku => sku.stock === 0)) result.push('stock:zero');
  if (skus.some(sku => sku.stock === undefined || sku.stock === null)) result.push('stock:missing');
  const identities = skus.map(sku => String(sku.sourceSkuId ?? sku.code ?? sku.id ?? '').trim());
  if (identities.some(id => !id)) result.push('sku-identity:missing');
  if (identities.some((id, index) => id && identities.indexOf(id) !== index)) result.push('sku-identity:duplicate');
  const codes = skus.map(sku => sku.code).filter(Boolean);
  if (new Set(codes).size < codes.length) result.push('sku-code:duplicate-but-native-id-distinct');
  if (skus.some(sku => sku.price === undefined && sku.goodsPrice === undefined && sku.sourceSellingPrice?.amount === undefined)) result.push('sku-price:missing');
  const prices = new Set(skus.map(sku => sku.goodsPrice ?? sku.price ?? sku.sourceSellingPrice?.amount).filter(value => value !== undefined));
  if (prices.size > 1) result.push('price:varies-by-sku');
  if (detail.sourceSellingPrice) result.push('price:seller-sale-role');
  if (pricing.scPrice?.value === 3 || array(pricing.priceRange).length || array(editor.priceRange).length || array(editor.ladderPrice).length) result.push('price:quantity-ladder-configuration');
  if (packaging.pkgMeasure?.inputArray) result.push('package:dimensions-string-array');
  if (packaging.pkgWeight !== undefined) result.push(`package:weight-${typeof packaging.pkgWeight}`);
  if (!packaging.pkgMeasure && !detail.package && !detail.packaging) result.push('package:dimensions-missing');
  if (array(sd.logistics?.logisticsSku).length) result.push('package:sku-logistics');
  if (Object.keys(object(detail.attributes)).some(key => /重量|长度|尺寸/.test(key))) result.push('attributes:physical-measurement-text');
  if (Object.keys(object(sd.productOverview?.multilangInfo)).length) result.push('title:multilingual');
  if (detail.categoryPath?.length) result.push('category:source-path'); else result.push('category:missing-source-path');
  if (detail.delivery?.freightAmount !== undefined) result.push('delivery:explicit-freight');
  if (detail.delivery?.freightVerified === false) result.push('delivery:unverified');
  if (raw) {
    if (array(raw.qualityWarnings).length) result.push('raw:quality-warnings');
    if (raw.sku2InfoMerged !== undefined) result.push('raw:taobao-sku2-merge-flag');
    if (raw.jsonSkuCount !== undefined) result.push('raw:json-sku-count');
    if (raw.productInfo || raw.productOverview || raw.editorFields) result.push('raw:editor-product-fields');
    if (JSON.stringify(raw).includes('\\u001e')) result.push('raw:control-character');
  }
  return result.sort();
}
function select(pool, source, count) {
  const candidates = pool.filter(record => record.detail.source === source).map(record => ({ ...record, features: features(record.detail), shape: structure(record.detail) }));
  if (candidates.length < count) throw new Error(`Need ${count} ${source} records; source has ${candidates.length}`);
  const chosen = [], covered = new Set(), shapes = new Set(), families = new Set();
  const rarity = new Map();
  for (const record of candidates) for (const feature of record.features) rarity.set(feature, (rarity.get(feature) ?? 0) + 1);
  function score(record) {
    return record.features.reduce((sum, feature) => sum + (covered.has(feature) ? 0 : 12 + 30 / rarity.get(feature)), 0)
      + [...record.shape].filter(token => !shapes.has(token)).length * 0.04
      + (source === 'taobao_tmall' && !families.has(family(record.detail)) ? 150 : 0);
  }
  function take(eligible, reason) {
    const record = eligible.filter(row => !chosen.includes(row)).sort((a, b) => score(b) - score(a) || a.detail.id.localeCompare(b.detail.id))[0];
    if (!record) throw new Error(`Cannot fill ${reason}`);
    const unseen = record.features.filter(feature => !covered.has(feature));
    record.reasons = [reason, ...(unseen.length ? [`新增结构特征：${unseen.join(', ')}`] : [])];
    chosen.push(record);
    for (const feature of record.features) covered.add(feature);
    for (const token of record.shape) shapes.add(token);
    families.add(family(record.detail));
  }
  if (source === 'alibaba_com') {
    const categories = [...new Set(candidates.map(row => array(row.detail.categoryPath).join(' > ')))].sort();
    if (categories.length > count) throw new Error(`Category coverage exceeds ${count}; revise sampling rule explicitly`);
    for (const category of categories) take(candidates.filter(row => array(row.detail.categoryPath).join(' > ') === category), `覆盖真实来源类目：${category || '缺失'}`);
  }
  while (chosen.length < count) take(candidates, source === 'taobao_tmall' ? '标题产品类型分组与稀有字段结构优先（非源类目）' : '补充稀有字段、SKU 和价格结构');
  return chosen;
}
function rejectSecrets(value, prefix = '') {
  if (!value || typeof value !== 'object') return;
  for (const [key, entry] of Object.entries(value)) {
    if (/^(api[_-]?key|client[_-]?secret|access[_-]?token|refresh[_-]?token|authorization|password|cookie|credentials?)$/i.test(key) && entry && entry !== true) throw new Error(`Refusing to persist credential field ${prefix}.${key}`);
    rejectSecrets(entry, `${prefix}.${key}`);
  }
}
async function get(route, filename, body) {
  const method = body === undefined ? 'GET' : 'POST';
  const url = `${provider}${route}`, response = await fetch(url, { signal: AbortSignal.timeout(60_000), method, ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) });
  if (!response.ok) throw new Error(`GET ${route}: ${response.status}`);
  const text = await response.text(), data = JSON.parse(text), fetchedAt = new Date().toISOString();
  rejectSecrets(data);
  await writeFile(path.join(output, filename), text, 'utf8');
  return { data, provenance: { method, url, fetchedAt, status: response.status, sha256: sha256(text), valueSha256: sha256(data), responseFile: filename, ...(body === undefined ? {} : { requestBody: body }) } };
}
await mkdir(path.join(output, 'responses'), { recursive: true });
let pool;
if (process.argv.includes('--reuse-pool')) {
  pool = JSON.parse(await readFile(path.join(output, 'pool.json'), 'utf8'));
} else {
  const summaries = await get('/api/items', 'responses/source-list.json');
  const list = Array.isArray(summaries.data) ? summaries.data : summaries.data.items;
  if (!Array.isArray(list)) throw new Error('Expected /api/items to return an array or {items}');
  pool = { capturedAt: new Date().toISOString(), provider, records: [] };
  for (const summary of list.filter(row => counts[row.source])) {
    const response = await get(`/api/items/${encodeURIComponent(summary.id)}`, `responses/pool-${summary.id}.json`);
    pool.records.push({ summary, detail: response.data });
  }
  await writeFile(path.join(output, 'pool.json'), JSON.stringify(pool, null, 2));
}
const selected = Object.entries(counts).flatMap(([source, count]) => select(pool.records, source, count));
const records = [];
for (const record of selected) {
  const id = record.detail.id;
  const detail = await get(`/api/items/${encodeURIComponent(id)}`, `responses/${id}.detail.json`);
  const raw = await get(`/api/items/${encodeURIComponent(id)}/raw?full=1`, `responses/${id}.raw.json`);
  if (raw.data.truncated) throw new Error(`Raw evidence for ${id} was truncated`);
  const parsedRaw = typeof raw.data.content === 'string' ? JSON.parse(raw.data.content) : raw.data;
  records.push({
    summary: record.summary, detail: detail.data, raw: raw.data,
    sampling: { titleFamily: family(detail.data), categoryPath: array(detail.data.categoryPath), features: features(detail.data, parsedRaw), reasons: record.reasons },
    provenance: { summary: { capturedAt: pool.capturedAt, provider: pool.provider, valueSha256: sha256(record.summary), source: 'read-only source list in pool.json' }, detail: detail.provenance, raw: raw.provenance, originalSourceCapturedAt: parsedRaw.capturedAt ?? null },
  });
}
const ancillary = {};
for (const [name, route] of Object.entries({ stores: '/api/stores', storeProducts: '/api/store-products', tasks: '/api/tasks', pricingSettings: '/api/dynamic-pricing/settings' })) {
  const response = await get(route, `responses/ancillary-${name}.json`);
  ancillary[name] = response;
}
// These POSTs are registered read-only Ozon queries; they do not change warehouse/activity data.
const optionalReadFailures = [];
for (const [name, platformPath, method] of [['ozonWarehouses', '/v2/warehouse/list', 'POST'], ['ozonActions', '/v1/actions', 'GET']]) {
  try {
    ancillary[name] = await get(`/api/stores/${encodeURIComponent(ancillary.stores.data[0].id)}/data/read`, `responses/ancillary-${name}.json`, { requestId: `real-source-corpus-${name}-${Date.now()}`, agentId: 'real-tests', path: platformPath, method, body: {} });
  } catch (error) { optionalReadFailures.push({ name, platformPath, method, error: String(error.message), fetchedAt: new Date().toISOString() }); }
}
try {
  const storeId = encodeURIComponent(ancillary.stores.data[0].id);
  ancillary.ozonCategories = await get(`/api/catalog/search?storeId=${storeId}&q=${encodeURIComponent('端子')}&limit=20`, 'responses/ancillary-ozonCategories.json');
  const category = ancillary.ozonCategories.data.results?.[0];
  if (category) {
    const base = `/api/catalog/categories/${encodeURIComponent(category.descriptionCategoryId)}/types/${encodeURIComponent(category.typeId)}`;
    ancillary.ozonCategoryTemplate = await get(`${base}/template?storeId=${storeId}`, 'responses/ancillary-ozonCategoryTemplate.json');
    const attribute = ancillary.ozonCategoryTemplate.data.attributes?.find(row => row.id === '10096' && row.dictionaryId) ?? ancillary.ozonCategoryTemplate.data.attributes?.find(row => row.dictionaryId);
    if (attribute) ancillary.ozonDictionary = await get(`${base}/attributes/${encodeURIComponent(attribute.id)}/values?storeId=${storeId}&limit=50`, 'responses/ancillary-ozonDictionary.json');
  }
} catch (error) { optionalReadFailures.push({ name: 'ozonCategories', error: String(error.message), fetchedAt: new Date().toISOString() }); }
// Download original marketplace pixels for offline delivery tests. Failed sources remain
// documented failures; generated replacement images are never substituted.
const imageAssets = [];
await mkdir(path.join(output, 'images'), { recursive: true });
const imageQueue = records.map(row => ({ productId: row.detail.id, source: row.detail.source, url: row.detail.mainImage ?? row.detail.images?.[0] })).filter(row => row.url);
let nextImage = 0;
await Promise.all(Array.from({ length: 4 }, async () => {
  while (nextImage < imageQueue.length) {
    const row = imageQueue[nextImage++];
    let error;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await fetch(row.url.startsWith('//') ? `https:${row.url}` : row.url, { signal: AbortSignal.timeout(15_000), headers: { 'User-Agent': 'Mozilla/5.0', Referer: row.source === 'pinduoduo' ? 'https://mobile.yangkeduo.com/' : 'https://www.taobao.com/' } });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const mimeType = response.headers.get('content-type')?.split(';')[0] ?? '';
        if (!mimeType.startsWith('image/')) throw new Error(`Unexpected MIME ${mimeType}`);
        const bytes = Buffer.from(await response.arrayBuffer());
        const filename = `images/${row.productId}.${mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : mimeType.includes('gif') ? 'gif' : 'jpg'}`;
        await writeFile(path.join(output, filename), bytes);
        imageAssets.push({ ...row, status: 'captured', fetchedAt: new Date().toISOString(), mimeType, byteLength: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), file: filename, attempts: attempt });
        error = undefined;
        break;
      } catch (failure) { error = String(failure.message); }
    }
    if (error) imageAssets.push({ ...row, status: 'unavailable', fetchedAt: new Date().toISOString(), error });
  }
}));
imageAssets.sort((a, b) => a.productId.localeCompare(b.productId));
await writeFile(path.join(output, 'image-assets.json'), JSON.stringify({ capturedAt: new Date().toISOString(), assets: imageAssets }, null, 2));
const corpus = {
  schemaVersion: 1, capturedAt: new Date().toISOString(), provider, poolCapturedAt: pool.capturedAt,
  acquisition: 'Read-only fresh GET from the local source collection service; original marketplace capture time retained separately. No marketplace recrawl or remote write.',
  samplingRules: { requestedCounts: counts, sourceCategoryCoverage: 'Every available Alibaba source category path, then rare structures', taobaoFamilies: 'Descriptive title sampling groups; never asserted as marketplace categories', diversity: 'Greedy unseen field features, field types, SKU cardinality, missingness and varying prices; stable ID tie-break' },
  records, ancillary, imageAssets, optionalReadFailures,
};
const featureCounts = {};
for (const row of records) for (const feature of row.sampling.features) featureCounts[feature] = (featureCounts[feature] ?? 0) + 1;
const profile = {
  schemaVersion: 1, capturedAt: corpus.capturedAt, counts: Object.fromEntries(Object.keys(counts).map(source => [source, records.filter(row => row.detail.source === source).length])),
  poolCounts: Object.fromEntries(Object.keys(counts).map(source => [source, pool.records.filter(row => row.detail.source === source).length])),
  alibabaCategoryPaths: [...new Set(records.filter(row => row.detail.source === 'alibaba_com').map(row => row.sampling.categoryPath.join(' > ')))],
  taobaoTitleFamilies: [...new Set(records.filter(row => row.detail.source === 'taobao_tmall').map(row => row.sampling.titleFamily))], featureCounts,
  unavailableSpecialCases: ['image:main-missing', 'sku-identity:missing', 'sku-identity:duplicate'].filter(feature => !pool.records.some(row => features(row.detail).includes(feature))),
  rawKeyShapes: Object.fromEntries(Object.keys(counts).map(source => [source, [...new Set(records.filter(row => row.detail.source === source).map(row => Object.keys(JSON.parse(row.raw.content)).sort().join(', ')))]])),
  ancillaryCounts: { stores: ancillary.stores.data.length, products: ancillary.storeProducts.data.products.length, tasks: ancillary.tasks.data.length },
  imageCounts: { captured: imageAssets.filter(asset => asset.status === 'captured').length, unavailable: imageAssets.filter(asset => asset.status === 'unavailable').length },
  samples: records.map(row => ({ id: row.detail.id, source: row.detail.source, title: row.detail.title, skuCount: row.detail.skus?.length ?? 0, ...row.sampling })),
};
for (const [source, count] of Object.entries(counts)) if (profile.counts[source] !== count) throw new Error(`Count mismatch for ${source}`);
if (new Set(records.map(row => row.detail.id)).size !== records.length) throw new Error('Duplicate source products');
for (const row of records) for (const name of ['detail', 'raw']) {
  const response = await readFile(path.join(output, row.provenance[name].responseFile), 'utf8');
  if (sha256(response) !== row.provenance[name].sha256 || sha256(row[name]) !== row.provenance[name].valueSha256) throw new Error(`Evidence hash mismatch for ${row.detail.id} ${name}`);
}
await writeFile(path.join(output, 'corpus.json'), JSON.stringify(corpus, null, 2));
await writeFile(path.join(output, 'profile.json'), JSON.stringify(profile, null, 2));
for (const filename of ['corpus.json', 'profile.json', 'image-assets.json']) {
  await writeFile(path.join(output, `${filename}.sha256`), `${sha256(await readFile(path.join(output, filename), 'utf8'))}  ${filename}\n`);
}
await mkdir(path.join(root, 'test/real-data'), { recursive: true });
const browserImageData = Object.fromEntries(await Promise.all(imageAssets.filter(asset => asset.status === 'captured').map(async asset => [asset.productId, `data:${asset.mimeType};base64,${(await readFile(path.join(output, asset.file))).toString('base64')}`])));
const browserData = `// GENERATED PRIVATE REAL DATA. Ignored by Git. Rebuild using capture-real-source-corpus.mjs.\n// Fresh source snapshots, with no scenario overrides.\n` + Object.entries({ REAL_SOURCE_DETAILS: records.map(row => row.detail), REAL_SOURCE_SUMMARIES: records.map(row => row.summary), REAL_STORES: ancillary.stores.data, REAL_SALES_PRODUCTS: ancillary.storeProducts.data.products }).map(([name, data]) => `export const ${name}: Array<Record<string, any>> = ${JSON.stringify(data)};`).join('\n') + `\nexport const REAL_SOURCE_IMAGE_DATA: Record<string,string> = ${JSON.stringify(browserImageData)};\n`;
await writeFile(path.join(root, 'test/real-data/browser-data.ts'), browserData);
console.log(JSON.stringify({ corpus: path.join(output, 'corpus.json'), counts: profile.counts, alibabaCategories: profile.alibabaCategoryPaths.length, taobaoTitleFamilies: profile.taobaoTitleFamilies.length, featureCounts, ancillaryCounts: profile.ancillaryCounts, imageCounts: profile.imageCounts, integrity: 'passed' }, null, 2));
