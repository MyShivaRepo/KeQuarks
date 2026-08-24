// Couche d'accès à l'API KeQuarks (même origine que la page servie).
const API = {
  async _json(method, url, body) {
    const opt = { method, headers: {} };
    if (body !== undefined) {
      opt.headers['Content-Type'] = 'application/json';
      opt.body = JSON.stringify(body);
    }
    const res = await fetch(url, opt);
    if (!res.ok) {
      let msg = res.statusText;
      try { msg = (await res.json()).detail || msg; } catch (_) {}
      throw new Error(msg);
    }
    return res.status === 204 ? null : res.json();
  },

  health()            { return this._json('GET', '/api/health'); },
  relationTypes()     { return this._json('GET', '/api/relation-types'); },

  bases()             { return this._json('GET', '/api/bases'); },
  createBase(name)    { return this._json('POST', '/api/bases', { name }); },
  renameBase(id, name){ return this._json('PATCH', `/api/bases/${id}`, { name }); },
  deleteBase(id)      { return this._json('DELETE', `/api/bases/${id}`); },

  nodes(b)            { return this._json('GET', `/api/bases/${b}/nodes`); },
  addNode(b, label)   { return this._json('POST', `/api/bases/${b}/nodes`, { label }); },
  renameNode(b, id, label){ return this._json('PATCH', `/api/bases/${b}/nodes/${id}`, { label }); },
  deleteNode(b, id)   { return this._json('DELETE', `/api/bases/${b}/nodes/${id}`); },

  relations(b)        { return this._json('GET', `/api/bases/${b}/relations`); },
  addRelation(b, rel) { return this._json('POST', `/api/bases/${b}/relations`, rel); },
  deleteRelation(b, id){ return this._json('DELETE', `/api/bases/${b}/relations/${id}`); },

  roles(b)            { return this._json('GET', `/api/bases/${b}/roles`); },
  graph(b)            { return this._json('GET', `/api/bases/${b}/graph`); },

  rules(b)            { return this._json('GET', `/api/bases/${b}/rules`); },
  addRule(b, rule)    { return this._json('POST', `/api/bases/${b}/rules`, rule); },
  updateRule(b, id, rule) { return this._json('PATCH', `/api/bases/${b}/rules/${id}`, rule); },
  deleteRule(b, id)   { return this._json('DELETE', `/api/bases/${b}/rules/${id}`); },
};
