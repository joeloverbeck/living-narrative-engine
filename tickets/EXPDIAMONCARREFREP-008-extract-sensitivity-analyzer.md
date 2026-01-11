# EXPDIAMONCARREFREP-008: Extract SensitivityAnalyzer from Controller

## Summary
Extract `#computeSensitivityData()` and `#computeGlobalSensitivityData()` from `ExpressionDiagnosticsController` into a dedicated `SensitivityAnalyzer` service. This reduces controller line count by ~200 lines and makes sensitivity logic independently testable.

## Files to Create

| File | Action | Description |
|------|--------|-------------|
| `src/expressionDiagnostics/services/SensitivityAnalyzer.js` | Create | New service for sensitivity computation |

## Files to Modify

| File | Action | Changes |
|------|--------|---------|
| `src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js` | Modify | Remove sensitivity methods, inject and delegate to new service |
| `src/dependencyInjection/tokens/tokens-diagnostics.js` | Modify | Add `ISensitivityAnalyzer` token |
| `src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js` | Modify | Register new service |

## Out of Scope

- **DO NOT** change sensitivity analysis algorithms
- **DO NOT** modify UI rendering methods (e.g., `#displaySensitivity`)
- **DO NOT** modify `MonteCarloSimulator` threshold computation
- **DO NOT** modify `MonteCarloReportGenerator`
- **DO NOT** extract other controller methods (done in EXPDIAMONCARREFREP-010)

## Acceptance Criteria

### Tests That Must Pass
1. All existing tests in `tests/unit/domUI/expression-diagnostics/ExpressionDiagnosticsController.test.js`
2. All integration tests in `tests/integration/expression-diagnostics/`
3. New test: `SensitivityAnalyzer.computeSensitivityData()` with valid inputs
4. New test: `SensitivityAnalyzer.computeSensitivityData()` with empty contexts
5. New test: `SensitivityAnalyzer.computeGlobalSensitivityData()` with multiple conditions
6. New test: `SensitivityAnalyzer` constructor validates dependencies

### Invariants That Must Remain True
1. Sensitivity grid structure unchanged
2. Global sensitivity evaluation logic unchanged
3. Wilson interval calculation unchanged (z=1.96)
4. Condition extraction patterns unchanged
5. Controller line count reduced by ~200 lines

## Implementation Notes

### Methods to Extract from Controller

From `ExpressionDiagnosticsController.js`:
```javascript
// Lines ~823-911: Extract this method
#computeSensitivityData(storedContexts, blockers, prerequisites) {
  // Condition extraction
  // Threshold grid computation
  // Wilson interval calculation
  // ...
}

// Lines ~912-1050: Extract this method
#computeGlobalSensitivityData(storedContexts, blockers, prerequisites) {
  // Global condition aggregation
  // Cross-expression sensitivity
  // ...
}

// Supporting methods also to extract:
#flattenLeavesForSensitivity(blockers) { ... }
#extractConditionsFromPrereqs(prerequisites) { ... }
#calculateWilsonIntervalUI(successes, total, z = 1.96) { ... }
```

### SensitivityAnalyzer Interface
```javascript
/**
 * @file Service for computing sensitivity analysis on Monte Carlo results
 */

import { validateDependency } from '../../../utils/dependencyUtils.js';

class SensitivityAnalyzer {
  #logger;
  #monteCarloSimulator;

  constructor({ logger, monteCarloSimulator }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug']
    });
    validateDependency(monteCarloSimulator, 'IMonteCarloSimulator', logger, {
      requiredMethods: ['computeThresholdSensitivity']
    });
    this.#logger = logger;
    this.#monteCarloSimulator = monteCarloSimulator;
  }

  /**
   * Compute sensitivity data for individual clauses.
   * @param {Array} storedContexts - Stored simulation contexts
   * @param {Array} blockers - Hierarchical blocker data
   * @param {Object} prerequisites - Expression prerequisites
   * @returns {Object} Sensitivity grid data
   */
  computeSensitivityData(storedContexts, blockers, prerequisites) {
    // Extract from controller
  }

  /**
   * Compute global sensitivity data across all conditions.
   * @param {Array} storedContexts - Stored simulation contexts
   * @param {Array} blockers - Hierarchical blocker data
   * @param {Object} prerequisites - Expression prerequisites
   * @returns {Object} Global sensitivity data
   */
  computeGlobalSensitivityData(storedContexts, blockers, prerequisites) {
    // Extract from controller
  }

  /**
   * Flatten hierarchical blockers to leaf nodes.
   * @param {Array} blockers - Hierarchical blocker tree
   * @returns {Array} Flattened leaf nodes
   */
  flattenLeaves(blockers) {
    // Extract #flattenLeavesForSensitivity
  }

  /**
   * Calculate Wilson score interval for confidence estimation.
   * @param {number} successes - Number of successes
   * @param {number} total - Total trials
   * @param {number} z - Z-score (default 1.96 for 95% CI)
   * @returns {{lower: number, upper: number, center: number}}
   */
  calculateWilsonInterval(successes, total, z = 1.96) {
    // Extract #calculateWilsonIntervalUI
  }
}

export default SensitivityAnalyzer;
```

### Controller Update
```javascript
// In ExpressionDiagnosticsController constructor
constructor({
  // ... existing deps
  sensitivityAnalyzer,  // NEW
}) {
  validateDependency(sensitivityAnalyzer, 'ISensitivityAnalyzer', this.#logger, {
    requiredMethods: ['computeSensitivityData', 'computeGlobalSensitivityData']
  });
  this.#sensitivityAnalyzer = sensitivityAnalyzer;
}

// Replace inline computation with delegation
#handleRunSimulation() {
  // ... simulation logic ...

  // BEFORE:
  // const sensitivityData = this.#computeSensitivityData(storedContexts, blockers, prerequisites);

  // AFTER:
  const sensitivityData = this.#sensitivityAnalyzer.computeSensitivityData(
    storedContexts, blockers, prerequisites
  );
}
```

### DI Registration
```javascript
// In tokens-diagnostics.js
ISensitivityAnalyzer: 'ISensitivityAnalyzer',

// In expressionDiagnosticsRegistrations.js
container.registerFactory(tokens.ISensitivityAnalyzer, (c) => {
  return new SensitivityAnalyzer({
    logger: c.resolve(coreTokens.ILogger),
    monteCarloSimulator: c.resolve(tokens.IMonteCarloSimulator),
  });
});
```

## Verification Commands
```bash
npm run test:unit -- --testPathPattern="ExpressionDiagnosticsController"
npm run test:integration -- --testPathPattern="expression-diagnostics"
npm run typecheck
npx eslint src/expressionDiagnostics/services/SensitivityAnalyzer.js src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js
```

## Dependencies
- **Depends on**: None (can run in parallel with other tracks)
- **Blocks**: EXPDIAMONCARREFREP-009 (sensitivity analyzer tests), EXPDIAMONCARREFREP-010 (report orchestrator)
