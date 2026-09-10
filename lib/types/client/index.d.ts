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
import type { Context as ClientContext } from '@deepseek-ai/cordis';
export { inspectCordisContext } from '../inspect.ts';
export type { GraphSnapshot, GraphNode, GraphEdge, EdgeKind, NodePhase, RuntimeEvent } from '../inspect.ts';
/** Required service: the UI slot registry. */
export declare const inject: string[];
/** Contribute the "Plugin graph" tab to the Plugins settings section. */
export declare function apply(ctx: ClientContext): void;
