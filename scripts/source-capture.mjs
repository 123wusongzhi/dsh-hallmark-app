/** Product CLI: capture the real source component and inspect ordinary selector interactions. */
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {startSourcePreview} from './source-preview.mjs';

export function parseCaptureArgs(args){
  const options={directory:resolve('component-workspace/collected-products'),width:1100,height:850,port:0};
  const numeric=['width','height','port'];
  for(let i=0;i<args.length;i++){
    const key=args[i];if(key==='--help'){options.help=true;continue;}
    if(!['--directory','--width','--height','--port','--data','--session','--view','--steps','--output','--executable','--channel','--color-scheme','--ready'].includes(key))throw new Error(`Unknown option: ${key}`);
    const value=args[++i];if(!value||value.startsWith('--'))throw new Error(`Missing value for ${key}`);
    options[key.slice(2)]=numeric.includes(key.slice(2))?Number(value):value;
  }
  for(const key of ['width','height'])if(!Number.isInteger(options[key])||options[key]<1)throw new Error(`${key} must be a positive integer.`);
  if(!Number.isInteger(options.port)||options.port<0||options.port>65535)throw new Error('Port must be between 0 and 65535.');
  if(options['color-scheme']&&!['light','dark','no-preference'].includes(options['color-scheme']))throw new Error('color-scheme must be light, dark or no-preference.');
  if(Boolean(options.session)!==Boolean(options.view))throw new Error('--session and --view must be used together.');
  if(options.data&&options.view)throw new Error('Choose --data or --session/--view.');
  options.directory=resolve(options.directory);return options;
}
export async function runInteraction(frame,step){
  const target=step.selector?frame.locator(step.selector):undefined;
  switch(step.action){
    case 'click':await target.click();break;
    case 'fill':await target.fill(String(step.value??''));break;
    case 'check':await target.check();break;
    case 'uncheck':await target.uncheck();break;
    case 'select':await target.selectOption(step.value);break;
    case 'press':await target.press(step.key);break;
    case 'waitFor':await target.waitFor({state:step.state??'visible',timeout:step.timeout??10000});break;
    case 'scrollIntoView':await target.scrollIntoViewIfNeeded();break;
    case 'assertText':{const actual=await target.innerText();if(!actual.includes(step.text))throw new Error(`Expected ${step.selector} to contain ${JSON.stringify(step.text)}, received ${JSON.stringify(actual)}`);return {actual};}
    default:throw new Error(`Unknown interaction action: ${step.action}`);
  }
  return {ok:true};
}
export async function captureSource(options){
  const directory=resolve(options.directory);const output=resolve(options.output??join(directory,'.preview',`screenshot-${options.width}x${options.height}.png`));
  const reportPath=output.replace(/\.png$/i,'')+'.json';await mkdir(resolve(output,'..'),{recursive:true});
  const require=createRequire(join(directory,'package.json'));let playwright;
  try{playwright=await import(pathToFileURL(require.resolve('playwright')).href);}catch{throw new Error('Install Playwright in the component project: npm install --save-dev playwright');}
  const preview=await startSourcePreview(options);let browser;
  const report={buildId:preview.manifest.buildId,url:preview.url,viewport:{width:options.width,height:options.height},colorScheme:options['color-scheme']??'light',screenshot:output,startedAt:new Date().toISOString(),consoleErrors:[],pageErrors:[],requestFailures:[],interactions:[],attachmentEvents:[],status:'running'};
  try{
    browser=await playwright.chromium.launch({headless:true,...(options.executable?{executablePath:options.executable}:{}),...(options.channel?{channel:options.channel}:{})});
    const page=await browser.newPage({viewport:report.viewport,colorScheme:report.colorScheme,deviceScaleFactor:1});
    page.on('console',message=>{if(message.type()==='error')report.consoleErrors.push(message.text());});
    page.on('pageerror',error=>report.pageErrors.push(error.message));
    page.on('requestfailed',request=>report.requestFailures.push({url:request.url(),error:request.failure()?.errorText}));
    await page.goto(preview.url,{waitUntil:'networkidle'});
    const frame=page.frameLocator('iframe[title="源码组件预览"]');await frame.locator(options.ready??'body').waitFor({timeout:30000});
    const steps=options.steps?JSON.parse(await readFile(resolve(options.steps),'utf8')):[];
    if(!Array.isArray(steps))throw new Error('Steps file must contain a JSON array.');
    for(const step of steps){try{report.interactions.push({step,result:await runInteraction(frame,step),status:'passed'});}catch(error){report.interactions.push({step,error:error.message,status:'failed'});throw error;}}
    await page.screenshot({path:output,fullPage:true});
    report.attachmentEvents=await page.evaluate(()=>window.__hallmarkPreview?.events??[]);
    report.status=report.pageErrors.length||report.consoleErrors.length?'issues':'captured';
  }catch(error){report.status='failed';report.error=error.message;if(browser){const pages=browser.contexts().flatMap(context=>context.pages());if(pages[0])await pages[0].screenshot({path:output,fullPage:true}).catch(()=>{});}}
  finally{await browser?.close();await preview.close();report.finishedAt=new Date().toISOString();await writeFile(reportPath,JSON.stringify(report,null,2)+'\n');if(report.status!=='failed'){await mkdir(join(directory,'.preview'),{recursive:true});await copyFile(output,join(directory,'.preview','latest.png'));await writeFile(join(directory,'.preview','latest.json'),JSON.stringify(report,null,2)+'\n');}}
  return {...report,report:reportPath};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try{const options=parseCaptureArgs(process.argv.slice(2));if(options.help)console.log('node scripts/source-capture.mjs --directory <project> [--width 380 --height 850] [--data <SourceData.json> | --session <id> --view <id>] [--steps <steps.json>] [--channel chrome | --executable <browser>] [--output <image.png>]');else{const result=await captureSource(options);console.log(JSON.stringify(result,null,2));if(result.status==='failed'||result.status==='issues')process.exitCode=1;}}catch(error){console.error(error.message);process.exitCode=1;}
}
