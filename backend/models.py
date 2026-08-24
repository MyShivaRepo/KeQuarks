"""Modèles Pydantic — entrées/sorties de l'API KeQuarks."""
from __future__ import annotations

from pydantic import BaseModel, Field


# --- Bases ---
class BaseIn(BaseModel):
    name: str = Field(..., min_length=1)


class BaseMeta(BaseModel):
    id: str
    name: str
    created: str
    updated: str


# --- Nodes ---
class NodeIn(BaseModel):
    label: str = Field(..., min_length=1)


class Node(BaseModel):
    id: str
    label: str
    builtin: bool = False


# --- Relations (forme repliée exposée à l'IHM) ---
class RelationIn(BaseModel):
    relationType: str            # id d'un type de relation du catalogue (rt:*)
    source: str                  # id du filler du rôle source (node ou relation)
    target: str                  # id du filler du rôle cible (node ou relation)
    label: str | None = None     # libellé optionnel ; défaut auto sinon


class Relation(BaseModel):
    id: str
    label: str
    relationType: str
    source: str
    target: str


# --- Règles « SI … ALORS … » (capture uniquement) ---
class Atom(BaseModel):
    subject: str            # nom de variable (ex. X, A, B, C)
    relationType: str       # id d'un type de relation du catalogue
    object: str             # nom de variable


class RuleIn(BaseModel):
    name: str = Field(..., min_length=1)
    premises: list[Atom] = []       # partie SI (atomes liés par ET)
    conclusions: list[Atom] = []    # partie ALORS (atomes liés par ET)
