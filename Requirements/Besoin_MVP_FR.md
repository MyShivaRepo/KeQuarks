# Besoin — Éditeur de base de connaissances KeQuarks (MVP)

**Projets :** KeQuarks (couche atomes) + Th3Sr1b3Pr0j3ct (couche nommage élaboré)
**Statut :** Besoin validé — MVP
**Date :** 2026-08-18
**Auteur :** Bernard Chabot (avec assistance Claude)

---

## 1. Vision

Un éditeur permettant de construire une base de connaissances dont l'unique brique
est le **node**. Un node n'a **aucun type intrinsèque** : ses rôles émergent de ses
relations et sont **recalculés à la volée** (dérivés), donc **réversibles**.

## 2. Règle fondatrice — rôles dérivés

- Un node est un **identifiant + un label monolangue**. Rien d'autre.
- Créer une **arête typée** entre deux nodes **confère un rôle à chaque extrémité**,
  le temps que l'arête existe.
- Supprimer la dernière arête qui conférait un rôle → le node **redevient nu**.
  **Aucun rôle n'est jamais stocké.**

## 3. Arêtes typées (catalogue fixe au MVP)

Chaque type d'arête est lui-même un node et définit la paire de rôles qu'il confère :

| Arête | Rôle source | Rôle cible |
|---|---|---|
| `est-une` | instance | type |
| `est-caractérisé-par` | concept | attribut |
| `est-représenté-par` | sujet | objet |

Un même node peut porter **plusieurs rôles simultanément** selon ses arêtes
(ex. `Personne` = instance de `EA Concept` **et** type de `Bernard Chabot`).

## 4. Fonctionnalités MVP

- Créer / renommer / supprimer un **node**.
- Créer / supprimer une **arête typée** (catalogue fixe) entre deux nodes.
- **Deux vues, dans deux onglets distincts :**
  - **Vue textuelle** — présentée par **ordre alphabétique** :
    - une entrée **globale** listant *tous les nodes* ;
    - **une entrée par rôle** (`type`, `instance`, `concept`, `attribut`, `sujet`,
      `objet`), peuplée dynamiquement au fur et à mesure que les arêtes déterminent
      les rôles. Un même node peut apparaître sous plusieurs rôles.
  - **Vue graphique** — les nodes affichés et **connectés entre eux** par leurs arêtes.
- **Naviguer / rechercher** parmi les nodes.

## 5. Hors périmètre du MVP (backlog)

- Types d'arêtes **définis par l'utilisateur**.
- Entrée listant les **arêtes** dans la vue textuelle (nodes uniquement au MVP).
- Nommage **multilingue** (label préféré / alternatifs) → projet `Th3Sr1b3Pr0j3ct`.
- **Export OWL** via `SWOWL`.
- Résolution théorique du **BOOTSTRAP** (pistes de stratification / triadique).
