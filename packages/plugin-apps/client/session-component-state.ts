import type {AppsView} from '../../app-presentation/src/types.ts';

const working=new Set(['editing','building','previewing','publish_ready','mounting']);
const failed=new Set(['build_failed','preview_failed','failed_mount','interrupted']);
const stopped=new Set(['cancelled','superseded','closed','discarded']);
export function canFavoriteCurrentView(view:AppsView,sessionId:string):boolean {return view.ownerSessionId===sessionId&&view.validationStatus==='verified'&&!view.pendingPublicationId&&typeof view.viewRevision==='number'&&(!view.authoringState||view.authoringState==='mounted');}
export function sessionViewStatus(view:AppsView):{kind:'making'|'ready'|'failed'|'unverified';label:string;heading:string;description:string}{
  if(failed.has(view.authoringState??'')||view.validationStatus==='failed')return {kind:'failed',label:view.authoringState==='interrupted'?'制作已暂停':'暂未完成',heading:'稍作停留，再续新篇',description:view.lastGoodBuildId||view.activeBuildId?'这次调整未能完成，仍可打开之前的内容。':'这次制作遇到了一点问题，可回到聊天继续调整。'};
  if(working.has(view.authoringState??'')||view.pendingPublicationId)return {kind:'making',label:view.activeBuildId?'正在调整':'正在制作',heading:'正在打磨，请稍候',description:view.activeBuildId?'新的模样即将呈现，已有内容仍可打开。':'完成后，便可打开查看。'};
  if(stopped.has(view.authoringState??''))return {kind:'unverified',label:'本次制作已结束',heading:'暂存于此，待你再续',description:'已有内容仍然保留，可以回到聊天继续完善。'};
  if(view.validationStatus==='draft_unpublished')return {kind:'making',label:'正在制作',heading:'正在打磨，请稍候',description:'完成后，便可打开查看。'};
  if(view.validationStatus==='verified')return {kind:'ready',label:'已就绪',heading:'一切就绪，随时可阅',description:'打开查看完整内容，喜欢的组件可以收藏。'};
  return {kind:'unverified',label:'等待预览确认',heading:'静候呈现',description:'预览确认后即可收藏，也可以回到聊天继续完善。'};
}
