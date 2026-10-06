// Prebuilt dependency-free ESM M0 spike. No business APIs or platform writes.
export const name = 'dsh-plugin-hallmark-hello-spike';
export const inject = ['tools'];
export function apply(ctx) {
  console.info('[hallmark-hello-spike] Host apply 0.0.1');
  ctx.tools.register({
    name: 'hello_echo',
    description: 'M0 read-only integration spike: echo text, identify the current session, and GET Hallmark loopback /api/health. Never performs business writes.',
    parameters: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'], additionalProperties: false },
    output: {
      schema: {
        type: 'object',
        properties: {
          echo: { type: 'string' },
          sessionId: { oneOf: [{ type: 'string' }, { type: 'null' }] },
          hallmarkHealth: {
            type: 'object', properties: {
              status: { type: 'string', enum: ['ok', 'unavailable'] },
              endpoint: { type: 'string' },
              detail: { type: 'string' }
            }, required: ['status', 'endpoint', 'detail'], additionalProperties: false
          }
        }, required: ['echo', 'sessionId', 'hallmarkHealth'], additionalProperties: false
      },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
      presentationMeta: (_args, value) => ({ helloSpike: value })
    },
    timeoutMs: 5_000,
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      if (!args || typeof args !== 'object' || typeof args.text !== 'string') throw new TypeError('text must be string');
      exec.signal.throwIfAborted();
      const endpoint = 'http://127.0.0.1:4173/api/health';
      let hallmarkHealth;
      try {
        const signal = AbortSignal.any([exec.signal, AbortSignal.timeout(2_000)]);
        const response = await fetch(endpoint, { method: 'GET', signal, redirect: 'error' });
        const detail = await response.text();
        hallmarkHealth = { status: response.ok ? 'ok' : 'unavailable', endpoint, detail: detail.slice(0, 1024) };
      } catch (error) {
        exec.signal.throwIfAborted();
        hallmarkHealth = { status: 'unavailable', endpoint, detail: error instanceof Error ? error.message : 'health request failed' };
      }
      return { echo: args.text, sessionId: exec.agent?.id ?? null, hallmarkHealth };
    }
  });
}
