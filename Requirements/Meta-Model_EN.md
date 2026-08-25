# KeQuarks — Meta-Model

The KeQuarks meta-model expresses **how the fixed catalogue of relations weaves everything
together**. It is fully **reified**: relations and roles are themselves nodes. This document
presents the model and displays the reference schema.

> Related: [`Requirements_EN.md`](./Requirements_EN.md) (conceptual spec) ·
> [`Conception_Technique_FR.md`](./Conception_Technique_FR.md) §10 (implemented catalogue).

## 1. Reading key

| Colour | Meaning |
|---|---|
| 🟩 green | a **relation** (typed edge — itself a node) |
| 🟨 yellow | a **role** carried by a relation (its two endpoints) |
| 🟦 blue | a **node category** that *emerges* from playing roles |

Nothing is stamped: a blue category is never an attribute stored on a node — it is a **derived
reading** of which roles that node fills across relations.

## 2. The relations (fixed catalogue)

Each relation confers a pair of roles to its two ends:

| Relation | source role | target role | Level |
|---|---|---|---|
| `subsumption` | generalizer | specializer | — |
| `instantiation` | individual | type | — |
| `characterization type` | characterized thing | characterizer | schema |
| `characterization` | characterized thing | characterizer | instance |
| `representation type` | subject | object | schema |
| `representation` | subject | object | instance |

## 3. The two-level duality (schema ↔ instance)

**`instantiation`** is the pivot: it links a **schema-level** relation to its **instance-level**
counterpart, and a **type** node category to its **individual** node category.

- A `characterization type` (e.g. *Person → Name*) is **instantiated** into a
  `characterization` (e.g. *Bernard → "Chabot"*).
- A `representation type` is instantiated into a `representation`.
- Likewise each node category has a **type** side and an **individual** side:
  `node (object type)` ↔ `node (object)`, `node (characteristic type)` ↔
  `node (characteristic)`, `node (topic type)(subject type)` ↔ `node (topic)(subject)`.

**`subsumption`** (generalizer → specializer) relates types to one another (the is-a hierarchy).

## 4. Emergent node categories

Playing a role is what makes a node "be" something:

| A node that fills… | …emerges as |
|---|---|
| `characterized thing` / `subject` | a **topic / subject** |
| `characterizer` | a **characteristic** |
| `object` | an **object** |
| `type` (of an instantiation) | a **type** (topic type, object type, characteristic type…) |
| `individual` (of an instantiation) | an **individual** |

## 5. Schema

![KeQuarks meta-model — reified schema (subsumption, instantiation, characterisation, representation)](assets/meta-model_en.png)

## 6. Why it matters

This meta-model is not a taxonomy of boxes but a **relational fabric**: the three content
relations (subsumption, characterization, representation) plus the pivotal `instantiation`
generate — as **natural consequences**, not special cases — the three "killer features":

- **Link Reification** — a relation is a node, so it can be the endpoint of another relation.
- **Multi-Typing** — a node can fill the `individual` role of several `instantiation` edges.
- **Meta-Modeling** — a type is just a node filling a `type` role; the same `instantiation`
  edge re-applies across levels.

Identity (the node) stays put; meaning (its roles and relations) emerges, evolves, and can be
withdrawn — without changing what the node *is*.
