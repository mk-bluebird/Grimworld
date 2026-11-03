# Grimworld

> A survival-horror RPG universe built from consequential choices, inhabited places, scarce resources, and mysteries that do not surrender their meaning merely because a system can describe them.

Grimworld is a developing game-world and implementation project combining exploration, settlements, character simulation, player customization, practical skills, environmental storytelling, and bounded supernatural anomalies.

Its central design commitment is **survival** with consequence: equipment wears, information arrives unevenly, relationships remember actions, and unfamiliar places remain governed by rules—even when those rules differ from expectation.

Grimworld draws inspiration from Darkwood’s survival pressure and environmental uncertainty while developing its own original characters, objects, systems, and stories. It is an independent fan-work project, not an official product or an assertion that an unverified sequel exists.

## Project Status

This repository is intended to hold Grimworld’s authored content, contracts, tools, runtime modules, and verification evidence.

The project currently includes design work and proposed implementations. This README does not certify that every described system is installed, integrated, tested, or playable.

| Area | Status |
|---|---|
| World and narrative direction | Defined through project design work |
| Relational artwork and scene modeling | Draft contracts and example records |
| Character, attribute, and skill systems | Proposed architecture and vocabulary |
| Grimbank asset-authoring workspace | Proposed integration |
| Lua game-object modules | Prototype implementations requiring runtime verification |
| TypeScript authoring and validation tools | Prototype implementations requiring integration |
| Cross-language parity | Tests and harnesses proposed; no general pass claim |
| Playable game build | Not established by this README |
| Production readiness | Not claimed |

A code listing is not execution evidence. A proposed path is not a saved file. A test definition is not a passing test result.

## Contents

- [The World](#the-world)
- [Project Components](#project-components)
- [Gameplay Pillars](#gameplay-pillars)
- [Characters and Identity](#characters-and-identity)
- [Player Attributes and Customization](#player-attributes-and-customization)
- [Skills and Progression](#skills-and-progression)
- [Equipment and Resources](#equipment-and-resources)
- [Settlements and Exploration](#settlements-and-exploration)
- [Choices and Storytelling](#choices-and-storytelling)
- [World Objects and Anomalies](#world-objects-and-anomalies)
- [Scene and Object Contracts](#scene-and-object-contracts)
- [Time, Randomness, and Reproducibility](#time-randomness-and-reproducibility)
- [Validation and Publication](#validation-and-publication)
- [Authoring and AI Assistance](#authoring-and-ai-assistance)
- [Technical Architecture](#technical-architecture)
- [Repository Organization](#repository-organization)
- [Development and Testing](#development-and-testing)
- [Accessibility](#accessibility)
- [Privacy, Rights, and Safety](#privacy-rights-and-safety)
- [Contributing](#contributing)
- [Attribution and Licensing](#attribution-and-licensing)

## The World

Grimworld is a place of forests, river crossings, workshops, shelters, inhabited villages, difficult routes, and structures whose condition tells part of their history.

Its horror should emerge from relationships:

- A maintained house in a settlement that should be deserted.
- A familiar doorway reached by a road that no longer aligns.
- A trader who knows something the player has never disclosed.
- A repaired object whose counterpart bears the repair on the opposite side.
- A routine still observed after its purpose has become uncertain.

The world need not be uniformly ruined, monochrome, or fogbound. Order, warmth, craftsmanship, ordinary work, and domestic care can make an exception more disturbing.

### Lore Boundaries

Keep these categories distinct:

| Category | Meaning |
|---|---|
| Original Grimworld lore | Material authored for this project |
| Adaptation | A declared transformation of identified source material |
| Inspiration | An influence, not a claim of shared canon |
| Documented external canon | Claims supported by an identified external source |
| Fictional folklore | Invented customs, accounts, or practices |
| Unverified claim | Material whose authenticity or source remains unestablished |

Do not present an invented rite as authentic cultural practice. Do not use resemblance, names, or atmospheric similarity to imply official affiliation.

## Project Components

Grimworld is the encompassing project. Its tools support the world rather than replacing it.

| Component | Role |
|---|---|
| Grimworld | The game universe, systems, content, and runtime |
| Grimbank | Asset-bank and authoring workbench |
| Grimlore | Text-only artwork-description and storytelling framework |
| Contracts | Shared schemas, vocabularies, profiles, and generated types |
| Runtime | Explicit character, object, encounter, and simulation behavior |
| Engine adapters | Integration with a specifically declared host |
| Validation tools | Structural, referential, narrative, and anomaly checks |
| Review ledger | Authored changes, approvals, denials, and execution evidence |

Grimbank stores inspectable assets. Grimlore helps describe and develop them. Neither tool automatically establishes canon or authorizes publication.

## Gameplay Pillars

### Exploration with Uncertainty

Routes, landmarks, hazards, and information should matter. A map may be incomplete without becoming arbitrarily unreliable.

### Scarcity with Meaningful Decisions

Fuel, provisions, carrying capacity, repair supplies, and time create tradeoffs. Resource pressure should support choices rather than become bookkeeping without consequence.

### Characters with Agency

Residents, companions, traders, adversaries, and travelers have goals, knowledge, obligations, relationships, and limits.

### Settlements with Continuity

A settlement is a changing network of places, people, services, resources, disputes, and remembered events.

### Skills that Open Approaches

A learned skill may reveal an option, improve an attempt, or reduce a specified cost. It must not become permission to bypass every obstacle.

### Consequential Stories

Choices can change access, trust, possessions, knowledge, routes, and future encounters. Rejoining a story passage does not erase the history that led there.

### Bounded Strangeness

An anomaly has a subject, scope, permitted violation, targets, and limits. One exception must not make every object exempt from the world’s rules.

## Characters and Identity

Characters are stable game objects, not interchangeable bundles of statistics.

A character record should connect:

- Canonical identity and display labels.
- Current role and location.
- Goals and pressures.
- Knowledge and beliefs.
- Relationships and obligations.
- Attributes and learned capabilities.
- Equipment, ownership, and condition.
- Dialogue and encounter eligibility.
- Revision history and provenance.

### Identity Rules

- Preserve IDs through role changes.
- Rename identifiers only through declared migrations.
- Update references atomically.
- Use new identities for genuine forks or distinct actors.
- Record counterparts and lineage separately from identity.
- Do not merge entities because their descriptions or projection digests match.

A counterpart becoming a viewpoint character is not automatically a new person. A second person who resembles the first is not automatically the same entity.

### Personality

Grimworld’s `0xPAX0`–`0xPAX9` profile supplies fictional simulation variables for behavior.

| Axis | Design responsibility |
|---|---|
| `0xPAX0` | Social warmth |
| `0xPAX1` | Drive and industry |
| `0xPAX2` | Order–chaos orientation |
| `0xPAX3` | Empathy–cruelty orientation |
| `0xPAX4` | Stability–volatility |
| `0xPAX5` | Fear–aggression orientation |
| `0xPAX6` | Legacy fictional cognition axis |
| `0xPAX7` | Hopefulness / inner light |
| `0xPAX8` | Opacity and crypticity |
| `0xPAX9` | Legacy adult-only, non-explicit trait axis |

Preserve the configured formulas in the versioned personality contract. Normalize supplied traits as declared; missing traits require an explicit default policy or validation error.

These vectors supplement goals, information, relationships, and context. They are not diagnoses, real-world assessments, or deterministic moral judgments.

## Player Attributes and Customization

Proposed attribute domains include:

| Attribute | Intended gameplay role |
|---|---|
| Vigor | Sustained exertion and carrying effort |
| Dexterity | Fine manipulation and controlled movement |
| Perception | Noticing available environmental cues |
| Resolve | Maintaining selected actions under fictional pressure |
| Insight | Connecting acquired clues and testimony |
| Presence | Social approaches and negotiation opportunities |

Numerical scales, formulas, costs, and accepted thresholds require a versioned balance profile. This README establishes no balance values.

Keep separate:

- Base attributes.
- Learned skills.
- Equipment modifiers.
- Temporary conditions.
- Background knowledge.
- Accessibility preferences.

### Customization

Player customization may include:

- Name, pronouns, and presentation.
- Clothing, patches, repairs, and wear.
- Silhouette and distinguishing details.
- Background and starting affiliations.
- Starting tools and carrying arrangement.
- Dialogue preferences.
- Declared strengths and limitations.

Appearance must not silently determine morality, personality, or competence.

Cosmetic changes and mechanical effects must be distinguishable. A coat can tell a story without granting a bonus.

## Skills and Progression

The proposed skill suite supports practical survival and social alternatives.

| Group | Skills |
|---|---|
| Exploration | Wayfinding, Tracking, Vigilance |
| Movement | Quiet Movement, Loadcraft |
| Maintenance | Tool Repair, Sheltercraft, Practical Mechanics |
| Resources | Scavenging, Provisioning, Firekeeping |
| Recovery and identification | Field Dressing, Herbal Knowledge |
| Interaction | Barter, Mediation, Testimony, Local Customs |
| Restricted interactions | Lockwork |
| Defensive action | Improvised Defense |
| Pressure management | Composure |

Each implemented skill requires:

1. A stable ID.
2. Eligible actions and targets.
3. Preconditions.
4. Tools or materials.
5. Resource costs.
6. Failure and interruption behavior.
7. Observable outcomes.
8. Progression rules and limits.
9. Tests for prohibited effects.

Recognition is not explanation. Local Customs may identify an observance without revealing its intentionally open purpose.

Practical Mechanics must not automatically “repair” a deliberate supernatural exception.

Recovery, herbal, lockwork, and defensive mechanics remain fictional game systems—not real-world medical, harmful, or intrusion instructions.

## Equipment and Resources

Equipment records should establish:

- Identity and item type.
- Owner, holder, and location.
- Container relationships.
- Condition and repair history.
- Carrying cost under a declared unit system.
- Available actions.
- Consumable requirements.
- Failure behavior.
- Visual and sound descriptions.
- Provenance and rights.

Resource systems may include provisions, fuel, repair supplies, shelter materials, and available time.

Recipes require explicit inputs, outputs, stations, costs, and failure behavior. Unknown ingredients or unexplained customs must not be converted into real-world instructions.

## Settlements and Exploration

Settlement systems may include:

- Shelter access and maintenance.
- Workshops and stores.
- Trading relationships.
- Restricted areas and patrols.
- Local disputes.
- Shared resources and shortages.
- Route closures and discoveries.
- Rumors and encounter conditions.
- Environmental hazards.

Regions and routes should support modular hazards and environmental storytelling without requiring one universal visual treatment.

A location’s state should be inspectable: who occupies it, what services remain available, which routes are open, and what changed.

Do not confuse an authoring map, a procedural placement, and a verified engine scene.

## Choices and Storytelling

Artwork description answers what is present and how it appears.

Storytelling additionally asks:

- Whose experience organizes the scene?
- What pressure or desire drives it?
- What resists that desire?
- What action or choice follows?
- What changes because of it?
- What remains unresolved?

A vignette may be quiet. Its consequence may be a changed perception, expectation, or relationship.

### Branching

Use explicit choices, state changes, and destination nodes.

Two paths may rejoin while preserving different histories. Rejoining does not automatically merge incompatible facts.

A three-way merge requires a declared base and explicit conflict handling. Do not resurrect deleted assertions through simple set union.

### Character Information

Track information acquisition separately from truth.

A character may possess a rumor without that rumor being correct.

Knowledge-use analysis should distinguish:

```text
available
premature
unestablished
indeterminate
```

Presentation order is not automatically narrative-time order. Flashbacks and withheld information require explicit event relationships.

### Creative Additions

New events, backstory, rules, and explanations should be traceable to additions records.

An inspiration anchor is not proof that the new fact was already present in the artwork.

## World Objects and Anomalies

World objects require explicit states and transitions.

Examples include:

- Doors and thresholds.
- Lanterns and selected illumination targets.
- Keys, locks, containers, and ownership.
- Mills and mechanical objects.
- Bells and placement relations.
- Ritual object groups.
- Environmental motion controllers.

### River-Village Reference Objects

The project’s river-village scene supplies a useful invariant set:

| Object | Preserve |
|---|---|
| Widow | Hesitation at the submerged step |
| Counterpart | Matching head inclination and coat motif; declared asymmetries |
| Reflection | Different depicted pose without proven event order |
| Clay houses | Wax-plugged doorways; one plug fallen out; unexplained purpose |
| Far bell | Hanging outside the tower with no visible support |
| Millwheel | Turning above the race without touching it |
| Laundry and leaves | Still laundry with horizontally streaming leaves beneath |

Use `depicted_not_proven` where observation does not establish mechanism or chronology.

Do not invent a beam to support the bell, couple the wheel to water flow, or propagate a reflection exception to unrelated actors.

### Protected Mysteries

Represent:

```text
known
unknown
not_applicable
intentionally_open
```

An intentionally open field has no ordinary resolving setter. A new explanation requires an explicit authored branch or approved policy change.

A speculation remains attributed speculation. It does not become canon because a character says it confidently.

### Horror Profiles

Applicable systems must identify a versioned profile for:

- `0xSEF` — Spectral-Encounter-Frequency.
- `0xTIC` — Traumatic-Injury-Climax.
- `0xVPR` — Violence Pressure Reservoir.
- `0xHSI` — Haunted Shelter Integrity.
- `0xMFE` — Memory Fracture Entropy.
- `0xRSE` — Ritual Saturation Echo.
- `0xSDS` — Sanity Drain Steepness.
- `0xEEV` — Environmental Event Volatility.

Each metric needs units, bounds, update rules, and tests. Do not invent accepted thresholds. Missing applicable profiles are blocked or explicitly not applicable—not validated.

## Scene and Object Contracts

The relational scene vocabulary separates entities, relationships, composition, appearance, constraints, and provenance.

The existing realm vocabulary is:

```text
living
parallel
river
boundary
unspecified
```

These labels belong to the declared scene profile. They are not permission to infer universal cosmological rules.

The shared basis vocabulary is:

```text
explicit_description
derived_interpretation
implementation_choice
```

Derived interpretations require auditable supports under profiles that enforce that policy.

Qualified references distinguish namespaces:

```text
entity:widow
relationship:character_correspondence
constraint:preserve_hesitation
```

Structural validity does not establish reference resolution, narrative truth, or correct interpretation. Those checks belong to the composed validation path.

### Localization

Keep machine keys, IDs, predicates, and enum values stable.

Localize designated labels and prose with explicit language metadata. Do not translate canonical values into incompatible variants.

## Time, Randomness, and Reproducibility

### One Shared Tick

Declare one narrative tick contract.

Object-specific frozen or phase-based behavior is a scoped update policy—not an independent universal clock.

- RNG draws are not ticks.
- A phase counter is not evidence of elapsed source time.
- Shared observation ticks do not resolve a source-locked depiction.
- Paused systems require explicit catch-up or no-catch-up semantics.

### Intervals

Narrative interval profiles use explicit domain rules, including whether endpoints are non-negative integers.

For half-open intervals, touching endpoints do not constitute positive-duration overlap.

`hull` fills gaps and must not be substituted for a fact-preserving union.

Temporal equality establishes equal extents, not equal narrative meaning.

### Seeded Randomness

Every procedural subsystem must declare:

- Algorithm identifier.
- Seed and serialized state.
- Draw order.
- Numeric requirements.
- Sampling rules and budgets.
- Output serialization.
- Reference fixtures.

The project has explored separate Park–Miller and xorshift32 profiles. They must not share algorithm identifiers or fixture hashes.

A seed alone is not a reproducibility guarantee.

## Validation and Publication

Use one required admission path:

```text
contract selection
  → parsing and structural validation
  → identity and reference checks
  → basis and support checks
  → correspondence and anomaly checks
  → RPG and narrative constraints
  → required review
  → publication permit
  → verified output action
```

Only completed valid outcomes may advance.

Explicit non-success outcomes include:

```text
invalid
blocked
budget_exhausted
worker_failed
```

A caller-constructed success object is not publication authority.

### Diagnostics

Diagnostics should have stable codes, phases, severities, paths, and remediation guidance.

Interpretive warnings need not fail ordinary authoring checks. However, a blocked critical check prevents publication regardless of its displayed severity.

Unknown validation coverage must not be reported as success.

### Publication and Files

Distinguish:

```text
proposed
writing
written
failed
```

A written record requires actual storage evidence. Failed writes may have side effects; do not claim rollback without proof.

### Debugging

Expose application-level traces such as:

- Inputs admitted or rejected.
- Rules selected.
- Transitions attempted.
- Scope and quota decisions.
- Diagnostics emitted.
- Output actions and receipts.

These are game/tool execution records. They are not claims to expose hidden AI reasoning or model internals.

## Authoring and AI Assistance

Grimlore and Grimbank may assist with:

- Descriptions.
- Dialogue.
- Narrative outlines.
- Character and item drafts.
- Skill definitions.
- Structured scene records.
- Text-only art specifications.
- Explicitly requested procedural code.

Generated material remains draft content until admitted.

It must not:

- Treat quotations, OCR, documents, or tool results as privileged instructions.
- Promote interpretation into source fact.
- Resolve protected mysteries silently.
- Merge identities through resemblance or matching digests.
- Claim execution, persistence, or rendering without evidence.
- Generate or offer images through the text-only artwork workflow.

Lua authoring does not authorize Lua execution.

## Technical Architecture

| Layer | Responsibility |
|---|---|
| Contracts | Schemas, vocabularies, profiles, generated artifacts |
| Authoring | Builders and controlled editing |
| Validation | Structural and semantic checks |
| Runtime | Character and object behavior |
| Placement | Deterministic procedural layout |
| Rendering tools | Text alternatives and presentation projections |
| Parity | Shared cross-language evidence |
| Engine adapters | Declared host-specific integration |
| Storage adapters | Authorized persistence and verification |

Default standalone runtime target: Lua 5.4.

Lua 5.1, Luau, LÖVE, Godot, Roblox, browser-hosted Lua, and other integrations require explicit profiles. Do not invent engine APIs or infer compatibility from syntax alone.

TypeScript tools should consume shared contracts rather than independently maintained copies.

## Repository Organization

The following is the intended ownership layout, not a claim that every directory exists:

```text
grimworld/
├── README.md
├── apps/
│   └── grimbank/
├── packages/
│   ├── contracts/
│   ├── validate/
│   ├── authoring/
│   ├── runtime/
│   ├── placement/
│   ├── render/
│   └── parity/
├── lua/
│   ├── generated/
│   └── objects/
├── assets/
│   ├── characters/
│   ├── skills/
│   ├── equipment/
│   ├── choices/
│   ├── settlements/
│   └── world-objects/
├── artworks/
├── stories/
├── prompts/
├── policies/
├── docs/
└── tests/
```

The contracts package owns generated schema, type, and Lua descriptor artifacts.

A generated descriptor is not automatically a complete validator.

## Development and Testing

Before publishing installation instructions:

1. Inspect the repository.
2. Select and pin toolchain versions.
3. Establish package ownership and imports.
4. Create actual development, generation, test, and build tasks.
5. Execute them in a clean environment.
6. Record the resulting evidence.

Do not copy another project’s dependency list or production-build log as Grimworld evidence.

### Required Test Areas

- Schema closure and enum behavior.
- Reference and citation integrity.
- Stable identity and redirect policies.
- Rename path equivalence.
- Skill costs and forbidden effects.
- Inventory and ownership constraints.
- Character-information timing.
- Interval classification and conflict detection.
- Anomaly scope and invocation limits.
- Source-locked ambiguity.
- Deterministic placement.
- Cross-language output parity.
- Publication failure behavior.
- Accessibility.
- Retention and deletion controls.

Tests should include negative cases, resource limits, and failure paths—not only successful examples.

### Current Evidence Boundary

Historical Python calculations and generated reference artifacts exist in the project’s research conversation.

They do not establish Lua execution, TypeScript compilation, engine compatibility, or a successful Grimworld build.

Record runtime, source revision, fixture identity, and actual execution results for each compatibility claim.

## Accessibility

Maintain:

- Keyboard reachability.
- Visible focus.
- Readable contrast.
- Scalable text.
- Labels alongside icons.
- Non-color status cues.
- Reduced-motion options.
- Descriptions for informative previews.
- Clear state-change announcements.

Accessibility preferences should not carry hidden gameplay penalties.

Horror presentation must not depend on inaccessible controls or unreadable interfaces.

## Privacy, Rights, and Safety

### User Content

Uploads and authoring input do not automatically authorize:

- Permanent retention.
- Public sharing.
- Training.
- Evaluation reuse.
- External synchronization.

Disclose actual processors and retention behavior. Include temporary files, caches, logs, exports, and provider-held copies in the policy review.

Do not promise deletion that has not occurred.

### Rights

Keep ownership, permission to process, permission to retain, and permission to publish distinct.

A person depicted in an image is not necessarily its copyright owner. Attribution is not a substitute for permission.

### Safety

Build horror through tension, implication, uncertainty, and consequence.

Follow applicable platform requirements. When a request crosses a boundary, briefly explain the relevant limit and preserve a permissible atmospheric alternative where possible.

The project does not provide real-world harmful instructions, clinical assessments, or unsupported claims about people.

## Contributing

Before submitting a change:

1. Confirm that it belongs in Grimworld.
2. Preserve stable identity.
3. Declare source basis and creative additions.
4. Define affected states, transitions, and effects.
5. Preserve anomaly scope and intentionally open mysteries.
6. Update shared contracts through their owning package.
7. Add tests for success, denial, and failure.
8. Run the declared runtime and tooling.
9. Keep execution evidence separate from proposed verification.
10. Review accessibility, privacy, and rights implications.
11. Record required migrations.
12. Avoid introducing unchecked external actions.

Prefer complete, reviewable files over unexplained fragments.

For proposed artifacts, state filename, repository-relative destination, and state. Do not imply they were saved.

## Attribution and Licensing

SOVEREIGN-ATTRIBUTION

bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7

This anchor is retained for document credit and configured workstream metadata only. It does not establish biological binding, verified identity, consent, capability authorization, execution evidence, or authority over another person or system.

Repository licensing has not been verified.

Before distribution:

- Establish the license for original code.
- Track rights for prose, images, audio, and imported assets.
- Preserve third-party notices.
- Distinguish inspiration from copied material.
- Keep fictional cultural practices clearly labeled.
- Do not treat attribution as permission or authorization.

## Project Direction

Grimworld should become a coherent, replayable world whose characters, resources, choices, and anomalies remain inspectable without becoming simplistic.

Grimbank organizes its assets.

Grimlore develops its descriptions and stories.

Contracts keep its representations aligned.

Runtime objects make its rules consequential.

Review and publication gates preserve the boundaries between what was supplied, what was inferred, what was invented, and what was actually executed.

The next milestone is one verified vertical slice—not an unbounded collection of disconnected prototypes:

```text
one authored location
  → one player profile
  → a small skill set
  → connected character and object records
  → one consequential encounter
  → bounded anomalies
  → validated export
  → reproducible runtime evidence
```

The world should remain strange.

Its implementation should not be.
