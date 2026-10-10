import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';

test('result reader saves complete response and prints only pagination metadata',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'result-reader-'));
 const page={result:{data:{products:[{title:'真实字段'}]}},total:1,returned:1,nextCursor:null,completeness:'complete'};
 let requested='';
 const server=createServer((req,res)=>{requested=req.url??'';assert.equal(req.headers.authorization,'Bearer fixture-key');res.setHeader('content-type','application/json');res.end(JSON.stringify(page));});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const port=(server.address() as {port:number}).port;
  writeFileSync(join(dir,'key'),'fixture-key');
  writeFileSync(join(dir,'request.json'),JSON.stringify({runtime:{url:`http://127.0.0.1:${port}`,keyFile:join(dir,'key')},resultRef:'result:abc',outputPath:join(dir,'output.json')}));
  const child=spawn(process.execPath,[resolve('scripts/apps-read-result.mjs'),join(dir,'request.json')]);let stdout='',stderr='';child.stdout.on('data',value=>stdout+=value);child.stderr.on('data',value=>stderr+=value);
  const code=await new Promise(resolve=>child.on('close',resolve));assert.equal(code,0,stderr);
  assert.equal(requested,'/v1/results/result%3Aabc?cursor=0&limit=100');
  assert.deepEqual(JSON.parse(readFileSync(join(dir,'output.json'),'utf8')),page);
  assert.equal(JSON.parse(stdout).total,1);assert.ok(!stdout.includes('fixture-key'));assert.ok(!stdout.includes('真实字段'));
 }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));rmSync(dir,{recursive:true,force:true});}
});
