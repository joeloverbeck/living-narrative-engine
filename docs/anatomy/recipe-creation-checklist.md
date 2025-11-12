# Recipe Creation Checklist

Use this checklist when adding or updating anatomy recipes so that new content remains compatible with the current anatomy system.

## Preparation

### Choose the blueprint version
- **V1 blueprints** (`schemaVersion` omitted or `"1.0"`): explicit slot maps and optional `compose` blocks. Suited to humanoid or asymmetric bodies. Example: `data/mods/anatomy/blueprints/human_male.blueprint.json`.
- **V2 blueprints** (`schemaVersion: "2.0"`): rely on a `structureTemplate` in `data/mods/anatomy/structure-templates/` to generate slot groups. Use these for creatures with repeated limbs (spiders, dragons, centaurs). Example: `data/mods/anatomy/blueprints/giant_spider.blueprint.json`.

### Gather parts and components
- Reuse component schemas from `data/mods/anatomy/components/` (`anatomy:part`, `anatomy:sockets`, `anatomy:joint`, `anatomy:body`). Descriptor components such as `descriptors:texture` live in `data/mods/descriptors/components/`.
- Confirm required entity definitions in `data/mods/anatomy/entities/definitions/`. Existing files like `spider_leg.entity.json` and `human_male_torso.entity.json` illustrate current patterns.

### Confirm body descriptor values
- The registry at `src/anatomy/registries/bodyDescriptorRegistry.js` is the single source of truth.
- Valid enumerations:
  - `height`: microscopic, minuscule, tiny, petite, short, average, tall, very-tall, gigantic, colossal, titanic
  - `build`: skinny, slim, lissom, toned, athletic, shapely, hourglass, thick, muscular, hulking, stocky, frail, gaunt, skeletal, atrophied, cadaverous, massive, willowy, barrel-chested, lanky
  - `composition`: underweight, lean, average, soft, chubby, overweight, obese, atrophied, emaciated, skeletal, malnourished, dehydrated, wasted, desiccated, bloated, rotting
  - `hairDensity`: hairless, sparse, light, moderate, hairy, very-hairy, furred
  - `skinColor` and `smell`: free-form strings validated only for presence
- Run `npm run validate:body-descriptors` after editing descriptors.

## Implementation Steps

### 1. Reuse or add component schemas (if needed)
- Check for existing schemas in `data/mods/anatomy/components/` and `data/mods/descriptors/components/`.
- New schemas must use the component schema reference:
  ```json
  {
    "$schema": "schema://living-narrative-engine/component.schema.json",
    "id": "namespace:componentId",
    "description": "What the component does",
    "dataSchema": { "type": "object", "properties": {}, "required": [], "additionalProperties": false }
  }
  ```
- Validate with `npm run validate` to ensure the new component conforms to schema rules.

### 2. Reuse or add entity definitions
- Store entities in `data/mods/anatomy/entities/definitions/{name}.entity.json`.
- Each entity must include at least `anatomy:part` (with the appropriate `subType`) and `core:name`. Add descriptor components (e.g., `descriptors:texture`) from the descriptors mod when parts need cosmetic data.
- Example structure (`spider_leg.entity.json`):
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
- Re-run `npm run validate` after adding entities.

### 3. Build or update the blueprint
- Save blueprints in `data/mods/anatomy/blueprints/{name}.blueprint.json`.
- **V1 blueprint essentials**: define `id`, `root`, optional `compose` blocks, explicit `slots`, and optional `clothingSlotMappings`. See `human_male.blueprint.json` for a working example with composed slots and clothing mappings.
- **V2 blueprint essentials**: include `schemaVersion: "2.0"`, `structureTemplate`, `id`, and `root`. Optional `additionalSlots` cover exceptions beyond the template. Confirm the referenced template (e.g., `structure_arachnid_8leg.structure-template.json`) supplies the expected socket groups.
- When debugging slot orientation, consult `src/anatomy/shared/orientationResolver.js` to ensure template orientation schemes align with expectations.
- Validate blueprints with `npm run validate`.

### 4. Author the recipe
- Recipes live in `data/mods/anatomy/recipes/{name}.recipe.json` and must reference `schema://living-narrative-engine/anatomy.recipe.schema.json`.
- Required fields: `recipeId`, `blueprintId`, and `slots` (use `{}` if relying entirely on patterns).
- **Slot definitions** accept `partType` plus optional `preferId`, `tags`, `notTags`, and component `properties` maps. Example:
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
- **Pattern definitions**:
  - V1 compatibility: use `matches` with explicit slot keys.
  - V2 enhancements: choose exactly one matcher (`matchesGroup`, `matchesPattern`, or `matchesAll`). Combine with the same `partType`, `tags`, `notTags`, `properties`, and optional `preferId`/`exclude`. Example (`giant_forest_spider.recipe.json`):
    ```json
    {
      "matchesGroup": "limbSet:leg",
      "partType": "spider_leg",
      "tags": ["anatomy:part"],
      "properties": {
        "descriptors:texture": { "texture": "chitinous" },
        "descriptors:body_hair": { "hairDensity": "hairy" }
      }
    }
    ```
- **Body descriptors** must use the registry values listed in the preparation section.
- **Constraints** support `requires` and `excludes` arrays with `partTypes`, `components`, and optional `validation` metadata (custom error messages, minimum items, mutual exclusion hints).
- **Clothing entities** are objects, not strings:
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
- Validate individual recipes with `npm run validate:recipe data/mods/anatomy/recipes/<file>.recipe.json` and re-run `npm run validate:body-descriptors` when descriptor values change.

### 5. Validate and test the flow
- Run global schema checks with `npm run validate`.
- Spot-check the recipe in `anatomy-visualizer.html` (served from the project root) to confirm the anatomy graph and descriptor text.
- Add or update integration coverage in `tests/integration/anatomy/` using the helpers in `tests/common/anatomy/anatomyIntegrationTestBed.js`, then execute targeted tests:
  ```bash
  npm run test:integration -- tests/integration/anatomy/<test-name>.test.js
  ```

## Common Pitfalls
- **Descriptor components missing from entities** → descriptor-driven recipe properties silently fail. Ensure entity definitions include the right `descriptors:*` components from `data/mods/descriptors/components/` before expecting recipes to override values.
- **Blueprint/recipe version mismatch** → V2 blueprints ignore V1-only fields like `slots`, while V1 blueprints do not understand `structureTemplate`. Decide on the version first and stick to its schema (`additionalSlots` is the V2 path for bespoke sockets).
- **Pattern matcher conflicts** → each pattern supports exactly one of `matches`, `matchesGroup`, `matchesPattern`, or `matchesAll`. Choose the matcher that lines up with the blueprint's slot naming or template groupings.
- **Omitting the `slots` object** → even pattern-only recipes must declare `"slots": {}` to satisfy the schema.
- **Skipping validation** → run `npm run validate`, `npm run validate:recipe`, and `npm run validate:body-descriptors` before opening the visualizer to avoid hard-to-debug runtime issues.

## Reference Material
- **Guides**: `docs/anatomy/anatomy-system-guide.md`, `docs/anatomy/blueprints-and-templates.md`, `docs/anatomy/recipe-pattern-matching.md`, `docs/anatomy/body-descriptors-complete.md`, `docs/testing/mod-testing-guide.md`.
- **Schemas**: `data/schemas/anatomy.recipe.schema.json`, `data/schemas/anatomy.blueprint.schema.json`, `data/schemas/anatomy.structure-template.schema.json`, `data/schemas/component.schema.json`, `data/schemas/entity-definition.schema.json`.
- **Working files**: `data/mods/anatomy/recipes/human_male.recipe.json`, `data/mods/anatomy/recipes/giant_forest_spider.recipe.json`, `data/mods/anatomy/blueprints/human_male.blueprint.json`, `data/mods/anatomy/blueprints/giant_spider.blueprint.json`, `data/mods/anatomy/structure-templates/structure_arachnid_8leg.structure-template.json`.
