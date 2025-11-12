# Anatomy System Error Catalog

This catalog summarizes the error surfaces that currently exist in the anatomy system. It complements the problem-led workflows in [troubleshooting.md](./troubleshooting.md) by focusing on individual error messages, the code that raises them, and the fastest way to confirm and fix the underlying issue. The anatomy stack now splits errors between **load-time validation** (handled by `RecipePreflightValidator`) and **runtime graph validation** (driven by `GraphIntegrityValidator` and supporting services); the tables and sections below reflect that behaviour.

## How to Use This Catalog
- Start with the quick-reference table to locate the section that documents the message you are seeing.
- Each section lists the exact module that raises the message, the trigger, focused diagnostics, and representative fixes pulled from the current data set under `data/mods`.
- When you need architectural context or end-to-end workflows, move to [troubleshooting.md](./troubleshooting.md) or [anatomy-system-guide.md](./anatomy-system-guide.md).

## Quick Reference

| Message Snippet | Error / Warning | Raised By | Section |
| --- | --- | --- | --- |
| `Recipe validation failed` | `RecipeValidationError` | `src/anatomy/validation/RecipePreflightValidator.js` | [Recipe validation failures](#recipe-validation-failures) |
| `Component '…' does not exist in the component registry` | `ComponentNotFoundError` | `componentExistenceValidationRule` | [Missing component references](#missing-component-references) |
| `Property '…' has invalid value '…'` | `InvalidPropertyError` | `propertySchemaValidationRule` | [Property schema violations](#property-schema-violations) |
| `Pattern matchesGroup '…' has no matching slots` | Warning object | `patternMatchingValidator` | [Pattern dry-run warnings](#pattern-dry-run-warnings) |
| `Blueprint '…' does not exist` | Validation issue | `RecipePreflightValidator` blueprint check | [Blueprint availability and compatibility](#blueprint-availability-and-compatibility) |
| `No entity definitions found for slot '…'` | Validation issue | `RecipePreflightValidator` part availability checks | [Part availability at load time](#part-availability-at-load-time) |
| `No entity definitions found matching anatomy requirements` | `ValidationError` | `src/anatomy/partSelectionService.js` | [Runtime part selection failures](#runtime-part-selection-failures) |
| `Socket '…' not found on root entity '…'` | `SocketNotFoundError` / validation issue | `socketSlotCompatibilityValidator` or `SocketLimitRule` | [Socket reference issues](#socket-reference-issues) |
| `Required constraint not satisfied: …` | Validation issue | `RecipeConstraintEvaluator` via `RecipeConstraintRule` | [Runtime constraint violations](#runtime-constraint-violations) |
| `Cycle detected in anatomy graph` | Validation issue | `cycleDetectionRule` | [Cycle detection](#cycle-detection) |
| `Part type '…' not allowed in socket '…'` | Validation issue | `partTypeCompatibilityRule` | [Socket/part type mismatches](#socketpart-type-mismatches) |
| `Orphaned part '…' has parent '…' not in graph` | Validation issue | `orphanDetectionRule` | [Orphan detection and root tracking](#orphan-detection-and-root-tracking) |
| `Entity '…' has incomplete joint data` | Validation issue | `jointConsistencyRule` | [Joint consistency issues](#joint-consistency-issues) |
| `Invalid … descriptor: '…' in …` | `BodyDescriptorValidationError` → `ValidationError` | `bodyDescriptorValidator` utilities | [Body descriptor validation](#body-descriptor-validation) |

---

## Load-Time Validation (RecipePreflightValidator)

### Recipe validation failures
- **Thrown by:** `RecipeValidationError` (`src/anatomy/errors/RecipeValidationError.js`).
- **Trigger:** `RecipePreflightValidator.validate` returns a `ValidationReport` containing at least one error after running the full rule chain (`componentExistence`, `propertySchema`, `bodyDescriptors`, blueprint checks, socket/slot compatibility, pattern dry-run, descriptor coverage, part availability, generated slot availability, load failure audit, recipe usage audit).【F:src/anatomy/validation/RecipePreflightValidator.js†L92-L158】
- **What the report contains:** the `ValidationReport` class exposes `errors`, `warnings`, `suggestions`, `passed`, `isValid`, and a `summary` object with `totalErrors`, `totalWarnings`, `totalSuggestions`, and `passedChecks`. Use `report.toString()` when you need the formatted console view.【F:src/anatomy/validation/ValidationReport.js†L8-L116】
- **Diagnostics:** Capture the report from the thrown error (`error.report`) and review each issue. The `location` payloads point to slots, patterns, or recipe-level data. If you are validating outside of runtime, run `node scripts/validate-recipe.js --recipe anatomy:red_dragon` to regenerate the same report.
- **Fix path:** Resolve the underlying issues listed below (component, property, descriptor, blueprint, pattern, or availability problems) and re-run the validator.

### Missing component references
- **Raised by:** `ComponentExistenceValidationRule` (`src/anatomy/validation/rules/componentExistenceValidationRule.js`).
- **Trigger:** A recipe references a component ID that is not registered in the data registry (`data/mods/**/components`).
- **Typical message:** `Component 'anatomy:horned' does not exist in the component registry` with slot context.【F:src/anatomy/errors/ComponentNotFoundError.js†L21-L45】
- **Diagnostics:**
  - Confirm the component file exists (`find data/mods -name 'horned.component.json'`).
  - Check spelling and namespace; IDs must follow `modId:componentName`.
  - Ensure the mod providing the component is declared in `data/game.json` so the loader pulls it into the registry.
- **Fix:** Create the missing component under `data/mods/<modId>/components/<name>.component.json` using the component schema. Example:
  ```json
  {
    "$schema": "schema://living-narrative-engine/component.schema.json",
    "id": "anatomy:horned",
    "description": "Indicates entity has horns",
    "dataSchema": {
      "type": "object",
      "properties": {
        "hornCount": { "type": "integer", "minimum": 1 },
        "hornType": {
          "type": "string",
          "enum": ["curved", "straight", "spiral"]
        }
      },
      "required": ["hornCount", "hornType"],
      "additionalProperties": false
    }
  }
  ```

### Property schema violations
- **Raised by:** `PropertySchemaValidationRule` (`src/anatomy/validation/rules/propertySchemaValidationRule.js`).
- **Trigger:** A recipe supplies component property values that fail the schema tied to that component in the registry. For example, `descriptors:length_category` only accepts the enumerated `length` values defined in `data/mods/descriptors/components/length_category.component.json` (`very-short` → `immense`).【F:data/mods/descriptors/components/length_category.component.json†L1-L25】
- **Diagnostics:**
  - Inspect the component schema from the data registry; Preflight attaches `validValues` and a `schemaPath` to each error when available.
  - Compare the recipe property to the schema definition to spot enum, type, or required-field issues.
- **Fix:** Align the recipe with the allowed values. Example (from `data/mods/anatomy/recipes/red_dragon.recipe.json`): change `"length": "vast"` to `"length": "immense"` to satisfy the enumerated list.【F:data/mods/anatomy/recipes/red_dragon.recipe.json†L25-L42】

### Body descriptor validation
- **Load-time check:** `RecipePreflightValidator` validates `bodyDescriptors` against the schema embedded in `anatomy:body` (`data/mods/anatomy/components/body.component.json`). Enumerated descriptors (`build`, `hairDensity`, `composition`, `height`) must match the schema, while `skinColor` and `smell` accept free-form strings.【F:data/mods/anatomy/components/body.component.json†L1-L78】
- **Runtime check:** `BodyDescriptorValidator` (`src/anatomy/utils/bodyDescriptorValidator.js`) enforces the registry in `src/anatomy/registries/bodyDescriptorRegistry.js`. It throws `BodyDescriptorValidationError`, which the generation workflow converts to a `ValidationError` to keep the public surface stable.【F:src/anatomy/utils/bodyDescriptorValidator.js†L1-L75】【F:src/anatomy/workflows/anatomyGenerationWorkflow.js†L173-L206】
- **Diagnostics:**
  - Cross-check values against the registry (`getAllDescriptorNames()` and per-descriptor `validValues`). For instance, `build` allows entries such as `athletic`, `hulking`, or `massive`, whereas `height` accepts `microscopic` through `titanic` but not `towering` or `colossal` unless listed.【F:src/anatomy/registries/bodyDescriptorRegistry.js†L29-L88】
  - Ensure no unknown keys slip into `bodyDescriptors`; both the schema and the runtime validator reject them.
- **Fix:** Change invalid entries (e.g., replace `"build": "giant"` with `"build": "hulking"`) or add the descriptor to the registry and schema if the new value is intentional.

### Blueprint availability and compatibility
- **Blueprint existence:** Preflight fetches the referenced blueprint through `anatomyBlueprintRepository.getBlueprint(recipe.blueprintId)`. Missing entries add a `BLUEPRINT_NOT_FOUND` error with a fix path that points to `data/mods/*/blueprints/<id>.blueprint.json`. The live blueprints use the fields `id`, `schemaVersion`, `root`, and `structureTemplate` (see `data/mods/anatomy/blueprints/red_dragon.blueprint.json`).【F:src/anatomy/validation/RecipePreflightValidator.js†L326-L356】【F:data/mods/anatomy/blueprints/red_dragon.blueprint.json†L1-L14】
- **Socket/slot compatibility:** `validateSocketSlotCompatibility` confirms that every `additionalSlots` entry references a socket present on the root entity. Missing sockets produce `Socket '…' not found on root entity '…'` errors and list available sockets plus Levenshtein suggestions.【F:src/anatomy/validation/socketSlotCompatibilityValidator.js†L66-L147】
- **Blueprint/recipe coverage rule:** When using the dedicated `BlueprintRecipeValidationRule` (load-time rule chain scenarios), coverage checks run via the pattern resolver to ensure recipes cover blueprint slots. Low coverage or missing patterns show up as `critically_incomplete` or `no_patterns` issues.【F:src/anatomy/validation/rules/blueprintRecipeValidationRule.js†L1-L144】
- **Fix:** Create or update the blueprint with the correct `id`, `root`, and sockets, or adjust the recipe to target the existing blueprint ID.

### Pattern dry-run warnings
- **Raised by:** `validatePatternMatching` (`src/anatomy/validation/patternMatchingValidator.js`).
- **Trigger:** A recipe pattern resolves to zero blueprint slots during Preflight’s dry-run. The validator emits warnings shaped as `{ type: 'NO_MATCHING_SLOTS', message: "Pattern matchesGroup 'limbSet:leg' has no matching slots", … }`.
- **Diagnostics:**
  - Inspect the processed blueprint (Preflight uses `#ensureBlueprintProcessed` to merge generated slots) and confirm the expected slot keys exist.
  - Verify `matchesGroup`, `matchesPattern`, or `matchesAll` values align with the structure template definitions in `data/mods/anatomy/templates`.
- **Fix:** Update the recipe pattern or the structure template so that the matcher resolves to at least one slot.

### Part availability at load time
- **Raised by:** `RecipePreflightValidator.#checkPartAvailability` and `#checkGeneratedSlotPartAvailability`.
- **Trigger:** No entity definitions in the registry satisfy the requirements for a recipe slot or pattern. The validator reports `No entity definitions found for slot '…'` (or `pattern n`) along with the required components and properties it attempted to match.【F:src/anatomy/validation/RecipePreflightValidator.js†L590-L640】
- **Diagnostics:**
  - Enumerate entity definitions (`dataRegistry.getAll('entityDefinitions')`) to confirm that an entity with the right `anatomy:part.subType`, component tags, and property values exists.
  - Reuse the Part Selection troubleshooting steps (below) at load time—Preflight and runtime use the same matcher.
- **Fix:** Add or correct entity definitions under `data/mods/<modId>/entities/definitions`. For the red dragon example, `data/mods/anatomy/entities/definitions/dragon_wing.entity.json` includes the required `anatomy:part` subtype and descriptor component.【F:data/mods/anatomy/entities/definitions/dragon_wing.entity.json†L1-L14】

---

## Runtime Part Selection Failures
- **Raised by:** `PartSelectionService` (`src/anatomy/partSelectionService.js`). When no candidates remain after matching, the service dispatches a system error event and throws `new ValidationError(...)` with the message `No entity definitions found matching anatomy requirements. Need part type: '…'. Allowed types: […]. Required components: […]. Checked n entity definitions.`【F:src/anatomy/partSelectionService.js†L214-L260】
- **Diagnostics:**
  - Confirm the socket’s `allowedTypes` include the recipe part type. Sockets are defined on the parent entity’s `anatomy:sockets` component.
  - Verify the candidate entity’s `anatomy:part.subType` exactly matches the requested `partType`.
  - Check that every component ID listed in `requirements.components` or recipe slot `tags` is present in the entity.
  - Match property filters exactly; the matcher performs strict equality on the JSON payload.
  - Ensure the entity is loaded (mod declared in `game.json`) and not filtered out by `notTags`.
- **Fix:** Update sockets, entity subtypes, or recipe requirements so at least one entity passes `#meetsAllRequirements`. The red dragon wing definition demonstrates the correct pattern: subtype `dragon_wing` and the descriptor property expected by the recipe.【F:data/mods/anatomy/entities/definitions/dragon_wing.entity.json†L1-L14】

---

## Runtime Graph Validation (GraphIntegrityValidator)
`GraphIntegrityValidator` chains the rules below when validating a generated anatomy graph.【F:src/anatomy/graphIntegrityValidator.js†L16-L108】 Each rule emits structured issues that are collated into the validator’s result.

### Socket reference issues
- **Load-time variant:** Covered above via `validateSocketSlotCompatibility`.
- **Runtime variant:** `SocketLimitRule` ensures every occupied socket exists on the parent entity. Missing sockets produce `Socket 'wing_socket_left' not found on entity 'anatomy:dragon_torso'` with socket metadata.【F:src/anatomy/validation/rules/socketLimitRule.js†L1-L49】
- **Fix:** Add the socket to the parent entity’s `anatomy:sockets.sockets` array or adjust attachments so they target an existing socket.

### Runtime constraint violations
- **Raised by:** `RecipeConstraintRule` delegating to `RecipeConstraintEvaluator` (`src/anatomy/recipeConstraintEvaluator.js`).
- **Common messages:**
  - `Required constraint not satisfied: has part types [dragon_wing] but missing required components [anatomy:flight_membrane]`
  - `Exclusion constraint violated: found mutually exclusive components [componentA, componentB] in the same anatomy`
  - `Slot 'wing_left': expected at least 2 parts of type 'dragon_wing' but found 1`
- **Diagnostics:** Review the recipe’s `constraints.requires`, `constraints.excludes`, and `slots.*.count` values. The evaluator logs explanations from `validation.explanation` metadata when provided, which can help determine intent.【F:src/anatomy/recipeConstraintEvaluator.js†L160-L236】
- **Fix:** Adjust the assembled anatomy (usually by fixing upstream selection) or amend the recipe constraints if they are too strict.

### Cycle detection
- **Raised by:** `CycleDetectionRule` (`src/anatomy/validation/rules/cycleDetectionRule.js`). It performs a DFS using a recursion stack to detect back edges. The first detected cycle yields `Cycle detected in anatomy graph` and identifies the involved entities.【F:src/anatomy/validation/rules/cycleDetectionRule.js†L1-L70】
- **Fix:** Break the cycle by designating a single root (no `anatomy:joint`) and ensuring each child references a parent higher in the hierarchy.

### Socket/part type mismatches
- **Raised by:** `PartTypeCompatibilityRule` (`src/anatomy/validation/rules/partTypeCompatibilityRule.js`). When a part’s `anatomy:part.subType` is absent from a socket’s `allowedTypes` (and `*` is not present), the rule emits `Part type 'dragon_leg' not allowed in socket 'wing_socket' on entity 'anatomy:dragon_torso'` with the allowed list.【F:src/anatomy/validation/rules/partTypeCompatibilityRule.js†L1-L52】
- **Fix:** Expand the socket’s `allowedTypes`, use `'*'` when appropriate, or change the attached part type.

### Orphan detection and root tracking
- **Raised by:** `OrphanDetectionRule` (`src/anatomy/validation/rules/orphanDetectionRule.js`).
  - Errors: `Orphaned part 'anatomy:dragon_wing' has parent 'anatomy:dragon_torso_OLD' not in graph`.
  - Warnings: `Multiple root entities found: anatomy:dragon_body, anatomy:dragon_head`.
  The rule also records root entity IDs in validation context metadata for downstream rules.【F:src/anatomy/validation/rules/orphanDetectionRule.js†L1-L63】
- **Fix:** Ensure all referenced parents are part of the generated graph or intentionally support multiple roots.

### Joint consistency issues
- **Raised by:** `JointConsistencyRule` (`src/anatomy/validation/rules/jointConsistencyRule.js`). Messages include `Entity 'anatomy:dragon_leg_front_left' has incomplete joint data` and `Entity 'anatomy:dragon_wing' attached to non-existent socket 'wing_socket' on parent 'anatomy:dragon_torso'` with an `availableSockets` array.【F:src/anatomy/validation/rules/jointConsistencyRule.js†L1-L72】
- **Fix:** Populate both `parentId` and `socketId` on every `anatomy:joint` component and keep parent socket definitions in sync.

---

## Body Descriptor Validation
- **Runtime surface:** `AnatomyGenerationWorkflow.validateBodyDescriptors` catches `BodyDescriptorValidationError` and rethrows a plain `ValidationError` with the same message, ensuring consumers only depend on the shared error type.【F:src/anatomy/workflows/anatomyGenerationWorkflow.js†L173-L206】
- **Message shape:** `Invalid build descriptor: 'giant' in recipe 'anatomy:red_dragon'. Must be one of: skinny, slim, lissom, toned, athletic, shapely, hourglass, thick, muscular, hulking, stocky` (values sourced from the registry).
- **Diagnostics:** Reference `BODY_DESCRIPTOR_REGISTRY` for canonical values and ordering. Use `npm run validate:body-descriptors` to run the registry/system consistency checks defined in `src/anatomy/validators/bodyDescriptorValidator.js`.
- **Fix:** Replace the invalid value or extend the registry plus component schema when introducing a new descriptor.

---

## Red Dragon Case Study Snapshot
`reports/anatomy-system-v2-improvements.md` documents the historical “red dragon” debugging sessions. The progression reflects the current code paths:
1. **Constraint check:** Missing co-presence pairs triggered a runtime `Required constraint not satisfied` error.
2. **Part availability:** No `dragon_wing` entity matched the recipe, raising both load-time and runtime availability errors.
3. **Property schema:** The wing entity used `"length": "vast"`, causing an `InvalidPropertyError`; fixing it to `"immense"` moved the error upstream to load time.
4. **Property mismatch:** Recipe/entity disagreement on descriptor values reproduced the runtime selection failure until both sides aligned.
5. **Component registry:** Referencing a non-existent `anatomy:horned` component surfaced the `ComponentNotFoundError`.
6. **Socket coverage:** Blueprint additional slots referenced sockets missing from the torso entity, leading to `Socket 'fire_gland' not found on root entity 'anatomy:dragon_torso'`.
7. **Descriptor coverage:** Only parts with descriptor components were described, highlighting the suggestion emitted by Preflight’s descriptor coverage check.

---

## Diagnostic Workflow Cheat Sheet
1. **Capture the full message** – copy the exact text; subtle differences map to different rules.
2. **Locate the source module** – every section above names the file responsible; open it to confirm the guard conditions.
3. **Inspect data definitions** – recipes (`data/mods/*/recipes`), blueprints (`data/mods/*/blueprints`), structure templates (`data/mods/*/templates`), and entities (`data/mods/*/entities/definitions`).
4. **Cross-check schemas and registries** – component schemas under `data/mods`, recipe/blueprint schemas in `data/schemas`, descriptor registry under `src/anatomy/registries`.
5. **Re-run validators** – `node scripts/validate-recipe.js`, `npm run validate:body-descriptors`, or integration tests in `tests/integration/anatomy/` to confirm the fix.
6. **Escalate to troubleshooting.md** when the message arises from orchestration logic (e.g., pattern matchers) rather than a direct validation rule.

---

## Related Documentation
- [troubleshooting.md](./troubleshooting.md) – Scenario-driven investigations.
- [anatomy-system-guide.md](./anatomy-system-guide.md) – Architectural overview and data flow.
- [blueprints-and-templates.md](./blueprints-and-templates.md) – Blueprint and structure template design details.
- [recipe-pattern-matching.md](./recipe-pattern-matching.md) – Matcher semantics used by Preflight and runtime selection.
- [recipe-creation-checklist.md](./recipe-creation-checklist.md) – Authoring steps that keep recipes compatible with current validators.
