import type {FieldRole} from '../../app-presentation/src/types.ts';

/** Provider-owned dictionary. Every value has a documented unit and source meaning. */
const definitions:Record<string,[string,string,FieldRole['format'],string?]>={
 productId:['商品编号','Ozon 商品编号；不同于平台 SKU。','text'],offerId:['商家货号','卖家设置的商品货号。','text'],sku:['平台 SKU','Ozon 为商品分配的 SKU。','text'],title:['商品名称','平台返回的商品名称。','text'],image:['商品图片','平台返回的商品主图。','image'],
 rating:['内容评级','Ozon 按 SKU 返回的商品内容评级，范围 0–100；无分数时保持未知。','text','分'],
 status:['当前状态','明确认识的状态以中文展示；其他状态标注未映射并保留原文。','text'],statusCode:['状态代码','平台返回的状态代码。','text'],statusRaw:['平台状态原文','平台返回的原始状态文字，供核对。','text'],errorReason:['异常原因','平台明确返回的错误或不可售说明。','text'],
 price:['当前卖家价','商品当前的卖家销售价格。','currency'],ordinaryPrice:['普通售价','商品设置的普通基础售价。','currency'],oldPrice:['划线价','商品展示的划线参考价格。','currency'],orderPrice:['订单商品单价','订单中该商品的每件价格。','currency'],currency:['币种','金额使用的货币，未提供时显示未知。','text'],
 warehouseId:['仓库编号','Ozon 仓库编号。','text'],warehouseName:['仓库名称','店铺为仓库设置的名称。','text'],fulfillment:['履约方式','该仓库采用的发货和配送方式。','text'],deliveryMethods:['配送渠道','可用配送渠道及当前状态。','text'],
 stockPresent:['仓库库存','平台记录的仓库商品数量。','integer','件'],stockReserved:['预留库存','已经预留的商品数量。','integer','件'],stockAvailable:['可售库存','平台确认可用于销售的商品数量。','integer','件'],
 date:['统计日期','平台统计或记账日期。','text'],impressions:['搜索与分类曝光','商品在搜索结果和分类页面的曝光次数。','integer','次'],views:['商品详情浏览','商品详情页被浏览的次数。','integer','次'],cartEvents:['加购次数','商品被加入购物车的次数。','integer','次'],orderedUnits:['订购件数','统计期间下单订购的商品件数，包含尚未完成的订单。','integer','件'],visitors:['详情访问会话','商品详情页的访问会话次数，跨日汇总不代表去重人数。','integer','次'],
 orderId:['订单编号','平台内部用于识别订单的编号。','text'],orderNumber:['订单号','店铺查看和核对订单时使用的订单号。','text'],postingNumber:['包裹编号','订单发货包裹的编号，一个订单可能包含多个包裹。','text'],quantity:['商品数量','该行商品的件数。','integer','件'],createdAt:['创建时间','平台记录的创建时间。','datetime'],shipmentAt:['交运或发货时间','平台记录的包裹交运或发货时间。','datetime'],trackingNumber:['物流单号','用于查询物流进度的跟踪编号。','text'],
 actualWeight:['物流实重','承运商报告的实际重量，单位为克。','integer','克'],declaredWeight:['申报重量','商品包装申报重量，单位为克。','integer','克'],weightDifference:['重量差','物流实重减去申报重量，单位为克。','integer','克'],weightScope:['重量口径','说明该重量是否为已核实的单件商品实重。','text'],
 accrualId:['记账记录编号','每条平台财务记账记录的编号。','text'],unitNumber:['关联业务编号','费用或收入关联的订单、包裹等业务编号。','text'],accrualType:['记账类型','平台记录的收入或费用类别。','text'],feeDetails:['费用明细','各项费用的编号、金额和币种。','text'],amount:['记账金额','平台记录的收入或扣费金额；不是店铺净利润。','currency'],commission:['平台佣金','与记账币种一致的平台佣金合计，未提供时显示未知。','currency'],logisticsFee:['物流费用','平台明确列出的物流费用，未提供时显示未知。','currency'],
 actionId:['活动编号','Ozon 促销活动编号。','text'],actionName:['活动名称','平台促销活动的名称。','text'],participation:['参加状态','商品已参加活动，或符合该活动的参加条件。','text'],actionPrice:['活动价格','商品参加活动时的价格。','currency'],maxActionPrice:['活动价格上限','参加活动所允许的最高商品价格。','currency'],startsAt:['开始时间','活动开始时间。','datetime'],endsAt:['结束时间','活动结束时间。','datetime'],
 returnId:['售后单编号','rFBS 退货退款申请编号。','text'],returnReason:['申请原因','平台返回的退货退款原因。','text'],
};
export const OZON_FIELD_ROLES:FieldRole[]=Object.entries(definitions).map(([key,[label,description,format,unit]])=>({key:`ozon.${key}`,label,description,format,...(unit?{unit}:{})}));
export const OZON_FIELD_META=Object.fromEntries(OZON_FIELD_ROLES.map(row=>[row.key.slice(5),row]));
