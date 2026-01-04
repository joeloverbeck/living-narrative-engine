# LUNVITORGDEA-004: Filter Destroyed Organs from Oxygen Calculations

## Status

Completed

## Summary

Update oxygen operation handlers to skip destroyed organs (health = 0) when calculating oxygen depletion and restoration. A destroyed lung should not contribute to oxygen processing.

## Dependencies

- None (can be implemented in parallel with other tickets)

## File List

### Files to Modify
- `src/logic/operationHandlers/depleteOxygenHandler.js`
- `src/logic/operationHandlers/restoreOxygenHandler.js`
### Tests to Update
- `tests/unit/logic/operationHandlers/depleteOxygenHandler.test.js`
- `tests/unit/logic/operationHandlers/restoreOxygenHandler.test.js`

## Out of Scope

- DO NOT modify deathCheckService.js (done in 003)
- DO NOT modify hypoxiaTickSystem.js
- DO NOT modify entity files
- DO NOT modify component schemas
- DO NOT create new test files (update existing tests if coverage is needed)

## Implementation Details

### depleteOxygenHandler.js Changes

When iterating through respiratory organs to deplete oxygen, skip destroyed organs:

```javascript
// In the oxygen depletion logic
for (const organEntityId of respiratoryOrgans) {
  // Skip destroyed organs
  const healthData = this.#entityManager.getComponentData(
    organEntityId,
    PART_HEALTH_COMPONENT_ID
  );

  if (healthData && healthData.currentHealth <= 0) {
    continue; // Destroyed organ can't process oxygen
  }

  // Existing oxygen depletion logic...
  const respiratoryData = this.#entityManager.getComponentData(
    organEntityId,
    RESPIRATORY_ORGAN_COMPONENT_ID
  );
  // ... continue with depletion
}
```

### restoreOxygenHandler.js Changes

When iterating through respiratory organs to restore oxygen, skip destroyed organs:

```javascript
// In the oxygen restoration logic
for (const organEntityId of respiratoryOrgans) {
  // Skip destroyed organs
  const healthData = this.#entityManager.getComponentData(
    organEntityId,
    PART_HEALTH_COMPONENT_ID
  );

  if (healthData && healthData.currentHealth <= 0) {
    continue; // Destroyed organ can't absorb oxygen
  }

  // Existing oxygen restoration logic...
  const respiratoryData = this.#entityManager.getComponentData(
    organEntityId,
    RESPIRATORY_ORGAN_COMPONENT_ID
  );
  // ... continue with restoration
}
```

### Helper Method (Optional)

If both handlers share similar logic, consider extracting to a shared helper:

```javascript
/**
 * Checks if a respiratory organ is functional (not destroyed).
 * @param {string} organEntityId - The organ entity ID
 * @returns {boolean} - True if organ can process oxygen
 */
#isOrganFunctional(organEntityId) {
  const healthData = this.#entityManager.getComponentData(
    organEntityId,
    PART_HEALTH_COMPONENT_ID
  );
  return !healthData || healthData.currentHealth > 0;
}
```

## Acceptance Criteria

### Tests That Must Pass
- `npm run test:unit` - All existing unit tests must pass
- `npm run typecheck` - TypeScript type checking must pass
- `npx eslint src/logic/operationHandlers/depleteOxygenHandler.js src/logic/operationHandlers/restoreOxygenHandler.js` - No lint errors

### Invariants That Must Remain True
1. Healthy organs continue to deplete/restore oxygen normally
2. Damaged but not destroyed organs (health > 0) still function
3. Destroyed organs (health = 0) do NOT contribute to oxygen processing
4. Existing breathing tick behavior unchanged for healthy actors

### Behavioral Requirements
1. **Actor with 2 healthy lungs**: Full oxygen processing
2. **Actor with 1 destroyed lung**: One lung processes oxygen, destroyed lung skipped
3. **Actor with both lungs destroyed**: Zero oxygen processing (leads to hypoxia)

## Verification Commands

```bash
# Type check
npm run typecheck

# Lint modified files
npx eslint src/logic/operationHandlers/depleteOxygenHandler.js src/logic/operationHandlers/restoreOxygenHandler.js

# Run unit tests
npm run test:unit
```

## Design Notes

- Uses existing ANATOMY_PART_HEALTH_COMPONENT_ID constant (aliased as PART_HEALTH_COMPONENT_ID)
- Health check is simple: `currentHealth <= 0` means destroyed
- Filter happens early in loop to avoid unnecessary component lookups
- No changes to oxygen calculation formulas, only filtering of inputs

## Estimated Diff Size

~20 lines added across 2 files.

## Outcome

- Implemented filtering in `depleteOxygenHandler.js` and `restoreOxygenHandler.js` using part health checks and updated existing unit tests.
- Adjusted ticket scope to match actual file locations and allow updates to existing tests; no new test files or helper extraction were needed.
