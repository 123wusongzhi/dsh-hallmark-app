import type {ComponentAgentState} from '../../app-contracts/src/index.ts';

/** These are submission receipts, never evidence that the agent finished the task. */
export function agentReceiptNotice(status:ComponentAgentState):string {
  switch(status){
    case 'prepared':return '任务已登记，等待派发。请检查原请求，勿重复提交。';
    case 'dispatching':return '任务正在派发到当前聊天。请检查原请求，勿重复提交。';
    case 'accepted':return '请求已提交并排队，等待代理处理。后续进展请在当前聊天查看，也可准备新任务。';
    case 'unknown':return '任务提交结果待确认。请检查原请求，确认前不要重新提交。';
    case 'failed':return '任务提交未完成。请检查原请求，确认未派发后再决定是否重试。';
  }
}
