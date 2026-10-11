import test from 'node:test';
import assert from 'node:assert/strict';
import {createDisplayFormatters,displayDate,displayPrice,type Product} from '../../component-workspace/collected-products/src/lib/products.ts';
const base:Product={key:'test',title:'test',source:'test',timeLabel:'test'};

test('render-local formatters preserve exact exported helper output across currencies, ranges and number edges',()=>{
  const formatters=createDisplayFormatters();let cases=0;
  for(const currency of [undefined,'',' ','CNY','cny','USD','usd','USd','JPY','KWD','ZZZ','zzz','US','EURO','invalid!','人民币']){
    for(const [price,maxPrice] of [[undefined,4],[-0,undefined],[0,undefined],[-0,0],[-0,1],[-3.1,-1.2],[1.234,9.876],[10,10],[10,9],[NaN,undefined],[Infinity,undefined],[-Infinity,Infinity],[123456.789,234567.891]]){
      const product={...base,price,maxPrice,currency};
      assert.equal(formatters.displayPrice(product),displayPrice(product),`case ${cases++}: ${currency}, ${price}, ${maxPrice}`);
    }
  }
  assert.equal(cases,208);
});

test('new formatter bags follow current default timezone and preserve missing/invalid dates',()=>{
  const previous=process.env.TZ;const outputs=[];
  try{
    for(const timezone of ['UTC','America/New_York','Asia/Shanghai']){
      process.env.TZ=timezone;const formatters=createDisplayFormatters();
      for(const value of [undefined,'','invalid-date','2026-10-10T00:30:00Z','2026-03-08T07:30:00Z','2026-11-01T06:30:00Z','2026-10-10T12:34:00+08:00','2026-02-30'])assert.equal(formatters.displayDate(value),displayDate(value));
      outputs.push(formatters.displayDate('2026-10-10T00:30:00Z'));
    }
    assert.equal(new Set(outputs).size,3);
  }finally{if(previous===undefined)delete process.env.TZ;else process.env.TZ=previous;}
});

test('formatter construction stays lazy and only constructor failure is cached, never fallback text',()=>{
  const DateFormat=Intl.DateTimeFormat,NumberFormat=Intl.NumberFormat;let dates=0,numbers=0;
  try{
    Intl.DateTimeFormat=new Proxy(DateFormat,{construct(target,args){dates++;return Reflect.construct(target,args,target);}});
    Intl.NumberFormat=new Proxy(NumberFormat,{construct(target,args){numbers++;return Reflect.construct(target,args,target);}});
    const formatters=createDisplayFormatters();
    for(const value of [undefined,'','invalid-date'])assert.equal(formatters.displayDate(value),'时间未提供');
    assert.equal(formatters.displayPrice({...base,currency:'BAD!'}),'未提供报价');
    assert.deepEqual({dates,numbers},{dates:0,numbers:0});
    formatters.displayDate('2026-10-10T00:30:00Z');formatters.displayDate('2026-10-11T00:30:00Z');assert.equal(dates,1);
    formatters.displayPrice({...base,price:1,maxPrice:2,currency:'USD'});formatters.displayPrice({...base,price:4,currency:'USD'});assert.equal(numbers,1);
    assert.equal(formatters.displayPrice({...base,price:4,maxPrice:9,currency:'BAD!'}),'4 BAD! – 9 BAD!');
    assert.equal(formatters.displayPrice({...base,price:-0,maxPrice:3,currency:'BAD!'}),'0 BAD! – 3 BAD!');assert.equal(numbers,2);
    formatters.displayPrice({...base,price:1,maxPrice:2});formatters.displayPrice({...base,price:3});assert.equal(numbers,3);
    formatters.displayPrice({...base,price:1,maxPrice:2,currency:''});formatters.displayPrice({...base,price:3,currency:''});assert.equal(numbers,4);
    const next=createDisplayFormatters();next.displayDate('2026-10-10T00:30:00Z');next.displayPrice({...base,price:5,currency:'BAD!'});
    assert.deepEqual({dates,numbers},{dates:2,numbers:5});
  }finally{Intl.DateTimeFormat=DateFormat;Intl.NumberFormat=NumberFormat;}
});
