# DATDRISENAFF-012: Add Integration Tests for Exotic Creatures

## Description

Create integration tests that verify sensory capability detection for exotic creatures using real entity definitions.

This ticket is intentionally **test-only**: the engine has already switched from `subType`-based sensory detection to **data-driven sensory affordances** per `specs/data-driven-sensory-affordances.spec.md` (via `anatomy:provides_sight`, `anatomy:provides_hearing`, `anatomy:provides_smell`). These tests validate that the real mod content for exotic creatures is wired correctly and remains so.

## Files to Touch

### CREATE (1 file)
- `tests/integration/perception/exoticCreatureSensoryCapabilities.integration.test.js`

## Out of Scope

- Do NOT modify unit tests
- Do NOT modify existing integration tests
- Do NOT modify service code (unless the new test exposes a real regression)
- Do NOT modify entity files (unless the new test exposes mismatched affordance tags vs spec)

## Implementation Details

### Test File Structure

```javascript
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import SensoryCapabilityService from '../../../src/perception/services/sensoryCapabilityService.js';
import { BodyGraphService } from '../../../src/anatomy/bodyGraphService.js';
import SimpleEntityManager from '../../common/entities/simpleEntityManager.js';
// Import real entity definition JSON from data/mods/...

describe('Exotic Creature Sensory Capabilities - Integration', () => {
  // Setup and teardown

  describe('Eldritch Creatures with Exotic Eyes', () => {
    test('detects sight capability for eldritch_baleful_eye', () => {
      // Build a minimal anatomy graph containing a part instance created
      // from eldritch_baleful_eye.entity.json (includes anatomy:provides_sight).
      // Verify sensoryCapabilityService.getSensoryCapabilities(actorId).canSee === true
    });

    test('detects sight for creatures with multiple exotic eye types', () => {
      // Attach multiple eye parts (baleful eye + compound eye stalk).
      // Verify canSee === true
    });
  });

  describe('Tortoise with Non-Standard Eye SubType', () => {
    test('detects sight capability for tortoise_eye', () => {
      // tortoise_eye has subType 'tortoise_eye' but should provide sight via anatomy:provides_sight.
      // Verify canSee === true
    });
  });

  describe('Multi-Sense Organs', () => {
    test('detects smell capability for sensory tentacle (and not sight)', () => {
      // eldritch_tentacle_sensory provides smell via anatomy:provides_smell.
      // Verify canSmell === true and canSee === false.
    });
  });

  describe('Backward Compatibility', () => {
    test('returns all senses for entities without anatomy', () => {
      // No anatomy:body => backward compat => canSee/canHear/canSmell true.
    });

    test('respects manual override component', () => {
      // perception:sensory_capability.overrideMode === 'manual' should take precedence.
    });
  });

  describe('Damaged Sensory Organs', () => {
    test('returns false when all visual organs are destroyed', () => {
      // Create entity with eyes marked as destroyed
      // Verify canSee === false
    });

    test('returns true when at least one visual organ functions', () => {
      // Create entity with one destroyed eye, one functioning
      // Verify canSee === true
    });
  });
});
```

### Test Patterns to Follow

Reference existing integration tests in `tests/integration/perception/` for:
- Test setup patterns
- Mock creation utilities
- Entity loading patterns
- Assertion styles

### Real Entity Files to Load

- `data/mods/anatomy-creatures/entities/definitions/eldritch_baleful_eye.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/eldritch_compound_eye_stalk.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/eldritch_tentacle_sensory.entity.json`
- `data/mods/anatomy-creatures/entities/definitions/tortoise_eye.entity.json`

## Acceptance Criteria

### Tests That Must Pass
- `npm run test:integration -- tests/integration/perception/exoticCreatureSensoryCapabilities.integration.test.js` passes
- All 8+ test scenarios pass
- No existing integration tests break

### Invariants That Must Remain True
- Existing integration tests must continue to pass
- Test patterns must match existing `tests/integration/perception/` tests
- Tests must not require external dependencies beyond what's already used

## Risk Assessment

**Low Risk** - New test file creation with no production code changes expected; if a regression is found, the smallest code/data fix should be made and called out in the Outcome section when archiving.

## Dependencies

- `SensoryCapabilityService` must use affordance components (see `specs/data-driven-sensory-affordances.spec.md`)
- The listed real entity definitions must include the appropriate `anatomy:provides_*` tags
- Manual override component (`perception:sensory_capability`) must remain supported

## Estimated Diff Size

~200 lines in 1 new file

## Status

- [x] Completed

## Outcome

- Added `tests/integration/perception/exoticCreatureSensoryCapabilities.integration.test.js` to validate real exotic creature part definitions (`eldritch_*`, `tortoise_eye`) against `SensoryCapabilityService` using `anatomy:provides_*` affordances.
- Updated this ticket’s assumptions/sample test structure to match the current implementation (`getSensoryCapabilities(...).canSee/canHear/canSmell`), since the service and mod content are already affordance-driven per `specs/data-driven-sensory-affordances.spec.md`.
- No production code or mod content changes were required for the scenarios covered by this ticket.
