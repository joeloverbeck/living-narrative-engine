# LUNVITORGDEA-003: Implement Collective Vital Organ Death Check

## Status: COMPLETED

## Summary

Add `#checkCollectiveVitalOrganDestruction` method to DeathCheckService and integrate it into the death check flow. This method handles organs where ALL instances must be destroyed before triggering death.

## Reassessed Assumptions

- DeathCheckService does not expose or use a `#getBodyData` helper; it only has access to `injuryAggregationService` and `bodyGraphService`.
- `injuryAggregationService.aggregateInjuries()` only reports destroyed parts, not the full body part list.
- To find all organs of a collective type, the implementation must read `anatomy:body` from the actor entity and traverse parts via `bodyGraphService.getAllParts(...)`.
- Death checks run through both `checkDeathConditions` and `evaluateDeathConditions`; both paths must include collective organ handling.

## Dependencies

- LUNVITORGDEA-001 (Schema must include `requiresAllDestroyed` property)

## File List

### Files to Modify
- `src/anatomy/services/deathCheckService.js`

## Out of Scope

- DO NOT modify vital_organ component schema (done in 001)
- DO NOT modify entity files (done in 002)
- DO NOT modify hypoxiaTickSystem.js
- DO NOT modify oxygenDepleteHandler.js or oxygenRestoreHandler.js (done in 004)
- DO NOT modify death message generation (done in 005)

## Implementation Details

### New Private Method: `#checkCollectiveVitalOrganDestruction`

```javascript
/**
 * Checks if all organs of a collective vital organ type are destroyed.
 * For organs with requiresAllDestroyed: true, death only occurs when ALL
 * organs of that type are destroyed.
 *
 * @param {string} actorId - The actor entity ID
 * @returns {Object|null} - Death info if all collective organs destroyed, null otherwise
 */
#checkCollectiveVitalOrganDestruction(actorId) {
  const bodyData = this.#entityManager.getComponentData(
    actorId,
    BODY_COMPONENT_ID
  );
  if (!bodyData) return null;

  // Group organs by type where requiresAllDestroyed is true
  const collectiveOrgans = new Map(); // organType -> { total: number, destroyed: number, deathMessage: string }

  const partEntityIds = this.#bodyGraphService.getAllParts(bodyData, actorId);
  for (const partEntityId of partEntityIds) {
    const vitalOrganData = this.#entityManager.getComponentData(
      partEntityId,
      VITAL_ORGAN_COMPONENT_ID
    );

    if (!vitalOrganData || !vitalOrganData.requiresAllDestroyed) {
      continue;
    }

    const { organType, deathMessage } = vitalOrganData;
    const healthData = this.#entityManager.getComponentData(
      partEntityId,
      PART_HEALTH_COMPONENT_ID
    );

    if (!collectiveOrgans.has(organType)) {
      collectiveOrgans.set(organType, { total: 0, destroyed: 0, deathMessage });
    }

    const entry = collectiveOrgans.get(organType);
    entry.total++;

    if (healthData && healthData.currentHealth <= 0) {
      entry.destroyed++;
    }
  }

  // Check if any collective organ type has all instances destroyed
  for (const [organType, stats] of collectiveOrgans) {
    if (stats.total > 0 && stats.destroyed === stats.total) {
      return {
        organType,
        destroyedCount: stats.destroyed
      };
    }
  }

  return null;
}
```

### Modify Existing `#checkVitalOrganDestruction` Method

Update to skip organs with `requiresAllDestroyed: true`:

```javascript
#checkPartForVitalOrgan(partEntityId) {
  const vitalOrganData = this.#entityManager.getComponentData(
    partEntityId,
    VITAL_ORGAN_COMPONENT_ID
  );

  if (!vitalOrganData) return null;

  // Skip collective organs - they're handled by #checkCollectiveVitalOrganDestruction
  if (vitalOrganData.requiresAllDestroyed === true) {
    return null;
  }

  const { organType } = vitalOrganData;
  const killOnDestroy = vitalOrganData.killOnDestroy !== false;

  if (killOnDestroy) {
    return { organType, partEntityId };
  }

  return null;
}
```

### Integrate into Main Death Check Flow

In the main `checkDeath` method (or equivalent), add call to new method:

```javascript
// After existing vital organ check
const collectiveDeathInfo = this.#checkCollectiveVitalOrganDestruction(actorId);
if (collectiveDeathInfo) {
  return this.#triggerDeath(actorId, collectiveDeathInfo);
}
```

Note: DeathCheckService uses `checkDeathConditions` and `evaluateDeathConditions`; both should run the collective check before overall health/dying state evaluation. Use the existing `#finalizeDeath(...)` flow for immediate deaths, and set `vitalOrganDestroyed` to the collective organ type.

## Acceptance Criteria

### Tests That Must Pass
- `npm run test:unit -- --runInBand tests/unit/anatomy/services/deathCheckService.test.js`
- `npx eslint src/anatomy/services/deathCheckService.js`

### Invariants That Must Remain True
1. Brain, heart, spine destruction still triggers immediate death (single organ)
2. Destroying ONE lung does NOT trigger death
3. Destroying BOTH lungs DOES trigger death
4. Existing death check logic for non-collective organs unchanged
5. Method returns null when at least one collective organ of a type remains

### Behavioral Requirements
1. **Individual Organs** (brain, heart, spine): ANY destroyed → death
2. **Collective Organs** (lungs): ALL destroyed → death
3. **Mixed Check**: Both individual and collective checks run on each death evaluation

## Verification Commands

```bash
# Type check
npm run typecheck

# Lint the modified file
npx eslint src/anatomy/services/deathCheckService.js

# Run unit tests
npm run test:unit
```

## Design Notes

- Uses Map to track organ types for efficient grouping
- Iterates body parts once to collect all vital organ data
- Returns on first collective type where all are destroyed
- Preserves existing single-organ death logic completely
- Missing health data for a collective organ should be treated as destroyed (matches existing descendant vital organ handling)

## Estimated Diff Size

~80-120 lines across service + unit test updates.

## Outcome

- Implemented collective vital organ death checks in DeathCheckService using anatomy:body + bodyGraphService traversal.
- Updated single-organ checks to skip requiresAllDestroyed organs.
- Added unit coverage for collective lung deaths and constructor method requirements.
