import type {JsonValue} from '../../app-contracts/src/index.ts';

export interface PreviewTestCase {
  id:string;required?:boolean;action?:'click'|'fill';selector:string;checkSelector?:string;
  check:'count'|'checked'|'value'|'visible'|'contains'|'text';expected:JsonValue;value?:string;
}
export interface PreviewTestPlan {version:1;mode:'interactive'|'noninteractive';reason:string|null;cases:PreviewTestCase[];errors:string[]}
/** Coverage is declared before execution; absent or unsupported actions cannot pass as smoke tests. */
export function previewTestPlan(input:{assertions?:unknown;noninteractiveReason?:unknown}):PreviewTestPlan {
  const errors:string[]=[],cases:PreviewTestCase[]=[],mode=input.noninteractiveReason===undefined?'interactive':'noninteractive';
  const reason=typeof input.noninteractiveReason==='string'?input.noninteractiveReason.trim():null;
  if(mode==='noninteractive'&&!reason)errors.push('NONINTERACTIVE_REASON_REQUIRED');
  if(!Array.isArray(input.assertions))errors.push('PREVIEW_TEST_PLAN_REQUIRED');
  else for(const item of input.assertions){
    if(!item||typeof item!=='object'||Array.isArray(item)){errors.push('INVALID_TEST_CASE');continue;}
    const value=item as Record<string,unknown>;
    if(Object.keys(value).some(key=>!['id','required','action','selector','checkSelector','check','expected','value'].includes(key))||typeof value.id!=='string'||!value.id.trim()||['bridge.v2','render.visible','layout.viewport'].includes(value.id)||cases.some(prior=>prior.id===value.id)||typeof value.selector!=='string'||!value.selector.trim()||value.checkSelector!==undefined&&(typeof value.checkSelector!=='string'||!value.checkSelector.trim())||value.required!==undefined&&typeof value.required!=='boolean'||!['count','checked','value','visible','contains','text'].includes(String(value.check))||!Object.hasOwn(value,'expected')||value.action!==undefined&&!['click','fill'].includes(String(value.action))||value.action==='fill'&&typeof value.value!=='string'){
      errors.push('INVALID_TEST_CASE:'+String(value.id??''));continue;
    }
    cases.push(structuredClone(value) as unknown as PreviewTestCase);
  }
  if(!cases.some(item=>item.required!==false))errors.push('REQUIRED_TEST_CASE_MISSING');
  if(mode==='interactive'&&!cases.some(item=>item.required!==false&&item.action))errors.push('REQUIRED_INTERACTION_MISSING');
  if(mode==='noninteractive'&&cases.some(item=>item.action))errors.push('NONINTERACTIVE_ACTION_CONFLICT');
  return {version:1,mode,reason,cases,errors};
}
