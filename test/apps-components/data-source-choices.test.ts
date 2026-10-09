import test from 'node:test';
import assert from 'node:assert/strict';
import {compileSchema} from '../../packages/app-contracts/src/index.ts';
import type {CapabilityDescriptor,JsonSchema} from '../../packages/app-contracts/src/index.ts';
import {HALLMARK_DESCRIPTORS} from '../../packages/app-hallmark/src/index.ts';
import {hallmarkProductSources,hallmarkCollectedSources} from '../../packages/app-hallmark/src/field-mappings.ts';
import {dataSourceDefinitionIssues,DATA_SOURCE_DRAFT_SCHEMA} from '../../packages/app-presentation/src/data-sources.ts';
import type {DataSourceDraft,DataSourceParameter} from '../../packages/app-presentation/src/types.ts';

const descriptor=HALLMARK_DESCRIPTORS.find(item=>item.capabilityId==='hallmark.products.list')!;
const source=hallmarkProductSources('connection',{id:'store',name:'店铺'})[0];
function choiceDefinition(parameter:DataSourceParameter,property:JsonSchema):{definition:DataSourceDraft;capability:CapabilityDescriptor}{
 return {
  definition:{...source,parameters:[...source.parameters.filter(item=>item.name!==parameter.name),parameter]},
  capability:{...descriptor,inputSchema:{...descriptor.inputSchema,properties:{...(descriptor.inputSchema.properties as Record<string,JsonSchema>),[parameter.name]:property}}},
 };
}

test('parameter choices keep scalar types and must satisfy the capability enum',()=>{
 const cases:{type:DataSourceParameter['type'];value:string|number|boolean;wrong:string|number|boolean}[]=[
  {type:'string',value:'on_sale',wrong:1},{type:'number',value:1.5,wrong:'1.5'},
  {type:'integer',value:2,wrong:1.5},{type:'boolean',value:false,wrong:'false'},
 ];
 for(const {type,value,wrong} of cases){
  const parameter:DataSourceParameter={name:'choice',label:'选择条件',type,choices:[{label:'已确认选项',value}]};
  const {definition,capability}=choiceDefinition(parameter,{type,enum:[value]});
  assert.deepEqual(compileSchema(DATA_SOURCE_DRAFT_SCHEMA)(definition),[]);
  assert.deepEqual(dataSourceDefinitionIssues(definition,capability),[]);
  const mismatched={...definition,parameters:definition.parameters.map(item=>item.name==='choice'?{...item,choices:[{label:'类型错误',value:wrong}]}:item)};
  assert.match(dataSourceDefinitionIssues(mismatched,capability).join(' '),/与参数类型不匹配/);
 }
 const forbidden=choiceDefinition({name:'status',label:'商品状态',type:'string',choices:[{label:'未登记状态',value:'invented'}]},{type:'string',enum:['on_sale','archived']});
 assert.match(dataSourceDefinitionIssues(forbidden.definition,forbidden.capability).join(' '),/不符合能力声明/);
 const malformed={...source,parameters:[{name:'status',label:'商品状态',type:'string',choices:[{label:'对象',value:{raw:'on_sale'}}]}]};
 assert.ok(compileSchema(DATA_SOURCE_DRAFT_SCHEMA)(malformed).length);
});

test('Hallmark status choices use the source status vocabulary and Chinese labels',()=>{
 assert.deepEqual(source.parameters.find(parameter=>parameter.name==='status')?.choices,[
  {label:'在售',value:'on_sale'},{label:'已归档',value:'archived'},
  {label:'审核中',value:'pending'},{label:'审核未通过',value:'rejected'},
  {label:'暂不可售',value:'not_sellable'},{label:'状态待确认',value:'unknown'},
 ]);
 assert.deepEqual(dataSourceDefinitionIssues(source,descriptor),[]);
 assert.equal(source.parameters.find(parameter=>parameter.name==='status')?.default,undefined);
 assert.equal(hallmarkCollectedSources('connection','item')[1].fields.find(field=>field.role==='price.current')?.label,'SKU 采集价格');
});
