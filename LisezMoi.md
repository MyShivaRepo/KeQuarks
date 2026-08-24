# 🧩 KeQuarks — Éditeur de base de connaissances « tout est node »

Éditeur d'une base de connaissances dont l'unique brique est le **node**. Un node n'a
**aucun type intrinsèque** : ses rôles (*individu*, *type*, *chose caractérisée*…) **émergent
de ses relations** et sont **recalculés à la volée** (dérivés, réversibles). Tout — y compris
les relations — est un node ; la réification est **matérialisée en base** mais **invisible de
l'IHM**, qui reste simple et directe.

> Projet frère de [SWOWL](https://github.com/MyShivaRepo/swowl) ; même architecture
> (front vanilla, back FastAPI, Docker **ou** Python natif).

## Démarrage

### Prérequis
- **Option A** — Docker Desktop (Docker Compose inclus), **ou**
- **Option B** — Python 3.11+ (sans Docker)

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

### Option B — Natif (venv Python, sans Docker)

Un unique processus Uvicorn sert à la fois l'API et le frontend statique (ni nginx ni Docker).

```bash
git clone https://github.com/MyShivaRepo/KeQuarks.git
cd KeQuarks
python3 -m venv .venv
source .venv/bin/activate          # Windows : .venv\Scripts\activate
pip install -r backend/requirements.txt
cd backend
uvicorn main:app --host 127.0.0.1 --port 54321
```

| Service | URL |
|---|---|
| Interface | **http://127.0.0.1:54321** (utiliser `127.0.0.1`, pas `localhost`) |
| API (Swagger) | http://127.0.0.1:54321/docs |

En natif, l'app lit/écrit le vrai système de fichiers ; les données vivent sous
`~/.kequarks` (surchargeable via la variable d'environnement `KEQUARKS_DIR`).

## Modèle

- **Node** = identifiant + un unique label monolangue. Rien d'autre.
- **Relations typées** (catalogue fixe ; chacune est elle-même un node) :

| Relation | rôle source | rôle cible |
|---|---|---|
| `subsomption` | généraliseur | spécialiseur |
| `instanciation` | individu | type |
| `type de caractérisation` | chose caractérisée | caractériseur |
| `caractérisation` | chose caractérisée | caractériseur |
| `type de représentation` | sujet | objet |
| `représentation` | sujet | objet |

- **Rôles dérivés** — un node n'est jamais estampillé d'un rôle ; ses listes de rôles sont
  calculées à partir de ses relations, et disparaissent dès la dernière relation retirée.
- **Labels non uniques** — les homonymes sont légitimes (ex. *Orange* le fruit vs l'opérateur) ;
  l'IHM les désambiguïse par leur type ou un court identifiant.
- **Réification** — une relation peut être l'extrémité d'une autre relation (méta-modélisation),
  mais l'IHM n'affiche que des arêtes directes `A —relation→ B`.

## Vues

- **Vue textuelle** — tous les nodes + une liste par rôle (ordre alphabétique) ; sections
  réordonnables et pliables à la souris.
- **Vue textuelle centrée** — un node avec ses relations entrantes/sortantes + un historique
  des nodes visités (profondeur 50).
- **Vue graphique centrée** — le node courant au centre, les voisins placés par type de
  relation (instanciation = Nord, caractérisation/subsomption = Est, représentation = Ouest).
- **Vue graphique** — le graphe complet, arêtes directes homogènes, avec sélecteur de layout
  automatique (force / hiérarchique / concentrique / cercle / grille).
- **Règles** — capture des règles d'inférence `SI … ALORS …` (atomes variable–relation–variable).

## Interactions

- **Créer une relation** — glisser un node sur un autre (dans toutes les vues) ; choisir le
  type de relation, puis le sens.
- **Supprimer une relation** — clic droit sur une arête (graphes) ou sur une ligne de relation
  (vue textuelle centrée).
- **Multi-bases** — un registre de bases de connaissances, comme le registre d'ontologies de SWOWL.

## Structure

```
backend/    API FastAPI, catalogue, store JSON (réification ↔ repli, rôles dérivés, règles)
frontend/   index.html, js/ (app, api, graph + Cytoscape), css/, nginx.conf
docker-compose.yml
Requirements/   besoin & conception (spécifications)
```

## Hors périmètre (backlog)

Types de relation définis par l'utilisateur · **exécution** des règles (moteur d'inférence) ·
nommage multilingue (→ `Th3Sr1b3Pr0j3ct`) · export OWL (→ `SWOWL`) · résolution théorique du
BOOTSTRAP.
