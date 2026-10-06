import type { DataBinding } from '../../presentation/src/types.ts';
import { formatValue } from '../../presentation/src/design.ts';
import { isProfitField, mappedValue, missingCost } from './model.ts';
import type { Row } from './model.ts';
export function display(row:Row,field:string,binding:DataBinding|undefined,basis:string|undefined,format?:'text'|'currency'|'percent'|'date',currency='RUB'):string{
  if(isProfitField(field,binding)){if(missingCost(row))return '无法判断（缺成本）';if(!basis)return '无法判断（缺口径）';}
  return formatValue(mappedValue(row,field,binding),format,currency);
}
