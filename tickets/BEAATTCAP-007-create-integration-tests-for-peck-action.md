# BEAATTCAP-007: Create Integration Tests for Peck Action

## Summary

Create comprehensive integration tests for the peck attack feature, covering action discovery, rule execution, and operator unit tests.

## Motivation

Tests validate that all components work together correctly and establish regression protection for the beak attack feature.

## Files to Touch

| File | Change Type |
|------|-------------|
| `tests/integration/mods/violence/peck_target_action_discovery.test.js` | **Create** |
| `tests/integration/mods/violence/peck_target_rule_execution.test.js` | **Create** |
| `tests/unit/logic/operators/hasPartSubTypeContainingOperator.test.js` | **Create** |

## Out of Scope

- **DO NOT** modify existing test files
- **DO NOT** change test helper implementations
- **DO NOT** alter domain matchers
- **DO NOT** modify the ModTestFixture class
- **DO NOT** create additional test utilities unless absolutely necessary

## Implementation Details

### 1. Action Discovery Tests

**File**: `tests/integration/mods/violence/peck_target_action_discovery.test.js`

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/modTestFixture.js';
import '../../../common/mods/domainMatchers.js';

describe('violence:peck_target action discovery', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction('violence', 'violence:peck_target');
  });

  afterEach(() => {
    fixture.cleanup();
  });

  describe('positive scenarios', () => {
    it('should discover peck action when actor has a beak body part');
    it('should discover peck action for chicken_beak subType');
    it('should discover peck action for tortoise_beak subType');
  });

  describe('negative scenarios', () => {
    it('should NOT discover peck action when actor has no beak');
    it('should NOT discover peck action when beak lacks damage_capabilities');
    it('should NOT discover peck action when target is dead');
  });

  describe('edge cases', () => {
    it('should generate combinations for multiple beaks');
  });
});
```

### 2. Rule Execution Tests

**File**: `tests/integration/mods/violence/peck_target_rule_execution.test.js`

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/modTestFixture.js';
import '../../../common/mods/domainMatchers.js';

describe('handle_peck_target rule execution', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forRule('violence', 'handle_peck_target');
  });

  afterEach(() => {
    fixture.cleanup();
  });

  describe('outcome handling', () => {
    it('should apply damage on SUCCESS outcome');
    it('should apply critical damage on CRITICAL_SUCCESS outcome');
    it('should not apply damage on FAILURE outcome');
    it('should cause actor to fall on FUMBLE outcome');
  });

  describe('damage type filtering', () => {
    it('should only apply piercing damage, not slashing');
  });

  describe('narrative generation', () => {
    it('should generate correct attack narrative on success');
    it('should generate fumble narrative with falling');
  });
});
```

### 3. Operator Unit Tests

**File**: `tests/unit/logic/operators/hasPartSubTypeContainingOperator.test.js`

```javascript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { HasPartSubTypeContainingOperator } from '../../../../src/logic/operators/hasPartSubTypeContainingOperator.js';

describe('HasPartSubTypeContainingOperator', () => {
  describe('evaluateInternal', () => {
    it('should return true when body part subType contains substring exactly');
    it('should return true when body part subType contains substring as part of larger string');
    it('should return true for tortoise_beak with substring beak');
    it('should return false when no body parts contain substring');
    it('should return false when entity has no body parts');
    it('should be case-insensitive');
    it('should return false for missing entityPath');
    it('should return false for missing substring');
    it('should return false for non-string substring');
  });
});
```

### Test Data Requirements

The tests require:
1. Actors with body graphs containing beak body parts
2. Target entities for attack actions
3. Mocked outcome resolution for predictable testing
4. Event capture capability for narrative validation

### Test Helper Methods (Expected)

The tests assume ModTestFixture supports or can be extended with:
- `createActorWithBodyPart({ actorName, bodyPartEntity, bodyPartSubType, excludeComponents? })`
- `createActorWithMultipleBodyParts({ actorName, bodyParts[] })`
- `createBeakAttackScenario({ attackOutcome, beakDamage?, beakDamageEntries?, actorName? })`
- `executeRuleAndCaptureEvents(scenario)`

**Note**: If these helpers don't exist, create minimal implementations within the test files or as separate fixture helpers specific to violence tests.

## Acceptance Criteria

### Tests That Must Pass

1. **Action Discovery Tests**:
   - All positive scenarios pass (3 tests)
   - All negative scenarios pass (3 tests)
   - Edge cases pass (1 test)

   ```bash
   npm run test:integration -- --testPathPattern="peck_target_action_discovery" --verbose
   ```

2. **Rule Execution Tests**:
   - All outcome handling tests pass (4 tests)
   - Damage type filtering test passes (1 test)
   - Narrative generation tests pass (2 tests)

   ```bash
   npm run test:integration -- --testPathPattern="peck_target_rule_execution" --verbose
   ```

3. **Operator Unit Tests**:
   - All execute method tests pass (9 tests)

   ```bash
   npm run test:unit -- --testPathPattern="hasPartSubTypeContaining" --verbose
   ```

4. **All Tests Together**:
   ```bash
   npm run test:unit -- --testPathPattern="hasPartSubTypeContaining" --silent
   npm run test:integration -- --testPathPattern="peck_target" --silent
   ```

### Invariants That Must Remain True

1. **Existing Tests Unchanged**: All existing test suites continue to pass
2. **Test Isolation**: Each test cleans up after itself via `fixture.cleanup()`
3. **No Side Effects**: Tests don't modify shared state or files
4. **Pattern Compliance**: Tests follow established ModTestFixture patterns
5. **Coverage**: New tests provide meaningful coverage of new functionality

## Verification Commands

```bash
# Run all new tests
npm run test:unit -- --testPathPattern="hasPartSubTypeContaining" --verbose
npm run test:integration -- --testPathPattern="peck_target" --verbose

# Verify no regressions in related tests
npm run test:unit -- --testPathPattern="operators" --silent
npm run test:integration -- --testPathPattern="violence" --silent

# Full test suite (ensure no global regressions)
npm run test:ci
```

## Dependencies

- BEAATTCAP-001 (beak entities with damage_capabilities)
- BEAATTCAP-002 (hasPartSubTypeContaining operator)
- BEAATTCAP-003 (actor_beak_body_parts scope)
- BEAATTCAP-004 (peck_target action and condition)
- BEAATTCAP-005 (handleBeakFumble macro)
- BEAATTCAP-006 (handle_peck_target rule)

## Blocked By

- All previous tickets (001-006) must be complete

## Blocks

- None (final ticket in series)

## Notes

### Test Implementation Strategy

**Recommended Order**:
1. Start with operator unit tests (BEAATTCAP-002 dependency only)
2. Then action discovery tests (requires 001-004)
3. Finally rule execution tests (requires all 001-006)

This allows incremental testing as features are implemented.

### Fixture Helper Creation

If `createActorWithBodyPart` or similar helpers don't exist in ModTestFixture:

**Option A**: Create helpers in the test file itself
```javascript
const createActorWithBeak = (fixture, name, beakType) => {
  // Implementation using existing fixture methods
};
```

**Option B**: Create a violence-specific test helper file
```javascript
// tests/common/mods/violence/beakAttackTestHelpers.js
export const createBeakAttackScenario = (fixture, options) => { ... };
```

Option A is preferred for this ticket to keep scope minimal.

### Event Type Validation

The narrative generation tests expect specific event types. If the violence mod uses different event types, adjust assertions accordingly:
- `violence:attack_hit` (or alternative)
- `violence:attack_fumbled` (or alternative)

Check existing violence tests for correct event type naming.
