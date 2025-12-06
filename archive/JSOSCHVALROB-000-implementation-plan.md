# JSOSCHVALROB-000: JSON Schema Validation Robustness - Implementation Plan

## Overview

This document provides the implementation plan for improving the robustness of the JSON Schema validation system, addressing the oneOf → anyOf schema change and preventing future validation failures.

**Specification**: `specs/json-schema-validation-robustness.md`

**Total Tickets**: 6 tickets (JSOSCHVALROB-001 through JSOSCHVALROB-006)

---

## Ticket Summary

### JSOSCHVALROB-001: Add Regression Test for anyOf Macro Validation

**Type**: Testing (Integration)
**Priority**: High
**Estimated Effort**: Small (~2 hours)

**Purpose**: Prevent regression to oneOf schema pattern by testing macro reference validation

**Files**:

- NEW: `tests/integration/validation/macroReferenceValidation.test.js`

**Key Tests**:

- Valid macro references generate 0 errors
- Invalid macro references generate <10 errors (not 322)
- Mixed action arrays validate correctly

**Success Criteria**: All 3 integration tests pass

---

### JSOSCHVALROB-002: Add Property-Based Validation Tests

**Type**: Testing (Unit)
**Priority**: Medium
**Estimated Effort**: Medium (~4 hours)

**Purpose**: Ensure validation consistency across all possible action structures using property-based testing

**Files**:

- NEW: `tests/unit/schemas/actionArrayProperties.test.js`
- MODIFIED: `package.json` (add fast-check dependency)

**Key Tests**:

- 100 random valid macro references validate
- 100 random valid operations validate
- 100 random hybrid actions fail correctly
- 100 random empty actions fail correctly

**Success Criteria**: All property tests pass with 100 runs each

---

### JSOSCHVALROB-003: Add Performance Benchmarks for anyOf Validation

**Type**: Testing (Performance)
**Priority**: Medium
**Estimated Effort**: Medium (~4 hours)

**Purpose**: Establish performance baselines and verify no regression from oneOf → anyOf

**Files**:

- NEW: `tests/performance/validation/anyOfPerformance.test.js`

**Key Benchmarks**:

- 1000 macro validations in <100ms
- Single validation with 150 operation types in <5ms
- 5-level nested macro expansion in <10ms

**Success Criteria**: All performance benchmarks pass

**Baseline**: oneOf was ~150ms, anyOf should be ~87ms (42% improvement)

---

### JSOSCHVALROB-004: Create Operation Type Validation Script

**Type**: Tooling
**Priority**: High
**Estimated Effort**: Small (~3 hours)

**Purpose**: Create npm script to ensure KNOWN_OPERATION_TYPES stays synchronized with handlers

**Files**:

- NEW: `scripts/validateOperationTypes.js`
- MODIFIED: `package.json` (add npm script)

**Script Checks**:

- All registered handlers are whitelisted
- All whitelist entries have handlers
- Whitelist is alphabetically sorted

**Success Criteria**: Script exits 0 on success, 1 on failure with clear error messages

**Usage**: `npm run validate:operation-types`

---

### JSOSCHVALROB-005: Enhance Error Formatter with Pattern Detection

**Type**: Feature Enhancement
**Priority**: Medium
**Estimated Effort**: Medium (~5 hours)

**Purpose**: Improve error message quality by detecting common patterns before detailed formatting

**Files**:

- MODIFIED: `src/utils/ajvAnyOfErrorFormatter.js` (~100 lines added)
- NEW: `tests/unit/utils/ajvAnyOfErrorFormatter.patternDetection.test.js`

**Pattern Detection**:

1. entity_id vs entity_ref typo
2. Missing type/macro field
3. Invalid enum values

**Success Criteria**: All patterns detected with specialized error messages, backward compatibility maintained

---

### JSOSCHVALROB-006: Add KNOWN_OPERATION_TYPES Completeness Tests

**Type**: Testing (Unit)
**Priority**: High
**Estimated Effort**: Small (~2 hours)

**Purpose**: Unit tests to ensure whitelist stays synchronized with operation registry

**Files**:

- MODIFIED: `tests/unit/utils/preValidationUtils.test.js` (~80 lines added)

**Key Tests**:

- All registered handlers are whitelisted
- All whitelist entries have handlers
- Whitelist maintains alphabetical order

**Success Criteria**: All 3 completeness tests pass

**Integration**: Complements validation script from JSOSCHVALROB-004

---

## Implementation Order

### Recommended Sequence

**Phase 1: Critical Tests** (Do First)

1. **JSOSCHVALROB-001** - Regression test for anyOf (prevents backsliding)
2. **JSOSCHVALROB-006** - Whitelist completeness tests (catches current state)

**Phase 2: Infrastructure** (Do Second) 3. **JSOSCHVALROB-004** - Validation script (enables continuous verification)

**Phase 3: Comprehensive Testing** (Do Third) 4. **JSOSCHVALROB-002** - Property-based tests (comprehensive coverage) 5. **JSOSCHVALROB-003** - Performance benchmarks (ensure no degradation)

**Phase 4: Improvements** (Do Last) 6. **JSOSCHVALROB-005** - Enhanced error formatter (better UX)

### Alternative: Parallel Track

**Track A (Testing)**: JSOSCHVALROB-001 → JSOSCHVALROB-002 → JSOSCHVALROB-003 → JSOSCHVALROB-006
**Track B (Tooling/Features)**: JSOSCHVALROB-004 → JSOSCHVALROB-005

Both tracks are independent and can be worked on in parallel.

---

## Total Effort Estimate

| Ticket           | Effort  | Priority      |
| ---------------- | ------- | ------------- |
| JSOSCHVALROB-001 | 2h      | High          |
| JSOSCHVALROB-002 | 4h      | Medium        |
| JSOSCHVALROB-003 | 4h      | Medium        |
| JSOSCHVALROB-004 | 3h      | High          |
| JSOSCHVALROB-005 | 5h      | Medium        |
| JSOSCHVALROB-006 | 2h      | High          |
| **TOTAL**        | **20h** | **~2.5 days** |

---

## Expected Changes Summary

### New Files (7)

1. `tests/integration/validation/macroReferenceValidation.test.js` (~100 lines)
2. `tests/unit/schemas/actionArrayProperties.test.js` (~250 lines)
3. `tests/performance/validation/anyOfPerformance.test.js` (~350 lines)
4. `scripts/validateOperationTypes.js` (~120 lines)
5. `tests/unit/utils/ajvAnyOfErrorFormatter.patternDetection.test.js` (~200 lines)

### Modified Files (3)

6. `package.json` (+2 lines: fast-check dependency, npm script)
7. `src/utils/ajvAnyOfErrorFormatter.js` (+~100 lines: pattern detection)
8. `tests/unit/utils/preValidationUtils.test.js` (+~80 lines: completeness tests)

### Total Lines Changed: ~1,200 lines

---

## Validation Commands

### After Each Ticket

```bash
# Run specific tests
NODE_ENV=test npx jest [test-file] --no-coverage --verbose

# Run all tests
NODE_ENV=test npm run test:unit
NODE_ENV=test npm run test:integration
NODE_ENV=test npm run test:performance

# Lint modified files
npx eslint [modified-files]

# Verify only intended changes
git status
git diff
```

### After All Tickets Complete

```bash
# Run complete test suite
npm run test:ci

# Run new validation script
npm run validate:operation-types

# Verify all new tests pass
NODE_ENV=test npx jest --testPathPattern="JSOSCHVALROB" --no-coverage
```

---

## Success Criteria (All Tickets)

### Tests

- [ ] 3 regression tests pass (JSOSCHVALROB-001)
- [ ] 4 property-based tests pass with 100 runs each (JSOSCHVALROB-002)
- [ ] 3 performance benchmarks pass (JSOSCHVALROB-003)
- [ ] 3 whitelist completeness tests pass (JSOSCHVALROB-006)
- [ ] Pattern detection tests pass (JSOSCHVALROB-005)

### Tooling

- [ ] Validation script runs successfully (JSOSCHVALROB-004)
- [ ] npm script `validate:operation-types` works
- [ ] Script detects all 3 issue types (missing, orphaned, unsorted)

### Quality

- [ ] All existing tests still pass (backward compatibility)
- [ ] No unintended file changes
- [ ] Code follows project conventions
- [ ] Test coverage maintained or improved

### Documentation

- [ ] All tickets have clear acceptance criteria
- [ ] All tickets include verification commands
- [ ] All tickets document expected diff sizes
- [ ] Implementation plan (this file) is accurate

---

## Invariants to Maintain

Throughout implementation, these must remain true:

1. **Schema Structure**: `operation.schema.json` uses anyOf (not oneOf)
2. **Function Signatures**: No breaking API changes to validation functions
3. **Backward Compatibility**: All existing tests continue to pass
4. **Error Quality**: Error messages remain helpful and actionable
5. **Performance**: No performance degradation vs. current baseline

---

## Risk Mitigation

### Risk 1: Breaking Existing Tests

**Mitigation**: Run full test suite after each ticket
**Detection**: CI failure, test command failures
**Recovery**: Revert changes, investigate breaking change

### Risk 2: Performance Regression

**Mitigation**: Benchmark tests in JSOSCHVALROB-003
**Detection**: Performance tests fail
**Recovery**: Profile and optimize, or adjust benchmarks if justified

### Risk 3: Incomplete Synchronization

**Mitigation**: Validation script (JSOSCHVALROB-004) and tests (JSOSCHVALROB-006)
**Detection**: Script fails, tests fail
**Recovery**: Update whitelist or register missing handlers

### Risk 4: Pattern Detection False Positives

**Mitigation**: Comprehensive tests in JSOSCHVALROB-005
**Detection**: Existing integration tests fail
**Recovery**: Adjust pattern detection logic, add edge case handling

---

## Post-Implementation

### Next Steps After Completion

1. **CI Integration**: Add `npm run validate:operation-types` to CI pipeline
2. **Documentation Update**: Update CLAUDE.md with new validation patterns
3. **Team Training**: Ensure team knows about validation script and patterns
4. **Monitoring**: Track validation error rates in production/testing

### Future Enhancements (Out of Scope)

- Automated whitelist updates (auto-sync from registration)
- Schema version migration tooling
- Performance optimization for large schemas (>200 operation types)
- Additional error patterns (beyond 3 implemented)

---

## Related Documentation

- **Specification**: `specs/json-schema-validation-robustness.md`
- **CLAUDE.md**: Operation registration checklist (lines 421-504)
- **Schema**: `data/schemas/operation.schema.json`
- **Validation**: `src/validation/ajvSchemaValidator.js`
- **Pre-validation**: `src/utils/preValidationUtils.js`
- **Error Formatting**: `src/utils/ajvAnyOfErrorFormatter.js`

---

**Document Status**: Active
**Created**: 2025-01-22
**Last Updated**: 2025-01-22
**Related Spec**: `specs/json-schema-validation-robustness.md`
