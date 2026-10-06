export interface ApplicationDefinition {id:string;name:string;description:string;category:string;glyph:string;keywords:string[]}
/** Real installed integrations only. Adding metadata alone never grants business authority. */
export const APPLICATIONS:readonly ApplicationDefinition[]=[{id:'hallmark',name:'Hallmark',description:'店铺经营与已有采集资料，按需查询、设计并保存可复用组件。',category:'店铺经营',glyph:'▦',keywords:['店铺','商品','利润','采集','组件','Hallmark']}];
export function canStartChat(appId:string):boolean{return appId==='hallmark';}
export function searchApplications(query:string,applications:readonly ApplicationDefinition[]=APPLICATIONS):ApplicationDefinition[]{const needle=query.trim().toLocaleLowerCase();return applications.filter(app=>!needle||[app.name,app.description,app.category,...app.keywords].join(' ').toLocaleLowerCase().includes(needle));}
