# Anatomy System Troubleshooting

This guide maps common anatomy-system symptoms to the actual modules, data files, and tooling that exist in the repository today. Each section references concrete code paths so you can confirm assumptions quickly.

## Quick Diagnostics Checklist

1. **Enable verbose logging** – All anatomy services inherit from `BaseService`, so setting the injected logger to `debug` (for example through the integration test bed or dependency container overrides) surfaces slot generation, pattern resolution, and socket indexing steps.
2. **Verify content load** – Confirm the anatomy mod finished loading without schema errors by inspecting loader output or running `npm run test:integration -- anatomy`, which exercises the loader pipeline end-to-end.
3. **Check generated slots** – Read the processed blueprint from `dataRegistry.get('anatomyBlueprints', blueprintId)` and inspect `blueprint.slots` to confirm slot IDs and optional flags.
4. **Confirm optional integrations** – The `ANATOMY_GENERATED` event and socket indexing only run when the workflow receives an event bus and `AnatomySocketIndex`. If clothing or downstream systems rely on them, ensure those dependencies were provided during initialization.

## Body parts are missing after generation

**Symptom**: The entity owns an anatomy graph, but expected parts never appear.

### Cause 1 – Recipe pattern matching returned zero slots

**Evidence**: Debug logs from `RecipePatternResolver` mention `Pattern matched zero slots`.

**Why it happens**
- Structure-template socket patterns and recipe patterns are out of sync.
- Orientation schemes differ (for example the template uses `bilateral` while the recipe assumes `indexed`).
- Template variables were renamed without updating recipes.

**How to debug**
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

**Fixes**
- Prefer `matchesGroup` selectors such as `"limbSet:leg"` so recipes survive socket renames.
- Align `orientationScheme` values (see `orientationResolver` below for valid options).
- Update recipe patterns whenever template topology changes.
- Run `checkBlueprintRecipeCompatibility` (see below) to surface slots with no matching pattern coverage.

### Cause 2 – Blueprint/recipe references are inconsistent

**Evidence**: Loader or workflow logs emit schema validation errors or warnings such as `Recipe 'X' does not specify a blueprintId`.

**How to confirm**
1. Ensure the blueprint exists: `dataRegistry.get('anatomyBlueprints', blueprintId)`.
2. Confirm the recipe points at the correct blueprint ID.
3. Use the implemented validator: `validateRecipeSlots(processedRecipe, blueprint, eventBus)` from `src/anatomy/bodyBlueprintFactory/blueprintValidator.js` to catch missing slots.
4. Run `checkBlueprintRecipeCompatibility(blueprint, recipe, deps)` to list missing or unexpected slots. Both utilities ship with dedicated tests in `tests/unit/anatomy/bodyBlueprintFactory/`.

**Fixes**
- Correct the `blueprintId` on the recipe.
- Make sure loader order in `data/mods/anatomy/mod-manifest.json` loads blueprints before recipes.
- Treat validator errors as blocking; the modules are active, not “planned”.

### Cause 3 – Structure template failed validation

**Evidence**: `anatomyStructureTemplateLoader` logs schema violations, or `BodyBlueprintFactory` throws during template resolution.

**Common pitfalls**
- Limb/appendage counts exceed schema bounds.
- Socket patterns omit required properties.
- `topology.rootType` or `id` is missing.
- Orientation schemes use unsupported values (allowed: `bilateral`, `quadrupedal`, `radial`, `indexed`, or `custom`).

**How to confirm**
- Validate the JSON against `data/schemas/anatomy.structure-template.schema.json`.
- Inspect the processed template via `dataRegistry.get('anatomyStructureTemplates', templateId)`.

**Fixes**
- Bring the template back into schema compliance.
- When introducing new orientation schemes, extend `src/anatomy/shared/orientationResolver.js` instead of rolling ad-hoc logic.

### Cause 4 – Part selection rejected every candidate

**Evidence**: Logs from `PartSelectionService` show messages like `subType 'leg' not in allowedTypes`. The service ultimately throws `No entity definitions found matching anatomy requirements.`

**How to confirm**
```javascript
const partType = 'spider_leg';
const defs = dataRegistry
  .getAll('entityDefinitions')
  .filter((def) => def.components?.['anatomy:part']?.subType === partType);
console.log(`${defs.length} definitions expose subType ${partType}`);
```

**Fixes**
- Ensure every required `partType` has a matching entity definition with `components['anatomy:part'].subType` set to the same value.
- Align socket `allowedTypes` with the specific subType the recipe expects (see the table later in this document).
- Use `tests/unit/anatomy/partSelectionService*.test.js` as patterns for regression tests.

## Clothing fails to attach

**Symptom**: Clothing entities spawn but do not bind to sockets, or instantiation throws slot errors.

### Cause 1 – Slot IDs diverged from socket IDs

**Evidence**: `ClothingInstantiationService` logs `Socket not found` warnings.

**How to confirm**
```javascript
const sockets = await anatomySocketIndex.getEntitySockets(entityId);
console.log(sockets.map((s) => s.id));

const slotMetadata = await entityManager.getComponentData(
  entityId,
  'clothing:slot_metadata'
);
console.log(slotMetadata?.slotMappings);
```

`SlotResolver` logs messages such as `Resolved slot 'torso' to ... using BlueprintSlotStrategy` while working through mappings. Those logs prove whether strategies execute.

**Fixes**
- Regenerate clothing slot metadata via `executeSlotEntityCreation` (part of the workflow) after altering templates.
- Update clothing slot mappings in mods to use the new socket IDs.
- Confirm `SlotResolver` is registered in `dependencyInjection/registrations/worldAndEntityRegistrations.js` so `ClothingInstantiationService` receives it.

### Cause 2 – Cache invalidation lagged behind anatomy updates

**Evidence**: `AnatomySocketIndex` reports stale or missing entries even after regeneration.

**How to confirm**
```javascript
await anatomySocketIndex.buildIndex(rootEntityId);
const entities = await anatomySocketIndex.getEntitiesWithSockets(rootEntityId);
console.log(entities);
```

`buildIndex` repopulates the internal Maps used by `findEntityWithSocket`. Methods like `getEntitySockets` cache per-entity results automatically, but cross-entity lookups require the index.

**Fixes**
- Call `invalidateIndex(rootEntityId)` after structural changes, then `buildIndex` before querying.
- Ensure any cache coordinator registers the socket-index caches (see the constructor of `src/anatomy/services/anatomySocketIndex.js`).

### Cause 3 – `ANATOMY_GENERATED` event never fired

**Evidence**: No logs from `EventPublicationStage` and downstream listeners never run.

**How to confirm**
- Verify `AnatomyGenerationWorkflow` received an event bus and socket index; otherwise the stage short-circuits.
- Inspect `src/anatomy/workflows/stages/eventPublicationStage.js` to confirm `eventBus.dispatch('ANATOMY_GENERATED', …)` executed without errors.

**Fixes**
- Pass an `ISafeEventDispatcher` into the workflow during composition.
- Register clothing or gameplay listeners before triggering anatomy generation so they catch the event.

## Slot/socket orientation mismatch

**Symptom**: Parts or clothing attach to unexpected sides (left/right swapped, fore/hind reversed).

**Diagnosis**
- Both `src/anatomy/slotGenerator.js` and `src/anatomy/socketGenerator.js` import `OrientationResolver`. If either diverges, slot keys and socket IDs desynchronize.
- Run quick checks in a REPL:
```javascript
import { OrientationResolver } from 'src/anatomy/shared/orientationResolver.js';
OrientationResolver.resolveOrientation('bilateral', 1, 2); // 'left'
OrientationResolver.resolveOrientation('bilateral', 4, 4); // 'right_rear'
```

**Fixes**
- Never duplicate orientation math; extend `OrientationResolver` when adding schemes.
- Re-run blueprints through the loader after modifying orientation logic so cached slots refresh.

## Tests fail after template changes

**Symptom**: Anatomy integration or contract tests start failing after modifying templates or recipes.

**Actions**
1. Review recent changes to `data/mods/anatomy/structure-templates/` and note any renamed sockets.
2. Sync recipes and tests with the new slot keys (for example, `leg_1` → `leg_left`).
3. Execute the focused suites:
   - `npm run test:integration -- anatomy` for loader + generation coverage.
   - `npm run test:unit -- anatomy` (uses Jest projects) when unit fixtures need updates.
4. Update fixtures under `tests/integration/anatomy/` to mirror the new topology.

**Fixes**
- Prefer `matchesGroup` patterns in recipes so topology tweaks require fewer test changes.
- Re-run blueprint compatibility tests to ensure `checkBlueprintRecipeCompatibility` reports zero missing required slots.

## partType/subType mismatches

**Symptom**: Errors such as `No entity definitions found matching anatomy requirements. Need part type: 'spider_leg'. Allowed types: ["leg"]`.

**The three-layer contract**

| Layer | Location | Purpose | Example |
| --- | --- | --- | --- |
| Socket `allowedTypes` | Generated by `SocketGenerator` | What the socket physically accepts | `["leg", "spider_leg"]` |
| Recipe `partType` | `data/mods/anatomy/recipes/*.recipe.json` | What selectors request | `"spider_leg"` |
| Entity `subType` | `data/mods/anatomy/entities/definitions/*.entity.json` | What the entity advertises | `"spider_leg"` |

**Rule**: `partType` **must exactly match** `subType`. Socket `allowedTypes` can be broader, but cannot exclude the specific value.

**Troubleshooting steps**
1. Locate the recipe entry, e.g. `grep -r "partType.*spider_leg" data/mods/anatomy/recipes/`.
2. Inspect the entity definition such as `data/mods/anatomy/entities/definitions/spider_leg.entity.json`.
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
4. If using structure templates, align `socketPattern.allowedTypes` so it includes `"spider_leg"`.
5. Add or update a regression test similar to `tests/unit/anatomy/partSelectionService*.test.js` to lock in the expectation.

## Performance dips with complex anatomy

**Symptom**: Anatomy generation slows dramatically or consumes excessive memory.

**Common drivers**
- Templates define very large limb sets or deep hierarchies. `buildIndex` amplifies work as it enumerates every entity.
- Recipes use broad patterns (`matchesPattern: "*"`) causing `RecipePatternResolver` to scan the entire slot set repeatedly.

**Mitigations**
- Keep limb counts realistic (existing creatures stay below ~20 limbs).
- Reuse `AnatomySocketIndex` instead of traversing entity graphs manually; the service offers O(1) lookups once built.
- Narrow recipe patterns with specific `matchesGroup` or `matchesPattern` filters.
- Profile long-running generation by toggling debug logs on `RecipePatternResolver` and `AnatomyGenerationWorkflow`.

## Diagnostic utilities

- **Verbose logging**: Every major service logs at `debug` level, including `RecipePatternResolver`, `SlotGenerator`, `SocketGenerator`, `PartSelectionService`, and `AnatomySocketIndex`.
- **Socket inspection**: `AnatomySocketIndex` exposes `getEntitySockets`, `findEntityWithSocket`, and `getEntitiesWithSockets` for runtime introspection (`src/anatomy/services/anatomySocketIndex.js`).
- **Event tracing**: `src/anatomy/workflows/stages/eventPublicationStage.js` records when `ANATOMY_GENERATED` events publish, including the payload contents.
- **Blueprint/recipe validation**: `src/anatomy/bodyBlueprintFactory/blueprintValidator.js` provides `validateRecipeSlots` and `checkBlueprintRecipeCompatibility`, both covered by unit and integration tests.

## Additional references

- [Anatomy System Guide](./anatomy-system-guide.md) – Architectural overview and event flow.
- [Blueprints and Templates](./blueprints-and-templates.md) – Template topology rules and schema links.
- [Recipe Pattern Matching](./recipe-pattern-matching.md) – Pattern authoring strategies and debugging commands.
- [Anatomy Testing Guide](./anatomy-testing-guide.md) – Maintaining unit and integration coverage.
