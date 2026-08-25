// Orchestration de l'IHM KeQuarks (vue repliée : ni hubs ni rôles à l'écran).
const state = {
  bases: [],
  baseId: null,
  relationTypes: [],
  nodes: [],
  relations: [],
  roles: {},
  search: '',
  centered: { current: null, history: [] },   // vue centrée
  cgDepth: 1,                                   // profondeur d'exploration du graphe centré
  graphScope: 'all',                            // Graph view : all | model | kb
  sectionFilters: {},                           // filtre par section (clé = titre)
  rules: [],
  editingRule: null,                            // règle en cours d'édition
};

const $ = sel => document.querySelector(sel);

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 2200);
}

async function guard(fn) {
  try { await fn(); }
  catch (e) { toast('⚠ ' + e.message); }
}

function activeTab() {
  const t = document.querySelector('.tab.active');
  return t ? t.dataset.tab : 'text';
}

// --- Chargement ------------------------------------------------------------
async function init() {
  state.relationTypes = await API.relationTypes();
  await refreshBases();
  bindEvents();
}

async function refreshBases() {
  state.bases = await API.bases();
  const sel = $('#baseSelect');
  sel.innerHTML = '';
  state.bases.forEach(b => {
    const o = document.createElement('option');
    o.value = b.id; o.textContent = b.name;
    sel.appendChild(o);
  });
  if (state.bases.length === 0) {
    state.baseId = null;
    renderAll();
    return;
  }
  if (!state.bases.find(b => b.id === state.baseId)) {
    state.baseId = state.bases[0].id;
  }
  sel.value = state.baseId;
  await loadBase();
}

async function loadBase() {
  if (!state.baseId) return;
  [state.nodes, state.relations, state.roles] = await Promise.all([
    API.nodes(state.baseId),
    API.relations(state.baseId),
    API.roles(state.baseId),
  ]);
  renderAll();
  if (activeTab() === 'graph') refreshGraph();
}

// --- Rendu -----------------------------------------------------------------
function renderAll() {
  renderTextView();
  if (activeTab() === 'centered') renderCentered();
  if (activeTab() === 'cgraph') renderCenteredGraph();
  if (activeTab() === 'model') renderModel();
}

function resolveNode(id) {
  return state.nodes.find(n => n.id === id) || state.relations.find(r => r.id === id) || null;
}

// --- Désambiguïsation des homonymes (labels non uniques : ex. « Orange ») ---
let _labelCounts = {};
function recomputeCounts() {
  _labelCounts = {};
  state.nodes.forEach(n => { _labelCounts[n.label] = (_labelCounts[n.label] || 0) + 1; });
}

// Discriminant d'un node : son/ses type(s) (via instanciation), sinon un court id.
function discriminant(id) {
  const types = state.relations
    .filter(r => r.target === id && r.relationType === 'rt:instanciation')
    .map(r => (state.nodes.find(n => n.id === r.source) || {}).label)
    .filter(Boolean);
  return types.length ? types.join(', ') : '#' + String(id).slice(0, 4);
}

// Ajoute dans `el` le label (police normale) + un discriminant STYLÉ À PART
// (petit, grisé) uniquement si le label est un homonyme. Ainsi le label partagé
// reste visuellement identique : on voit « le même label » + un qualificatif.
function renderNodeName(el, id, label) {
  const main = document.createElement('span');
  main.className = 'node-label';
  main.textContent = label;
  el.appendChild(main);
  if (_labelCounts[label] > 1) {
    const disc = document.createElement('span');
    disc.className = 'node-disc';
    disc.textContent = discriminant(id);
    el.appendChild(disc);
  }
}

function matchSearch(label) {
  return !state.search || label.toLowerCase().includes(state.search);
}

function renderTextView() {
  const root = $('#textView');
  root.innerHTML = '';
  recomputeCounts();
  if (!state.baseId) {
    root.innerHTML = '<p class="hint">No base. Create one with ＋.</p>';
    return;
  }
  // Construire les sections indexées par clé.
  const sections = { 'All nodes': group('All nodes', state.nodes, true) };
  Object.entries(state.roles).forEach(([role, list]) => {
    sections[role] = group(role, list, false);
  });
  // Ordre : ordre sauvegardé (filtré) puis nouvelles clés à la fin.
  const saved = loadOrder(SECTION_ORDER_KEY);
  const ordered = [];
  (saved || []).forEach(k => { if (sections[k] && !ordered.includes(k)) ordered.push(k); });
  Object.keys(sections).forEach(k => { if (!ordered.includes(k)) ordered.push(k); });
  ordered.forEach(k => {
    const el = sections[k];
    el.dataset.key = k;
    makeSectionDraggable(el, k, SECTION_ORDER_KEY, renderTextView);
    root.appendChild(el);
  });
}

// --- Réordonnancement des sections de la Vue textuelle (à la souris) --------
const SECTION_MIME = 'application/x-kq-section';
const SECTION_ORDER_KEY = 'kq.sectionOrder';        // ordre des sections — Knowledge Base
const MODEL_ORDER_KEY = 'kq.modelSectionOrder';     // ordre des sections — Model

function loadOrder(storeKey) {
  try { return JSON.parse(localStorage.getItem(storeKey) || 'null'); } catch (_) { return null; }
}
function saveOrder(storeKey, order) {
  try { localStorage.setItem(storeKey, JSON.stringify(order)); } catch (_) {}
}

// Rend une section réordonnable à la souris (par son en-tête), dans son conteneur.
function makeSectionDraggable(el, key, storeKey, rerender) {
  const header = el.querySelector('h3');
  if (!header) return;
  header.draggable = true;
  header.classList.add('sec-handle');
  header.addEventListener('dragstart', e => {
    e.dataTransfer.setData(SECTION_MIME, key);
    e.dataTransfer.effectAllowed = 'move';
    el.classList.add('sec-dragging');
  });
  header.addEventListener('dragend', () => el.classList.remove('sec-dragging'));
  el.addEventListener('dragover', e => {
    if (!e.dataTransfer.types.includes(SECTION_MIME)) return;   // ignore le drag de node
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    el.classList.add('sec-drop-hover');
  });
  el.addEventListener('dragleave', () => el.classList.remove('sec-drop-hover'));
  el.addEventListener('drop', e => {
    if (!e.dataTransfer.types.includes(SECTION_MIME)) return;
    e.preventDefault();
    el.classList.remove('sec-drop-hover');
    const dragged = e.dataTransfer.getData(SECTION_MIME);
    if (!dragged || dragged === key) return;
    const container = el.parentElement;
    const order = [...container.querySelectorAll('.role-group')].map(g => g.dataset.key).filter(k => k !== dragged);
    const idx = order.indexOf(key);
    const rect = el.getBoundingClientRect();
    const after = e.clientY > rect.top + rect.height / 2;
    order.splice(after ? idx + 1 : idx, 0, dragged);
    saveOrder(storeKey, order);
    rerender();
  });
}

// Filtre les lignes d'une section selon un texte (indépendant, sans re-render).
function applySecFilter(el, value) {
  const v = (value || '').trim().toLowerCase();
  el.querySelectorAll('.node-list > li').forEach(li => {
    if (li.classList.contains('empty')) return;
    const lbl = (li.querySelector('.node-label') || li).textContent.toLowerCase();
    li.style.display = (!v || lbl.includes(v)) ? '' : 'none';
  });
}

// --- Plier / déplier les sections (état persistant) ------------------------
const COLLAPSE_KEY = 'kq.collapsedSections';
function loadCollapsed() {
  try { return JSON.parse(localStorage.getItem(COLLAPSE_KEY) || '[]'); } catch (_) { return []; }
}
function saveCollapsed(arr) {
  try { localStorage.setItem(COLLAPSE_KEY, JSON.stringify(arr)); } catch (_) {}
}
function isCollapsed(title) { return loadCollapsed().includes(title); }
function toggleCollapse(title) {
  const set = new Set(loadCollapsed());
  if (set.has(title)) set.delete(title); else set.add(title);
  saveCollapsed([...set]);
  if (activeTab() === 'model') renderModel(); else renderTextView();
}

function group(title, list, isAll) {
  const filtered = list.filter(n => matchSearch(n.label));
  const el = document.createElement('div');
  el.className = 'role-group' + (isAll ? ' all' : '');
  const collapsed = isCollapsed(title);
  if (collapsed) el.classList.add('collapsed');
  const h = document.createElement('h3');
  h.innerHTML =
    `<span class="grp-title"><span class="caret">${collapsed ? '▸' : '▾'}</span>${escapeHtml(title)}</span>`
    + `<span class="grp-right"><span class="count">${filtered.length}</span></span>`;
  h.addEventListener('click', () => toggleCollapse(title));
  // La section « All nodes » porte le bouton de création de node.
  if (isAll) {
    const add = document.createElement('button');
    add.className = 'sec-add primary';
    add.textContent = '＋ Node';
    add.title = 'New node';
    add.addEventListener('click', e => { e.stopPropagation(); newNode(); });
    h.querySelector('.grp-right').appendChild(add);
  }
  el.appendChild(h);
  // Filtre propre à la section (indépendant, sans re-render).
  const finput = document.createElement('input');
  finput.type = 'search';
  finput.className = 'sec-filter';
  finput.placeholder = 'Filter…';
  finput.value = state.sectionFilters[title] || '';
  finput.addEventListener('click', e => e.stopPropagation());
  finput.addEventListener('input', e => {
    state.sectionFilters[title] = e.target.value;
    applySecFilter(el, e.target.value);
  });
  el.appendChild(finput);
  const ul = document.createElement('ul');
  ul.className = 'node-list';
  if (filtered.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = '—';
    ul.appendChild(li);
  } else {
    filtered.forEach(n => ul.appendChild(nodeRow(n, isAll)));
  }
  el.appendChild(ul);
  applySecFilter(el, state.sectionFilters[title] || '');
  return el;
}

const KQ_MIME = 'application/x-kq-node';

// Rend n'importe quel élément « source » ET « cible » de glisser-déposer de relation.
// getNode() renvoie { id, label } au moment de l'action.
function enableRelationDnD(el, getNode) {
  el.draggable = true;
  el.addEventListener('dragstart', e => {
    const n = getNode();
    e.dataTransfer.setData(KQ_MIME, JSON.stringify({ id: n.id, label: n.label }));
    e.dataTransfer.effectAllowed = 'link';
    e.stopPropagation();
    el.classList.add('dragging');
  });
  el.addEventListener('dragend', () => el.classList.remove('dragging'));
  el.addEventListener('dragover', e => {
    if (!e.dataTransfer.types.includes(KQ_MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'link';
    el.classList.add('drop-hover');
  });
  el.addEventListener('dragleave', () => el.classList.remove('drop-hover'));
  el.addEventListener('drop', e => {
    e.preventDefault();
    e.stopPropagation();
    el.classList.remove('drop-hover');
    let src;
    try { src = JSON.parse(e.dataTransfer.getData(KQ_MIME)); } catch (_) { return; }
    const n = getNode();
    if (!src || src.id === n.id) return;
    handleTextDrop(src, { id: n.id, label: n.label });
  });
}

function nodeRow(n, editable) {
  const li = document.createElement('li');
  li.draggable = true;
  li.dataset.id = n.id;

  li.addEventListener('dragstart', e => {
    e.dataTransfer.setData(KQ_MIME, JSON.stringify({ id: n.id, label: n.label }));
    e.dataTransfer.effectAllowed = 'link';
    li.classList.add('dragging');
  });
  li.addEventListener('dragend', () => li.classList.remove('dragging'));
  li.addEventListener('dragover', e => {
    if (!e.dataTransfer.types.includes(KQ_MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'link';
    li.classList.add('drop-hover');
  });
  li.addEventListener('dragleave', () => li.classList.remove('drop-hover'));
  li.addEventListener('drop', e => {
    e.preventDefault();
    li.classList.remove('drop-hover');
    let src;
    try { src = JSON.parse(e.dataTransfer.getData(KQ_MIME)); } catch (_) { return; }
    if (!src || src.id === n.id) return;
    handleTextDrop(src, { id: n.id, label: n.label });
  });

  const name = document.createElement('span');
  name.className = 'node-name link';
  name.title = 'Open in centered view';
  name.onclick = () => openCentered(n.id);
  renderNodeName(name, n.id, n.label);
  li.appendChild(name);

  if (editable) {
    const actions = document.createElement('span');
    actions.className = 'actions';
    const ren = document.createElement('button');
    ren.textContent = '✎'; ren.title = 'Rename';
    ren.onclick = () => renameNode(n);
    const del = document.createElement('button');
    del.textContent = '🗑'; del.title = 'Delete';
    del.onclick = () => removeNode(n);
    actions.append(ren, del);
    li.appendChild(actions);
  }
  return li;
}

// Restreint le graphe selon la portée choisie (all | model | kb).
//
// Principe : la SEULE preuve du statut d'un node est la relation d'instanciation.
//  - model : node PROUVÉ type     = source (côté type) d'au moins une instanciation
//            → rôle dérivé « type ».
//  - kb    : node PROUVÉ individu  = cible (côté individu) d'au moins une instanciation
//            → rôle dérivé « individual ».
// Aucune exception : sans preuve, un node n'apparaît dans aucun des deux (seulement
// dans « all »). Un node peut être les deux (ex. « Personne » : instance de
// « EA Concept » ET type de « Bernard Chabot ») → il figure alors dans les deux.
function filterGraphByScope(data, scope) {
  if (scope !== 'model' && scope !== 'kb') return data;
  const roleLabel = scope === 'model' ? 'type' : 'individual';
  const ids = new Set((state.roles[roleLabel] || []).map(n => n.id));
  const nodes = data.nodes.filter(n => ids.has(n.id));
  const edges = data.edges.filter(e => ids.has(e.source) && ids.has(e.target));
  return { nodes, edges };
}

function refreshGraph() {
  guard(async () => {
    const data = await API.graph(state.baseId);
    Graph.render(filterGraphByScope(data, state.graphScope));
    Graph.resize();
  });
}

// --- Vue centrée : un seul node + ses relations + historique (max 50) -------
const HISTORY_MAX = 50;

function setCentered(id) {
  const c = state.centered;
  if (c.current && c.current !== id) {
    c.history = c.history.filter(h => h !== c.current);
    c.history.unshift(c.current);
    if (c.history.length > HISTORY_MAX) c.history.length = HISTORY_MAX;
  }
  c.current = id;
}

function openCentered(id) {
  setCentered(id);
  switchTab('centered');
}

function openCenteredGraph(id) {
  setCentered(id);
  switchTab('cgraph');
}

function nodeNameLink(id) {
  const span = document.createElement('span');
  span.className = 'node-name link';
  const obj = resolveNode(id);
  if (obj) renderNodeName(span, id, obj.label); else span.textContent = id;
  span.onclick = () => { setCentered(id); renderCentered(); };
  return span;   // le glisser-déposer est porté par la ligne <li> parente
}

function relationsBlock(title, rels, otherKey) {
  const box = document.createElement('div');
  box.className = 'rel-block';
  const t = document.createElement('h4');
  t.textContent = `${title} (${rels.length})`;
  box.appendChild(t);
  if (!rels.length) {
    const p = document.createElement('p');
    p.className = 'hint'; p.textContent = '—';
    box.appendChild(p);
    return box;
  }
  const ul = document.createElement('ul');
  ul.className = 'rel-list';
  rels.forEach(r => {
    const otherId = otherKey === 'target' ? r.target : r.source;
    const li = document.createElement('li');
    const type = document.createElement('span');
    type.className = 'rel-type';
    type.textContent = (otherKey === 'target' ? '→ ' : '← ') + relationTypeLabel(r.relationType);
    if (otherKey === 'target') {           // relation sortante : type puis cible
      li.appendChild(type);
      li.appendChild(nodeNameLink(r.target));
    } else {                               // relation entrante : source puis type
      li.appendChild(nodeNameLink(r.source));
      li.appendChild(type);
    }
    enableRelationDnD(li, () => ({ id: otherId, label: (resolveNode(otherId) || {}).label || otherId }));
    li.title = 'Right-click to delete this relation';
    li.addEventListener('contextmenu', e => {
      e.preventDefault();
      removeRelation(r.id, relationReadable(r));
    });
    ul.appendChild(li);
  });
  box.appendChild(ul);
  return box;
}

function historyBlock() {
  const box = document.createElement('div');
  box.className = 'rel-block history';
  const t = document.createElement('h4');
  t.textContent = `History (${state.centered.history.length}/${HISTORY_MAX})`;
  box.appendChild(t);
  if (!state.centered.history.length) {
    const p = document.createElement('p');
    p.className = 'hint'; p.textContent = 'No node visited yet.';
    box.appendChild(p);
    return box;
  }
  const ul = document.createElement('ul');
  ul.className = 'rel-list';
  state.centered.history.forEach(id => {
    const li = document.createElement('li');
    li.appendChild(nodeNameLink(id));
    enableRelationDnD(li, () => ({ id, label: (resolveNode(id) || {}).label || id }));
    ul.appendChild(li);
  });
  box.appendChild(ul);
  return box;
}

function renderCentered() {
  const root = $('#centeredView');
  root.innerHTML = '';
  recomputeCounts();
  if (!state.baseId) { root.innerHTML = '<p class="hint">No base.</p>'; return; }

  const c = state.centered;
  const layout = document.createElement('div');
  layout.className = 'centered-layout';

  const main = document.createElement('div');
  main.className = 'centered-main';
  if (!c.current || !state.nodes.find(n => n.id === c.current)) {
    c.current = null;
    main.innerHTML = '';
  } else {
    const node = state.nodes.find(n => n.id === c.current);
    const card = document.createElement('div');
    card.className = 'centered-card';
    const title = document.createElement('div');
    title.className = 'centered-title';
    renderNodeName(title, node.id, node.label);
    enableRelationDnD(title, () => ({ id: node.id, label: node.label }));
    card.appendChild(title);
    card.appendChild(relationsBlock('Outgoing relations', state.relations.filter(r => r.source === node.id), 'target'));
    card.appendChild(relationsBlock('Incoming relations', state.relations.filter(r => r.target === node.id), 'source'));
    main.appendChild(card);
  }
  layout.appendChild(main);

  const aside = document.createElement('div');
  aside.className = 'centered-aside';
  aside.appendChild(historyBlock());
  layout.appendChild(aside);

  root.appendChild(layout);
}

// --- Vue GRAPHIQUE centrée : centre = node courant, périphérie = voisins ----
// Synchronisée avec la vue textuelle centrée (même state.centered.current).
// Direction (vecteur écran, y vers le bas) vers laquelle pointe chaque type de
// relation. Le node central est à l'origine ; l'autre node est placé dans cette
// direction (ou à l'opposé si le central est la cible, pour garder le sens).
const REL_DIRECTION = {
  'rt:instanciation':        { x: 0,  y: 1 },    // source=type → cible=individual ; garde le type au Nord
  'rt:caracterisation-type': { x: 1,  y: 0 },    // Est
  'rt:caracterisation':      { x: 1,  y: 0 },    // Est
  'rt:subsomption':          { x: 1,  y: 0 },    // Est
  'rt:representation-type':  { x: -1, y: 0 },    // Ouest
  'rt:representation':       { x: -1, y: 0 },    // Ouest
};
const CG_RADIUS = 175;   // distance centre → périphérie
const CG_SPACING = 95;   // écart perpendiculaire entre nodes d'une même direction

// Exploration en largeur (BFS) jusqu'à `depth` niveaux depuis le node central.
// Placement directionnel récursif : chaque enfant est posé à partir de son parent
// dans la direction de sa relation, étalé perpendiculairement pour ne pas se superposer.
function centeredGraphData(depth) {
  depth = Math.max(1, depth || 1);
  const cid = state.centered.current;
  const labelOf = id => (resolveNode(id) || {}).label || id;
  const placed = new Map();                    // id -> node {x, y}
  const center = { id: cid, label: labelOf(cid), center: true, x: 0, y: 0 };
  placed.set(cid, center);
  const nodes = [center];
  const edges = [];
  const edgeSeen = new Set();

  const pushEdge = r => {
    if (edgeSeen.has(r.id)) return;
    edgeSeen.add(r.id);
    edges.push({ id: r.id, source: r.source, target: r.target, label: relationTypeLabel(r.relationType) });
  };

  let frontier = [cid];
  for (let lvl = 1; lvl <= depth && frontier.length; lvl++) {
    const next = [];
    frontier.forEach(pid => {
      const pPos = placed.get(pid);
      const groups = {};                       // dirKey -> [{other, dir, r}]
      state.relations.forEach(r => {
        let other = null, dir = null;
        const base = REL_DIRECTION[r.relationType] || { x: 1, y: 1 };
        if (r.source === pid) { other = r.target; dir = { x: base.x, y: base.y }; }
        else if (r.target === pid) { other = r.source; dir = { x: -base.x, y: -base.y }; }
        else return;
        pushEdge(r);
        if (placed.has(other)) return;         // déjà placé : on garde juste l'arête
        const key = `${dir.x},${dir.y}`;
        (groups[key] = groups[key] || []).push({ other, dir, r });
      });
      Object.values(groups).forEach(group => {
        const d = group[0].dir;
        const perp = { x: -d.y, y: d.x };
        const k = group.length;
        group.forEach((item, i) => {
          if (placed.has(item.other)) return;
          const offset = (i - (k - 1) / 2) * CG_SPACING;
          const node = {
            id: item.other, label: labelOf(item.other), center: false,
            x: pPos.x + CG_RADIUS * d.x + offset * perp.x,
            y: pPos.y + CG_RADIUS * d.y + offset * perp.y,
          };
          placed.set(item.other, node);
          nodes.push(node);
          next.push(item.other);
        });
      });
    });
    frontier = next;
  }
  return { nodes, edges };
}

function renderCenteredGraph() {
  const hint = $('#cgraphHint');
  if (!state.centered.current || !resolveNode(state.centered.current)) {
    if (hint) hint.textContent = '';
    if (CenterGraph.cy) CenterGraph.cy.elements().remove();
    return;
  }
  if (hint) hint.textContent = '';
  CenterGraph.render(centeredGraphData(state.cgDepth));
  CenterGraph.resize();
}

// --- Onglet Règles : capture des règles « SI … ALORS … » -------------------
function atomText(a) {
  return `${a.subject || '?'} —${relationTypeLabel(a.relationType)}→ ${a.object || '?'}`;
}
function ruleText(rule) {
  return {
    si: (rule.premises || []).map(atomText).join(' AND ') || '…',
    alors: (rule.conclusions || []).map(atomText).join(' AND ') || '…',
  };
}
function emptyAtom() {
  return { subject: '', relationType: (state.relationTypes[0] || {}).id || '', object: '' };
}
function escapeHtml(s) {
  const d = document.createElement('div'); d.textContent = s; return d.innerHTML;
}

async function renderRules() {
  const root = $('#rulesView');
  if (!state.baseId) { root.innerHTML = '<p class="hint">No base.</p>'; return; }
  if (state.editingRule) { renderRuleEditor(root); return; }
  root.innerHTML = '';
  const bar = document.createElement('div');
  bar.className = 'row';
  const add = document.createElement('button');
  add.className = 'primary';
  add.textContent = '＋ New rule';
  add.onclick = newRule;
  bar.appendChild(add);
  root.appendChild(bar);

  try { state.rules = await API.rules(state.baseId); } catch (e) { toast('⚠ ' + e.message); return; }
  if (!state.rules.length) {
    const p = document.createElement('p');
    p.className = 'hint';
    p.textContent = 'No rule. Create one with “＋ New rule”.';
    root.appendChild(p);
    return;
  }
  state.rules.forEach(rule => root.appendChild(ruleCard(rule)));
}

function ruleCard(rule) {
  const { si, alors } = ruleText(rule);
  const el = document.createElement('div');
  el.className = 'rule-card';
  const head = document.createElement('div');
  head.className = 'rule-head';
  const title = document.createElement('strong');
  title.textContent = rule.name;
  const actions = document.createElement('span');
  actions.className = 'actions';
  const ed = document.createElement('button'); ed.textContent = '✎'; ed.title = 'Edit';
  ed.onclick = () => editRule(rule);
  const del = document.createElement('button'); del.textContent = '🗑'; del.title = 'Delete';
  del.onclick = () => removeRule(rule);
  actions.append(ed, del);
  head.append(title, actions);
  el.appendChild(head);
  const body = document.createElement('div');
  body.className = 'rule-body';
  body.innerHTML = `<span class="kw">IF</span> ${escapeHtml(si)} <span class="kw">THEN</span> ${escapeHtml(alors)}`;
  el.appendChild(body);
  return el;
}

function newRule() {
  state.editingRule = { name: '', premises: [emptyAtom()], conclusions: [emptyAtom()] };
  renderRules();
}
function editRule(rule) {
  state.editingRule = {
    id: rule.id, name: rule.name,
    premises: rule.premises.map(a => ({ ...a })),
    conclusions: rule.conclusions.map(a => ({ ...a })),
  };
  renderRules();
}

function renderRuleEditor(root) {
  const r = state.editingRule;
  root.innerHTML = '';
  const card = document.createElement('div');
  card.className = 'rule-editor';

  const nameRow = document.createElement('div');
  nameRow.className = 'row';
  const lbl = document.createElement('label'); lbl.textContent = 'Name:';
  const nameInput = document.createElement('input');
  nameInput.type = 'text'; nameInput.value = r.name; nameInput.placeholder = 'Rule name';
  nameInput.oninput = e => { r.name = e.target.value; };
  nameRow.append(lbl, nameInput);
  card.appendChild(nameRow);

  card.appendChild(atomSection('IF', r.premises));
  card.appendChild(atomSection('THEN', r.conclusions));

  const actions = document.createElement('div');
  actions.className = 'row rule-actions';
  const save = document.createElement('button'); save.className = 'primary'; save.textContent = 'Save';
  save.onclick = saveRule;
  const cancel = document.createElement('button'); cancel.textContent = 'Cancel';
  cancel.onclick = () => { state.editingRule = null; renderRules(); };
  actions.append(save, cancel);
  card.appendChild(actions);

  root.appendChild(card);
}

function atomSection(kw, atoms) {
  const sec = document.createElement('div');
  sec.className = 'atom-section';
  const h = document.createElement('h4');
  h.innerHTML = `<span class="kw">${kw}</span> <span class="hint">(atoms joined by AND)</span>`;
  sec.appendChild(h);
  const list = document.createElement('div');
  list.className = 'atom-list';
  atoms.forEach((a, i) => list.appendChild(atomRow(a, atoms, i)));
  sec.appendChild(list);
  const add = document.createElement('button');
  add.className = 'add-atom';
  add.textContent = '＋ Add an atom';
  add.onclick = () => { atoms.push(emptyAtom()); renderRules(); };
  sec.appendChild(add);
  return sec;
}

function atomRow(a, atoms, i) {
  const row = document.createElement('div');
  row.className = 'atom-row';
  const subj = document.createElement('input');
  subj.type = 'text'; subj.value = a.subject; subj.placeholder = 'variable'; subj.className = 'var';
  subj.oninput = e => { a.subject = e.target.value; };
  const sel = document.createElement('select');
  state.relationTypes.forEach(t => {
    const o = document.createElement('option'); o.value = t.id; o.textContent = t.label;
    if (t.id === a.relationType) o.selected = true;
    sel.appendChild(o);
  });
  sel.onchange = e => { a.relationType = e.target.value; };
  const obj = document.createElement('input');
  obj.type = 'text'; obj.value = a.object; obj.placeholder = 'variable'; obj.className = 'var';
  obj.oninput = e => { a.object = e.target.value; };
  const del = document.createElement('button'); del.textContent = '✕'; del.title = 'Remove';
  del.onclick = () => { atoms.splice(i, 1); if (!atoms.length) atoms.push(emptyAtom()); renderRules(); };
  row.append(subj, sel, obj, del);
  return row;
}

function saveRule() {
  const r = state.editingRule;
  if (!r.name.trim()) { toast('Name the rule'); return; }
  const clean = list => list
    .filter(a => a.subject.trim() && a.object.trim())
    .map(a => ({ subject: a.subject.trim(), relationType: a.relationType, object: a.object.trim() }));
  const body = { name: r.name.trim(), premises: clean(r.premises), conclusions: clean(r.conclusions) };
  if (!body.premises.length || !body.conclusions.length) {
    toast('Provide at least one IF atom and one THEN atom (non-empty variables)');
    return;
  }
  guard(async () => {
    if (r.id) await API.updateRule(state.baseId, r.id, body);
    else await API.addRule(state.baseId, body);
    state.editingRule = null;
    await renderRules();
    toast('Rule saved');
  });
}

function removeRule(rule) {
  if (!confirm(`Delete rule “${rule.name}”?`)) return;
  guard(async () => { await API.deleteRule(state.baseId, rule.id); await renderRules(); toast('Rule deleted'); });
}

// --- Glisser-déposer → modale de création de relation ----------------------
const PHRASE = {
  'rt:instanciation':        (s, t) => `${t} is a ${s}`,
  'rt:subsomption':          (s, t) => `${t} specializes ${s}`,
  'rt:caracterisation-type': (s, t) => `${s} is characterized by ${t}`,
  'rt:caracterisation':      (s, t) => `${s} is characterized by ${t}`,
  'rt:representation-type':  (s, t) => `${s} is represented by ${t}`,
  'rt:representation':       (s, t) => `${s} is represented by ${t}`,
};

function relationTypeLabel(id) {
  const t = state.relationTypes.find(x => x.id === id);
  return t ? t.label : id;
}

// Rafraîchit les données après création de relation (sans re-layout du graphe).
async function afterRelationChange() {
  [state.nodes, state.relations, state.roles] = await Promise.all([
    API.nodes(state.baseId), API.relations(state.baseId), API.roles(state.baseId),
  ]);
  renderTextView();
  if (activeTab() === 'centered') renderCentered();
  if (activeTab() === 'cgraph') renderCenteredGraph();
  if (activeTab() === 'model') renderModel();
}

// a = node lâché (source par défaut), b = node cible. restore() = optionnel (graphe).
// liveAdd = ajouter l'arête au graphe sans re-layout.
function openRelationDialog(a, b, restore, liveAdd) {
  recomputeCounts();
  const aName = displayText(a.id, a.label);
  const bName = displayText(b.id, b.label);
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <h3>Relation between “${aName}” and “${bName}”</h3>
    <p class="step">1. Relation type</p>
    <div class="type-choices"></div>
    <div class="dir-step" hidden>
      <p class="step">2. Direction</p>
      <div class="dir-choices"></div>
    </div>
    <div class="modal-actions"><button class="cancel">Cancel</button></div>`;
  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);

  const close = (didCreate) => {
    if (!didCreate && restore) restore();
    backdrop.remove();
  };
  backdrop.addEventListener('click', e => { if (e.target === backdrop) close(false); });
  modal.querySelector('.cancel').onclick = () => close(false);

  const typeBox = modal.querySelector('.type-choices');
  const dirStep = modal.querySelector('.dir-step');
  const dirBox = modal.querySelector('.dir-choices');

  state.relationTypes.forEach(t => {
    const btn = document.createElement('button');
    btn.textContent = t.label;
    btn.className = 'choice';
    btn.onclick = () => {
      typeBox.querySelectorAll('button').forEach(x => x.classList.remove('active'));
      btn.classList.add('active');
      renderDirections(t.id);
    };
    typeBox.appendChild(btn);
  });

  function renderDirections(typeId) {
    const phrase = PHRASE[typeId] || ((s, t) => `${s} → ${t}`);
    const options = [
      { text: phrase(aName, bName), source: a.id, target: b.id },
      { text: phrase(bName, aName), source: b.id, target: a.id },
    ];
    dirBox.innerHTML = '';
    options.forEach(op => {
      const btn = document.createElement('button');
      btn.className = 'choice dir';
      btn.textContent = op.text;
      btn.onclick = () => create(typeId, op.source, op.target);
      dirBox.appendChild(btn);
    });
    dirStep.hidden = false;
  }

  function create(typeId, source, target) {
    guard(async () => {
      const rel = await API.addRelation(state.baseId, { relationType: typeId, source, target });
      if (liveAdd) {
        Graph.addEdge({
          id: rel.id, source: rel.source, target: rel.target,
          label: relationTypeLabel(rel.relationType),
        });
        if (restore) restore();
      }
      await afterRelationChange();
      close(true);
      toast('Relation created');
    });
  }
}

// Version texte de la désambiguïsation (pour la modale).
function displayText(id, label) {
  return _labelCounts[label] > 1 ? `${label} (${discriminant(id)})` : label;
}

// Handlers de drop pour chaque vue.
function handleGraphDrop(a, b, restore) { openRelationDialog(a, b, restore, true); }
function handleCenterGraphDrop(a, b, restore) { openRelationDialog(a, b, restore, false); }
function handleTextDrop(a, b) { openRelationDialog(a, b, null, false); }

// --- Actions ---------------------------------------------------------------
function newBase() {
  const name = prompt('New base name:');
  if (!name) return;
  guard(async () => {
    const b = await API.createBase(name.trim());
    state.baseId = b.id;
    state.centered = { current: null, history: [] };
    await refreshBases();
    toast('Base created');
  });
}

function renameBase() {
  if (!state.baseId) return;
  const cur = state.bases.find(b => b.id === state.baseId);
  const name = prompt('New name:', cur ? cur.name : '');
  if (!name) return;
  guard(async () => { await API.renameBase(state.baseId, name.trim()); await refreshBases(); });
}

function deleteBase() {
  if (!state.baseId) return;
  const cur = state.bases.find(b => b.id === state.baseId);
  if (!confirm(`Delete base “${cur ? cur.name : ""}”?`)) return;
  guard(async () => {
    await API.deleteBase(state.baseId);
    state.baseId = null;
    state.centered = { current: null, history: [] };
    await refreshBases();
    toast('Base deleted');
  });
}

function newNode() {
  if (!state.baseId) { toast('Create a base first'); return; }
  const label = prompt('Node label:');
  if (!label) return;
  guard(async () => { await API.addNode(state.baseId, label.trim()); await loadBase(); });
}

function renameNode(n) {
  const label = prompt('New label:', n.label);
  if (!label) return;
  guard(async () => { await API.renameNode(state.baseId, n.id, label.trim()); await loadBase(); });
}

function removeNode(n) {
  if (!confirm(`Delete “${n.label}”? (relations using it will be removed)`)) return;
  guard(async () => { await API.deleteNode(state.baseId, n.id); await loadBase(); });
}

// --- Suppression de relation (clic droit) ----------------------------------
function relationReadable(r) {
  const s = (resolveNode(r.source) || {}).label || r.source;
  const t = (resolveNode(r.target) || {}).label || r.target;
  return `${s} —${relationTypeLabel(r.relationType)}→ ${t}`;
}

function removeRelation(relId, readable) {
  if (!confirm(`Delete relation “${readable}”?`)) return;
  guard(async () => {
    await API.deleteRelation(state.baseId, relId);
    await afterRelationChange();
    if (activeTab() === 'graph') refreshGraph();
    toast('Relation deleted');
  });
}

// Handler commun pour le clic droit sur une arête (les deux graphes).
function onEdgeContext(relId) {
  const r = state.relations.find(x => x.id === relId);
  removeRelation(relId, r ? relationReadable(r) : relId);
}

// --- Onglets ---------------------------------------------------------------
function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.tabpane').forEach(p => p.classList.remove('active'));
  const pane = $('#tab-' + name);
  if (pane) pane.classList.add('active');
  if (name === 'graph') refreshGraph();
  if (name === 'centered') renderCentered();
  if (name === 'cgraph') renderCenteredGraph();
  if (name === 'rules') renderRules();
  if (name === 'model') renderModel();
  if (name === 'meta') renderMetaModel();
}

// --- Onglet Model : les types, classés par le rôle qu'ils jouent aussi ------
function renderModel() {
  const root = $('#modelView');
  root.innerHTML = '';
  if (!state.baseId) { root.innerHTML = '<p class="hint">No base.</p>'; return; }
  recomputeCounts();
  const types = state.roles['type'] || [];
  const idSet = label => new Set((state.roles[label] || []).map(x => x.id));
  const subj = idSet('subject'), obj = idSet('object'), cer = idSet('characterizer');

  const intro = document.createElement('p');
  intro.className = 'hint';
  intro.textContent = 'Model level — the type nodes, grouped by the role they also play.';
  root.appendChild(intro);

  const sections = {
    'topic type': group('topic type', types, false),
    'subject type': group('subject type', types.filter(n => subj.has(n.id)), false),
    'object type': group('object type', types.filter(n => obj.has(n.id)), false),
    'characterizer type': group('characterizer type', types.filter(n => cer.has(n.id)), false),
  };
  const saved = loadOrder(MODEL_ORDER_KEY);
  const ordered = [];
  (saved || []).forEach(k => { if (sections[k] && !ordered.includes(k)) ordered.push(k); });
  Object.keys(sections).forEach(k => { if (!ordered.includes(k)) ordered.push(k); });
  ordered.forEach(k => {
    const el = sections[k];
    el.dataset.key = k;
    makeSectionDraggable(el, k, MODEL_ORDER_KEY, renderModel);
    root.appendChild(el);
  });
}

// --- Onglet Meta-Model : liste des concepts fondateurs (lecture) -----------
async function renderMetaModel() {
  const root = $('#metaView');
  root.innerHTML = '';
  let meta;
  try { meta = await API.metaModel(); } catch (e) { toast('⚠ ' + e.message); return; }

  const intro = document.createElement('p');
  intro.className = 'hint';
  intro.textContent = 'Founding catalogue (level 0): every base is built on these relations and roles. '
    + 'They are reified nodes, kept hidden from the other views.';
  root.appendChild(intro);

  const relSec = document.createElement('div');
  relSec.className = 'meta-section';
  const relH = document.createElement('h3');
  relH.textContent = `Relation types (${meta.relations.length})`;
  relSec.appendChild(relH);
  const table = document.createElement('table');
  table.className = 'meta-table';
  table.innerHTML = '<thead><tr><th>Relation</th><th>source role</th><th></th><th>target role</th></tr></thead>';
  const tbody = document.createElement('tbody');
  meta.relations.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><strong>${escapeHtml(r.label)}</strong></td>`
      + `<td>${escapeHtml(r.sourceRole)}</td><td class="arrow">→</td><td>${escapeHtml(r.targetRole)}</td>`;
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  relSec.appendChild(table);
  root.appendChild(relSec);

  const roleSec = document.createElement('div');
  roleSec.className = 'meta-section';
  const roleH = document.createElement('h3');
  roleH.textContent = `Roles (${meta.roles.length})`;
  roleSec.appendChild(roleH);
  const ul = document.createElement('ul');
  ul.className = 'meta-roles';
  meta.roles.forEach(role => {
    const li = document.createElement('li');
    li.textContent = role.label;
    ul.appendChild(li);
  });
  roleSec.appendChild(ul);
  root.appendChild(roleSec);

  const note = document.createElement('p');
  note.className = 'hint';
  note.innerHTML = '✎ Editing the meta-model (user-defined relation types &amp; roles) — <em>coming soon</em>.';
  root.appendChild(note);
}

// --- Réordonnancement des onglets à la souris ------------------------------
const TAB_ORDER_KEY = 'kq.tabOrder';
const TAB_MIME = 'application/x-kq-tab';

function applySavedTabOrder() {
  const nav = document.querySelector('.tabs');
  let order = null;
  try { order = JSON.parse(localStorage.getItem(TAB_ORDER_KEY) || 'null'); } catch (_) {}
  if (!Array.isArray(order)) return;
  order.forEach(name => {
    const tab = nav.querySelector(`.tab[data-tab="${name}"]`);
    if (tab) nav.appendChild(tab);   // ré-ordonne selon l'ordre sauvegardé
  });
}

function saveTabOrder() {
  const order = [...document.querySelectorAll('.tabs .tab')].map(t => t.dataset.tab);
  try { localStorage.setItem(TAB_ORDER_KEY, JSON.stringify(order)); } catch (_) {}
}

function makeTabsSortable() {
  const nav = document.querySelector('.tabs');
  nav.querySelectorAll('.tab').forEach(tab => {
    tab.draggable = true;
    tab.addEventListener('dragstart', e => {
      e.dataTransfer.setData(TAB_MIME, tab.dataset.tab);
      e.dataTransfer.effectAllowed = 'move';
      tab.classList.add('tab-dragging');
    });
    tab.addEventListener('dragend', () => tab.classList.remove('tab-dragging'));
    tab.addEventListener('dragover', e => {
      if (!e.dataTransfer.types.includes(TAB_MIME)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });
    tab.addEventListener('drop', e => {
      if (!e.dataTransfer.types.includes(TAB_MIME)) return;
      e.preventDefault();
      const name = e.dataTransfer.getData(TAB_MIME);
      if (!name || name === tab.dataset.tab) return;
      const dragged = nav.querySelector(`.tab[data-tab="${name}"]`);
      const rect = tab.getBoundingClientRect();
      const after = e.clientX > rect.left + rect.width / 2;
      nav.insertBefore(dragged, after ? tab.nextSibling : tab);
      saveTabOrder();
    });
  });
}

// --- Layout automatique de la Vue graphique --------------------------------
const GRAPH_LAYOUT_KEY = 'kq.graphLayout';

function restoreGraphLayout() {
  let saved = null;
  try { saved = localStorage.getItem(GRAPH_LAYOUT_KEY); } catch (_) {}
  if (saved) {
    Graph.layoutName = saved;
    const sel = $('#graphLayout');
    if (sel) sel.value = saved;
  }
}

function setGraphLayout(name) {
  try { localStorage.setItem(GRAPH_LAYOUT_KEY, name); } catch (_) {}
  Graph.applyLayout(name);
}

const GRAPH_SCOPE_KEY = 'kq.graphScope';

function restoreGraphScope() {
  let saved = null;
  try { saved = localStorage.getItem(GRAPH_SCOPE_KEY); } catch (_) {}
  if (saved) {
    state.graphScope = saved;
    const sel = $('#graphScope');
    if (sel) sel.value = saved;
  }
}

function setGraphScope(scope) {
  state.graphScope = scope;
  try { localStorage.setItem(GRAPH_SCOPE_KEY, scope); } catch (_) {}
  refreshGraph();
}

// --- Événements ------------------------------------------------------------
function bindEvents() {
  Graph.setDropHandler(handleGraphDrop);
  Graph.setEdgeContextHandler(onEdgeContext);
  Graph.setNodeActivateHandler(openCenteredGraph);   // double-clic → vue graphique centrée
  CenterGraph.setCenterHandler(id => { setCentered(id); renderCenteredGraph(); });
  CenterGraph.setDropHandler(handleCenterGraphDrop);
  CenterGraph.setEdgeContextHandler(onEdgeContext);
  $('#baseSelect').onchange = e => {
    state.baseId = e.target.value;
    state.centered = { current: null, history: [] };
    state.editingRule = null;
    loadBase();
  };
  $('#newBaseBtn').onclick = newBase;
  $('#renameBaseBtn').onclick = renameBase;
  $('#deleteBaseBtn').onclick = deleteBase;
  $('#searchInput').oninput = e => {
    state.search = e.target.value.trim().toLowerCase();
    if (activeTab() === 'model') renderModel(); else renderTextView();
  };
  $('#graphLayout').onchange = e => setGraphLayout(e.target.value);
  $('#graphRelayout').onclick = () => Graph.applyLayout();
  $('#graphScope').onchange = e => setGraphScope(e.target.value);
  $('#cgDepth').onchange = e => { state.cgDepth = parseInt(e.target.value, 10) || 1; renderCenteredGraph(); };
  document.querySelectorAll('.tab').forEach(tab => {
    tab.onclick = () => switchTab(tab.dataset.tab);
  });
  applySavedTabOrder();
  makeTabsSortable();
  restoreGraphLayout();
  restoreGraphScope();
}

window.addEventListener('DOMContentLoaded', () => guard(init));
