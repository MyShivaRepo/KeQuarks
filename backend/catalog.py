"""
Catalogue fondateur (niveau 0 / bootstrap).

Nodes « built-in » amorcés à la création de chaque base :
- 3 types de relation : instanciation, caractérisation, représentation
- 6 rôles : Instance/type, chose caractérisée/caractériseur, sujet/objet

Chaque type de relation définit la paire de rôles (source, cible) qu'il confère.
Ces nodes sont non supprimables (builtin) ; tous les liens se font par identifiant.
"""
from __future__ import annotations

# Rôles built-in : id -> label
ROLES: dict[str, str] = {
    "role:instance": "individual",
    "role:type": "type",
    "role:generaliseur": "generalizer",
    "role:specialiseur": "specializer",
    "role:chose-caracterisee": "characterized thing",
    "role:caracteriseur": "characterizer",
    "role:sujet": "subject",
    "role:objet": "object",
}

# Types de relation built-in : id -> {label, source(role id), target(role id)}
RELATION_TYPES: dict[str, dict[str, str]] = {
    # Subsomption (sous-typage) entre types : ex. Animal —> Chien (source=généraliseur)
    "rt:subsomption": {
        "label": "subsumption",
        "source": "role:generaliseur",
        "target": "role:specialiseur",
    },
    "rt:instanciation": {
        "label": "instantiation",
        "source": "role:type",
        "target": "role:instance",
    },
    # Caractérisation au niveau SCHÉMA (contrainte) : ex. Personne —> Nom
    "rt:caracterisation-type": {
        "label": "characterization type",
        "source": "role:chose-caracterisee",
        "target": "role:caracteriseur",
    },
    # Caractérisation au niveau INSTANCE (assertion) : ex. Bernard Chabot —> Chabot
    "rt:caracterisation": {
        "label": "characterization",
        "source": "role:chose-caracterisee",
        "target": "role:caracteriseur",
    },
    # Représentation au niveau SCHÉMA (sujet/objet typés)
    "rt:representation-type": {
        "label": "representation type",
        "source": "role:sujet",
        "target": "role:objet",
    },
    # Représentation au niveau INSTANCE
    "rt:representation": {
        "label": "representation",
        "source": "role:sujet",
        "target": "role:objet",
    },
}

# Ids des nodes fondateurs (masqués de l'IHM repliée)
BUILTIN_IDS: set[str] = set(ROLES) | set(RELATION_TYPES)


def seed_nodes() -> list[dict]:
    """Nodes fondateurs à insérer dans chaque nouvelle base."""
    nodes: list[dict] = []
    for rid, rdef in RELATION_TYPES.items():
        nodes.append({"id": rid, "label": rdef["label"], "builtin": True})
    for role_id, label in ROLES.items():
        nodes.append({"id": role_id, "label": label, "builtin": True})
    return nodes


def relation_types_public() -> list[dict]:
    """Catalogue exposé par l'API : type + libellés des deux rôles."""
    out = []
    for rid, rdef in RELATION_TYPES.items():
        out.append({
            "id": rid,
            "label": rdef["label"],
            "sourceRole": ROLES[rdef["source"]],
            "targetRole": ROLES[rdef["target"]],
        })
    return out


def meta_model_public() -> dict:
    """Vue complète du méta-modèle fondateur : relations + rôles."""
    return {
        "relations": relation_types_public(),
        "roles": [{"id": rid, "label": label} for rid, label in ROLES.items()],
    }
