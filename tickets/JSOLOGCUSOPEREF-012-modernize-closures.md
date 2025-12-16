# JSOLOGCUSOPEREF-012: Modernize Closure Patterns

**Priority**: 🔵 Low
**Estimated Effort**: 1 hour
**Phase**: 4 - Polish

---

## Summary

The `registerOperators()` method uses a `self` variable to capture `this` in closures passed to `#registerOperator()`. Modern JavaScript arrow functions can capture `this` more cleanly, improving code readability.

---

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/logic/jsonLogicCustomOperators.js` | Modify - replace `self` pattern with arrow functions |

---

## Out of Scope

**DO NOT modify:**
- Individual operator files
- Test files
- The `#registerOperator()` private method signature
- Any other source files

---

## Implementation Details

### Current Pattern

```javascript
const self = this;
this.#registerOperator(
  'isSocketCovered',
  function (entityPath, socketId) {
    return self.isSocketCoveredOp.evaluate([entityPath, socketId], this);
  },
  jsonLogicEvaluationService
);
```

### Analysis Required

**IMPORTANT**: Before converting to arrow functions, verify what `this` refers to in the callback:

1. If `this` in the callback refers to the JSON Logic evaluation context (passed by json-logic-js), arrow functions CANNOT be used because they don't have their own `this`.

2. Search for how `#registerOperator` and the underlying `addOperation` work:
```javascript
#registerOperator(name, fn, service) {
  service.addOperation(name, fn);  // fn.call(context, ...args) inside json-logic-js?
}
```

### If Context Binding is Required (Likely Case)

The `this` in the callback is the evaluation context, NOT the class instance. In this case, keep the function declaration but simplify:

```javascript
// Keep function declaration for context binding, but use class reference directly
this.#registerOperator(
  'isSocketCovered',
  function (entityPath, socketId) {
    return this.isSocketCoveredOp.evaluate([entityPath, socketId], this);
  }.bind({ isSocketCoveredOp: this.isSocketCoveredOp }),  // Bind specific operator
  jsonLogicEvaluationService
);
```

Or pass context as explicit parameter:

```javascript
this.#registerOperator(
  'isSocketCovered',
  (entityPath, socketId, context) => {
    return this.isSocketCoveredOp.evaluate([entityPath, socketId], context);
  },
  jsonLogicEvaluationService
);
```

### If No Context Binding Needed

Simply convert to arrow functions:

```javascript
// Remove: const self = this;

this.#registerOperator(
  'isSocketCovered',
  (entityPath, socketId, context) => {
    return this.isSocketCoveredOp.evaluate([entityPath, socketId], context);
  },
  jsonLogicEvaluationService
);
```

---

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:unit -- tests/unit/logic/jsonLogicCustomOperators.test.js
npm run test:integration -- tests/integration/logic/
```

### Specific Test Assertions

1. **All operator evaluations work**: Context is correctly passed to operators
2. **No regressions**: All 26 operators function identically

### Invariants That Must Remain True

1. **Context binding preserved**: Operators receive correct evaluation context
2. **Class reference preserved**: Operators can access class instance when needed
3. **All tests pass**: No behavior changes

---

## Verification Commands

```bash
# Verify `self` is removed
grep -n "const self" src/logic/jsonLogicCustomOperators.js

# Run tests
npm run test:unit -- tests/unit/logic/jsonLogicCustomOperators.test.js --verbose
npm run test:integration -- tests/integration/logic/ --verbose

# Lint
npx eslint src/logic/jsonLogicCustomOperators.js
```

---

## Notes

- **CRITICAL**: Understand how json-logic-js calls operator functions before making changes
- The `this` inside operator callbacks is likely the evaluation context, not the class
- Test thoroughly after each change - context binding bugs are subtle
- If in doubt, keep the `self` pattern - it works correctly
- This is a low-priority polish task - only do if confident in the changes
