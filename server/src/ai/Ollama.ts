import { extractJson } from '../../../shared/ai'

interface IOllamaRequest {
  system: string
  user: string
  schema: Record<string, unknown>
  timeoutMs: number
}

/**
 * Home server Ollama via its native API: grammar-constrained JSON (`format`), thinking off for speed.
 * Calls are queued one at a time; the box is CPU-only and parallel requests only make every one of them slow.
 */
export class OllamaClient {
  private queue: Promise<unknown> = Promise.resolve()

  // Resolves global fetch per call so tests can stub it.
  constructor(private readonly baseUrl: string, private readonly model: string, private readonly fetchImpl: typeof fetch = (input, init) => fetch(input, init)) {}

  chatJson(request: IOllamaRequest): Promise<unknown> {
    const run = this.queue.then(() => this.send(request))
    this.queue = run.catch(() => undefined)
    return run
  }

  private async send({ system, user, schema, timeoutMs }: IOllamaRequest): Promise<unknown> {
    const response = await this.fetchImpl(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        format: schema,
        think: false,
        stream: false,
        keep_alive: '30m',
        // Cap the answer: a schema with arrays lets a small model keep emitting. 4096 is Ollama's default context;
        // longer prompts are rejected rather than silently truncated.
        options: { temperature: 0, num_predict: 300, num_ctx: 4096 },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!response.ok) {
      throw new Error(`Ollama returned ${response.status}: ${(await response.text()).slice(0, 200)}`)
    }
    const data = await response.json() as { message?: { content?: string } }
    return extractJson(data.message?.content ?? '')
  }
}
