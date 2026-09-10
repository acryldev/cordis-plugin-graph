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
import type { Context } from '@deepseek-ai/cordis';
export { inspectCordisContext } from './inspect.ts';
export type { GraphSnapshot, GraphNode, GraphEdge, EdgeKind, NodePhase, RuntimeEvent } from './inspect.ts';
/** Same-origin route the renderer polls for the host plane + live events. */
export declare const STATE_ROUTE = "/plugins/cordis-plugin-graph/state";
/** Host plugin body. */
export declare function apply(ctx: Context): void;
