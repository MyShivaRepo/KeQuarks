# 🧩 KeQuarks — Node-based knowledge editor

Editor for a knowledge base whose single primitive is the **node**. A node has **no
intrinsic type**: its roles (*individual*, *type*, *characterized thing*…) **emerge from its
relations** and are **recomputed on the fly** (derived, reversible). Everything — including
relations — is a node; the reification is materialized in storage but **hidden from the UI**,
which stays simple and direct.

> Sibling project of [SWOWL](https://github.com/MyShivaRepo/swowl); same architecture
> (vanilla front, FastAPI back, Docker **or** native Python).

## Getting started

### Prerequisites
- **Option A** — Docker Desktop (Docker Compose included), **or**
- **Option B** — Python 3.11+ (no Docker needed)

### Option A — Docker

```bash
git clone https://github.com/MyShivaRepo/KeQuarks.git
cd KeQuarks
docker compose up --build
```

| Service | URL |
|---|---|
| Interface | http://localhost:54321 |
| API (Swagger) | http://localhost:54321/docs |

### Option B — Native (Python venv, no Docker)

A single Uvicorn process serves both the API and the static frontend (no nginx, no Docker).

```bash
git clone https://github.com/MyShivaRepo/KeQuarks.git
cd KeQuarks
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r backend/requirements.txt
cd backend
uvicorn main:app --host 127.0.0.1 --port 54321
```

| Service | URL |
|---|---|
| Interface | **http://127.0.0.1:54321** (use `127.0.0.1`, not `localhost`) |
| API (Swagger) | http://127.0.0.1:54321/docs |

In native mode the app reads/writes your real filesystem; its data lives under
`~/.kequarks` (override with the `KEQUARKS_DIR` environment variable).

## Model

- **Node** = id + a single monolingual label. Nothing else.
- **Typed relations** (fixed catalog; each is itself a node):

| Relation | source role | target role |
|---|---|---|
| `subsumption` | generalizer | specializer |
| `instantiation` | individual | type |
| `characterization type` | characterized thing | characterizer |
| `characterization` | characterized thing | characterizer |
| `representation type` | subject | object |
| `representation` | subject | object |

- **Derived roles** — a node is never stamped with a role; its role lists are computed from
  the relations it participates in, and disappear when the last such relation is removed.
- **Labels are not unique** — homonyms are legitimate (e.g. *Orange* the fruit vs the
  company); the UI disambiguates them by their type or a short id.
- **Reification** — relations can be the endpoint of other relations (meta-modeling), but the
  UI shows only direct `A —relation→ B` edges.

## Views

- **Text view** — all nodes + one list per role (alphabetical); sections are
  drag-reorderable and collapsible.
- **Centered text view** — one node with its incoming/outgoing relations + a visited-node
  history (depth 50).
- **Centered graph view** — the current node at the center, neighbours placed by relation
  type (instantiation = North, characterization/subsumption = East, representation = West).
- **Graph view** — the whole graph, homogeneous direct edges, with an automatic-layout
  selector (force / hierarchical / concentric / circle / grid).
- **Rules** — capture `IF … THEN …` inference rules (variable–relation–variable atoms).

## Interactions

- **Create a relation** — drag one node onto another (works in every view); choose the
  relation type, then the direction.
- **Delete a relation** — right-click an edge (graphs) or a relation row (centered text view).
- **Multi-base** — a registry of knowledge bases, like SWOWL's ontology registry.

## Structure

```
backend/    FastAPI API, catalog, JSON store (reification ↔ collapse, derived roles, rules)
frontend/   index.html, js/ (app, api, graph + Cytoscape), css/, nginx.conf
docker-compose.yml
Requirements/   requirements & design (specs)
```

## Out of scope (backlog)

User-defined relation types · rule **execution** (inference engine) · multilingual naming
(→ `Th3Sr1b3Pr0j3ct`) · OWL export (→ `SWOWL`) · theoretical BOOTSTRAP resolution.
