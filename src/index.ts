/**
 * cordis-plugin-graph, host half.
 *
 * The plugin is browser-first (a Settings tab rendering the renderer-plane
 * Cordis graph). The host half adds two optional, independently degrading
 * capabilities:
 *
 * 1. A `tools/result` subscription that keeps a small ring buffer of recent
 *    tool executions - the renderer polls this for the live "runtime
 *    activity" feed and the tool-flow pulse on the graph.
 * 2. A same-origin JSON route, `/plugins/cordis-plugin-graph/state`, that
 *    returns the HOST-plane Cordis graph plus those events, so the tab can
 *    show the engine plane (sessions / agents / tools / model adapters)
 *    alongside the renderer plane.
 *
 * Both are scoped injects: a deployment without a tool runtime or without a
 * web server (packaged desktop, headless) loads the plugin unchanged and the
 * tab falls back to renderer-plane-only inspection.
 */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/cordis-plugin-loader'
import type {} from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { inspectCordisContext, type RuntimeEvent } from './inspect.ts'

export { inspectCordisContext } from './inspect.ts'
export type { GraphSnapshot, GraphNode, GraphEdge, EdgeKind, NodePhase, RuntimeEvent } from './inspect.ts'

/** Same-origin route the renderer polls for the host plane + live events. */
export const STATE_ROUTE = '/plugins/cordis-plugin-graph/state'

const MAX_EVENTS = 64
const MAX_BODY_NOTE = 4096

interface MinimalReq { readonly url?: string; readonly method?: string }
interface MinimalRes {
  writeHead(status: number, headers: Record<string, string>): unknown
  end(body?: string): unknown
}
interface WebServerLike {
  register(route: { kind: 'exact' | 'prefix'; path: string; handler: (req: MinimalReq, res: MinimalRes) => void }): () => void
}

/** Host plugin body. */
export function apply(ctx: Context): void {
  /** Recent tool executions, oldest first, capped. Shared with the route below. */
  const events: RuntimeEvent[] = []

  // (1) live tool-execution feed - degrades silently without a tool runtime.
  ctx.inject(['tools'], (toolsCtx) => {
    toolsCtx.effect(() => toolsCtx.on('tools/result', (exec, result) => {
      try {
        events.push({
          at: Date.now(),
          tool: typeof exec?.name === 'string' ? exec.name.slice(0, 200) : 'unknown',
          callId: String((exec as { callId?: unknown })?.callId ?? '').slice(0, 200),
          isError: (result as { isError?: unknown })?.isError === true,
        })
        if (events.length > MAX_EVENTS) events.shift()
      } catch {
        // never let an observer failure disturb the tool pipeline
      }
      return undefined
    }), 'cordis-plugin-graph: runtime events')
  })

  // (2) same-origin host-plane state route - degrades silently without a web server.
  ctx.inject(['webServer'], (webCtx) => {
    const webServer = webCtx.get('webServer') as WebServerLike | undefined
    if (webServer === undefined) return
    webCtx.effect(() => webServer.register({
      kind: 'exact',
      path: STATE_ROUTE,
      handler: (_req, res) => {
        let payload: string
        try {
          payload = JSON.stringify(inspectCordisContext(ctx, 'host', { runtimeEvents: events.slice(-MAX_EVENTS) }))
        } catch (cause) {
          res.writeHead(500, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
          res.end(JSON.stringify({ error: cause instanceof Error ? cause.message.slice(0, MAX_BODY_NOTE) : 'inspection failed' }))
          return
        }
        res.writeHead(200, {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
          'x-content-type-options': 'nosniff',
        })
        res.end(payload)
      },
    }), 'cordis-plugin-graph: host state route')
  })
}
