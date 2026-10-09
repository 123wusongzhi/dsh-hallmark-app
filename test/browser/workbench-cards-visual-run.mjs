// Opens only this generated fixture using fresh owned profiles, never the user browser or desktop Host.
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
const directory=resolve('artifacts/workbench-cards-visual');await mkdir(directory,{recursive:true});
const bundle=await build({entryPoints:[resolve('test/browser/workbench-cards-visual-fixture.tsx')],bundle:true,write:false,platform:'browser',format:'iife',target:'es2022',jsx:'automatic'});
const html=join(directory,'fixture.html');await writeFile(html,`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script>${bundle.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')}</script></html>`);
async function capture(width){
  const screenshot=join(directory,`workbench-${width}.png`),child=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--disable-background-networking','--disable-component-update','--disable-extensions','--no-first-run','--no-default-browser-check',`--user-data-dir=${join(directory,`browser-profile-${process.pid}-${width}`)}`,'--dump-dom','--virtual-time-budget=4000',`--window-size=${width},1000`,'--force-device-scale-factor=1',`--screenshot=${screenshot}`,pathToFileURL(html).href],{windowsHide:true,stdio:['ignore','pipe','pipe']});
  let output='',diagnostic='';child.stdout.on('data',chunk=>{output+=chunk;});child.stderr.on('data',chunk=>{diagnostic=(diagnostic+chunk).slice(-5000);});
  const timer=setTimeout(()=>child.kill(),30000);
  try{await new Promise((yes,no)=>{child.once('error',no);child.once('exit',yes);});const match=output.match(/<pre id="workbench-cards-result">([^<]+)<\/pre>/);if(!match)throw Error(`Fixture result unavailable: ${diagnostic}`);const result=JSON.parse(match[1].replace(/&quot;/g,'"').replace(/&gt;/g,'>').replace(/&lt;/g,'<').replace(/&amp;/g,'&'));await writeFile(join(directory,`dom-${width}.html`),output);return {...result,screenshot};}finally{clearTimeout(timer);}
}
const results=await Promise.all([capture(1536),capture(900)]);await writeFile(join(directory,'results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));if(results.some(result=>!result.ok))process.exitCode=1;
