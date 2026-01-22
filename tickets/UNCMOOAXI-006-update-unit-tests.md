# UNCMOOAXI-006: Update Unit Tests

## Summary

Update existing unit tests to reflect the new uncertainty axis (10 axes instead of 9) and add specific tests for uncertainty behavior.

## Priority: High | Effort: Medium

## Rationale

After adding uncertainty to constants, schema, and prototypes, existing tests that verify axis counts will fail. This ticket:
- Updates expected axis counts from 9 to 10
- Adds specific tests for uncertainty axis validation
- Ensures test coverage for the new axis

## Dependencies

- **UNCMOOAXI-001** through **UNCMOOAXI-005** must be complete (all implementation changes)

## Files to Touch

| File | Change Type |
|------|-------------|
| `tests/unit/constants/moodAffectConstants.test.js` | **Modify** - Update expected count, add uncertainty tests |
| `tests/unit/mods/core/components/mood.component.test.js` | **Modify** - Add uncertainty validation tests (if exists) |
| `tests/unit/expressionDiagnostics/services/randomStateGenerator.test.js` | **Verify** - Ensure coverage |

## Out of Scope

- **DO NOT** modify source files - implementation complete in prior tickets
- **DO NOT** create integration tests - that's UNCMOOAXI-007
- **DO NOT** modify prototype validation tests for individual prototypes

## Implementation Details

### File 1: tests/unit/constants/moodAffectConstants.test.js

**Update axis count tests:**

```javascript
describe('MOOD_AXES', () => {
  it('should have 10 axes', () => {
    expect(MOOD_AXES).toHaveLength(10);
  });

  it('should include uncertainty axis', () => {
    expect(MOOD_AXES).toContain('uncertainty');
  });

  it('should have uncertainty as the 10th axis', () => {
    expect(MOOD_AXES[9]).toBe('uncertainty');
  });
});
```

**Update Set tests:**

```javascript
describe('MOOD_AXES_SET', () => {
  it('should have 10 entries', () => {
    expect(MOOD_AXES_SET.size).toBe(10);
  });

  it('should include uncertainty', () => {
    expect(MOOD_AXES_SET.has('uncertainty')).toBe(true);
  });
});
```

**Update isMoodAxis tests:**

```javascript
describe('isMoodAxis', () => {
  it('should return true for uncertainty', () => {
    expect(isMoodAxis('uncertainty')).toBe(true);
  });
});
```

### File 2: tests/unit/mods/core/components/mood.component.test.js

If this file exists, add uncertainty validation tests:

```javascript
describe('mood.component.json - uncertainty axis', () => {
  it('should validate uncertainty in valid range', () => {
    const validMood = {
      valence: 0,
      arousal: 0,
      agency_control: 0,
      threat: 0,
      engagement: 0,
      future_expectancy: 0,
      self_evaluation: 0,
      affiliation: 0,
      inhibitory_control: 0,
      uncertainty: 0
    };
    expect(validate(validMood)).toBe(true);
  });

  it('should validate uncertainty at boundaries', () => {
    const lowBound = { ...baseMood, uncertainty: -100 };
    const highBound = { ...baseMood, uncertainty: 100 };

    expect(validate(lowBound)).toBe(true);
    expect(validate(highBound)).toBe(true);
  });

  it('should reject uncertainty outside valid range', () => {
    const tooLow = { ...baseMood, uncertainty: -101 };
    const tooHigh = { ...baseMood, uncertainty: 101 };

    expect(validate(tooLow)).toBe(false);
    expect(validate(tooHigh)).toBe(false);
  });

  it('should require uncertainty property', () => {
    const missingUncertainty = {
      valence: 0,
      arousal: 0,
      agency_control: 0,
      threat: 0,
      engagement: 0,
      future_expectancy: 0,
      self_evaluation: 0,
      affiliation: 0,
      inhibitory_control: 0
      // uncertainty omitted
    };
    expect(validate(missingUncertainty)).toBe(false);
  });
});
```

### File 3: tests/unit/expressionDiagnostics/services/randomStateGenerator.test.js

Verify existing tests handle new axis (likely auto-passes due to MOOD_AXES iteration):

```javascript
describe('RandomStateGenerator - uncertainty axis', () => {
  it('should generate uncertainty values in random states', () => {
    const state = generator.generateState();

    expect(state.moodAxes).toHaveProperty('uncertainty');
    expect(state.moodAxes.uncertainty).toBeGreaterThanOrEqual(-100);
    expect(state.moodAxes.uncertainty).toBeLessThanOrEqual(100);
  });
});
```

### Search for Other Affected Tests

Run this to find tests that may need updates:

```bash
# Find tests referencing mood axis counts
grep -rn "toHaveLength(9)" tests/unit/
grep -rn "\.length.*9" tests/unit/ | grep -i mood
grep -rn "toBe(9)" tests/unit/

# Find tests referencing MOOD_AXES
grep -rn "MOOD_AXES" tests/unit/
```

## Acceptance Criteria

### Tests That Must Pass

```bash
# All updated unit tests pass
npm run test:unit -- tests/unit/constants/moodAffectConstants.test.js --verbose

# All mood-related unit tests pass
npm run test:unit -- --testPathPattern="mood" --verbose

# Full unit test suite passes
npm run test:unit
```

### Invariants That Must Remain True

1. **Test Coverage**: No decrease in overall test coverage
2. **Existing Tests**: Only modify assertions about axis counts, not test logic
3. **New Tests**: Add tests for uncertainty specifically
4. **Test Isolation**: Tests remain independent and idempotent

## Verification Commands

```bash
# Run affected unit tests
npm run test:unit -- tests/unit/constants/moodAffectConstants.test.js --verbose

# Run all unit tests with coverage
npm run test:unit -- --coverage

# Lint modified test files
npx eslint tests/unit/constants/moodAffectConstants.test.js
```

## Definition of Done

- [ ] `moodAffectConstants.test.js` updated: axis count 9→10
- [ ] `moodAffectConstants.test.js` adds uncertainty-specific tests
- [ ] `mood.component.test.js` adds uncertainty validation tests (if file exists)
- [ ] `randomStateGenerator.test.js` verified or updated for uncertainty
- [ ] All modified tests pass
- [ ] No decrease in test coverage
- [ ] `npm run test:unit` passes completely
