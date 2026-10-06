// Current npm-client module registration protocol; all side effects in factory.
window.__ModuleLoader__.load({
  id: 'dsh-plugin-hallmark-hello-spike',
  factory: (require) => {
    const React = require('react');
    const h = React.createElement;
    function HelloEntry(props) {
      const [open, setOpen] = React.useState(false);
      return h('span', { 'data-hallmark-hello-entry': true },
        h('button', { type: 'button', title: 'Read-only M0 hello spike', onClick: () => setOpen(!open) }, 'Hello 应用'),
        open ? h('span', { role: 'status' }, `M0 客户端已加载 · session ${props.sessionId ?? '(none)'}`) : null);
    }
    function HelloToolView(props) {
      // Current official toolview code reads block.meta / block.content directly.
      // Never guess block.result.value or use a dynamic-runner Builtin.
      const raw = props.phase === 'result' && props.block?.meta && typeof props.block.meta === 'object'
        ? props.block.meta.helloSpike : undefined;
      const value = raw && typeof raw === 'object' && typeof raw.echo === 'string'
        && (typeof raw.sessionId === 'string' || raw.sessionId === null)
        && raw.hallmarkHealth && typeof raw.hallmarkHealth === 'object'
        && ['ok', 'unavailable'].includes(raw.hallmarkHealth.status) ? raw : undefined;
      const rows = [
        ['echo', value?.echo ?? (props.phase === 'result' ? '结果 metadata 不可用；请查看原生文本结果' : '执行中')],
        ['session', value?.sessionId ?? props.sessionId ?? '(none)'],
        ['phase', props.phase],
        ['Hallmark health', value?.hallmarkHealth?.status ?? '尚未返回']
      ];
      return h('section', { 'data-hallmark-hello-toolview': true, 'aria-label': 'M0 hello echo' },
        h('strong', null, 'M0 Hello（只读验证）'),
        h('table', null, h('tbody', null, ...rows.map(([key, value]) => h('tr', { key }, h('th', { scope: 'row' }, key), h('td', null, String(value ?? '')))))),
        value ? h('details', null, h('summary', null, '完整只读结果'), h('pre', null, JSON.stringify(value, null, 2))) : null);
    }
    return {
      name: 'dsh-plugin-hallmark-hello-spike-client',
      inject: ['slots'],
      apply(ctx) {
        console.info('[hallmark-hello-spike] Client apply 0.0.1');
        ctx.slots.inject('conversation.input.left', () => ctx.slots.register({ name: 'conversation.input.left', id: 'hallmark.hello', order: 80, label: 'Hello 应用' }, HelloEntry));
        ctx.slots.inject('tool.call.toolview', () => ctx.slots.register({ name: 'tool.call.toolview', key: 'hello_echo' }, HelloToolView));
      }
    };
  }
});
