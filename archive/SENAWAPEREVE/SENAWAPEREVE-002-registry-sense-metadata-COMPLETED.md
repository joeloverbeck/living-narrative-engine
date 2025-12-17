# SENAWAPEREVE-002: Add Sense Metadata to Perception Type Registry

**Status**: ✅ COMPLETED
**Priority**: HIGH
**Effort**: Medium
**Completed**: 2025-12-17

## Summary

Extend `PERCEPTION_TYPE_REGISTRY` with `primarySense` and `fallbackSenses` fields for all 34 perception types, plus add helper functions. This is an additive change with no behavioral impact - the data exists but is not yet consumed.

## File list it expects to touch

- **Modify**: `src/perception/registries/perceptionTypeRegistry.js`
- **Modify**: `tests/unit/perception/registries/perceptionTypeRegistry.test.js`

## Out of scope (must NOT change)

- Any existing API surface (only additions allowed)
- Schema files (handled in SENAWAPEREVE-001 and SENAWAPEREVE-006)
- Services that consume this data (handled in SENAWAPEREVE-005)
- Handler integration (handled in SENAWAPEREVE-007)
- Any other files in `src/perception/`
- Removing or renaming any existing exports

## Acceptance criteria

### Specific tests that must pass

- `npm run test:unit -- --testPathPattern="perceptionTypeRegistry"` passes
- All existing tests continue to pass (especially legacy mapping tests)
- New tests for sense helper functions pass

### Invariants that must remain true

- All 34 perception types have `primarySense` (string) and `fallbackSenses` (array) fields
- Existing API unchanged - only additions
- All existing registry lookups and validations work identically
- Helper functions return correct values per the sense mapping spec

## Implementation details

### New fields per registry entry

Add to each entry in `PERCEPTION_TYPE_REGISTRY`:

```javascript
{
  // existing fields...
  primarySense: 'visual',       // one of: visual, auditory, olfactory, tactile, proprioceptive, omniscient
  fallbackSenses: ['auditory', 'tactile']  // array of fallback senses in priority order
}
```

### Sense mappings (from spec)

```
communication.speech    -> auditory [tactile]
communication.thought   -> proprioceptive []
communication.notes     -> visual [tactile]
movement.arrival        -> visual [auditory, tactile]
movement.departure      -> visual [auditory]
combat.attack           -> visual [auditory, tactile]
combat.damage           -> visual [auditory, tactile]
combat.death            -> visual [auditory]
combat.violence         -> visual [auditory, tactile]
item.pickup             -> visual [auditory]
item.drop               -> auditory [visual]
item.transfer           -> visual [auditory]
item.use                -> visual [auditory]
item.examine            -> visual []
container.open          -> visual [auditory]
container.take          -> visual [auditory]
container.put           -> visual [auditory]
connection.lock         -> auditory [visual]
connection.unlock       -> auditory [visual]
consumption.consume     -> visual [auditory]
state.observable_change -> visual [auditory]
social.gesture          -> visual []
social.affection        -> visual [tactile]
social.interaction      -> visual [auditory, tactile]
physical.self_action    -> visual [auditory, tactile]
physical.target_action  -> visual [auditory, tactile]
intimacy.sexual         -> tactile [visual, auditory]
intimacy.sensual        -> tactile [visual, auditory]
performance.music       -> auditory [tactile]
performance.dance       -> visual [auditory]
magic.spell             -> visual [auditory, olfactory]
magic.ritual            -> visual [auditory, olfactory]
error.system_error      -> omniscient []
error.action_failed     -> omniscient []
```

### New helper functions to add

```javascript
/**
 * Get the primary sense required for a perception type
 * @param {string} type - Perception type (new or legacy format)
 * @returns {string} Primary sense category
 */
export function getPrimarySense(type) { ... }

/**
 * Get fallback senses for a perception type
 * @param {string} type - Perception type (new or legacy format)
 * @returns {string[]} Array of fallback senses in priority order
 */
export function getFallbackSenses(type) { ... }

/**
 * Check if perception type requires visual sense as primary
 * @param {string} type - Perception type
 * @returns {boolean}
 */
export function requiresVisual(type) { ... }

/**
 * Check if perception type is omniscient (always delivered)
 * @param {string} type - Perception type
 * @returns {boolean}
 */
export function isOmniscient(type) { ... }
```

### Test requirements

- Test each of 34 types has valid `primarySense` and `fallbackSenses`
- Test `getPrimarySense()` returns correct sense for sample types
- Test `getFallbackSenses()` returns correct array for sample types
- Test `requiresVisual()` returns true for visual-primary types, false otherwise
- Test `isOmniscient()` returns true only for error category types
- Test legacy type normalization still works with new fields

## Dependencies

- SENAWAPEREVE-001 (schema defines valid sense categories - conceptual dependency)

## Dependent tickets

- SENAWAPEREVE-005 (PerceptionFilterService uses these helper functions)

---

## Outcome

**Implementation matched plan exactly.** No deviations from the original ticket.

### Changes Made

#### `src/perception/registries/perceptionTypeRegistry.js`
- Updated `PerceptionTypeMetadata` typedef to include `primarySense` and `fallbackSenses` fields
- Added sense metadata (`primarySense` and `fallbackSenses`) to all 34 perception type entries
- Added 4 new helper functions: `getPrimarySense()`, `getFallbackSenses()`, `requiresVisual()`, `isOmniscient()`
- Updated default exports to include the new functions

#### `tests/unit/perception/registries/perceptionTypeRegistry.test.js`
- Added imports for the 4 new helper functions
- Updated "required properties" test to verify `primarySense` and `fallbackSenses` fields
- Added new test suite "Sense metadata" validating:
  - All 34 types have valid `primarySense` values (from allowed set)
  - All 34 types have valid `fallbackSenses` arrays
  - Correct sense mappings per spec (spot-checked 7 representative types)
- Added test suites for each helper function:
  - `getPrimarySense` - new types, legacy types, invalid types
  - `getFallbackSenses` - new types, legacy types, invalid types (returns empty array)
  - `requiresVisual` - visual-primary types, non-visual types, invalid types
  - `isOmniscient` - error types, non-error types, invalid types, legacy error types
- Added test for "Legacy type normalization with sense fields"

### Test Results

All 55 tests pass:
- 38 existing tests continue to pass (backward compatibility preserved)
- 17 new tests added for sense metadata and helper functions
