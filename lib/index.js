import { inspectCordisContext } from "./inspect.js";
export { inspectCordisContext } from "./inspect.js";
/** Same-origin route the renderer polls for the host plane + live events. */
export const STATE_ROUTE = '/plugins/cordis-plugin-graph/state';
const MAX_EVENTS = 64;
const MAX_BODY_NOTE = 4096;
/** Host plugin body. */
export function apply(ctx) {
    /** Recent tool executions, oldest first, capped. Shared with the route below. */
    const events = [];
    // (1) live tool-execution feed - degrades silently without a tool runtime.
    ctx.inject(['tools'], (toolsCtx) => {
        toolsCtx.effect(() => toolsCtx.on('tools/result', (exec, result) => {
            try {
                events.push({
                    at: Date.now(),
                    tool: typeof exec?.name === 'string' ? exec.name.slice(0, 200) : 'unknown',
                    callId: String(exec?.callId ?? '').slice(0, 200),
                    isError: result?.isError === true,
                });
                if (events.length > MAX_EVENTS)
                    events.shift();
            }
            catch {
                // never let an observer failure disturb the tool pipeline
            }
            return undefined;
        }), 'cordis-plugin-graph: runtime events');
    });
    // (2) same-origin host-plane state route - degrades silently without a web server.
    ctx.inject(['webServer'], (webCtx) => {
        const webServer = webCtx.get('webServer');
        if (webServer === undefined)
            return;
        webCtx.effect(() => webServer.register({
            kind: 'exact',
            path: STATE_ROUTE,
            handler: (_req, res) => {
                let payload;
                try {
                    payload = JSON.stringify(inspectCordisContext(ctx, 'host', { runtimeEvents: events.slice(-MAX_EVENTS) }));
                }
                catch (cause) {
                    res.writeHead(500, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
                    res.end(JSON.stringify({ error: cause instanceof Error ? cause.message.slice(0, MAX_BODY_NOTE) : 'inspection failed' }));
                    return;
                }
                res.writeHead(200, {
                    'content-type': 'application/json; charset=utf-8',
                    'cache-control': 'no-store',
                    'x-content-type-options': 'nosniff',
                });
                res.end(payload);
            },
        }), 'cordis-plugin-graph: host state route');
    });
}
