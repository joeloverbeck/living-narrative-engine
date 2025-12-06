# Anatomy Blueprints and Recipes Guide

This guide covers the complete authoring workflow for anatomy blueprints and recipes, from structure template design through pattern matching and validation.

## Table of Contents

1. [Blueprint Schema Versions](#blueprint-schema-versions)
2. [Structure Templates](#structure-templates)
3. [Blueprint Authoring](#blueprint-authoring)
4. [Recipe Pattern Matching](#recipe-pattern-matching)
5. [Recipe Creation Workflow](#recipe-creation-workflow)
6. [Validation and Testing](#validation-and-testing)
7. [Migration Guide](#migration-guide)

---

## Blueprint Schema Versions

| Schema version          | How to declare                                                | Core properties                                                                  | Blocked properties                     | Typical usage                                                   |
| ----------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------- | --------------------------------------------------------------- |
| **V1 (1.0 or omitted)** | Omit `schemaVersion` or set to `"1.0"`                        | `slots`, `parts`, `compose`, `clothingSlotMappings`                              | `structureTemplate`, `additionalSlots` | Humanoid or hand-authored slot layouts that need manual control |
| **V2 ("2.0")**          | Set `schemaVersion` to `"2.0"` and supply `structureTemplate` | `structureTemplate`, optional `additionalSlots`, optional `clothingSlotMappings` | `slots`, `parts`, `compose`            | Template-driven non-human or repeatable body plans              |

When a V2 blueprint is loaded, the loader generates slots from the referenced template, merges them with any `additionalSlots`, stores the resulting socket list on `_generatedSockets`, and returns the enriched blueprint. During anatomy creation, the factory merges `_generatedSockets` with the root entity's existing `anatomy:sockets` component, with template sockets overriding duplicates.

### Key Blueprint Properties

- **`structureTemplate`**: Namespaced identifier pointing at a structure template asset. The template must already be registered by the data loader or validation will fail.
- **`additionalSlots`**: Optional object that adds or overrides slots after template generation. Supplying a `parent` field allows intentional remapping of template slots (e.g., centaur arm attachments).
- **`clothingSlotMappings`**: Same structure for both versions; maps blueprint slots or raw sockets to clothing slots. Validation enforces at least one of `blueprintSlots` or `anatomySockets` plus the allowed layer list.

**Reference Files**:

- Blueprint schema: `data/schemas/anatomy.blueprint.schema.json`
- Structure template schema: `data/schemas/anatomy.structure-template.schema.json`
- Runtime processing: `src/anatomy/bodyBlueprintFactory/blueprintLoader.js`, `src/anatomy/bodyBlueprintFactory/bodyBlueprintFactory.js`
- Socket and slot generation: `src/anatomy/socketGenerator.js`, `src/anatomy/slotGenerator.js`
- Shared orientation logic: `src/anatomy/shared/orientationResolver.js`
- Example blueprints: `data/mods/anatomy/blueprints/` (V2 examples: `giant_spider.blueprint.json`, `red_dragon.blueprint.json`)

---

## Structure Templates

### Format Overview

Every template contains an `id` and `topology.rootType`. Limb sets and appendages are optional but provide most of the automation. Template files are validated through `anatomyStructureTemplateLoader`, which runs the JSON schema and additional checks before registration.

**Location**: `data/mods/anatomy/structure-templates/`
**Loader**: `src/loaders/anatomyStructureTemplateLoader.js`

### Limb Sets

- Required fields: `type`, `count` (1–100), and `socketPattern`
- Optional fields: `arrangement` (`bilateral`, `radial`, `quadrupedal`, `linear`, `custom`), `optional`, and `arrangementHint` for extra context
- The generator iterates from 1..count and applies the socket pattern for each limb

### Appendages

- Required fields: `type`, `count` (1–10), `attachment` (`anterior`, `posterior`, `dorsal`, `ventral`, `lateral`, `custom`), and `socketPattern`
- Optional `optional` flag mirrors limb sets
- Socket generation uses the same template resolver as limb sets

### Socket Patterns

- Fields: `idTemplate`, `allowedTypes`, optional `orientationScheme`, `nameTpl`, and `positions`
- Valid `orientationScheme` values are `bilateral`, `radial`, `indexed`, and `custom`. Internally, the resolver also accepts `quadrupedal` to support future patterns
- `OrientationResolver` is the shared implementation used by both socket and slot generators, ensuring slot keys and socket IDs stay aligned

### Name Templates

If `nameTpl` is omitted, generated parts default to `"{{type}} {{index}}"`. Providing `{{orientation}}` or other placeholders customizes the display name while leaving the socket ID untouched.

### Example Structure Template

```json
{
  "$schema": "schema://living-narrative-engine/anatomy.structure-template.schema.json",
  "id": "anatomy:structure_arachnid_8leg",
  "description": "Eight-legged arachnid body plan",
  "topology": {
    "rootType": "cephalothorax",
    "limbSets": [
      {
        "type": "leg",
        "count": 8,
        "arrangement": "radial",
        "socketPattern": {
          "idTemplate": "leg_{{index}}",
          "orientationScheme": "indexed",
          "allowedTypes": ["spider_leg"],
          "nameTpl": "leg {{index}}"
        }
      }
    ],
    "appendages": [
      {
        "type": "pedipalp",
        "count": 2,
        "attachment": "anterior",
        "socketPattern": {
          "idTemplate": "pedipalp_{{orientation}}",
          "orientationScheme": "bilateral",
          "allowedTypes": ["spider_pedipalp"],
          "nameTpl": "pedipalp ({{orientation}})"
        }
      }
    ]
  }
}
```

**Working Examples**: `data/mods/anatomy/structure-templates/` contains `structure_arachnid_8leg.structure-template.json`, `structure_winged_quadruped.structure-template.json`, `structure_centauroid.structure-template.json`, and `structure_octopoid.structure-template.json`

---

## Blueprint Authoring

### Best Practices

- Prefer reusable templates (`structure_winged_quadruped`, `structure_centauroid`, etc.) and share them across multiple blueprints to minimize maintenance
- Use `additionalSlots` only for genuinely unique attachments or to change parents; the loader already warns on accidental duplicates without overrides
- Document each template with a descriptive `description` to aid mod authors and reviewers

### Example V2 Blueprint

```json
{
  "$schema": "schema://living-narrative-engine/anatomy.blueprint.schema.json",
  "id": "anatomy:giant_spider",
  "schemaVersion": "2.0",
  "root": "anatomy:spider_cephalothorax",
  "structureTemplate": "anatomy:structure_arachnid_8leg",
  "additionalSlots": {
    "spinnerets": {
      "socket": "spinnerets",
      "requirements": {
        "partType": "spinneret",
        "components": ["anatomy:part"]
      }
    }
  }
}
```

### Troubleshooting Blueprints

- **"structureTemplate required when schemaVersion is 2.0"**: Ensure the blueprint includes a valid `structureTemplate` string; V2 mode disallows `slots`, `parts`, and `compose`
- **Template not found**: The loader throws `ValidationError` if the structure template ID is missing from the registry—confirm the template file loaded successfully
- **Unexpected socket names**: Revisit the template's `orientationScheme` and `positions`. `OrientationResolver` falls back to numeric indices if the requested position is missing
- **Recipe pattern mismatches**: Pattern validators rely on the structure template; run the recipe through pattern validation to see which slot groups are missing or empty

---

## Recipe Pattern Matching

### Pattern Overview

Recipes support one legacy matcher and three V2 matchers. Exactly one matcher must be present per pattern; validators reject any pattern with zero or multiple matcher fields.

| Matcher          | Description                                                                                          | Example                                                                 |
| ---------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `matches`        | Explicit array of slot keys (V1 compatibility)                                                       | `{ "matches": ["leg_front_left"], "partType": "custom_leg" }`           |
| `matchesGroup`   | Resolves structure-template groups (`limbSet` / `appendage`). Requires blueprint schemaVersion `2.0` | `{ "matchesGroup": "limbSet:leg", "partType": "spider_leg" }`           |
| `matchesPattern` | Wildcard match against slot keys generated by the blueprint                                          | `{ "matchesPattern": "leg_*", "partType": "spider_leg" }`               |
| `matchesAll`     | Property-based filter (`slotType`, `orientation`, `socketId`)                                        | `{ "matchesAll": { "orientation": "*_left" }, "partType": "left_leg" }` |

Common optional fields (`preferId`, `tags`, `notTags`, `properties`) are copied verbatim into each resolved slot. `properties` is shallow-cloned; nested objects are not deep-cloned by the resolver.

### Lifecycle Overview

1. The recipe pattern resolver (`resolveRecipePatterns`) receives a recipe and the fully processed blueprint (generated slots merged with `additionalSlots`)
2. Each pattern is validated to ensure exactly one matcher is present and that the blueprint supports it
3. Patterns are resolved in order. For every matched slot key the resolver copies common fields into the output slot unless a higher-precedence source already set it
4. The resolver records hints and conflicts, including overlaps with equal specificity

**Implementation**: `src/anatomy/recipePatternResolver/patternResolver.js`, `matchers/*.js`, `validators/*.js`

### Precedence Rules

When multiple definitions target the same slot key:

1. Explicit entries in `recipe.slots` win
2. Blueprint `additionalSlots` override remaining pattern output
3. Among patterns, the first pattern in the array that matches the slot applies

Pattern specificity (explicit list → property filter → wildcard → slot group) is used only to raise warnings about overlapping definitions; it does not change these precedence rules.

### matchesGroup: Structure Template Integration

- Format: `"limbSet:{type}"` or `"appendage:{type}"` where `{type}` matches the `type` property defined in the referenced structure template
- Prerequisites: the blueprint must declare `schemaVersion: "2.0"` and `structureTemplate`, and the template must be registered
- Failure modes: the resolver raises validation errors when the group does not exist or generates zero slots
- Usage tip: When a template defines multiple limb sets with the same `type`, the matcher returns all of them; combine with `matchesPattern` or `matchesAll` if you need to separate subsets

**Example**:

```json
{
  "matchesGroup": "limbSet:leg",
  "partType": "spider_leg",
  "tags": ["anatomy:part", "anatomy:segmented"]
}
```

### matchesPattern: Wildcard Slot Key Matching

- Accepts lowercase letters, digits, and underscores with optional `*` wildcards at the start, end, or between tokens (e.g., `leg_*`, `*_left`, `*tentacle*`)
- Patterns are matched case-sensitively against blueprint slot keys. Wildcards expand to `.*` in the generated regular expression
- A pattern that matches no slots is allowed but produces a validation warning

### matchesAll: Property Filters

- Supported properties: `slotType`, `orientation`, and `socketId` (mapped to the slot's `socket` value). At least one property is required
- `slotType` comparisons are exact; wildcards are rejected. `orientation` and `socketId` accept `*` wildcards converted to regular expressions
- Filtering operates on the blueprint's merged slot definitions

**Example**:

```json
{
  "matchesAll": {
    "slotType": "leg",
    "orientation": "*_left"
  },
  "partType": "left_leg",
  "tags": ["anatomy:part", "anatomy:scaled"]
}
```

### Exclusions

Use the optional `exclude` object to remove slots from a pattern after matching:

- `slotGroups`: array of group references (same format as `matchesGroup`). The resolver reuses structure template lookups to remove the referenced slots
- `properties`: key-value pairs compared directly against blueprint slot definitions (no wildcard support)

**Example**:

```json
{
  "matchesGroup": "limbSet:leg",
  "partType": "normal_leg",
  "exclude": {
    "slotGroups": ["limbSet:special_leg"],
    "properties": { "orientation": "mid" }
  }
}
```

### Conflict Detection

- The resolver gathers `_patternHints` when a pattern loses its matcher (e.g., because exclusions removed every slot)
- `_patternConflicts` capture precedence situations such as explicit slot overrides or blueprint `additionalSlots` replacing a pattern result
- Enable debug-level logging on the resolver to inspect slot counts for each pattern

---

## Recipe Creation Workflow

### Preparation

#### Choose the blueprint version

- **V1 blueprints**: explicit slot maps and optional `compose` blocks. Suited to humanoid or asymmetric bodies
- **V2 blueprints**: rely on a `structureTemplate` to generate slot groups. Use these for creatures with repeated limbs

#### Gather parts and components

- Reuse component schemas from `data/mods/anatomy/components/` (`anatomy:part`, `anatomy:sockets`, `anatomy:joint`, `anatomy:body`)
- Descriptor components such as `descriptors:texture` live in `data/mods/descriptors/components/`
- Confirm required entity definitions in `data/mods/anatomy/entities/definitions/`

#### Confirm body descriptor values

The registry at `src/anatomy/registries/bodyDescriptorRegistry.js` is the single source of truth:

- `height`: microscopic, minuscule, tiny, petite, short, average, tall, very-tall, gigantic, colossal, titanic
- `build`: skinny, slim, lissom, toned, athletic, shapely, hourglass, thick, muscular, hulking, stocky, frail, gaunt, skeletal, atrophied, cadaverous, massive, willowy, barrel-chested, lanky
- `composition`: underweight, lean, average, soft, chubby, overweight, obese, atrophied, emaciated, skeletal, malnourished, dehydrated, wasted, desiccated, bloated, rotting
- `hairDensity`: hairless, sparse, light, moderate, hairy, very-hairy, furred
- `skinColor` and `smell`: free-form strings validated only for presence

Run `npm run validate:body-descriptors` after editing descriptors.

### Implementation Steps

#### 1. Reuse or add component schemas (if needed)

- Check for existing schemas in `data/mods/anatomy/components/` and `data/mods/descriptors/components/`
- New schemas must use the component schema reference:
  ```json
  {
    "$schema": "schema://living-narrative-engine/component.schema.json",
    "id": "namespace:componentId",
    "description": "What the component does",
    "dataSchema": {
      "type": "object",
      "properties": {},
      "required": [],
      "additionalProperties": false
    }
  }
  ```
- Validate with `npm run validate`

#### 2. Reuse or add entity definitions

- Store entities in `data/mods/anatomy/entities/definitions/{name}.entity.json`
- Each entity must include at least `anatomy:part` (with the appropriate `subType`) and `core:name`
- Add descriptor components (e.g., `descriptors:texture`) from the descriptors mod when parts need cosmetic data

**Example structure**:

```json
{
  "id": "anatomy:spider_leg",
  "components": {
    "anatomy:part": { "subType": "spider_leg" },
    "core:name": { "text": "spider leg" },
    "descriptors:texture": { "texture": "chitinous" }
  }
}
```

#### 3. Build or update the blueprint

- Save blueprints in `data/mods/anatomy/blueprints/{name}.blueprint.json`
- **V1 blueprint essentials**: define `id`, `root`, optional `compose` blocks, explicit `slots`, and optional `clothingSlotMappings`
- **V2 blueprint essentials**: include `schemaVersion: "2.0"`, `structureTemplate`, `id`, and `root`. Optional `additionalSlots` cover exceptions beyond the template
- When debugging slot orientation, consult `src/anatomy/shared/orientationResolver.js`

#### 4. Author the recipe

- Recipes live in `data/mods/anatomy/recipes/{name}.recipe.json` and must reference `schema://living-narrative-engine/anatomy.recipe.schema.json`
- Required fields: `recipeId`, `blueprintId`, and `slots` (use `{}` if relying entirely on patterns)

**Slot definitions** accept `partType` plus optional `preferId`, `tags`, `notTags`, and component `properties` maps:

```json
"slots": {
  "spinnerets": {
    "partType": "spinneret",
    "tags": ["anatomy:part"],
    "properties": {
      "descriptors:texture": { "texture": "chitinous" },
      "descriptors:body_hair": { "hairDensity": "hairy" }
    }
  }
}
```

**Pattern definitions**: Choose exactly one matcher (`matchesGroup`, `matchesPattern`, or `matchesAll`). Combine with the same `partType`, `tags`, `notTags`, `properties`, and optional `preferId`/`exclude`.

**Body descriptors** must use the registry values listed in the preparation section.

**Constraints** support `requires` and `excludes` arrays with `partTypes`, `components`, and optional `validation` metadata.

**Clothing entities** are objects, not strings:

```json
"clothingEntities": [
  {
    "entityId": "clothing:leather_vest",
    "equip": true,
    "targetSlot": "torso_upper",
    "layer": "outer",
    "properties": { "color": "brown" }
  }
]
```

#### 5. Validate and test the flow

- Run global schema checks with `npm run validate`
- Spot-check the recipe in `anatomy-visualizer.html` to confirm the anatomy graph
- Add or update integration coverage in `tests/integration/anatomy/` using the helpers in `tests/common/anatomy/anatomyIntegrationTestBed.js`
- Execute targeted tests: `npm run test:integration -- tests/integration/anatomy/<test-name>.test.js`

### Common Pitfalls

- **Descriptor components missing from entities** → descriptor-driven recipe properties silently fail. Ensure entity definitions include the right `descriptors:*` components
- **Blueprint/recipe version mismatch** → V2 blueprints ignore V1-only fields like `slots`, while V1 blueprints do not understand `structureTemplate`
- **Pattern matcher conflicts** → each pattern supports exactly one of `matches`, `matchesGroup`, `matchesPattern`, or `matchesAll`
- **Omitting the `slots` object** → even pattern-only recipes must declare `"slots": {}`
- **Skipping validation** → run `npm run validate`, `npm run validate:recipe`, and `npm run validate:body-descriptors` before opening the visualizer

---

## Validation and Testing

### Validation Commands

- **Recipe validation**: `npm run validate:recipe [--verbose|--json] <path>` loads the minimal mod set, runs schema + pre-flight checks, and exits non-zero on errors
- **Descriptor audit**: `npm run validate:body-descriptors` validates formatting config and sample recipes using the registry-aware validator
- **Global validation**: `npm run validate` triggers the full mod validation pipeline

### Testing

Integration coverage is documented in [anatomy-testing-guide.md](./anatomy-testing-guide.md). Key patterns:

- Use `AnatomyIntegrationTestBed` for full workflow tests
- Call `await loadAnatomyModData()` before executing workflows
- Target specific test files with `npm run test:integration -- --testPathPattern=<pattern>`

**Diagnostic Tools**:

- Pattern resolution integration suite: `npm run test:integration -- recipePatternResolution`
- When debugging mismatches, inspect the merged blueprint slots (`bodyBlueprintFactory.createAnatomyGraph`)
- Temporarily add explicit slot entries in the recipe to verify slot keys and confirm precedence behavior

---

## Migration Guide

### Migrating a V1 Blueprint to V2

1. Identify repeated slot patterns in the V1 asset and capture them as limb sets or appendages in a new structure template file under `data/mods/anatomy/structure-templates/`
2. Update the blueprint to set `schemaVersion` to `"2.0"`, reference the template via `structureTemplate`, and move bespoke sockets into `additionalSlots`. The loader will warn if `additionalSlots` duplicates a generated slot without redefining the parent
3. Keep any existing `clothingSlotMappings`; they are valid in both versions
4. Test by instantiating the blueprint through the `BodyBlueprintFactory`; `_generatedSockets` will populate the entity with the template sockets

### Common Migration Issues

- **Manifest key mismatch**: Ensure the manifest uses `"structure-templates"` inside `content`; the loader ignores the camelCase variant
- **Socket ID drift**: Keep entity-defined socket IDs aligned with the template output so the runtime merge replaces older data instead of duplicating sockets
- **Recipe type typos**: `partType` values in patterns must match the `anatomy:part.subType` of your entities

---

## Reference Material

### Documentation

- [Anatomy System Guide](./anatomy-system-guide.md) – Architectural overview
- [Body Descriptors Complete](./body-descriptors-complete.md) – Descriptor system reference
- [Non-Human Quickstart](./non-human-quickstart.md) – Step-by-step creature creation tutorial
- [Troubleshooting](./troubleshooting.md) – Error catalog and symptom-based debugging
- [Anatomy Testing Guide](./anatomy-testing-guide.md) – Testing patterns

### Schemas

- `data/schemas/anatomy.recipe.schema.json`
- `data/schemas/anatomy.blueprint.schema.json`
- `data/schemas/anatomy.structure-template.schema.json`
- `data/schemas/component.schema.json`
- `data/schemas/entity-definition.schema.json`

### Working Files

- `data/mods/anatomy/recipes/human_male.recipe.json`
- `data/mods/anatomy/recipes/giant_forest_spider.recipe.json`
- `data/mods/anatomy/blueprints/human_male.blueprint.json`
- `data/mods/anatomy/blueprints/giant_spider.blueprint.json`
- `data/mods/anatomy/structure-templates/structure_arachnid_8leg.structure-template.json`

---

**Maintained By**: Living Narrative Engine Core Team
**Last Reviewed**: 2025-11-12
