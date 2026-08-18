# Spécification — Principe Node + Arêtes Typées (Problème BOOTSTRAP)

**Projets :** KeQuarks (couche atomes) + Th3Sr1b3Pr0j3ct (couche nommage élaboré)
**Statut :** Draft / à valider
**Date :** 2026-08-18
**Auteur :** Bernard Chabot (avec assistance Claude)

---

## 1. Contexte

Cette spécification formalise le principe génératif identifié comme réponse unifiée aux trois « killer features » (Link Reification, Multi-Typing, Meta-Modeling) ainsi qu'aux dichotomies complémentaires (Topic/Role, Subject/Object, Concept/Property).

Elle documente également le point de blocage non résolu — désigné « problème BOOTSTRAP » — qui empêche à ce jour l'implémentation complète du principe.

### 1.1 Répartition entre les deux projets cibles

Le principe Node + arêtes typées est architecturé en deux couches complémentaires, portées par deux projets distincts :

| Couche | Projet | Responsabilité |
|---|---|---|
| **Atomes** | **KeQuarks** | Architecture de base des Nodes et des arêtes typées ; mécanisme de nommage **basique** — un unique label monolangue par Node |
| **Nommage élaboré** | **Th3Sr1b3Pr0j3ct** | Couche de nommage enrichie s'appuyant sur les mêmes Nodes : **multilangue**, avec un **label préféré** et des **labels alternatifs** par langue |

Cette répartition confirme et opérationnalise l'intuition déjà formulée : les deux projets sont « très proches en essence » et devraient à terme fusionner — Th3Sr1b3 n'ajoutant pas un modèle différent, mais une **couche de nommage plus riche au-dessus du même socle** défini ici pour KeQuarks.

### 1.2 Périmètre étendu — pipeline complet

Cette spécification (principe Node + arêtes typées) constitue le **cœur** d'un pipeline en quatre étapes, dont les extrémités sont déjà couvertes par un projet existant :

| Étape | Fonction | Projet | Statut |
|---|---|---|---|
| 1 | Extraction de `<concept>` depuis un texte | **SWOWL** | Réutilisation d'une capacité existante (extraction OWL/SWRL) |
| 2 | Structuration des concepts selon KeQuarks (Nodes, catégorisation contextuelle uniquement) | **KeQuarks** | Objet de la présente spécification |
| 3 | Nommage des concepts | **Th3Sr1b3Pr0j3ct** | Objet de la présente spécification (couche nommage) |
| 4 | Génération d'une ontologie OWL | **SWOWL** | Réutilisation d'une capacité existante (génération OWL/SWRL) |

**Nature de l'étape 4 (projection vers OWL) :** cette génération est explicitement traitée comme une **sérialisation d'interopérabilité** — une vue partielle et assumée comme telle du modèle Node, destinée à dialoguer avec l'écosystème Semantic Web existant. Elle ne prétend pas représenter fidèlement la richesse du modèle Node (absence de catégorie a priori, réification native, etc.) : les limitations connues d'OWL sur ces points (réification lourde, punning restreint — cf. article LinkedIn "About Link Reification, Multi-Typing, Meta-Modeling … & Zen") sont acceptées comme une perte de fidélité assumée, pas comme un problème à résoudre par des contournements SWRL.

La présente spécification se concentre sur les étapes 2 et 3 (KeQuarks + Th3Sr1b3). Les étapes 1 et 4 relèvent du périmètre déjà existant de SWOWL et ne sont pas redétaillées ici.

## 2. Principe fondamental

> Aucune "chose" ne doit être verrouillée structurellement dans une catégorie au moment de sa déclaration. La catégorisation doit être une **assertion contextuelle**, jamais un attribut d'identité fixe.

Ce principe s'oppose aux paradigmes de modélisation classiques (RDF/OWL, UML, etc.) où chaque "chose" appartient nativement et durablement à une catégorie primitive du langage de modélisation (Item, Link, Class, Property...).

## 3. La primitive unique : le Node

Le modèle repose sur **une seule primitive ontologique : le Node**.

- Un Node est un identifiant pur, sans naming layer élaboré
- Un Node ne porte, par construction, **aucune catégorie a priori** — ni ITEM, ni LINK, ni TYPE
- Toute qualification d'un Node (en tant qu'item, lien, type, rôle, etc.) résulte exclusivement d'une **assertion externe**, jamais d'une propriété structurelle du Node lui-même

### 3.1 Statut du label monolangue (KeQuarks) — évolution en deux temps

Le label basique monolangue (cf. 1.1) fait exception à ce principe, **de façon assumée et temporaire** :

- **Phase KeQuarks (fondation) :** le label est porté comme un **attribut intrinsèque** du Node — une entorse volontaire au principe général, acceptée comme socle fondateur minimal
- **Phase Th3Sr1b3Pr0j3ct (migration) :** ce même label est **externalisé** et redevient une **arête typée** (« a-pour-label-préféré », « a-pour-label-alternatif », etc.), rejoignant alors pleinement le principe général

Cette évolution en deux temps constitue l'**implémentation concrète de la piste de résolution 6.1** (stratification type-théorique) : KeQuarks joue le rôle du niveau 0 fondateur, non soumis au principe général par nécessité de bootstrap ; Th3Sr1b3 réalise la montée vers les niveaux supérieurs, purement relationnels. Voir section 6.1.

## 4. Catégorisation par arêtes typées

Toute catégorisation — y compris la distinction ITEM / LINK / TYPE elle-même — est portée par des **arêtes typées**.

- Une arête typée est elle-même un **Node**
- Il n'existe donc pas de distinction structurelle entre "les choses" et "les relations entre les choses" : tout est Node, y compris ce qui relie les Nodes entre eux
- Conséquence directe : les trois killer features cessent d'être des cas particuliers à gérer, et deviennent des **conséquences naturelles** du modèle :
  - **Link Reification** : un lien étant un Node comme un autre, il peut lui-même être relié par d'autres arêtes (donc être à la fois LINK et ITEM)
  - **Multi-Typing** : un Node peut être la source de plusieurs arêtes "typées-par" distinctes, sans limite de cardinalité
  - **Meta-Modeling** : rien ne distingue structurellement un Node "instance" d'un Node "classe" — cette distinction n'est elle-même qu'une arête typée parmi d'autres

### 4.1 Catalogue des types d'arêtes (liste ouverte)

Trois types d'arêtes **réellement indépendants** sont identifiés à ce stade, plus un quatrième **dérivé**. Cette liste est **explicitement non exhaustive** — elle constitue un socle minimal amené à être complété.

| Type d'arête | Statut | Génère | Fonction |
|---|---|---|---|
| **Instanciation / Typage** | Primitive indépendante | Type + Instance | Porte le Meta-Modeling et le Multi-Typing |
| **Caractérisation** | Primitive indépendante | Concept + Attribut | Agit comme une **contrainte** (niveau schéma / Type) |
| **Représentation** | Primitive indépendante | Sujet + Objet | Mécanisme générique de "statement" ; porte le Link Reification |
| **Caractérisation @ Instance (assertion)** | **Dérivée** — pas une primitive | Concept + Attribut (valeur concrète) | Résulte de l'application du mécanisme **Instanciation/Typage** à une arête « Caractérisation » elle-même traitée comme un Node |

**Point clé (validé par le cas d'usage, section 4.3) :** ce qui semblait initialement être deux arêtes de Caractérisation indépendantes (contrainte @ Type / assertion @ Instance) n'en est en réalité **qu'une seule primitive** (Caractérisation, au niveau contrainte). L'assertion concrète n'est pas une primitive séparée : elle est **générée automatiquement** par le mécanisme générique d'Instanciation appliqué à l'arête de Caractérisation elle-même — une conséquence directe et élégante du principe fondamental (section 2) : puisqu'une arête est un Node comme un autre (section 4), elle est elle-même instanciable, exactement comme n'importe quel autre Node.

**Point de vigilance — ne pas confondre avec Intension/Extension :** ce mécanisme (Caractérisation générique → assertion dérivée par instanciation) est **distinct** de la dichotomie Intension/Extension qui, elle, caractérise la catégorie « Type » elle-même. Voir section 4.2.

### 4.2 Tension ouverte — Intension/Extension comme propriété absolue du Type

La dichotomie Intension/Extension (déjà identifiée comme fil rouge transversal dans d'autres travaux — xLM, Ecosystem Mapping) caractérise la catégorie **Type** de façon **absolue**, et non contextuelle : tout Node jouant le rôle de Type porte nécessairement une face intensionnelle et une face extensionnelle, par la logique même de ce que signifie "être un Type" — indépendamment de toute arête d'assertion supplémentaire.

Ceci entre en **tension directe avec le principe fondamental** (section 2), qui interdit toute propriété structurelle fixe. Deux lectures possibles, **non tranchées à ce stade** (cf. question ouverte, section 8) :

- **(a) Exception assumée**, au même titre que le label monolangue de KeQuarks (section 3.1) — une deuxième entorse volontaire, documentée comme telle
- **(b) Fausse absoluité** — Intension/Extension ne serait qu'une conséquence dérivée de la relation contextuelle d'instanciation (section 4.1), et non une propriété intrinsèque du Node lui-même

### 4.3 Cas d'usage illustratif (validé par diagramme)

Un exemple concret a permis de valider le mécanisme ci-dessus :

- **Multi-Typing :** `Bernard Chabot` (individu) est simultanément instance de `Personne` **et** instance de `Contact` — deux arêtes d'Instanciation/Typage distinctes depuis le même Node
- **Caractérisation @ Type (contrainte) :** `Personne` est contraint par `Nom` et `Prénom` ; `Société` par `Raison sociale` ; `Contact` par `E-mail` et `Téléphone`
- **Caractérisation @ Instance (assertion), dérivée :** l'arête « Personne —Caractérisation→ Nom » est elle-même instanciée (Instanciation/Typage appliqué à ce Node-arête) pour produire l'assertion concrète « Bernard Chabot —Caractérisation→ Chabot », où `Chabot` est lui-même instance de `Nom`
- **Meta-Modeling :** `Personne` et `Société` — qui jouent le rôle de Type au niveau sol (typant respectivement `Bernard Chabot` et les compagnies) — sont **simultanément Instances** d'un méta-type `EA Concept`, via une **réapplication récursive** de la même arête générique Instanciation/Typage à un niveau supérieur. Aucune primitive nouvelle n'est nécessaire : le même mécanisme s'applique en cascade à travers les niveaux. *(Question ouverte : `EA Concept` est-il le sommet de la hiérarchie, ou peut-il lui-même être instance d'un niveau encore supérieur ? Cf. section 8, en lien avec le problème BOOTSTRAP côté base — section 5 — posé ici symétriquement côté sommet.)*

Ce cas d'usage sert de **test de référence** pour toute future implémentation (OWL/SWRL ou autre) du modèle.



## 5. Le problème BOOTSTRAP

Le principe ci-dessus soulève une difficulté non résolue : **si aucun Node ne porte de catégorie a priori, comment la toute première assertion de catégorisation devient-elle possible ?**

Deux options ont été identifiées, toutes deux insatisfaisantes en l'état :

### Option 1 — Le nommage est constitutif de l'identité
Le nom/identifiant attribué à un Node porte en lui-même une part de catégorisation.
→ **Problème :** cela réintroduit une catégorie absolue et fixe, en contradiction directe avec le principe fondamental (section 2).

### Option 2 — Le nommage est une assertion subséquente
Le Node existe d'abord comme identifiant pur, puis reçoit son nom/sa catégorie via une assertion postérieure (une arête typée, cf. section 4).
→ **Problème :** cela ne résout pas le bootstrap, car il faut déjà disposer d'un mécanisme d'assertion (donc d'arêtes typées, donc de Nodes déjà qualifiés en tant que "types d'arête") **avant** que la première assertion ne puisse être formulée. On retombe sur une régression : pour asserter, il faut déjà un vocabulaire d'assertion — qui doit lui-même avoir été établi par une assertion antérieure.

## 6. Pistes de résolution candidates

### 6.1 Stratification type-théorique (hiérarchie d'univers)
Inspirée des hiérarchies d'univers en théorie des types (type universes). Le bootstrap serait résolu en acceptant un **niveau 0 fondateur**, minimal et fixe par construction (non soumis au principe général), sur lequel les niveaux supérieurs s'appuient de façon purement relationnelle.
- *Avantage :* rigueur formelle éprouvée (théorie des types, assistants de preuve)
- *Point à valider :* le niveau 0 constitue-t-il une entorse acceptable au principe, ou une trahison de son intention ?
- ***Implémentation concrète retenue (section 3.1) :*** KeQuarks = niveau 0 fondateur (label intrinsèque, entorse assumée) ; Th3Sr1b3Pr0j3ct = niveaux supérieurs (label externalisé en arête typée). Cette piste n'est donc plus seulement théorique : elle correspond directement à la répartition des deux projets définie en 1.1.

### 6.2 Relations triadiques peirciennes (Sign / Object / Interpretant)
Inspirée de la sémiotique de Charles S. Peirce : un signe n'a de sens que dans une relation triadique irréductible (signe, objet référé, interprétant qui établit la relation).
- *Avantage :* propose nativement un mécanisme où la catégorisation n'est jamais binaire (Node → Type) mais toujours médiée par un troisième terme (l'acte interprétatif), ce qui pourrait dissoudre le bootstrap en le redéfinissant comme un non-problème
- *Point à valider :* traduisibilité opérationnelle en structure de graphe implémentable (OWL/SWRL ou autre)

## 7. Protocole de validation empirique proposé

Implémenter les deux pistes (6.1 et 6.2) comme micro-ontologies OWL/SWRL distinctes, sur un cas d'usage commun :

- **Cas d'usage test :** Client (rôle) / Company (topic)
- **Critère de comparaison :** nombre et nature des contournements ("workarounds") nécessaires dans chaque approche pour représenter correctement le cas sans violer le principe fondamental (section 2)
- **Livrables attendus :**
  - Ontologie OWL/SWRL — Piste 6.1 (stratification)
  - Ontologie OWL/SWRL — Piste 6.2 (triadique)
  - Grille comparative des contournements observés

## 8. Questions ouvertes

- [ ] **`EA Concept` (méta-type du cas d'usage 4.3) est-il le sommet fixe de la hiérarchie**, ou peut-il lui-même être instance d'un niveau encore supérieur ? *Symétrique du problème BOOTSTRAP (section 5), côté sommet plutôt que côté base — non tranché à ce stade.*
- [ ] **Intension/Extension comme propriété absolue du Type (section 4.2) :** exception assumée (comme le label KeQuarks) ou fausse absoluité à ramener au contextuel ? *Non tranché à ce stade.*
- [ ] La migration du label de KeQuarks (intrinsèque) vers Th3Sr1b3 (arête typée externe) doit-elle être **automatisée** (script de migration, transformation systématique) ou reste-t-elle une **reconstruction manuelle** lors du passage à Th3Sr1b3 ?
- [ ] La relation triadique peircienne (6.2) peut-elle être portée nativement par une arête typée unique, ou nécessite-t-elle une structure à trois arêtes ?
- [ ] Le protocole de validation (section 7) a-t-il déjà été exécuté, même partiellement ?
- [ ] Quels autres types d'arêtes, au-delà des 3 primitives + 1 dérivée (section 4.1), sont nécessaires pour couvrir le besoin complet ? (Instanciation/Typage, Caractérisation, Représentation confirmés comme socle par le cas d'usage 4.3)

---

*Document généré en support à la réflexion sur KeQuarks — [[seamless-rhizome]] — à valider et amender par Bernard Chabot avant intégration au dépôt `exigences/`.*
