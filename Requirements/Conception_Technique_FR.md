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
- **Tout est node.** Une relation et ses rôles sont eux-mêmes des nodes — le modèle est
  **entièrement réifié**.
- **Deux couches (principe central) :**
  - **Base (matérialisée, réifiée)** : le graphe complet, relations et rôles inclus, tel
    que le montre le diagramme de cas d'usage.
  - **IHM (simple, directe)** : l'API **replie** la réification pour présenter à
    l'utilisateur des relations directes `A —relation→ B`. Les hubs de relation et les
    nodes de rôle **ne sont jamais montrés** dans l'IHM.
- **Rôles dérivés** : aucun node « concept » ne porte de rôle en propre ; son rôle
  (`type`, `instance`, …) est **calculé** en regardant de quels rôles de relations il est
  le *filler*.

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

## 4. Modèle de données (réification matérialisée)

### 4.1 Node — la seule primitive

- **Node** = `id` (UUID) + `label` monolangue. **Rien d'autre.**
- Tout est un node : les concepts et individus (`Personne`, `Bernard Chabot`), les
  attributs (`Nom`, `Chabot`), **mais aussi** les relations et les rôles.
- Le `label` est le **nom lisible** d'un node ; il ne porte **jamais** de sémantique de
  typage. Tous les liens entre nodes se font **par `id`** — jamais par chaîne de
  caractères. *(« c'est l'identifiant qui compte ».)*

### 4.2 Catalogue fondateur (niveau 0 / bootstrap)

Nodes amorcés à la création de chaque base, `builtin: true` (non supprimables) :

| Nodes « type de relation » | Nodes « rôle » (source, cible) |
|---|---|
| `instanciation` | `Instance`, `type` |
| `caractérisation` | `chose caractérisée`, `caractériseur` |
| `représentation` | `sujet`, `objet` |

> Terminologie retenue = celle du diagramme de cas d'usage. `représentation` est définie
> mais **non exercée** (pas de cas d'usage à ce stade). Types de relation **définis par
> l'utilisateur** = backlog.

### 4.3 Relation — un node adressable + un pointeur de type + des rôles

Une relation est un **node** (donc `id` + `label`), enrichi de :

- `relationType` : **référence par `id`** vers un node « type de relation » du catalogue
  (ex. `instanciation`).
- `roles` : dictionnaire `{ <id du node rôle> : <id du filler> }`. Un `filler` peut viser
  **un node quelconque OU une autre relation** (par son `id`) — c'est ce qui rend possibles
  la **méta-modélisation** et la **caractérisation @instance dérivée** (section 4.5).

Exemple — `Bernard Chabot est-une Personne`, tel que **stocké en base** :

```json
{
  "nodes": [
    { "id": "n_bernard",       "label": "Bernard Chabot" },
    { "id": "n_personne",      "label": "Personne" },
    { "id": "n_instanciation", "label": "instanciation",  "builtin": true },
    { "id": "n_role_instance", "label": "Instance",       "builtin": true },
    { "id": "n_role_type",     "label": "type",           "builtin": true },
    { "id": "r1",              "label": "instanciation #1" }
  ],
  "relations": [
    {
      "relation":     "r1",
      "relationType": "n_instanciation",
      "roles": {
        "n_role_instance": "n_bernard",
        "n_role_type":     "n_personne"
      }
    }
  ]
}
```

### 4.4 `relationType` : pointeur primitif (option 1), migrable vers l'option 2

Le lien `relationType` (r1 → `n_instanciation`) est, au MVP, un **pointeur structurel
primitif** — le « plancher » du bootstrap (niveau 0), simple et pragmatique.

**Réversibilité garantie vers l'option 2** (récursive) : si un jour on veut que ce lien
soit *lui-même* une relation `instanciation` (r1 *instance de* `n_instanciation`), la
migration est **mécanique** — pour chaque relation, on remplace le champ `relationType`
par une nouvelle relation dont le rôle `Instance` vise `r1` et le rôle `type` vise le node
type. Aucune donnée n'est perdue (les relations sont déjà des nodes adressables). Le modèle
est donc conçu pour supporter ce passage sans rupture.

### 4.5 Caractérisation @instance dérivée — **créée à la main** au MVP

Le mécanisme du diagramme (la contrainte de schéma `Personne —caractérisation→ Nom` est
instanciée pour produire l'assertion `Bernard —caractérisation→ Chabot`) est, au MVP,
**construit manuellement** par l'utilisateur : il crée la relation d'instanciation dont un
`filler` vise la relation de caractérisation de schéma. **Aucune génération automatique**
(ce serait un moteur d'inférence, comme le moteur séparé de SWOWL) → **backlog**.

### 4.6 Rôles dérivés (jamais stockés)

Le backend calcule les rôles à la lecture :

- Un node `x` a le rôle `R` s'il est le `filler` d'un rôle `R` d'au moins une relation.
- Ex. « les `type` » = tous les nodes fillers d'un rôle `type` d'une relation
  `instanciation`. Un même node peut cumuler plusieurs rôles.
- Supprimer la dernière relation conférant un rôle ⇒ le node **disparaît** de la liste de
  ce rôle et **redevient nu**. Conforme au modèle « rôles dérivés ».

## 5. Persistance — registre multi-bases (comme SWOWL)

```
~/.kequarks/
  registry.json          → [ { id, name, file, created, updated } ]
  bases/
    <base-id>.json        → { "nodes": [ {id,label,builtin?} ],
                              "relations": [ {relation, relationType, roles{…}} ] }
```

- Une **base de connaissances** = un fichier JSON dans `bases/`, référencé dans
  `registry.json`. Chaque base est amorcée avec le **catalogue fondateur** (section 4.2).
- Le registre est rechargé au démarrage ; les fichiers restent sur l'hôte
  (hors conteneur), montés via volume en mode Docker.

## 6. API REST

L'API **matérialise** la réification en écriture, mais **replie** le graphe en lecture
pour l'IHM (relations directes, réification masquée).

| Méthode | Route | Rôle |
|---|---|---|
| `GET` | `/api/health` | santé du service |
| `GET` | `/api/relation-types` | catalogue fondateur (types de relation + rôles) |
| `GET` `POST` | `/api/bases` | lister / créer une base |
| `PATCH` `DELETE` | `/api/bases/{id}` | renommer / supprimer une base |
| `GET` `POST` | `/api/bases/{id}/nodes` | lister / créer un node (concept/individu/attribut) |
| `PATCH` `DELETE` | `/api/bases/{id}/nodes/{nodeId}` | renommer / supprimer un node |
| `GET` `POST` | `/api/bases/{id}/relations` | lister / créer une relation (fillers = ids de nodes **ou** de relations) |
| `DELETE` | `/api/bases/{id}/relations/{relId}` | supprimer une relation |
| `GET` | `/api/bases/{id}/roles` | **rôles dérivés** : `{ type:[…], instance:[…], "chose caractérisée":[…], caractériseur:[…], sujet:[…], objet:[…] }` |
| `GET` | `/api/bases/{id}/graph` | graphe **replié** : `{ nodes:[…], edges:[ {source, relationType, target} ] }` (hubs et rôles reconstruits, non exposés) |

## 7. Frontend — deux onglets (vue repliée)

- **Onglet « Vue textuelle »** (listes, tri **alphabétique**) :
  - entrée globale **Tous les nodes** (concepts/individus/attributs — les nodes
    fondateurs et relations restent masqués) ;
  - **une entrée par rôle** (`type`, `instance`, `chose caractérisée`, `caractériseur`,
    `sujet`, `objet`), alimentée par `/api/bases/{id}/roles`. Un même node peut apparaître
    sous plusieurs rôles.
- **Onglet « Vue graphique »** : **Cytoscape.js**, rendu **replié** — nodes reliés par des
  arêtes directes `A —relation→ B` (issues de `/api/bases/{id}/graph`). Ni hubs verts ni
  rôles jaunes à l'écran.
- **Sélecteur de base** en en-tête (base courante), aligné sur le registre SWOWL.
- **Recherche** globale sur les labels de nodes.

## 8. Arborescence du dépôt (miroir SWOWL)

```
backend/
  main.py             API FastAPI + montage StaticFiles (mode natif)
  models.py           modèles Pydantic (Node, Relation, Base)
  store.py            registre + I/O JSON + réification/repli + calcul des rôles dérivés
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

- Types de relation définis par l'utilisateur.
- `relationType` récursif (option 2) — modèle déjà prévu pour la migration (section 4.4).
- Génération **automatique** de la caractérisation @instance (moteur d'inférence).
- Entrée « relations » dans la vue textuelle (nodes uniquement au MVP).
- Nommage multilingue → projet `Th3Sr1b3Pr0j3ct`.
- Export OWL via `SWOWL`.
- Résolution théorique du BOOTSTRAP.

## 10. Évolutions depuis le 1er jet (décisions actées)

Décisions prises pendant l'implémentation du MVP, faisant autorité sur les sections
antérieures là où elles diffèrent.

### 10.1 Catalogue des relations (aligné sur le méta-modèle)

Le catalogue **fondateur** compte désormais **6 types de relation** et **8 rôles** :

| Relation | rôle source | rôle cible | niveau |
|---|---|---|---|
| `subsomption` | généraliseur | spécialiseur | — |
| `instanciation` | **individu** | type | — |
| `type de caractérisation` | chose caractérisée | caractériseur | schéma |
| `caractérisation` | chose caractérisée | caractériseur | instance |
| `type de représentation` | sujet | objet | schéma |
| `représentation` | sujet | objet | instance |

- Le rôle d'instanciation est **`individu`** (et non « Instance »).
- **Caractérisation** et **représentation** existent chacune à **deux niveaux** (schéma /
  instance) comme deux types de relation directs — cela **remplace** l'approche « caractérisation
  @instance dérivée automatiquement » (§4.5), reportée en backlog (moteur d'inférence).
- **`subsomption`** (généraliseur → spécialiseur) relie les types entre eux.
- Ordre d'affichage dans la modale : subsomption, instanciation, puis les paires type/instance.

### 10.2 Labels non uniques (homonymes assumés)

Un label n'est **pas unique** : deux nodes distincts peuvent le partager (ex. *Orange* le
fruit vs l'opérateur). L'IHM les **désambiguïse** uniquement en cas de collision, par leur
type (via instanciation) ou, à défaut, un court identifiant — rendu **stylé à part** (petit
badge grisé) pour montrer que le label reste identique.

### 10.3 IHM — réification invisible, rendu homogène

- Les **méta-relations** (relation dont une extrémité est une relation) ne sont **pas dessinées**
  dans la Vue graphique : toutes les relations y sont des arêtes directes homogènes `A —type→ B`.
- Les rôles dérivés (Vue textuelle) ne listent que des **nodes utilisateur**, jamais les
  relations-fillers d'une méta-relation.
- Sens de la flèche **`instanciation` : type → instance**.

### 10.4 Vues (5 onglets)

Vue textuelle · Vue textuelle centrée · Vue graphique centrée · Vue graphique · **Règles**.
Onglets **réordonnables à la souris** (ordre persistant). Vue textuelle : sections
**réordonnables et pliables**.

- **Vue graphique centrée** : placement **directionnel** par type — instanciation = Nord,
  caractérisation & subsomption = Est, représentation = Ouest ; étalement perpendiculaire pour
  éviter les chevauchements ; clic sur un node périphérique = recentrage.
- **Vue graphique** : sélecteur de **layout automatique** (force / hiérarchique / concentrique
  / cercle / grille), persistant.

### 10.5 Interactions

- **Créer une relation** : **glisser-déposer** un node sur un autre, dans **toutes** les vues
  (textuelles et graphiques) → modale (type de relation, puis sens).
- **Supprimer une relation** : **clic droit** sur une arête (graphes) ou une ligne de relation
  (vue textuelle centrée).

### 10.6 Onglet « Règles » (capture seule)

Capture de règles `SI … ALORS …` : prémisses et conclusions = listes d'**atomes**
`variable —type de relation→ variable` (liés par ET). **Aucune exécution** au MVP (moteur
d'inférence = backlog). Stockage : tableau `rules` dans la base ; CRUD via l'API.

### 10.7 Divers

- **Mode natif** : le frontend est servi en **no-cache** (comme nginx en Docker) pour éviter
  tout JS périmé.
- Le titre **KeQuarks** (en-tête) est un lien vers le dépôt GitHub.
