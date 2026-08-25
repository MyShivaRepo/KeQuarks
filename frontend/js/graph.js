// Vue graphique repliée (Cytoscape.js) — nodes reliés par des arêtes directes.
// Supporte le glisser-déposer d'un node sur un autre pour créer une relation.
const Graph = {
  cy: null,
  _startPos: null,
  _dropHandler: null,
  _onEdgeContext: null,
  _onActivate: null,
  _lastTap: { id: null, t: 0 },
  layoutName: 'cose',

  setDropHandler(fn) { this._dropHandler = fn; },
  setEdgeContextHandler(fn) { this._onEdgeContext = fn; },
  setNodeActivateHandler(fn) { this._onActivate = fn; },   // double-clic sur un node

  // Layouts automatiques proposés (tous natifs Cytoscape, sans extension).
  _layoutOptions() {
    const base = { animate: false, padding: 20, fit: true };
    switch (this.layoutName) {
      case 'breadthfirst':  // hiérarchique (arbre) — lisible pour les is-a
        return { ...base, name: 'breadthfirst', directed: true, spacingFactor: 1.15 };
      case 'concentric':    // anneaux par degré (les plus connectés au centre)
        return { ...base, name: 'concentric', minNodeSpacing: 45,
                 concentric: n => n.degree(), levelWidth: () => 1 };
      case 'circle':
        return { ...base, name: 'circle' };
      case 'grid':
        return { ...base, name: 'grid' };
      default:              // force dirigée (cose) — polyvalent
        return { ...base, name: 'cose', nodeRepulsion: 8000, idealEdgeLength: 90 };
    }
  },

  applyLayout(name) {
    if (name) this.layoutName = name;
    if (this.cy) this.cy.layout(this._layoutOptions()).run();
  },

  ensure() {
    if (this.cy) return this.cy;
    this.cy = cytoscape({
      container: document.getElementById('cy'),
      style: [
        {
          selector: 'node',
          style: {
            'label': 'data(label)',
            'background-color': '#8fc0ff',
            'border-color': '#2f6fed',
            'border-width': 1,
            'color': '#1f2933',
            'font-size': 12,
            'text-valign': 'center',
            'text-halign': 'center',
            'width': 'label',
            'height': 'label',
            'padding': '10px',
            'shape': 'round-rectangle',
            'text-wrap': 'wrap',
            'text-max-width': 140,
          },
        },
        {
          selector: 'node[kind="relation"]',
          style: { 'background-color': '#ffe08a', 'border-color': '#d9a400', 'shape': 'diamond' },
        },
        {
          selector: 'node.drop-target',
          style: { 'border-width': 3, 'border-color': '#2f6fed', 'background-color': '#cfe1ff' },
        },
        {
          selector: 'edge',
          style: {
            'label': 'data(label)',
            'width': 1.5,
            'line-color': '#9aa5b1',
            'target-arrow-color': '#9aa5b1',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'font-size': 10,
            'color': '#52606d',
            'text-background-color': '#ffffff',
            'text-background-opacity': 1,
            'text-background-padding': 2,
          },
        },
      ],
      layout: { name: 'cose', animate: false, padding: 20 },
    });
    this._bindDnd();
    // Double-clic sur un node = activer (ex. ouvrir la vue graphique centrée).
    // Cytoscape n'a pas d'événement double-tap fiable → détection manuelle.
    this.cy.on('tap', 'node', e => {
      const id = e.target.id();
      const now = Date.now();
      if (this._lastTap.id === id && now - this._lastTap.t < 350) {
        this._lastTap = { id: null, t: 0 };
        if (this._onActivate) this._onActivate(id);
      } else {
        this._lastTap = { id, t: now };
      }
    });
    // Clic droit sur une arête = supprimer la relation.
    this.cy.on('cxttap', 'edge', e => {
      if (this._onEdgeContext) this._onEdgeContext(e.target.id());
    });
    const c = this.cy.container();
    if (c) c.addEventListener('contextmenu', e => e.preventDefault());
    return this.cy;
  },

  _nodeUnder(dragged) {
    const p = dragged.position();
    let hit = null;
    this.cy.nodes().forEach(n => {
      if (n.id() === dragged.id() || hit) return;
      const bb = n.boundingBox();
      if (p.x >= bb.x1 && p.x <= bb.x2 && p.y >= bb.y1 && p.y <= bb.y2) hit = n;
    });
    return hit;
  },

  _bindDnd() {
    this.cy.on('grab', 'node', e => { this._startPos = { ...e.target.position() }; this._dragged = false; });
    this.cy.on('drag', 'node', e => {
      this._dragged = true;
      this.cy.nodes().removeClass('drop-target');
      const t = this._nodeUnder(e.target);
      if (t) t.addClass('drop-target');
    });
    this.cy.on('free', 'node', e => {
      this.cy.nodes().removeClass('drop-target');
      if (!this._dragged) return;   // simple clic (pas de glisser) → pas de relation
      const dragged = e.target;
      const target = this._nodeUnder(dragged);
      const startPos = this._startPos;
      if (target && this._dropHandler) {
        this._dropHandler(
          { id: dragged.id(), label: dragged.data('raw') || dragged.data('label') },
          { id: target.id(), label: target.data('raw') || target.data('label') },
          () => dragged.position(startPos),      // restaure la position du node lâché
        );
      }
    });
  },

  render(data) {
    const cy = this.ensure();
    const els = [];
    data.nodes.forEach(n => els.push({ data: { id: n.id, label: n.label, raw: n.raw, kind: n.kind } }));
    data.edges.forEach(e => els.push({
      data: { id: e.id, source: e.source, target: e.target, label: e.label },
    }));
    cy.elements().remove();
    cy.add(els);
    cy.layout(this._layoutOptions()).run();
  },

  addEdge(rel) {
    if (!this.cy) return;
    if (this.cy.getElementById(rel.id).length) return;
    this.cy.add({ data: { id: rel.id, source: rel.source, target: rel.target, label: rel.label } });
  },

  resize() { if (this.cy) { this.cy.resize(); this.cy.fit(undefined, 30); } },
};

// Vue graphique CENTRÉE : le node courant au centre, ses voisins en périphérie.
// Un clic sur un voisin le recentre (via le handler fourni par l'app).
const CenterGraph = {
  cy: null,
  _onCenter: null,
  _dropHandler: null,
  _onEdgeContext: null,
  _startPos: null,

  setCenterHandler(fn) { this._onCenter = fn; },
  setDropHandler(fn) { this._dropHandler = fn; },
  setEdgeContextHandler(fn) { this._onEdgeContext = fn; },

  _nodeUnder(dragged) {
    const p = dragged.position();
    let hit = null;
    this.cy.nodes().forEach(n => {
      if (n.id() === dragged.id() || hit) return;
      const bb = n.boundingBox();
      if (p.x >= bb.x1 && p.x <= bb.x2 && p.y >= bb.y1 && p.y <= bb.y2) hit = n;
    });
    return hit;
  },

  ensure() {
    if (this.cy) return this.cy;
    this.cy = cytoscape({
      container: document.getElementById('cyCentered'),
      style: [
        {
          selector: 'node',
          style: {
            'label': 'data(label)',
            'background-color': '#8fc0ff',
            'border-color': '#2f6fed',
            'border-width': 1,
            'color': '#1f2933',
            'font-size': 12,
            'text-valign': 'center',
            'text-halign': 'center',
            'width': 'label',
            'height': 'label',
            'padding': '10px',
            'shape': 'round-rectangle',
            'text-wrap': 'wrap',
            'text-max-width': 140,
          },
        },
        {
          selector: 'node.center',
          style: {
            'background-color': '#2f6fed', 'color': '#fff',
            'border-color': '#1b4bbf', 'border-width': 2, 'font-weight': 'bold',
          },
        },
        { selector: 'node.peri', style: { 'cursor': 'pointer' } },
        {
          selector: 'node.drop-target',
          style: { 'border-width': 3, 'border-color': '#2f6fed', 'background-color': '#cfe1ff' },
        },
        {
          selector: 'edge',
          style: {
            'label': 'data(label)',
            'width': 1.5,
            'line-color': '#9aa5b1',
            'target-arrow-color': '#9aa5b1',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'font-size': 10,
            'color': '#52606d',
            'text-background-color': '#ffffff',
            'text-background-opacity': 1,
            'text-background-padding': 2,
          },
        },
      ],
    });
    // Clic = recentrer ; glisser sur un autre node = créer une relation.
    this.cy.on('tap', 'node', e => {
      const n = e.target;
      if (n.hasClass('center')) return;
      if (this._onCenter) this._onCenter(n.id());
    });
    this.cy.on('grab', 'node', e => { this._startPos = { ...e.target.position() }; this._dragged = false; });
    this.cy.on('drag', 'node', e => {
      this._dragged = true;
      this.cy.nodes().removeClass('drop-target');
      const t = this._nodeUnder(e.target);
      if (t) t.addClass('drop-target');
    });
    this.cy.on('free', 'node', e => {
      this.cy.nodes().removeClass('drop-target');
      if (!this._dragged) return;   // simple clic (pas de glisser) → pas de relation
      const dragged = e.target;
      const target = this._nodeUnder(dragged);
      const startPos = this._startPos;
      if (target && this._dropHandler) {
        this._dropHandler(
          { id: dragged.id(), label: dragged.data('label') },
          { id: target.id(), label: target.data('label') },
          () => dragged.position(startPos),
        );
      }
    });
    // Clic droit sur une arête = supprimer la relation.
    this.cy.on('cxttap', 'edge', e => {
      if (this._onEdgeContext) this._onEdgeContext(e.target.id());
    });
    const c = this.cy.container();
    if (c) c.addEventListener('contextmenu', e => e.preventDefault());
    return this.cy;
  },

  render(data) {
    const cy = this.ensure();
    const els = [];
    data.nodes.forEach(n => els.push({
      data: { id: n.id, label: n.label },
      position: { x: n.x, y: n.y },   // placement directionnel calculé en amont
      classes: n.center ? 'center' : 'peri',
    }));
    data.edges.forEach(e => els.push({
      data: { id: e.id, source: e.source, target: e.target, label: e.label },
    }));
    cy.elements().remove();
    cy.add(els);
    cy.layout({ name: 'preset', fit: true, padding: 40 }).run();
  },

  resize() { if (this.cy) { this.cy.resize(); this.cy.fit(undefined, 30); } },
};
