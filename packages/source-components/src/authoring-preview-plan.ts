import type {JsonValue} from '../../app-contracts/src/index.ts';

export interface PreviewTestCase {
  id:string;required?:boolean;action?:'click'|'fill';selector:string;checkSelector?:string;
  check:'count'|'checked'|'value'|'visible'|'contains'|'text';expected:JsonValue;value?:string;valueFromSelector?:string;viewports?:number[];operationTimeoutMs?:number;screenshot?:{selector?:string};
}
export interface PreviewTestPlan {version:1;mode:'interactive'|'noninteractive';reason:string|null;cases:PreviewTestCase[];errors:string[]}
/** Coverage is declared before execution; absent or unsupported actions cannot pass as smoke tests. */
export function previewTestPlan(input:{assertions?:unknown;noninteractiveReason?:unknown;validationProfile?:'draft';draftViewport?:number}):PreviewTestPlan {
  const errors:string[]=[],cases:PreviewTestCase[]=[],mode=input.noninteractiveReason===undefined?'interactive':'noninteractive';
  const draft=input.validationProfile==='draft',width=input.draftViewport??420;
  if(draft&&(!Number.isInteger(width)||width<320||width>4096))errors.push('DRAFT_VIEWPORT_INVALID');
  const reason=typeof input.noninteractiveReason==='string'?input.noninteractiveReason.trim():null;
  if(mode==='noninteractive'&&!reason)errors.push('NONINTERACTIVE_REASON_REQUIRED');
  if(!Array.isArray(input.assertions)&&!(draft&&input.assertions===undefined))errors.push('PREVIEW_TEST_PLAN_REQUIRED');
  else for(const item of Array.isArray(input.assertions)?input.assertions:[]){
    if(!item||typeof item!=='object'||Array.isArray(item)){errors.push('INVALID_TEST_CASE');continue;}
    const value=item as Record<string,unknown>;
    if(Object.keys(value).some(key=>!['id','required','action','selector','checkSelector','check','expected','value','valueFromSelector','viewports','operationTimeoutMs','screenshot'].includes(key))||typeof value.id!=='string'||!value.id.trim()||['bridge.v2','render.visible','layout.viewport'].includes(value.id)||cases.some(prior=>prior.id===value.id)||typeof value.selector!=='string'||!value.selector.trim()||value.checkSelector!==undefined&&(typeof value.checkSelector!=='string'||!value.checkSelector.trim())||value.required!==undefined&&typeof value.required!=='boolean'||!['count','checked','value','visible','contains','text'].includes(String(value.check))||!Object.hasOwn(value,'expected')||value.action!==undefined&&!['click','fill'].includes(String(value.action))||value.action==='fill'&&!(typeof value.value==='string'&&value.valueFromSelector===undefined||typeof value.valueFromSelector==='string'&&value.valueFromSelector.trim()&&value.value===undefined)||value.valueFromSelector!==undefined&&value.action!=='fill'){
      errors.push('INVALID_TEST_CASE:'+String(value.id??''));continue;
    }
    if(value.viewports!==undefined&&(!Array.isArray(value.viewports)||!value.viewports.length||new Set(value.viewports).size!==value.viewports.length||value.viewports.some(viewport=>!(draft?[420,1040,width]:[420,1040]).includes(viewport)))){errors.push('INVALID_VIEWPORTS:'+value.id);continue;}
    if(value.operationTimeoutMs!==undefined&&(!Number.isInteger(value.operationTimeoutMs)||Number(value.operationTimeoutMs)<1||Number(value.operationTimeoutMs)>30000)){errors.push('INVALID_OPERATION_TIMEOUT:'+value.id);continue;}
    if(value.screenshot!==undefined){const shot=value.screenshot as Record<string,unknown>|null;if(!shot||typeof shot!=='object'||Array.isArray(shot)||Object.keys(shot).some(key=>key!=='selector')||shot.selector!==undefined&&(typeof shot.selector!=='string'||!shot.selector.trim())){errors.push('INVALID_SCREENSHOT:'+value.id);continue;}}
    cases.push(structuredClone(value) as unknown as PreviewTestCase);
  }
  if(!draft&&!cases.some(item=>item.required!==false))errors.push('REQUIRED_TEST_CASE_MISSING');
  if(!draft&&mode==='interactive'&&![420,1040].every(width=>cases.some(item=>item.required!==false&&item.action&&(!item.viewports||item.viewports.includes(width)))))errors.push('REQUIRED_INTERACTION_MISSING');
  if(mode==='noninteractive'&&cases.some(item=>item.action))errors.push('NONINTERACTIVE_ACTION_CONFLICT');
  return {version:1,mode,reason,cases,errors};
}
