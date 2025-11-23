# JSOSCHVALROB-002: Add Property-Based Validation Tests

## Status: ✅ COMPLETED

## Objective
Ensure validation consistency across all possible action structures using property-based testing to detect edge cases and validate system invariants.

## Ticket Scope

### What This Ticket WILL Do
- Create new test file `tests/unit/utils/preValidationProperties.test.js` (**CORRECTED PATH**)
- ~~Add `fast-check` library for property-based testing~~ **ALREADY INSTALLED (v4.3.0)**
- Implement 4 property tests verifying action validation invariants
- Test 100+ random inputs per property to ensure consistency
- Verify validation is deterministic and error-bounded

### What This Ticket WILL NOT Do
- Modify validation logic in `ajvSchemaValidator.js` or `preValidationUtils.js`
- Change error formatting in `ajvAnyOfErrorFormatter.js`
- Update schema files (`operation.schema.json`)
- Add integration tests (covered by JSOSCHVALROB-001)
- Add performance tests (covered by JSOSCHVALROB-003)
- Modify existing unit tests

## Assumptions Reassessed

### ✅ Correct Assumptions
- `fast-check` library is available for property-based testing (**v4.3.0 already in devDependencies**)
- `KNOWN_OPERATION_TYPES` array exists in `src/utils/preValidationUtils.js`
- `validateOperationStructure(operation, path)` function exists and validates operations
- Macro references use `{macro: "namespace:id", comment?: string}` structure
- Operations use `{type: "OPERATION_TYPE", parameters: {...}}` structure
- Hybrid actions `{type: "...", macro: "..."}` should be rejected
- Empty actions `{}` should be rejected

### ❌ Corrected Assumptions
1. **Test file location**: Should be `tests/unit/utils/preValidationProperties.test.js` (not `schemas/actionArrayProperties.test.js`)
   - **Rationale**: Testing `preValidationUtils.js` functions, should mirror src structure
   
2. **No separate `validateMacroReference` function**: Macro validation is handled within `validateOperationStructure`
   - **Impact**: Property tests will use `validateOperationStructure` for all operation types
   
3. **No separate `validateActions` function**: Use `validateAllOperations(actions, 'root')` instead
   - **Impact**: Error count invariant test will use correct API
   
4. **Package.json change not needed**: `fast-check` already installed
   - **Impact**: Remove from "Files to Touch" section

## Files to Touch

### New Files (1)
- `tests/unit/utils/preValidationProperties.test.js` - NEW property-based test suite (**CORRECTED PATH**)

### Modified Files (0)
- ~~`package.json`~~ - **NO CHANGE NEEDED** (fast-check already installed)

### Files to Read (for context)
- `src/utils/preValidationUtils.js` - For validation functions and KNOWN_OPERATION_TYPES
- `src/validation/ajvSchemaValidator.js` - For full validation functions (if needed)
- `data/schemas/operation.schema.json` - For schema structure
- `data/schemas/common.schema.json` - For namespacedId pattern

## Out of Scope

### Must NOT Change
- ❌ `src/validation/ajvSchemaValidator.js` - Validation logic unchanged
- ❌ `src/utils/preValidationUtils.js` - Pre-validation logic unchanged
- ❌ `src/utils/ajvAnyOfErrorFormatter.js` - Error formatting unchanged
- ❌ `data/schemas/*.json` - Schema files unchanged
- ❌ Any existing test files - Only create new test file
- ❌ `package.json` - fast-check already installed

### Must NOT Add
- ❌ New validation rules or error handling
- ❌ Schema modifications
- ❌ Changes to operation registration
- ❌ Integration or E2E tests (unit tests only)

## Acceptance Criteria

### Tests Must Pass

#### Property 1: Valid Macro References Always Validate
```javascript
import fc from 'fast-check';

it('should validate all well-formed macro references', () => {
  fc.assert(
    fc.property(
      fc.record({
        macro: fc.string({ minLength: 3 }).map(s => `namespace:${s}`),
        comment: fc.option(fc.string())
      }),
      (macroRef) => {
        const result = validateOperationStructure(macroRef, 'test');
        expect(result.isValid).toBe(true);
      }
    ),
    { numRuns: 100 }
  );
});
```

**Pass Condition**: All 100 random macro references validate successfully

#### Property 2: Valid Operations Always Validate
```javascript
it('should validate all well-formed operations', () => {
  fc.assert(
    fc.property(
      fc.constantFrom(...KNOWN_OPERATION_TYPES),
      fc.object(),
      (type, parameters) => {
        const operation = { type, parameters };
        const result = validateOperationStructure(operation, 'test');
        expect(result.isValid).toBe(true);
      }
    ),
    { numRuns: 100 }
  );
});
```

**Pass Condition**: All 100 random operations pass pre-validation

#### Property 3: Hybrid Actions Always Fail
```javascript
it('should reject all actions with both type and macro fields', () => {
  fc.assert(
    fc.property(
      fc.constantFrom(...KNOWN_OPERATION_TYPES),
      fc.string().map(s => `namespace:${s}`),
      (type, macro) => {
        const invalidAction = { type, macro, parameters: {} };
        const result = validateOperationStructure(invalidAction, 'test');
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('should not have a type field');
      }
    ),
    { numRuns: 100 }
  );
});
```

**Pass Condition**: All 100 hybrid actions fail with correct error message

#### Property 4: Empty Actions Always Fail
```javascript
it('should reject all actions without type or macro fields', () => {
  fc.assert(
    fc.property(
      fc.object({ excludedKeys: ['type', 'macro'] }),
      (invalidAction) => {
        const result = validateOperationStructure(invalidAction, 'test');
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('Missing required "type" field');
      }
    ),
    { numRuns: 100 }
  );
});
```

**Pass Condition**: All 100 empty actions fail with correct error message

### Invariants That Must Remain True

#### Invariant 1: Validation is Deterministic
```javascript
it('should produce identical results for identical inputs', () => {
  fc.assert(
    fc.property(
      fc.record({
        type: fc.constantFrom(...KNOWN_OPERATION_TYPES),
        parameters: fc.object()
      }),
      (operation) => {
        const result1 = validateOperationStructure(operation, 'test');
        const result2 = validateOperationStructure(operation, 'test');
        expect(result1).toEqual(result2);
      }
    ),
    { numRuns: 100 }
  );
});
```

**Must Pass**: Same input always produces same output

#### Invariant 2: Error Count is Bounded
```javascript
it('should never generate excessive errors (>20 per action)', () => {
  fc.assert(
    fc.property(
      fc.array(fc.oneof(
        fc.record({ type: fc.string(), parameters: fc.object() }),
        fc.record({ macro: fc.string() })
      )),
      (actions) => {
        const result = validateAllOperations(actions, 'test');
        // For invalid actions, ensure we get a single clear error, not cascading errors
        if (!result.isValid) {
          // Should fail fast with one clear error
          expect(result.error).toBeTruthy();
          expect(result.error.length).toBeLessThan(500); // Single error message, not 322 errors
        }
      }
    ),
    { numRuns: 100 }
  );
});
```

**Must Pass**: No error cascades - fail fast with single clear error

#### Invariant 3: No Existing Tests Break
```bash
npm run test:unit
```

**Must Return**: All existing unit tests pass (0 failures)

## Implementation Notes

### ~~Package Installation~~ (NOT NEEDED)
```bash
# fast-check already installed in devDependencies v4.3.0
# npm install --save-dev fast-check
```

### fast-check Version
- Already installed: `fast-check@^4.3.0`
- No package.json changes needed

### Import Pattern
```javascript
import fc from 'fast-check';
import { describe, it, expect } from '@jest/globals';
import { 
  validateOperationStructure, 
  validateAllOperations,
  KNOWN_OPERATION_TYPES 
} from '../../../src/utils/preValidationUtils.js';
```

### Test Configuration
```javascript
// Run 100 random test cases per property
fc.assert(fc.property(...), { numRuns: 100 });

// For debugging failures, use verbose mode
fc.assert(fc.property(...), { numRuns: 100, verbose: true });
```

### Arbitraries Reference
- `fc.string()` - Random strings
- `fc.object()` - Random objects
- `fc.constantFrom(...values)` - Pick from array
- `fc.record({...})` - Objects with specific fields
- `fc.option(arb)` - Optional field (undefined or value)
- `fc.array(arb)` - Random arrays
- `fc.oneof(arb1, arb2)` - Union of arbitraries

## Definition of Done

- [x] ~~`fast-check` dependency added to `package.json`~~ **ALREADY INSTALLED**
- [x] New test file created at `tests/unit/utils/preValidationProperties.test.js` (**CORRECTED PATH**)
- [x] All 4 property tests implemented and passing
- [x] All 3 invariant tests implemented and passing
- [x] 100 runs per property complete successfully
- [x] No changes to validation logic files
- [x] `npm run test:unit` passes with 0 failures
- [x] Test file follows project conventions (imports, structure, naming)

## Verification Commands

```bash
# Run new tests only
NODE_ENV=test npx jest tests/unit/utils/preValidationProperties.test.js --no-coverage --verbose

# Run all unit tests
NODE_ENV=test npm run test:unit

# Verify no unintended changes
git diff src/
git diff data/schemas/

# Verify only test file changed
git status
```

## Related Documentation
- Spec: `specs/json-schema-validation-robustness.md` (lines 862-940, 1172-1258)
- fast-check docs: https://github.com/dubzzz/fast-check
- Pre-validation: `src/utils/preValidationUtils.js`
- Validation: `src/validation/ajvSchemaValidator.js`

## Expected diff size
- ~~`package.json`: +1 line (fast-check dependency)~~ **NO CHANGE**
- `tests/unit/utils/preValidationProperties.test.js`: ~250 lines (new file) (**CORRECTED PATH**)
- Total: ~250 lines changed (**CORRECTED**)

## Outcome

### What Was Actually Changed vs Originally Planned

**Originally Planned**:
- Add `fast-check` dependency to `package.json`
- Create test file at `tests/unit/schemas/actionArrayProperties.test.js`
- Implement property-based tests using custom validation functions

**What Was Actually Done**:
1. **No package.json change**: `fast-check` was already installed (v4.3.0)
2. **Corrected test file path**: Created at `tests/unit/utils/preValidationProperties.test.js` to mirror the structure of `src/utils/preValidationUtils.js`
3. **Used existing API**: Tests use `validateOperationStructure` and `validateAllOperations` from `preValidationUtils.js` instead of hypothetical custom functions
4. **All 7 tests implemented and passing**:
   - 4 property tests (macro references, valid operations, hybrid rejection, empty rejection)
   - 3 invariant tests (determinism, bounded errors, no regression)

**Key Corrections**:
- Test file location corrected to follow project structure conventions
- Used actual validation API instead of assumed functions
- Verified `fast-check` was already installed, no dependency changes needed
- All tests pass with 100 runs each, demonstrating strong validation invariants
