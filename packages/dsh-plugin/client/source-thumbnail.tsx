import React,{useState} from 'react';
import type {SourceArtifact} from '../../presentation/src/types.ts';
import {AppIcon} from './icons.tsx';
export function SourceThumbnail({source,title}:{source?:SourceArtifact;title:string}){
  const [failed,setFailed]=useState(false);
  return source?.preview&&source.thumbnail&&!failed?<img src={`/api/hallmark-source-thumbnail/${encodeURIComponent(source.buildId)}`} alt={`${title} 实际预览`} loading="lazy" onError={()=>setFailed(true)} style={{display:'block',width:'100%',aspectRatio:'16 / 10',objectFit:'cover',objectPosition:'top',borderRadius:8}}/>:<div style={{height:130,display:'grid',alignContent:'center',justifyItems:'center',gap:8,color:'var(--hm-accent)',background:'color-mix(in srgb,var(--hm-accent) 5%,transparent)',borderRadius:8}}><AppIcon name="layers" size={28}/><span className="hm-muted">源码组件 · 打开查看</span></div>;
}
