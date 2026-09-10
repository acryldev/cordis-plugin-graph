const MAX_FIBERS = 4096;
const MAX_LABEL = 400;
const PHASE = {
    0: 'pending',
    1: 'loading',
    2: 'active',
    3: 'failed',
    4: 'disposed',
    5: 'unloading',
};
function clampLabel(value) {
    return value.length > MAX_LABEL ? `${value.slice(0, MAX_LABEL)}…` : value;
}
function phaseOf(fiber) {
    return PHASE[fiber.state] ?? 'pending';
}
/** Every live fiber reachable from the context root, root first, uid-ascending. */
function collectFibers(ctx) {
    const found = new Set([ctx.root.fiber]);
    for (const runtime of ctx.root.registry.values()) {
        for (const fiber of runtime.fibers) {
            if (fiber.uid !== null)
                found.add(fiber);
        }
    }
    const result = [...found].sort((a, b) => (a.uid ?? 0) - (b.uid ?? 0));
    if (result.length > MAX_FIBERS)
        throw new Error('cordis-plugin-graph: context exceeds the inspection fiber limit');
    return result;
}
/**
 * Live service implementations in the root reflect store. Keyed off
 * `impl.fiber.uid` (a number inherited through any wrapped-fiber prototype
 * chain), so a wrapped vs raw fiber identity mismatch never mis-attributes a
 * provider.
 */
function liveServices(ctx) {
    const store = ctx.root.reflect.store;
    return Reflect.ownKeys(store)
        .map(key => store[key])
        .filter((impl) => impl != null && typeof impl.name === 'string' && impl.fiber != null && impl.fiber.uid != null);
}
/** Capture the current Cordis graph of `ctx`. */
export function inspectCordisContext(ctx, plane = 'client', extra = {}) {
    const fibers = collectFibers(ctx);
    const services = liveServices(ctx);
    const providesByUid = new Map();
    for (const impl of services) {
        const uid = impl.fiber.uid ?? 0;
        const list = providesByUid.get(uid) ?? [];
        list.push(impl.name);
        providesByUid.set(uid, list);
    }
    const loader = ctx.get('loader');
    const uidByEntryId = new Map();
    const nodes = [];
    const edges = [];
    const known = new Set();
    for (const fiber of fibers) {
        const uid = fiber.uid ?? 0;
        known.add(uid);
        const parent = fiber.parent.fiber;
        const parentUid = parent === fiber ? null : (parent.uid ?? null);
        const entryId = loader?.locate?.(fiber) ?? null;
        if (entryId !== null)
            uidByEntryId.set(entryId, uid);
        nodes.push({
            uid,
            name: clampLabel(fiber.name),
            phase: phaseOf(fiber),
            enabled: true,
            moduleName: fiber.entry?.options.name ?? null,
            loaderEntryId: entryId,
            provides: [...(providesByUid.get(uid) ?? [])].sort(),
            effects: fiber.getEffects().map(meta => clampLabel(meta.label)),
        });
        if (parentUid !== null && known.has(parentUid)) {
            edges.push({ kind: 'nesting', from: uid, to: parentUid });
        }
        for (const service of Object.keys(fiber.inject).sort()) {
            const impl = fiber.store?.[service];
            const providerUid = impl?.fiber?.uid ?? null;
            const resolved = providerUid !== null && known.has(providerUid);
            edges.push({ kind: 'inject', from: uid, to: resolved ? providerUid : uid, service, resolved });
            if (resolved && providerUid !== uid) {
                edges.push({ kind: 'provider', from: providerUid, to: uid, service });
            }
        }
    }
    // Disabled / not-yet-mounted Loader rows: show the whole composition, not
    // only what is running. A row with a live fiber is already covered above.
    let synthetic = -1;
    if (typeof loader?.entries === 'function') {
        for (const entry of loader.entries()) {
            if (entry?.options?.group)
                continue;
            const id = typeof entry.id === 'string' ? entry.id : null;
            if (id !== null && uidByEntryId.has(id))
                continue;
            const fiberUid = entry.fiber?.uid ?? null;
            if (fiberUid !== null && known.has(fiberUid))
                continue;
            const disabled = entry.disabled === true;
            const uid = fiberUid ?? synthetic--;
            nodes.push({
                uid,
                name: clampLabel(entry.options?.name ?? id ?? 'unknown'),
                phase: disabled ? 'disabled' : (entry.fiber ? phaseOf(entry.fiber) : 'pending'),
                enabled: !disabled,
                moduleName: entry.options?.name ?? null,
                loaderEntryId: id,
                provides: [],
                effects: [],
            });
        }
    }
    return {
        capturedAt: new Date().toISOString(),
        plane,
        nodes,
        edges,
        tools: [...(extra.tools ?? [])],
        runtimeEvents: [...(extra.runtimeEvents ?? [])],
    };
}
