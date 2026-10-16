import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {build} from 'esbuild';
import {realCorpus,realSourceSummaries} from '../real-data/corpus.ts';

test('real Component refreshes render-local formatting while retaining legacy inline cell behavior and empty-value laziness',async()=>{
  mkdirSync('artifacts',{recursive:true});const directory=mkdtempSync(resolve('artifacts/formatter-state-regression-'));const entry=join(directory,'test.mjs');
  try{
    await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
      import React from 'react';import {create,act} from 'react-test-renderer';import assert from 'node:assert/strict';
      import Component from './component-workspace/collected-products/src/Component.tsx';
      import {displayDate,displayPrice} from './component-workspace/collected-products/src/lib/products.ts';
      globalThis.IS_REACT_ACT_ENVIRONMENT=true;globalThis.document={documentElement:{dataset:{}}};globalThis.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
      let networkAttempts=0;globalThis.fetch=()=>{networkAttempts++;throw Error('No network allowed');};
      const recordedRows=${JSON.stringify(realSourceSummaries().slice(0,2).sort((a,b)=>Date.parse(b.importedAt)-Date.parse(a.importedAt)))};
      const rows=recordedRows.map(row=>({key:row.id,row:structuredClone(row),identity:{kind:'collected_item',itemId:row.id}}));
      let lastSuccessAt=${JSON.stringify(realCorpus().capturedAt)};let revision=0;const makeData=()=>({bindings:[{bindingId:'collected',lastSuccessAt,payload:{items:rows.map(x=>x.row)}}],selection:[{bindingId:'collected',eligible:true,rows:rows.map(x=>({...x}))}],revision:String(++revision)});
      let data=makeData();const context={theme:'light',attachment:{available:true}},listeners=new Set(),requests=[],origin='https://fixture.invalid';
      const parent={postMessage(message,target){assert.equal(target,origin);requests.push(message.method);assert.ok(['getData','getContext'].includes(message.method));queueMicrotask(()=>{for(const listener of listeners)listener({source:parent,origin,data:{channel:message.channel,requestId:message.requestId,result:message.method==='getData'?data:context}});});}};
      globalThis.window={parent,location:{origin},addEventListener(type,fn){listeners.add(fn);},removeEventListener(type,fn){listeners.delete(fn);}};
      let tree;const oldTimezone=process.env.TZ;process.env.TZ='UTC';await act(async()=>{tree=create(<Component/>);});
      const host=(type,label)=>tree.root.findAllByType(type).find(n=>n.props['aria-label']===label);
      const text=node=>typeof node==='string'?node:node.children.map(text).join('');
      const branches=()=>[tree.root.findAllByType('tbody')[0].findAllByType('tr')[0],tree.root.findAllByType('article')[0]];
      const firstDate=()=>branches()[0].findByType('time').children.filter(c=>typeof c==='string').join('');
      const imageSrcs=()=>branches().map(row=>row.findAllByType('img').map(img=>img.props.src));
      const assertOutput=()=>{const row=rows[0].row;for(const branch of branches()){
        const price=branch.findAllByType('span').find(n=>['product-price','missing-value'].includes(n.props.className));
        assert.equal(text(price),displayPrice({price:row.minPrice,maxPrice:row.maxPrice,currency:row.currency}));
        assert.equal(branch.findByType('time').children.filter(c=>typeof c==='string').join(''),displayDate(row.collectedAt??row.importedAt));
        assert.equal(text(branch.findByProps({className:'product-name'})),row.title);
        assert.deepEqual(branch.findAllByType('img').map(img=>img.props.src),[row.mainImage]);
      }if(lastSuccessAt)assert.ok(text(tree.root.findByProps({className:'data-caption'})).includes(displayDate(lastSuccessAt)));};
      const emit=async()=>{data=makeData();await act(async()=>{for(const listener of listeners)listener({source:parent,origin,data:{channel:'hallmark.source.v1',event:'data',data}});});};
      const toggle=async()=>{await act(async()=>host('input','选择'+rows[0].row.title).props.onChange());};
      assertOutput();
      assert.deepEqual(rows.map(x=>x.row),recordedRows);
      const dates=[];for(const timezone of ['UTC','America/New_York','Asia/Shanghai']){process.env.TZ=timezone;await toggle();assertOutput();dates.push(firstDate());}assert.equal(new Set(dates).size,3);
      const selected=host('input','选择'+rows[0].row.title).props.checked;
      // Currency casing, fractional/negative-zero values and empty values are explicit formatting boundary controls.
      for(const currency of ['USD','usd','USd','JPY','KWD','ZZZ','zzz','','invalid!']){
        rows[0]={...rows[0],row:{...rows[0].row,minPrice:-0,maxPrice:123.456,currency}};await emit();assertOutput();assert.equal(host('input','选择'+rows[0].row.title).props.checked,selected);
      }
      const DateFormat=Intl.DateTimeFormat,NumberFormat=Intl.NumberFormat;let dateConstructions=0,numberConstructions=0;
      try{
        Intl.DateTimeFormat=new Proxy(DateFormat,{construct(target,args){dateConstructions++;return Reflect.construct(target,args,target);}});
        Intl.NumberFormat=new Proxy(NumberFormat,{construct(target,args){numberConstructions++;return Reflect.construct(target,args,target);}});
        for(let i=0;i<rows.length;i++)rows[i]={...rows[i],row:{...rows[i].row,importedAt:undefined,collectedAt:i?'invalid-date':undefined,minPrice:undefined,maxPrice:undefined,currency:'invalid!'}};lastSuccessAt=undefined;await emit();await toggle();assertOutput();
        assert.deepEqual({dateConstructions,numberConstructions},{dateConstructions:0,numberConstructions:0});
      }finally{Intl.DateTimeFormat=DateFormat;Intl.NumberFormat=NumberFormat;}
      assert.deepEqual(requests,['getData','getContext']);assert.equal(networkAttempts,0);await act(async()=>tree.unmount());assert.equal(listeners.size,0);
      if(oldTimezone===undefined)delete process.env.TZ;else process.env.TZ=oldTimezone;
      console.log(JSON.stringify({crossRenderTimezone:true,sameKeyRefresh:true,noValueConstructors:0,requests,networkAttempts}));
    `},banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},outfile:entry,bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react/jsx-runtime','react-test-renderer']});
    const result=spawnSync(process.execPath,[entry],{encoding:'utf8',timeout:15000});assert.equal(result.status,0,result.error?.message??result.stderr);assert.match(result.stdout,/crossRenderTimezone/);
  }finally{rmSync(directory,{recursive:true,force:true});}
});
