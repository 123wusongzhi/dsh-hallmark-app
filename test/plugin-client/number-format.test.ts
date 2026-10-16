import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {formatMaterialCurrency,formatMaterialInteger,formatMaterialPercent} from '../../packages/dsh-plugin/client/widgets/number-format.ts';

test('fixed numeric formatters preserve native rounding, negative zero and non-finite scaled values',()=>{
  const values=[0,-0,1.005,-1.005,1.234567,-1.234567,1234567.891,Number.MIN_VALUE,Number.MAX_VALUE,NaN,Infinity,-Infinity];
  for(const value of values){
    assert.equal(formatMaterialInteger(value),new Intl.NumberFormat('zh-CN',{maximumFractionDigits:0}).format(value));
    assert.equal(formatMaterialPercent(value),new Intl.NumberFormat('zh-CN',{style:'percent',maximumFractionDigits:2}).format(value));
    for(const currency of ['CNY','USD','JPY','BHD','KWD','CLF','XXX','ZZZ'])assert.equal(formatMaterialCurrency(value,currency),new Intl.NumberFormat('zh-CN',{style:'currency',currency,currencyDisplay:'code',maximumFractionDigits:2}).format(value));
  }
});

test('currency formatters are bounded and failed construction is not cached',()=>{
  const Native=Intl.NumberFormat;let calls=0;
  try{
    Intl.NumberFormat=new Proxy(Native,{construct(target,args){calls++;return Reflect.construct(target,args);}});
    for(let i=0;i<10;i++)assert.equal(formatMaterialCurrency(1234.567,'CNY'),new Native('zh-CN',{style:'currency',currency:'CNY',currencyDisplay:'code',maximumFractionDigits:2}).format(1234.567));
    assert.equal(calls,1,'same currency reuses its formatter');
    for(let i=0;i<40;i++){const currency='X'+String.fromCharCode(65+i%26)+String.fromCharCode(65+Math.floor(i/26));formatMaterialCurrency(1,currency);}
    assert.equal(calls,41);formatMaterialCurrency(-0,'CNY');assert.equal(calls,42,'old currency was evicted after more than 32 distinct currencies');
    for(let i=0;i<2;i++)assert.throws(()=>formatMaterialCurrency(1,'BAD!'),RangeError);assert.equal(calls,44,'failed construction is retried instead of cached');
  }finally{Intl.NumberFormat=Native;}
});

test('replacing the Intl constructor invalidates cached numeric formatters',()=>{
  const Native=Intl.NumberFormat;
  try{
    formatMaterialCurrency(1,'CNY');formatMaterialInteger(1);formatMaterialPercent(1);
    Intl.NumberFormat=new Proxy(Native,{construct(){throw new RangeError('replacement constructor');}});
    for(const call of [()=>formatMaterialCurrency(1,'CNY'),()=>formatMaterialInteger(1),()=>formatMaterialPercent(1)])assert.throws(call,/replacement constructor/);
  }finally{Intl.NumberFormat=Native;}
  assert.equal(formatMaterialCurrency(-0,'JPY'),new Native('zh-CN',{style:'currency',currency:'JPY',currencyDisplay:'code',maximumFractionDigits:2}).format(-0));
});

test('loading the formatter module does not eagerly require Intl',()=>{
  const url=new URL('../../packages/dsh-plugin/client/widgets/number-format.ts',import.meta.url).href;
  const code=`const saved=globalThis.Intl;globalThis.Intl=undefined;const module=await import(${JSON.stringify(url)});globalThis.Intl=saved;if(module.formatMaterialInteger(12.3)!=='12')throw Error('lazy Intl restoration failed');`;
  const result=spawnSync(process.execPath,['--input-type=module','--eval',code],{encoding:'utf8',timeout:10000});assert.equal(result.status,0,result.stderr);
});
