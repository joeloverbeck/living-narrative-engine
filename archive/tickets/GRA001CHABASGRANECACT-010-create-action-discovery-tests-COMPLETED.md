# GRA001CHABASGRANECACT-010: Create Action Discovery Tests

**STATUS: COMPLETED**

## Summary
Create the integration test file `grab_neck_target_action_discovery.test.js` that verifies the action discovery logic for the chance-based grab neck action.

## File List (Files to Touch)

### Files to Create
- `tests/integration/mods/grabbing/grab_neck_target_action_discovery.test.js`

## Out of Scope

**DO NOT modify or touch:**
- `tests/integration/mods/grabbing/squeeze_neck_with_both_hands_action_discovery.test.js`
- Any mod data files in `data/mods/`
- Any source code in `src/`
- Any test helper files in `tests/common/`
- Rule execution tests (separate ticket)
- Component validation tests (separate ticket)

## Implementation Details

### Test File Structure

Based on the existing pattern from `squeeze_neck_with_both_hands_action_discovery.test.js`, create tests for:

```javascript
/**
 * @file Integration tests for grabbing:grab_neck_target action discovery.
 * @description Ensures the grab neck target action is only discoverable when
 * proximity, appendage, and state requirements are met.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityScenarios } from '../../../common/mods/ModEntityBuilder.js';
import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';
import grabNeckTargetAction from '../../../../data/mods/grabbing/actions/grab_neck_target.action.json';

const ACTION_ID = 'grabbing:grab_neck_target';
```

### Test Cases Required

#### Action Structure Validation
| Test Case | Description |
|-----------|-------------|
| `matches the expected grabbing action schema` | ID, template with `{chance}%`, targets scope |
| `requires actor closeness + melee skill and uses the grabbing color palette` | `required_components`, `visual` properties |
| `has chance-based configuration with opposed contest` | `chanceBased.enabled`, `contestType`, skills, `targetRole` |
| `declares forbidden target components` | `forbidden_components.target` includes `grabbing-states:neck_grabbed` and `core:dead` |
| `has prerequisite for free grabbing appendage` | `prerequisites` array references anatomy condition |

#### Action Discovery Scenarios
| Test Case | Description |
|-----------|-------------|
| `is available for close actors facing each other` | Standard valid scenario |
| `is available when the actor stands behind the target` | Facing away scenario |
| `is not available when actors are not in closeness` | Missing closeness component |
| `is not available when the actor faces away from the target` | Actor facing wrong direction |
| `is not available when actor has no free hands` | All appendages locked |
| `is not available when actor lacks melee skill` | Missing `skills:melee_skill` component |
| `is not available when actor is fallen` | Actor has `recovery-states:fallen` |
| `is not available when actor is restraining someone` | Actor has `physical-control-states:restraining` |
| `is not available when actor is being restrained` | Actor has `physical-control-states:being_restrained` |
| `is not available when actor is already grabbing neck` | Actor has `grabbing-states:grabbing_neck` |

#### Chance Modifier Tests
| Test Case | Description |
|-----------|-------------|
| `shows bonus when target is fallen` | +20 modifier appears (targetRole `primary`, uses `entity.primary` path) |
| `shows bonus when target is restrained` | +15 modifier appears (targetRole `primary`, uses `entity.primary` path) |

### Test Setup Pattern

```javascript
describe('grabbing:grab_neck_target action discovery', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('grabbing', ACTION_ID);
    testFixture.testEnv.actionIndex.buildIndex([grabNeckTargetAction]);
    ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);
  });

  afterEach(() => {
    testFixture.cleanup();
  });
  // ... tests
});
```

### Notes on Discovery Validation

- `ModTestFixture` validation treats string `targets` as `primary`, so `forbidden_components.target` is not enforced during discovery. Validate target forbidden components via action definition assertions instead.

## Acceptance Criteria

### Tests That Must Pass
- All new tests in this file pass: `npm run test:integration -- tests/integration/mods/grabbing/grab_neck_target_action_discovery.test.js`
- Existing tests in grabbing folder pass: `npm run test:integration -- tests/integration/mods/grabbing/`
- No regressions in overall test suite

### Invariants That Must Remain True
- Test file follows established patterns from other action discovery tests
- Uses `ModTestFixture.forAction()` factory method
- Uses `ScopeResolverHelpers.registerPositioningScopes()` for scope registration
- All assertions use Jest's `expect()` API
- `beforeEach` and `afterEach` properly initialize and cleanup
- Test descriptions clearly indicate what is being tested

## Verification Steps

1. File exists: `tests/integration/mods/grabbing/grab_neck_target_action_discovery.test.js`
2. Tests pass: `npm run test:integration -- tests/integration/mods/grabbing/grab_neck_target_action_discovery.test.js`
3. Tests cover all actor forbidden_components scenarios in discovery, and validate target forbidden_components via action definition
4. Tests cover prerequisite (free hand) scenario
5. Tests cover chance modifier scenarios

## Dependencies
- GRA001CHABASGRANECACT-005 (action must exist)
- GRA001CHABASGRANECACT-008 (old test must be deleted first - resolved)

## Blocked By
- None (GRA001CHABASGRANECACT-008 already completed)

## Blocks
- None

## Test Count Estimate
- Structure validation: 5 tests
- Discovery scenarios: 10 tests
- Chance modifiers: 2 tests
- **Total: ~17 tests**

## Outcome
- Added `grab_neck_target_action_discovery.test.js` with action structure, discovery, and modifier assertions plus melee skill coverage.
- Validated target forbidden components via action definition checks (action discovery uses `primary` targets for string scopes), instead of discovery-time filtering for `core:dead`/`grabbing-states:neck_grabbed`.
