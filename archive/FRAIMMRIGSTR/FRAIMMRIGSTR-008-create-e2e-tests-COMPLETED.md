# FRAIMMRIGSTR-008: Create E2E Tests for Fracture Immunity System

## Summary
Add end-to-end coverage that verifies the action-driven damage pipeline respects rigid-structure gating for fractures in realistic gameplay scenarios.

## Background (Updated)
E2E tests validate the damage pipeline from attack initiation through effect application. The rigid-structure gate already exists in `FractureApplicator`, and an integration suite exists for data-driven immunity checks. This ticket focuses on the action path (`weapons:swing_at_target`) to ensure:
1. Fractures trigger only when the target part has `anatomy:has_rigid_structure`
2. Soft-tissue parts never receive fractures even under high damage
3. User-visible outcomes are validated via emitted events and component state

## File List

### Files to Create
- `tests/e2e/anatomy/fractureRigidStructure.e2e.test.js`

### Reference Files (read-only)
- `tests/e2e/actions/damageEffectsTriggers.e2e.test.js` (action pipeline test bed patterns)
- `tests/integration/anatomy/fractureImmunity.integration.test.js` (data-driven fracture gating)
- `src/anatomy/applicators/fractureApplicator.js` (rigid structure check already implemented)

## Out of Scope (Updated)
- **DO NOT** modify source code in `src/`
- **DO NOT** modify entity definition files
- **DO NOT** expand or edit unit/integration coverage (this ticket is E2E-only)
- **DO NOT** add damage-simulator UI coverage (keep tests in the action pipeline)

## Implementation Details

### Test Structure (Updated)
```javascript
/**
 * @file E2E tests for fracture immunity system (action pipeline)
 * @see src/anatomy/applicators/fractureApplicator.js
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../common/mods/ModEntityBuilder.js';

describe('Fracture Rigid Structure - E2E', () => {
  let fixture;
  let testEnv;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction('weapons', 'weapons:swing_at_target', null, null, {
      autoRegisterScopes: true,
      scopeCategories: ['positioning', 'anatomy'],
    });
    testEnv = fixture.testEnv;
  });

  afterEach(() => {
    fixture?.cleanup();
  });

  it('swing weapon at leg (rigid structure) → CAN fracture', async () => {
    // Setup: part with anatomy:has_rigid_structure
    // Action: swing weapon with fracture-enabled damage entry
    // Verify: anatomy:fractured component + anatomy:fractured event
  });

  it('swing weapon at breast (soft tissue) → CANNOT fracture', async () => {
    // Setup: part without anatomy:has_rigid_structure
    // Action: swing weapon with high damage
    // Verify: no anatomy:fractured component, no event
  });
});
```

### Test Scenarios (Updated)
**Positive Case (Should Fracture):**
1. Bludgeoning damage to a part with `anatomy:has_rigid_structure` → fracture event + component

**Negative Case (Should NOT Fracture):**
1. Any damage amount to a part without `anatomy:has_rigid_structure` → no fracture

## Acceptance Criteria

### Tests That Must Pass (Updated)
```bash
NODE_ENV=test npx jest tests/e2e/anatomy/fractureRigidStructure.e2e.test.js --no-coverage --runInBand --verbose
```
- New E2E tests pass

### Invariants That Must Remain True
- Tests exercise the action-driven damage pipeline (`weapons:swing_at_target`)
- Tests verify user-visible outcomes (component presence, events)
- Tests remain order-independent

## Estimated Diff Size
~200-250 lines (new file)

## Dependencies (Updated)
- `FractureApplicator` rigid-structure gate already present
- `tests/integration/anatomy/fractureImmunity.integration.test.js` already covers data-driven cases

## Blocked By (Updated)
- None (core implementation and integration coverage are already in place)

## Blocks
None - this is the final validation ticket.

## Status
Completed

## Outcome
- Added action-pipeline E2E coverage for rigid-structure fracture gating.
- Scoped to event/component assertions; no UI coverage and no source/data changes.
