# HEACALOVE-013: Validation and integration testing

## Overview
Final validation and integration testing to ensure the data-driven health calculation system works correctly across the entire codebase.

## Prerequisites
All previous tickets must be complete:
- [x] HEACALOVE-001: Schema update for `health_calculation_weight`
- [x] HEACALOVE-002: Schema update for vital organ caps
- [x] HEACALOVE-003: Service implementation
- [x] HEACALOVE-004: Unit test updates
- [x] HEACALOVE-005: Vital organ entities
- [x] HEACALOVE-006: Torso entities
- [x] HEACALOVE-007: Head entities
- [x] HEACALOVE-008: Limb entities
- [x] HEACALOVE-009: Extremity entities
- [x] HEACALOVE-010: Sensory organ entities
- [x] HEACALOVE-011: Cosmetic entities
- [x] HEACALOVE-012: Remaining entities

## Validation Tasks

### 13.1 Schema Validation
```bash
npm run validate
```

Verify:
- [ ] All entity files pass schema validation
- [ ] No schema errors related to new properties
- [ ] `health_calculation_weight` values are numbers ≥ 0
- [ ] Vital organ cap properties are within 0-100 range

### 13.2 Completeness Check
```bash
# Find any anatomy entities missing health_calculation_weight
grep -L "health_calculation_weight" data/mods/anatomy/entities/definitions/*.entity.json
```

Verify:
- [ ] No anatomy entities are missing `health_calculation_weight`
- [ ] All vital organs have cap properties

### 13.3 Unit Test Execution
```bash
npm run test:unit -- tests/unit/anatomy/services/injuryAggregationService.test.js
```

Verify:
- [ ] All unit tests pass
- [ ] Coverage meets project standards (80%+ branches)
- [ ] New vital organ cap tests are included

### 13.4 Integration Test Execution
```bash
npm run test:integration -- tests/integration/anatomy/
```

Verify:
- [ ] Integration tests pass
- [ ] Health calculation integrates correctly with entity manager

### 13.5 Manual Scenario Testing
Test the original bug scenario manually:

**Setup**: Actor with damage:
- Torso: 0% (destroyed)
- Heart: 10% (critical)
- Right foot: 0% (destroyed)
- Right ass cheek: 0% (destroyed, bleeding)

**Expected Result**:
- Overall health: 20-40% (Critical state)
- Vital organ cap should apply (heart at 10% < 20% threshold → cap at 30%)

**Actual Result**: Document observed behavior

### 13.6 Edge Case Testing
Test edge cases:

1. **All parts healthy (100%)**: Should return 100%
2. **All parts destroyed (0%)**: Should return 0%
3. **Only vital organ damaged**: Should apply cap
4. **Multiple vital organs damaged**: Lowest cap should apply
5. **No vital organs (creature without heart/brain)**: Should calculate normally
6. **Parts with weight 0**: Should not contribute to average

### 13.7 Lint and Type Check
```bash
npx eslint src/anatomy/services/injuryAggregationService.js
npm run typecheck
```

Verify:
- [ ] No lint errors
- [ ] No type errors

## Test Scenarios Documentation

### Scenario 1: Original Bug Case
| Part | Health % | Weight | Contribution |
|------|----------|--------|--------------|
| Torso | 0% | 10 | 0 |
| Heart | 10% | 15 | 150 |
| Foot | 0% | 2 | 0 |
| Ass cheek | 0% | 0.2 | 0 |
| Other parts | 100% | varies | varies |

Heart cap applies: 10% < 20% threshold → max 30%

### Scenario 2: No Vital Damage
| Part | Health % | Weight | Contribution |
|------|----------|--------|--------------|
| Arm | 50% | 3 | 150 |
| Leg | 50% | 3 | 150 |
| Foot | 0% | 2 | 0 |
| Other parts | 100% | varies | varies |

No cap applies, weighted average calculated normally.

### Scenario 3: Multiple Vital Organs Damaged
| Part | Health % | Weight | Cap Applied |
|------|----------|--------|-------------|
| Heart | 10% | 15 | 30% |
| Brain | 5% | 15 | 30% |

Both caps apply, minimum (30%) used.

## Acceptance Criteria
- [ ] `npm run validate` passes with no errors
- [ ] All anatomy entities have `health_calculation_weight`
- [ ] All vital organs have cap properties
- [ ] Unit tests pass with adequate coverage
- [ ] Integration tests pass
- [ ] Original bug scenario produces 20-40% health
- [ ] Edge cases behave correctly
- [ ] No lint or type errors

## Rollback Plan
If critical issues are found:
1. Revert service changes (HEACALOVE-003)
2. Keep schema and entity changes (backward compatible)
3. Create new ticket for revised implementation

## Documentation
After successful validation:
- [ ] Update any relevant documentation
- [ ] Consider adding debug logging for health calculation (toggleable)
- [ ] Document the weight system for modders

## Sign-off
- [ ] All tests pass
- [ ] Manual testing complete
- [ ] Code reviewed (if applicable)
- [ ] Ready for merge to main
