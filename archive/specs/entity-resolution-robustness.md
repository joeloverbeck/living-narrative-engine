# Entity Resolution Robustness Specification

## Context

### Location in Codebase

- **Primary Module**: `src/anatomy/validation/socketExtractor.js`
- **Key Function**: `resolveEntityId(partType, dataRegistry)` (lines 375-398)
- **Caller**: `extractSlotChildSockets(blueprint, hierarchicalSockets, dataRegistry)` (lines 121-175)

### What the Module Does

The `socketExtractor.js` module extracts socket information from anatomy blueprints during validation. The `resolveEntityId` function resolves a `partType` (e.g., "head", "arm", "leg") to an entity definition ID, which is then used to extract expected sockets for that body part.

This is critical for the `socket_slot_compatibility` validation check, which ensures that blueprint slots reference sockets that actually exist on their parent entities.

### Current Implementation

```javascript
async function resolveEntityId(partType, dataRegistry) {
  if (!dataRegistry || !partType) {
    return null;
  }

  let allEntities = [];
  if (typeof dataRegistry.getAll === 'function') {
    allEntities = dataRegistry.getAll('entityDefinitions') || [];
  } else if (typeof dataRegistry.getAllEntityDefinitions === 'function') {
    allEntities = dataRegistry.getAllEntityDefinitions() || [];
  }

  // Find first entity with anatomy:part.subType matching the partType
  for (const entity of allEntities) {
    const partComponent = entity?.components?.['anatomy:part'];
    if (partComponent?.subType === partType) {
      return entity.id; // Returns FIRST match
    }
  }

  return null;
}
```

---

## Problem

### What Failed

The `recipeValidationComparison.regression.test.js` integration tests failed with:

1. Missing `socket_slot_compatibility` from passed checks (expected 10 checks, got 9)
2. `SOCKET_NOT_FOUND_ON_PARENT` errors for `brain_socket` on parent slot `head`

### How It Failed

The `resolveEntityId("head")` function returned `anatomy:humanoid_face_bearded_full_trimmed` instead of `anatomy:humanoid_head` because:

1. The function returns the **first** entity matching `anatomy:part.subType === "head"`
2. Entity iteration order is non-deterministic (depends on object property order, registry loading order, or alphabetical sorting)
3. With 13 entities having `subType: "head"`, the alphabetically-first entity (`humanoid_face_bearded_full_trimmed`) was returned
4. This entity was missing `brain_socket`, while the canonical `humanoid_head` entity had it

### Why It Failed

**Root Cause**: Non-deterministic entity resolution due to:

1. No concept of "canonical" or "base" entity for a `partType`
2. No requirement that all entities of the same `subType` share the same required sockets
3. First-match strategy is inherently unstable across different load orders

### Immediate Fix Applied

Added `brain_socket` and `anatomy:damage_propagation` to `humanoid_face_bearded_full_trimmed.entity.json` to match other head entities.

### Test References

- **Primary Test**: `tests/integration/regression/anatomy/recipeValidationComparison.regression.test.js`
- **Test Case**: "maintains parity for the human male recipe"
- **Snapshot**: `tests/integration/regression/anatomy/__snapshots__/recipeValidationComparison.regression.test.js.snap`

---

## Truth Sources

### Documentation

- Anatomy system docs: `docs/anatomy/` directory
- Slot library schema: `data/schemas/anatomy.slot-library.schema.json`
- Entity definition schema: `data/schemas/entity-definition.schema.json`

### Domain Rules

1. Body parts of the same type (e.g., all heads) should have consistent anatomical features
2. Vital organs (brain, heart, spine) are required components of their parent parts
3. Slot libraries define expected sockets for each slot type

### External Contracts

- **Slot Library Contract**: `data/mods/anatomy/libraries/humanoid.slot-library.json`
  - `standard_brain` slot requires `brain_socket` on parent `head`
  - `standard_heart` slot requires `heart_socket` on parent torso
  - `standard_spine` slot requires `spine_socket` on parent torso

- **Blueprint Part Contract**: `data/mods/anatomy/parts/humanoid_core.part.json`
  - References slot library definitions via `$use`
  - Expects child slots to find their required sockets on parent entities

---

## Desired Behavior

### Normal Cases

1. **Deterministic Resolution**: Given the same `partType`, always return the same entity ID
2. **Predictable Selection**: Use explicit priority rules (e.g., prefer entities without variant suffixes, prefer base IDs)
3. **Complete Socket Sets**: Resolved entities should have all sockets required by child slots

### Edge Cases

| Scenario                              | Current Behavior               | Desired Behavior                       |
| ------------------------------------- | ------------------------------ | -------------------------------------- |
| Multiple entities with same `subType` | Returns first match (unstable) | Returns canonical/base entity          |
| No entity matches `partType`          | Returns `null` silently        | Returns `null` with warning log        |
| Entity missing expected sockets       | Causes validation failure      | Warn during resolution, not validation |
| Variant entity resolved               | May miss required sockets      | Prefer base entities over variants     |

### Failure Modes

| Condition                                | Expected Response                                  |
| ---------------------------------------- | -------------------------------------------------- |
| `partType` is null/undefined             | Return `null`, no error                            |
| `dataRegistry` is null/undefined         | Return `null`, no error                            |
| No matching entity found                 | Return `null`, log warning with `partType`         |
| Multiple candidates found                | Return most canonical, log info about alternatives |
| Resolved entity missing required sockets | Log warning about socket mismatch                  |

### Invariants

Properties that MUST always hold:

1. **Socket Consistency**: All entities with the same `subType` MUST have identical socket IDs in their `anatomy:sockets.sockets` array
2. **Deterministic Order**: Given identical inputs, `resolveEntityId` MUST return the same entity ID
3. **Base Entity Priority**: If a "base" entity exists (e.g., `humanoid_head` for `subType: "head"`), it SHOULD be preferred
4. **No Silent Failures**: If resolution fails or is ambiguous, a warning MUST be logged

---

## API Contracts

### What Stays Stable (Public Contract)

```javascript
// Function signature - STABLE
async function resolveEntityId(partType, dataRegistry) → Promise<string | null>

// Parameters - STABLE
// partType: string - The anatomy part type to resolve (e.g., "head", "arm")
// dataRegistry: IDataRegistry - Registry containing entity definitions

// Return value - STABLE
// Returns entity ID string or null if not found
```

### What Is Allowed to Change (Implementation Details)

1. **Resolution Strategy**: Can change from first-match to:
   - Explicit canonical entity registry
   - Naming convention-based priority (prefer `humanoid_X` over `humanoid_X_variant`)
   - Socket count heuristic (prefer entity with most sockets)

2. **Logging Behavior**: Can add:
   - Debug logging for resolution decisions
   - Warning logging for ambiguous resolutions
   - Info logging for alternative candidates

3. **Validation Integration**: Can add:
   - Socket completeness validation during resolution
   - Early warning for socket mismatches
   - Caching of resolution results

4. **Configuration Options**: Can add:
   - `preferredEntityPattern` regex for prioritization
   - `requireSocketConsistency` flag for strict mode
   - `canonicalEntityMap` explicit override mapping

---

## Testing Plan

### Unit Tests to Add/Update

**File**: `tests/unit/anatomy/validation/socketExtractor.test.js`

| Test Case                                                     | Purpose                  |
| ------------------------------------------------------------- | ------------------------ |
| `resolveEntityId returns null for null partType`              | Guard clause validation  |
| `resolveEntityId returns null for null dataRegistry`          | Guard clause validation  |
| `resolveEntityId returns null when no entity matches`         | Negative case handling   |
| `resolveEntityId returns consistent ID across multiple calls` | Determinism verification |
| `resolveEntityId prefers base entity over variants`           | Priority rule validation |
| `resolveEntityId logs warning for ambiguous resolution`       | Observability check      |

### Integration Tests to Add/Update

**File**: `tests/integration/anatomy/entityResolutionConsistency.integration.test.js`

| Test Case                                                 | Purpose               |
| --------------------------------------------------------- | --------------------- |
| `all entities with subType "head" have brain_socket`      | Data consistency      |
| `all entities with subType "torso" have heart_socket`     | Data consistency      |
| `all entities with subType "torso" have spine_socket`     | Data consistency      |
| `socket_slot_compatibility passes for all recipes`        | Regression prevention |
| `entity resolution is stable across registry load orders` | Order independence    |

### Property Tests (Recommended)

**File**: `tests/property/anatomy/entitySocketConsistency.property.test.js`

```javascript
// Property: All entities with the same subType have identical socket IDs
property('socket consistency', () => {
  const allEntities = loadAllEntityDefinitions();
  const bySubType = groupBy(
    allEntities,
    (e) => e.components['anatomy:part']?.subType
  );

  for (const [subType, entities] of Object.entries(bySubType)) {
    const socketSets = entities.map(
      (e) =>
        new Set(
          e.components['anatomy:sockets']?.sockets?.map((s) => s.id) || []
        )
    );

    // All socket sets should be equal
    expect(allEqual(socketSets)).toBe(true);
  }
});
```

### Regression Tests

The existing test serves as the primary regression test:

- **File**: `tests/integration/regression/anatomy/recipeValidationComparison.regression.test.js`
- **Key Assertion**: `socket_slot_compatibility` appears in passed checks
- **Snapshot**: Captures expected check count and messages

### Validation Script Enhancement

Add to `scripts/validateMods.js`:

```javascript
// Phase N: Validate entity socket consistency
// For each subType, verify all entities have identical socket IDs
```

---

## Implementation Recommendations

### Short-term (Immediate Prevention)

1. Add data validation script to CI that checks socket consistency across entities with same `subType`
2. Add unit tests for `resolveEntityId` edge cases

### Medium-term (Robustness)

1. Implement naming convention-based priority in `resolveEntityId`:
   - Prefer `anatomy:humanoid_X` over `anatomy:humanoid_X_variant`
   - Prefer shorter IDs over longer IDs
2. Add warning logging when multiple candidates exist

### Long-term (Flexibility)

1. Introduce explicit canonical entity registry in slot library:
   ```json
   {
     "canonicalEntities": {
       "head": "anatomy:humanoid_head",
       "arm": "anatomy:humanoid_arm",
       "torso": "anatomy:human_male_torso"
     }
   }
   ```
2. Support per-recipe entity overrides for validation context
