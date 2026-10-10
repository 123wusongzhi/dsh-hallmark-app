import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';
const [aPath,bPath,out]=process.argv.slice(2),a=JSON.parse(readFileSync(aPath)),b=JSON.parse(readFileSync(bPath));
assert.deepEqual(a.turns,b.turns,'All complete responses and schedule states, no field normalization');
const changes=[];for(const [table,rows]of Object.entries(a.tableSnapshot)){
 const next=b.tableSnapshot[table];assert.equal(rows.length,next.length,table+' length');
 for(let i=0;i<rows.length;i++){
  const x=rows[i],y=next[i];assert.equal(x.id,y.id);
  if(table==='provider_records'&&JSON.parse(x.value_json)?.namespace==='ozon_composition_source_results'){
   assert.deepEqual({...x,updated_at:y.updated_at},y,'Only archive updated_at may differ');
   if(x.updated_at!==y.updated_at){assert.equal(x.updated_at,'2026-10-10T00:10:00.000Z');assert.equal(y.updated_at,'2026-10-10T00:00:00.000Z');changes.push({table,id:x.id,before:x.updated_at,after:y.updated_at});}
  }else assert.deepEqual(x,y,table+':'+x.id);
 }
}
assert.equal(a.upstream,0);assert.equal(b.upstream,0);assert.equal(a.providerCalls,20);assert.equal(b.providerCalls,20);assert.equal(b.schedulerRefreshes,10);assert.equal(b.archiveWrites,0);assert.equal(b.snapshotReads,0);assert.equal(a.snapshotReads,20);
const result={status:'PASS',grain:a.grain,n:a.n,rows: Object.fromEntries(Object.entries(a.tableSnapshot).map(([k,v])=>[k,v.length])),turnsCompared:a.turns.length,onlyAllowedDifferences:changes,baselineCounters:{snapshotReads:a.snapshotReads,archiveWrites:a.archiveWrites},combinedCounters:{snapshotReads:b.snapshotReads,archiveWrites:b.archiveWrites},clock:'Explicit simulated one-minute ticks, fixed identical UTC; performance.now fixed only for strict functional parity, not timing'};
if(out)writeFileSync(out,JSON.stringify(result,null,2));console.log(JSON.stringify(result));
