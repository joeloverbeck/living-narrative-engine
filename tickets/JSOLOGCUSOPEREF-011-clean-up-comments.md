# JSOLOGCUSOPEREF-011: Clean Up Verbose Comments

**Priority**: 🔵 Low
**Estimated Effort**: 1 hour
**Phase**: 4 - Polish

---

## Summary

The `registerOperators()` method contains verbose inline comments for every operator registration that add noise without providing significant value. These should be replaced with a single JSDoc block referencing the operator classes.

---

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/logic/jsonLogicCustomOperators.js` | Modify - remove inline comments, add JSDoc |

---

## Out of Scope

**DO NOT modify:**
- Individual operator files
- Test files
- Any other source files
- Operator registration logic (only comments)

---

## Implementation Details

### Current Problem

```javascript
// Register hasPartWithComponentValue operator
// This operator checks if an entity has a body part with a specific component value
// Usage: {"hasPartWithComponentValue": ["actor", "descriptors:build", "build", "muscular"]}
const hasPartWithComponentValueOp = new HasPartWithComponentValueOperator({...});
this.#registerOperator('hasPartWithComponentValue', ...);

// Register hasPartOfType operator
// This operator checks if an entity has a body part of a specific type
// Usage: {"hasPartOfType": ["actor", "hand"]}
const hasPartOfTypeOp = new HasPartOfTypeOperator({...});
this.#registerOperator('hasPartOfType', ...);

// ... repeated 26 times
```

### Solution: Single JSDoc Block

```javascript
/**
 * Registers all custom JSON Logic operators with the evaluation service.
 *
 * Operators are grouped by category:
 * - Body Part Operators: hasPartWithComponentValue, hasPartOfType, etc.
 * - Equipment Operators: isSlotExposed, isSocketCovered, etc.
 * - Furniture Operators: hasSittingSpaceToRight, canScootCloser, etc.
 * - Standalone Operators: has_component, hasFreeGrabbingAppendages, etc.
 *
 * For usage documentation, see individual operator classes:
 * @see HasPartWithComponentValueOperator
 * @see HasPartOfTypeOperator
 * @see IsSlotExposedOperator
 * ... (list key operators)
 *
 * @param {JsonLogicEvaluationService} jsonLogicEvaluationService - The service to register operators with
 */
registerOperators(jsonLogicEvaluationService) {
  // Body Part Operators
  const hasPartWithComponentValueOp = new HasPartWithComponentValueOperator({...});
  this.#registerOperator('hasPartWithComponentValue', ...);

  const hasPartOfTypeOp = new HasPartOfTypeOperator({...});
  this.#registerOperator('hasPartOfType', ...);

  // Equipment Operators
  // ... etc
}
```

### Guidelines

1. **Keep category comments**: Simple one-line section headers are helpful
2. **Remove usage comments**: Usage belongs in the operator class, not here
3. **Remove description comments**: Redundant with class documentation
4. **Add JSDoc @see references**: Link to operator classes for details

---

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:unit -- tests/unit/logic/jsonLogicCustomOperators.test.js
npm run test:integration -- tests/integration/logic/
```

### Specific Test Assertions

1. **All tests pass**: No behavior changes
2. **JSDoc valid**: Documentation generates correctly

### Invariants That Must Remain True

1. **No code changes**: Only comments modified
2. **Method functionality unchanged**: All 26 operators still registered correctly
3. **ESLint passes**: No linting errors from comment changes

---

## Verification Commands

```bash
# Lint file
npx eslint src/logic/jsonLogicCustomOperators.js

# Verify line count reduced
wc -l src/logic/jsonLogicCustomOperators.js

# Run tests
npm run test:unit -- tests/unit/logic/jsonLogicCustomOperators.test.js
```

---

## Notes

- This is cosmetic cleanup - prioritize after functional improvements
- Keep helpful section comments (e.g., "// Body Part Operators")
- The JSDoc @see tags help developers find documentation
- Coordinate with JSOLOGCUSOPEREF-004 if the factory pattern changes the registration pattern
