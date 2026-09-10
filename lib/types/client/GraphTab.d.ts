import type { GraphSnapshot } from '../inspect.ts';
/** Injected share: closures over the client Cordis context + the host route. */
export interface GraphTabInjected {
    /** Capture the current renderer-plane Cordis graph, in-process. */
    inspect: () => GraphSnapshot;
    /** Fetch the host-plane graph + live tool events from the host route. Rejects if unreachable. */
    pollHost: (signal: AbortSignal) => Promise<GraphSnapshot>;
}
/** The "Plugin graph" Settings tab. */
export declare function GraphTab({ inspect, pollHost }: GraphTabInjected): import("react").JSX.Element;
