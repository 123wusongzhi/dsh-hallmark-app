import {uiProduct,uiProducts,uiStore,uiListingPayload,uiText} from '../real-data/ui-scenarios.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import type {BindingData,DataBinding,ViewSpec,WidgetSpec} from '../../packages/presentation/src/types.ts';

const require=createRequire(import.meta.url),{create,act}=require('react-test-renderer');
const built=await build({stdin:{contents:`
  export {MaterialImage,ProductList} from './packages/dsh-plugin/client/widgets/product-list.tsx';
  export {ProductTable} from './packages/dsh-plugin/client/widgets/product-table.tsx';
  export {ViewRenderer} from './packages/dsh-plugin/client/renderer.tsx';
`,resolveDir:fileURLToPath(new URL('../../',import.meta.url)),loader:'tsx'},bundle:true,platform:'node',format:'cjs',write:false,external:['react']});
const compiled={exports:{} as Record<string,React.ComponentType<any>>};
new Function('require','module','exports',built.outputFiles[0].text)(require,compiled,compiled.exports);
const {MaterialImage,ProductList,ProductTable,ViewRenderer}=compiled.exports;

const fields={'product.id':'id','product.name':'title','product.image':'image'};
const rows=uiProducts(30).map((row,index)=>({...row,id:index+1}));
const searchTerm='a';
const matchingRows=rows.map((row,index)=>({row,index:index+1})).filter(({row})=>row.title.toLowerCase().includes(searchTerm)||String(row.id).toLowerCase().includes(searchTerm));
const descendingRows=rows.map((row,index)=>({row,index:index+1})).sort((a,b)=>b.row.title.localeCompare(a.row.title,'zh-CN',{numeric:true}));
const binding:DataBinding={id:'products',fieldMap:fields};
const data:BindingData={bindingId:'products',datasetKey:'image-priority',state:'ready',payload:{products:rows},provenance:{source:'real_corpus_projection'}};

function expectPage(tree:any,expected:number[],visible=true){
  const images=tree.root.findByType('tbody').findAllByType('img');
  assert.deepEqual(images.map((image:any)=>image.props.src),expected.map(index=>rows[index-1].image));
  for(const [index,image] of images.entries()){
    assert.equal(image.props.loading,visible&&index<6?'eager':'lazy',`display row ${index+1} loading`);
    assert.equal(image.props.fetchpriority,visible&&index<6?'high':'auto',`display row ${index+1} priority`);
    assert.equal(image.props.decoding,'async');
    assert.equal(image.props.referrerPolicy,'no-referrer');
    assert.equal(image.props.className,'hm-material-image');
  }
  assert.equal(images.filter((image:any)=>image.props.fetchpriority==='high').length,visible?Math.min(6,expected.length):0);
}

for(const variant of ['list','procurement','table'] as const){
  test(`${variant} prioritizes only the first six displayed rows after paging, sorting and filtering`,()=>{
    const expectedMatching=variant==='table'?rows.map((row,index)=>({row,index:index+1})).filter(({row})=>[row.title,row.image].some(value=>value.toLowerCase().includes(searchTerm))):matchingRows;
    const columns=(variant==='procurement'?['product.name']:['product.image','product.name']).map(field=>({field,label:field==='product.name'?'商品名称':'商品图片'}));
    const widget:WidgetSpec={id:'products',type:variant==='table'?'table':'product_list',bindingId:'products',fields,columns,options:{pageSize:10,rowsPath:'products',...(variant==='procurement'?{materialId:'product-procurement'}:{})}};
    let tree:any;
    act(()=>{tree=create(React.createElement(variant==='table'?ProductTable:ProductList,{widget,binding,data,rows}));});
    try{
      const next=()=>tree.root.findAllByType('button').find((button:any)=>button.props['aria-label']==='下一页'||button.children.includes('下一页'));
      const sort=()=>tree.root.findByType('thead').findAllByType('button').find((button:any)=>button.props['aria-label']==='商品名称，点击排序'||button.children.includes('商品名称'));
      expectPage(tree,[1,2,3,4,5,6,7,8,9,10]);
      act(()=>next().props.onClick());
      expectPage(tree,[11,12,13,14,15,16,17,18,19,20]);
      act(()=>sort().props.onClick({persist(){},shiftKey:false}));
      act(()=>sort().props.onClick({persist(){},shiftKey:false}));
      expectPage(tree,descendingRows.slice(0,10).map(row=>row.index));
      act(()=>tree.root.findByProps({type:'search'}).props.onChange({target:{value:searchTerm}}));
      expectPage(tree,descendingRows.filter(({row,index})=>expectedMatching.some(match=>match.index===index)).slice(0,10).map(row=>row.index));
      act(()=>next().props.onClick());
      expectPage(tree,descendingRows.filter(({row,index})=>expectedMatching.some(match=>match.index===index)).slice(10,20).map(row=>row.index));
    }finally{act(()=>tree.unmount());}
  });
}

test('MaterialImage preserves failure placeholders and retries a changed URL with its current priority',()=>{
  let tree:any;
  const original=rows[0].image,replacement=rows[1].image;
  const render=(value:string,priority:boolean)=>React.createElement(MaterialImage,{value,name:rows[0].title,priority});
  act(()=>{tree=create(render(original,true));});
  try{
    act(()=>tree.root.findByType('img').props.onError());
    assert.equal(tree.root.findAllByType('img').length,0);
    assert.equal(tree.root.findByProps({'aria-label':'暂无商品图片'}).props.className,'hm-material-image hm-material-image-empty');
    act(()=>tree.update(render(original,false)));
    assert.equal(tree.root.findAllByType('img').length,0,'changing priority does not retry a failed URL');
    act(()=>tree.update(render(replacement,false)));
    assert.equal(tree.root.findByType('img').props.src,replacement);
    assert.equal(tree.root.findByType('img').props.loading,'lazy');
    act(()=>tree.update(render(replacement,true)));
    assert.equal(tree.root.findByType('img').props.loading,'eager');
    assert.equal(tree.root.findByType('img').props.fetchpriority,'high');
    act(()=>tree.update(render('javascript:alert(1)',true)));
    assert.equal(tree.root.findAllByType('img').length,0);
  }finally{act(()=>tree.unmount());}
});

test('React 18 emits native priority attributes and product cards request their first image eagerly',()=>{
  const widget:WidgetSpec={id:'card',type:'product_card',bindingId:'products',fields:{image:'image',title:'title'}};
  const spec:ViewSpec={id:'image-card',title:'商品',layout:{type:'column',children:['card']},widgets:[widget],bindings:[binding]};
  const markup=renderToStaticMarkup(React.createElement(ViewRenderer,{spec,data:[data]}));
  assert.match(markup,/<img[^>]+fetchpriority="high"[^>]+loading="eager"[^>]+decoding="async"[^>]+src=/);
  const lazy=renderToStaticMarkup(React.createElement(MaterialImage,{value:rows[0].image,name:rows[0].title}));
  assert.match(lazy,/fetchpriority="auto"[^>]+loading="lazy"[^>]+decoding="async"[^>]+src=/);
});

test('nested hidden tabs stay lazy and activation preserves each mounted widget state',()=>{
  const columns=['product.image','product.name'].map(field=>({field,label:field}));
  const widgets:WidgetSpec[]=[
    {id:'list',title:'列表',type:'product_list',bindingId:'products',fields,columns,options:{pageSize:10}},
    {id:'procurement',title:'采购',type:'product_list',bindingId:'products',fields,columns:[columns[1]],options:{pageSize:10,materialId:'product-procurement'}},
    {id:'table',title:'表格',type:'table',bindingId:'products',fields,columns,options:{pageSize:10}},
    {id:'card',title:'卡片',type:'product_card',bindingId:'products',fields:{image:'image',title:'title'}},
  ];
  const spec:ViewSpec={id:'nested-tabs',title:'商品',layout:{type:'tabs',children:['list',{type:'tabs',children:['procurement','table','card']}]},widgets,bindings:[binding]};
  let tree:any;
  act(()=>{tree=create(React.createElement(ViewRenderer,{spec,data:[data]}));});
  try{
    const section=(title:string)=>tree.root.findByProps({'aria-label':title});
    const page=(title:string,ids:number[],visible:boolean)=>expectPage({root:section(title)},ids,visible);
    const tab=(level:number,index:number)=>tree.root.findAllByProps({role:'tablist'})[level].findAllByType('button')[index];
    const initial=[1,2,3,4,5,6,7,8,9,10],second=[11,12,13,14,15,16,17,18,19,20];
    page('列表',initial,true);page('采购',initial,false);page('表格',initial,false);
    assert.equal(section('卡片').findByType('img').props.loading,'lazy');
    act(()=>section('列表').findAllByType('button').find((button:any)=>button.children.includes('下一页')).props.onClick());
    page('列表',second,true);
    act(()=>tab(0,1).props.onClick());
    page('列表',second,false);page('采购',initial,true);page('表格',initial,false);
    act(()=>section('采购').findByProps({type:'search'}).props.onChange({target:{value:searchTerm}}));
    const matching=matchingRows.slice(0,10).map(row=>row.index);
    page('采购',matching,true);
    act(()=>tab(1,1).props.onClick());
    page('采购',matching,false);page('表格',initial,true);
    // Hiding a failed image must preserve its fallback instead of retrying it on every tab switch.
    act(()=>section('表格').findAllByType('img')[0].props.onError());
    assert.equal(section('表格').findAllByType('img').length,9);
    act(()=>tab(1,2).props.onClick());
    assert.equal(section('卡片').findByType('img').props.fetchpriority,'high');
    act(()=>tab(0,0).props.onClick());
    page('列表',second,true);
    assert.equal(section('卡片').findByType('img').props.fetchpriority,'auto');
    act(()=>tab(0,1).props.onClick());
    assert.equal(tab(1,2).props['aria-selected'],true,'nested selection survives hiding its parent');
    assert.equal(section('卡片').findByType('img').props.fetchpriority,'high');
    act(()=>tab(1,1).props.onClick());
    assert.equal(section('表格').findAllByType('img').length,9,'failed URL remains failed after hiding and revealing');
    act(()=>tab(1,0).props.onClick());
    assert.equal(section('采购').findByProps({type:'search'}).props.value,searchTerm);
    page('采购',matching,true);
  }finally{act(()=>tree.unmount());}
});

test('only six cards across visible nested layouts are prioritized and hidden cards do not consume their budget',()=>{
  const widgets:WidgetSpec[]=Array.from({length:16},(_,index)=>({id:`card-${index}`,title:`卡片 ${index}`,type:'product_card',bindingId:'products',fields:{image:'image',title:'title'}}));
  const group=(start:number)=>({type:'column' as const,children:[{type:'row' as const,children:widgets.slice(start,start+4).map(widget=>widget.id)},{type:'grid' as const,children:widgets.slice(start+4,start+8).map(widget=>widget.id)}]});
  const spec:ViewSpec={id:'card-tabs',title:'商品卡片',layout:{type:'tabs',children:[group(0),group(8)]},widgets,bindings:[binding]};
  let tree:any;
  act(()=>{tree=create(React.createElement(ViewRenderer,{spec,data:[data]}));});
  try{
    const check=(start:number)=>{
      assert.equal(tree.root.findAllByType('img').filter((image:any)=>image.props.fetchpriority==='high').length,6);
      widgets.forEach((widget,index)=>{
        const image=tree.root.findByProps({'aria-label':widget.title}).findByType('img'),priority=index>=start&&index<start+6;
        assert.equal(image.props.loading,priority?'eager':'lazy',widget.id);
        assert.equal(image.props.fetchpriority,priority?'high':'auto',widget.id);
      });
    };
    check(0);
    act(()=>tree.root.findByProps({role:'tablist'}).findAllByType('button')[1].props.onClick());
    check(8);
  }finally{act(()=>tree.unmount());}
});
