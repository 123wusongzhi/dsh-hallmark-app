import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {join,resolve,sep} from 'node:path';
import {spawnSync} from 'node:child_process';
import {build} from 'esbuild';

/** Real Provider/Runtime/Presentation/Host/UI chain; only the external source response is synthetic. */
async function runProfitFixture(kind:'compute'|'filter') {
  const artifactRoot=resolve('artifacts');mkdirSync(artifactRoot,{recursive:true});
  const directory=mkdtempSync(join(artifactRoot,'profit-provenance-')),entry=join(directory,'fixture.mjs');
  assert.ok(resolve(directory).startsWith(artifactRoot+sep));
  try {
    await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
      import React from 'react';
      import {create,act} from 'react-test-renderer';
      import assert from 'node:assert/strict';
      import {AppsRuntime,RuntimeStore} from './packages/app-runtime/src/index.ts';
      import {HallmarkProvider,HallmarkStorePort} from './packages/app-hallmark/src/index.ts';
      import {AppsPresentationService} from './packages/app-presentation/src/index.ts';
      import {createAppsServer} from './packages/service/src/apps-server.ts';
      import {AppsHost,HttpAppsHostTransport} from './packages/plugin-apps/src/index.ts';
      import {AppsNativeView} from './packages/plugin-apps/client/view.tsx';
      import {ViewRenderer} from './packages/dsh-plugin/client/renderer.tsx';
      import {payloadRows} from './packages/dsh-plugin/client/model.ts';

      globalThis.IS_REACT_ACT_ENVIRONMENT=true;
      const listeners=new Map();globalThis.window={addEventListener(type,listener){const rows=listeners.get(type)??new Set();rows.add(listener);listeners.set(type,rows);},removeEventListener(type,listener){listeners.get(type)?.delete(listener);},dispatchEvent(){return true;}};
      const kind=${JSON.stringify(kind)},sourceFetchedAt='2026-09-13T04:05:06Z',requests=[],sourceCalls=[];
      const sourceProducts=[
        {storeId:'fixture-shop',offerId:'known-cost',productId:101,title:'有效成本商品 · 合成证据',price:100,currency:'CNY',profit:{costMinor:5000,profitMinor:2480,actualMargin:0.248}},
        {storeId:'fixture-shop',offerId:'missing-cost',productId:102,title:'缺成本商品 · 合成证据',price:100,currency:'CNY',profit:{costMinor:null,profitMinor:99999,actualMargin:0.93}},
        {storeId:'fixture-shop',offerId:'below-threshold',productId:103,title:'低于条件商品 · 合成证据',price:100,currency:'CNY',profit:{costMinor:8000,profitMinor:500,actualMargin:0.05}},
      ];
      const response=raw=>({status:'ok',raw,provenance:{source:'hallmark_snapshot',endpoint:'/fixture/store-products',fetchedAt:sourceFetchedAt}});
      const forbidden=async()=>{throw Error('This read/compute fixture must not call write, task, sync or unrelated source capabilities.');};
      const client={getStores:async()=>{sourceCalls.push('stores');return response([{id:'fixture-shop',shopName:'合成店铺'}]);},getStoreProducts:async()=>{sourceCalls.push('products');return response({stores:[{id:'fixture-shop'}],products:sourceProducts});},syncStoreProducts:forbidden,getTargetMargin:forbidden,searchCollectedItems:forbidden,getCollectedItem:forbidden,platformCall:forbidden,platformRead:forbidden};
      const broker={getStoreTask:forbidden,getListingTask:forbidden,requestId:()=>{throw Error('No Source write request may be prepared.');}};
      const store=new RuntimeStore(':memory:'),runtime=new AppsRuntime(store),port=new HallmarkStorePort(store,'fixture-connection'),provider=new HallmarkProvider({store:port,client,broker});runtime.register(provider);
      runtime.addConnection({appId:'hallmark',connectionId:'fixture-connection',displayName:'Fixture connection',enabled:true,config:{backend:'synthetic-source'},configRevision:1});runtime.bind({sessionId:'fixture-session',appId:'hallmark',connectionId:'fixture-connection',enabled:true,boundAt:new Date().toISOString()});
      const presentation=new AppsPresentationService({store,runtime});
      const binding={bindingId:'profit-data',appId:'hallmark',connectionId:'fixture-connection',capabilityId:kind==='compute'?'hallmark.profit.compute':'hallmark.products.filter',capabilityMajor:1,input:{storeId:'fixture-shop',...(kind==='filter'?{minMargin:0.2}:{})},projection:[],refresh:{mode:'manual'}};
      const design={layout:{type:'column',children:['profit-table']},widgets:[{id:'profit-table',type:'table',title:'参考利润明细',bindingId:'profit-data',columns:[{field:'title',label:'商品'},{field:'referenceProfit.margin',label:'参考利润率',format:'percent'}],options:{pageSize:20}}]};
      const view=presentation.createView('fixture-session',{title:'利润口径公开链验证',design,bindings:[binding]});
      const refreshed=await presentation.refreshView('fixture-session',view.viewId,{kind:'script',sessionId:'fixture-session',runId:'profit-provenance-isolated',stepKey:kind});
      const providerResult=store.list('invocations').find(row=>row.request.capabilityId===binding.capabilityId)?.result;
      assert.equal(providerResult?.status,'ok');assert.match(providerResult.provenance[0].metricBasis,/参考利润模型/);assert.match(providerResult.provenance[0].metricBasis,/非实际结算/);
      assert.equal(providerResult.provenance[0].fetchedAt,sourceFetchedAt);assert.equal(providerResult.provenance[0].sourceDataTime,null);
      const snapshot=refreshed.bindings[0];assert.equal(snapshot.state,'ready');assert.equal(snapshot.sourceDataTime,null);assert.match(snapshot.provenance[0].metricBasis,/非实际结算/);assert.notEqual(snapshot.lastSuccessAt,sourceFetchedAt);
      const rawRows=kind==='compute'?snapshot.payload.products:snapshot.payload.payload.products;
      const missing=kind==='compute'?snapshot.payload.products.find(row=>row.offerId==='missing-cost'):snapshot.payload.payload.unable[0];
      assert.equal(missing.referenceProfit.costMissing,true);assert.equal(missing.referenceProfit.margin,null);assert.equal(missing.referenceProfit.costMinor,null);assert.equal(missing.referenceProfit.profitMinor,null);
      assert.equal(rawRows[0].referenceProfit.margin,0.248);if(kind==='filter'){assert.deepEqual(rawRows.map(row=>row.offerId),['known-cost']);assert.equal(snapshot.payload.payload.unable.length,1);}
      const server=createAppsServer({runtime,presentation,token:'f'.repeat(64)});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
      const host=new AppsHost({agents:{get:id=>id==='fixture-session'?{id}:undefined}},new HttpAppsHostTransport('http://127.0.0.1:'+server.address().port,'f'.repeat(64))),nativeFetch=globalThis.fetch;
      globalThis.fetch=async(input,options)=>{if(String(input).startsWith('/api/dsh-apps')){requests.push({url:String(input),method:options?.method??'GET'});return host.ui(new Request('http://isolated-ui.fixture'+input,options));}return nativeFetch(input,options);};
      let tree;
      const text=node=>typeof node==='string'||typeof node==='number'?String(node):node?.children?.map(text).join('')??'';
      try {
        await act(async()=>{tree=create(<AppsNativeView sessionId="fixture-session" viewId={view.viewId}/>);});
        for(let wait=0;wait<100&&!tree.root.findAllByType(ViewRenderer).length;wait++)await act(async()=>{await new Promise(resolve=>setTimeout(resolve,5));});
        const renderer=tree.root.findByType(ViewRenderer),uiBinding=renderer.props.data[0],rows=payloadRows(uiBinding.payload),bodyRows=tree.root.findByType('tbody').findAllByType('tr');
        const proof={kind,fixtureOnly:true,installedDshGuiCovered:false,providerSourceTime:providerResult.provenance[0].sourceDataTime,providerFetchedAt:providerResult.provenance[0].fetchedAt,presentationSourceTime:snapshot.sourceDataTime,mappedSourceTime:uiBinding.dataTime??null,mappedBasis:uiBinding.metricBasis??null,renderedRows:bodyRows.map(text),rowIds:rows.map(row=>row.offerId??null),requests,sourceCalls};
        console.log(JSON.stringify(proof));
        assert.equal(uiBinding.dataTime,undefined,'unknown source time must not use fetchedAt or lastSuccessAt');
        const timeEvidence=tree.root.findAll(node=>node.props.className==='apps-component-times').map(text).join('');assert.match(timeEvidence,/源数据时间：暂无时间证据/);
        if(kind==='filter'){
          assert.deepEqual(rows.map(row=>row.offerId),['known-cost','missing-cost'],'generic renderer must unwrap the payload result and retain unable rows');
          assert.equal(bodyRows.length,2,'matched and missing-cost rows must both remain visible');
          assert.ok(!bodyRows.some(row=>text(row).includes('低于条件商品')),'filtered-out products must not reappear');
        } else assert.equal(bodyRows.length,3);
        assert.equal(uiBinding.metricBasis,providerResult.provenance[0].metricBasis,'Apps view mapping must carry the Provider metric basis to the shared renderer');
        const cells=bodyRows.map(row=>row.findAllByType('td').map(text)),known=cells.find(row=>row[0].includes('有效成本商品')),unknown=cells.find(row=>row[0].includes('缺成本商品'));
        assert.equal(known?.[1],'24.80%','reference profit displays the actual ratio only with its preserved basis');
        assert.equal(unknown?.[1],'—','missing cost must not render zero or the source unqualified actualMargin');
        const missingRow=bodyRows.find(row=>text(row).includes('缺成本商品'));
        assert.ok(missingRow?.findAll(node=>node.props['aria-label']==='无法判断（缺成本）').length,'missing-cost row remains explicitly labelled for accessible/tooltip display');
        const metricEvidence=tree.root.findAll(node=>node.props.className==='hm-data-evidence').map(text).join('');assert.match(metricEvidence,/参考利润模型/);assert.match(metricEvidence,/非实际结算净利润率/);assert.ok(!metricEvidence.includes('数据时间：'+sourceFetchedAt),'source fetch time must not be relabeled as business data time');
        assert.ok(requests.every(row=>row.method==='GET'));assert.equal(store.list('operations').length,0);assert.deepEqual(sourceCalls,['stores','products']);
        console.log('PROFIT_PROVENANCE_PUBLIC_CHAIN_PASS '+kind);
      } finally {if(tree)await act(async()=>tree.unmount());globalThis.fetch=nativeFetch;await host.dispose();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await runtime.dispose();store.close();}
    `},banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},outfile:entry,bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react/jsx-runtime','react-test-renderer']});
    const result=spawnSync(process.execPath,[entry],{encoding:'utf8',timeout:20000});
    assert.equal(result.status,0,(result.error?.message??result.stderr)+'\n'+result.stdout);
    assert.match(result.stdout,new RegExp('PROFIT_PROVENANCE_PUBLIC_CHAIN_PASS '+kind));
  } finally {assert.ok(resolve(directory).startsWith(artifactRoot+sep));rmSync(directory,{recursive:true,force:true});}
}

test('public Hallmark compute → Presentation → Apps view carries reference profit basis and leaves unknown source time unknown',()=>runProfitFixture('compute'));
test('public Hallmark filter → Presentation → Apps view renders matched and missing-cost groups without fabricated profit',()=>runProfitFixture('filter'));
