/** Snapshot -> Cytoscape elements + a themed, zoomable mount. */
import cytoscape, { type Core, type ElementDefinition, type LayoutOptions } from 'cytoscape'
import type { EdgeKind, GraphSnapshot, NodePhase } from '../inspect.ts'

const PHASE_COLOR: Record<NodePhase, string> = {
  active: '#3fb950',
  pending: '#d29922',
  loading: '#58a6ff',
  failed: '#f85149',
  unloading: '#a371f7',
  disposed: '#8b949e',
  disabled: '#484f58',
}

const EDGE_COLOR: Record<EdgeKind, string> = {
  inject: '#8b949e',
  provider: '#3fb950',
  nesting: '#484f58',
}

/** Which edge kinds to include. */
export type EdgeFilter = Record<EdgeKind, boolean>

/**
 * Merge one snapshot's nodes/edges into a cross-plane element list. `prefix`
 * namespaces the node ids so the renderer and host planes never collide.
 */
export function toElements(snapshot: GraphSnapshot, filter: EdgeFilter, prefix = ''): ElementDefinition[] {
  const nid = (uid: number) => `${prefix}f${uid}`
  const elements: ElementDefinition[] = []
  for (const node of snapshot.nodes) {
    elements.push({
      data: {
        id: nid(node.uid),
        label: node.name,
        phase: node.phase,
        plane: snapshot.plane,
        module: node.moduleName ?? '',
        entryId: node.loaderEntryId ?? '',
        provides: node.provides.length,
      },
    })
  }
  let e = 0
  for (const edge of snapshot.edges) {
    if (!filter[edge.kind]) continue
    if (edge.kind === 'inject' && !edge.resolved) continue // unresolved: from==to, skip the self loop
    elements.push({
      data: {
        id: `${prefix}e${e++}`,
        source: nid(edge.from),
        target: nid(edge.to),
        kind: edge.kind,
        label: edge.service ?? '',
      },
    })
  }
  return elements
}

const LAYOUT: LayoutOptions = {
  name: 'cose',
  animate: false,
  nodeRepulsion: () => 12000,
  idealEdgeLength: () => 90,
  edgeElasticity: () => 60,
  gravity: 0.3,
  numIter: 1200,
  fit: true,
  padding: 40,
} as unknown as LayoutOptions

/** Mount a graph into `container`; returns the Core for later updates/teardown. */
export function mountGraph(container: HTMLElement, elements: ElementDefinition[]): Core {
  const cy = cytoscape({
    container,
    elements,
    wheelSensitivity: 0.2,
    minZoom: 0.1,
    maxZoom: 3,
    style: [
      {
        selector: 'node',
        style: {
          'background-color': (ele: cytoscape.NodeSingular) => PHASE_COLOR[ele.data('phase') as NodePhase] ?? '#8b949e',
          label: 'data(label)',
          color: '#c9d1d9',
          'font-size': 9,
          'text-valign': 'bottom',
          'text-margin-y': 3,
          width: (ele: cytoscape.NodeSingular) => 14 + Math.min(20, Number(ele.data('provides')) * 3),
          height: (ele: cytoscape.NodeSingular) => 14 + Math.min(20, Number(ele.data('provides')) * 3),
          'border-width': 1,
          'border-color': '#0d1117',
          opacity: (ele: cytoscape.NodeSingular) => (ele.data('phase') === 'disabled' ? 0.45 : 1),
        },
      },
      {
        selector: 'edge',
        style: {
          width: (ele: cytoscape.EdgeSingular) => (ele.data('kind') === 'nesting' ? 1 : 1.5),
          'line-color': (ele: cytoscape.EdgeSingular) => EDGE_COLOR[ele.data('kind') as EdgeKind] ?? '#8b949e',
          'line-style': (ele: cytoscape.EdgeSingular) => (ele.data('kind') === 'nesting' ? 'dashed' : 'solid'),
          'target-arrow-color': (ele: cytoscape.EdgeSingular) => EDGE_COLOR[ele.data('kind') as EdgeKind] ?? '#8b949e',
          'target-arrow-shape': 'triangle',
          'arrow-scale': 0.7,
          'curve-style': 'bezier',
          opacity: 0.7,
        },
      },
      { selector: 'node:selected', style: { 'border-width': 3, 'border-color': '#58a6ff' } },
      { selector: '.faded', style: { opacity: 0.12 } },
      { selector: '.pulse', style: { 'border-width': 4, 'border-color': '#f0c674', 'background-color': '#f0c674' } },
    ],
    layout: LAYOUT,
  })
  return cy
}

/** Briefly flash matching nodes (used for the live tool-flow pulse). */
export function pulseNodes(cy: Core, predicate: (moduleName: string, label: string) => boolean): void {
  const hits = cy.nodes().filter(n =>
    predicate(String(n.data('module')), String(n.data('label'))))
  if (hits.length === 0) return
  hits.addClass('pulse')
  setTimeout(() => { hits.removeClass('pulse') }, 900)
}

export { PHASE_COLOR, EDGE_COLOR }
