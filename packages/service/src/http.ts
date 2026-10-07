import { randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
export function defaultDataDirectory(): string { return resolve(process.env.HALLMARK_APP_DATA_DIR ?? join(process.env.LOCALAPPDATA ?? process.cwd(), 'dsh-hallmark-app')); }
export function getOrCreateToken(directory: string): string {
  mkdirSync(directory, {recursive: true});
  const path=join(directory,'service-key');
  if(!existsSync(path)){try{writeFileSync(path,randomBytes(32).toString('hex'),{encoding:'utf8',mode:0o600,flag:'wx'});}catch(error){if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;}}
  const token=readFileSync(path,'utf8').trim();if(!/^[a-f0-9]{64}$/.test(token))throw new Error('INVALID_SERVICE_KEY');return token;
}
export function sameToken(expected:string,actual:string):boolean {const a=Buffer.from(expected),b=Buffer.from(actual);return a.length===b.length&&timingSafeEqual(a,b);}
export function loopback(address:string|undefined):boolean{return address==='127.0.0.1'||address==='::1'||address==='::ffff:127.0.0.1';}
export function send(res:ServerResponse,code:number,value:unknown):void{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'"});res.end(JSON.stringify(value));}
export async function body(req:IncomingMessage):Promise<Record<string,unknown>> {
  if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']??''))throw Object.assign(new Error('JSON_CONTENT_TYPE_REQUIRED'),{statusCode:415});
  const chunks:Buffer[]=[];let size=0;
  for await(const part of req){size+=part.length;if(size>1048576)throw Object.assign(new Error('BODY_TOO_LARGE'),{statusCode:413});chunks.push(part);}
  let value:unknown;try{value=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw Object.assign(new Error('INVALID_JSON'),{statusCode:400});}
  if(!value||typeof value!=='object'||Array.isArray(value))throw Object.assign(new Error('OBJECT_REQUIRED'),{statusCode:400});return value as Record<string,unknown>;
}
