// Rasterize this documentation's SVGs without visiting DSH or business services.
import {createRequire} from 'node:module';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {dirname, join, resolve} from 'node:path';
import {writeFile} from 'node:fs/promises';
const directory=dirname(fileURLToPath(import.meta.url));
const require=createRequire(import.meta.url);
// Use an already installed documentation tool; this script never installs packages or browsers.
const playwrightPath=process.env.DSH_DIAGRAM_PLAYWRIGHT_PATH?.trim();
let chromium;
try {
  ({chromium}=require(playwrightPath?resolve(playwrightPath):'playwright'));
  if(!chromium?.launch)throw new Error('The module does not expose Playwright chromium.');
} catch(error) {
  throw new Error('Playwright is unavailable. Use an already installed playwright package resolvable from this script, or set DSH_DIAGRAM_PLAYWRIGHT_PATH to its package directory / entry file. See README.md; nothing was installed.',{cause:error});
}
const executablePath=process.env.DSH_DIAGRAM_BROWSER_EXECUTABLE?.trim();
const channel=process.env.DSH_DIAGRAM_BROWSER_CHANNEL?.trim();
if(executablePath&&channel)throw new Error('Set either DSH_DIAGRAM_BROWSER_EXECUTABLE or DSH_DIAGRAM_BROWSER_CHANNEL, not both.');
const launchOptions={headless:true,...(executablePath?{executablePath:resolve(executablePath)}:channel?{channel}:{})};
let browser;
try {
  browser=await chromium.launch(launchOptions);
} catch(error) {
  throw new Error('No usable local browser was launched. Use an already installed Playwright Chromium, set DSH_DIAGRAM_BROWSER_CHANNEL=chrome for installed Chrome, or set DSH_DIAGRAM_BROWSER_EXECUTABLE to a local browser executable. This script does not download a browser.',{cause:error});
}
const browserDetails={engine:'chromium',version:browser.version(),selection:executablePath?'custom-executable':channel||'playwright-default'};
const results=[];
try {
  for(const [name,width,height] of [['FIG-13',1720,1230],['FIG-14',1870,1950]]) {
    const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(pathToFileURL(join(directory,`${name}.svg`)).href);
    await page.evaluate(()=>document.fonts.ready);
    const svg=page.locator('svg');
    await svg.screenshot({path:join(directory,`${name}.png`)});
    results.push({name,width,height,png: `${name}.png`,svg: `${name}.svg`,pageErrors:errors});
    await page.close();
  }
} finally {await browser.close();}
await writeFile(join(directory,'diagram-render-check.json'),JSON.stringify({scope:'Documentation SVG rasterization only. No DSH UI, Runtime, provider, or model verification.',checkedAt:new Date().toISOString(),browser:{...browserDetails,headless:true},results},null,2)+'\n');
console.log(JSON.stringify(results));
