# Anatomy System Troubleshooting and Error Reference

This guide provides both symptom-based troubleshooting and a complete error catalog for the anatomy system. It references concrete code paths, modules, and data files for quick diagnosis and resolution.

## Table of Contents

1. [Quick Diagnostics Checklist](#quick-diagnostics-checklist)
2. [Common Symptoms and Solutions](#common-symptoms-and-solutions)
3. [Error Catalog](#error-catalog)
4. [Diagnostic Utilities](#diagnostic-utilities)

## Quick Diagnostics Checklist

1. **Enable verbose logging** – All anatomy services inherit from `BaseService`, so setting the injected logger to `debug` surfaces slot generation, pattern resolution, and socket indexing steps.
2. **Verify content load** – Confirm the anatomy mod finished loading without schema errors by inspecting loader output or running `npm run test:integration -- anatomy`.
3. **Check generated slots** – Read the processed blueprint from `dataRegistry.get('anatomyBlueprints', blueprintId)` and inspect `blueprint.slots` to confirm slot IDs and optional flags.
4. **Confirm optional integrations** – The `ANATOMY_GENERATED` event and socket indexing only run when the workflow receives an event bus and `AnatomySocketIndex`. If clothing or downstream systems rely on them, ensure those dependencies were provided during initialization.

---

## Common Symptoms and Solutions

### Body parts are missing after generation

**Symptom**: The entity owns an anatomy graph, but expected parts never appear.

#### Cause 1 – Recipe pattern matching returned zero slots

**Evidence**: Debug logs from `RecipePatternResolver` mention `Pattern matched zero slots`.

**Why it happens**:
- Structure-template socket patterns and recipe patterns are out of sync
- Orientation schemes differ (e.g., template uses `bilateral` while recipe assumes `indexed`)
- Template variables were renamed without updating recipes

**How to debug**:
```javascript
// Inspect the resolved blueprint and recipe
const blueprint = dataRegistry.get('anatomyBlueprints', 'anatomy:giant_spider');
console.log(Object.keys(blueprint.slots));

const recipe = dataRegistry.get('anatomyRecipes', 'anatomy:giant_forest_spider');
console.log(recipe.patterns);

// Review the structure template used by the blueprint
const template = dataRegistry.get('anatomyStructureTemplates', 'anatomy:structure_arachnid_8leg');
console.log(template.topology.limbSets.map((set) => set.socketPattern));
```

**Fixes**:
- Prefer `matchesGroup` selectors such as `"limbSet:leg"` so recipes survive socket renames
- Align `orientationScheme` values (see `orientationResolver` for valid options)
- Update recipe patterns whenever template topology changes
- Run `checkBlueprintRecipeCompatibility` to surface slots with no matching pattern coverage

#### Cause 2 – Blueprint/recipe references are inconsistent

**Evidence**: Loader or workflow logs emit schema validation errors or warnings such as `Recipe 'X' does not specify a blueprintId`.

**How to confirm**:
1. Ensure the blueprint exists: `dataRegistry.get('anatomyBlueprints', blueprintId)`
2. Confirm the recipe points at the correct blueprint ID
3. Use `validateRecipeSlots(processedRecipe, blueprint, eventBus)` from `src/anatomy/bodyBlueprintFactory/blueprintValidator.js` to catch missing slots
4. Run `checkBlueprintRecipeCompatibility(blueprint, recipe, deps)` to list missing or unexpected slots

**Fixes**:
- Correct the `blueprintId` on the recipe
- Ensure loader order in `data/mods/anatomy/mod-manifest.json` loads blueprints before recipes
- Treat validator errors as blocking

#### Cause 3 – Structure template failed validation

**Evidence**: `anatomyStructureTemplateLoader` logs schema violations, or `BodyBlueprintFactory` throws during template resolution.

**Common pitfalls**:
- Limb/appendage counts exceed schema bounds
- Socket patterns omit required properties
- `topology.rootType` or `id` is missing
- Orientation schemes use unsupported values (allowed: `bilateral`, `quadrupedal`, `radial`, `indexed`, or `custom`)

**How to confirm**:
- Validate the JSON against `data/schemas/anatomy.structure-template.schema.json`
- Inspect the processed template via `dataRegistry.get('anatomyStructureTemplates', templateId)`

**Fixes**:
- Bring the template back into schema compliance
- When introducing new orientation schemes, extend `src/anatomy/shared/orientationResolver.js`

#### Cause 4 – Part selection rejected every candidate

**Evidence**: Logs from `PartSelectionService` show messages like `subType 'leg' not in allowedTypes`. The service ultimately throws `No entity definitions found matching anatomy requirements`.

**How to confirm**:
```javascript
const partType = 'spider_leg';
const defs = dataRegistry
  .getAll('entityDefinitions')
  .filter((def) => def.components?.['anatomy:part']?.subType === partType);
console.log(`${defs.length} definitions expose subType ${partType}`);
```

**Fixes**:
- Ensure every required `partType` has a matching entity definition with `components['anatomy:part'].subType` set to the same value
- Align socket `allowedTypes` with the specific subType the recipe expects
- Use `tests/unit/anatomy/partSelectionService*.test.js` as patterns for regression tests

### Clothing fails to attach

**Symptom**: Clothing entities spawn but do not bind to sockets, or instantiation throws slot errors.

#### Cause 1 – Slot IDs diverged from socket IDs

**Evidence**: `ClothingInstantiationService` logs `Socket not found` warnings.

**How to confirm**:
```javascript
const sockets = await anatomySocketIndex.getEntitySockets(entityId);
console.log(sockets.map((s) => s.id));

const slotMetadata = await entityManager.getComponentData(
  entityId,
  'clothing:slot_metadata'
);
console.log(slotMetadata?.slotMappings);
```

`SlotResolver` logs messages such as `Resolved slot 'torso' to ... using BlueprintSlotStrategy` while working through mappings.

**Fixes**:
- Regenerate clothing slot metadata via `executeSlotEntityCreation` (part of the workflow) after altering templates
- Update clothing slot mappings in mods to use the new socket IDs
- Confirm `SlotResolver` is registered in `dependencyInjection/registrations/worldAndEntityRegistrations.js`

#### Cause 2 – Cache invalidation lagged behind anatomy updates

**Evidence**: `AnatomySocketIndex` reports stale or missing entries even after regeneration.

**How to confirm**:
```javascript
await anatomySocketIndex.buildIndex(rootEntityId);
const entities = await anatomySocketIndex.getEntitiesWithSockets(rootEntityId);
console.log(entities);
```

**Fixes**:
- Call `invalidateIndex(rootEntityId)` after structural changes, then `buildIndex` before querying
- Ensure any cache coordinator registers the socket-index caches

#### Cause 3 – `ANATOMY_GENERATED` event never fired

**Evidence**: No logs from `EventPublicationStage` and downstream listeners never run.

**How to confirm**:
- Verify `AnatomyGenerationWorkflow` received an event bus and socket index; otherwise the stage short-circuits
- Inspect `src/anatomy/workflows/stages/eventPublicationStage.js` to confirm dispatch executed without errors

**Fixes**:
- Pass an `ISafeEventDispatcher` into the workflow during composition
- Register clothing or gameplay listeners before triggering anatomy generation

### Slot/socket orientation mismatch

**Symptom**: Parts or clothing attach to unexpected sides (left/right swapped, fore/hind reversed).

**Diagnosis**:
- Both `src/anatomy/slotGenerator.js` and `src/anatomy/socketGenerator.js` import `OrientationResolver`
- Run quick checks:
```javascript
import { OrientationResolver } from 'src/anatomy/shared/orientationResolver.js';
OrientationResolver.resolveOrientation('bilateral', 1, 2); // 'left'
OrientationResolver.resolveOrientation('bilateral', 4, 4); // 'right_rear'
```

**Fixes**:
- Never duplicate orientation math; extend `OrientationResolver` when adding schemes
- Re-run blueprints through the loader after modifying orientation logic

### Tests fail after template changes

**Symptom**: Anatomy integration or contract tests start failing after modifying templates or recipes.

**Actions**:
1. Review recent changes to `data/mods/anatomy/structure-templates/` and note any renamed sockets
2. Sync recipes and tests with the new slot keys (e.g., `leg_1` → `leg_left`)
3. Execute the focused suites:
   - `npm run test:integration -- anatomy` for loader + generation coverage
   - `npm run test:unit -- anatomy` when unit fixtures need updates
4. Update fixtures under `tests/integration/anatomy/` to mirror the new topology

**Fixes**:
- Prefer `matchesGroup` patterns in recipes so topology tweaks require fewer test changes
- Re-run blueprint compatibility tests

### partType/subType mismatches

**Symptom**: Errors such as `No entity definitions found matching anatomy requirements. Need part type: 'spider_leg'. Allowed types: ["leg"]`.

**The three-layer contract**:

| Layer | Location | Purpose | Example |
| --- | --- | --- | --- |
| Socket `allowedTypes` | Generated by `SocketGenerator` | What the socket physically accepts | `["leg", "spider_leg"]` |
| Recipe `partType` | `data/mods/anatomy/recipes/*.recipe.json` | What selectors request | `"spider_leg"` |
| Entity `subType` | `data/mods/anatomy/entities/definitions/*.entity.json` | What the entity advertises | `"spider_leg"` |

**Rule**: `partType` **must exactly match** `subType`. Socket `allowedTypes` can be broader, but cannot exclude the specific value.

**Troubleshooting steps**:
1. Locate the recipe entry: `grep -r "partType.*spider_leg" data/mods/anatomy/recipes/`
2. Inspect the entity definition such as `data/mods/anatomy/entities/definitions/spider_leg.entity.json`
3. Update the entity to advertise the precise `subType`:
```json
{
  "id": "anatomy:spider_leg",
  "components": {
    "anatomy:part": {
      "subType": "spider_leg"
    }
  }
}
```
4. If using structure templates, align `socketPattern.allowedTypes` so it includes `"spider_leg"`
5. Add a regression test similar to `tests/unit/anatomy/partSelectionService*.test.js`

### Performance dips with complex anatomy

**Symptom**: Anatomy generation slows dramatically or consumes excessive memory.

**Common drivers**:
- Templates define very large limb sets or deep hierarchies
- Recipes use broad patterns (`matchesPattern: "*"`) causing extensive scanning

**Mitigations**:
- Keep limb counts realistic (existing creatures stay below ~20 limbs)
- Reuse `AnatomySocketIndex` for O(1) lookups once built
- Narrow recipe patterns with specific `matchesGroup` or `matchesPattern` filters
- Profile by toggling debug logs on `RecipePatternResolver` and `AnatomyGenerationWorkflow`

---

## Error Catalog

This catalog documents individual error messages, the code that raises them, and focused fixes.

### Quick Reference

| Message Snippet | Error / Warning | Raised By | Section |
| --- | --- | --- | --- |
| `Recipe validation failed` | `RecipeValidationError` | `RecipeValidationRunner` | [Recipe validation failures](#recipe-validation-failures) |
| `Component '…' does not exist in the component registry` | `ComponentNotFoundError` | `componentExistenceValidationRule` | [Missing component references](#missing-component-references) |
| `Property '…' has invalid value '…'` | `InvalidPropertyError` | `propertySchemaValidationRule` | [Property schema violations](#property-schema-violations) |
| `Pattern matchesGroup '…' has no matching slots` | Warning object | `patternMatchingValidator` | [Pattern dry-run warnings](#pattern-dry-run-warnings) |
| `Blueprint '…' does not exist` | Validation issue | `BlueprintExistenceValidator` | [Blueprint availability](#blueprint-availability) |
| `No entity definitions found for slot '…'` | Validation issue | `PartAvailabilityValidator` / `GeneratedSlotPartsValidator` | [Part availability at load time](#part-availability-at-load-time) |
| `No entity definitions found matching anatomy requirements` | `ValidationError` | `PartSelectionService` | [Runtime part selection failures](#runtime-part-selection-failures) |
| `Socket '…' not found on root entity '…'` | `SocketNotFoundError` | `socketSlotCompatibilityValidator` or `SocketLimitRule` | [Socket reference issues](#socket-reference-issues) |
| `Required constraint not satisfied: …` | Validation issue | `RecipeConstraintEvaluator` | [Runtime constraint violations](#runtime-constraint-violations) |
| `Cycle detected in anatomy graph` | Validation issue | `cycleDetectionRule` | [Cycle detection](#cycle-detection) |
| `Part type '…' not allowed in socket '…'` | Validation issue | `partTypeCompatibilityRule` | [Socket/part type mismatches](#socketpart-type-mismatches) |
| `Orphaned part '…' has parent '…' not in graph` | Validation issue | `orphanDetectionRule` | [Orphan detection](#orphan-detection) |
| `Entity '…' has incomplete joint data` | Validation issue | `jointConsistencyRule` | [Joint consistency issues](#joint-consistency-issues) |
| `Invalid … descriptor: '…' in …` | `BodyDescriptorValidationError` | `bodyDescriptorValidator` | [Body descriptor validation](#body-descriptor-validation) |

### Load-Time Validation Errors

#### Recipe validation failures

- **Thrown by**: `RecipeValidationError` (`src/anatomy/errors/RecipeValidationError.js`)
- **Trigger**: `RecipeValidationRunner.validate` returns a `ValidationReport` containing at least one error
- **Report contents**: `errors`, `warnings`, `suggestions`, `passed`, `isValid`, and `summary` with counts
- **Diagnostics**: Capture `error.report` and review each issue. Run `npm run validate:recipe -- data/mods/anatomy/recipes/red_dragon.recipe.json` (or `node scripts/validate-recipe.js <path>`) to regenerate the report
- **Fix path**: Resolve the underlying issues and re-run the validator

#### Missing component references

- **Raised by**: `ComponentExistenceValidationRule` (`src/anatomy/validation/rules/componentExistenceValidationRule.js`)
- **Trigger**: A recipe references a component ID not registered in the data registry
- **Typical message**: `Component 'anatomy:horned' does not exist in the component registry`
- **Diagnostics**:
  - Confirm the component file exists: `find data/mods -name 'horned.component.json'`
  - Check spelling and namespace (IDs must follow `modId:componentName`)
  - Ensure the mod providing the component is declared in `data/game.json`
- **Fix**: Create the missing component under `data/mods/<modId>/components/<name>.component.json`

#### Property schema violations

- **Raised by**: `PropertySchemaValidationRule` (`src/anatomy/validation/rules/propertySchemaValidationRule.js`)
- **Trigger**: Recipe supplies component property values that fail the component's schema
- **Diagnostics**: Inspect the component schema from the data registry; the property schema validator attaches `validValues` and `schemaPath` to errors
- **Fix**: Align the recipe with the allowed values

#### Body descriptor validation

- **Load-time check**: `RecipeValidationRunner` executes `RecipeBodyDescriptorValidator`, which validates `bodyDescriptors` against the schema in the `anatomy:body` component
- **Runtime check**: `BodyDescriptorValidator` (`src/anatomy/utils/bodyDescriptorValidator.js`) enforces the registry in `src/anatomy/registries/bodyDescriptorRegistry.js`
- **Diagnostics**: Cross-check values against the registry (`getAllDescriptorNames()` and per-descriptor `validValues`)
- **Fix**: Change invalid entries or add the descriptor to the registry and schema if intentional

#### Blueprint availability

- **Blueprint existence**: The validation pipeline fetches the referenced blueprint through `BlueprintExistenceValidator`, which calls `anatomyBlueprintRepository.getBlueprint(recipe.blueprintId)`
- **Socket/slot compatibility**: `validateSocketSlotCompatibility` confirms that every `additionalSlots` entry references an existing socket
- **Fix**: Create or update the blueprint with the correct `id`, `root`, and sockets, or adjust the recipe

#### Pattern dry-run warnings

- **Raised by**: `validatePatternMatching` (`src/anatomy/validation/patternMatchingValidator.js`)
- **Trigger**: A recipe pattern resolves to zero blueprint slots during the pattern-matching validator's dry-run
- **Diagnostics**: Inspect the processed blueprint and verify expected slot keys exist
- **Fix**: Update the recipe pattern or the structure template

#### Part availability at load time

- **Raised by**: `PartAvailabilityValidator` (explicit slots) and `GeneratedSlotPartsValidator` (pattern expansion)
- **Trigger**: No entity definitions satisfy requirements for a recipe slot or pattern
- **Diagnostics**: Enumerate entity definitions (`dataRegistry.getAll('entityDefinitions')`) to confirm matching entities exist
- **Fix**: Add or correct entity definitions under `data/mods/<modId>/entities/definitions`

### Runtime Validation Errors

#### Runtime part selection failures

- **Raised by**: `PartSelectionService` (`src/anatomy/partSelectionService.js`)
- **Message**: `No entity definitions found matching anatomy requirements. Need part type: '…'. Allowed types: […]. Required components: […]`
- **Diagnostics**:
  - Confirm socket's `allowedTypes` include the recipe part type
  - Verify candidate entity's `anatomy:part.subType` matches the requested `partType`
  - Check that every component ID in `requirements.components` or recipe slot `tags` is present
- **Fix**: Update sockets, entity subtypes, or recipe requirements so at least one entity passes requirements

#### Socket reference issues

- **Runtime variant**: `SocketLimitRule` ensures every occupied socket exists on the parent entity
- **Message**: `Socket 'wing_socket_left' not found on entity 'anatomy:dragon_torso'`
- **Fix**: Add the socket to the parent entity's `anatomy:sockets.sockets` array or adjust attachments

#### Runtime constraint violations

- **Raised by**: `RecipeConstraintRule` delegating to `RecipeConstraintEvaluator`
- **Common messages**:
  - `Required constraint not satisfied: has part types [dragon_wing] but missing required components [anatomy:flight_membrane]`
  - `Exclusion constraint violated: found mutually exclusive components [componentA, componentB]`
  - `Slot 'wing_left': expected at least 2 parts of type 'dragon_wing' but found 1`
- **Diagnostics**: Review recipe's `constraints.requires`, `constraints.excludes`, and `slots.*.count` values
- **Fix**: Adjust the assembled anatomy or amend the recipe constraints

#### Cycle detection

- **Raised by**: `CycleDetectionRule` (`src/anatomy/validation/rules/cycleDetectionRule.js`)
- **Message**: `Cycle detected in anatomy graph`
- **Fix**: Break the cycle by designating a single root and ensuring each child references a parent higher in the hierarchy

#### Socket/part type mismatches

- **Raised by**: `PartTypeCompatibilityRule` (`src/anatomy/validation/rules/partTypeCompatibilityRule.js`)
- **Message**: `Part type 'dragon_leg' not allowed in socket 'wing_socket' on entity 'anatomy:dragon_torso'`
- **Fix**: Expand the socket's `allowedTypes`, use `'*'` when appropriate, or change the attached part type

#### Orphan detection

- **Raised by**: `OrphanDetectionRule` (`src/anatomy/validation/rules/orphanDetectionRule.js`)
- **Messages**:
  - Error: `Orphaned part 'anatomy:dragon_wing' has parent 'anatomy:dragon_torso_OLD' not in graph`
  - Warning: `Multiple root entities found: anatomy:dragon_body, anatomy:dragon_head`
- **Fix**: Ensure all referenced parents are part of the generated graph

#### Joint consistency issues

- **Raised by**: `JointConsistencyRule` (`src/anatomy/validation/rules/jointConsistencyRule.js`)
- **Messages**:
  - `Entity 'anatomy:dragon_leg_front_left' has incomplete joint data`
  - `Entity 'anatomy:dragon_wing' attached to non-existent socket 'wing_socket' on parent 'anatomy:dragon_torso'`
- **Fix**: Populate both `parentId` and `socketId` on every `anatomy:joint` component

---

## Diagnostic Utilities

- **Verbose logging**: Every major service logs at `debug` level
- **Socket inspection**: `AnatomySocketIndex` exposes `getEntitySockets`, `findEntityWithSocket`, and `getEntitiesWithSockets`
- **Event tracing**: `src/anatomy/workflows/stages/eventPublicationStage.js` records event dispatch
- **Blueprint/recipe validation**: `src/anatomy/bodyBlueprintFactory/blueprintValidator.js` provides `validateRecipeSlots` and `checkBlueprintRecipeCompatibility`

---

## Related Documentation

- [Anatomy System Guide](./anatomy-system-guide.md) – Architectural overview
- [Blueprints and Recipes Guide](./blueprints-and-recipes.md) – Blueprint and recipe authoring
- [Body Descriptors Complete](./body-descriptors-complete.md) – Descriptor system reference
- [Non-Human Quickstart](./non-human-quickstart.md) – Practical tutorial
- [Anatomy Testing Guide](./anatomy-testing-guide.md) – Testing patterns

---

**Maintained By**: Living Narrative Engine Core Team
**Last Reviewed**: 2025-11-12
