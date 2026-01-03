# APPDAMCASDES-003: Extend DamageAccumulator with Cascade Recording

**Title:** Add recordCascadeDestruction Method to DamageAccumulator

**Summary:** Extend the DamageAccumulator service to track cascade destruction events within a damage session.

**Status:** Completed

## Files to Modify

- `src/anatomy/services/damageAccumulator.js`
- `tests/unit/anatomy/services/damageAccumulator.test.js`

## Files to Create

- None

## Out of Scope

- CascadeDestructionService (ticket APPDAMCASDES-001)
- DamageNarrativeComposer changes (ticket APPDAMCASDES-004)
- DamageResolutionService integration (ticket APPDAMCASDES-005)
- Integration tests (ticket APPDAMCASDES-006)
- E2E tests (ticket APPDAMCASDES-007)
- Any changes to existing method behavior (only additions)

## Implementation Details

### New Method

Add after the `recordEffect` method (mirroring existing guard/logging patterns):

```javascript
/**
 * Records a cascade destruction event in the session.
 * @param {object} session - The damage session object
 * @param {object} cascadeEntry - Cascade destruction data
 * @param {string} cascadeEntry.sourcePartId - ID of destroyed parent part
 * @param {string} cascadeEntry.sourcePartType - Type of destroyed parent part
 * @param {string} [cascadeEntry.sourceOrientation] - Orientation of parent part
 * @param {Array} cascadeEntry.destroyedParts - Array of destroyed child parts
 * @param {string} cascadeEntry.entityName - Name of the entity
 * @param {string} cascadeEntry.entityPossessive - Possessive form of entity name
 */
recordCascadeDestruction(session, cascadeEntry) {
  if (!session) {
    this.#logger.error(
      'DamageAccumulator.recordCascadeDestruction called without session'
    );
    return;
  }

  if (!cascadeEntry) {
    this.#logger.warn(
      'DamageAccumulator.recordCascadeDestruction called without cascadeEntry'
    );
    return;
  }

  if (!session.cascadeDestructions) {
    session.cascadeDestructions = [];
  }
  session.cascadeDestructions.push({
    ...cascadeEntry,
    timestamp: Date.now(),
  });
}
```

### Modified finalize Method

Update the return value to include cascadeDestructions:

```javascript
finalize(session) {
  // ... existing logic for entries and pendingEvents ...

  return {
    entries,
    pendingEvents,
    cascadeDestructions: session.cascadeDestructions
      ? [...session.cascadeDestructions]
      : [], // NEW field
  };
}
```

## Acceptance Criteria

### Tests That Must Pass

1. `recordCascadeDestruction should initialize cascadeDestructions array if not present`
2. `recordCascadeDestruction should append cascade entry with timestamp`
3. `recordCascadeDestruction should preserve existing cascade entries`
4. `recordCascadeDestruction should log error when session is null`
5. `recordCascadeDestruction should log warning when cascadeEntry is missing`
6. `finalize should return cascadeDestructions array (empty if none recorded)`
7. `finalize should return cascadeDestructions with recorded entries`
8. `finalize should preserve existing entries and pendingEvents behavior`
9. All existing DamageAccumulator tests continue to pass unchanged

### Invariants

- Session object structure is backward compatible (new field is optional)
- finalize() returns superset of previous return value
- Timestamps use Date.now() for consistency with other session data
- Method signature matches project conventions (session first, data second)
- No changes to existing recordDamage, recordEffect, or other methods
- finalize() returns copies of arrays (entries, pendingEvents, cascadeDestructions)

## Assumptions (Updated)

- DamageAccumulator methods log and return early on invalid arguments (session/data), so recordCascadeDestruction should follow the same pattern.
- finalize() returns copies of session arrays to avoid mutating session state.

## Dependencies

- Depends on: Nothing (can run in parallel with APPDAMCASDES-002)
- Blocks: APPDAMCASDES-005 (integration requires this method)

## Verification Commands

```bash
# Run unit tests for DamageAccumulator
npm run test:unit -- tests/unit/anatomy/services/damageAccumulator.test.js

# Lint modified file
npx eslint src/anatomy/services/damageAccumulator.js

# Type check
npm run typecheck
```

## Notes

- This is a pure addition - existing tests should pass without modification
- Can be implemented in parallel with APPDAMCASDES-002 and APPDAMCASDES-004
- The cascadeDestructions array follows the same pattern as existing session arrays
- Update JSDoc typedefs for DamageSession and FinalizedResult to include cascadeDestructions

## Outcome

Added recordCascadeDestruction with guard logging and timestamps, updated finalize to return cascadeDestructions copies (including null-session behavior), and extended unit tests to cover cascade destruction recording and finalize output. This expanded the scope slightly from the initial method sketch to align with existing guard/logging and copy semantics.
