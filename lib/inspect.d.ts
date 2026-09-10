/**
 * Bounded projection of a live Cordis context into a plugin relation graph.
 *
 * Pure `@deepseek-ai/cordis` + `cordis-plugin-loader` public API - no
 * DSH- or ACRYL-specific dependency, so the same walk runs against any
 * Cordis root (this plugin runs it on both the renderer context and, from
 * the host half, the host context).
 *
 * Started as a trimmed port of `acryl-desktop/src/plugin-architecture-inspector.ts`;
 * extended to also surface disabled / not-yet-active Loader entries so the
 * graph shows the whole composition, not only what happens to be running.
 */
import type { Context } from '@deepseek-ai/cordis';
/** Fiber lifecycle phase, or `disabled` for a Loader row turned off. */
export type NodePhase = 'pending' | 'loading' | 'active' | 'failed' | 'unloading' | 'disposed' | 'disabled';
/** One plugin fiber (or a disabled Loader row) in the graph. */
export interface GraphNode {
    /** Registry-unique fiber id (0 = root); a synthetic negative id for a disabled row with no fiber. */
    readonly uid: number;
    /** Display name (nearest named ancestor, else `root`). */
    readonly name: string;
    readonly phase: NodePhase;
    /** Whether the owning Loader row is enabled (a `disabled: true` patch flips this). */
    readonly enabled: boolean;
    /** Exact module specifier the Loader entry imports, when this fiber/row owns one. */
    readonly moduleName: string | null;
    /** Stable Loader entry id owning this fiber, when it maps to one. */
    readonly loaderEntryId: string | null;
    /** Service names this fiber currently provides into the shared store. */
    readonly provides: readonly string[];
    /** Labels of this fiber's top-level live effects (registrations, listeners, timers...). */
    readonly effects: readonly string[];
}
/** Edge kinds, all directed consumer -> dependency / child -> parent. */
export type EdgeKind = 'inject' | 'provider' | 'nesting';
/** One relation between two fibers. */
export interface GraphEdge {
    readonly kind: EdgeKind;
    readonly from: number;
    readonly to: number;
    /** For `inject` / `provider`: the service name. */
    readonly service?: string;
    /** For `inject`: whether the required service resolved to an active provider. */
    readonly resolved?: boolean;
}
/** One recent tool execution captured by the host half's `tools/result` subscription. */
export interface RuntimeEvent {
    /** Epoch ms. */
    readonly at: number;
    readonly tool: string;
    readonly callId: string;
    readonly isError: boolean;
}
/** Point-in-time relation graph of one Cordis context. */
export interface GraphSnapshot {
    readonly capturedAt: string;
    readonly plane: string;
    readonly nodes: readonly GraphNode[];
    readonly edges: readonly GraphEdge[];
    /** Visible model-tool names (host plane only; empty on the renderer plane). */
    readonly tools: readonly string[];
    /** Recent tool executions, newest last (host plane only; empty on the renderer plane). */
    readonly runtimeEvents: readonly RuntimeEvent[];
}
/** Capture the current Cordis graph of `ctx`. */
export declare function inspectCordisContext(ctx: Context, plane?: string, extra?: {
    tools?: readonly string[];
    runtimeEvents?: readonly RuntimeEvent[];
}): GraphSnapshot;
