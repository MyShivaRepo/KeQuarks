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
    .filter(r => r.source === id && r.relationType === 'rt:instanciation')
    .map(r => (state.nodes.find(n => n.id === r.target) || {}).label)
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
    root.innerHTML = '<p class="hint">Aucune base. Créez-en une avec ＋.</p>';
    return;
  }
  // Construire les sections indexées par clé.
  const sections = { 'Tous les nodes': group('Tous les nodes', state.nodes, true) };
  Object.entries(state.roles).forEach(([role, list]) => {
    sections[role] = group(role, list, false);
  });
  // Ordre : ordre sauvegardé (filtré) puis nouvelles clés à la fin.
  const saved = loadSectionOrder();
  const ordered = [];
  (saved || []).forEach(k => { if (sections[k] && !ordered.includes(k)) ordered.push(k); });
  Object.keys(sections).forEach(k => { if (!ordered.includes(k)) ordered.push(k); });
  ordered.forEach(k => {
    const el = sections[k];
    el.dataset.key = k;
    makeSectionDraggable(el, k);
    root.appendChild(el);
  });
}

// --- Réordonnancement des sections de la Vue textuelle (à la souris) --------
const SECTION_MIME = 'application/x-kq-section';
const SECTION_ORDER_KEY = 'kq.sectionOrder';

function loadSectionOrder() {
  try { return JSON.parse(localStorage.getItem(SECTION_ORDER_KEY) || 'null'); } catch (_) { return null; }
}
function saveSectionOrder(order) {
  try { localStorage.setItem(SECTION_ORDER_KEY, JSON.stringify(order)); } catch (_) {}
}
function currentSectionKeys() {
  return [...document.querySelectorAll('#textView .role-group')].map(g => g.dataset.key);
}

function makeSectionDraggable(el, key) {
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
    const order = currentSectionKeys().filter(k => k !== dragged);
    const idx = order.indexOf(key);
    const rect = el.getBoundingClientRect();
    const after = e.clientY > rect.top + rect.height / 2;
    order.splice(after ? idx + 1 : idx, 0, dragged);
    saveSectionOrder(order);
    renderTextView();
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
  renderTextView();
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
    + `<span class="count">${filtered.length}</span>`;
  h.addEventListener('click', () => toggleCollapse(title));
  el.appendChild(h);
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
  name.title = 'Ouvrir dans la vue centrée';
  name.onclick = () => openCentered(n.id);
  renderNodeName(name, n.id, n.label);
  li.appendChild(name);

  if (editable) {
    const actions = document.createElement('span');
    actions.className = 'actions';
    const ren = document.createElement('button');
    ren.textContent = '✎'; ren.title = 'Renommer';
    ren.onclick = () => renameNode(n);
    const del = document.createElement('button');
    del.textContent = '🗑'; del.title = 'Supprimer';
    del.onclick = () => removeNode(n);
    actions.append(ren, del);
    li.appendChild(actions);
  }
  return li;
}

function refreshGraph() {
  guard(async () => {
    const data = await API.graph(state.baseId);
    Graph.render(data);
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
    li.title = 'Clic droit pour supprimer cette relation';
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
  t.textContent = `Historique (${state.centered.history.length}/${HISTORY_MAX})`;
  box.appendChild(t);
  if (!state.centered.history.length) {
    const p = document.createElement('p');
    p.className = 'hint'; p.textContent = 'Aucun node encore visité.';
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
  if (!state.baseId) { root.innerHTML = '<p class="hint">Aucune base.</p>'; return; }

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
    card.appendChild(relationsBlock('Relations sortantes', state.relations.filter(r => r.source === node.id), 'target'));
    card.appendChild(relationsBlock('Relations entrantes', state.relations.filter(r => r.target === node.id), 'source'));
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
  'rt:instanciation':        { x: 0,  y: -1 },   // Nord
  'rt:caracterisation-type': { x: 1,  y: 0 },    // Est
  'rt:caracterisation':      { x: 1,  y: 0 },    // Est
  'rt:subsomption':          { x: 1,  y: 0 },    // Est
  'rt:representation-type':  { x: -1, y: 0 },    // Ouest
  'rt:representation':       { x: -1, y: 0 },    // Ouest
};
const CG_RADIUS = 175;   // distance centre → périphérie
const CG_SPACING = 95;   // écart perpendiculaire entre nodes d'une même direction

function centeredGraphData() {
  const cid = state.centered.current;
  const nodes = [{ id: cid, label: (resolveNode(cid) || {}).label || cid, center: true, x: 0, y: 0 }];
  const seen = new Set([cid]);
  const edges = [];
  state.relations.forEach(r => {
    let other = null, dir = null;
    const base = REL_DIRECTION[r.relationType] || { x: 1, y: 1 };
    if (r.source === cid) { other = r.target; dir = { x: base.x, y: base.y }; }
    else if (r.target === cid) { other = r.source; dir = { x: -base.x, y: -base.y }; }
    else return;
    if (!seen.has(other)) {
      seen.add(other);
      nodes.push({ id: other, label: (resolveNode(other) || {}).label || other, center: false, _dir: dir });
    }
    // La flèche « instanciation » pointe du type vers l'instance.
    let es = r.source, et = r.target;
    if (r.relationType === 'rt:instanciation') { es = r.target; et = r.source; }
    edges.push({ id: r.id, source: es, target: et, label: relationTypeLabel(r.relationType) });
  });

  // Grouper les périphériques par direction, puis les étaler perpendiculairement
  // pour qu'ils ne se superposent jamais.
  const groups = {};
  nodes.filter(n => !n.center).forEach(n => {
    const key = `${n._dir.x},${n._dir.y}`;
    (groups[key] = groups[key] || []).push(n);
  });
  Object.values(groups).forEach(group => {
    const d = group[0]._dir;
    const perp = { x: -d.y, y: d.x };
    const k = group.length;
    group.forEach((n, i) => {
      const offset = (i - (k - 1) / 2) * CG_SPACING;
      n.x = CG_RADIUS * d.x + offset * perp.x;
      n.y = CG_RADIUS * d.y + offset * perp.y;
      delete n._dir;
    });
  });
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
  CenterGraph.render(centeredGraphData());
  CenterGraph.resize();
}

// --- Onglet Règles : capture des règles « SI … ALORS … » -------------------
function atomText(a) {
  return `${a.subject || '?'} —${relationTypeLabel(a.relationType)}→ ${a.object || '?'}`;
}
function ruleText(rule) {
  return {
    si: (rule.premises || []).map(atomText).join(' ET ') || '…',
    alors: (rule.conclusions || []).map(atomText).join(' ET ') || '…',
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
  if (!state.baseId) { root.innerHTML = '<p class="hint">Aucune base.</p>'; return; }
  if (state.editingRule) { renderRuleEditor(root); return; }
  root.innerHTML = '';
  const bar = document.createElement('div');
  bar.className = 'row';
  const add = document.createElement('button');
  add.className = 'primary';
  add.textContent = '＋ Nouvelle règle';
  add.onclick = newRule;
  bar.appendChild(add);
  root.appendChild(bar);

  try { state.rules = await API.rules(state.baseId); } catch (e) { toast('⚠ ' + e.message); return; }
  if (!state.rules.length) {
    const p = document.createElement('p');
    p.className = 'hint';
    p.textContent = 'Aucune règle. Créez-en une avec « ＋ Nouvelle règle ».';
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
  const ed = document.createElement('button'); ed.textContent = '✎'; ed.title = 'Éditer';
  ed.onclick = () => editRule(rule);
  const del = document.createElement('button'); del.textContent = '🗑'; del.title = 'Supprimer';
  del.onclick = () => removeRule(rule);
  actions.append(ed, del);
  head.append(title, actions);
  el.appendChild(head);
  const body = document.createElement('div');
  body.className = 'rule-body';
  body.innerHTML = `<span class="kw">SI</span> ${escapeHtml(si)} <span class="kw">ALORS</span> ${escapeHtml(alors)}`;
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
  const lbl = document.createElement('label'); lbl.textContent = 'Nom :';
  const nameInput = document.createElement('input');
  nameInput.type = 'text'; nameInput.value = r.name; nameInput.placeholder = 'Nom de la règle';
  nameInput.oninput = e => { r.name = e.target.value; };
  nameRow.append(lbl, nameInput);
  card.appendChild(nameRow);

  card.appendChild(atomSection('SI', r.premises));
  card.appendChild(atomSection('ALORS', r.conclusions));

  const actions = document.createElement('div');
  actions.className = 'row rule-actions';
  const save = document.createElement('button'); save.className = 'primary'; save.textContent = 'Enregistrer';
  save.onclick = saveRule;
  const cancel = document.createElement('button'); cancel.textContent = 'Annuler';
  cancel.onclick = () => { state.editingRule = null; renderRules(); };
  actions.append(save, cancel);
  card.appendChild(actions);

  root.appendChild(card);
}

function atomSection(kw, atoms) {
  const sec = document.createElement('div');
  sec.className = 'atom-section';
  const h = document.createElement('h4');
  h.innerHTML = `<span class="kw">${kw}</span> <span class="hint">(atomes liés par ET)</span>`;
  sec.appendChild(h);
  const list = document.createElement('div');
  list.className = 'atom-list';
  atoms.forEach((a, i) => list.appendChild(atomRow(a, atoms, i)));
  sec.appendChild(list);
  const add = document.createElement('button');
  add.className = 'add-atom';
  add.textContent = '＋ Ajouter un atome';
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
  const del = document.createElement('button'); del.textContent = '✕'; del.title = 'Retirer';
  del.onclick = () => { atoms.splice(i, 1); if (!atoms.length) atoms.push(emptyAtom()); renderRules(); };
  row.append(subj, sel, obj, del);
  return row;
}

function saveRule() {
  const r = state.editingRule;
  if (!r.name.trim()) { toast('Nommez la règle'); return; }
  const clean = list => list
    .filter(a => a.subject.trim() && a.object.trim())
    .map(a => ({ subject: a.subject.trim(), relationType: a.relationType, object: a.object.trim() }));
  const body = { name: r.name.trim(), premises: clean(r.premises), conclusions: clean(r.conclusions) };
  if (!body.premises.length || !body.conclusions.length) {
    toast('Renseignez au moins un atome SI et un atome ALORS (variables non vides)');
    return;
  }
  guard(async () => {
    if (r.id) await API.updateRule(state.baseId, r.id, body);
    else await API.addRule(state.baseId, body);
    state.editingRule = null;
    await renderRules();
    toast('Règle enregistrée');
  });
}

function removeRule(rule) {
  if (!confirm(`Supprimer la règle « ${rule.name} » ?`)) return;
  guard(async () => { await API.deleteRule(state.baseId, rule.id); await renderRules(); toast('Règle supprimée'); });
}

// --- Glisser-déposer → modale de création de relation ----------------------
const PHRASE = {
  'rt:instanciation':        (s, t) => `${s} est une ${t}`,
  'rt:subsomption':          (s, t) => `${t} spécialise ${s}`,
  'rt:caracterisation-type': (s, t) => `${s} est caractérisé par ${t}`,
  'rt:caracterisation':      (s, t) => `${s} est caractérisé par ${t}`,
  'rt:representation-type':  (s, t) => `${s} est représenté par ${t}`,
  'rt:representation':       (s, t) => `${s} est représenté par ${t}`,
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
    <h3>Relation entre « ${aName} » et « ${bName} »</h3>
    <p class="step">1. Type de relation</p>
    <div class="type-choices"></div>
    <div class="dir-step" hidden>
      <p class="step">2. Sens de la relation</p>
      <div class="dir-choices"></div>
    </div>
    <div class="modal-actions"><button class="cancel">Annuler</button></div>`;
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
      toast('Relation créée');
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
  const name = prompt('Nom de la nouvelle base :');
  if (!name) return;
  guard(async () => {
    const b = await API.createBase(name.trim());
    state.baseId = b.id;
    state.centered = { current: null, history: [] };
    await refreshBases();
    toast('Base créée');
  });
}

function renameBase() {
  if (!state.baseId) return;
  const cur = state.bases.find(b => b.id === state.baseId);
  const name = prompt('Nouveau nom :', cur ? cur.name : '');
  if (!name) return;
  guard(async () => { await API.renameBase(state.baseId, name.trim()); await refreshBases(); });
}

function deleteBase() {
  if (!state.baseId) return;
  const cur = state.bases.find(b => b.id === state.baseId);
  if (!confirm(`Supprimer la base « ${cur ? cur.name : ''} » ?`)) return;
  guard(async () => {
    await API.deleteBase(state.baseId);
    state.baseId = null;
    state.centered = { current: null, history: [] };
    await refreshBases();
    toast('Base supprimée');
  });
}

function newNode() {
  if (!state.baseId) { toast('Créez d\'abord une base'); return; }
  const label = prompt('Label du node :');
  if (!label) return;
  guard(async () => { await API.addNode(state.baseId, label.trim()); await loadBase(); });
}

function renameNode(n) {
  const label = prompt('Nouveau label :', n.label);
  if (!label) return;
  guard(async () => { await API.renameNode(state.baseId, n.id, label.trim()); await loadBase(); });
}

function removeNode(n) {
  if (!confirm(`Supprimer « ${n.label} » ? (les relations qui l'utilisent seront retirées)`)) return;
  guard(async () => { await API.deleteNode(state.baseId, n.id); await loadBase(); });
}

// --- Suppression de relation (clic droit) ----------------------------------
function relationReadable(r) {
  const s = (resolveNode(r.source) || {}).label || r.source;
  const t = (resolveNode(r.target) || {}).label || r.target;
  return `${s} —${relationTypeLabel(r.relationType)}→ ${t}`;
}

function removeRelation(relId, readable) {
  if (!confirm(`Supprimer la relation « ${readable} » ?`)) return;
  guard(async () => {
    await API.deleteRelation(state.baseId, relId);
    await afterRelationChange();
    if (activeTab() === 'graph') refreshGraph();
    toast('Relation supprimée');
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

// --- Événements ------------------------------------------------------------
function bindEvents() {
  Graph.setDropHandler(handleGraphDrop);
  Graph.setEdgeContextHandler(onEdgeContext);
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
  $('#newNodeBtn').onclick = newNode;
  $('#searchInput').oninput = e => { state.search = e.target.value.trim().toLowerCase(); renderTextView(); };
  $('#graphLayout').onchange = e => setGraphLayout(e.target.value);
  $('#graphRelayout').onclick = () => Graph.applyLayout();
  document.querySelectorAll('.tab').forEach(tab => {
    tab.onclick = () => switchTab(tab.dataset.tab);
  });
  applySavedTabOrder();
  makeTabsSortable();
  restoreGraphLayout();
}

window.addEventListener('DOMContentLoaded', () => guard(init));
