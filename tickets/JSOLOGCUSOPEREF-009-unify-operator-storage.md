# JSOLOGCUSOPEREF-009: Unify Operator Storage Pattern

**Priority**: 🟢 Medium
**Estimated Effort**: 2 hours
**Phase**: 3 - Medium-Priority Improvements
**Depends On**: JSOLOGCUSOPEREF-002 (cache management)

---

## Summary

Some operators are stored as instance properties (for cache clearing) while others are local variables (lost after registration). This inconsistency makes cache management incomplete and increases memory overhead. All operators should be stored in a unified registry Map.

---

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/logic/jsonLogicCustomOperators.js` | Modify - store all operators in Map registry |

---

## Out of Scope

**DO NOT modify:**
- Individual operator files
- DI registration files
- Test files (unless adding new tests)
- Any other source files

---

## Implementation Details

### Current Problem

```javascript
// Some stored as properties (accessible)
this.isSocketCoveredOp = new IsSocketCoveredOperator({...});
this.socketExposureOp = new SocketExposureOperator({...});

// Others as local variables (inaccessible after registration)
const hasPartWithComponentValueOp = new HasPartWithComponentValueOperator({...});
const hasWoundedPartOp = new HasWoundedPartOperator({...});
```

### Solution: Unified Registry Map

```javascript
class JsonLogicCustomOperators extends BaseService {
  #operators = new Map();

  registerOperators(jsonLogicEvaluationService) {
    // Create and store all operators
    this.#operators.set('isSocketCovered', new IsSocketCoveredOperator({...}));
    this.#operators.set('socketExposure', new SocketExposureOperator({...}));
    this.#operators.set('hasPartWithComponentValue', new HasPartWithComponentValueOperator({...}));
    // ... all 26 operators

    // Register all operators
    for (const [name, operator] of this.#operators) {
      this.#registerOperator(name, operator, jsonLogicEvaluationService);
    }

    // Whitelist validation and logging
    this.#validateWhitelist();
    this.#logger.info(`Registered ${this.#operators.size} custom operators`);
  }

  clearCaches() {
    this.#logger.debug('Clearing custom operator caches');
    for (const [name, operator] of this.#operators) {
      if (typeof operator.clearCache === 'function') {
        operator.clearCache();
      }
    }
  }

  // For debugging/testing
  getOperator(name) {
    return this.#operators.get(name);
  }
}
```

### Remove Individual Properties

Remove these instance properties:
- `this.isSocketCoveredOp`
- `this.socketExposureOp`
- Any other operator-specific properties

Replace references with `this.#operators.get('operatorName')`.

---

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:unit -- tests/unit/logic/jsonLogicCustomOperators.test.js
npm run test:integration -- tests/integration/logic/
```

### Specific Test Assertions

1. **All operators registered**: `getRegisteredOperators().size === 26`
2. **Cache clearing works**: All operators with caches are cleared
3. **Operator access works**: `getOperator('isSocketCovered')` returns the operator instance

### Invariants That Must Remain True

1. **Operator count unchanged**: Still exactly 26 operators
2. **Operator behavior unchanged**: All operators function identically
3. **Cache clearing complete**: All cacheable operators are cleared on `clearCaches()`
4. **Memory efficiency**: Each operator instantiated only once

---

## Verification Commands

```bash
# Run cache clearing tests
npm run test:unit -- tests/unit/logic/jsonLogicCustomOperators.test.js --testNamePattern="cache" --verbose

# Run full operator tests
npm run test:unit -- tests/unit/logic/jsonLogicCustomOperators.test.js --verbose

# Lint
npx eslint src/logic/jsonLogicCustomOperators.js

# Full regression
npm run test:ci
```

---

## Notes

- This builds on JSOLOGCUSOPEREF-002 (cache management) - coordinate the implementations
- The `getOperator()` method is optional but useful for testing
- Consider making the Map immutable after registration (using `Object.freeze` on values)
- If JSOLOGCUSOPEREF-004 (operator factory) is done first, integrate with that pattern
