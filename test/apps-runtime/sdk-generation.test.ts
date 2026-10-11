import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {generateArtifacts} from '../../packages/app-sdk/src/index.ts';
import {HALLMARK_DESCRIPTORS} from '../../packages/app-hallmark/src/index.ts';
import type {CapabilityDescriptor,JsonSchema} from '../../packages/app-contracts/src/index.ts';

function checkAssignments(schema:JsonSchema,assignments:string) {
  const descriptor={...HALLMARK_DESCRIPTORS[0],inputSchema:schema} as CapabilityDescriptor;
  const generated=generateArtifacts([descriptor]).source.match(/^export type Input0 = .+;$/m)![0];
  const filename='sdk-generation-fixture.ts',source=`type JsonValue = null | boolean | number | string | JsonValue[] | {[key:string]:JsonValue};\n${generated}\n${assignments}`;
  const options:ts.CompilerOptions={strict:true,noEmit:true,skipLibCheck:true,types:[],target:ts.ScriptTarget.ES2022},host=ts.createCompilerHost(options),read=host.getSourceFile.bind(host);
  host.getSourceFile=(path,...args)=>path===filename?ts.createSourceFile(path,source,options.target!,true):read(path,...args);
  const program=ts.createProgram([filename],options,host),diagnostics=ts.getPreEmitDiagnostics(program);
  assert.deepEqual(diagnostics.map(d=>ts.flattenDiagnosticMessageText(d.messageText,'\n')),[],generated);
}

test('SDK anyOf keeps same-level fields and required-only branches use the inherited field type',()=>{
  checkAssignments({type:'object',properties:{store:{type:'string'},id:{type:'string'},sku:{type:'number'},limit:{type:'number'}},required:['store'],additionalProperties:false,anyOf:[{required:['id']},{required:['sku']}]},`
const byId:Input0={store:'s',id:'one',limit:1};
const bySku:Input0={store:'s',sku:12};
// @ts-expect-error base requirement cannot be erased by anyOf
const missingStore:Input0={id:'one'};
// @ts-expect-error at least one selection is required
const missingSelection:Input0={store:'s'};
// @ts-expect-error inherited id type must remain string
const wrongId:Input0={store:'s',id:42};
// @ts-expect-error optional sibling fields keep their declared type
const wrongLimit:Input0={store:'s',id:'one',limit:'one'};
// @ts-expect-error required-only branches do not reopen a closed parent object
const extra:Input0={store:'s',id:'one',unexpected:true};`);
});

test('SDK oneOf retains base requirements and discriminant branches',()=>{
  checkAssignments({type:'object',properties:{store:{type:'string'},mode:{enum:['id','sku']},id:{type:'string'},sku:{type:'number'}},required:['store'],additionalProperties:false,oneOf:[{properties:{mode:{const:'id'}},required:['mode','id']},{properties:{mode:{const:'sku'}},required:['mode','sku']}]},`
const first:Input0={store:'s',mode:'id',id:'one'};
const second:Input0={store:'s',mode:'sku',sku:12};
// @ts-expect-error same-level required store survives
const missingStore:Input0={mode:'id',id:'one'};
// @ts-expect-error correct mode still requires its own selected field
const wrongBranch:Input0={store:'s',mode:'sku',id:'one'};
// @ts-expect-error inherited branch field types survive
const wrongId:Input0={store:'s',mode:'id',id:12};`);
});

test('SDK allOf intersects all branches with the same-level object',()=>{
  checkAssignments({type:'object',properties:{store:{type:'string'},id:{type:'string'},quantity:{type:'number'}},required:['store'],additionalProperties:false,allOf:[{required:['id']},{required:['quantity']}]},`
const complete:Input0={store:'s',id:'one',quantity:1};
// @ts-expect-error missing inherited same-level required field
const missingStore:Input0={id:'one',quantity:1};
// @ts-expect-error each allOf required-only branch remains mandatory
const missingQuantity:Input0={store:'s',id:'one'};
// @ts-expect-error inherited types are not unknown JSON
const wrongQuantity:Input0={store:'s',id:'one',quantity:'one'};`);
});

test('SDK composition keeps sibling primitive constraints and parenthesizes intersections',()=>{
  checkAssignments({type:'string',anyOf:[{enum:['a','b',42]}],allOf:[{enum:['a',42]}]},`
const valid:Input0='a';
// @ts-expect-error same-level string excludes the numeric alternative
const numeric:Input0=42;
// @ts-expect-error allOf also applies alongside anyOf
const wrong:Input0='b';`);
});

test('current category descriptor generates useful nested required alternatives',()=>{
  const descriptor=HALLMARK_DESCRIPTORS.find(row=>row.capabilityId==='hallmark.categories.read')!;
  checkAssignments(descriptor.inputSchema,`
const byId:Input0={storeId:'s',mode:'search',q:'terminal',limit:10};
const byName:Input0={store:'Shop',mode:'show',descriptionCategoryId:'1',typeId:'2'};
const sync:Input0={storeId:'s',mode:'sync'};
// @ts-expect-error a bound connection does not identify the business store
const missingStore:Input0={mode:'search',q:'terminal'};
// @ts-expect-error search requires q
const missingQuery:Input0={storeId:'s',mode:'search'};
// @ts-expect-error template requires exact category identity
const missingType:Input0={storeId:'s',mode:'template',descriptionCategoryId:'1'};
// @ts-expect-error sibling field type cannot become arbitrary JSON
const wrongQuery:Input0={storeId:'s',mode:'search',q:12};
// @ts-expect-error the chosen mode remains a closed object
const wrongModeField:Input0={storeId:'s',mode:'sync',q:'not allowed'};`);
});
