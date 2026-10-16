/**
 * Real, read-only Ozon acceptance through the installed Runtime (not provider mocks).
 * Usage: node scripts/verify-ozon-workbench-live.mjs <runtimeUrl> <serviceKeyFile> <evidenceDirectory> [all|capabilities|board]
 * Optional final argument: a JSON options file containing connectionId, storeIds (exactly two),
 * analyticsPeriod, ordersPeriod, weightsPeriod, financePeriod, limit, or weightPollAttempts.
 * Mutations are limited to Runtime session bindings, shared catalog initialization and the
 * local workbench. Business APIs remain queries. Existing board instances are retained.
 * Backups precede initialization (which can migrate a legacy board); every run has its own
 * evidence directory. The two demonstration instance IDs are stable across repeated runs.
 */
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {createMaterialView} from '../packages/app-presentation/src/materials/catalog.ts';

const [runtimeArgument, keyFile, evidenceRoot, mode = 'all', optionsFile] = process.argv.slice(2);
if (!runtimeArgument || !keyFile || !evidenceRoot || !['all', 'capabilities', 'board'].includes(mode)) {
  throw new Error('Usage: node scripts/verify-ozon-workbench-live.mjs <runtimeUrl> <serviceKeyFile> <evidenceDirectory> [all|capabilities|board] [options.json]');
}
const runtimeUrl = new URL(runtimeArgument);
if (!['http:', 'https:'].includes(runtimeUrl.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(runtimeUrl.hostname) || runtimeUrl.username || runtimeUrl.password) {
  throw new Error('Acceptance Runtime must be a loopback HTTP(S) URL without URL credentials.');
}
const token = readFileSync(keyFile, 'utf8').trim();
if (!token || /[\r\n]/.test(token)) throw new Error('The service key file must contain one nonempty key.');
const options = optionsFile ? JSON.parse(readFileSync(optionsFile, 'utf8')) : {};
const kinds = ['products', 'prices', 'warehouses', 'stocks', 'analytics', 'orders', 'weights', 'finance', 'promotions', 'returns'];
const periods = {
  analytics: options.analyticsPeriod ?? {dateFrom: '2026-09-01', dateTo: '2026-10-07'},
  orders: options.ordersPeriod ?? {dateFrom: '2026-09-01', dateTo: '2026-10-07'},
  weights: options.weightsPeriod ?? {dateFrom: '2026-09-01', dateTo: '2026-10-08'},
  finance: options.financePeriod ?? {dateFrom: '2026-10-07', dateTo: '2026-10-07'},
};
const limit = options.limit ?? 5, pollAttempts = options.weightPollAttempts ?? 18;
if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(pollAttempts) || pollAttempts < 1 || pollAttempts > 60) throw new Error('Invalid acceptance limit or weightPollAttempts.');
const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;
const evidenceDirectory = resolve(evidenceRoot, runId);
mkdirSync(evidenceDirectory, {recursive: true});
const sessionId = `ozon-workbench-acceptance:${runId}`;
const evidence = {startedAt: new Date().toISOString(), runtimeUrl: runtimeUrl.origin, mode, periods, limit, checks: [], cases: [], previews: [], artifacts: []};
let requestNumber = 0;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const hasChinese = value => typeof value === 'string' && /[\u3400-\u9fff]/u.test(value);
const localParams = ['storeId', 'store', 'productId', 'productIds', 'sku', 'skus', 'offerId', 'offerIds', 'warehouseId', 'actionId', 'postingNumber', 'returnId', 'cursor'];
const refs = instance => instance.dataSources ?? (instance.dataSource ? {[instance.design.bindings[0]?.id ?? 'main']: instance.dataSource} : {});
const write = (name, value) => {
  const path = resolve(evidenceDirectory, `${name}.json`);
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, {mode: 0o600});
  return path;
};
const check = (name, passed, detail = undefined) => {
  evidence.checks.push({name, passed: Boolean(passed), ...(detail === undefined ? {} : {detail})});
  write('summary', evidence);
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`);
  return Boolean(passed);
};
const skip = (name, reason) => {evidence.checks.push({name, passed: null, reason});};
const required = (name, passed, detail) => {
  if (!check(name, passed, detail)) throw Object.assign(new Error(name), {code: 'ACCEPTANCE_CHECK_FAILED'});
};

async function call(path, body, label = 'request') {
  const number = ++requestNumber;
  const response = await fetch(new URL(path, runtimeUrl), {
    method: body === undefined ? 'GET' : 'POST', redirect: 'error',
    headers: {Authorization: `Bearer ${token}`, ...(body === undefined ? {} : {'Content-Type': 'application/json'})},
    ...(body === undefined ? {} : {body: JSON.stringify(body)}), signal: AbortSignal.timeout(90000),
  });
  const raw = await response.text();
  let value;
  try {value = JSON.parse(raw);} catch {value = {nonJsonResponse: raw};}
  const artifact = write(`${String(number).padStart(3, '0')}-${label}`, {path, request: body ?? null, httpStatus: response.status, response: value});
  evidence.artifacts.push(artifact);
  if (!response.ok) throw Object.assign(new Error(`${label}: HTTP ${response.status}; see the local evidence file.`), {code: 'RUNTIME_HTTP_ERROR', artifact});
  return value;
}
const workbench = () => call('/v1/workbench?resource=workbench&appId=hallmark', undefined, 'board-read');
const operation = (name, params, label = name) => call('/v1/workbench', {appId: 'hallmark', operation: name, params, ...(['initialize', 'preview'].includes(name) ? {sessionId} : {})}, label);
async function invoke(store, kind, input, label) {
  const id = randomUUID();
  return call('/v1/invocations', {
    protocolVersion: '1.0', appId: 'hallmark', connectionId: store.connectionId,
    capabilityId: `hallmark.ozon.${kind}`, capabilityVersion: '1.0.0', invocationId: id, traceId: id,
    input, source: {kind: 'agent', sessionId, nativeCallId: id}, deadlineAt: new Date(Date.now() + 75000).toISOString(),
  }, label);
}
function describe(result, requestedInput) {
  const data = result.data;
  return {
    status: result.status, invocationId: result.invocationId ?? null,
    outcome: result.status !== 'ok' ? result.status : !Array.isArray(data?.items) ? 'invalid-output' : data.items.length ? 'rows' : 'empty',
    rows: Array.isArray(data?.items) ? data.items.length : null, total: data?.total ?? null,
    warnings: data?.warnings ?? null, dataTime: data?.dataTime ?? null, period: data?.period ?? null,
    requestedPeriod: requestedInput.dateFrom ? {dateFrom: requestedInput.dateFrom, dateTo: requestedInput.dateTo} : null,
    pagination: {hasNext: typeof data?.cursor === 'string' && data.cursor.length > 0},
    error: result.error ?? null,
  };
}
function validOutput(result, input) {
  const data = result.data;
  return result.status === 'ok' && Array.isArray(data?.items) && data.items.every(row => row && typeof row === 'object' && !Array.isArray(row)) &&
    Array.isArray(data.warnings) && data.warnings.every(value => typeof value === 'string') &&
    Object.hasOwn(data, 'dataTime') && (data.dataTime === null || typeof data.dataTime === 'string') &&
    (data.cursor === undefined || typeof data.cursor === 'string' && data.cursor.length > 0) &&
    (data.total === undefined || Number.isInteger(data.total) && data.total >= 0) &&
    (!input.dateFrom || same(data.period, {dateFrom: input.dateFrom, dateTo: input.dateTo}));
}
async function capabilityCase(store, kind, storeIndex) {
  const input = {storeId: store.id, limit, ...periods[kind]};
  const record = {storeId: store.id, storeName: store.name, connectionId: store.connectionId, kind, input, attempts: []};
  evidence.cases.push(record);
  try {
    let result;
    for (let attempt = 1; attempt <= (kind === 'weights' ? pollAttempts : 1); attempt++) {
      result = await invoke(store, kind, input, `store-${storeIndex}-${kind}-attempt-${attempt}`);
      record.attempts.push(describe(result, input));
      write('summary', evidence);
      if (result.error?.code !== 'REPORT_PENDING' || attempt === pollAttempts) break;
      // A new invocation with exactly the same input reuses the server-owned report receipt.
      console.log(`WAIT store-${storeIndex} weights report (${attempt}/${pollAttempts})`);
      await delay(5000);
    }
    Object.assign(record, describe(result, input));
    record.passed = check(`store-${storeIndex} ${kind}: Runtime schema and response`, validOutput(result, input), {status: record.status, outcome: record.outcome, rows: record.rows});
    return result;
  } catch (error) {
    Object.assign(record, {status: 'transport-error', outcome: 'transport-error', rows: null, error: {code: error.code ?? 'REQUEST_FAILED', message: error.message}});
    check(`store-${storeIndex} ${kind}: Runtime schema and response`, false, {code: record.error.code});
    return null;
  }
}

function tableInstance(kind, source, position) {
  const columns = kind === 'prices' ? [
    ['offerId', '商品货号'], ['price', '当前卖家价'], ['ordinaryPrice', '普通售价'], ['oldPrice', '划线价'], ['currency', '币种'],
  ] : [['date', '记账日期'], ['postingNumber', '包裹编号'], ['accrualType', '记账类型'], ['amount', '记账金额'], ['commission', '平台佣金'], ['feeDetails', '费用明细'], ['currency', '币种']];
  const design = createMaterialView('data-table');
  design.widgets[0].columns = columns.map(([field, label]) => ({field: `ozon.${field}`, label}));
  design.widgets[0].options = {...design.widgets[0].options, density: 'compact', pageSize: limit};
  return {
    instanceId: `ozon-workbench-acceptance-${kind}`, title: kind === 'prices' ? 'Ozon 当前售价' : 'Ozon 订单费用与平台记账',
    materialId: 'data-table', materialVersion: 1, design,
    dataSources: {main: {id: source.id, revision: source.revision, params: {limit, ...periods[kind]}}}, position,
  };
}
function viewSummary(result) {
  const binding = result.data?.bindings?.find(row => row.bindingId === 'main');
  return {state: binding?.state ?? null, rows: Array.isArray(binding?.payload?.items) ? binding.payload.items.length : null,
    warnings: binding?.payload?.warnings ?? null, period: binding?.payload?.period ?? null,
    query: binding?.query ?? null, page: result.pages?.main ?? null, error: binding?.error ?? null};
}
function verifyTable(name, result, storeId) {
  const summary = viewSummary(result), widget = result.view?.design?.widgets?.[0];
  evidence.previews.push({name, ...summary});
  check(name, summary.state === 'ready' && summary.rows !== null && summary.query?.input?.storeId === storeId &&
    widget?.type === 'table' && widget.columns?.length > 0 && widget.columns.every(column => hasChinese(column.label)),
  {state: summary.state, rows: summary.rows});
  return summary;
}

async function verifyBoard(stores, sources, originalBoard) {
  const [first, second] = stores;
  let board = await workbench();
  const beforeAdding = structuredClone(board);
  write('board-before-demonstration', beforeAdding);
  const maxOrder = Math.max(-1, ...board.instances.map(instance => instance.position.order));
  const demonstrations = ['prices', 'finance'].map((kind, index) => {
    const source = sources.find(row => row.connectionId === first.connectionId && row.capabilityId === `hallmark.ozon.${kind}`);
    required(`board ${kind} source exists`, !!source);
    const previous = board.instances.find(row => row.instanceId === `ozon-workbench-acceptance-${kind}`);
    return tableInstance(kind, source, previous?.position ?? {order: maxOrder + index + 1, span: 2});
  });
  for (const instance of demonstrations) {
    const preview = await operation('preview', {instance, context: {storeId: first.id}}, `preview-${instance.instanceId}`);
    verifyTable(`generic data-table preview ${instance.instanceId}`, preview, first.id);
  }
  const demoIds = new Set(demonstrations.map(row => row.instanceId));
  board = await operation('save', {expectedRevision: board.revision, context: {storeId: first.id}, instances: [
    ...board.instances.filter(row => !demoIds.has(row.instanceId)), ...demonstrations,
  ]}, 'board-save-demonstrations');
  const baseline = structuredClone(board);
  const priceId = demonstrations[0].instanceId;
  const firstRead = await operation('read', {instanceId: priceId, scope: 'store-switch'}, 'board-prices-first-page');
  const firstSummary = verifyTable('saved prices read without chat session', firstRead, first.id);
  let exercisedCursor = false;
  if (firstSummary.page?.nextCursor) {
    const next = await operation('read', {instanceId: priceId, scope: 'store-switch', bindingId: 'main', cursor: firstSummary.page.nextCursor}, 'board-prices-next-page');
    const nextSummary = verifyTable('saved prices next page', next, first.id);
    exercisedCursor = check('pagination really advanced before switching', nextSummary.page?.cursor === firstSummary.page.nextCursor && nextSummary.rows !== null);
  } else skip('pagination really advanced before switching', 'The real first page has no continuation; no cursor is invented.');
  const productId = firstRead.data?.bindings?.[0]?.payload?.items?.find(row => /^[1-9][0-9]*$/.test(row.productId ?? ''))?.productId;
  // Switching in this single save clears persisted local filters and the populated page cache.
  // The product ID comes from the real first store; it is never fabricated or sent to store 2.
  const switching = structuredClone(board.instances);
  if (productId) refs(switching.find(row => row.instanceId === priceId)).main.params.productId = productId;
  else skip('real product filter cleared on store switch', 'No real product ID was returned; the test will check all existing local parameters.');
  board = await operation('save', {expectedRevision: board.revision, context: {storeId: second.id}, instances: switching}, 'board-switch-store');
  check('store switch clears all local parameters', board.instances.every(instance => Object.values(refs(instance)).every(ref => localParams.every(key => !Object.hasOwn(ref.params, key)))));
  check('store switch preserves designs and layout', board.instances.every(instance => {
    const prior = baseline.instances.find(row => row.instanceId === instance.instanceId);
    return prior && same(instance.design, prior.design) && same(instance.position, prior.position) && instance.materialId === prior.materialId && instance.title === prior.title;
  }));
  check('store switch preserves dates and page size', demonstrations.every(demo => {
    const actual = board.instances.find(row => row.instanceId === demo.instanceId);
    return same(refs(actual).main.params, refs(demo).main.params);
  }));
  const switchedRead = await operation('read', {instanceId: priceId, scope: 'store-switch'}, 'board-switched-prices-first-page');
  const switchedSummary = verifyTable('same saved component reads the second store', switchedRead, second.id);
  check('store switch starts from first page', switchedSummary.page?.cursor === null && !Object.hasOwn(switchedSummary.query?.input ?? {}, 'cursor') &&
    !Object.hasOwn(switchedSummary.query?.input ?? {}, 'productId'), {advancedBeforeSwitch: exercisedCursor});
  const switchedFinance = await operation('read', {instanceId: demonstrations[1].instanceId}, 'board-switched-finance');
  verifyTable('same saved fee component reads the second store', switchedFinance, second.id);
  // Leave useful first-store components for the browser. CAS prevents overwriting another writer.
  board = await operation('save', {expectedRevision: board.revision, context: {storeId: first.id}, instances: board.instances}, 'board-restore-first-store');
  const finalBoard = await workbench();
  write('board-final', finalBoard);
  check('two useful components exist exactly once', demonstrations.every(demo => finalBoard.instances.filter(row => row.instanceId === demo.instanceId).length === 1));
  check('all original components retained', originalBoard.instances.every(instance => finalBoard.instances.some(row => row.instanceId === instance.instanceId)));
  check('unrelated components retain design and position', beforeAdding.instances.filter(row => !demoIds.has(row.instanceId)).every(prior => {
    const current = finalBoard.instances.find(row => row.instanceId === prior.instanceId);
    return current && same(current.design, prior.design) && same(current.position, prior.position);
  }));
  for (const instance of demonstrations) {
    const finalRead = await operation('read', {instanceId: instance.instanceId}, `board-final-${instance.instanceId}`);
    verifyTable(`final useful component ${instance.instanceId}`, finalRead, first.id);
  }
  evidence.finalBoard = {revision: finalBoard.revision, context: finalBoard.context, instanceIds: finalBoard.instances.map(row => row.instanceId)};
}

try {
  evidence.runtime = await call('/v1/runtime', undefined, 'runtime-identity');
  // Do not reorder: initialize is itself capable of saving a migrated board.
  const originalBoard = await workbench();
  const originalSources = await call('/v1/workbench?resource=dataSources&appId=hallmark', undefined, 'catalog-before');
  write('backup-board-before-initialize', originalBoard);
  write('backup-sources-before-initialize', originalSources);
  const initialized = await operation('initialize', {}, 'initialize-shared-catalog');
  evidence.initializationIssues = initialized.issues ?? [];
  const sources = (await call('/v1/workbench?resource=dataSources&appId=hallmark', undefined, 'catalog-after')).dataSources;
  const allStores = initialized.stores ?? [];
  let connectionId = options.connectionId;
  if (!connectionId) connectionId = allStores.find(store => allStores.filter(other => other.connectionId === store.connectionId).length >= 2)?.connectionId;
  let stores = allStores.filter(store => store.connectionId === connectionId);
  if (options.storeIds) {
    required('requested two store IDs are valid', Array.isArray(options.storeIds) && options.storeIds.length === 2 && new Set(options.storeIds).size === 2);
    stores = options.storeIds.map(id => stores.find(store => store.id === id)).filter(Boolean);
  } else {
    // Preserve known actual shop ordering when available; names never enter source definitions.
    stores.sort((a, b) => (/^bill$/i.test(a.name) ? -1 : /^bill$/i.test(b.name) ? 1 : 0));
    stores = stores.slice(0, 2);
  }
  required('two real stores on one enabled connection', stores.length === 2 && stores[0].id !== stores[1].id && !!connectionId);
  evidence.stores = stores;
  evidence.connectionId = connectionId;
  const ozonSources = sources.filter(row => row.connectionId === connectionId && row.capabilityId?.startsWith('hallmark.ozon.'));
  required('exactly ten shared Ozon source definitions', ozonSources.length === 10 && kinds.every(kind => ozonSources.filter(row => row.capabilityId === `hallmark.ozon.${kind}`).length === 1));
  check('shared definitions have no embedded store', ozonSources.every(source => source.storeScoped === true &&
    source.id === `hallmark:${connectionId}:ozon:${source.capabilityId.split('.').at(-1)}` &&
    !Object.hasOwn(source.input, 'storeId') && !Object.hasOwn(source.input, 'store') &&
    source.parameters.some(param => param.name === 'storeId' && param.required === true && param.editable === false && param.default === undefined) &&
    !/\b(?:bill|helen)\b/i.test(source.title) && !allStores.some(store => JSON.stringify({id: source.id, input: source.input, parameters: source.parameters}).includes(store.id))));
  check('every Ozon field and parameter has a Chinese label', ozonSources.every(source => hasChinese(source.title) &&
    source.fields.length > 0 && source.fields.every(field => field.confirmed === true && hasChinese(field.label) && hasChinese(field.description)) && source.parameters.every(param => hasChinese(param.label))));
  const legacy = originalSources.dataSources.filter(source => source.connectionId === connectionId && source.input?.storeId && !source.storeScoped);
  check('store-bound legacy definitions retired from current catalog', legacy.every(source => !sources.some(current => current.id === source.id)) &&
    !sources.some(source => source.connectionId === connectionId && source.input?.storeId && !source.storeScoped), {legacyDefinitionsFound: legacy.length});
  const migrated = await workbench();
  check('catalog initialization preserves original board designs', originalBoard.instances.every(prior => {
    const current = migrated.instances.find(row => row.instanceId === prior.instanceId);
    return current && same(current.design, prior.design) && same(current.position, prior.position);
  }));
  const legacyIds = new Set(legacy.map(source => source.id));
  const migrationCandidates = originalBoard.instances.filter(instance => Object.values(refs(instance)).some(ref => legacyIds.has(ref.id)));
  if (migrationCandidates.length) check('legacy component references migrate to shared sources', migrationCandidates.every(prior => {
    const current = migrated.instances.find(row => row.instanceId === prior.instanceId);
    return current && Object.values(refs(current)).every(ref => !legacyIds.has(ref.id) && sources.some(source => source.id === ref.id && source.revision === ref.revision) && localParams.every(key => !Object.hasOwn(ref.params, key)));
  }), {instances: migrationCandidates.map(row => row.instanceId)});
  else skip('legacy component references migrate to shared sources', 'This runtime board has no remaining legacy references; prior backups and checks are retained, no synthetic migration is claimed.');
  check('initialization has no migration issue', !initialized.issues?.some(issue => issue.id === 'workbench:migration'));

  if (mode !== 'board') {
    const results = new Map();
    for (const [index, store] of stores.entries()) {
      for (const kind of kinds) results.set(`${store.id}:${kind}`, await capabilityCase(store, kind, index + 1));
    }
    check('all twenty store/capability combinations attempted', evidence.cases.length === 20 && new Set(evidence.cases.map(row => `${row.storeId}:${row.kind}`)).size === 20);
    // Exercise a real Runtime cursor and then reject its use for another store.
    const firstPrices = results.get(`${stores[0].id}:prices`);
    if (firstPrices?.status === 'ok' && firstPrices.data?.cursor) {
      const input = {storeId: stores[0].id, limit, cursor: firstPrices.data.cursor};
      const next = await invoke(stores[0], 'prices', input, 'prices-runtime-second-page');
      check('Runtime accepts same-store continuation', validOutput(next, input), describe(next, input));
      const cross = await invoke(stores[1], 'prices', {...input, storeId: stores[1].id}, 'prices-runtime-cross-store-rejected');
      check('Runtime rejects cross-store cursor', cross.status !== 'ok' && cross.error?.code === 'INVALID_CURSOR', {status: cross.status, code: cross.error?.code});
    } else skip('Runtime cursor scope checks', 'No successful first-store price cursor was returned; no cursor is fabricated.');
  }
  if (mode !== 'capabilities') await verifyBoard(stores, sources, originalBoard);
} catch (error) {
  evidence.fatal = {code: error.code ?? 'ACCEPTANCE_FAILED', message: error.message, ...(error.artifact ? {artifact: error.artifact} : {})};
  check('acceptance completed without a fatal error', false, {code: evidence.fatal.code});
} finally {
  evidence.completedAt = new Date().toISOString();
  evidence.result = evidence.fatal || evidence.checks.some(row => row.passed === false) ? 'failed' : 'passed';
  evidence.totals = {cases: evidence.cases.length, withRows: evidence.cases.filter(row => row.outcome === 'rows').length,
    empty: evidence.cases.filter(row => row.outcome === 'empty').length, failed: evidence.cases.filter(row => !row.passed).length,
    checksPassed: evidence.checks.filter(row => row.passed === true).length, checksFailed: evidence.checks.filter(row => row.passed === false).length,
    checksNotApplicable: evidence.checks.filter(row => row.passed === null).length};
  const summaryPath = write('summary', evidence);
  console.log(JSON.stringify({result: evidence.result, ...evidence.totals, evidence: summaryPath}, null, 2));
  if (evidence.result !== 'passed') process.exitCode = 1;
}
