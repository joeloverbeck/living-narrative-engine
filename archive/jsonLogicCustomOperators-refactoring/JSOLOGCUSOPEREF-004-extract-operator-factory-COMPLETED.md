# JSOLOGCUSOPEREF-004: Extract Operator Registry Factory

**Priority**: 🟡 High
**Estimated Effort**: 4 hours
**Phase**: 2 - High-Priority Refactoring
**Depends On**: JSOLOGCUSOPEREF-001, JSOLOGCUSOPEREF-002, JSOLOGCUSOPEREF-003
**Status**: ✅ Completed

---

## Summary

The `registerOperators()` method in `JsonLogicCustomOperators` is 537 lines long (lines 113-649) with cyclomatic complexity of ~30. It handles operator instantiation, registration, and whitelist validation for **27 operators** (26 class-based + 1 inline function). This should be refactored into a factory pattern for maintainability.

> **Note**: The `get_component_value` operator is an inline function (lines 228-270), not a class. The factory must handle this specially.

---

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/logic/operatorRegistryFactory.js` | Create - new factory class |
| `src/logic/jsonLogicCustomOperators.js` | Modify - use factory, reduce registerOperators() to <100 lines |
| `tests/unit/logic/operatorRegistryFactory.test.js` | Create - unit tests for factory |

---

## Out of Scope

**DO NOT modify:**
- Individual operator class implementations
- DI registration files
- Operator base classes
- Any files in `data/` directory
- Integration test files

---

## Implementation Details

### Step 1: Create OperatorRegistryFactory Class

```javascript
// src/logic/operatorRegistryFactory.js

/**
 * Factory for creating and registering JSON Logic operators.
 * Groups operators by category with shared dependency injection.
 */
export class OperatorRegistryFactory {
  #dependencies;
  #operatorDefinitions;

  constructor(dependencies) {
    this.#dependencies = dependencies;
    this.#operatorDefinitions = this.#buildDefinitions();
  }

  #buildDefinitions() {
    return {
      body: {
        dependencies: ['entityManager', 'bodyGraphService', 'logger'],
        operators: [
          { name: 'hasPartWithComponentValue', class: HasPartWithComponentValueOperator },
          { name: 'hasPartOfType', class: HasPartOfTypeOperator },
          // ... etc
        ],
      },
      equipment: {
        dependencies: ['entityManager', 'logger'],
        operators: [
          { name: 'isSlotExposed', class: IsSlotExposedOperator },
          // ... etc
        ],
      },
      // furniture, standalone categories
    };
  }

  createOperators() {
    const operators = new Map();
    for (const [category, config] of Object.entries(this.#operatorDefinitions)) {
      const deps = this.#extractDependencies(config.dependencies);
      for (const opDef of config.operators) {
        operators.set(opDef.name, new opDef.class(deps));
      }
    }
    return operators;
  }

  #extractDependencies(requiredKeys) {
    const deps = {};
    for (const key of requiredKeys) {
      deps[key] = this.#dependencies[key];
    }
    return deps;
  }
}
```

### Step 2: Refactor JsonLogicCustomOperators

```javascript
// In JsonLogicCustomOperators

registerOperators(jsonLogicEvaluationService) {
  const factory = new OperatorRegistryFactory({
    entityManager: this.#entityManager,
    bodyGraphService: this.#bodyGraphService,
    logger: this.#logger,
    lightingStateService: this.#lightingStateService,
  });

  const operators = factory.createOperators();

  for (const [name, operator] of operators) {
    this.#registerOperator(name, operator, jsonLogicEvaluationService);
    this.#trackOperatorForCaching(operator);
  }

  this.#validateWhitelist(operators);
  this.#logger.info(`Registered ${operators.size} custom operators`);
}
```

### Step 3: Simplify Registration Logic

Move the wrapper function creation into the factory or a separate helper:

```javascript
#registerOperator(name, operator, evalService) {
  evalService.addOperation(name, function(...args) {
    return operator.evaluate(args, this);
  });
  this.#registeredOperators.add(name);
}
```

---

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:unit -- tests/unit/logic/operatorRegistryFactory.test.js
npm run test:unit -- tests/unit/logic/jsonLogicCustomOperators.test.js
npm run test:integration -- tests/integration/logic/
```

### Specific Test Assertions

1. **Factory unit tests**:
   - Creates all 27 operators successfully (26 class-based + 1 inline function)
   - Returns Map with correct operator names
   - Handles missing optional dependencies gracefully
   - Each operator has required dependencies injected

2. **Integration with JsonLogicCustomOperators**:
   - All 27 operators registered correctly
   - `getRegisteredOperators().size === 27`
   - All existing operator tests pass without modification

### Invariants That Must Remain True

1. **Operator count**: Exactly 27 operators registered (26 class-based + 1 inline function)
2. **Operator behavior**: All operators function identically to before refactoring
3. **Cache tracking**: All cacheable operators still tracked for cache clearing
4. **Whitelist validation**: Still validates operator names against whitelist
5. **Error handling**: Same error behavior for missing dependencies
6. **Method lines**: `registerOperators()` must be < 100 lines after refactoring

---

## Verification Commands

```bash
# Run new factory tests
npm run test:unit -- tests/unit/logic/operatorRegistryFactory.test.js --verbose

# Run all operator tests
npm run test:unit -- tests/unit/logic/ --verbose

# Measure method length (should be < 100)
grep -n "registerOperators" src/logic/jsonLogicCustomOperators.js

# Lint new file
npx eslint src/logic/operatorRegistryFactory.js

# Full regression check
npm run test:ci
```

---

## Notes

- Keep operator class imports in the factory file for clarity
- Consider grouping operator definitions in a separate data structure if the factory becomes too large
- The factory pattern allows easier testing of operator creation logic
- Document the category structure in JSDoc for maintainability

---

## Outcome

### Ticket Corrections Made Before Implementation

The original ticket had incorrect assumptions that were corrected first:

| Item | Original Claim | Corrected Value |
|------|---------------|-----------------|
| Operator count | 26 operators | **27 operators** |
| Operator types | All class-based (implied) | **26 class-based + 1 inline function** |

The `get_component_value` operator was an inline function, not a class-based operator. This required special handling in the factory.

### Implementation Summary

**Files Created:**
- `src/logic/operatorRegistryFactory.js` (327 lines) - New factory class
- `tests/unit/logic/operatorRegistryFactory.test.js` (358 lines) - 34 unit tests

**Files Modified:**
- `src/logic/jsonLogicCustomOperators.js` - Reduced from 674 lines to 178 lines
- `registerOperators()` method reduced from 537 lines to 52 lines (target was <100)

### Design Decisions

1. **Factory groups operators by dependency type** (body, equipment, accessibility, furniture, component, grabbing, lighting)
2. **Inline function handled specially** - `get_component_value` is created as a function, not instantiated as a class
3. **Static method for operator names** - `OperatorRegistryFactory.getOperatorNames()` returns all 27 operator names for validation
4. **Backward compatibility preserved** - `isSocketCoveredOp` and `socketExposureOp` remain as instance properties for external access

### Test Results

- Factory tests: 34 passed
- jsonLogicCustomOperators tests: 75 passed
- All unit/logic tests: 168 suites, 3204 tests passed
- Integration/logic tests: 35 suites, 259 tests passed

### Deviation from Original Plan

The ticket's acceptance criteria mentioned "Handles missing optional dependencies gracefully" but testing revealed that `bodyGraphService` and `lightingStateService` are **required** dependencies (not optional). The factory correctly throws errors when these are missing, as body operators and lighting operators depend on them.
