import test from 'node:test';
import assert from 'node:assert/strict';
import {RuntimeStore} from '../../packages/app-runtime/src/store.ts';
import {AppsSnapshotScheduler} from '../../packages/service/src/apps-scheduler.ts';
import type {PresentationStore} from '../../packages/app-presentation/src/types.ts';
function scheduler(store:PresentationStore){return new AppsSnapshotScheduler({store,describe:()=>undefined,refresh:async()=>{throw new Error('unexpected refresh');},isConnectionEnabled:()=>true});}
function outcome(fn:()=>unknown){try{return {value:fn()};}catch(cause){const error=cause as Error;return {error:{name:error.name,message:error.message}};}}
function compare(values:unknown[],raw?:{id:string;value:string|Uint8Array}[],allowIngressRejection=false):{value?:unknown;error?:{name:string;message:string};ingress?:{error?:{name:string;message:string}}[]}{const store=new RuntimeStore(':memory:');try{
 const indexes=()=>store.db.prepare("SELECT name,sql FROM sqlite_master WHERE type='index' AND tbl_name='provider_records' ORDER BY name").all();
 const originalIndexes=indexes(),ingress:{error?:{name:string;message:string}}[]=[];
 assert.ok(originalIndexes.some(row=>row.name==='provider_records_namespace_view'));
 const insert=(write:()=>unknown)=>{const before=store.db.prepare('SELECT * FROM provider_records ORDER BY id').all(),result=outcome(write);if(result.error){if(!allowIngressRejection)assert.fail(JSON.stringify(result.error));assert.equal(result.error.name,'Error');assert.match(result.error.message,/malformed JSON/i);assert.deepEqual(store.db.prepare('SELECT * FROM provider_records ORDER BY id').all(),before);ingress.push(result);}else ingress.push({});};
 for(const [i,value] of values.entries())insert(()=>store.put('provider_records',String(i).padStart(4,'0'),value));
 for(const row of raw??[])insert(()=>store.db.prepare('INSERT INTO provider_records(id,value_json,created_at,updated_at) VALUES(?,?,?,?)').run(row.id,row.value,'2000','2000'));
 store.db.exec("UPDATE provider_records SET created_at='2000'");
 const fallback:PresentationStore={get:store.get.bind(store),list:store.list.bind(store),put:store.put.bind(store),delete:store.delete.bind(store),transaction:store.transaction.bind(store)};
 const expected=outcome(()=>scheduler(fallback).list()),actual=outcome(()=>scheduler(store).list());assert.deepEqual(actual,expected);assert.deepEqual(indexes(),originalIndexes);return allowIngressRejection?{...actual,ingress}:actual;
 }finally{store.close();}}
const valid={appId:'apps',connectionId:'presentation',namespace:'apps_schedules',value:{scheduleId:'a'}};
test('top-level null keeps the original TypeError before or after matching records',()=>{
 for(const values of [[null],[null,valid],[valid,null],[valid,{unrelated:true},null]])assert.deepEqual(compare(values),{error:{name:'TypeError',message:"Cannot read properties of null (reading 'appId')"}});
});
test('all legal primitive/array/object metadata cases retain strict scheduler filter behavior',()=>{
 const cases:unknown[]=[false,true,0,-0,1,-1,1.5,Number.MAX_VALUE,Number.MIN_VALUE,'','apps','null','["apps"]',[],[null],['apps'],{},Object.create(null),{appId:null},{appId:false},{appId:1},{appId:['apps']},{appId:{value:'apps'}},{appId:'apps\0suffix'},{appId:'apps\ud800'},{appId:'Apps'},{appId:'apps',connectionId:1},{appId:'apps',connectionId:true},{appId:'apps',connectionId:['presentation']},{appId:'apps',connectionId:'presentation',namespace:['apps_schedules']},{appId:'apps',connectionId:'presentation',namespace:{value:'apps_schedules'}},{'appId\0suffix':'apps',connectionId:'presentation',namespace:'apps_schedules'}];
 for(const value of cases)assert.deepEqual(compare([value,valid]),{value:[valid.value]});
});
test('matching records retain null, primitive and missing plan values and original sorting errors',()=>{
 for(const value of [null,false,0,'plan',[],{}, {scheduleId:0},{scheduleId:null}])compare([{...valid,value},valid]);
 compare([{appId:'apps',connectionId:'presentation',namespace:'apps_schedules'},valid]);
 assert.deepEqual(compare([{...valid,value:null}]),{value:[null]});
});
test('latest expression indexes reject malformed SQL JSON at ingress; accepted JSON5 retains JSON.parse error precedence',()=>{
 for(const text of ['{bad','undefined','NaN','{"appId":"apps",}','[1,]'])for(const values of [[],[null],[valid],[valid,null]]){
  const result=compare(values,[{id:'0009',value:text}],true);
  // json_extract accepts some JSON5 inputs that JSON.parse rejects; preserve both boundaries.
  if(['{bad','undefined'].includes(text)){assert.equal(result.ingress!.at(-1)?.error?.name,'Error');assert.notEqual(result.error?.name,'SyntaxError');}
  else {assert.equal(result.ingress!.at(-1)?.error,undefined);assert.equal(result.error?.name,'SyntaxError');}
 }
 const malformed=compare([null],[{id:'0009',value:'{first-bad'},{id:'0010',value:'{second-bad'}],true);assert.equal(malformed.ingress!.filter(row=>row.error).length,2);assert.equal(malformed.error?.name,'TypeError');
 const blob=compare([null],[{id:'0009',value:new TextEncoder().encode('{bad')}],true);assert.equal(blob.ingress!.filter(row=>row.error).length,1);assert.equal(blob.error?.name,'TypeError');
});
test('latest expression indexes reject SQLite-depth-exceeding JSON without weakening indexes or subsequent reads',()=>{
 let value:unknown={leaf:true};for(let i=0;i<1100;i++)value={nested:value};
 const result=compare([value,valid],undefined,true);assert.equal(result.ingress![0].error?.name,'Error');assert.deepEqual(result.value,[valid.value]);
 compare([], [{id:'0009',value:' \n null \t '}]);
});

test('raw duplicate metadata keys retain JSON.parse last-key-wins filtering',()=>{
 for(const field of ['appId','connectionId','namespace'])for(const values of [['other',valid[field as keyof typeof valid]], [valid[field as keyof typeof valid],'other']]){
  const rest=Object.entries(valid).filter(([key])=>key!==field).map(([key,value])=>JSON.stringify(key)+':'+JSON.stringify(value));
  const text='{'+[JSON.stringify(field)+':'+JSON.stringify(values[0]),...rest,JSON.stringify(field)+':'+JSON.stringify(values[1])].join(',')+'}';
  compare([valid],[{id:'0009',value:text}]);
 }
});
