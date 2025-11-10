# WEASYSIMP-020: Create Items Mod Aiming Tests

**Phase:** Testing & Validation
**Timeline:** 1 day
**Status:** Not Started
**Dependencies:** WEASYSIMP-007
**Priority:** P0

## Overview

Create comprehensive unit and integration tests for items mod aiming system.

## Tests to Create

### Unit Tests (`tests/unit/mods/items/`)

1. `components/aimingComponents.test.js`
   - Validate aimable and aimed_at component schemas
2. `actions/aimingActions.test.js`
   - Validate aim_item and lower_aim action schemas

### Integration Tests (`tests/integration/mods/items/`)

1. `aimingScopeResolution.test.js`
   - Test all 3 aiming scopes resolve correctly
2. `aimingEventsDispatched.test.js`
   - Test events dispatch correctly
3. `aimingRuleExecution.test.js`
   - Test handle_aim_item adds component
   - Test handle_lower_aim removes component
   - Verify event payloads
4. `aimingWorkflow.test.js`
   - Complete aim → lower aim workflow
   - Test with multiple items/targets

## Test Coverage Requirements

- Scope resolution: 100%
- Rule execution: 100%
- Event dispatching: 100%
- Error cases: edge cases covered

## Acceptance Criteria

- [ ] All test files created
- [ ] Tests use ModTestFixture
- [ ] All tests pass
- [ ] Coverage > 80%
- [ ] `npm run test:integration -- tests/integration/mods/items/` passes

## Related Tickets

- **Depends On:** WEASYSIMP-007
- **Pattern:** Use ModTestFixture.forAction()
