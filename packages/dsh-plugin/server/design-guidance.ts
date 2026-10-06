import type { ToolDescriptor } from '../../contracts/src/index.ts';
import type { Patch, ViewSpec } from '../../presentation/src/types.ts';

/** Host guidance only: never change the service's exact tool catalog or persisted ViewSpec. */
const LEGACY_DESIGN_INSTRUCTIONS = `以下仅用于旧 ViewSpec 组件的维护；不适用于源码组件。Hallmark 组件设计：用户要组件时，应主动完成信息设计并生成可用预览。先判断内容意图和真实字段，再安排主次阅读顺序、侧栏纵向或标签页布局、主题与视觉密度、勾选/附加/继续对话的操作闭环，最后检查字段、空值、来源和窄栏。旧组件直接查询真实数据并调用 render_view；已有临时组件用 update_view。不必每次先输出长设计方案；仅缺关键业务含义才询问。
首次需要设计语法或配方时调用 hallmark_app_info，读取 data.designCapabilities。使用 ViewSpec（不是 json-render 派生树）：{id,title,layout,widgets,bindings,theme?}；layout={type:column|row|grid|tabs,children:[组件id或嵌套layout],columns?,gap?}；binding={id,datasetKey,fieldMap:{展示字段:真实字段路径}}；每个非text组件须有bindingId。表格列={field,label,format?}，format仅text/currency/percent/date。仅用已实现的widget、布局、字段和主题，不提交任意HTML/CSS/JS、表达式、事件处理器或虚构schema字段。
表格先放名称等主信息，通常3–5个重点列，日期明确标date，长标识作次要信息；侧栏默认column，内容较多可tabs。沿用宿主明暗主题，适量留白和统一圆角，不以添加彩色卡片替代信息层级。采集商品用真实mainImage/title/id/source/skuCount/importedAt等存在的字段；importedAt只称导入时间，minPrice/maxPrice是采购成本，不能当售价或猜币种。无需图片/价格的字段不要为了装饰补造。
stat_card与product_card仅读首行，不支持聚合或按行重复；图表只取真实有限number的y值（最多50条），缺失/null/字符串不补0；缺成本利润点被排除且利润图须有真实口径。折线只用于已有有序时间/序列，不擅自从采集条目制造趋势、汇总或统计。配方占位datasetKey/字段必须用本次只读查询证据替换；recipe不是已保存组件，不能把recipeId当templateId，只有已确认存在的templateId可使用。
预览成功后可简短说明如何使用；未取得实际渲染截图不能声称完成视觉验收。勾选商品只附加到原聊天输入框，由用户确认发送；不自动发消息或业务写。生成和修改默认临时，仅用户明确要求保存时调用保存工具。`;

export const DESIGN_INSTRUCTIONS = `Hallmark 新组件默认使用普通 React 源码工程。先读取 /hallmark-component-design 的视觉规范；使用原有文件与命令工具编写 TSX/CSS/JS、安装普通依赖、复用并修改 shadcn 源码。不要把旧 ViewSpec 的 widget/layout/字段/CSS 白名单带到源码工程，不预先收紧表达能力；遇到实际问题再局部修复。
工程起点：E:/project/deepseek_h/dsh-hallmark-app/component-workspace/collected-products。工作流：复制工程到新目录（不复制 node_modules），查询真实数据 → 编辑源码 → npm install / npm run build → 用 scripts/source-preview.mjs 和 scripts/source-capture.mjs 运行同一 dist → read_image 查看实际渲染截图并操作搜索/勾选 → 修改 → hallmark_open_source_component({directory,bindings})。命令用法与桥接 API 见项目 docs/source-component-authoring.md；首次需要能力说明读取 hallmark_app_info.data.designCapabilities。打开工具只登记已有构建，不替你编译。
设计应有蓝白色阶、信息层级、真实图片和留白，分别查看窄侧栏和宽页。数据可由普通 JS 计算与呈现，不按字段名隐藏利润。说明真实口径与缺失值。postMessage 辅助库负责数据/刷新/附加商品；附加生成原生 JSON 附件，保留原输入，由用户发送。
草稿源码和构建可恢复；正式保存须用户要求。save_component 保存源码版本，open_component 返回工作副本，可指定历史 revision 后重新保存为新版本。源码保存后继续编辑新副本，重新构建并 open_source_component 更新同一 viewId。没有截图不能宣称已经完成视觉验收。
${LEGACY_DESIGN_INSTRUCTIONS}`;

const collectedSpec: ViewSpec = {
  id:'recipe-collected-selection', title:'采集商品',
  theme:{spacing:16,radius:12},
  layout:{type:'column',children:['products']},
  widgets:[{id:'products',type:'table',title:'选择要继续处理的商品',bindingId:'main',columns:[
    {field:'title',label:'商品名称'}, {field:'source',label:'来源'},
    {field:'skuCount',label:'SKU 数'}, {field:'importedAt',label:'导入时间',format:'date'},
  ],options:{pageSize:10}}],
  bindings:[{id:'main',datasetKey:'REPLACE_WITH_COLLECTED_DATASET_KEY',fieldMap:{}}],
};
const trendSpec: ViewSpec = {
  id:'recipe-observed-trend',title:'趋势与明细',
  theme:{spacing:16,radius:12},
  layout:{type:'tabs',children:['trend','details']},
  widgets:[
    {id:'trend',type:'line_chart',title:'趋势',bindingId:'main',fields:{label:'x',value:'y'}},
    {id:'details',type:'table',title:'数据明细',bindingId:'main',columns:[{field:'x',label:'时间 / 序列'},{field:'y',label:'数值'}],options:{pageSize:10}},
  ],
  bindings:[{id:'main',datasetKey:'REPLACE_WITH_OBSERVED_DATASET_KEY',fieldMap:{x:'REPLACE_WITH_X_FIELD',y:'REPLACE_WITH_NUMERIC_Y_FIELD'}}],
};
const receiptSpec: ViewSpec = {
  id:'recipe-operation-receipt',title:'操作回执',
  theme:{spacing:16,radius:12},
  layout:{type:'column',children:['status','results']},
  widgets:[
    {id:'status',type:'status_badge',title:'当前进度',bindingId:'main',fields:{status:'state'}},
    {id:'results',type:'table',title:'逐项结果',bindingId:'main',columns:[{field:'target',label:'目标'},{field:'state',label:'状态'},{field:'message',label:'结果说明'}],options:{pageSize:10}},
  ],
  bindings:[{id:'main',datasetKey:'operation:REPLACE_WITH_OPERATION_ID',fieldMap:{}}],
};
const collectedPatch: Patch[] = [
  {op:'test',path:'/widgets/0/id',value:'products'},
  {op:'replace',path:'/widgets/0/title',value:'选择商品继续处理'},
  {op:'replace',path:'/widgets/0/options/pageSize',value:20},
];

/** Serializable recipes contain presentation only, never example business rows or new tool actions. */
export const DESIGN_CAPABILITIES = {
  format:'ViewSpec',
  preferredFormat:'React source project',
  source:{
    available:true,tool:'hallmark_open_source_component',
    workflow:'编辑普通 TSX/CSS → 构建 dist → 相同 dist 预览/截图/交互 → 查看截图后修改 → 打开 DSH → 用户要求时保存版本',
    starterDirectory:'E:/project/deepseek_h/dsh-hallmark-app/component-workspace/collected-products',
    authoringGuide:'E:/project/deepseek_h/dsh-hallmark-app/docs/source-component-authoring.md',
    preview:'scripts/source-preview.mjs',capture:'scripts/source-capture.mjs',
    design:'先读 hallmark-component-design/references/visual-direction.md；开放普通 React/CSS/依赖，无 widget/layout 白名单。',
    persistence:'源码、锁文件、资源、dist 和历史版本；open_component({componentId,revision?}) 打开工作副本。',
    bridge:'createHallmarkClient(): getData/refresh/attachSelection/getContext；附加到原生聊天附件，由用户发送。',
  },
  legacyScope:'以下 widgets/layouts/grammar/limits/recipes/editExample 只适用于旧 ViewSpec；新源码不经过这些限制。',
  workflow:'内容意图 → 真实字段 → 主次排序 → 侧栏/标签页布局 → 主题与密度 → 操作闭环 → 检查；默认直接查询并生成/修改临时预览。',
  widgets:['stat_card','table','bar_chart','line_chart','product_card','status_badge','text'],
  layouts:['column','row','grid','tabs'],
  columnFormats:['text','currency','percent','date'],
  grammar:{
    view:'id/title/layout/widgets/bindings必填；theme可选。每个widget.id在layout恰好出现一次；数据组件绑定真实bindingId。',
    widget:'id/type，及可选title/bindingId/fields/columns/text/options。text组件使用text；其他组件必须bindingId。',
    binding:'{id,datasetKey,fieldMap:{别名:源字段路径}}；也支持已允许只读工具的query:{tool,params}，但配方优先用已返回datasetKey。',
    options:'仅sort:{field,direction:asc|desc}/pageSize:1–200/currency/xField/yField/statusField/description/color/showLegend；不要假设每种组件都实现每个选项。',
    theme:'建议省略颜色以继承明暗主题，可调spacing/radius；primary/text/background/surface为#RRGGBB。不要提交style/className或HTML。',
  },
  limits:[
    'stat_card只读首行fields.value，product_card只读首行，不自动汇总或按行重复；采集列表优先可选table。',
    '图表用fields.label/value或options.xField/yField，y只接收有限number；缺失/null/数字字符串不补0，最多50点。利润缺成本点排除且须真实口径。图表不聚合、不排序，折线要求源数据已有正确顺序；无时间序列证据改bar_chart或table。',
    'currency须已知真实币种；percent使用比例值而非百分数文字。date仅明确时间字段；importedAt是导入时间。采集minPrice/maxPrice是采购成本，不是售价。',
    '表格商品选择依赖真实商品稳定ID和原绑定，附加后由用户发送；不能定义任意动作或把选择当写入授权。',
    '预览/编辑不保存；用户明确要求才保存。未取得渲染截图不能声称视觉验收。',
  ],
  recipeUsage:'下列是设计配方，不是已保存组件。复制spec后换唯一id、真实标题、查询返回的datasetKey和已核实字段；不要执行占位值。调用hallmark_render_view({spec})；只有已确认存在的模板才能传templateId，recipeId不是templateId。',
  recipes:[
    {recipeId:'collected-selection',when:'展示并选择已有采集商品',prepare:'先search_collected_items，使用返回datasetKey；列只保留实际存在字段，不凭空补字段。不声称源序就是最近；需要最近时只按有证据的导入时间解释。',spec:collectedSpec},
    {recipeId:'observed-trend',when:'已有真实有序x/y数值，先趋势后明细，适配窄侧栏',prepare:'先取得可绑定的真实序列；替换x/y映射及轴字段标签，y必须原始有限number。无真实时间/序列顺序不画折线；明细保留缺失值，不把缺失值当0。',spec:trendSpec},
    {recipeId:'operation-receipt',when:'查看本会话已有操作的进度和逐项结果',prepare:'先get_operation核实当前会话operationId，绑定operation:<真实ID>；只呈现回执，不重放操作。记录更新时间不是商品价格源时间，imported不等于on_sale。',spec:receiptSpec},
  ],
  editExample:{
    appliesTo:'仅针对collected-selection配方的当前spec；先读已有返回spec，路径/数组索引不匹配则调整。已保存组件先open_component取得新viewId。',
    arguments:{viewId:'REPLACE_WITH_RETURNED_VIEW_ID',patch:collectedPatch},
    rules:'update_view使用JSON Patch；test先验证目标，replace要求路径已存在，新增可用add。不可改view.id；patch后所有widgets仍须出现在layout，保留真实bindings。保存原件需用户明确要求并使用sourceComponentId/baseRevision。',
  },
};

export function designToolDescription(descriptor: ToolDescriptor): string {
  const suffix:Record<string,string> = {
    hallmark_app_info:'。Host另提供designCapabilities：当前ViewSpec语法、组件限制、3份可用设计配方和编辑示例；设计前需要配方时读取。',
    hallmark_render_view:'。按内容意图设计主次、窄侧栏布局、列格式和操作闭环，再用真实绑定生成预览；设计语法/配方见hallmark_app_info.data.designCapabilities。配方占位值必须替换，不得编造templateId或业务数据。',
    hallmark_update_view:'。在当前spec上调整信息层级、布局和格式，保留绑定与商品选择；先验证patch路径，保持view.id。已保存组件先open_component；设计语法/编辑示例见hallmark_app_info.data.designCapabilities。',
  };
  return descriptor.description + (suffix[descriptor.name]??'');
}
