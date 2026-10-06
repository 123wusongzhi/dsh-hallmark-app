// Install the software's first reusable source template; never capture a store's business rows.
import {join,resolve} from 'node:path';
import {AppServiceClient} from '../packages/dsh-plugin/server/service-client.ts';
import {AppStore} from '../packages/store/index.ts';
import {PresentationManager} from '../packages/presentation/src/index.ts';
const client=new AppServiceClient();
try{await client.request('/health',undefined,undefined,1000);throw new Error('SERVICE_STILL_RUNNING');}catch(error){if(error.message==='SERVICE_STILL_RUNNING'||error.code!=='APP_SERVICE_UNAVAILABLE')throw error;}
const store=new AppStore(join(client.directory,'app.db'));
try{
 const id='source-collected-products-v1';
 if(store.get('templates',id))console.log(JSON.stringify({templateId:id,alreadyPresent:true}));
 else{
  const presentation=new PresentationManager(store);
  const {source}=presentation.sources.capture(resolve('component-workspace/collected-products'));
  store.put('templates',id,{id,name:'采集商品 · 源码模板',description:'蓝白主题、真实图片、宽表窄列表、搜索多选与原生聊天附件。可复制并自由编辑 React/CSS。',kind:'source',source,theme:{},layout:{type:'column',children:[]},widgetStyles:[],contentRules:{bindingIds:['collected']},version:1,bindings:[{id:'collected',query:{tool:'hallmark_search_collected_items',params:{limit:200}},fieldMap:{}}],installedBy:'dsh-hallmark-app-0.3.0'});
  console.log(JSON.stringify({templateId:id,buildId:source.buildId,installed:true}));
 }
}finally{store.close();}
