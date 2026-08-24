"""
Persistance KeQuarks — registre multi-bases + réification matérialisée.

- Registre : {KEQUARKS_DIR}/registry.json  → [ {id, name, file, created, updated} ]
- Base     : {KEQUARKS_DIR}/bases/<id>.json → { nodes:[…], relations:[…] }

En base, les relations sont MATÉRIALISÉES sous forme réifiée (roles = {roleId: fillerId}).
L'API expose une forme REPLIÉE (source/target) — cf. to_public_relation() / graph().
Les rôles des nodes ne sont jamais stockés : ils sont DÉRIVÉS (roles()).
"""
from __future__ import annotations

import json
import os
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path

import catalog

KEQUARKS_DIR = Path(os.environ.get("KEQUARKS_DIR", Path.home() / ".kequarks"))
BASES_DIR = KEQUARKS_DIR / "bases"
REGISTRY = KEQUARKS_DIR / "registry.json"

_lock = threading.RLock()


# --------------------------------------------------------------------------- #
# Helpers bas niveau
# --------------------------------------------------------------------------- #
def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _new_id() -> str:
    return uuid.uuid4().hex


def _ensure_dirs() -> None:
    BASES_DIR.mkdir(parents=True, exist_ok=True)
    if not REGISTRY.exists():
        _write_json(REGISTRY, [])


def _read_json(path: Path):
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def _write_json(path: Path, data) -> None:
    """Écriture atomique (tmp + replace)."""
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    with tmp.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    tmp.replace(path)


# --------------------------------------------------------------------------- #
# Registre
# --------------------------------------------------------------------------- #
def list_bases() -> list[dict]:
    _ensure_dirs()
    reg = _read_json(REGISTRY)
    return sorted(reg, key=lambda b: b["name"].lower())


def _registry() -> list[dict]:
    _ensure_dirs()
    return _read_json(REGISTRY)


def _find_base(base_id: str) -> dict | None:
    return next((b for b in _registry() if b["id"] == base_id), None)


def create_base(name: str) -> dict:
    with _lock:
        _ensure_dirs()
        base_id = _new_id()
        meta = {
            "id": base_id,
            "name": name,
            "file": f"bases/{base_id}.json",
            "created": _now(),
            "updated": _now(),
        }
        reg = _registry()
        reg.append(meta)
        _write_json(REGISTRY, reg)
        # Amorçage du catalogue fondateur
        _write_json(BASES_DIR / f"{base_id}.json",
                    {"nodes": catalog.seed_nodes(), "relations": [], "rules": []})
        return meta


def rename_base(base_id: str, name: str) -> dict:
    with _lock:
        reg = _registry()
        meta = next((b for b in reg if b["id"] == base_id), None)
        if meta is None:
            raise KeyError("base")
        meta["name"] = name
        meta["updated"] = _now()
        _write_json(REGISTRY, reg)
        return meta


def delete_base(base_id: str) -> None:
    with _lock:
        reg = _registry()
        meta = next((b for b in reg if b["id"] == base_id), None)
        if meta is None:
            raise KeyError("base")
        reg = [b for b in reg if b["id"] != base_id]
        _write_json(REGISTRY, reg)
        f = BASES_DIR / f"{base_id}.json"
        if f.exists():
            f.unlink()


# --------------------------------------------------------------------------- #
# Contenu d'une base
# --------------------------------------------------------------------------- #
def _load(base_id: str) -> dict:
    meta = _find_base(base_id)
    if meta is None:
        raise KeyError("base")
    return _read_json(BASES_DIR / f"{base_id}.json")


def _save(base_id: str, data: dict) -> None:
    _write_json(BASES_DIR / f"{base_id}.json", data)
    reg = _registry()
    for b in reg:
        if b["id"] == base_id:
            b["updated"] = _now()
    _write_json(REGISTRY, reg)


def _label_of(data: dict, node_id: str) -> str | None:
    for n in data["nodes"]:
        if n["id"] == node_id:
            return n["label"]
    for r in data["relations"]:
        if r["id"] == node_id:
            return r["label"]
    return None


def _exists(data: dict, node_id: str) -> bool:
    return _label_of(data, node_id) is not None


# --- Nodes -----------------------------------------------------------------
def list_nodes(base_id: str, include_builtin: bool = False) -> list[dict]:
    data = _load(base_id)
    nodes = data["nodes"]
    if not include_builtin:
        nodes = [n for n in nodes if not n.get("builtin")]
    return sorted(nodes, key=lambda n: n["label"].lower())


def add_node(base_id: str, label: str) -> dict:
    with _lock:
        data = _load(base_id)
        node = {"id": _new_id(), "label": label, "builtin": False}
        data["nodes"].append(node)
        _save(base_id, data)
        return node


def rename_node(base_id: str, node_id: str, label: str) -> dict:
    with _lock:
        data = _load(base_id)
        node = next((n for n in data["nodes"] if n["id"] == node_id), None)
        if node is None:
            raise KeyError("node")
        if node.get("builtin"):
            raise PermissionError("builtin")
        node["label"] = label
        _save(base_id, data)
        return node


def delete_node(base_id: str, node_id: str) -> None:
    """Supprime un node et, en cascade, toute relation qui le référence."""
    with _lock:
        data = _load(base_id)
        node = next((n for n in data["nodes"] if n["id"] == node_id), None)
        if node is None:
            raise KeyError("node")
        if node.get("builtin"):
            raise PermissionError("builtin")
        data["nodes"] = [n for n in data["nodes"] if n["id"] != node_id]
        _cascade_delete_referencing(data, {node_id})
        _save(base_id, data)


def _cascade_delete_referencing(data: dict, dead_ids: set[str]) -> None:
    """Retire récursivement les relations dont un filler vise un id supprimé."""
    changed = True
    while changed:
        changed = False
        survivors = []
        for r in data["relations"]:
            if any(fid in dead_ids for fid in r["roles"].values()):
                dead_ids.add(r["id"])
                changed = True
            else:
                survivors.append(r)
        data["relations"] = survivors


# --- Relations -------------------------------------------------------------
def _to_public(r: dict) -> dict:
    """Réifié (roles) -> replié (source/target) pour l'IHM."""
    rdef = catalog.RELATION_TYPES[r["relationType"]]
    return {
        "id": r["id"],
        "label": r["label"],
        "relationType": r["relationType"],
        "source": r["roles"].get(rdef["source"]),
        "target": r["roles"].get(rdef["target"]),
    }


def list_relations(base_id: str) -> list[dict]:
    data = _load(base_id)
    return [_to_public(r) for r in data["relations"]]


def add_relation(base_id: str, relation_type: str, source: str,
                 target: str, label: str | None = None) -> dict:
    with _lock:
        if relation_type not in catalog.RELATION_TYPES:
            raise ValueError("relationType")
        data = _load(base_id)
        if not _exists(data, source):
            raise ValueError("source")
        if not _exists(data, target):
            raise ValueError("target")
        rdef = catalog.RELATION_TYPES[relation_type]
        if label is None:
            n = sum(1 for r in data["relations"]
                    if r["relationType"] == relation_type) + 1
            label = f"{rdef['label']} #{n}"
        rel = {
            "id": _new_id(),
            "label": label,
            "relationType": relation_type,
            "roles": {rdef["source"]: source, rdef["target"]: target},
        }
        data["relations"].append(rel)
        _save(base_id, data)
        return _to_public(rel)


def delete_relation(base_id: str, rel_id: str) -> None:
    with _lock:
        data = _load(base_id)
        if not any(r["id"] == rel_id for r in data["relations"]):
            raise KeyError("relation")
        data["relations"] = [r for r in data["relations"] if r["id"] != rel_id]
        _cascade_delete_referencing(data, {rel_id})
        _save(base_id, data)


# --- Rôles dérivés ---------------------------------------------------------
def roles(base_id: str) -> dict[str, list[dict]]:
    """Rôles dérivés : pour chaque libellé de rôle, la liste des nodes fillers.

    Seuls les **nodes utilisateur** sont listés : un filler qui est lui-même une
    relation (cas d'une méta-relation) relève de la réification et n'apparaît pas
    dans la Vue textuelle.
    """
    data = _load(base_id)
    user_node_ids = {n["id"] for n in data["nodes"] if not n.get("builtin")}
    out: dict[str, list[dict]] = {label: [] for label in catalog.ROLES.values()}
    seen: dict[str, set[str]] = {label: set() for label in catalog.ROLES.values()}
    for r in data["relations"]:
        for role_id, filler_id in r["roles"].items():
            if filler_id not in user_node_ids:   # filler = relation → ignoré
                continue
            role_label = catalog.ROLES[role_id]
            if filler_id in seen[role_label]:
                continue
            seen[role_label].add(filler_id)
            out[role_label].append({
                "id": filler_id,
                "label": _label_of(data, filler_id) or filler_id,
            })
    for label in out:
        out[label].sort(key=lambda n: n["label"].lower())
    return out


# --- Graphe replié (Cytoscape) ---------------------------------------------
def graph(base_id: str) -> dict:
    """
    Vue repliée et **homogène** : uniquement des arêtes directes A —type→ B.

    Seules les relations entre deux nodes utilisateur sont dessinées. Les
    méta-relations (une extrémité est elle-même une relation) relèvent de la pure
    réification et ne sont PAS rendues dans cette vue simple — elles restent dans
    les données. Toutes les relations sont ainsi rendues de la même façon.
    """
    data = _load(base_id)
    user_nodes = {n["id"]: n["label"]
                  for n in data["nodes"] if not n.get("builtin")}
    edges = []
    for r in data["relations"]:
        pub = _to_public(r)
        if pub["source"] in user_nodes and pub["target"] in user_nodes:
            src, tgt = pub["source"], pub["target"]
            # La flèche « instanciation » pointe du type vers l'instance.
            if r["relationType"] == "rt:instanciation":
                src, tgt = tgt, src
            edges.append({
                "id": r["id"],
                "source": src,
                "target": tgt,
                "label": catalog.RELATION_TYPES[r["relationType"]]["label"],
            })
    nodes = [{"id": nid, "label": lbl, "kind": "node"}
             for nid, lbl in user_nodes.items()]
    return {"nodes": nodes, "edges": edges}


# --------------------------------------------------------------------------- #
# Règles « SI … ALORS … » (capture uniquement — pas d'exécution au MVP)
# --------------------------------------------------------------------------- #
def list_rules(base_id: str) -> list[dict]:
    return _load(base_id).get("rules", [])


def add_rule(base_id: str, name: str, premises: list, conclusions: list) -> dict:
    with _lock:
        data = _load(base_id)
        data.setdefault("rules", [])
        rule = {"id": _new_id(), "name": name,
                "premises": premises, "conclusions": conclusions}
        data["rules"].append(rule)
        _save(base_id, data)
        return rule


def update_rule(base_id: str, rule_id: str, name: str,
                premises: list, conclusions: list) -> dict:
    with _lock:
        data = _load(base_id)
        rules = data.setdefault("rules", [])
        rule = next((r for r in rules if r["id"] == rule_id), None)
        if rule is None:
            raise KeyError("rule")
        rule["name"] = name
        rule["premises"] = premises
        rule["conclusions"] = conclusions
        _save(base_id, data)
        return rule


def delete_rule(base_id: str, rule_id: str) -> None:
    with _lock:
        data = _load(base_id)
        rules = data.setdefault("rules", [])
        if not any(r["id"] == rule_id for r in rules):
            raise KeyError("rule")
        data["rules"] = [r for r in rules if r["id"] != rule_id]
        _save(base_id, data)
