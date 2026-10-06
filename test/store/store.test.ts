import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { spawnSync, spawn } from 'node:child_process';
import { AppStore, COLLECTIONS, SCHEMA_VERSION } from '../../packages/store/src/index.ts';

function disk(t: any): string { const dir = mkdtempSync(join(tmpdir(),'hallmark-store-')); t.after(() => rmSync(dir,{recursive:true,force:true})); return join(dir,'app.db'); }
test('generic CRUD is parameterized, credentials rejected, export is JSON', () => {
  const store = new AppStore(':memory:');
  try { store.put('settings',"x' OR 1=1 --",{value:'safe'}); assert.deepEqual(store.get('settings',"x' OR 1=1 --"),{value:'safe'}); assert.equal(store.list('settings').length,1); assert.throws(() => store.get('settings; DROP TABLE settings','x'),/UNKNOWN_COLLECTION/); assert.throws(() => store.put('settings','secret',{nested:{'Api-Key':'secret'}}),/CREDENTIAL_FIELD_FORBIDDEN/); assert.throws(() => store.put('settings','secret',{'Client-Id':'123'}),/CREDENTIAL_FIELD_FORBIDDEN/); assert.equal(JSON.parse(store.exportJSON()).schemaVersion,SCHEMA_VERSION); assert.equal(store.delete('settings',"x' OR 1=1 --"),true); assert.equal(store.delete('settings','none'),false); } finally {store.close();}
});
test('transactions rollback atomically, nested savepoint, promise rejected', () => {
  const store = new AppStore(':memory:');
  try {
    assert.throws(() => store.transaction(() => {store.put('settings','a',{v:1}); throw new Error('stop');}),/stop/); assert.equal(store.get('settings','a'),undefined);
    store.transaction(() => {store.put('settings','outer',{v:1}); assert.throws(() => store.transaction(() => {store.put('settings','inner',{v:2}); throw new Error('nested');}),/nested/);}); assert.equal(store.get('settings','inner'),undefined); assert.ok(store.get('settings','outer'));
    assert.throws(() => store.transaction(() => Promise.resolve('no')),/ASYNC_TRANSACTION/);
  } finally {store.close();}
});
test('operations client keys are unique across connections and terminal state never regresses', t => {
  const path = disk(t), a = new AppStore(path), b = new AppStore(path);
  try {
    a.put('operations','op1',{operationId:'op1',clientKey:'same',kind:'update_price',state:'pending'});
    assert.throws(() => b.put('operations','op2',{operationId:'op2',clientKey:'same',state:'pending'}),/UNIQUE/);
    assert.equal(b.getOperationByClientKey<any>('same')?.operationId,'op1'); a.put('operations','op1',{operationId:'op1',clientKey:'same',state:'succeeded'}); assert.throws(() => b.put('operations','op1',{state:'running'}),/INVALID_OPERATION_TRANSITION/);
    assert.deepEqual(a.db.prepare('SELECT client_key,state FROM operations').get(),Object.assign(Object.create(null),{client_key:'same',state:'succeeded'}));
  } finally {a.close();b.close();}
});
test('snapshot failure retains exactly last successful payload; success overwrites single row', t => {
  const path = disk(t), store = new AppStore(path);
  store.updateSnapshotSuccess('store_products:1',[{id:1}],'2026-10-01',{provenance:{source:'hallmark_snapshot'}});
  const first = store.get<any>('snapshots','store_products:1');
  store.updateSnapshotState('store_products:1','refreshing'); store.updateSnapshotState('store_products:1','failed',{message:'offline'});
  const failed = store.get<any>('snapshots','store_products:1'); assert.deepEqual(failed.payload,first.payload); assert.equal(failed.lastSuccessAt,first.lastSuccessAt); assert.equal(failed.version,1); assert.equal(failed.state,'failed'); store.close();
  const again = new AppStore(path);
  try {assert.deepEqual(again.get<any>('snapshots','store_products:1')?.payload,[{id:1}]); again.updateSnapshotSuccess('store_products:1',[{id:2}],'2026-10-02'); assert.equal(again.list('snapshots').length,1); assert.equal(again.get<any>('snapshots','store_products:1')?.version,2);} finally {again.close();}
});
test('unknown source data time stays null independently of successful cache refresh time',()=>{
  const store=new AppStore(':memory:');try{const snapshot=store.updateSnapshotSuccess('store_products:unknown',{products:[]},null);assert.equal(snapshot.dataTime,null);assert.ok(Number.isFinite(Date.parse(snapshot.lastSuccessAt)));assert.equal((store.db.prepare('SELECT data_time FROM snapshots').get() as any).data_time,null);store.updateSnapshotState('store_products:unknown','failed');assert.equal(store.get<any>('snapshots','store_products:unknown')?.dataTime,null);}finally{store.close();}
});
test('v1 generic database migrates and backfills indexes', t => {
  const path = disk(t), db = new DatabaseSync(path);
  for (const table of COLLECTIONS) db.exec(`CREATE TABLE ${table} (id TEXT PRIMARY KEY,value_json TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)`);
  db.prepare('INSERT INTO operations VALUES (?,?,?,?)').run('old',JSON.stringify({operationId:'old',clientKey:'key',state:'unknown'}),'2020','2020'); db.exec('PRAGMA user_version=1'); db.close();
  const store = new AppStore(path); try {assert.equal(store.getOperationByClientKey<any>('key')?.state,'unknown'); assert.equal((store.db.prepare('PRAGMA user_version').get() as any).user_version,2);} finally {store.close();}
});
test('concurrent processes serialize snapshot versions without losing updates', async t => {
  const path = disk(t), initial = new AppStore(path); initial.close();
  const moduleURL = new URL('../../packages/store/src/index.ts',import.meta.url).href;
  const workers = [1,2].map(worker => new Promise<void>((resolve,reject) => {
    const child = spawn(process.execPath,['--input-type=module','-e',`import { AppStore } from ${JSON.stringify(moduleURL)}; const store = new AppStore(${JSON.stringify(path)}); for(let i=0;i<20;i++) store.updateSnapshotSuccess('concurrent',{worker:${worker},i},'2026-10-05'); store.close();`],{stdio:'inherit'});
    child.once('error',reject); child.once('exit',code => code === 0 ? resolve() : reject(new Error('Worker exit '+code)));
  }));
  await Promise.all(workers);
  const store = new AppStore(path); try {assert.equal(store.get<any>('snapshots','concurrent')?.version,40); assert.equal(store.list('snapshots').length,1);} finally {store.close();}
});
test('abrupt process termination rolls back uncommitted changes and preserves committed data', t => {
  const path = disk(t), store = new AppStore(path); store.put('settings','committed',{ok:true}); store.close();
  const moduleURL = new URL('../../packages/store/src/index.ts',import.meta.url).href;
  const result = spawnSync(process.execPath,['--input-type=module','-e',`import { AppStore } from ${JSON.stringify(moduleURL)}; const store = new AppStore(${JSON.stringify(path)}); store.transaction(() => { store.put('settings','uncommitted',{bad:true}); process.exit(17); });`],{stdio:'inherit'});
  assert.equal(result.status,17);
  const restarted = new AppStore(path); try {assert.deepEqual(restarted.get('settings','committed'),{ok:true}); assert.equal(restarted.get('settings','uncommitted'),undefined);} finally {restarted.close();}
});
