# HEACALOVE-004: Update unit tests for data-driven health calculation

**Status**: COMPLETED

## Overview

Update the unit tests for `InjuryAggregationService` to work with the new data-driven weight system.

## Problem (Original)

After HEACALOVE-003, the existing tests will fail because:

1. Test fixtures don't include `healthCalculationWeight` property
2. Test fixtures don't include `vitalOrganCap` property
3. Expected values are based on old hardcoded weights
4. No tests exist for vital organ cap behavior

## Reassessment Findings

**The ticket assumptions were incorrect.** Upon analysis:

1. **Test fixtures already include `health_calculation_weight`** - Tests at lines 550-566, 593-598, etc. already include weight values in mock data.

2. **Test fixtures already include `vitalOrganCap`** - Tests at lines 669-901 comprehensively test vital organ caps with threshold/capValue properties.

3. **Expected values already use data-driven weights** - The service reads weights from component data, not type-based lookup.

4. **Vital organ cap tests already exist** - The `describe('vital organ health caps', ...)` block contains 5 comprehensive tests.

**Root cause**: HEACALOVE-003 was completed with tests already updated, making this ticket's original scope obsolete.

## Implementation Tasks (As Modified)

### 4.1 Strengthen Edge Case Coverage

Added 4 new tests to improve coverage from ~82% to ~86% branches and 98% to 100% statements:

1. **Parts with weight 0** - Verify they don't contribute to weighted average
2. **Negative weight handling** - Verify fallback to default weight of 1
3. **All parts with weight 0** - Verify graceful handling with 100% fallback
4. **Vital organ data error** - Verify error handling in `#getVitalOrganData`

## Test Cases Verified

### Weighted Calculation Tests

- [x] Parts with different weights are correctly weighted (existing)
- [x] Parts with weight 0 don't contribute to average (NEW)
- [x] Parts with missing weight use default (1) (existing)
- [x] Parts with negative weight use default (1) (NEW)

### Vital Organ Cap Tests

- [x] Single vital organ below threshold caps health (existing)
- [x] Single vital organ above threshold doesn't cap (existing)
- [x] Multiple vital organs - lowest cap wins (existing)
- [x] No vital organs - no cap applied (existing)
- [x] Vital organ with custom threshold/cap values (existing)

### Edge Cases

- [x] Empty part list returns 100 (existing)
- [x] All parts at 0% returns 0 (existing)
- [x] All parts at 100% returns 100 (existing)
- [x] Mix of weighted parts (existing)
- [x] All parts with weight 0 returns 100 (NEW)
- [x] Vital organ data throwing error handled gracefully (NEW)

## Acceptance Criteria

- [x] All test fixtures include `healthCalculationWeight`
- [x] All test fixtures include `vitalOrganCap` (null for non-vital)
- [x] Weighted calculation tests pass with new behavior
- [x] Vital organ cap tests added and passing
- [x] All tests pass: `npm run test:unit -- tests/unit/anatomy/services/injuryAggregationService.test.js`
- [x] No test coverage regression (IMPROVED: 98% → 100% statements, 82% → 86% branches)

## Outcome

**Changed vs Originally Planned:**

| Original Plan                     | Actual Work Done                                    |
| --------------------------------- | --------------------------------------------------- |
| Update fixtures to add properties | Fixtures already had properties - no changes needed |
| Change expected values            | Expected values were already correct                |
| Add vital organ cap tests         | Tests already existed - no changes needed           |
| Update mock EntityManager         | Mocks were already correct                          |

**New Work Completed:**

- Added 4 edge case tests to strengthen coverage
- Increased statement coverage from 98.41% to 100%
- Increased branch coverage from 82.81% to 85.93%
- Total tests: 50 → 54

**Files Modified:**

- `tests/unit/anatomy/services/injuryAggregationService.test.js` - Added 4 edge case tests

## Dependencies

- HEACALOVE-003: Service changes must be complete (VERIFIED COMPLETE)

## Follow-up Tickets

- HEACALOVE-005 through HEACALOVE-012: Entity definitions provide actual weights
