# RISTOSURACT-007: Action discovery tests for rise_to_surface

## Status: COMPLETED

## Summary

Create integration tests for the `liquids:rise_to_surface` action discovery, verifying action structure, required/forbidden components, and discovery conditions.

## Files to Touch

- `tests/integration/mods/liquids/rise_to_surface_action_discovery.test.js` (NEW FILE)

## Out of Scope

- **DO NOT** modify any mod data files (action, rule, condition, component)
- **DO NOT** modify any existing test files
- **DO NOT** create tests for rule execution (handled in RISTOSURACT-008)
- **DO NOT** create tests for modifiers (handled in RISTOSURACT-010)
- **DO NOT** create tests for component schema (handled in RISTOSURACT-009)

## Implementation Details

### Test File Structure

```javascript
/**
 * @file Integration tests for liquids:rise_to_surface action discovery.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModActionTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder, ModEntityScenarios } from '../../../common/mods/ModEntityBuilder.js';
import riseToSurfaceAction from '../../../../data/mods/liquids/actions/rise_to_surface.action.json' assert { type: 'json' };

const ACTION_ID = 'liquids:rise_to_surface';

describe('liquids:rise_to_surface action discovery', () => {
  // Test implementation...
});
```

### Required Test Sections

#### 1. Action Structure Tests

| Test | Description | Assertion |
|------|-------------|-----------|
| Action ID | Verify correct ID | `id === 'liquids:rise_to_surface'` |
| Template | Verify placeholder format | Contains `{liquidBody}` and `{chance}` |
| Primary target | Verify scope | `targets.primary.scope === 'liquids:liquid_body_actor_is_in'` |
| Visual scheme | Verify colors match swim action | Matches existing liquid action colors |

#### 2. ChanceBased Configuration Tests

| Test | Description | Assertion |
|------|-------------|-----------|
| Enabled | ChanceBased is enabled | `chanceBased.enabled === true` |
| Contest type | Fixed difficulty | `contestType === 'fixed_difficulty'` |
| Difficulty | Base difficulty 50 | `fixedDifficulty === 50` |
| Actor skill | Uses mobility_skill | `actorSkill.component === 'skills:mobility_skill'` |
| Bounds | Min 5, Max 95 | `bounds.min === 5 && bounds.max === 95` |
| Thresholds | Critical success/failure | `criticalSuccessThreshold === 5` |

#### 3. Required Components Tests

| Test | Description | Assertion |
|------|-------------|-----------|
| in_liquid_body | Actor must be in liquid | Array contains `'liquids-states:in_liquid_body'` |
| submerged | Actor must be submerged | Array contains `'liquids-states:submerged'` |
| mobility_skill | Actor needs skill | Array contains `'skills:mobility_skill'` |

#### 4. Forbidden Components Tests

| Test | Description | Assertion |
|------|-------------|-----------|
| being_restrained | Cannot be restrained | Array contains `'physical-control-states:being_restrained'` |
| restraining | Cannot be restraining | Array contains `'physical-control-states:restraining'` |
| fallen | Cannot be fallen | Array contains `'positioning:fallen'` |

#### 5. Discovery Condition Tests

| Test | Expected Result |
|------|-----------------|
| Actor has in_liquid_body + submerged + mobility_skill | IS discoverable |
| Actor not in liquid body | NOT discoverable |
| Actor not submerged (in liquid but on surface) | NOT discoverable |
| Actor lacks mobility_skill | NOT discoverable |
| Actor is being_restrained | NOT discoverable |
| Actor is restraining | NOT discoverable |
| Actor is fallen | NOT discoverable |

### Test Setup Pattern

```javascript
// Create submerged actor in liquid body
const actor = new ModEntityBuilder('test:actor')
  .withName('Swimmer')
  .atLocation(room.id)
  .asActor()
  .withComponent('liquids-states:in_liquid_body', {
    liquid_body_id: liquidBody.id,
  })
  .withComponent('liquids-states:submerged', {})
  .withComponent('skills:mobility_skill', { value: 50 })
  .build();
```

## Acceptance Criteria

### Tests That Must Pass

- [x] `npm run test:integration -- tests/integration/mods/liquids/rise_to_surface_action_discovery.test.js` passes
- [x] All test assertions verify the action structure matches specification
- [x] Discovery tests correctly identify when action should/shouldn't appear

### Test Coverage Checks

- [x] Action structure section has at least 4 tests (4 implemented)
- [x] ChanceBased section has at least 4 tests (6 implemented)
- [x] Required components section has 1 comprehensive test (1 implemented)
- [x] Forbidden components section has 1 comprehensive test (1 implemented)
- [x] Discovery conditions section has at least 6 tests (7 implemented)

### Invariants That Must Remain True

- [x] No existing test files are modified
- [x] Tests follow existing patterns from swim_to_connected_liquid_body_action_discovery.test.js
- [x] Uses ModActionTestFixture and ModEntityBuilder from test utilities

## Verification Commands

```bash
# Run the new tests
npm run test:integration -- tests/integration/mods/liquids/rise_to_surface_action_discovery.test.js

# Run all liquids tests to ensure no regressions
npm run test:integration -- tests/integration/mods/liquids/
```

## Dependencies

- RISTOSURACT-006 (manifest must be updated for action to load)

## Blocks

- None (this is a testing ticket)

## Reference

- Pattern reference: `tests/integration/mods/liquids/swim_to_connected_liquid_body_action_discovery.test.js`
- Spec section: `specs/rise-to-surface-action.md` Section 7.1

---

## Outcome

### What was implemented

Created `tests/integration/mods/liquids/rise_to_surface_action_discovery.test.js` with 21 tests:

| Section | Tests | Description |
|---------|-------|-------------|
| Action structure | 4 | ID, template, primary target scope, visual scheme |
| ChanceBased configuration | 6 | Enabled, contest type, difficulty, actor skill, bounds, thresholds |
| Required components | 1 | Comprehensive test for all 3 required components |
| Forbidden components | 1 | Comprehensive test for all 3 forbidden components |
| Scope resolution | 2 | Verifies `liquid_body_actor_is_in` scope behavior |
| Action discovery | 7 | All positive and negative discovery conditions |

### Test Results

```
Test Suites: 1 passed, 1 total
Tests:       21 passed, 21 total

# Full liquids test suite:
Test Suites: 13 passed, 13 total
Tests:       189 passed, 189 total
```

### Deviations from original plan

- Added 2 extra scope resolution tests to verify the `liquid_body_actor_is_in` scope behavior
- ChanceBased section has 6 tests instead of the minimum 4 (more thorough coverage)
- Discovery conditions section has 7 tests instead of the minimum 6

### Key implementation decisions

1. Followed the exact pattern from `swim_to_connected_liquid_body_action_discovery.test.js`
2. Key difference: rise_to_surface REQUIRES `submerged` while swim_to FORBIDS it
3. No secondary target in rise_to_surface (simpler than swim_to action)
4. Used scope `liquid_body_actor_is_in` instead of `connected_liquid_bodies_for_actor`

### Files created

- `tests/integration/mods/liquids/rise_to_surface_action_discovery.test.js`

### Files modified

- None
