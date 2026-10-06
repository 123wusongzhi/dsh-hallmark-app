import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesTableSearch, readableISODate, tableCellValue, tableColumnKind, tablePageSize } from '../../packages/dsh-plugin/client/widgets/table-format.ts';

test('ISO timestamps use an explicit device zone for display and retain the exact original value',()=>{
  const iso='2026-10-02T10:12:01.123Z';
  assert.deepEqual(readableISODate(iso,'Asia/Shanghai'),{date:'2026/10/02',time:'18:12:01',iso});
  assert.deepEqual(readableISODate('2026-10-02T18:12:01+08:00','UTC'),{date:'2026/10/02',time:'10:12:01',iso:'2026-10-02T18:12:01+08:00'});
  assert.deepEqual(readableISODate('2024-02-29','America/Los_Angeles'),{date:'2024/02/29',iso:'2024-02-29'},'date-only values cannot drift to the previous day');
});

test('calendar validation never turns numeric IDs, ambiguous dates or rollover dates into timestamps',()=>{
  for(const value of [20261002,'123','2026','01/02/2026','2026-02-29','2026-04-31','2026-13-02','2026-10-02T24:00:00Z','2026-10-02T10:61:00Z','2026-10-02T10:12:01','2026-10-02T10:12:01+25:00','SKU-2026-10-02'])assert.equal(readableISODate(value,'UTC'),undefined,String(value));
  const raw=tableCellValue({collected_at:'123'},{field:'collected_at',label:'采集时间',format:'date'},undefined,undefined,'RUB','UTC');
  assert.equal(raw.text,'123');assert.equal(raw.date,undefined);
  const title=tableCellValue({title:'2026-10-02'},{field:'title',label:'产品名称'},undefined,undefined,'RUB','UTC');assert.equal(title.text,'2026-10-02');assert.equal(title.date,undefined);
});

test('column presentation follows mappings and configured semantics without reordering the schema',()=>{
  const binding={id:'items',fieldMap:{title:'source.description',collected:'source.collected_at'}};
  assert.equal(tableColumnKind({field:'title',label:'名称'},[],binding),'title');
  assert.equal(tableColumnKind({field:'collected',label:'采集时间'},[],binding),'date');
  assert.equal(tableColumnKind({field:'sku',label:'SKU'},[{sku:'000123'}]),'text');
  assert.equal(tableColumnKind({field:'count',label:'数量'},[{count:12},{count:null}]),'number');
  for(const field of ['importedAt','imported_at']){
    const column={field,label:'导入时间'};
    assert.equal(tableColumnKind(column,[]),'date');
    assert.equal(tableCellValue({[field]:'2026-10-02T10:12:01Z'},column,undefined,undefined,'RUB','Asia/Shanghai').date?.time,'18:12:01');
    assert.equal(column.label,'导入时间','presentation never relabels import time as collection time');
  }
  const value=tableCellValue({source:{collected_at:'2026-10-02T10:12:01Z'}},{field:'collected',label:'采集时间'},binding,undefined,'RUB','Asia/Shanghai');assert.equal(value.date?.time,'18:12:01');
});

test('unavailable profits stay missing with reasons, while real zero and losses retain their values',()=>{
  const column={field:'referenceProfit.margin',label:'参考利润率',format:'percent' as const};
  assert.deepEqual(tableCellValue({referenceProfit:{margin:0,costMissing:true}},column,undefined,'basis','RUB'),{text:'—',missing:true,title:'无法判断（缺成本）'});
  assert.deepEqual(tableCellValue({referenceProfit:{margin:.2}},column,undefined,undefined,'RUB'),{text:'—',missing:true,title:'无法判断（缺口径）'});
  assert.equal(tableCellValue({referenceProfit:{margin:0}},column,undefined,'basis','RUB').text,'0.00%');
  assert.equal(tableCellValue({referenceProfit:{margin:-.2}},column,undefined,'basis','RUB').text,'-20.00%');
  assert.equal(tableCellValue({price:0},{field:'price',label:'售价',format:'currency'},undefined,undefined,'CNY').text,'¥0.00');
  assert.equal(tableCellValue({price:null},{field:'price',label:'售价',format:'currency'},undefined,undefined,'CNY').text,'—');
});

test('current-snapshot text matching accepts readable and raw source values without locale case surprises',()=>{
  assert.equal(matchesTableSearch('Travel 收纳包','Travel 收纳包','ＴＲＡＶＥＬ'),true);
  assert.equal(matchesTableSearch('2026-10-02T10:12:01Z','2026/10/02 18:12:01','2026/10/02'),true);
  assert.equal(matchesTableSearch('2026-10-02T10:12:01Z','2026/10/02 18:12:01','10:12:01Z'),true);
  assert.equal(matchesTableSearch(undefined,'—','0'),false,'a suppressed missing-profit value cannot match zero');
  assert.equal(matchesTableSearch('旅行收纳','旅行收纳','不存在'),false);
});

test('page size keeps valid schema choices, defaults to ten and bounds invalid values',()=>{
  assert.equal(tablePageSize(20),20);assert.equal(tablePageSize('50'),50);assert.equal(tablePageSize(12.9),12);assert.equal(tablePageSize(500),200);
  for(const value of [undefined,null,'',0,-1,Infinity,'not a size'])assert.equal(tablePageSize(value),10);
});
