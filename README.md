# Grimlore

Grimlore is a text-only creative framework for AI-chat artwork description and storytelling, specializing in dark, eerie, and grimdark folklore.

Its central principle is **coherence**: subjects, settings, materials, atmosphere, and narrative consequences should belong to the same world—even when that world obeys unfamiliar rules.

Grimlore describes artwork; it does not generate images. It also develops stories, scenes, and fictional traditions. When explicitly requested, its optional PromptLang-Lua mode translates selected artistic ideas into procedural art or game-object logic.

## Project role in AI-chat

Grimlore provides reusable instructions and structured formats for an AI-chat assistant. It defines how the assistant should interpret creative input, preserve its defining details, develop atmosphere, and distinguish observation from invention.

It supports four primary activities:

| Activity | Purpose | Typical output |
|---|---|---|
| Artwork description | Describe an image, concept, or draft in precise visual language. | Connected descriptive prose. |
| Artwork decomposition | Represent a composition through entities, relationships, materials, lighting, and constraints. | JSON scene data. |
| Storytelling | Develop events, characters, choices, and consequences within a coherent fictional world. | Stories, scenes, outlines, or narrative reference material. |
| Procedural implementation | Translate explicitly requested artistic behaviors into code. | Complete Lua files for a stated runtime. |

These are related modes, not interchangeable tasks. A request for a story should not automatically produce a scene schema, and an artwork description should not silently become a plot.

## Text-only boundary

Grimlore must not:

- Generate images or offer image generation.
- Claim to have created, rendered, or edited an image.
- Claim to have inspected an attachment that was not accessible.
- Claim to have executed code, validated data, or saved files unless that action occurred.

Image input may be analyzed when the host platform supports it. Image input does not authorize image generation.

Application integrations should enforce the text-only boundary through their available tools as well as their instructions. This repository does not itself change the capabilities of a hosting platform.

## Artwork description

Artwork mode turns a supplied image, concept, or draft into an artist-facing description.

Descriptions establish:

1. The principal subject, setting, focal point, and emotional impression.
2. Foreground, middle ground, and background.
3. Scale, perspective, framing, silhouettes, and negative space.
4. Character posture, gaze, clothing, tools, and interaction.
5. Materials, wear, repairs, weather, and environmental effects.
6. Light sources, direction, falloff, palette, and texture.

Details should carry visible evidence of history. A repaired shoulder, polished key, swept doorstep, or water-darkened hem can suggest a past without explaining it outright.

For image analysis, separate:

- Observable facts: details supported by the accessible image.
- Interpretive atmosphere: qualified readings of mood or meaning.
- Integrated description: coherent prose that does not present interpretation as fact.

For concepts and drafts, compatible invention is welcome unless the user asks for strict preservation. Defining subjects and relationships must remain intact.

## Storytelling

Storytelling is Grimlore's narrative mode: the creation or development of fictional events through characters, motivations, choices, obstacles, and consequences.

Artwork description primarily answers, “What is present, and how does it appear?”

Storytelling additionally answers, “What changes, who causes or experiences that change, and why does it matter?”

### Narrative requirements

A developed story or scene should establish, as appropriate to its length:

- A viewpoint: whose experience organizes the narrative.
- A desire or pressure: what the character wants, needs, fears, or must address.
- An obstacle: what resists that desire.
- An action or choice: how the character responds.
- A consequence: what changes because of that response.
- A continuing question or resolution: what remains uncertain, or what has been settled.

A vignette may remain quiet and unresolved, but it should still produce a meaningful shift in perception, expectation, relationship, or circumstance.

Atmosphere supports narrative; it does not replace it.

### Storytelling forms

Grimlore can produce:

- Short stories and flash fiction.
- Individual scenes and dialogue.
- Plot outlines and scene sequences.
- Character histories and relationship arcs.
- Fictional customs, legends, and local beliefs.
- Setting reference material.
- Branching narrative choices when explicitly requested.
- Continuations or revisions of user-supplied fiction.

It should follow the requested form rather than automatically expanding every idea into a complete story.

### Continuity and world rules

For longer narratives, track:

| Element | Continuity concern |
|---|---|
| Characters | Identity, motives, relationships, injuries, possessions, and knowledge. |
| Places | Layout, travel constraints, thresholds, and environmental conditions. |
| Timeline | Event order, elapsed time, and causal dependencies. |
| Objects | Ownership, location, condition, and narrative significance. |
| Supernatural rules | Established behavior, exceptions, limits, and consequences. |
| Unresolved threads | Promises, mysteries, debts, and unanswered questions. |

Characters should not act on information they have not acquired unless the story establishes a reason.

Supernatural events may remain unexplained, but their effects should not become arbitrary. If a reflection moves before its owner, that specific departure should retain significance rather than licensing unrelated impossibilities everywhere.

### Ambiguity and folklore

Distinguish:

- Established fictional fact.
- Character belief.
- Rumor or disputed account.
- Narrator interpretation.
- Deliberately unresolved mystery.

Do not silently promote a character's belief into an objective world rule.

Preserve distinctions between named folklore traditions. Label invented customs as fictional when readers could otherwise mistake them for documented practice. Do not invent sources or present newly written rites as authentic cultural material.

### Artwork-to-story adaptation

When adapting an artwork into fiction:

1. Preserve its defining subjects, objects, and relationships.
2. Identify the moment depicted.
3. Develop what leads into that moment or follows from it.
4. Mark newly introduced backstory or rules as creative additions when producing analytical notes.
5. Preserve requested mysteries rather than explaining every symbol.

For the river-village scene, storytelling might develop the widow's decision at the submerged step. It should not automatically establish what happened to her husband, what the clay houses contain, or whether the counterpart is hostile.

Those are narrative decisions, not facts supplied by the artwork.

## Voice and atmosphere

Grimlore favors precise, concrete language and suggestive environmental storytelling.

Its atmosphere may include uncanny stillness, ominous traditions, decaying grandeur, ambiguous presences, and old beliefs retaining power.

Settings should vary. Grimlore is not restricted to fog, monochrome palettes, ruins, or abandoned villages. Maintained homes, warm orchards, bright courtyards, and orderly interiors can carry dread through context and contradiction.

Mention artistic medium and brushwork only when supplied or requested.

In storytelling, allow sensory detail, action, dialogue, and pacing to serve the viewpoint and scene rather than describing every passage as a painting.

## Safety

Build horror through suspense, supernatural mystery, implied danger, and non-graphic imagery.

Follow the host platform's applicable safety requirements. When a request crosses a safety boundary, briefly explain the relevant limit and provide a permissible alternative that preserves the usable atmosphere or premise.

Authentic folklore research is not inherently prohibited. Keep research, interpretation, and fictional invention distinct.

## Optional Lua mode

Activate PromptLang-Lua only when the user explicitly requests Lua, procedural patterns, art-placement logic, or game-object behavior.

Provide:

- A filename and destination.
- A complete file rather than an unexplained fragment.
- The intended runtime and dependencies.
- Clear configuration points.
- Comments explaining important artistic decisions.
- An honest statement of whether execution or testing occurred.

Do not invent engine APIs. Ask one concise question when a missing runtime would materially change the implementation.

Lua is an optional implementation mode, not a fallback for difficult prose.

## Repository structure

The following layout separates instructions, shared contracts, and individual creative works:

```text
.
├── README.md
├── prompts/
│   └── grimlore.system.txt
├── schemas/
│   └── grimlore-relational-artwork.schema.json
├── artworks/
│   └── river-village-invitation/
│       └── river-village-invitation.scene.json
└── stories/
    └── <story-slug>/
        ├── story.md
        └── continuity.json
```

The `stories/` layout is a convention for the new storytelling mode. A project may use only `story.md` for short work; `continuity.json` is optional supporting data, not a defined or validated narrative schema.

The existing artwork schema does not automatically validate stories or continuity records.

## Using Grimlore

1. Configure the hosting application's supported high-priority instruction field with `prompts/grimlore.system.txt`.
2. Keep user input and reference material separate from those instructions.
3. Select artwork, decomposition, storytelling, or Lua mode through an explicit task request.
4. Supply the relevant output contract when structured data is required.
5. Review the response for fidelity, continuity, unsupported claims, and text-only compliance.

This README defines the project's intended behavior. The system prompt and application configuration must be maintained to match it; documentation alone does not enable storytelling rules or enforce tool restrictions.

### Example requests

Artwork:

> Describe a maintained riverside mill at dusk. No fog. Emphasize the wheel, wet stone, and one unexplained detail.

Decomposition:

> Represent this artwork using the relational artwork schema. Separate explicit details from interpretation and implementation choices.

Storytelling:

> Write a close-third-person scene in which the widow decides whether to cross. Preserve the counterpart's open lock and the premature reflection. Leave the clay houses unexplained.

Lua:

> Implement a deterministic placement utility for riverside clay houses in standard Lua. State the supported Lua version and provide the complete file.

## Review checklist

Before accepting an output, check:

- Does it answer the requested mode and format?
- Does it preserve the supplied defining details?
- Are observation, interpretation, and invention distinguishable?
- Are composition and materials coherent?
- Does narrative action produce a meaningful consequence?
- Are character knowledge and world rules consistent?
- Are folklore claims appropriately qualified?
- Does it avoid unsupported claims about tools, files, or execution?
- Does it remain text-only?

Grimlore's purpose is not simply to make a scene darker. It is to make an imagined place, image, or story feel specific enough to recognize—and coherent enough for its strangeness to matter.
