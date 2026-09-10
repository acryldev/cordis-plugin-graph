import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Core } from 'cytoscape'
import type { EdgeKind, GraphNode, GraphSnapshot, RuntimeEvent } from '../inspect.ts'
import { EDGE_COLOR, PHASE_COLOR, mountGraph, pulseNodes, toElements, type EdgeFilter } from './cytoscape-graph.ts'

/** Injected share: closures over the client Cordis context + the host route. */
export interface GraphTabInjected {
  /** Capture the current renderer-plane Cordis graph, in-process. */
  inspect: () => GraphSnapshot
  /** Fetch the host-plane graph + live tool events from the host route. Rejects if unreachable. */
  pollHost: (signal: AbortSignal) => Promise<GraphSnapshot>
}

type Plane = 'client' | 'host' | 'both'
const PLANES: readonly Plane[] = ['client', 'host', 'both']

const EDGE_KINDS: readonly EdgeKind[] = ['inject', 'provider', 'nesting']
const EDGE_LABEL: Record<EdgeKind, string> = {
  inject: 'requires (inject)',
  provider: 'provides to',
  nesting: 'nested in (Loader tree)',
}
const HOST_POLL_MS = 2000

/** The "Plugin graph" Settings tab. */
export function GraphTab({ inspect, pollHost }: GraphTabInjected) {
  const containerRef = useRef<HTMLDivElement>(null)
  const cyRef = useRef<Core | null>(null)

  const [plane, setPlane] = useState<Plane>('client')
  const [clientSnap, setClientSnap] = useState<GraphSnapshot | null>(null)
  const [hostSnap, setHostSnap] = useState<GraphSnapshot | null>(null)
  const [hostError, setHostError] = useState<string | null>(null)
  const [clientError, setClientError] = useState<string | null>(null)
  const [filter, setFilter] = useState<EdgeFilter>({ inject: true, provider: false, nesting: true })
  const [selected, setSelected] = useState<GraphNode | null>(null)
  const [query, setQuery] = useState('')

  const captureClient = useCallback(() => {
    try {
      setClientSnap(inspect())
      setClientError(null)
    } catch (cause) {
      setClientError(cause instanceof Error ? cause.message : String(cause))
    }
  }, [inspect])

  useEffect(() => { captureClient() }, [captureClient])

  // Poll the host route while the host plane is shown and the tab is visible.
  const lastEventAt = useRef(0)
  useEffect(() => {
    if (plane === 'client') return
    let stopped = false
    const controller = new AbortController()
    const tick = async () => {
      if (stopped || document.hidden) return
      try {
        const snap = await pollHost(controller.signal)
        if (stopped) return
        setHostSnap(snap)
        setHostError(null)
        // Pulse nodes whose module ~ a fresh tool name.
        const fresh = snap.runtimeEvents.filter(e => e.at > lastEventAt.current)
        if (fresh.length > 0 && cyRef.current) {
          lastEventAt.current = Math.max(...snap.runtimeEvents.map(e => e.at))
          for (const ev of fresh) {
            pulseNodes(cyRef.current, (mod, label) =>
              mod.includes('tool') || label.includes('tool') || mod.includes(ev.tool) || label.includes(ev.tool))
          }
        }
      } catch (cause) {
        if (!stopped && (cause as Error)?.name !== 'AbortError') {
          setHostError(cause instanceof Error ? cause.message : String(cause))
        }
      }
    }
    void tick()
    const id = window.setInterval(() => { void tick() }, HOST_POLL_MS)
    return () => { stopped = true; controller.abort(); window.clearInterval(id) }
  }, [plane, pollHost])

  const elements = useMemo(() => {
    const out = []
    if (plane !== 'host' && clientSnap) out.push(...toElements(clientSnap, filter, 'c-'))
    if (plane !== 'client' && hostSnap) out.push(...toElements(hostSnap, filter, 'h-'))
    return out
  }, [plane, clientSnap, hostSnap, filter])

  const nodeByElId = useMemo(() => {
    const map = new Map<string, GraphNode>()
    for (const n of clientSnap?.nodes ?? []) map.set(`c-f${n.uid}`, n)
    for (const n of hostSnap?.nodes ?? []) map.set(`h-f${n.uid}`, n)
    return map
  }, [clientSnap, hostSnap])

  // (Re)mount the graph when elements change.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    cyRef.current?.destroy()
    const cy = mountGraph(container, elements)
    cy.on('tap', 'node', (event) => {
      setSelected(nodeByElId.get(String(event.target.id())) ?? null)
      cy.elements().removeClass('faded')
      cy.elements().not(event.target.closedNeighborhood()).addClass('faded')
    })
    cy.on('tap', (event) => {
      if (event.target === cy) {
        setSelected(null)
        cy.elements().removeClass('faded')
      }
    })
    cyRef.current = cy
    return () => { cy.destroy(); cyRef.current = null }
  }, [elements, nodeByElId])

  // Search fade.
  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return
    const q = query.trim().toLowerCase()
    cy.elements().removeClass('faded')
    if (q === '') return
    const hits = cy.nodes().filter(n =>
      String(n.data('label')).toLowerCase().includes(q) || String(n.data('module')).toLowerCase().includes(q))
    cy.elements().not(hits.closedNeighborhood()).addClass('faded')
  }, [query])

  const phaseCounts = useMemo(() => {
    const m = new Map<string, number>()
    const src = plane === 'host' ? hostSnap?.nodes : plane === 'client' ? clientSnap?.nodes
      : [...(clientSnap?.nodes ?? []), ...(hostSnap?.nodes ?? [])]
    for (const n of src ?? []) m.set(n.phase, (m.get(n.phase) ?? 0) + 1)
    return m
  }, [plane, clientSnap, hostSnap])

  const nodeCount = elements.filter(e => !('source' in e.data)).length
  const edgeCount = elements.length - nodeCount
  const recentEvents: readonly RuntimeEvent[] = hostSnap?.runtimeEvents ?? []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 480, gap: 8 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, fontSize: 12 }}>
        <strong>Cordis plugin graph</strong>
        <span style={{ opacity: 0.6 }}>{nodeCount} fibers · {edgeCount} relations</span>
        <span style={{ display: 'inline-flex', border: '1px solid var(--dsw-alias-separator, #30363d)', borderRadius: 4, overflow: 'hidden' }}>
          {PLANES.map(p => (
            <button
              key={p}
              type="button"
              onClick={() => setPlane(p)}
              style={{ ...tab, ...(plane === p ? tabActive : {}) }}
            >{p}</button>
          ))}
        </span>
        <button type="button" onClick={captureClient} style={btn}>Recapture</button>
        <button type="button" onClick={() => cyRef.current?.fit(undefined, 40)} style={btn}>Fit</button>
        {EDGE_KINDS.map(kind => (
          <label key={kind} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <input type="checkbox" checked={filter[kind]} onChange={e => setFilter(f => ({ ...f, [kind]: e.target.checked }))} />
            <span style={{ color: EDGE_COLOR[kind] }}>■</span> {EDGE_LABEL[kind]}
          </label>
        ))}
        <input type="search" placeholder="filter by name / module" value={query} onChange={e => setQuery(e.target.value)} style={{ ...btn, minWidth: 170 }} />
      </div>

      <div style={{ display: 'flex', gap: 12, fontSize: 11, flexWrap: 'wrap' }}>
        {[...phaseCounts].map(([p, n]) => (
          <span key={p}><span style={{ color: PHASE_COLOR[p as keyof typeof PHASE_COLOR] ?? '#8b949e' }}>●</span> {p} ({n})</span>
        ))}
        {plane !== 'client' && (
          <span style={{ opacity: 0.6 }}>
            {hostError ? `host route unavailable (${hostError})` : hostSnap ? `host: ${hostSnap.tools.length} tools · ${recentEvents.length} recent calls` : 'polling host…'}
          </span>
        )}
      </div>

      {clientError && <div style={{ color: '#f85149', fontSize: 12 }}>Renderer inspection failed: {clientError}</div>}

      <div style={{ display: 'flex', flex: 1, minHeight: 360, gap: 8 }}>
        <div ref={containerRef} style={{ flex: 1, minHeight: 360, borderRadius: 6, border: '1px solid var(--dsw-alias-separator, #30363d)', background: 'var(--dsw-alias-fill-tertiary, #0d1117)' }} />
        <aside style={{ width: 280, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12, minHeight: 0 }}>
          {selected && (
            <div style={{ overflow: 'auto', borderRadius: 6, border: '1px solid var(--dsw-alias-separator, #30363d)', padding: 10 }}>
              <div style={{ fontWeight: 600, wordBreak: 'break-word' }}>{selected.name}</div>
              <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px 8px', margin: '8px 0' }}>
                <dt style={dt}>uid</dt><dd style={dd}>{selected.uid}</dd>
                <dt style={dt}>phase</dt><dd style={dd}>{selected.phase}{selected.enabled ? '' : ' (row off)'}</dd>
                <dt style={dt}>module</dt><dd style={dd}>{selected.moduleName ?? '—'}</dd>
                <dt style={dt}>entry id</dt><dd style={dd}>{selected.loaderEntryId ?? '—'}</dd>
              </dl>
              {selected.provides.length > 0 && (<><div style={dt}>provides ({selected.provides.length})</div>
                <ul style={ul}>{selected.provides.map(s => <li key={s}><code>{s}</code></li>)}</ul></>)}
              {selected.effects.length > 0 && (<><div style={dt}>effects ({selected.effects.length})</div>
                <ul style={ul}>{selected.effects.slice(0, 40).map((s, i) => <li key={i}><code>{s}</code></li>)}</ul></>)}
            </div>
          )}
          {plane !== 'client' && recentEvents.length > 0 && (
            <div style={{ flex: 1, minHeight: 0, overflow: 'auto', borderRadius: 6, border: '1px solid var(--dsw-alias-separator, #30363d)', padding: 10 }}>
              <div style={{ ...dt, marginBottom: 4 }}>runtime activity — last {recentEvents.length} tool calls</div>
              <ul style={{ ...ul, margin: 0 }}>
                {[...recentEvents].reverse().slice(0, 40).map((ev, i) => (
                  <li key={i} style={{ color: ev.isError ? '#f85149' : 'inherit' }}>
                    <code>{ev.tool}</code> <span style={{ opacity: 0.5 }}>{new Date(ev.at).toLocaleTimeString()}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}

const btn: React.CSSProperties = {
  fontSize: 12, padding: '3px 8px', borderRadius: 4,
  border: '1px solid var(--dsw-alias-separator, #30363d)', background: 'transparent', color: 'inherit', cursor: 'pointer',
}
const tab: React.CSSProperties = { ...btn, border: 'none', borderRadius: 0, padding: '3px 10px', opacity: 0.6 }
const tabActive: React.CSSProperties = { opacity: 1, background: 'var(--dsw-alias-fill-secondary, rgba(255,255,255,.08))' }
const dt: React.CSSProperties = { opacity: 0.6 }
const dd: React.CSSProperties = { margin: 0, wordBreak: 'break-word' }
const ul: React.CSSProperties = { margin: '2px 0 10px', paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 2 }
