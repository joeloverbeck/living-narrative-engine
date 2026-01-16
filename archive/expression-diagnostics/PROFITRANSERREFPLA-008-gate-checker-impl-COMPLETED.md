# PROFITRANSERREFPLA-008: Extract PrototypeGateChecker

**Status**: Completed
**Priority**: MEDIUM
**Estimated Effort**: M (1-2 days)
**Dependencies**: None (gate checker unit coverage already exists in-repo)
**Blocks**: PROFITRANSERREFPLA-011, PROFITRANSERREFPLA-015

## Problem Statement

`PrototypeFitRankingService` contains gate evaluation logic that determines whether contexts satisfy prototype requirements. This logic should be extracted into a dedicated `PrototypeGateChecker` service to enable reuse and independent testing.

## Objective

Extract gate evaluation methods from `PrototypeFitRankingService` into a new `PrototypeGateChecker` that:
1. Evaluates combined gates (and exposes a single-gate helper if needed for parity)
2. Computes gate pass rates across contexts
3. Analyzes gate compatibility with constraints (via `IPrototypeConstraintAnalyzer` when available)
4. Computes gate distances for prototype comparison
5. Converts between gate strings and axis-constraint ranges

## Scope

### In Scope
- Create `PrototypeGateChecker.js`
- Add DI token `IPrototypeGateChecker`
- Register service in DI container
- Update `PrototypeFitRankingService` to use new service
- Keep existing gate behavior tests passing (currently `tests/unit/expressionDiagnostics/services/prototypeGateChecker.test.js`)
- Verify all existing tests pass

### Out of Scope
- Other service extractions
- Modifying public API of `PrototypeFitRankingService`
- Adding new gate evaluation capabilities

## Acceptance Criteria

- [x] New file created: `src/expressionDiagnostics/services/PrototypeGateChecker.js`
- [x] DI token added: `IPrototypeGateChecker` in `tokens-diagnostics.js`
- [x] Service registered in `expressionDiagnosticsRegistrations.js`
- [x] `PrototypeFitRankingService` constructor accepts `IPrototypeGateChecker`
- [x] All gate evaluation delegated to new service
- [x] Existing gate behavior unit tests pass
- [ ] All existing tests pass unchanged
- [ ] `npm run test:ci` passes
- [ ] `npm run typecheck` passes
- [x] `npx eslint src/expressionDiagnostics/services/PrototypeGateChecker.js` passes

## Tasks

### 1. Create PrototypeGateChecker

```javascript
// src/expressionDiagnostics/services/PrototypeGateChecker.js

/**
 * @file Gate evaluation service for prototype fit analysis
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * Gate strings are parsed via GateConstraint (same behavior as PrototypeFitRankingService).
 */

class PrototypeGateChecker {
  #logger;
  #contextAxisNormalizer;
  #prototypeConstraintAnalyzer;

  /**
   * @param {object} deps
   * @param {object} deps.logger - ILogger instance
   * @param {object} deps.contextAxisNormalizer - IContextAxisNormalizer instance
   * @param {object|null} [deps.prototypeConstraintAnalyzer] - Optional IPrototypeConstraintAnalyzer
   */
  constructor({ logger, contextAxisNormalizer, prototypeConstraintAnalyzer = null }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'warn', 'error'],
    });
    validateDependency(contextAxisNormalizer, 'IContextAxisNormalizer', logger, {
      requiredMethods: ['filterToMoodRegime', 'normalizeConstraints', 'getNormalizedAxes'],
    });
    this.#logger = logger;
    this.#contextAxisNormalizer = contextAxisNormalizer;
    this.#prototypeConstraintAnalyzer = prototypeConstraintAnalyzer;
  }

  /**
   * Check if all gates pass for context
   * @param {string[]} gates
   * @param {object} ctx
   * @returns {boolean}
   */
  checkAllGatesPass(gates, ctx) {
    // Extract from PrototypeFitRankingService.js:1085-1106
  }

  /**
   * Compute fraction of contexts passing all gates
   * @param {{gates: string[]}} proto - Prototype with gates
   * @param {object[]} contexts
   * @returns {number}
   */
  computeGatePassRate(proto, contexts) {
    // Extract from PrototypeFitRankingService.js:1065-1077
  }

  /**
   * Analyze gate compatibility with constraints
   * @param {object} proto
   * @param {Map<string, {min: number, max: number}>} constraints
   * @param {number} threshold
   * @returns {{compatible: boolean, reason: string|null}|null}
   */
  getGateCompatibility(proto, constraints, threshold) {
    // Extract from PrototypeFitRankingService.js:1004-1036
  }

  /**
   * Compute distance between desired and prototype gates
   * @param {object} desiredGates
   * @param {string[]} protoGates
   * @returns {number}
   */
  computeGateDistance(desiredGates, protoGates) {
    // Extract from PrototypeFitRankingService.js:1272-1311
  }

  /**
   * Convert gates to constraint format
   * @param {string[]} protoGates
   * @returns {object}
   */
  buildGateConstraints(protoGates) {
    // Extract from PrototypeFitRankingService.js:1314-1351
  }

  /**
   * Infer gates from constraints
   * @param {Map<string, {min: number, max: number}>} constraints
   * @returns {object}
   */
  inferGatesFromConstraints(constraints) {
    // Extract from PrototypeFitRankingService.js:1235-1247
  }
}

export default PrototypeGateChecker;
```

### 2. Add DI Token

```javascript
// In src/dependencyInjection/tokens/tokens-diagnostics.js

IPrototypeGateChecker: 'IPrototypeGateChecker',
```

### 3. Register Service

```javascript
// In src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js

import PrototypeGateChecker from '../../expressionDiagnostics/services/PrototypeGateChecker.js';

// Add registration (after ContextAxisNormalizer):
  registrar.singletonFactory(
    diagnosticsTokens.IPrototypeGateChecker,
    (c) =>
      new PrototypeGateChecker({
        logger: c.resolve(tokens.ILogger),
        contextAxisNormalizer: c.resolve(diagnosticsTokens.IContextAxisNormalizer),
        prototypeConstraintAnalyzer: c.resolve(
          diagnosticsTokens.IPrototypeConstraintAnalyzer
        ),
      })
  );
```

### 4. Update PrototypeFitRankingService

```javascript
// Update constructor to accept new dependency
constructor({
  // ... existing deps ...
  prototypeGateChecker  // NEW
}) {
  // ... validation ...
  this.#prototypeGateChecker = prototypeGateChecker;
}

// Replace direct calls:
// Before: this.#checkAllGatesPass(gates, ctx)
// After:  this.#prototypeGateChecker.checkAllGatesPass(gates, ctx)

// Before: this.#computeGatePassRate(proto, contexts)
// After:  this.#prototypeGateChecker.computeGatePassRate(proto, contexts)

// etc.
```

### 5. Update DI Registration for PrototypeFitRankingService

```javascript
// Add prototypeGateChecker dependency
prototypeGateChecker: c.resolve(diagnosticsTokens.IPrototypeGateChecker),
```

### 6. Validate Existing Tests

- Run targeted unit tests and fix any issues

## Methods to Extract

| Method | Lines | Destination |
|--------|-------|-------------|
| `#computeGatePassRate` | 898-915 | `computeGatePassRate` |
| `#checkAllGatesPass` | 918-951 | `checkAllGatesPass` |
| `#getGateCompatibility` | 1004-1036 | `getGateCompatibility` |
| `#inferGatesFromConstraints` | 1235-1247 | `inferGatesFromConstraints` |
| `#computeGateDistance` | 1272-1311 | `computeGateDistance` |
| `#buildGateConstraints` | 1314-1351 | `buildGateConstraints` |

## Dependencies

This service depends on:
- `IContextAxisNormalizer` - for context normalization before gate evaluation
- `IPrototypeConstraintAnalyzer` (optional) - for gate compatibility analysis

## Verification

```bash
# Run new service tests
npm run test:unit -- --testPathPatterns="prototypeGateChecker" --coverage=false

# Verify existing tests still pass
npm run test:ci

# Type check
npm run typecheck

# Lint new file
npx eslint src/expressionDiagnostics/services/PrototypeGateChecker.js
```

## Success Metrics

- New service file < 250 lines
- All unit tests pass
- All integration tests pass
- All existing `PrototypeFitRankingService` tests pass
- No changes to public API
- Clean ESLint output

## Notes

- Floating point comparison uses tolerance of 0.0001
- Gate distance is used in prototype ranking
- Consider caching gate constraint conversions

## Related Files

**Source:**
- `src/expressionDiagnostics/services/PrototypeFitRankingService.js`

**To Create:**
- `src/expressionDiagnostics/services/PrototypeGateChecker.js`

**To Modify:**
- `src/dependencyInjection/tokens/tokens-diagnostics.js`
- `src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js`

**Dependencies:**
- `src/expressionDiagnostics/services/ContextAxisNormalizer.js`

**Tests:**
- `tests/unit/expressionDiagnostics/services/prototypeGateChecker.test.js`

## Outcome

- Extracted gate evaluation into `PrototypeGateChecker` and updated DI wiring and `PrototypeFitRankingService` delegation.
- Tests: `npm run test:unit -- --testPathPatterns="prototypeGateChecker" --coverage=false` passed; `npm run typecheck` and `npm run test:ci` failed due to pre-existing typecheck errors in `cli/validation` and `src/validation`.
