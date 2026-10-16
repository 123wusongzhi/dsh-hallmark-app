import {PERFORMANCE_IMAGE_DELAY_MS,PERFORMANCE_POLICY_VERSION,PERFORMANCE_PROFILE} from '../../packages/source-components/src/authoring-performance.ts';
import type {PerformanceEvidence,PerformanceSample} from '../../packages/source-components/src/authoring-performance.ts';

/** Synthetic backend-contract measurements; these fixtures do not claim browser execution. */
export function performanceSample(overrides:Partial<PerformanceSample>={}):PerformanceSample {
  return {readyMs:100,blockingMs:0,maxTaskMs:0,layoutShift:0,domElements:12,renderedRows:1,imageRequests:0,hiddenImageRequests:0,visibleImages:0,lazyVisibleImages:0,missingImageSpace:0,unprioritizedFirstImage:0,loadedScriptBytes:1024,feedbackMs:null,...overrides};
}
export function performanceEvidence(interactions:string[]=[]):PerformanceEvidence {
  return {policyVersion:PERFORMANCE_POLICY_VERSION,profile:PERFORMANCE_PROFILE,imageDelayMs:PERFORMANCE_IMAGE_DELAY_MS,viewports:([420,1040] as const).map(width=>({width,initial:performanceSample(),interactions:interactions.map(id=>({...performanceSample({feedbackMs:5}),id}))})),verdict:'PASS'};
}
