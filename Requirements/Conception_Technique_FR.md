# Conception technique — Éditeur KeQuarks (MVP)

**Projet :** KeQuarks
**Statut :** Conception validée — MVP
**Date :** 2026-08-18
**Auteur :** Bernard Chabot (avec assistance Claude)
**Référence besoin :** [`Besoin_MVP_FR.md`](./Besoin_MVP_FR.md)

> Architecture **calquée sur SWOWL** : front vanilla, back FastAPI, double mode de
> lancement (Docker / Python natif), persistance JSON sur le disque hôte.

---

## 1. Principes directeurs

- **Full web**, **containerisable** via Docker, accessible sur un **port unique : `54321`**.
- **Second mode d'exécution full Python** (venv, sans Docker) pour les postes où Docker
  n'est pas disponible — même approche que SWOWL.
- **No build, no framework** côté front (HTML/CSS/JS vanilla).
- **Rôles dérivés** : aucun rôle n'est stocké, tout est recalculé côté serveur à partir
  des arêtes (cf. besoin, règle fondatrice).

## 2. Stack technique

| Couche | Choix | Note |
|---|---|---|
| **Frontend** | HTML/CSS/JS **vanilla** (no framework, no build) | comme SWOWL |
| **Vue graphique** | **Cytoscape.js** vendorisé (1 fichier statique, aucune dépendance réseau) | |
| **Backend** | Python 3.11 — **FastAPI** + **Uvicorn** + **Pydantic** | comme SWOWL |
| **Dépendances Python** | `fastapi`, `uvicorn[standard]`, `pydantic`, `python-multipart` | **pas de `rdflib`** au MVP (OWL = backlog via SWOWL) |
| **Persistance** | fichiers **JSON** sur le disque hôte, sous `~/.kequarks/` | même principe que `~/.swowl/` |

## 3. Deux modes de lancement

### 3.1 Mode A — Docker (compose)

```
┌────────────────────┐        ┌────────────────────┐
│ frontend : nginx    │  proxy │ backend : FastAPI   │
│ port hôte 54321 →80 │ ─────▶ │ port interne 8000   │
└────────────────────┘        └────────────────────┘
```

- Interface : **`http://localhost:54321`**
- Swagger (doc API interactive) : **`http://localhost:54321/docs`** (proxifié par nginx)
- nginx proxifie `/api/`, `/docs`, `/openapi.json` vers le backend (port interne `8000`,
  **non exposé** à l'hôte).
- Le backend tourne sous l'UID/GID de l'utilisateur hôte (fichiers du volume `./data`
  et de `~/.kequarks` non possédés par root), comme SWOWL.

### 3.2 Mode B — Natif (Python venv, sans Docker)

Un **unique process uvicorn** sert à la fois l'API et le frontend statique
(montage `StaticFiles` monté **après** toutes les routes `/api`), donc **ni nginx ni
Docker**. Reprend le mécanisme du commit SWOWL `4c7769a`.

```bash
git clone https://github.com/MyShivaRepo/KeQuarks.git
cd KeQuarks
python3 -m venv .venv
source .venv/bin/activate          # Windows : .venv\Scripts\activate
pip install -r backend/requirements.txt
cd backend
uvicorn main:app --host 127.0.0.1 --port 54321
```

- Interface : **`http://127.0.0.1:54321`**
- Swagger : **`http://127.0.0.1:54321/docs`**
- En natif, l'app lit/écrit le **vrai système de fichiers** ; config et registre sous
  `~/.kequarks/` (surchargeable via la variable d'environnement `KEQUARKS_DIR`).

## 4. Modèle de données

### 4.1 Primitives

- **Node** = `id` (UUID) + `label` monolangue. Rien d'autre.
- **Edge** (arête typée) = `id` (UUID) + `type` (catalogue fixe) + `source` (id) +
  `target` (id). Une arête est **elle-même un node** conceptuellement, mais au MVP
  elle est stockée comme un enregistrement distinct pour rester simple.

### 4.2 Catalogue fixe des types d'arêtes (côté serveur)

```python
EDGE_TYPES = {
    "est-une":             {"source": "instance", "target": "type"},
    "est-caractérisé-par": {"source": "concept",  "target": "attribut"},
    "est-représenté-par":  {"source": "sujet",    "target": "objet"},
}
```

> Types d'arêtes **définis par l'utilisateur** = backlog (hors MVP).

### 4.3 Rôles dérivés (jamais stockés)

Le backend calcule les rôles à la lecture :

- Pour chaque arête `e` de type `t` : `source(e)` reçoit le rôle `EDGE_TYPES[t].source`,
  `target(e)` reçoit le rôle `EDGE_TYPES[t].target`.
- Un même node peut cumuler plusieurs rôles.
- Supprimer la dernière arête conférant un rôle ⇒ le node **disparaît** de la liste de
  ce rôle et **redevient nu**.

## 5. Persistance — registre multi-bases (comme SWOWL)

```
~/.kequarks/
  registry.json          → [ { id, name, file, created, updated } ]
  bases/
    <base-id>.json        → { "nodes": [ {id,label} ], "edges": [ {id,type,source,target} ] }
```

- Une **base de connaissances** = un fichier JSON dans `bases/`, référencé dans
  `registry.json`.
- Le registre est rechargé au démarrage ; les fichiers restent sur l'hôte
  (hors conteneur), montés via volume en mode Docker.

## 6. API REST

| Méthode | Route | Rôle |
|---|---|---|
| `GET` | `/api/health` | santé du service |
| `GET` | `/api/edge-types` | catalogue fixe des types d'arêtes |
| `GET` `POST` | `/api/bases` | lister / créer une base |
| `PATCH` `DELETE` | `/api/bases/{id}` | renommer / supprimer une base |
| `GET` `POST` | `/api/bases/{id}/nodes` | lister / créer un node |
| `PATCH` `DELETE` | `/api/bases/{id}/nodes/{nodeId}` | renommer / supprimer un node |
| `GET` `POST` | `/api/bases/{id}/edges` | lister / créer une arête |
| `DELETE` | `/api/bases/{id}/edges/{edgeId}` | supprimer une arête |
| `GET` | `/api/bases/{id}/roles` | **rôles dérivés** : `{ type:[…], instance:[…], concept:[…], attribut:[…], sujet:[…], objet:[…] }` |
| `GET` | `/api/bases/{id}/graph` | graphe complet (nodes + edges) pour la vue Cytoscape |

## 7. Frontend — deux onglets

- **Onglet « Vue textuelle »** (arbre / listes, tri **alphabétique**) :
  - entrée globale **Tous les nodes** ;
  - **une entrée par rôle** (`type`, `instance`, `concept`, `attribut`, `sujet`,
    `objet`), alimentée par `/api/bases/{id}/roles`. Un même node peut apparaître
    sous plusieurs rôles.
- **Onglet « Vue graphique »** : rendu **Cytoscape.js** des nodes connectés par leurs
  arêtes, à partir de `/api/bases/{id}/graph`.
- **Sélecteur de base** en en-tête (base courante), aligné sur le registre SWOWL.
- **Recherche** globale sur les labels de nodes.

## 8. Arborescence du dépôt (miroir SWOWL)

```
backend/
  main.py             API FastAPI + montage StaticFiles (mode natif)
  models.py           modèles Pydantic (Node, Edge, Base)
  store.py            registre + lecture/écriture JSON + calcul des rôles dérivés
  requirements.txt
  Dockerfile
frontend/
  index.html
  js/   app.js  api.js  graph.js  (+ vendor/cytoscape.min.js)
  css/
  nginx.conf          (proxy /api/, /docs, /openapi.json → backend)
docker-compose.yml
ReadMe.md / LisezMoi.md   (Option A Docker / Option B natif)
```

## 9. Hors périmètre (backlog) — rappel

- Types d'arêtes définis par l'utilisateur.
- Entrée « arêtes » dans la vue textuelle (nodes uniquement au MVP).
- Nommage multilingue → projet `Th3Sr1b3Pr0j3ct`.
- Export OWL via `SWOWL`.
- Résolution théorique du BOOTSTRAP.
