import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readOzonComposition} from '../../packages/app-hallmark/src/ozon-compose.ts';
import {RuntimeStore} from '../../packages/app-runtime/src/store.ts';
import {HallmarkStorePort} from '../../packages/app-hallmark/src/store.ts';
import {OZON_COMPOSITION_SOURCE_FIELDS} from '../../packages/app-hallmark/src/ozon-composition.ts';
const normalize=(kind:string,row:any)=>({...Object.fromEntries((OZON_COMPOSITION_SOURCE_FIELDS as any)[kind].map((key:string)=>[key,null])),...row});
async function run(sources:any,fields:string[],grain='product'){
 const runtime=new RuntimeStore(':memory:');try{return await readOzonComposition({storeId:'fixture',dateFrom:'2026-09-01',dateTo:'2026-09-02',limit:100,recipe:{version:1,grain,fields}},new HallmarkStorePort(runtime,'fixture'),{} as any,undefined,async(kind,input)=>({status:'ok',data:{items:(sources[kind]??[]).map((r:any)=>normalize(kind,r)),warnings:[],dataTime:null}}));}finally{runtime.close();}
}
test('source OR join keeps original ordering, counts dual-key matches once and ignores invalid IDs',async()=>{
 const response:any=await run({products:[{productId:'1',sku:'10'}],stocks:[
 {productId:'1',sku:null,warehouseId:'1',warehouseName:'id-first',stockAvailable:2},
 {productId:null,sku:'10',warehouseId:'2',warehouseName:'sku-second',stockAvailable:3},
 {productId:'1',sku:'10',warehouseId:'3',warehouseName:'both-third',stockAvailable:5},
 {productId:'0',sku:'0',warehouseId:'4',warehouseName:'invalid',stockAvailable:100},
 {productId:null,sku:null,warehouseId:'5',warehouseName:'unknown',stockAvailable:100},
 {productId:'1',sku:null,warehouseId:'6',warehouseName:'id-last',stockAvailable:7},
 ]},['stocks.stockAvailable','stocks.warehouseName']);
 assert.equal(response.status,'ok');assert.equal(response.data.items[0].stocks.stockAvailable,17);assert.equal(response.data.items[0].stocks.warehouseName,'id-first · sku-second · both-third · id-last');
});
test('property fixtures match direct filter semantics with null, SKU-only, product-only and dual identities',async()=>{
 for(let seed=1;seed<=12;seed++){
  let state=seed;const rand=()=>((state=Math.imul(state,1664525)+1013904223>>>0)/2**32);
  const products=Array.from({length:15},(_,i)=>({productId:String(i+1),sku:i%5?String(i+101):'0'}));
  const stocks=Array.from({length:150},(_,i)=>{const p=products[Math.floor(rand()*products.length)],mode=Math.floor(rand()*4);return {productId:mode===0||mode===2?p.productId:null,sku:mode===1||mode===2?p.sku:null,warehouseId:String(i+1),warehouseName:`w${i}`,stockAvailable:rand()<0.07?null:Math.floor(rand()*40)};});
  const response:any=await run({products,stocks},['products.productId','stocks.stockAvailable','stocks.warehouseName']);assert.equal(response.status,'ok');
  for(let i=0;i<products.length;i++){const product=products[i],match=stocks.filter(r=>/^[1-9][0-9]*$/.test(product.sku)&&r.sku===product.sku||r.productId===product.productId),expected=match.length&&match.every(r=>typeof r.stockAvailable==='number')?match.reduce((sum,r)=>sum+r.stockAvailable!,0):null;assert.equal(response.data.items[i].stocks.stockAvailable,expected);assert.equal(response.data.items[i].stocks.warehouseName,match.map(r=>r.warehouseName).join(' · ')||null);}
 }
});
