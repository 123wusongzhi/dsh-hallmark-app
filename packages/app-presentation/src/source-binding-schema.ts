import type {JsonSchema} from '../../app-contracts/src/index.ts';
const string:JsonSchema={type:'string',minLength:1},integer:JsonSchema={type:'integer',minimum:1};
export const SOURCE_CONTEXT_SCHEMA:JsonSchema={type:'object',properties:{storeId:string},required:['storeId'],additionalProperties:false};
export const SOURCE_REF_SCHEMA:JsonSchema={type:'object',properties:{id:string,revision:integer,params:{type:'object'}},required:['id','revision','params'],additionalProperties:false};
export const SOURCE_REFS_SCHEMA:JsonSchema={type:'object',additionalProperties:SOURCE_REF_SCHEMA};
export const DATASET_BINDING_SCHEMA:JsonSchema={type:'object',properties:{bindingId:string,appId:string,connectionId:string,capabilityId:string,capabilityMajor:integer,input:{},projection:{type:'array',items:string},datasetId:string,refresh:{type:'object',properties:{mode:{enum:['manual','scheduled']},scheduleId:string},required:['mode'],additionalProperties:false}},required:['bindingId','appId','connectionId','capabilityId','capabilityMajor','input','projection','refresh'],additionalProperties:false};
