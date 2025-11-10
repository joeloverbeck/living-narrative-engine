# WEASYSIMP-024: Create Complete Integration Tests

**Phase:** Testing & Validation
**Timeline:** 1 day
**Status:** Not Started
**Dependencies:** WEASYSIMP-011-015
**Priority:** P0

## Overview

Create comprehensive integration tests covering all weapons mod workflows and edge cases.

## Tests to Create

### Integration Tests (`tests/integration/mods/weapons/`)

1. `chamberingWorkflow.integration.test.js`
   - Bolt-action chambering workflow
   - Pump shotgun workflow
2. `jammingAndClearing.integration.test.js`
   - Jam occurrence (when implemented)
   - Clear jam workflow
   - Different jam types
3. `magazineManagement.integration.test.js`
   - Eject magazine workflow
   - Insert magazine workflow
   - Magazine entity creation/removal
   - Ammo tracking through magazine operations
4. `weaponsEdgeCases.integration.test.js`
   - Cannot shoot jammed weapon
   - Cannot shoot unchambered weapon
   - Cannot reload full weapon
   - Cannot chamber when already chambered
   - Multiple weapons in inventory
   - Switching between weapons

## Test Coverage Goals

- All actions: 100% execution coverage
- All scopes: 100% resolution coverage
- All rules: 100% operation coverage
- All events: 100% dispatch coverage
- Edge cases: comprehensive coverage

## Acceptance Criteria

- [ ] 4 integration test files created
- [ ] All edge cases covered
- [ ] Uses ModTestFixture
- [ ] All tests pass
- [ ] Coverage > 80%
- [ ] `npm run test:integration -- tests/integration/mods/weapons/` passes

## Related Tickets

- **Depends On:** WEASYSIMP-011-015
