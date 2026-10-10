import {test} from 'node:test';
import assert from 'node:assert/strict';
import {HallmarkClient} from '../../packages/hallmark-adapter/index.ts';

const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status});
const assignment={storeId:'synthetic-store',itemIds:['synthetic-item'],instruction:'Synthetic listing test'};
for(const [service,route] of [['hallmark-board','/api/tasks'],['hallmark-control','/api/assignments']] as const){
  test(`${service} selects ${route} before its single assignment POST`,async()=>{
    const requests:Array<{path:string;init:RequestInit}>=[],raw={ok:true,created:1,reused:0,taskIds:['task-1'],tasks:[],additive:{preserved:true}};
    const client=new HallmarkClient({operatorToken:'synthetic-operator-token',fetchImpl:async(url,init={})=>{const path=new URL(String(url)).pathname;requests.push({path,init});return path==='/api/health'?json({service}):json(raw);}});
    const result=await client.createAssignment(assignment);assert.equal(result.status,'ok');assert.deepEqual(result.raw,raw);assert.deepEqual(requests.map(row=>[row.path,row.init.method]),[['/api/health','GET'],[route,'POST']]);assert.deepEqual(JSON.parse(String(requests[1].init.body)),assignment);assert.equal(new Headers(requests[1].init.headers).get('Authorization'),'Bearer synthetic-operator-token');assert.equal(requests[1].init.redirect,'error');
  });
  for(const fault of ['response-lost','invalid-json','404','503'] as const)test(`${service} assignment ${fault} never retries another route`,async()=>{
    const posts:string[]=[];
    const client=new HallmarkClient({operatorToken:'synthetic-operator-token',fetchImpl:async(url,init={})=>{const path=new URL(String(url)).pathname;if(path==='/api/health')return json({service});assert.equal(init.method,'POST');posts.push(path);if(fault==='response-lost')throw Error('Response lost after acceptance');if(fault==='invalid-json')return new Response('incomplete',{status:200});return json({code:'SOURCE_ERROR',error:'Synthetic rejection'},Number(fault));}});
    const result=await client.createAssignment(assignment);assert.deepEqual(posts,[route]);assert.notEqual(result.status,'ok');if(['response-lost','invalid-json'].includes(fault)){assert.equal(result.status,'unknown');assert.equal(result.error?.code,'OUTCOME_UNKNOWN');assert.equal(result.error?.retryable,false);}
  });
}

test('unrecognized or unavailable health never dispatches an assignment',async()=>{
  for(const response of [json({service:'unrelated-service'}),json({code:'DOWN'},503)]){
    let posts=0;const client=new HallmarkClient({operatorToken:'synthetic-operator-token',fetchImpl:async(_url,init={})=>{if(init.method==='POST')posts++;return response;}});
    assert.notEqual((await client.createAssignment(assignment)).status,'ok');assert.equal(posts,0);
  }
});
