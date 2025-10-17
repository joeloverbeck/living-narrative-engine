# HANHOLMIG-007: Validation and Testing

**Status**: Ready for Implementation
**Priority**: CRITICAL
**Estimated Time**: 1-1.5 hours
**Risk Level**: Low (read-only validation and testing)

## Overview

This ticket performs comprehensive validation and testing of the migrated hand_holding mod before final game integration. It runs all validation scripts, executes the complete test suite, verifies no broken references remain, and confirms coverage requirements are met. This is the quality gate before deployment.

## Prerequisites

- [x] **HANHOLMIG-001 complete**: Scope migration finished
- [x] **HANHOLMIG-002 complete**: Mod structure created
- [x] **HANHOLMIG-003 complete**: Files copied
- [x] **HANHOLMIG-004 complete**: Namespace remapping done
- [x] **HANHOLMIG-005 complete**: Affection cleanup done
- [x] **HANHOLMIG-006 complete**: Test migration done
- [ ] All previous commits made and clean
- [ ] Feature branch: `feature/hand-holding-mod-migration` active

## Validation Categories

This ticket covers **5 validation categories**:
1. Mod Structure & Schema Validation
2. Visual Properties & WCAG Compliance
3. Cross-Reference & Broken Link Detection
4. Dependency & Load Order Validation
5. Test Suite Execution & Coverage

## Detailed Steps

### Phase 1: Mod Structure & Schema Validation

#### Step 1.1: Validate Mod Manifest

**Command**:
```bash
node scripts/validateMods.js --mod hand_holding --type manifest
```

**Expected result**: Manifest passes schema validation without errors.

**What this validates**:
- Manifest follows `data/schemas/mod-manifest.schema.json`
- Mod ID matches pattern `^[a-zA-Z0-9_]+$`
- Version follows semantic versioning
- Dependencies are properly structured
- Content arrays reference valid files

#### Step 1.2: Validate Action Files

**Command**:
```bash
node scripts/validateMods.js --mod hand_holding --type actions
```

**Expected result**: All 3 action files pass schema validation.

**What this validates**:
- Actions follow `data/schemas/action.schema.json`
- Action IDs match pattern `modId:actionId`
- Visual properties are properly structured
- Targets, forbidden_components, required_conditions are valid
- JSON syntax is correct

#### Step 1.3: Validate Component Files

**Command**:
```bash
node scripts/validateMods.js --mod hand_holding --type components
```

**Expected result**: All 2 component files pass schema validation.

**What this validates**:
- Components follow `data/schemas/component.schema.json`
- Component IDs match pattern `modId:componentId`
- Data schemas are valid JSON Schema
- Required/optional fields properly defined

#### Step 1.4: Validate Condition Files

**Command**:
```bash
node scripts/validateMods.js --mod hand_holding --type conditions
```

**Expected result**: All 4 condition files pass schema validation.

**What this validates**:
- Conditions follow `data/schemas/condition.schema.json`
- Condition IDs properly namespaced
- Logic structures are valid JSON Logic
- Component and action references use correct format

#### Step 1.5: Validate Rule Files

**Command**:
```bash
node scripts/validateMods.js --mod hand_holding --type rules
```

**Expected result**: All 3 rule files pass schema validation.

**What this validates**:
- Rules follow `data/schemas/rule.schema.json`
- Rule IDs and priorities properly defined
- Condition references are valid
- Operation schemas match registered operations

#### Step 1.6: Validate Entire Mod (Comprehensive)

**Command**:
```bash
node scripts/validateMods.js --mod hand_holding
```

**Expected result**: All validation passes without errors.

**Summary check**:
- All content types validated
- No schema violations
- All referenced files exist
- JSON syntax correct across all files

### Phase 2: Visual Properties & WCAG Compliance

#### Step 2.1: Validate Color Contrast

**Command**:
```bash
node scripts/validateVisualContrast.js
```

**Expected results for hand_holding actions**:
- ✅ hold_hand.action.json: WCAG AAA (15.01:1 normal, 11.45:1 hover)
- ✅ squeeze_hand_reassuringly.action.json: WCAG AAA (15.01:1 normal, 11.45:1 hover)
- ✅ warm_hands_between_yours.action.json: WCAG AAA (15.01:1 normal, 11.45:1 hover)

**Minimum requirement**: WCAG 2.1 AA (4.5:1 contrast ratio)

**What this validates**:
- Background/text color combinations meet accessibility standards
- Hover states maintain adequate contrast
- Velvet Twilight color scheme properly applied

#### Step 2.2: Verify Consistent Color Scheme

**Manual check**:
```bash
# Verify all actions use same colors
grep -A4 "visualProperties" data/mods/hand_holding/actions/*.json
```

**Expected output** (all should match):
```json
"visualProperties": {
  "backgroundColor": "#2c0e37",
  "textColor": "#ffebf0",
  "hoverBackgroundColor": "#451952",
  "hoverTextColor": "#f3e5f5"
}
```

### Phase 3: Cross-Reference & Broken Link Detection

#### Step 3.1: Verify No Broken Affection References

**Check hand_holding mod has no affection references**:
```bash
grep -r "affection:" data/mods/hand_holding/
```

**Expected result**: NO RESULTS

**What this checks**:
- No leftover affection namespace references in any file
- All IDs properly updated to hand_holding namespace

#### Step 3.2: Verify No Broken Positioning References

**Check hand_holding actions reference positioning scope correctly**:
```bash
grep -r "positioning:close_actors_facing_each_other_or_behind_target" data/mods/hand_holding/actions/
```

**Expected result**: 3 matches (one per action file)

**Verify scope exists**:
```bash
ls data/mods/positioning/scopes/close_actors_facing_each_other_or_behind_target.scope
```

**Expected result**: File exists

#### Step 3.3: Search for Any Stale References

**Comprehensive search for old IDs**:
```bash
# Search entire codebase for old action IDs (should only find affection mod or tests)
grep -r "affection:hold_hand" data/ tests/ | grep -v "data/mods/affection/" | grep -v "tests/integration/mods/affection/"

# Expected: Only references in affection mod (if still there) or old test files
# No references should exist in hand_holding mod
```

### Phase 4: Dependency & Load Order Validation

#### Step 4.1: Validate Dependency Graph

**Check for circular dependencies**:
```bash
npm run depcruise:validate
```

**Expected result**: No circular dependencies detected

**What this validates**:
- hand_holding depends on core and positioning (not affection)
- No circular coupling between affection and hand_holding
- Dependency graph is acyclic

#### Step 4.2: Validate Mod Load Order (Pre-Integration)

**Note**: This validates the load order logic is sound. Actual game.json update happens in HANHOLMIG-008.

**Manual check of dependencies**:
```bash
cat data/mods/hand_holding/mod-manifest.json | jq '.dependencies'
```

**Expected output**:
```json
[
  {
    "id": "core",
    "version": "^1.0.0"
  },
  {
    "id": "positioning",
    "version": "^1.0.0"
  }
]
```

**Verify dependencies exist**:
```bash
test -d data/mods/core && echo "✓ core exists"
test -d data/mods/positioning && echo "✓ positioning exists"
```

### Phase 5: Test Suite Execution & Coverage

#### Step 5.1: Run Unit Tests

**Command**:
```bash
npm run test:unit
```

**Expected result**: All unit tests pass, no failures

**What this tests**:
- Core engine functionality still works
- No regressions introduced by migration
- Utility functions and services intact

#### Step 5.2: Run Hand Holding Integration Tests

**Command**:
```bash
npm run test:integration -- tests/integration/mods/hand_holding/
```

**Expected result**: May not pass yet (hand_holding not in game.json), but should load without reference errors

**What to check**:
- Tests load without import errors
- No missing mod references
- Test structure intact
- Errors are only about game.json, not about broken references

#### Step 5.3: Run Affection Integration Tests

**Command**:
```bash
npm run test:integration -- tests/integration/mods/affection/
```

**Expected result**: All affection tests pass (hand-holding tests removed)

**What this validates**:
- Removing hand-holding content from affection didn't break remaining tests
- Affection mod still functions correctly
- No cascading failures from migration

#### Step 5.4: Run Full Integration Test Suite

**Command**:
```bash
npm run test:integration
```

**Expected result**: All tests pass except possibly hand_holding tests (not in game.json yet)

**Critical check**: No test failures in OTHER mods caused by hand_holding migration

#### Step 5.5: Run Full Test Suite (CI Mode)

**Command**:
```bash
npm run test:ci
```

**Expected result**:
- All tests pass or only hand_holding tests fail (expected until game.json update)
- No test failures in affection or other mods
- No new failures introduced

#### Step 5.6: Verify Test Coverage Requirements

**Check coverage report**:
```bash
npm run test:integration -- --coverage
```

**Required coverage**:
- Branch coverage: ≥80%
- Function coverage: ≥90%
- Line coverage: ≥90%

**What this validates**:
- Test suite remains comprehensive
- Coverage requirements maintained after migration
- No significant coverage drops

### Phase 6: Integration Smoke Tests

#### Step 6.1: Lint Check

**Command**:
```bash
npx eslint data/mods/hand_holding/**/*.json
```

**Expected result**: No linting errors (JSON files)

**What this validates**:
- JSON syntax is correct
- Formatting is consistent
- No trailing commas or syntax errors

#### Step 6.2: Type Check (if applicable)

**Command**:
```bash
npm run typecheck
```

**Expected result**: No type errors

**What this validates**:
- TypeScript definitions intact
- No type mismatches introduced

## Validation Summary Report

After running all validations, create a summary:

### Expected Results Summary

```
✅ Mod Structure Validation
  ✓ Manifest schema valid
  ✓ 3 actions schema valid
  ✓ 2 components schema valid
  ✓ 4 conditions schema valid
  ✓ 3 rules schema valid

✅ Visual Properties Validation
  ✓ All actions meet WCAG AAA standards
  ✓ Velvet Twilight color scheme consistent
  ✓ Contrast ratios: 15.01:1 (normal), 11.45:1 (hover)

✅ Cross-Reference Validation
  ✓ No affection: references in hand_holding mod
  ✓ positioning: scope references valid
  ✓ No broken dependencies detected

✅ Dependency Validation
  ✓ No circular dependencies
  ✓ Dependencies on core and positioning valid
  ✓ No affection dependency (correct)

✅ Test Suite Validation
  ✓ Unit tests pass
  ✓ Affection integration tests pass
  ✓ Full integration suite passes (except hand_holding - expected)
  ✓ Test coverage requirements met (≥80% branch, ≥90% function/line)

⚠️ Expected Issues (Will resolve in HANHOLMIG-008):
  - hand_holding integration tests may not pass (mod not in game.json yet)
  - This is expected and correct at this stage
```

## Validation Criteria

### Complete Validation Checklist

- [ ] Mod manifest schema validation passes
- [ ] All action files schema validation passes
- [ ] All component files schema validation passes
- [ ] All condition files schema validation passes
- [ ] All rule files schema validation passes
- [ ] Visual contrast validation passes (WCAG AAA)
- [ ] No affection: references in hand_holding mod
- [ ] Scope references to positioning mod valid
- [ ] No circular dependencies detected
- [ ] Dependencies correct (core, positioning only)
- [ ] Unit tests pass
- [ ] Affection integration tests pass
- [ ] Test coverage requirements met (≥80%/≥90%)
- [ ] Linting passes
- [ ] Type checking passes (if applicable)

### Validation Commands Quick Reference

```bash
# Complete validation suite (run in sequence)

# 1. Mod validation
node scripts/validateMods.js --mod hand_holding

# 2. Visual validation
node scripts/validateVisualContrast.js

# 3. Reference validation
grep -r "affection:" data/mods/hand_holding/ # Should return NO RESULTS
grep -r "positioning:close_actors" data/mods/hand_holding/actions/ # Should return 3 matches

# 4. Dependency validation
npm run depcruise:validate

# 5. Test suite
npm run test:unit
npm run test:integration -- tests/integration/mods/affection/
npm run test:ci

# 6. Lint & type check
npx eslint data/mods/hand_holding/**/*.json
npm run typecheck
```

## Files Affected

**No files modified in this ticket** - This is a validation-only phase.

**Files validated**:
- All 12 hand_holding mod content files
- All 7 hand_holding test files
- Affection mod content files (for regression testing)
- Project-wide test suite

## Testing

This entire ticket IS testing. All steps are validation and test execution.

## Success Criteria

Validation is successful when:
- ✅ All mod schema validations pass without errors
- ✅ All action files achieve WCAG AAA contrast standards
- ✅ No broken references to affection namespace in hand_holding mod
- ✅ Scope references to positioning mod are valid
- ✅ No circular dependencies in dependency graph
- ✅ Unit tests pass without failures
- ✅ Affection integration tests pass (proving no regression)
- ✅ Test coverage meets requirements (80%/90%)
- ✅ Linting and type checking pass

**Expected issue**: hand_holding integration tests may not pass until mod is added to game.json (HANHOLMIG-008). This is expected and acceptable at this stage.

## Rollback Plan

**Not applicable** - This ticket performs read-only validation with no file modifications. If validation fails, previous tickets need correction, not rollback of this ticket.

## Commit Strategy

**No commit for this ticket** - This is a validation checkpoint. If all validations pass, proceed to HANHOLMIG-008. If validations fail, fix issues in previous tickets before proceeding.

**Document validation results**:
```bash
# Optional: Save validation results for reference
npm run test:ci > validation-results.log 2>&1
node scripts/validateMods.js --mod hand_holding > mod-validation.log 2>&1
node scripts/validateVisualContrast.js > visual-validation.log 2>&1
```

## Next Steps

### If All Validations Pass ✅

Proceed to **HANHOLMIG-008** (Game Integration and Documentation)

### If Validations Fail ❌

1. **Identify failing validation category** (structure, visual, references, dependencies, tests)
2. **Determine which ticket introduced the issue** (HANHOLMIG-001 through HANHOLMIG-006)
3. **Fix the issue in the appropriate ticket context**
4. **Re-run validation from this ticket**
5. **Only proceed to HANHOLMIG-008 when all validations pass**

---

**Critical**: Do not proceed to HANHOLMIG-008 until all validations in this ticket pass (except hand_holding integration tests, which are expected to fail until game.json update).
