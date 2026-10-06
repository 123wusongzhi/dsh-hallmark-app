/** Validate JSON-facing contracts BEFORE serialization: stringify silently hides undefined. */
export function assertJsonCompatible(value:unknown,path='$',ancestors=new Set<object>()):void {
 if(value===null||typeof value==='string'||typeof value==='boolean')return;
 if(typeof value==='number') {if(!Number.isFinite(value)||Object.is(value,-0))throw new TypeError(`${path}: non-lossless JSON number`);return;}
 if(typeof value!=='object')throw new TypeError(`${path}: ${typeof value} is not a JSON value`);
 if(ancestors.has(value))throw new TypeError(`${path}: cyclic JSON value`);
 const array=Array.isArray(value);const prototype=Object.getPrototypeOf(value);
 if(array?prototype!==Array.prototype:prototype!==Object.prototype&&prototype!==null)throw new TypeError(`${path}: non-plain JSON container`);
 const keys=Reflect.ownKeys(value);
 if(array){
  if(keys.length!==value.length+1)throw new TypeError(`${path}: sparse array or extra properties`);
  for(let i=0;i<value.length;i++)if(!Object.hasOwn(value,i))throw new TypeError(`${path}[${i}]: sparse array`);
 }else if(keys.some(key=>typeof key!=='string'||!Object.prototype.propertyIsEnumerable.call(value,key)))throw new TypeError(`${path}: symbol or non-enumerable property`);
 ancestors.add(value);
 try {
  if(array)value.forEach((item,index)=>assertJsonCompatible(item,`${path}[${index}]`,ancestors));
  else for(const [key,item] of Object.entries(value))assertJsonCompatible(item,`${path}.${key}`,ancestors);
 }finally{ancestors.delete(value);}
}
