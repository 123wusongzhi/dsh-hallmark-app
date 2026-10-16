export const PERFORMANCE_POLICY_VERSION='component-first-screen/1' as const;
export const PERFORMANCE_PROFILE='controlled-images-v1' as const;
export const PERFORMANCE_IMAGE_DELAY_MS=120 as const;
/** Project acceptance budgets for the controlled preview, not Web Vitals thresholds. */
export const PERFORMANCE_LIMITS={initialReadyMs:2500,feedbackMs:250,blockingMs:300,maxTaskMs:200,layoutShift:0.1,domElements:3000,renderedRows:100,loadedScriptBytes:2*1024*1024} as const;

export interface PerformanceSample {
  readyMs:number;blockingMs:number;maxTaskMs:number;layoutShift:number;domElements:number;renderedRows:number;
  imageRequests:number;hiddenImageRequests:number;visibleImages:number;lazyVisibleImages:number;missingImageSpace:number;
  unprioritizedFirstImage:number;loadedScriptBytes:number;feedbackMs:number|null;
}
export interface PerformanceViewport {width:420|1040;initial:PerformanceSample;interactions:Array<PerformanceSample&{id:string}>}
export interface PerformanceEvidence {
  policyVersion:typeof PERFORMANCE_POLICY_VERSION;profile:typeof PERFORMANCE_PROFILE;imageDelayMs:typeof PERFORMANCE_IMAGE_DELAY_MS;
  viewports:PerformanceViewport[];verdict:'PASS'|'FAIL'|'INCOMPLETE';
}
export interface PerformanceFailure {id:string;code:string;actual:number|string;limit:number|string;message:string;repair:string}
export interface PerformanceEvaluation {verdict:'PASS'|'FAIL'|'INCOMPLETE';failures:PerformanceFailure[]}
const object=(value:unknown):Record<string,unknown>|undefined=>value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:undefined;
const shown=(value:unknown):number|string=>typeof value==='number'&&Number.isFinite(value)?value:typeof value==='string'?value:value===undefined?'missing':String(value);
const countFields=['domElements','renderedRows','imageRequests','hiddenImageRequests','visibleImages','lazyVisibleImages','missingImageSpace','unprioritizedFirstImage','loadedScriptBytes'] as const;
const timeFields=['readyMs','blockingMs','maxTaskMs','layoutShift'] as const;

/** Recompute from measured values; a caller's PASS label never determines the result. */
export function evaluatePerformance(input:unknown):PerformanceEvaluation {
  const failures:PerformanceFailure[]=[];let incomplete=false;
  const invalid=(id:string,actual:unknown,limit:string,message:string)=>{incomplete=true;failures.push({id,code:'PERFORMANCE_MEASUREMENT_INVALID',actual:shown(actual),limit,message,repair:'重新运行正式浏览器预览，保留完整的实际性能观测。'});};
  const evidence=object(input);
  if(!evidence){invalid('performance',input,'current signed performance evidence','缺少性能证据。');return {verdict:'INCOMPLETE',failures};}
  for(const [key,expected] of Object.entries({policyVersion:PERFORMANCE_POLICY_VERSION,profile:PERFORMANCE_PROFILE,imageDelayMs:PERFORMANCE_IMAGE_DELAY_MS}))if(evidence[key]!==expected)invalid(key,evidence[key],String(expected),'性能验收策略或受控图片配置不匹配。');
  if(!['PASS','FAIL','INCOMPLETE'].includes(String(evidence.verdict)))invalid('verdict',evidence.verdict,'PASS | FAIL | INCOMPLETE','性能结果状态无效。');
  const sample=(raw:unknown,id:string,initial:boolean)=>{
    const value=object(raw);if(!value){invalid(id,raw,'performance sample','缺少实际性能采样。');return;}
    const valid=new Set<string>();
    for(const key of [...timeFields,...countFields]){
      const number=value[key],integer=countFields.includes(key as typeof countFields[number]);
      if(typeof number!=='number'||!Number.isFinite(number)||number<0||integer&&!Number.isSafeInteger(number))invalid(`${id}:${key}`,number,integer?'finite nonnegative integer':'finite nonnegative number',`性能指标 ${key} 缺失或无效。`);
      else valid.add(key);
    }
    if(initial){if(value.feedbackMs!==null)invalid(`${id}:feedbackMs`,value.feedbackMs,'null','首次加载不应伪造交互反馈时间。');}
    else if(typeof value.feedbackMs!=='number'||!Number.isFinite(value.feedbackMs)||value.feedbackMs<0)invalid(`${id}:feedbackMs`,value.feedbackMs,'finite nonnegative number','缺少实际交互反馈时间。');
    else valid.add('feedbackMs');
    const budget=(key:string,limit:number,code:string,message:string,repair:string)=>{if(valid.has(key)&&Number(value[key])>limit)failures.push({id:`${id}:${key}`,code,actual:Number(value[key]),limit,message,repair});};
    if(initial)budget('readyMs',PERFORMANCE_LIMITS.initialReadyMs,'INITIAL_READY_BUDGET','首屏可用时间超出预算。','减少首屏串行请求和同步处理，优先展示已有数据。');
    else budget('feedbackMs',PERFORMANCE_LIMITS.feedbackMs,'INTERACTION_FEEDBACK_BUDGET','交互反馈超出预算。','先更新本地反馈，减少事件处理中的同步工作。');
    budget('blockingMs',PERFORMANCE_LIMITS.blockingMs,'MAIN_THREAD_BLOCKING_BUDGET','主线程阻塞累计超出预算。','拆分长任务，缓存重复计算并推迟非首屏工作。');
    budget('maxTaskMs',PERFORMANCE_LIMITS.maxTaskMs,'LONG_TASK_BUDGET','单次主线程任务超出预算。','拆分同步任务并限制一次渲染的数据量。');
    budget('layoutShift',PERFORMANCE_LIMITS.layoutShift,'LAYOUT_SHIFT_BUDGET','布局位移超出预算。','为图片和异步内容预留稳定尺寸。');
    budget('domElements',PERFORMANCE_LIMITS.domElements,'DOM_ELEMENTS_BUDGET','页面元素数超出预算。','分页或虚拟化长列表，避免挂载屏外详情。');
    budget('renderedRows',PERFORMANCE_LIMITS.renderedRows,'RENDERED_ROWS_BUDGET','同时渲染的商品或列表行过多。','使用分页或列表虚拟化，限制同屏挂载数量。');
    budget('hiddenImageRequests',0,'HIDDEN_IMAGE_REQUESTS','未显示区域发起了图片请求。','隐藏的详情或折叠区域在打开后再请求图片；允许近屏图片的懒加载预取。');
    budget('lazyVisibleImages',0,'VISIBLE_IMAGE_PRIORITY','首屏可见图片被设置为懒加载。','首屏可见图片使用 eager，屏外图片保留 lazy。');
    budget('missingImageSpace',0,'IMAGE_SPACE_MISSING','首屏图片加载前没有预留尺寸。','声明图片宽高或 CSS aspect-ratio。');
    budget('unprioritizedFirstImage',0,'FIRST_IMAGE_PRIORITY','首张可见图片没有高加载优先级。','给首张可见图片设置 fetchpriority="high"。');
    budget('loadedScriptBytes',PERFORMANCE_LIMITS.loadedScriptBytes,'SCRIPT_BYTES_BUDGET','加载脚本体积超出预算。','移除未使用依赖并延迟加载非首屏模块。');
  };
  if(!Array.isArray(evidence.viewports)){invalid('viewports',evidence.viewports,'420 and 1040','缺少双视口性能结果。');}
  else {
    const widths=new Set<number>();
    for(const [index,raw] of evidence.viewports.entries()){
      const viewport=object(raw),width=viewport?.width;
      if(!viewport||width!==420&&width!==1040||widths.has(width)){invalid(`viewports:${index}`,width,'distinct 420 or 1040','性能视口无效或重复。');continue;}
      widths.add(width);sample(viewport.initial,`${width}:initial`,true);
      if(!Array.isArray(viewport.interactions)){invalid(`${width}:interactions`,viewport.interactions,'interaction samples','缺少交互性能观测列表。');continue;}
      const ids=new Set<string>();
      for(const [index,raw] of viewport.interactions.entries()){
        const interaction=object(raw),id=interaction?.id;
        if(typeof id!=='string'||!id.trim()||ids.has(id)){invalid(`${width}:interactions:${index}:id`,id,'distinct nonempty interaction ID','交互性能观测身份无效或重复。');continue;}
        ids.add(id);sample(interaction,`${width}:${id}`,false);
      }
    }
    if(![420,1040].every(width=>widths.has(width)))invalid('viewports',evidence.viewports.length,'420 and 1040','正式性能验收必须覆盖 420 和 1040 两个视口。');
  }
  return {verdict:incomplete?'INCOMPLETE':failures.length?'FAIL':'PASS',failures};
}

function reject(code:string,message:string,failures:PerformanceFailure[]=[]):never {throw Object.assign(new Error(message),{code,failures});}
/** Validate signed diagnostics too; an honest FAIL/INCOMPLETE may be retained, never promoted. */
export function verifyPerformanceEvidence(input:unknown,expectedInteractions?:Record<string,string[]>):PerformanceEvaluation {
  const value=object(input);
  if(!value)reject('PREVIEW_PERFORMANCE_REQUIRED','正式预览缺少性能证据，请重新运行当前版本的预览检查。');
  if(value.policyVersion!==PERFORMANCE_POLICY_VERSION||value.profile!==PERFORMANCE_PROFILE||value.imageDelayMs!==PERFORMANCE_IMAGE_DELAY_MS)reject('PREVIEW_PERFORMANCE_POLICY_MISMATCH','性能证据不属于当前验收策略，请重新运行正式预览。');
  const evaluation=evaluatePerformance(value);
  if(expectedInteractions){
    const views=Array.isArray(value.viewports)?value.viewports:[];
    for(const width of [420,1040]){
      const expected=expectedInteractions[String(width)],viewport=views.find(view=>object(view)?.width===width),samples=object(viewport)?.interactions;
      const actual=Array.isArray(samples)?samples.map(sample=>object(sample)?.id):[];
      if(!Array.isArray(expected)||expected.length!==new Set(expected).size||actual.length!==expected.length||actual.some(id=>typeof id!=='string'||!expected.includes(id))){
        evaluation.verdict='INCOMPLETE';evaluation.failures.push({id:`${width}:interactions`,code:'PERFORMANCE_INTERACTION_COVERAGE',actual:actual.join(','),limit:Array.isArray(expected)?expected.join(','):'completed interaction IDs',message:'性能采样没有完整对应已执行的交互。',repair:'重新运行全部交互，并为每个实际完成的动作记录性能采样。'});
      }
    }
  }
  if(value.verdict!==evaluation.verdict)reject('PREVIEW_PERFORMANCE_INVALID','性能结论与实际观测重算结果不一致。',evaluation.failures);
  return evaluation;
}
export function requirePassingPerformance(input:unknown,expectedInteractions?:Record<string,string[]>):PerformanceEvaluation {
  const evaluation=verifyPerformanceEvidence(input,expectedInteractions);
  if(evaluation.verdict!=='PASS')reject(evaluation.verdict==='FAIL'?'PREVIEW_PERFORMANCE_FAILED':'PREVIEW_PERFORMANCE_INCOMPLETE',evaluation.failures[0]?.message??'性能验收尚未通过。',evaluation.failures);
  return evaluation;
}
