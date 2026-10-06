import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,existsSync,rmSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,basename} from 'node:path';
import {spawnSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {AppStore} from '../../packages/store/index.ts';
test('backup command reads a consistent app JSON snapshot without key files, migration or overwrite',()=>{
 const directory=mkdtempSync(join(tmpdir(),'hallmark-backup-test-'));const database=join(directory,'app.db');const output=join(directory,'backup.json');
 try{
  const store=new AppStore(database);store.put('entries','synthetic-entry',{title:'isolated fixture',order:0});store.close();writeFileSync(join(directory,'service-key'),'DO-NOT-EXPORT-SYNTHETIC-KEY');
  const result=spawnSync(process.execPath,['scripts/backup.mjs','--database',database,'--output',output],{cwd:process.cwd(),encoding:'utf8'});assert.equal(result.status,0,result.stderr);
  const text=readFileSync(output,'utf8');const data=JSON.parse(text);assert.deepEqual(data.collections.entries,[{id:'synthetic-entry',value:{title:'isolated fixture',order:0}}]);assert.equal(text.includes('DO-NOT-EXPORT'),false);
  const again=spawnSync(process.execPath,['scripts/backup.mjs','--database',database,'--output',output],{cwd:process.cwd(),encoding:'utf8'});assert.notEqual(again.status,0);assert.equal(readFileSync(output,'utf8'),text);
  const inspection=new DatabaseSync(database,{readOnly:true});assert.equal(Number(inspection.prepare('PRAGMA user_version').get()!.user_version),2);inspection.close();
  const absent=join(directory,'missing.db');const missing=spawnSync(process.execPath,['scripts/backup.mjs','--database',absent,'--output',join(directory,'missing.json')],{cwd:process.cwd(),encoding:'utf8'});assert.notEqual(missing.status,0);assert.equal(existsSync(absent),false);
 }finally{const target=realpathSync(directory);assert.equal(target,resolve(directory));assert.ok(basename(target).startsWith('hallmark-backup-test-'));rmSync(target,{recursive:true,force:true});}
});
