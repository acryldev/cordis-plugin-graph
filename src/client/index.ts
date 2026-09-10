/**
 * cordis-plugin-graph, browser half.
 *
 * Registers one tab into `settings.plugins.tab` (the slot the built-in
 * "Plugin configuration", "Architecture", "Lifecycle", and "Plugin list" tabs
 * use). The tab renders a live, zoomable Cytoscape graph:
 *
 * - the RENDERER-plane Cordis graph, inspected in-process every recapture;
 * - the HOST-plane graph + a live tool-execution feed, polled from the host
 *   half's `/plugins/cordis-plugin-graph/state` route when it is reachable.
 *
 * Portable: `settings.plugins.tab` and the Cordis context internals the
 * inspector reads are upstream `dsh-web-app` primitives, so this plugin works
 * in any `web`-profile deployment (ACRYL or stock DSH Desktop). The host
 * route is optional - the tab degrades to renderer-plane-only without it.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { GraphTab, type GraphTabInjected } from './GraphTab.tsx'
import { inspectCordisContext, type GraphSnapshot } from '../inspect.ts'

export { inspectCordisContext } from '../inspect.ts'
export type { GraphSnapshot, GraphNode, GraphEdge, EdgeKind, NodePhase, RuntimeEvent } from '../inspect.ts'

const STATE_ROUTE = '/plugins/cordis-plugin-graph/state'

/** Required service: the UI slot registry. */
export const inject = ['slots']

/** Contribute the "Plugin graph" tab to the Plugins settings section. */
export function apply(ctx: ClientContext): void {
  const injected = (): GraphTabInjected => ({
    inspect: () => inspectCordisContext(ctx, 'client'),
    async pollHost(signal) {
      const response = await fetch(STATE_ROUTE, { cache: 'no-store', signal })
      if (!response.ok) throw new Error(`host state route: HTTP ${String(response.status)}`)
      return await response.json() as GraphSnapshot
    },
  })
  ctx.slots.inject('settings.plugins.tab', () => ctx.slots.register({
    name: 'settings.plugins.tab',
    id: 'graph',
    // After "Plugin list" (id 'all', order 10).
    order: 11,
    label: () => 'Plugin graph',
    inject: injected,
  }, GraphTab))
}
