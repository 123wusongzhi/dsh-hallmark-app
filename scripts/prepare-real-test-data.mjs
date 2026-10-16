import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {realCorpus,realCorpusPath} from '../test/real-data/corpus.ts';

/** Rebuild ignored browser fixtures from the verified private corpus, without network access. */
export function prepareBrowserData({output=fileURLToPath(new URL('../test/real-data/browser-data.ts',import.meta.url)),replace=false}={}) {
  if(!replace&&existsSync(output))return output; // The audit still detects tampering; never silently repair existing bytes.
  const corpus=realCorpus(),images={};
  for(const image of corpus.imageAssets??[])if(image.status==='captured')images[image.productId]=`data:${image.mimeType};base64,${readFileSync(resolve(dirname(realCorpusPath),image.file)).toString('base64')}`;
  const arrays={REAL_SOURCE_DETAILS:corpus.records.map(row=>row.detail),REAL_SOURCE_SUMMARIES:corpus.records.map(row=>row.summary),REAL_STORES:corpus.ancillary.stores.data,REAL_SALES_PRODUCTS:corpus.ancillary.storeProducts.data.products};
  const source='// GENERATED PRIVATE REAL DATA. Ignored by Git. Rebuild with npm run prepare:test-data.\n'+Object.entries(arrays).map(([name,value])=>`export const ${name}: Array<Record<string, any>> = ${JSON.stringify(value)};`).join('\n')+`\nexport const REAL_SOURCE_IMAGE_DATA: Record<string,string> = ${JSON.stringify(images)};\n`;
  mkdirSync(dirname(output),{recursive:true});writeFileSync(output,source);return output;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify({prepared:prepareBrowserData({replace:true})}));
