"""
API KeQuarks — éditeur de base de connaissances « tout est node ».

- Écrit la réification matérialisée en base ; expose une vue repliée à l'IHM.
- Mode Docker : nginx sert le frontend et proxifie /api ; ici le dossier frontend
  n'est pas présent → le montage StaticFiles est ignoré.
- Mode natif : uvicorn sert l'API ET le frontend statique (montage en fin de fichier).
"""
from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

import catalog
import store
from models import BaseIn, NodeIn, RelationIn, RuleIn

app = FastAPI(title="KeQuarks", version="0.1.0",
              description="Knowledge base editor — nodes & reified relations")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------------------------------- #
# Santé + catalogue
# --------------------------------------------------------------------------- #
@app.get("/api/health", tags=["System"])
def health():
    return {"status": "ok", "dir": str(store.KEQUARKS_DIR)}


@app.get("/api/relation-types", tags=["Catalog"])
def relation_types():
    return catalog.relation_types_public()


@app.get("/api/meta-model", tags=["Catalog"])
def meta_model():
    return catalog.meta_model_public()


# --------------------------------------------------------------------------- #
# Bases
# --------------------------------------------------------------------------- #
@app.get("/api/bases", tags=["Bases"])
def get_bases():
    return store.list_bases()


@app.post("/api/bases", tags=["Bases"], status_code=201)
def post_base(body: BaseIn):
    return store.create_base(body.name)


@app.patch("/api/bases/{base_id}", tags=["Bases"])
def patch_base(base_id: str, body: BaseIn):
    try:
        return store.rename_base(base_id, body.name)
    except KeyError:
        raise HTTPException(404, "Base not found")


@app.delete("/api/bases/{base_id}", tags=["Bases"], status_code=204)
def del_base(base_id: str):
    try:
        store.delete_base(base_id)
    except KeyError:
        raise HTTPException(404, "Base not found")


# --------------------------------------------------------------------------- #
# Nodes
# --------------------------------------------------------------------------- #
@app.get("/api/bases/{base_id}/nodes", tags=["Nodes"])
def get_nodes(base_id: str):
    try:
        return store.list_nodes(base_id)
    except KeyError:
        raise HTTPException(404, "Base not found")


@app.post("/api/bases/{base_id}/nodes", tags=["Nodes"], status_code=201)
def post_node(base_id: str, body: NodeIn):
    try:
        return store.add_node(base_id, body.label)
    except KeyError:
        raise HTTPException(404, "Base not found")


@app.patch("/api/bases/{base_id}/nodes/{node_id}", tags=["Nodes"])
def patch_node(base_id: str, node_id: str, body: NodeIn):
    try:
        return store.rename_node(base_id, node_id, body.label)
    except KeyError:
        raise HTTPException(404, "Not found")
    except PermissionError:
        raise HTTPException(403, "Founding node cannot be modified")


@app.delete("/api/bases/{base_id}/nodes/{node_id}", tags=["Nodes"], status_code=204)
def del_node(base_id: str, node_id: str):
    try:
        store.delete_node(base_id, node_id)
    except KeyError:
        raise HTTPException(404, "Not found")
    except PermissionError:
        raise HTTPException(403, "Founding node cannot be deleted")


# --------------------------------------------------------------------------- #
# Relations
# --------------------------------------------------------------------------- #
@app.get("/api/bases/{base_id}/relations", tags=["Relations"])
def get_relations(base_id: str):
    try:
        return store.list_relations(base_id)
    except KeyError:
        raise HTTPException(404, "Base not found")


@app.post("/api/bases/{base_id}/relations", tags=["Relations"], status_code=201)
def post_relation(base_id: str, body: RelationIn):
    try:
        return store.add_relation(base_id, body.relationType,
                                  body.source, body.target, body.label)
    except KeyError:
        raise HTTPException(404, "Base not found")
    except ValueError as e:
        raise HTTPException(400, f"Invalid field: {e}")


@app.delete("/api/bases/{base_id}/relations/{rel_id}", tags=["Relations"], status_code=204)
def del_relation(base_id: str, rel_id: str):
    try:
        store.delete_relation(base_id, rel_id)
    except KeyError:
        raise HTTPException(404, "Not found")


# --------------------------------------------------------------------------- #
# Vues dérivées
# --------------------------------------------------------------------------- #
@app.get("/api/bases/{base_id}/roles", tags=["Views"])
def get_roles(base_id: str):
    try:
        return store.roles(base_id)
    except KeyError:
        raise HTTPException(404, "Base not found")


@app.get("/api/bases/{base_id}/graph", tags=["Views"])
def get_graph(base_id: str):
    try:
        return store.graph(base_id)
    except KeyError:
        raise HTTPException(404, "Base not found")


# --------------------------------------------------------------------------- #
# Règles (capture uniquement)
# --------------------------------------------------------------------------- #
def _atoms(items):
    return [a.model_dump() for a in items]


@app.get("/api/bases/{base_id}/rules", tags=["Rules"])
def get_rules(base_id: str):
    try:
        return store.list_rules(base_id)
    except KeyError:
        raise HTTPException(404, "Base not found")


@app.post("/api/bases/{base_id}/rules", tags=["Rules"], status_code=201)
def post_rule(base_id: str, body: RuleIn):
    try:
        return store.add_rule(base_id, body.name,
                              _atoms(body.premises), _atoms(body.conclusions))
    except KeyError:
        raise HTTPException(404, "Base not found")


@app.patch("/api/bases/{base_id}/rules/{rule_id}", tags=["Rules"])
def patch_rule(base_id: str, rule_id: str, body: RuleIn):
    try:
        return store.update_rule(base_id, rule_id, body.name,
                                 _atoms(body.premises), _atoms(body.conclusions))
    except KeyError:
        raise HTTPException(404, "Not found")


@app.delete("/api/bases/{base_id}/rules/{rule_id}", tags=["Rules"], status_code=204)
def del_rule(base_id: str, rule_id: str):
    try:
        store.delete_rule(base_id, rule_id)
    except KeyError:
        raise HTTPException(404, "Not found")


# --------------------------------------------------------------------------- #
# Frontend statique (mode natif uniquement — ignoré en Docker)
# --------------------------------------------------------------------------- #
class _NoCacheStatic(StaticFiles):
    """Sert le frontend sans cache (comme nginx en mode Docker) → pas de JS périmé."""

    def is_not_modified(self, response_headers, request_headers) -> bool:
        return False  # jamais de 304 : on re-sert toujours le fichier

    async def get_response(self, path, scope):
        resp = await super().get_response(path, scope)
        resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
        return resp


_FRONTEND = Path(__file__).resolve().parent.parent / "frontend"
if _FRONTEND.is_dir():
    app.mount("/", _NoCacheStatic(directory=str(_FRONTEND), html=True), name="frontend")
