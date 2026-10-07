import {randomUUID} from 'node:crypto';
import {existsSync,lstatSync,readFileSync,realpathSync,renameSync,unlinkSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';

export interface CutoverDecision {allowed:boolean;reasons:string[]}
export interface CutoverAdmissionRecord extends CutoverDecision {
  version:1;
  directory:string;
  database:string;
  enrollmentId:string;
  checkedAt:string;
}
const filename='cutover-admission.json';
const enrollmentFilename='cutover-enrollment.json';
interface Enrollment {version:1;enrollmentId:string}
const pathKey=(path:string)=>process.platform==='win32'?path.toLowerCase():path;
function failure(code:string,reasons:string[]=[]):Error {
  return Object.assign(new Error(code),{code,statusCode:503,details:{reasons}});
}
function rootPath(directory:string):string {return realpathSync(resolve(directory));}
function enrollment(root:string):Enrollment {
  const path=join(root,enrollmentFilename);
  try{
    if(!lstatSync(path).isFile()||lstatSync(path).isSymbolicLink())throw Error('INVALID_FILE');
    const value=JSON.parse(readFileSync(path,'utf8')) as Enrollment;
    if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==2||Object.keys(value).some(key=>!['version','enrollmentId'].includes(key))||value.version!==1||typeof value.enrollmentId!=='string'||!/^[-a-f0-9]{36}$/.test(value.enrollmentId))throw Error('INVALID_RECORD');
    return value;
  }catch{throw failure('CUTOVER_ADMISSION_INVALID');}
}

/** An explicit cutover check enrolls the target. Ordinary, unenrolled roots keep their existing admission. */
export function writeCutoverAdmission(directory:string,decision:CutoverDecision):CutoverAdmissionRecord {
  const root=rootPath(directory),path=join(root,filename);
  if(typeof decision.allowed!=='boolean'||!Array.isArray(decision.reasons)||decision.reasons.some(reason=>typeof reason!=='string')||decision.allowed&&decision.reasons.length)throw failure('CUTOVER_DECISION_INVALID');
  if(existsSync(path)&&(!lstatSync(path).isFile()||lstatSync(path).isSymbolicLink()))throw failure('CUTOVER_ADMISSION_INVALID');
  const enrollmentPath=join(root,enrollmentFilename);
  if(!existsSync(enrollmentPath)){
    const value:Enrollment={version:1,enrollmentId:randomUUID()};
    try{writeFileSync(enrollmentPath,JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});}catch(error){if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;}
  }
  const enrolled=enrollment(root);
  const record:CutoverAdmissionRecord={...enrolled,directory:root,database:join(root,'apps.db'),checkedAt:new Date().toISOString(),allowed:decision.allowed,reasons:[...decision.reasons]};
  const temporary=join(root,`${filename}.${randomUUID()}.tmp`);
  try {
    writeFileSync(temporary,JSON.stringify(record,null,2)+'\n',{flag:'wx',mode:0o600});
    renameSync(temporary,path);
  }finally{if(existsSync(temporary))unlinkSync(temporary);}
  return record;
}

/** Checked before opening a writer and at public admission/dispatch boundaries. In-flight work may drain. */
export function cutoverAdmission(directory:string):()=>void {
  const root=resolve(directory);let enrolled=false;
  return ()=>{
    const path=join(root,filename);
    if(!existsSync(path)){if(enrolled||existsSync(join(root,enrollmentFilename)))throw failure('CUTOVER_ADMISSION_MISSING');return;}
    enrolled=true;
    let record:CutoverAdmissionRecord;
    try{
      const currentRoot=rootPath(root);
      const registered=enrollment(currentRoot);
      if(!lstatSync(path).isFile()||lstatSync(path).isSymbolicLink())throw Error('INVALID_FILE');
      record=JSON.parse(readFileSync(path,'utf8')) as CutoverAdmissionRecord;
      const keys=['version','directory','database','enrollmentId','checkedAt','allowed','reasons'];
      if(!record||typeof record!=='object'||Array.isArray(record)||Object.keys(record).length!==keys.length||Object.keys(record).some(key=>!keys.includes(key))||record.version!==1||record.enrollmentId!==registered.enrollmentId||typeof record.allowed!=='boolean'||!Array.isArray(record.reasons)||record.reasons.some(reason=>typeof reason!=='string')||record.allowed&&record.reasons.length||typeof record.checkedAt!=='string'||!Number.isFinite(Date.parse(record.checkedAt))||typeof record.directory!=='string'||typeof record.database!=='string'||pathKey(record.directory)!==pathKey(currentRoot)||pathKey(record.database)!==pathKey(join(currentRoot,'apps.db')))throw Error('INVALID_RECORD');
    }catch{throw failure('CUTOVER_ADMISSION_INVALID');}
    if(!record.allowed)throw failure('CUTOVER_ADMISSION_BLOCKED',record.reasons);
  };
}
