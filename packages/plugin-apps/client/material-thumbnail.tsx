import React from 'react';
import {AppsIcon,type AppsIconName} from './ui.tsx';

/** Small visual diagrams explain the material; thumbnails never read business data. */
export function MaterialThumbnail({materialId}:{materialId:string}){
  const procurement=materialId==='product-procurement',table=materialId==='product-operations'||materialId==='data-table'||procurement,sku=materialId==='sku-detail',activity=materialId==='activity-list';
  return <span className={`apps-material-mini${table?' is-table':''}${sku?' is-sku':''}${activity?' is-activity':''}`} aria-hidden="true">
    {table?<span className="apps-mini-head"><i/><i/><i/></span>:null}
    {[0,1,2].map(index=><span className="apps-mini-row" key={index}>
      <span className={`apps-mini-product is-${index}`}><AppsIcon name={activity?'tag':sku?'box':'image'}/></span>
      <span className="apps-mini-copy"><i/><i/></span>
      <span className="apps-mini-value">{activity?<span className="apps-mini-status"/>:sku?<span className="apps-mini-variant"/>:<i/>}</span>
      {table?<span className="apps-mini-bar">{procurement?<AppsIcon name="link"/>:<i style={{width:`${78-index*21}%`}}/>}</span>:null}
    </span>)}
    {materialId==='product-browser'||materialId==='collection-box'?<span className="apps-mini-detail"><AppsIcon name="link"/><i/><i/></span>:null}
  </span>;
}

export function SourceIcon({source}:{source?:string}){
  const icons:Record<string,AppsIconName>={products:'box',prices:'tag',stocks:'warehouse',warehouses:'warehouse',analytics:'chart',orders:'truck',weights:'box',finance:'note',promotions:'tag',returns:'refresh'};
  return <AppsIcon name={icons[source??'']??'component'}/>;
}
