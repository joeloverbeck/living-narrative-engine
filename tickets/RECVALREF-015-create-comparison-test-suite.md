# RECVALREF-015: Create Legacy vs Refactored Comparison Test Suite

**Phase:** Migration Strategy
**Priority:** P0 - Critical
**Estimated Effort:** 6 hours
**Dependencies:** RECVALREF-014

## Context

Must ensure 100% output parity between old and new validation systems before deprecating legacy code.

## Objectives

1. Create comprehensive comparison test suite
2. Test all validation scenarios (valid, invalid, edge cases)
3. Compare error messages, warnings, and suggestions
4. Verify identical behavior for all existing recipes

## Implementation

### File to Create
`tests/integration/anatomy/validation/LegacyComparison.integration.test.js`

### Test Categories
1. **Valid Recipes** - Should produce identical success results
2. **Invalid Recipes** - Should produce identical error messages
3. **Edge Cases** - Should handle all edge cases identically
4. **Performance** - Should have comparable execution time

### Test Recipes
- Valid humanoid recipe
- Invalid missing component
- Invalid schema violation
- Blueprint processing scenarios
- Socket/slot compatibility issues
- Pattern matching scenarios
- All 11 validation check scenarios

## Acceptance Criteria
- [ ] Comparison test suite created
- [ ] Tests all validation scenarios
- [ ] 100% output parity achieved
- [ ] Performance within 10% tolerance
- [ ] All comparison tests pass

## Gate Requirement

**Migration cannot proceed to deprecation phase until all comparison tests pass with 100% parity.**

## References
- **Recommendations:** Section "Comparison Test Suite"
- **Migration Strategy:** Step 2 (Integration Testing)
