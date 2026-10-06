// Minimal contract spike only, not the M11 plugin or a live-load assertion.
// Shapes below are copied from live Host Inspect tools.listService (0.2.0-rc.2).
export interface HelloContext {
  tools: { register(definition: {
    name: string; description: string; parameters: Record<string, unknown>;
    output: { schema: Record<string, unknown>; render(args: unknown, value: unknown): { type: 'text'; text: string }[] };
    execute(args: unknown, execution: { agent?: { id: string }; signal: AbortSignal }): Promise<unknown>;
  }): () => void };
}
export const name = 'dsh-plugin-hello';
export const inject = ['tools'];
export function apply(ctx: HelloContext): void {
  ctx.tools.register({
    name: 'hello_echo', description: 'Read-only Hallmark integration hello contract spike.',
    parameters: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'], additionalProperties: false },
    output: {
      schema: { type: 'object', properties: { echo: { type: 'string' }, sessionId: { oneOf: [{ type: 'string' }, { type: 'null' }] } }, required: ['echo', 'sessionId'], additionalProperties: false },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    async execute(args, exec) {
      const input = args as { text?: unknown };
      if (typeof input.text !== 'string') throw new TypeError('text must be string');
      exec.signal.throwIfAborted();
      return { echo: input.text, sessionId: exec.agent?.id ?? null };
    },
  });
}
