/** Snapshot -> Cytoscape elements + a themed, zoomable mount. */
import { type Core, type ElementDefinition } from 'cytoscape';
import type { EdgeKind, GraphSnapshot, NodePhase } from '../inspect.ts';
declare const PHASE_COLOR: Record<NodePhase, string>;
declare const EDGE_COLOR: Record<EdgeKind, string>;
/** Which edge kinds to include. */
export type EdgeFilter = Record<EdgeKind, boolean>;
/**
 * Merge one snapshot's nodes/edges into a cross-plane element list. `prefix`
 * namespaces the node ids so the renderer and host planes never collide.
 */
export declare function toElements(snapshot: GraphSnapshot, filter: EdgeFilter, prefix?: string): ElementDefinition[];
/** Mount a graph into `container`; returns the Core for later updates/teardown. */
export declare function mountGraph(container: HTMLElement, elements: ElementDefinition[]): Core;
/** Briefly flash matching nodes (used for the live tool-flow pulse). */
export declare function pulseNodes(cy: Core, predicate: (moduleName: string, label: string) => boolean): void;
export { PHASE_COLOR, EDGE_COLOR };
