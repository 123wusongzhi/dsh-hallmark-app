/** Cache only fixed presentation machinery; callers still read and format every value. */
const currencies=new Map<string,Intl.NumberFormat>();
let integer:Intl.NumberFormat|undefined,percent:Intl.NumberFormat|undefined,constructor:typeof Intl.NumberFormat|undefined;
function checkConstructor():void {
  if(constructor!==Intl.NumberFormat){constructor=Intl.NumberFormat;currencies.clear();integer=undefined;percent=undefined;}
}
export function formatMaterialCurrency(value:number,currency:string):string {
  checkConstructor();
  let formatter=currencies.get(currency);
  if(!formatter){
    formatter=new Intl.NumberFormat('zh-CN',{style:'currency',currency,currencyDisplay:'code',maximumFractionDigits:2});
    if(currencies.size>=32)currencies.delete(currencies.keys().next().value!);
    currencies.set(currency,formatter);
  }
  return formatter.format(value);
}
export function formatMaterialInteger(value:number):string {
  checkConstructor();
  integer??=new Intl.NumberFormat('zh-CN',{maximumFractionDigits:0});
  return integer.format(value);
}
export function formatMaterialPercent(value:number):string {
  checkConstructor();
  percent??=new Intl.NumberFormat('zh-CN',{style:'percent',maximumFractionDigits:2});
  return percent.format(value);
}
