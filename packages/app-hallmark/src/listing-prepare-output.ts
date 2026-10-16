/** Page-local references: every page can be decoded without retaining earlier pages. */
export function compactPreparationPage<T extends {sales:any[];categories:Record<string,any>}>(page:T):Omit<T,'sales'|'categories'> & {sales:any[];categories:Record<string,any>;shared?:Record<string,Record<string,any>>} {
 const shared:Record<string,Record<string,any>>={};
 const sales=page.sales.map(sale=>({...sale,packaging:{...sale.packaging}}));
 const categories={...page.categories};
 function intern(kind:string,values:Array<{value:any;replace:(ref:string)=>void}>){
  const groups=new Map<string,typeof values>();
  for(const entry of values){const key=JSON.stringify(entry.value);groups.set(key,[...(groups.get(key)??[]),entry]);}
  const definitions:Record<string,any>={};
  for(const [key,entries]of groups){
   if(entries.length<2)continue;
   const ref=String(Object.keys(definitions).length);
   if(Buffer.byteLength(key)*(entries.length-1)<=entries.length*32+32)continue;
   definitions[ref]=entries[0].value;for(const entry of entries)entry.replace(ref);
  }
  if(Object.keys(definitions).length)shared[kind]=definitions;
 }
 intern('packaging',sales.map(sale=>{
  const {version,missing,...common}=sale.packaging;
  return {value:common,replace:(sharedRef:string)=>{sale.packaging={sharedRef,...(version!==undefined?{version}:{}),...(missing!==undefined?{missing}:{})};}};
 }));
 intern('categories',Object.entries(categories).map(([id,value])=>({value,replace:(sharedRef:string)=>{categories[id]={sharedRef};}})));
 if(!Object.keys(shared).length)return page;
 const result={...page,sales,categories,shared};
 // Include table names, references and punctuation in the final profitability check.
 return Buffer.byteLength(JSON.stringify(result))<Buffer.byteLength(JSON.stringify(page))?result:page;
}
