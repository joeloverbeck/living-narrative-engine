# PROFITRANSERREFPLA-004: Extract PrototypeTypeDetector

**Status**: Completed
**Priority**: HIGH
**Estimated Effort**: S (0.5-1 day)
**Dependencies**: None (tests already exist in repo)
**Blocks**: PROFITRANSERREFPLA-015

## Problem Statement

`PrototypeFitRankingService` contains prototype type detection logic that parses JSON Logic expressions to identify referenced prototype types. This logic is standalone and should be extracted into a focused `PrototypeTypeDetector` service without changing the detection behavior.

## Objective

Extract prototype type detection methods from `PrototypeFitRankingService` into a new `PrototypeTypeDetector` that:
1. Detects `emotion` and `sexual` type references in expressions using the existing `hasEmotions`/`hasSexualStates` flags
2. Extracts current prototype from comparison expressions (>=, >, <=, <)
3. Handles the same JSON Logic operator structures currently supported (`and`/`or` and comparison operators)
4. Can be independently tested and reused

## Scope

### In Scope
- Create `PrototypeTypeDetector.js`
- Add DI token `IPrototypeTypeDetector`
- Register service in DI container
- Update `PrototypeFitRankingService` to use new service
- Ensure existing prototype type detector tests (unit + integration) remain green
- Verify all existing tests pass

### Out of Scope
- Other service extractions
- Modifying public API of `PrototypeFitRankingService`
- Adding new detection capabilities or broadening JSON Logic coverage
- Performance optimizations

## Acceptance Criteria

- [ ] New file created: `src/expressionDiagnostics/services/PrototypeTypeDetector.js`
- [ ] DI token added: `IPrototypeTypeDetector` in `tokens-diagnostics.js`
- [ ] Service registered in `expressionDiagnosticsRegistrations.js`
- [ ] `PrototypeFitRankingService` constructor accepts `IPrototypeTypeDetector`
- [ ] All detection logic delegated to new service
- [ ] Existing prototype type detector tests pass (`tests/unit/expressionDiagnostics/services/prototypeTypeDetector.test.js` and `tests/integration/expression-diagnostics/prototypeTypeDetector.integration.test.js`)
- [ ] All existing tests pass unchanged
- [ ] Targeted linting passes for new service file

## Tasks

### 1. Create PrototypeTypeDetector

```javascript
// src/expressionDiagnostics/services/PrototypeTypeDetector.js

/**
 * @file Detects prototype types referenced in JSON Logic expressions
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * @typedef {import('../types.js').PrototypeRef} PrototypeRef
 */

class PrototypeTypeDetector {
  #logger;

  /**
   * @param {object} deps
   * @param {object} deps.logger - ILogger instance
   */
  constructor({ logger }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'warn', 'error'],
    });
    this.#logger = logger;
  }

  /**
   * Detect prototype types referenced in expression
   * @param {object|object[]} expressionOrPrerequisites
   * @returns {{hasEmotions: boolean, hasSexualStates: boolean}} Prototype type flags
   */
  detectReferencedTypes(expressionOrPrerequisites) {
    // Extract from PrototypeFitRankingService.js:859-876
  }

  /**
   * Extract current prototype from expression
   * @param {object} expression
   * @returns {PrototypeRef|null}
   */
  extractCurrentPrototype(expression) {
    // Extract from PrototypeFitRankingService.js:922-934
  }

  /**
   * Scan JSON Logic for prototype type references
   * @private
   * @param {object} logic
   * @param {Set<string>} types
   */
  #scanLogicForPrototypeTypes(logic, types) {
    // Extract from PrototypeFitRankingService.js:886-915
  }

  /**
   * Find prototype reference in comparison expression
   * @private
   * @param {object} logic
   * @returns {PrototypeRef|null}
   */
  #findPrototypeRefInLogic(logic) {
    // Extract from PrototypeFitRankingService.js:941-972
  }
}

export default PrototypeTypeDetector;
```

### 2. Add DI Token

```javascript
// In src/dependencyInjection/tokens/tokens-diagnostics.js
// Add to diagnosticsTokens object:

IPrototypeTypeDetector: 'IPrototypeTypeDetector',
```

### 3. Register Service

```javascript
// In src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js

import PrototypeTypeDetector from '../../expressionDiagnostics/services/PrototypeTypeDetector.js';

// Add registration:
registrar.singletonFactory(
  diagnosticsTokens.IPrototypeTypeDetector,
  (c) =>
    new PrototypeTypeDetector({
      logger: c.resolve(tokens.ILogger),
    })
);
```

### 4. Update PrototypeFitRankingService

```javascript
// Update constructor to accept new dependency
constructor({
  dataRegistry,
  logger,
  prototypeConstraintAnalyzer,
  prototypeRegistryService,
  prototypeTypeDetector  // NEW
}) {
  // ... existing validation ...
  this.#prototypeTypeDetector = prototypeTypeDetector;
}

// Replace direct calls:
// Before: this.#detectReferencedPrototypeTypes(expr)
// After:  this.#prototypeTypeDetector.detectReferencedTypes(expr)
```

### 5. Update DI Registration for PrototypeFitRankingService

```javascript
// Add prototypeTypeDetector dependency
prototypeTypeDetector: c.resolve(diagnosticsTokens.IPrototypeTypeDetector),
```

### 6. Enable Tests

- Remove `.skip` from all test blocks in PROFITRANSERREFPLA-003 test files
- Run tests and fix any issues

## Methods to Extract

| Method | Lines | Destination |
|--------|-------|-------------|
| `#detectReferencedPrototypeTypes` | 859-876 | `detectReferencedTypes` |
| `#scanLogicForPrototypeTypes` | 886-915 | `#scanLogicForPrototypeTypes` (private) |
| `#extractExpressionPrototype` | 922-934 | `extractCurrentPrototype` |
| `#findPrototypeRefInLogic` | 941-972 | `#findPrototypeRefInLogic` (private) |

## Verification

```bash
# Run service-related tests
npm run test:unit -- --testPathPatterns="prototypeTypeDetector" --coverage=false
npm run test:integration -- --testPathPatterns="prototypeTypeDetector" --coverage=false

# Lint new file
npx eslint src/expressionDiagnostics/services/PrototypeTypeDetector.js
```

## Success Metrics

- New service file < 200 lines
- All unit tests pass
- All integration tests pass
- All existing `PrototypeFitRankingService` tests pass
- No changes to public API
- Clean ESLint output

## Notes

- Service has no external dependencies except logger
- Detection logic is pure/stateless - easy to test
- Keep recursive scanning logic intact
- Preserve all variable path pattern matching

## Related Files

**Source:**
- `src/expressionDiagnostics/services/PrototypeFitRankingService.js`

**To Create:**
- `src/expressionDiagnostics/services/PrototypeTypeDetector.js`

**To Modify:**
- `src/dependencyInjection/tokens/tokens-diagnostics.js`
- `src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js`

**Tests:**
- `tests/unit/expressionDiagnostics/services/prototypeTypeDetector.test.js` (already exists)
- `tests/integration/expression-diagnostics/prototypeTypeDetector.integration.test.js` (already exists)

## Notes

- PROFITRANSERREFPLA-003 ticket file is not present in `tickets/`, but the tests referenced by that ticket already exist and are active.

## Outcome

- Extracted prototype type detection into `PrototypeTypeDetector` and wired DI registration/token updates.
- Updated `PrototypeFitRankingService` to delegate detection/extraction calls without changing public API or behavior.
- Adjusted DI registration tests to account for the new service; existing prototype type detector tests were already present and remained unchanged.
