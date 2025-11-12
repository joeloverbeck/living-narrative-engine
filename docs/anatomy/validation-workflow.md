# Anatomy System Validation Workflow

This guide documents how anatomy data is validated from schema load to runtime graph checks. Each stage below lists the code responsible for the validation, what it covers, and how it is triggered so that the document always reflects the current implementation.

## Pipeline Snapshot

| Stage | Purpose | Implementation | Trigger |
| --- | --- | --- | --- |
| 1. Schema validation | Enforce JSON schemas for anatomy content before anything is stored | `AjvSchemaValidator.validate(schemaId, data)` in `src/validation/ajvSchemaValidator.js`【F:src/validation/ajvSchemaValidator.js†L662-L718】 | Executed during `SchemaPhase` while loading mods (including the recipe CLI path)【F:scripts/validate-recipe.js†L88-L119】 |
| 2. Recipe pre-flight | Consolidated static checks on a recipe and its supporting data | `RecipePreflightValidator` in `src/anatomy/validation/RecipePreflightValidator.js`【F:src/anatomy/validation/RecipePreflightValidator.js†L90-L149】 | Automatically after schema validation in loaders and via `npm run validate:recipe`【F:scripts/validate-recipe.js†L14-L32】【F:package.json†L96-L107】 |
| 3. Runtime generation | Ensure blueprint slots exist and generated graphs are structurally sound | `validateRecipeSlots` + `GraphIntegrityValidator` in the body blueprint factory【F:src/anatomy/bodyBlueprintFactory/blueprintValidator.js†L33-L74】【F:src/anatomy/graphIntegrityValidator.js†L1-L140】 | Called from `BodyBlueprintFactory.createAnatomyGraph` during anatomy generation【F:src/anatomy/bodyBlueprintFactory/bodyBlueprintFactory.js†L256-L299】 |
| 4. Descriptor consistency | Keep descriptor values, registry metadata, and formatting config aligned | Runtime validator in `src/anatomy/utils/bodyDescriptorValidator.js` and CLI validator in `src/anatomy/validators/bodyDescriptorValidator.js`【F:src/anatomy/utils/bodyDescriptorValidator.js†L12-L133】【F:scripts/validate-body-descriptors.js†L9-L104】 | Invoked from loaders/runtime checks and by `npm run validate:body-descriptors`【F:src/loaders/anatomyRecipeLoader.js†L66-L108】【F:package.json†L96-L107】 |

## Stage 1 — Schema Validation

* **Implementation:** `AjvSchemaValidator.validate(schemaId, data)` performs an Ajv check and (if available) an enhanced validator pass for clearer messages.【F:src/validation/ajvSchemaValidator.js†L662-L718】
* **Coverage:** Anatomy schemas for recipes, blueprints, structure templates, and related JSON definitions under `data/schemas/`. The validator relies on schema IDs loaded during the schema phase.
* **When it runs:** The mod loading pipeline executes the schema phase before manifest/content phases; the recipe CLI mirrors this by resolving the same phases before reporting validation results.【F:scripts/validate-recipe.js†L88-L119】

## Stage 2 — Recipe Pre-flight Validation

`RecipePreflightValidator` chains eleven checks and records errors, warnings, suggestions, and passes in a `ValidationReport`.【F:src/anatomy/validation/RecipePreflightValidator.js†L90-L149】【F:src/anatomy/validation/ValidationReport.js†L9-L98】 The checks map directly to helper rules/functions in the code:

1. **Component existence:** Confirms every referenced component is registered via `ComponentExistenceValidationRule`.【F:src/anatomy/validation/RecipePreflightValidator.js†L151-L178】【F:src/anatomy/validation/rules/componentExistenceValidationRule.js†L16-L123】
2. **Property schemas:** Validates component property payloads with `PropertySchemaValidationRule`.【F:src/anatomy/validation/RecipePreflightValidator.js†L200-L221】【F:src/anatomy/validation/rules/propertySchemaValidationRule.js†L16-L204】
3. **Body descriptor fields:** Cross-checks descriptor keys and enums against the `anatomy:body` component schema. Unknown keys and enum mismatches are hard errors.【F:src/anatomy/validation/RecipePreflightValidator.js†L224-L318】
4. **Blueprint existence:** Ensures the referenced blueprint can be resolved before later checks run.【F:src/anatomy/validation/RecipePreflightValidator.js†L326-L355】
5. **Additional-slot socket wiring:** Uses `validateSocketSlotCompatibility` to confirm blueprint `additionalSlots` reference sockets that actually exist on the root entity (optional slots are skipped).【F:src/anatomy/validation/RecipePreflightValidator.js†L361-L389】【F:src/anatomy/validation/socketSlotCompatibilityValidator.js†L76-L170】
6. **Pattern dry run:** Resolves patterns against a processed blueprint to warn when expressions match nothing.【F:src/anatomy/validation/RecipePreflightValidator.js†L447-L500】
7. **Descriptor coverage suggestions:** Highlights slots that will not contribute to descriptions because no descriptor components are present in the slot definition or preferred entity.【F:src/anatomy/validation/RecipePreflightValidator.js†L502-L548】
8. **Explicit part availability:** Verifies that entity definitions exist for every explicit slot and pattern requirement.【F:src/anatomy/validation/RecipePreflightValidator.js†L590-L649】
9. **Generated slot availability:** Simulates pattern expansion (including structure-template sockets) and checks that every derived slot still has matching entity definitions.【F:src/anatomy/validation/RecipePreflightValidator.js†L702-L854】
10. **Entity load failures:** Surfaces loaders’ recorded entity-definition failures to explain upstream missing data.【F:src/anatomy/validation/RecipePreflightValidator.js†L1041-L1108】
11. **Recipe usage hint:** Warns when no entity definition references the recipe’s ID, which is a common configuration oversight.【F:src/anatomy/validation/RecipePreflightValidator.js†L1155-L1194】

`npm run validate:recipe` instantiates the validator through the DI container and can emit verbose or JSON output for tooling automation.【F:scripts/validate-recipe.js†L14-L69】【F:package.json†L96-L107】

## Stage 3 — Runtime Generation Validation

* **Blueprint slot enforcement:** `validateRecipeSlots` throws when a recipe declares slots that the blueprint does not define (with allowances for special `torso`/`root` overrides).【F:src/anatomy/bodyBlueprintFactory/blueprintValidator.js†L33-L74】
* **Graph integrity:** After the graph is built, `GraphIntegrityValidator` runs six rule classes—socket limits, recipe constraints, cycle detection, joint completeness, orphan detection, and part-type compatibility—before anatomy is returned to callers.【F:src/anatomy/graphIntegrityValidator.js†L10-L139】【F:src/anatomy/bodyBlueprintFactory/bodyBlueprintFactory.js†L256-L299】
* **Optional helper:** `checkBlueprintRecipeCompatibility` is available for diagnostics and tests, reporting missing required slots or ignored extras, but it is not currently invoked automatically by the workflow.【F:src/anatomy/bodyBlueprintFactory/blueprintValidator.js†L76-L209】

## Stage 4 — Body Descriptor Consistency

* **Runtime enforcement:** `BodyDescriptorValidator.validate(...)` (in `src/anatomy/utils`) is called from the anatomy generation workflow to reject unknown descriptor keys and invalid enum values during live use.【F:src/anatomy/utils/bodyDescriptorValidator.js†L12-L69】【F:src/anatomy/workflows/anatomyGenerationWorkflow.js†L172-L214】
* **Loader checks and CLI:** The loader-level validator in `src/anatomy/validators/bodyDescriptorValidator.js` returns structured errors/warnings, powering both `AnatomyRecipeLoader` (development-mode failures) and the `npm run validate:body-descriptors` script, which also verifies the formatting configuration.【F:src/loaders/anatomyRecipeLoader.js†L66-L108】【F:scripts/validate-body-descriptors.js†L9-L104】

### Descriptor Registry Snapshot

| Descriptor | Display key | Type | Valid values |
| --- | --- | --- | --- |
| `height` | `height` | Enumerated | microscopic, minuscule, tiny, petite, short, average, tall, very-tall, gigantic, colossal, titanic【F:src/anatomy/registries/bodyDescriptorRegistry.js†L42-L52】 |
| `skinColor` | `skin_color` | Free-form | Any string【F:src/anatomy/registries/bodyDescriptorRegistry.js†L53-L63】 |
| `build` | `build` | Enumerated | skinny, slim, lissom, toned, athletic, shapely, hourglass, thick, muscular, hulking, stocky, frail, gaunt, skeletal, atrophied, cadaverous, massive, willowy, barrel-chested, lanky【F:src/anatomy/registries/bodyDescriptorRegistry.js†L64-L74】 |
| `composition` | `body_composition` | Enumerated | underweight, lean, average, soft, chubby, overweight, obese, atrophied, emaciated, skeletal, malnourished, dehydrated, wasted, desiccated, bloated, rotting【F:src/anatomy/registries/bodyDescriptorRegistry.js†L75-L85】 |
| `hairDensity` | `body_hair` | Enumerated | hairless, sparse, light, moderate, hairy, very-hairy, furred【F:src/anatomy/registries/bodyDescriptorRegistry.js†L86-L96】 |
| `smell` | `smell` | Free-form | Any string【F:src/anatomy/registries/bodyDescriptorRegistry.js†L97-L107】 |

## Tooling Reference

* **Recipe validation:** `npm run validate:recipe [--verbose|--json] <path>` loads the minimal mod set, runs schema + pre-flight checks, and exits non-zero on errors.【F:scripts/validate-recipe.js†L14-L69】【F:package.json†L96-L107】
* **Descriptor audit:** `npm run validate:body-descriptors` validates formatting config and sample recipes using the registry-aware validator.【F:scripts/validate-body-descriptors.js†L9-L104】【F:package.json†L96-L107】

## Working Notes

* Keep schema IDs stable—stage 1 relies on them to link JSON files to validators.【F:src/validation/ajvSchemaValidator.js†L662-L718】
* Missing data reported in stage 2 often traces back to entity-definition load failures; inspect the propagated loader error details before modifying recipes.【F:src/anatomy/validation/RecipePreflightValidator.js†L1041-L1108】
* Runtime descriptor errors originate from the stricter utility validator; if a value works in the CLI but fails in-game, double-check casing and enum membership against the registry table above.【F:src/anatomy/utils/bodyDescriptorValidator.js†L48-L70】【F:src/anatomy/registries/bodyDescriptorRegistry.js†L42-L107】
