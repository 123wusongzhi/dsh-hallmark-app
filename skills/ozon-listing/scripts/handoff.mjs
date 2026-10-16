import {existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync} from 'node:fs';
import {basename, dirname, isAbsolute, join, resolve} from 'node:path';
import {createHash, randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';

const read = path => JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fail = message => {throw new Error(message);};
function atomic(path, value) {
  mkdirSync(dirname(resolve(path)), {recursive:true});
  const temp = `${path}.${randomUUID()}.tmp`;
  writeFileSync(temp, JSON.stringify(value, null, 2) + '\n', {flag:'wx'});
  renameSync(temp, path);
}
function validateProduct(product) {
  if (!product.itemId || !product.sourceRevision) fail('商品或来源版本缺失');
  if (!Array.isArray(product.images)) fail('images 必须是筛选后的有效图片数组，不能交付全量分类表');
  const ids = new Set();
  for (const image of product.images) {
    if (!image.id || ids.has(image.id)) fail('图片 id 缺失或重复');
    ids.add(image.id);
    if (!['subject', 'specification', 'detail'].includes(image.purpose)) fail('图片目录只接受有效主体、规格依据和细节图');
    if (!(typeof image.path === 'string' && isAbsolute(image.path)) && !image.resource) fail('有效图片缺少绝对路径或资源引用');
    if (!Array.isArray(image.sourceSkuIds)) fail('图片缺少适用 sourceSkuIds');
  }
}
function factContent(product) {
  const {factsRevision, delivery, ...content} = product;
  return content;
}
export function check(path) {
  const product = read(path);
  validateProduct(product);
  const {delivery, ...payload} = product;
  if (!Number.isInteger(product.factsRevision) || product.factsRevision < 1 || delivery?.status !== 'ready' || delivery.sha256 !== digest(payload)) fail('资料未正式交付或交付后被改写；请资料代理重新 finalize');
  return {path:resolve(path), itemId:product.itemId, factsRevision:product.factsRevision, sha256:delivery.sha256, status:'ready'};
}
export function finalize(draftPath, outputPath) {
  if (resolve(draftPath) === resolve(outputPath)) fail('草稿与正式交付必须分开');
  const draft = read(draftPath);
  validateProduct(draft);
  const previous = existsSync(outputPath) ? read(outputPath) : undefined;
  if (previous) {
    check(outputPath);
    if (previous.itemId !== draft.itemId) fail('不能覆盖另一商品的正式资料');
    if (digest(factContent(previous)) === digest(factContent(draft))) return check(outputPath);
  }
  const payload = {...factContent(draft), factsRevision:(previous?.factsRevision ?? 0) + 1};
  atomic(outputPath, {...payload, delivery:{status:'ready', sha256:digest(payload), deliveredAt:new Date().toISOString()}});
  return check(outputPath);
}
export function production(productPath, manifestPath, outputPath) {
  const ready = check(productPath), manifest = read(manifestPath);
  if (resolve(outputPath) === resolve(productPath) || resolve(outputPath) === resolve(manifestPath)) fail('制作清单必须另存，不覆盖资料或来源清单');
  const rows = manifest.sales ?? manifest.rows;
  if (!manifest.preparationRevision || !Array.isArray(rows) || !rows.length) fail('缺少程序销售行及版本');
  const saleIds = new Set();
  const sales = rows.map(row => {
    row = {...row, saleId:row.saleId ?? row.id};
    if (!row.saleId || saleIds.has(row.saleId)) fail('销售行标识缺失或重复');
    saleIds.add(row.saleId);
    const result = {};
    for (const key of ['saleId','sourceSkuId','procurement','spec','packing','includedItems','offerId','rowId']) if (row[key] !== undefined) result[key] = row[key];
    return result;
  });
  const result = {productPath:ready.path,factsRevision:ready.factsRevision,factsSha256:ready.sha256,preparationRevision:manifest.preparationRevision,sales};
  for (const key of ['salesRevision','storeId','itemId','sourceRevision','planId','category','language','platform','userRequirements']) if (manifest[key] !== undefined) result[key] = manifest[key];
  atomic(outputPath,result);
  return {path:resolve(outputPath),factsRevision:ready.factsRevision,salesCount:sales.length};
}
const stages = ['generating','generated','staged','published'];
export function record(ledgerPath, entry) {
  if (!entry.assetKey || !stages.includes(entry.stage)) fail('assetKey 或 stage 无效');
  const ledger = existsSync(ledgerPath) ? read(ledgerPath) : {assets:[]};
  const index = ledger.assets.findIndex(asset => asset.assetKey === entry.assetKey);
  const previous = ledger.assets[index];
  if (previous && stages.indexOf(entry.stage) < stages.indexOf(previous.stage)) fail('不得回退已成功资产的阶段');
  if (previous && (entry.factsRevision !== undefined && previous.factsRevision !== entry.factsRevision || (previous.salesRevision ? entry.salesRevision !== undefined && previous.salesRevision !== entry.salesRevision : entry.preparationRevision !== undefined && previous.preparationRevision !== entry.preparationRevision))) fail('资产内容版本变化，请使用新的 assetKey');
  const asset = {...previous, ...entry, originSessionId:previous?.originSessionId ?? previous?.sessionId ?? entry.sessionId, updatedAt:new Date().toISOString()};
  // The Host stamps sessionId in listing_image_prepare; agents only copy versions from production.json.
  const missing = [];
  if (!Number.isInteger(asset.factsRevision) || asset.factsRevision < 1) missing.push('factsRevision（正整数）');
  if (!asset.preparationRevision) missing.push('preparationRevision');
  if (!Array.isArray(asset.references) || asset.references.length === 0) missing.push('references（product.json 中的来源图）');
  if (!Array.isArray(asset.slots) || asset.slots.length === 0) missing.push('slots');
  if (missing.length) fail(`记录缺少：${missing.join('、')}。版本从 production.json 原样抄写`);
  for (const slot of asset.slots) {
    if (!slot.saleId || !['images','richContentImages'].includes(slot.group) || !Number.isInteger(slot.index) || slot.index < 0 || slot.index >= (slot.group === 'images' ? 7 : 8)) fail(`销售位置无效：${JSON.stringify(slot)}；group 为 images（index 0-6）或 richContentImages（index 0-7）`);
  }
  if (asset.stage === 'generating' && !asset.prompt) fail('生图前记录实际 prompt');
  if (stages.indexOf(asset.stage) >= 1 && (!asset.sourcePath || !isAbsolute(asset.sourcePath) || !existsSync(asset.sourcePath))) fail('缺少工具返回的实际生成文件');
  if (stages.indexOf(asset.stage) >= 2 && (!asset.path || !isAbsolute(asset.path) || !existsSync(asset.path))) fail('缺少实际归档文件');
  if (asset.stage === 'published') {
    let url; try {url = new URL(asset.url);} catch {fail('缺少成功发布 URL');}
    if (url.protocol !== 'https:') fail('发布 URL 必须为 https');
  }
  if (index < 0) ledger.assets.push(asset); else ledger.assets[index] = asset;
  atomic(ledgerPath, ledger);
  return asset;
}
// The Host writes `<ledger>.<hash>.receipt.json` the moment a generation succeeds.
function receiptFor(ledgerPath, assetKey) {
  const dir = dirname(resolve(ledgerPath)), prefix = `${basename(ledgerPath)}.`;
  for (const name of readdirSync(dir)) {
    if (!name.startsWith(prefix) || !name.endsWith('.receipt.json')) continue;
    try {
      const receipt = read(join(dir, name));
      // Receipts exist only for successful calls; a missing path still forbids regeneration.
      if (receipt.assetKey === assetKey) return {receiptPath:join(dir, name), sourcePath:receipt.sourcePath ?? null, sourceExists:Boolean(receipt.sourcePath && existsSync(receipt.sourcePath)), toolCallId:receipt.toolCallId};
    } catch {}
  }
}
export function recover(ledgerPath) {
  return read(ledgerPath).assets.map(asset => {
    const sourceExists = Boolean(asset.sourcePath && existsSync(asset.sourcePath));
    const stagedExists = Boolean(asset.path && existsSync(asset.path));
    if (asset.stage === 'published') return {...asset, sourceExists, stagedExists, nextAction:'reuse_published'};
    if (stagedExists) return {...asset, sourceExists, stagedExists, nextAction:'publish'};
    if (sourceExists) return {...asset, sourceExists, stagedExists, nextAction:'stage_existing'};
    if (asset.stage !== 'generating') return {...asset, sourceExists, stagedExists, nextAction:'regenerate_new_key'};
    const receipt = receiptFor(ledgerPath, asset.assetKey);
    return receipt ? {...asset, sourceExists, stagedExists, nextAction:'adopt_receipt', receipt} : {...asset, sourceExists, stagedExists, nextAction:'generate'};
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const [command, first, second, third] = process.argv.slice(2);
    if (!first || !['check','finalize','record','recover','production'].includes(command) || ['finalize','record','production'].includes(command) && !second || command === 'production' && !third) fail('用法：handoff.mjs check product.json | finalize draft.json product.json | production product.json sales-manifest.json production.json | record image-progress.json entry.json | recover image-progress.json');
    console.log(JSON.stringify(command === 'check' ? check(first) : command === 'finalize' ? finalize(first,second) : command === 'production' ? production(first,second,third) : command === 'record' ? record(first,read(second)) : recover(first), null, 2));
  } catch (error) {console.error(error.message); process.exitCode = 1;}
}
