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
import type { Context, Fiber } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/cordis-plugin-loader'

const MAX_FIBERS = 4096
const MAX_LABEL = 400

/** Fiber lifecycle phase, or `disabled` for a Loader row turned off. */
export type NodePhase = 'pending' | 'loading' | 'active' | 'failed' | 'unloading' | 'disposed' | 'disabled'

const PHASE: Record<number, NodePhase> = {
  0: 'pending',
  1: 'loading',
  2: 'active',
  3: 'failed',
  4: 'disposed',
  5: 'unloading',
}

/** One plugin fiber (or a disabled Loader row) in the graph. */
export interface GraphNode {
  /** Registry-unique fiber id (0 = root); a synthetic negative id for a disabled row with no fiber. */
  readonly uid: number
  /** Display name (nearest named ancestor, else `root`). */
  readonly name: string
  readonly phase: NodePhase
  /** Whether the owning Loader row is enabled (a `disabled: true` patch flips this). */
  readonly enabled: boolean
  /** Exact module specifier the Loader entry imports, when this fiber/row owns one. */
  readonly moduleName: string | null
  /** Stable Loader entry id owning this fiber, when it maps to one. */
  readonly loaderEntryId: string | null
  /** Service names this fiber currently provides into the shared store. */
  readonly provides: readonly string[]
  /** Labels of this fiber's top-level live effects (registrations, listeners, timers...). */
  readonly effects: readonly string[]
}

/** Edge kinds, all directed consumer -> dependency / child -> parent. */
export type EdgeKind = 'inject' | 'provider' | 'nesting'

/** One relation between two fibers. */
export interface GraphEdge {
  readonly kind: EdgeKind
  readonly from: number
  readonly to: number
  /** For `inject` / `provider`: the service name. */
  readonly service?: string
  /** For `inject`: whether the required service resolved to an active provider. */
  readonly resolved?: boolean
}

/** One recent tool execution captured by the host half's `tools/result` subscription. */
export interface RuntimeEvent {
  /** Epoch ms. */
  readonly at: number
  readonly tool: string
  readonly callId: string
  readonly isError: boolean
}

/** Point-in-time relation graph of one Cordis context. */
export interface GraphSnapshot {
  readonly capturedAt: string
  readonly plane: string
  readonly nodes: readonly GraphNode[]
  readonly edges: readonly GraphEdge[]
  /** Visible model-tool names (host plane only; empty on the renderer plane). */
  readonly tools: readonly string[]
  /** Recent tool executions, newest last (host plane only; empty on the renderer plane). */
  readonly runtimeEvents: readonly RuntimeEvent[]
}

interface ImplLike { readonly name: string; readonly fiber: Fiber }
interface LoaderLike {
  locate?: (fiber: Fiber) => string | undefined
  entries?: () => Iterable<{
    id?: string
    disabled?: boolean
    fiber?: Fiber
    options?: { name?: string; group?: boolean }
  }>
}

function clampLabel(value: string): string {
  return value.length > MAX_LABEL ? `${value.slice(0, MAX_LABEL)}…` : value
}

function phaseOf(fiber: Fiber): NodePhase {
  return PHASE[fiber.state] ?? 'pending'
}

/** Every live fiber reachable from the context root, root first, uid-ascending. */
function collectFibers(ctx: Context): Fiber[] {
  const found = new Set<Fiber>([ctx.root.fiber])
  for (const runtime of ctx.root.registry.values()) {
    for (const fiber of runtime.fibers) {
      if (fiber.uid !== null) found.add(fiber)
    }
  }
  const result = [...found].sort((a, b) => (a.uid ?? 0) - (b.uid ?? 0))
  if (result.length > MAX_FIBERS) throw new Error('cordis-plugin-graph: context exceeds the inspection fiber limit')
  return result
}

/**
 * Live service implementations in the root reflect store. Keyed off
 * `impl.fiber.uid` (a number inherited through any wrapped-fiber prototype
 * chain), so a wrapped vs raw fiber identity mismatch never mis-attributes a
 * provider.
 */
function liveServices(ctx: Context): ImplLike[] {
  const store = ctx.root.reflect.store as Record<string | symbol, ImplLike | undefined>
  return Reflect.ownKeys(store)
    .map(key => store[key])
    .filter((impl): impl is ImplLike =>
      impl != null && typeof impl.name === 'string' && impl.fiber != null && impl.fiber.uid != null)
}

/** Capture the current Cordis graph of `ctx`. */
export function inspectCordisContext(
  ctx: Context,
  plane = 'client',
  extra: { tools?: readonly string[]; runtimeEvents?: readonly RuntimeEvent[] } = {},
): GraphSnapshot {
  const fibers = collectFibers(ctx)
  const services = liveServices(ctx)

  const providesByUid = new Map<number, string[]>()
  for (const impl of services) {
    const uid = impl.fiber.uid ?? 0
    const list = providesByUid.get(uid) ?? []
    list.push(impl.name)
    providesByUid.set(uid, list)
  }

  const loader = ctx.get('loader') as LoaderLike | undefined
  const uidByEntryId = new Map<string, number>()
  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []
  const known = new Set<number>()

  for (const fiber of fibers) {
    const uid = fiber.uid ?? 0
    known.add(uid)
    const parent = fiber.parent.fiber
    const parentUid = parent === fiber ? null : (parent.uid ?? null)
    const entryId = loader?.locate?.(fiber) ?? null
    if (entryId !== null) uidByEntryId.set(entryId, uid)

    nodes.push({
      uid,
      name: clampLabel(fiber.name),
      phase: phaseOf(fiber),
      enabled: true,
      moduleName: fiber.entry?.options.name ?? null,
      loaderEntryId: entryId,
      provides: [...(providesByUid.get(uid) ?? [])].sort(),
      effects: fiber.getEffects().map(meta => clampLabel(meta.label)),
    })

    if (parentUid !== null && known.has(parentUid)) {
      edges.push({ kind: 'nesting', from: uid, to: parentUid })
    }

    for (const service of Object.keys(fiber.inject).sort()) {
      const impl = fiber.store?.[service] as { fiber?: { uid: number | null } } | undefined
      const providerUid = impl?.fiber?.uid ?? null
      const resolved = providerUid !== null && known.has(providerUid)
      edges.push({ kind: 'inject', from: uid, to: resolved ? providerUid : uid, service, resolved })
      if (resolved && providerUid !== uid) {
        edges.push({ kind: 'provider', from: providerUid, to: uid, service })
      }
    }
  }

  // Disabled / not-yet-mounted Loader rows: show the whole composition, not
  // only what is running. A row with a live fiber is already covered above.
  let synthetic = -1
  if (typeof loader?.entries === 'function') {
    for (const entry of loader.entries()) {
      if (entry?.options?.group) continue
      const id = typeof entry.id === 'string' ? entry.id : null
      if (id !== null && uidByEntryId.has(id)) continue
      const fiberUid = entry.fiber?.uid ?? null
      if (fiberUid !== null && known.has(fiberUid)) continue
      const disabled = entry.disabled === true
      const uid = fiberUid ?? synthetic--
      nodes.push({
        uid,
        name: clampLabel(entry.options?.name ?? id ?? 'unknown'),
        phase: disabled ? 'disabled' : (entry.fiber ? phaseOf(entry.fiber) : 'pending'),
        enabled: !disabled,
        moduleName: entry.options?.name ?? null,
        loaderEntryId: id,
        provides: [],
        effects: [],
      })
    }
  }

  return {
    capturedAt: new Date().toISOString(),
    plane,
    nodes,
    edges,
    tools: [...(extra.tools ?? [])],
    runtimeEvents: [...(extra.runtimeEvents ?? [])],
  }
}
