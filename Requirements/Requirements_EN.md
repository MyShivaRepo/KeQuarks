# Specification — Node + Typed-Edges Principle (BOOTSTRAP Problem)

**Projects:** KeQuarks (atoms layer) + Th3Sr1b3Pr0j3ct (elaborate naming layer)
**Status:** Draft → **partially implemented (MVP)**
**Date:** 2026-08-18 (spec) · updated to reflect the delivered MVP
**Author:** Bernard Chabot (with Claude's assistance)

> English version of [`Requirement_FR.md`](./Requirement_FR.md), updated to reflect the
> KeQuarks MVP. Implementation notes are marked **✅ Implemented** or **🔵 Backlog**.
> The delivered model and decisions are detailed in
> [`Conception_Technique_FR.md`](./Conception_Technique_FR.md) §10.

---

## 1. Context

This specification formalizes the generative principle identified as a unified answer to the
three "killer features" (Link Reification, Multi-Typing, Meta-Modeling) as well as the
complementary dichotomies (Topic/Role, Subject/Object, Concept/Property).

It also documents the once-unresolved blocking point — the "**BOOTSTRAP problem**" — and
records how the MVP addressed it in practice.

### 1.1 Split between the two target projects

The Node + typed-edges principle is architected in two complementary layers, carried by two
distinct projects:

| Layer | Project | Responsibility |
|---|---|---|
| **Atoms** | **KeQuarks** | Base architecture of Nodes and typed edges; **basic** naming — a single monolingual label per Node |
| **Elaborate naming** | **Th3Sr1b3Pr0j3ct** | Richer naming layer over the same Nodes: **multilingual**, with a **preferred label** and **alternative labels** per language |

The two projects are "very close in essence" and should eventually merge — Th3Sr1b3 does not
add a different model, but a **richer naming layer on top of the same foundation** defined
here for KeQuarks.

### 1.2 Extended scope — full pipeline

This specification is the **core** of a four-step pipeline whose ends are already covered by
an existing project:

| Step | Function | Project | Status |
|---|---|---|---|
| 1 | Extract `<concept>` from text | **SWOWL** | Reuse of an existing capability (OWL/SWRL extraction) |
| 2 | Structure concepts per KeQuarks (Nodes, contextual categorization only) | **KeQuarks** | **✅ Object of this MVP** |
| 3 | Name the concepts | **Th3Sr1b3Pr0j3ct** | Naming layer (🔵 later) |
| 4 | Generate an OWL ontology | **SWOWL** | Reuse of an existing capability (OWL/SWRL generation) |

**On step 4 (projection to OWL):** this is explicitly treated as an **interoperability
serialization** — an acknowledged partial view of the Node model, meant to talk to the
existing Semantic Web ecosystem. It does not claim to faithfully represent the richness of
the Node model (no a-priori category, native reification, etc.): OWL's known limitations here
(heavy reification, restricted punning) are accepted as an assumed loss of fidelity, not a
problem to solve through SWRL workarounds.

This specification focuses on steps 2 and 3. Steps 1 and 4 belong to SWOWL's existing scope.

## 2. Founding principle

> No "thing" must be structurally locked into a category at declaration time. Categorization
> must be a **contextual assertion**, never a fixed identity attribute.

This opposes classical modeling paradigms (RDF/OWL, UML, etc.) where each "thing" natively and
durably belongs to a primitive category of the modeling language (Item, Link, Class,
Property…).

## 3. The single primitive: the Node

The model rests on **one ontological primitive: the Node**.

- A Node is a pure identifier, without an elaborate naming layer.
- A Node carries, by construction, **no a-priori category** — neither ITEM, LINK, nor TYPE.
- Any qualification of a Node (as item, link, type, role, etc.) results **exclusively from an
  external assertion**, never from a structural property of the Node itself.

**✅ Implemented.** A Node = `id` + a single monolingual label. Nothing else. Roles are
**derived** from relations and recomputed on the fly; removing the last relation conferring a
role makes the Node bare again.

### 3.1 Status of the monolingual label (KeQuarks) — two-phase evolution

The basic monolingual label is a deliberate, temporary exception to the principle:

- **KeQuarks phase (foundation):** the label is an **intrinsic attribute** of the Node — a
  deliberate bend of the general principle, accepted as the minimal founding floor.
- **Th3Sr1b3Pr0j3ct phase (migration):** the same label is **externalized** back into a typed
  edge ("has-preferred-label", "has-alternative-label"…), fully rejoining the general
  principle.

This two-phase evolution is the concrete implementation of resolution path 6.1 (type-theoretic
stratification): KeQuarks plays the founding level 0; Th3Sr1b3 climbs to the higher, purely
relational levels.

## 4. Categorization through typed edges

All categorization — including the ITEM / LINK / TYPE distinction itself — is carried by
**typed edges**.

- A typed edge is itself a **Node**.
- There is therefore no structural distinction between "things" and "relations between
  things": everything is a Node, including what links Nodes together.
- Direct consequence: the three killer features stop being special cases and become **natural
  consequences** of the model:
  - **Link Reification** — a link being a Node like any other, it can itself be linked by
    other edges (so it is both LINK and ITEM).
  - **Multi-Typing** — a Node can be the source of several distinct "typed-by" edges, without
    cardinality limit.
  - **Meta-Modeling** — nothing structurally distinguishes an "instance" Node from a "class"
    Node; that distinction is just one typed edge among others.

**✅ Implemented.** Reification is **materialized in storage** but **hidden from the UI**: a
relation can be the endpoint of another relation (meta-modeling), yet the UI shows only direct
`A —relation→ B` edges.

### 4.1 Catalogue of edge types — **as implemented**

The original spec identified 3 independent primitives + 1 derived. The MVP fixed catalogue is
**6 relation types** (each is itself a Node), plus **subsumption** (added). Each edge type
defines the pair of roles it confers:

| Relation | source role | target role | Level |
|---|---|---|---|
| `subsumption` | generalizer | specializer | — |
| `instantiation` | individual | type | — |
| `characterization type` | characterized thing | characterizer | schema |
| `characterization` | characterized thing | characterizer | instance |
| `representation type` | subject | object | schema |
| `representation` | subject | object | instance |

**Key evolution vs the original spec.** Characterization (and representation) exist at **two
levels** as **two explicit relation types** (schema / instance). This **replaces** the
original idea of a single Characterization primitive whose instance-level assertion is
**auto-derived** by instantiation. In the MVP the instance-level relation is created
**manually**; automatic derivation is **🔵 backlog** (it would be an inference engine — see
§7 and the Rules tab).

> A `Rules` tab (**✅ capture only**) lets one capture `IF … THEN …` inference rules over
> these relations (variable–relation–variable atoms). **Executing** them is backlog.

### 4.2 Open tension — Intension/Extension as an absolute property of Type

The Intension/Extension dichotomy characterizes the **Type** category in an **absolute**, not
contextual, way: any Node playing the Type role necessarily bears an intensional and an
extensional face, by the very logic of "being a Type".

This is in **direct tension with the founding principle** (§2). Two readings, **still open**:

- **(a) Assumed exception**, like the KeQuarks monolingual label (§3.1).
- **(b) False absoluteness** — Intension/Extension would merely be a derived consequence of
  the contextual instantiation relation, not an intrinsic property of the Node.

*Status: not settled. Not exercised by the MVP.*

### 4.3 Illustrative use case (implemented as the reference base)

- **Multi-Typing:** `Bernard Chabot` is simultaneously an instance of `Personne` **and** of
  `Contact` — two distinct instantiation edges from the same Node. **✅**
- **Characterization @ Type (constraint):** `Personne` is constrained by `Nom` and `Prénom`;
  `Société` by `Raison sociale`; `Contact` by `E-mail` and `Téléphone`. **✅** (as
  `characterization type` relations)
- **Characterization @ Instance (assertion):** `Bernard Chabot —characterization→ Chabot`,
  where `Chabot` is itself an instance of `Nom`. **✅** (created manually; the meta-link
  "this characterization is an instance of that characterization type" is also expressible,
  since a relation can be the endpoint of another relation).
- **Meta-Modeling:** `Personne` and `Société` are simultaneously **instances** of a meta-type
  `EA Concept`, via a recursive re-application of the same generic instantiation edge. **✅**

This use case is the **reference test** for any future implementation of the model, and is
shipped as the MVP demo base.

## 5. The BOOTSTRAP problem

The principle raises an unresolved difficulty: **if no Node carries an a-priori category, how
does the very first categorization assertion become possible?**

Two options were identified, both unsatisfactory as such:

### Option 1 — Naming is constitutive of identity
The name/identifier assigned to a Node carries part of a categorization.
→ **Problem:** this reintroduces an absolute, fixed category, contradicting §2.

### Option 2 — Naming is a subsequent assertion
The Node exists first as a pure identifier, then receives its name/category via a later
assertion (a typed edge).
→ **Problem:** this does not resolve the bootstrap: an assertion mechanism (typed edges, hence
Nodes already qualified as "edge types") must already exist **before** the first assertion —
a regress.

**How the MVP addresses it (path 6.1).** KeQuarks ships a small **founding catalogue** (the
built-in relation types and roles) as **level 0**, materialized in storage and non-deletable.
Everything else is purely relational on top of it. This is a pragmatic "level-0 pointer"
(kept simple), designed to be later reworked into a fully recursive form if desired — the
theoretical resolution remains **🔵 open**.

## 6. Candidate resolution paths

### 6.1 Type-theoretic stratification (universe hierarchy)
Inspired by type universes. Bootstrap resolved by accepting a **founding level 0**, minimal
and fixed by construction, over which upper levels rest purely relationally.
- *Advantage:* proven formal rigor (type theory, proof assistants).
- ***Retained implementation:*** KeQuarks = founding level 0 (built-in catalogue + intrinsic
  label); Th3Sr1b3Pr0j3ct = upper levels (label externalized into a typed edge). **✅ (MVP)**

### 6.2 Peircean triadic relations (Sign / Object / Interpretant)
Inspired by C. S. Peirce's semiotics: a sign has meaning only within an irreducible triadic
relation (sign, referred object, interpretant establishing the relation).
- *Advantage:* categorization is never binary (Node → Type) but always mediated by a third
  term, potentially dissolving the bootstrap.
- *To validate:* operational translatability into an implementable graph structure.
- *Status:* **🔵 not implemented.**

## 7. Proposed empirical validation protocol

Implement both paths (6.1 and 6.2) as distinct OWL/SWRL micro-ontologies over a common use
case (Client (role) / Company (topic)), comparing the number and nature of workarounds needed.
**🔵 Not executed** — the MVP validates path 6.1 pragmatically through the reference base
above.

## 8. Open questions

- [ ] **`EA Concept` (meta-type of §4.3): fixed top of the hierarchy**, or itself an instance
  of a higher level? *Symmetric of the BOOTSTRAP problem, on the top side. Still open.*
- [ ] **Intension/Extension as an absolute property of Type (§4.2):** assumed exception or
  false absoluteness? *Still open.*
- [ ] Should the KeQuarks→Th3Sr1b3 label migration be **automated** or a **manual
  reconstruction**? *Still open.*
- [ ] Can the Peircean triadic relation be carried natively by a single typed edge, or does it
  need a three-edge structure? *Still open.*
- [x] What other edge types beyond the initial primitives are needed? → **Resolved (MVP):**
  the catalogue is **subsumption, instantiation, characterization (type + instance),
  representation (type + instance)**.
- [x] Are node labels unique? → **Resolved (MVP): no.** Homonyms are legitimate (e.g. *Orange*
  the fruit vs the company); the UI disambiguates on collision by the node's type or a short
  id.

## 9. Implementation status (MVP) — summary

**✅ Delivered**
- Node primitive; **derived, reversible roles**; fixed 6-relation catalogue (English labels);
  reification **materialized in storage, hidden from a simple UI** (homogeneous direct edges).
- Multi-base registry; five views (Text, Centered text, Centered graph, Graph, Rules);
  relation creation by **drag-and-drop** in every view; relation deletion by **right-click**;
  homonym disambiguation; reorderable/collapsible sections; automatic graph layouts.
- Dual run mode (Docker / native Python) on port **54321**, mirroring SWOWL.

**🔵 Backlog**
- User-defined relation types · **rule execution** (inference engine, incl. auto-derived
  characterization) · multilingual naming (→ `Th3Sr1b3Pr0j3ct`) · OWL export (→ `SWOWL`) ·
  fully recursive bootstrap (path 6.2 / Peircean triads) · Intension/Extension resolution.

---

*Living document supporting the KeQuarks work — to be amended by Bernard Chabot.*
