# WEASYSIMP-022: Create Shooting Workflow Tests

**Phase:** Testing & Validation
**Timeline:** 1 day
**Status:** Not Started
**Dependencies:** WEASYSIMP-011
**Priority:** P0 (Critical Path)

## Overview

Create integration tests for shooting workflow: aim → shoot → verify ammo decremented.

## Tests to Create

### Integration Tests (`tests/integration/mods/weapons/`)

1. `shootingWorkflow.integration.test.js`
   - Test basic shooting sequence
   - Test ammo decrementation
   - Test chambered state changes
   - Test event dispatching
   - Test auto-chambering for semi-auto weapons
   - Test manual chambering for bolt-action
   - Test shooting until empty
   - Test cannot shoot without ammo
   - Test cannot shoot while jammed
   - Test cannot shoot without aim

Based on spec test scenarios (lines 1999-2076).

## Key Test Cases

1. Pistol combat workflow (spec example)
2. Empty weapon (should not discover action)
3. Jammed weapon (should not discover action)
4. Not aimed (should not discover action)
5. Auto-chambering after shot
6. Event payload verification

## Acceptance Criteria

- [ ] Integration test file created
- [ ] Uses ModTestFixture
- [ ] All test cases pass
- [ ] Event verification included
- [ ] Component state verification
- [ ] `npm run test:integration -- tests/integration/mods/weapons/shootingWorkflow*` passes

## Related Tickets

- **Depends On:** WEASYSIMP-011
- **Critical Path:** Core weapons functionality
