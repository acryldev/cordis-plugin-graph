import { describe, expect, it } from 'vitest'
import type { GraphSnapshot } from '../src/inspect.ts'
import { toElements } from '../src/client/cytoscape-graph.ts'

const snapshot: GraphSnapshot = {
  capturedAt: '2026-01-01T00:00:00.000Z',
  plane: 'client',
  tools: [],
  runtimeEvents: [],
  nodes: [
    { uid: 0, name: 'root', phase: 'active', enabled: true, moduleName: null, loaderEntryId: null, provides: ['loader'], effects: [] },
    { uid: 1, name: 'a', phase: 'active', enabled: true, moduleName: 'pkg-a', loaderEntryId: 'include:a', provides: ['svcA'], effects: ['ctx.on("x")'] },
    { uid: 2, name: 'b', phase: 'pending', enabled: true, moduleName: 'pkg-b', loaderEntryId: 'include:b', provides: [], effects: [] },
    { uid: -1, name: 'off', phase: 'disabled', enabled: false, moduleName: 'pkg-off', loaderEntryId: 'include:off', provides: [], effects: [] },
  ],
  edges: [
    { kind: 'nesting', from: 1, to: 0 },
    { kind: 'nesting', from: 2, to: 0 },
    { kind: 'inject', from: 2, to: 1, service: 'svcA', resolved: true },
    { kind: 'provider', from: 1, to: 2, service: 'svcA' },
    { kind: 'inject', from: 2, to: 2, service: 'missingSvc', resolved: false },
  ],
}

describe('toElements', () => {
  it('emits one node element per fiber/row, including disabled rows', () => {
    const els = toElements(snapshot, { inject: false, provider: false, nesting: false })
    const nodes = els.filter(e => !('source' in e.data))
    expect(nodes).toHaveLength(4)
    expect(nodes.find(n => n.data.id === 'f1')?.data).toMatchObject({ label: 'a', phase: 'active', module: 'pkg-a', provides: 1 })
    expect(nodes.find(n => n.data.id === 'f-1')?.data).toMatchObject({ label: 'off', phase: 'disabled' })
  })

  it('namespaces node ids by plane prefix so planes never collide', () => {
    const els = toElements(snapshot, { inject: true, provider: false, nesting: true }, 'h-')
    expect(els.every(e => String(e.data.id).startsWith('h-'))).toBe(true)
    const inject = els.find(e => 'source' in e.data && e.data.kind === 'inject')
    expect(inject?.data).toMatchObject({ source: 'h-f2', target: 'h-f1', label: 'svcA' })
  })

  it('includes only enabled edge kinds', () => {
    const nestingOnly = toElements(snapshot, { inject: false, provider: false, nesting: true }).filter(e => 'source' in e.data)
    expect(nestingOnly).toHaveLength(2)
    expect(nestingOnly.every(e => e.data.kind === 'nesting')).toBe(true)
  })

  it('drops unresolved inject edges (self-loops), keeps resolved ones', () => {
    const injectEdges = toElements(snapshot, { inject: true, provider: false, nesting: false }).filter(e => 'source' in e.data)
    expect(injectEdges).toHaveLength(1)
    expect(injectEdges[0]?.data).toMatchObject({ source: 'f2', target: 'f1', kind: 'inject', label: 'svcA' })
  })

  it('emits provider edges pointing from provider to consumer', () => {
    const providerEdges = toElements(snapshot, { inject: false, provider: true, nesting: false }).filter(e => 'source' in e.data)
    expect(providerEdges).toHaveLength(1)
    expect(providerEdges[0]?.data).toMatchObject({ source: 'f1', target: 'f2', kind: 'provider' })
  })
})
