/** Static dependency/classification checks only; they do not prove assertion coverage. */
export function auditTestDataClassification(scope,{testFiles,fileExists,recordingDependency}){
  const all=new Set(testFiles),required=new Set(scope.requiredFiles),infrastructure=new Set(scope.infrastructureFiles),rows=[],failures=[];
  for(const [kind,files] of [['required',scope.requiredFiles],['infrastructure',scope.infrastructureFiles]]){
    const seen=new Set();
    for(const file of files){if(seen.has(file))failures.push({file,error:`duplicate ${kind} classification`});seen.add(file);}
  }
  for(const file of required)if(infrastructure.has(file))failures.push({file,error:'overlapping required and infrastructure classifications'});
  for(const file of scope.requiredFiles){
    if(!fileExists(file)){failures.push({file,error:'required test/runner missing'});continue;}
    const recorded=recordingDependency(file);
    rows.push({file,mode:scope.fileModes?.[file]??'recorded base with explicit scenario variations',recordingDependency:recorded});
    if(!recorded)failures.push({file,error:'no direct or shared real-corpus dependency'});
  }
  for(const file of scope.infrastructureFiles){
    if(!all.has(file)){failures.push({file,error:'infrastructure classification no longer exists'});continue;}
    const reason=scope.infrastructureReasons?.[file];
    if(typeof reason!=='string'||!reason.trim())failures.push({file,error:'missing infrastructure reason'});
    if(recordingDependency(file))failures.push({file,error:'infrastructure test has a direct or shared real-corpus dependency'});
  }
  for(const file of all)if(!required.has(file)&&!infrastructure.has(file))failures.push({file,error:'unclassified new test: review its data source'});
  return {rows,failures};
}
