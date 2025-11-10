# WEASYSIMP-023: Create Reloading Workflow Tests

**Phase:** Testing & Validation
**Timeline:** 1 day
**Status:** Not Started
**Dependencies:** WEASYSIMP-012
**Priority:** P0 (Critical Path)

## Overview

Create integration tests for reloading workflow: empty weapon → reload → verify ammo transferred.

## Tests to Create

### Integration Tests (`tests/integration/mods/weapons/`)

1. `reloadingWorkflow.integration.test.js`
   - Test basic reload sequence
   - Test ammo transfer math
   - Test partial reload (when container has less than needed)
   - Test auto-lower aim during reload
   - Test reload from different container types (magazine, ammo box, speed loader)
   - Test empty container removal
   - Test chambering after reload
   - Test event dispatching
   - Test cannot reload full weapon

Based on spec test scenario (lines 2039-2076).

## Key Test Cases

1. Reload under pressure (spec example - auto-lowers aim)
2. Reload empty weapon
3. Reload partially empty weapon
4. Reload with insufficient ammo in container
5. Reload removes empty container
6. Reload sets chambered flag
7. Cannot reload full weapon (action not discovered)

## Acceptance Criteria

- [ ] Integration test file created
- [ ] Uses ModTestFixture
- [ ] Tests reload math (transfer calculation)
- [ ] Tests aim lowering
- [ ] Tests container removal
- [ ] Event verification included
- [ ] `npm run test:integration -- tests/integration/mods/weapons/reloadingWorkflow*` passes

## Related Tickets

- **Depends On:** WEASYSIMP-012
- **Critical Path:** Essential weapons functionality
