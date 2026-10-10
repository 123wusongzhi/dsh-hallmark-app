import {writeFileSync} from 'node:fs';
const counts={};
for(const name of ['filter','find','every','some','reduce','map']){
 const original=Array.prototype[name];counts[name]=0;
 Array.prototype[name]=function(callback,...rest){if(typeof callback!=='function')return Reflect.apply(original,this,[callback,...rest]);return Reflect.apply(original,this,[function(...args){counts[name]++;return Reflect.apply(callback,this,args);},...rest]);};
}
process.on('exit',()=>writeFileSync(process.env.COUNTS_OUT,JSON.stringify({scope:'Complete actual Runtime reproduction array-callback counts; instrumented, not elapsed-time evidence',counts},null,2)));
