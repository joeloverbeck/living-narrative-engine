# Data-Driven Sensory Affordances Specification

## Overview

This specification defines the implementation of data-driven sensory affordance components to replace the brittle hardcoded body part type checking in `SensoryCapabilityService`. The current implementation fails when creature anatomy uses non-standard `subType` values (e.g., `eldritch_baleful_eye` instead of `eye`).

## Problem Statement

### Current Implementation (Brittle)

**File**: `src/perception/services/sensoryCapabilityService.js` (lines 109-111)

```javascript
const canSee = this.#hasAtLeastOneFunctioningPart(bodyComponent, 'eye');
const canHear = this.#hasAtLeastOneFunctioningPart(bodyComponent, 'ear');
const canSmell = this.#hasAtLeastOneFunctioningPart(bodyComponent, 'nose');
```

The service queries `BodyGraphService.findPartsByType(rootId, partType)` with hardcoded strings `'eye'`, `'ear'`, `'nose'`. This fails for:

- **Eldritch creatures**: `eldritch_baleful_eye`, `eldritch_compound_eye_stalk`, `eldritch_sensory_stalk`, `eldritch_surface_eye`
- **Tortoise**: `tortoise_eye`
- **Any future exotic anatomy** with non-standard subTypes

### Impact

Creatures with exotic sensory organs are incorrectly classified as unable to see/hear/smell, causing perception events to be filtered incorrectly.

## Solution: Data-Driven Sensory Affordances

### Design Decisions

Based on user requirements:

1. **Boolean marker components** - Simple presence-based detection, no metadata
2. **Equivalent sensing** - All visual organs provide the same "sight" capability regardless of exotic properties
3. **Multiple affordances per part** - A single body part can provide multiple sense types

## Components to Create

### 1. `anatomy:provides_sight` Component

**File**: `data/mods/anatomy/components/provides_sight.component.json`

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "anatomy:provides_sight",
  "description": "Marker component indicating this body part enables visual perception when functioning",
  "dataSchema": {
    "type": "object",
    "properties": {},
    "additionalProperties": false
  }
}
```

### 2. `anatomy:provides_hearing` Component

**File**: `data/mods/anatomy/components/provides_hearing.component.json`

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "anatomy:provides_hearing",
  "description": "Marker component indicating this body part enables auditory perception when functioning",
  "dataSchema": {
    "type": "object",
    "properties": {},
    "additionalProperties": false
  }
}
```

### 3. `anatomy:provides_smell` Component

**File**: `data/mods/anatomy/components/provides_smell.component.json`

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "anatomy:provides_smell",
  "description": "Marker component indicating this body part enables olfactory perception when functioning",
  "dataSchema": {
    "type": "object",
    "properties": {},
    "additionalProperties": false
  }
}
```

## Entity Definitions to Modify

### Standard Anatomy Parts (data/mods/anatomy/entities/definitions/)

#### Eyes (add `anatomy:provides_sight`)

| File | Entity ID |
|------|-----------|
| `human_eye_amber.entity.json` | `anatomy:human_eye_amber` |
| `human_eye_blue.entity.json` | `anatomy:human_eye_blue` |
| `human_eye_blue_hooded.entity.json` | `anatomy:human_eye_blue_hooded` |
| `human_eye_brown.entity.json` | `anatomy:human_eye_brown` |
| `human_eye_brown_almond.entity.json` | `anatomy:human_eye_brown_almond` |
| `human_eye_cobalt.entity.json` | `anatomy:human_eye_cobalt` |
| `human_eye_gray_hooded.entity.json` | `anatomy:human_eye_gray_hooded` |
| `human_eye_green.entity.json` | `anatomy:human_eye_green` |
| `human_eye_hazel_almond.entity.json` | `anatomy:human_eye_hazel_almond` |
| `human_eye_hazel_hooded.entity.json` | `anatomy:human_eye_hazel_hooded` |
| `human_eye_pale_blue_round.entity.json` | `anatomy:human_eye_pale_blue_round` |
| `human_eye_red_hooded.entity.json` | `anatomy:human_eye_red_hooded` |

#### Ears (add `anatomy:provides_hearing`)

| File | Entity ID |
|------|-----------|
| `humanoid_ear.entity.json` | `anatomy:humanoid_ear` |

#### Nose (add `anatomy:provides_smell`)

| File | Entity ID |
|------|-----------|
| `humanoid_nose.entity.json` | `anatomy:humanoid_nose` |

### Creature Anatomy Parts (data/mods/anatomy-creatures/entities/definitions/)

#### Standard-SubType Eyes (add `anatomy:provides_sight`)

| File | Entity ID | Current subType |
|------|-----------|-----------------|
| `chicken_eye_amber_concentric.entity.json` | `anatomy-creatures:chicken_eye_amber_concentric` | `eye` |
| `feline_eye_abyssal_black_glow.entity.json` | `anatomy-creatures:feline_eye_abyssal_black_glow` | `eye` |
| `feline_eye_amber_slit.entity.json` | `anatomy-creatures:feline_eye_amber_slit` | `eye` |
| `feline_eye_gold_slit.entity.json` | `anatomy-creatures:feline_eye_gold_slit` | `eye` |
| `feline_eye_ice_blue_slit.entity.json` | `anatomy-creatures:feline_eye_ice_blue_slit` | `eye` |
| `hyena_eye.entity.json` | `anatomy-creatures:hyena_eye` | `eye` |
| `newt_eye.entity.json` | `anatomy-creatures:newt_eye` | `eye` |
| `toad_eye.entity.json` | `anatomy-creatures:toad_eye` | `eye` |

#### Exotic Eyes (add `anatomy:provides_sight`) - THE CRITICAL FIX

| File | Entity ID | Current subType |
|------|-----------|-----------------|
| `eldritch_baleful_eye.entity.json` | `anatomy-creatures:eldritch_baleful_eye` | `eldritch_baleful_eye` |
| `eldritch_compound_eye_stalk.entity.json` | `anatomy-creatures:eldritch_compound_eye_stalk` | `eldritch_compound_eye_stalk` |
| `eldritch_sensory_stalk.entity.json` | `anatomy-creatures:eldritch_sensory_stalk` | `eldritch_sensory_stalk` |
| `eldritch_surface_eye.entity.json` | `anatomy-creatures:eldritch_surface_eye` | `eldritch_surface_eye` |
| `tortoise_eye.entity.json` | `anatomy-creatures:tortoise_eye` | `tortoise_eye` |

#### Standard-SubType Ears (add `anatomy:provides_hearing`)

| File | Entity ID | Current subType |
|------|-----------|-----------------|
| `badger_ear.entity.json` | `anatomy-creatures:badger_ear` | `ear` |
| `cat_ear.entity.json` | `anatomy-creatures:cat_ear` | `ear` |
| `cat_ear_decorated.entity.json` | `anatomy-creatures:cat_ear_decorated` | `ear` |
| `cat_ear_mottled_brown_gray.entity.json` | `anatomy-creatures:cat_ear_mottled_brown_gray` | `ear` |
| `ermine_ear.entity.json` | `anatomy-creatures:ermine_ear` | `ear` |
| `hyena_ear.entity.json` | `anatomy-creatures:hyena_ear` | `ear` |
| `newt_tympanum.entity.json` | `anatomy-creatures:newt_tympanum` | `ear` |
| `toad_tympanum.entity.json` | `anatomy-creatures:toad_tympanum` | `ear` |

#### Standard-SubType Noses (add `anatomy:provides_smell`)

| File | Entity ID | Current subType |
|------|-----------|-----------------|
| `beaver_folk_nose.entity.json` | `anatomy-creatures:beaver_folk_nose` | `nose` |
| `cat_folk_nose.entity.json` | `anatomy-creatures:cat_folk_nose` | `nose` |
| `hyena_muzzle.entity.json` | `anatomy-creatures:hyena_muzzle` | `nose` |
| `newt_nostril.entity.json` | `anatomy-creatures:newt_nostril` | `nose` |
| `toad_nostril.entity.json` | `anatomy-creatures:toad_nostril` | `nose` |

Note: `humanoid_nose.entity.json` is in the anatomy mod, not anatomy-creatures.

#### Multi-Sense Parts (add multiple affordances)

Some eldritch parts may provide multiple senses. Based on existing `descriptors:sensory_capability` usage:

| File | Entity ID | Affordances to Add |
|------|-----------|-------------------|
| `eldritch_tentacle_sensory.entity.json` | `anatomy-creatures:eldritch_tentacle_sensory` | `anatomy:provides_smell` (chemoreceptive) |

## Entity Count Summary

| Sense | anatomy mod | anatomy-creatures mod | Total |
|-------|-------------|----------------------|-------|
| Sight | 12 | 13 | 25 |
| Hearing | 1 | 8 | 9 |
| Smell | 1 | 5 | 6 |
| **Total** | **14** | **26** | **40** |

## Mod Manifest Updates

### anatomy/mod-manifest.json

Add to `content.components` array:
```json
"provides_sight.component.json",
"provides_hearing.component.json",
"provides_smell.component.json"
```

## Code Modifications

### SensoryCapabilityService.js

**File**: `src/perception/services/sensoryCapabilityService.js`

#### Current Implementation (to be replaced)

```javascript
// Check each sensory organ type
const canSee = this.#hasAtLeastOneFunctioningPart(bodyComponent, 'eye');
const canHear = this.#hasAtLeastOneFunctioningPart(bodyComponent, 'ear');
const canSmell = this.#hasAtLeastOneFunctioningPart(bodyComponent, 'nose');
```

#### New Implementation

```javascript
// Check for functioning parts with sensory affordance components
const canSee = this.#hasAtLeastOneFunctioningPartWithComponent(bodyComponent, 'anatomy:provides_sight');
const canHear = this.#hasAtLeastOneFunctioningPartWithComponent(bodyComponent, 'anatomy:provides_hearing');
const canSmell = this.#hasAtLeastOneFunctioningPartWithComponent(bodyComponent, 'anatomy:provides_smell');
```

#### New Private Method

Replace `#hasAtLeastOneFunctioningPart(bodyComponent, partType)` with:

```javascript
/**
 * Check if entity has at least one functioning part with the given sensory affordance.
 *
 * @param {Object} bodyComponent - The anatomy:body component data
 * @param {string} affordanceComponentId - Component ID to check for (e.g., 'anatomy:provides_sight')
 * @returns {boolean} True if at least one functioning part with this affordance exists
 * @private
 */
#hasAtLeastOneFunctioningPartWithComponent(bodyComponent, affordanceComponentId) {
  // Extract root ID from body component
  const rootId = bodyComponent.body?.root || bodyComponent.root;

  if (!rootId) {
    // Malformed body component - assume all senses for backward compat
    this.#logger.debug(
      `#hasAtLeastOneFunctioningPartWithComponent: No root in body component, assuming true for ${affordanceComponentId}`
    );
    return true;
  }

  // Get all parts in the anatomy graph
  const allParts = this.#bodyGraphService.getAllPartIds(rootId);

  if (!allParts || allParts.length === 0) {
    this.#logger.debug(
      `#hasAtLeastOneFunctioningPartWithComponent: No parts found for root ${rootId}`
    );
    return false;
  }

  // Check if any part has the affordance component and is functioning
  const hasFunctioning = allParts.some((partId) => {
    const hasAffordance = this.#entityManager.hasComponent(partId, affordanceComponentId);
    if (!hasAffordance) return false;
    return this.#isPartFunctioning(partId);
  });

  this.#logger.debug(
    `#hasAtLeastOneFunctioningPartWithComponent: ${affordanceComponentId} found functioning=${hasFunctioning}`
  );

  return hasFunctioning;
}
```

### BodyGraphService Interface Update

The service needs a method to get all parts in the anatomy graph. Check if `getAllPartIds(rootId)` exists; if not, it may need to be added or the implementation could iterate through the graph differently.

**Alternative approach** if `getAllPartIds` doesn't exist: Use the existing approach but query for multiple part types, or add a new method to iterate all descendants.

## Test Modifications

### Unit Tests

**File**: `tests/unit/perception/services/sensoryCapabilityService.test.js`

#### Changes Required

1. **Update mock setup**: Mock `hasComponent` for affordance components instead of `findPartsByType`

2. **Add new test scenarios**:

   - Scenario: Entity with exotic eye (eldritch_baleful_eye) with `anatomy:provides_sight` → canSee true
   - Scenario: Entity with standard eye (human_eye_hazel) with `anatomy:provides_sight` → canSee true
   - Scenario: Entity with eye lacking `anatomy:provides_sight` → canSee false (edge case)
   - Scenario: Entity with multiple visual organs, some destroyed → canSee true if any functioning
   - Scenario: Multi-sense organ (provides both sight and smell) → both senses available

3. **Update existing tests** to use affordance component checks instead of partType

#### Example Test Update

**Before (lines 108-115)**:
```javascript
mockBodyGraphService.findPartsByType.mockImplementation(
  (rootId, partType) => {
    if (partType === 'eye') return ['eye-left', 'eye-right'];
    if (partType === 'ear') return ['ear-left', 'ear-right'];
    if (partType === 'nose') return ['nose-1'];
    return [];
  }
);
```

**After**:
```javascript
mockBodyGraphService.getAllPartIds.mockReturnValue([
  'eye-left', 'eye-right', 'ear-left', 'ear-right', 'nose-1'
]);

mockEntityManager.hasComponent.mockImplementation((id, componentId) => {
  if (componentId === 'anatomy:provides_sight') return id.includes('eye');
  if (componentId === 'anatomy:provides_hearing') return id.includes('ear');
  if (componentId === 'anatomy:provides_smell') return id.includes('nose');
  if (componentId === 'anatomy:dismembered') return false;
  return false;
});
```

### Integration Tests

Consider adding integration tests that:

1. Load real entity definitions from `data/mods/anatomy/` and `data/mods/anatomy-creatures/`
2. Verify sensory capability detection for both standard and exotic creatures
3. Test the full perception event filtering with exotic creatures

## Documentation Updates

### Update `docs/modding/sense-aware-perception.md`

Add section on sensory affordance components:

```markdown
## Sensory Affordance Components

Body parts that provide sensory capabilities must include the appropriate affordance marker component:

- `anatomy:provides_sight` - Enables visual perception
- `anatomy:provides_hearing` - Enables auditory perception
- `anatomy:provides_smell` - Enables olfactory perception

### Adding Sensory Affordances to Custom Body Parts

When creating custom sensory organs, add the appropriate affordance component:

```json
{
  "id": "my-mod:crystal_eye",
  "components": {
    "anatomy:part": { "subType": "crystal_eye", ... },
    "anatomy:part_health": { ... },
    "anatomy:provides_sight": {}
  }
}
```

Multiple affordances can be added to multi-sensory organs:

```json
{
  "id": "my-mod:sensory_tentacle",
  "components": {
    "anatomy:part": { "subType": "tentacle", ... },
    "anatomy:provides_sight": {},
    "anatomy:provides_smell": {}
  }
}
```
```

## Migration Strategy

### Backward Compatibility

- Entities without any `anatomy:provides_*` components on their body parts will continue to use the existing backward compatibility behavior (all senses assumed available)
- The manual override via `perception:sensory_capability` continues to work unchanged
- No breaking changes to the public API

### Rollout Order

1. Create component definitions
2. Update mod manifests
3. Update entity definitions (can be done incrementally)
4. Update `SensoryCapabilityService` code
5. Update unit tests
6. Update documentation
7. Add integration tests

## Validation

### Pre-Implementation Checklist

- [ ] Verify `BodyGraphService` has method to get all part IDs or plan alternative
- [ ] Verify component schema is correct format
- [ ] Count all entity files needing updates (40 total)

### Post-Implementation Checklist

- [ ] All 3 component definitions created and valid
- [ ] All 40 entity definitions updated
- [ ] Mod manifests updated
- [ ] `SensoryCapabilityService` code updated
- [ ] All existing unit tests pass (after modification)
- [ ] New unit tests for exotic creatures pass
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] Integration test with eldritch creature verifies fix

## Files Summary

### Files to Create (3)

| File | Type |
|------|------|
| `data/mods/anatomy/components/provides_sight.component.json` | Component definition |
| `data/mods/anatomy/components/provides_hearing.component.json` | Component definition |
| `data/mods/anatomy/components/provides_smell.component.json` | Component definition |

### Files to Modify

| File | Change Type |
|------|-------------|
| `data/mods/anatomy/mod-manifest.json` | Add component references |
| `src/perception/services/sensoryCapabilityService.js` | Replace detection logic |
| `tests/unit/perception/services/sensoryCapabilityService.test.js` | Update mocks and add scenarios |
| `docs/modding/sense-aware-perception.md` | Add documentation section |
| 14 entity files in `data/mods/anatomy/entities/definitions/` | Add affordance components |
| 26 entity files in `data/mods/anatomy-creatures/entities/definitions/` | Add affordance components |

**Total files to modify**: 44 files
