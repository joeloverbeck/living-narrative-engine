# TREWOUACT-005: Create Action Discovery Integration Tests

**Status**: ✅ Completed

## Summary
Create comprehensive integration tests for the `treat_wounded_part` action discovery, verifying that the action appears/hides correctly based on actor skills, target wounds, and forbidden components.

## Files to Touch
- `tests/integration/mods/first-aid/treat_wounded_part_action_discovery.test.js` (CREATE)

## Out of Scope
- DO NOT modify any mod data files (those are TREWOUACT-001 through 004)
- DO NOT create rule execution tests (that's TREWOUACT-006)
- DO NOT modify any existing test files
- DO NOT modify test infrastructure (ModTestFixture, ModEntityBuilder, etc.)
- DO NOT modify the fixture or helper files in `tests/common/`

## Assumption Corrections (Applied During Implementation)

The following assumptions from the original ticket were corrected based on actual codebase analysis:

1. **No tertiary target**: Unlike `disinfect_wounded_part` (which has disinfectant) and `rinse_wounded_part` (which has water source), the `treat_wounded_part` action only has primary and secondary targets. Tests should NOT check for tertiary scopes.

2. **No `forbidden_components.secondary`**: The action only defines `forbidden_components.actor`, not secondary. Tests should not validate secondary forbidden components.

3. **`chanceBased` config is present**: The action has a full `chanceBased` configuration with modifiers. Tests validate this structure.

4. **Scope name difference**: This action uses `first-aid:treatable_target_body_parts` (not `wounded_target_body_parts`), which does NOT filter by coverage.

## Implementation Details

### Test File Structure
Follow the pattern established in `tests/integration/mods/first-aid/disinfect_wounded_part_action_discovery.test.js`.

### Required Test Scenarios

1. **Basic structure validation**
   - Action has expected id, name, template
   - Visual properties match green medical theme
   - Chance-based configuration is present and correctly structured

2. **Scope and component gates**
   - Uses `core:actors_in_location` for primary target
   - Uses `first-aid:treatable_target_body_parts` for secondary target
   - Requires `skills:medicine_skill` on actor
   - Forbidden components list on actor matches spec

3. **Discovery - positive cases**
   - Action IS discoverable when actor has medicine_skill AND target has wounded body parts
   - Action shows ALL wounded parts including covered ones (unlike disinfect)

4. **Discovery - negative cases (actor requirements)**
   - Action NOT discoverable when actor lacks `skills:medicine_skill`
   - Action NOT discoverable when actor has `positioning:fallen` component
   - Action NOT discoverable when actor has `positioning:bending_over` component

5. **Discovery - negative cases (target requirements)**
   - Action NOT discoverable when target has no wounded body parts (all parts at max health)
   - Action NOT discoverable when no other actors are in location

6. **KEY DIFFERENCE from disinfect: Covered wounds ARE targetable**
   - Action IS discoverable when wounded body part is covered by clothing
   - Verify that covered wounds appear in the target list (for modifier penalty application)

### Scope Resolver Mock
Must implement a mock for `first-aid:treatable_target_body_parts` that:
- Returns wounded body parts (currentHealth < maxHealth)
- Excludes vital organs
- Does NOT filter by accessibility (covered wounds included)

### Test Fixture Pattern
```javascript
import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModActionTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';
import treatAction from '../../../../data/mods/first-aid/actions/treat_wounded_part.action.json' assert { type: 'json' };

const ACTION_ID = 'first-aid:treat_wounded_part';
```

## Acceptance Criteria

### Specific Tests That Must Pass
All tests in this file must pass:
- `npm run test:integration -- tests/integration/mods/first-aid/treat_wounded_part_action_discovery.test.js`

### Test Coverage Requirements
- At least 8 distinct test cases covering the scenarios above
- Test both positive and negative discovery conditions
- Verify the key behavioral difference from `disinfect_wounded_part` (covered wounds allowed)

### Invariants That Must Remain True
- Existing test files unchanged
- Test infrastructure (ModTestFixture, etc.) unchanged
- No modifications to the JSON action file during test execution

## Verification Steps
1. Run `npm run test:integration -- tests/integration/mods/first-aid/treat_wounded_part_action_discovery.test.js`
2. Verify all tests pass
3. Verify no test pollution (tests are independent)
4. Run ESLint on new file: `npx eslint tests/integration/mods/first-aid/treat_wounded_part_action_discovery.test.js`

## Dependencies
- TREWOUACT-001 (scope file must exist)
- TREWOUACT-003 (action file must exist)

## Estimated Complexity
Medium-High - requires understanding of scope resolver mocking and action discovery infrastructure

---

## Outcome

### Files Created
- `tests/integration/mods/first-aid/treat_wounded_part_action_discovery.test.js` (10 test cases)

### Tests Implemented

| # | Test Name | Rationale |
|---|-----------|-----------|
| 1 | `has expected structure and visuals` | Validates id, name, template, visual properties, and chanceBased configuration |
| 2 | `uses the correct scopes and component gates` | Validates target scopes, required/forbidden components, verifies NO tertiary target |
| 3 | `is discoverable when actor has medicine_skill and target has wounded parts` | Core positive discovery case |
| 4 | `is hidden without medicine_skill` | Required component validation |
| 5 | `is hidden when actor has positioning:fallen` | Forbidden component validation |
| 6 | `is hidden when actor has positioning:bending_over` | Forbidden component validation |
| 7 | `is hidden when target has no wounded body parts` | Target scope empty case |
| 8 | `is hidden when no other actors are in location` | Primary scope empty case |
| 9 | `is discoverable even when wounded body part is covered by clothing` | **KEY DIFFERENCE TEST** - verifies covered wounds ARE targetable |
| 10 | `shows covered wounds in target list (unlike disinfect/rinse which hides them)` | Explicit comparison test |

### What Changed vs Originally Planned

1. **Ticket assumptions corrected** before implementation:
   - Removed tertiary target references (action only has primary+secondary)
   - Removed `forbidden_components.secondary` checks (action doesn't have them)
   - Added `chanceBased` configuration validation

2. **Tests implemented**: 10 tests (exceeded minimum of 8)

3. **Scope resolver mock**: Implemented `first-aid:treatable_target_body_parts` that does NOT filter by coverage

### Verification
- All 10 tests pass: `NODE_ENV=test npm run test:integration -- tests/integration/mods/first-aid/treat_wounded_part_action_discovery.test.js`
- ESLint passes: `npx eslint tests/integration/mods/first-aid/treat_wounded_part_action_discovery.test.js`
