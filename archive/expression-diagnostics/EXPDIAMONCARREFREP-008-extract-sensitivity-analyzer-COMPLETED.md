# EXPDIAMONCARREFREP-008: Extract SensitivityAnalyzer from Controller

## Summary
Extract `#computeSensitivityData()` and `#computeGlobalSensitivityData()` from `ExpressionDiagnosticsController` into a dedicated `SensitivityAnalyzer` service. These methods currently read controller state (stored contexts, blockers, prerequisites), so the service should accept those inputs explicitly. This reduces controller line count by ~170-200 lines and makes sensitivity logic independently testable.

## Status
Completed

## Files to Create

| File | Action | Description |
|------|--------|-------------|
| `src/expressionDiagnostics/services/SensitivityAnalyzer.js` | Create | New service for sensitivity computation |

## Files to Modify

| File | Action | Changes |
|------|--------|---------|
| `src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js` | Modify | Remove sensitivity methods, inject and delegate to new service |
| `src/expression-diagnostics.js` | Modify | Resolve and pass `SensitivityAnalyzer` when creating the controller |
| `src/dependencyInjection/tokens/tokens-diagnostics.js` | Modify | Add `ISensitivityAnalyzer` token |
| `src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js` | Modify | Register new service |

## Out of Scope

- **DO NOT** change sensitivity analysis algorithms
- **DO NOT** modify UI rendering methods (e.g., `#displaySensitivity`)
- **DO NOT** modify `MonteCarloSimulator` threshold computation
- **DO NOT** modify `MonteCarloReportGenerator`
- **DO NOT** extract other controller methods (done in EXPDIAMONCARREFREP-010)
- **DO NOT** move/rename Wilson interval or conditional pass-rate helpers (they live in the controller and are not part of sensitivity extraction)

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
3. Condition extraction patterns unchanged
4. Top candidate scoring/sorting unchanged for global sensitivity
5. Controller line count reduced by ~170-200 lines

## Implementation Notes

### Methods to Extract from Controller

From `ExpressionDiagnosticsController.js`:
```javascript
// Lines ~823-911: Extract this method
#computeSensitivityData() {
  // Condition extraction
  // Threshold grid computation
  // ...
}

// Lines ~912-1050: Extract this method
#computeGlobalSensitivityData() {
  // Global condition aggregation
  // Cross-expression sensitivity
  // ...
}

// Supporting methods also to extract:
#flattenLeavesForSensitivity(blockers) { ... }
```

Notes:
- Both methods currently read `this.#rawSimulationResult.storedContexts`, `this.#currentBlockers`, and `this.#selectedExpression?.prerequisites`. The service should accept those as arguments instead of reading controller state.
- There is no `#extractConditionsFromPrereqs()` in the controller; condition extraction is inline in the two methods above.

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
      requiredMethods: ['computeThresholdSensitivity', 'computeExpressionSensitivity']
    });
    this.#logger = logger;
    this.#monteCarloSimulator = monteCarloSimulator;
  }

  /**
   * Compute sensitivity data for individual clauses.
   * @param {Array} storedContexts - Stored simulation contexts
   * @param {Array} blockers - Hierarchical blocker data
   * @returns {Object} Sensitivity grid data
   */
  computeSensitivityData(storedContexts, blockers) {
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
#handleGenerateReport() {
  // ... report logic ...

  // BEFORE:
  // const sensitivityData = this.#computeSensitivityData();

  // AFTER:
  const sensitivityData = this.#sensitivityAnalyzer.computeSensitivityData(
    storedContexts,
    blockers
  );
}
```

### DI Registration
```javascript
// In tokens-diagnostics.js
ISensitivityAnalyzer: 'ISensitivityAnalyzer',

// In expressionDiagnosticsRegistrations.js
registrar.singletonFactory(
  diagnosticsTokens.ISensitivityAnalyzer,
  (c) =>
    new SensitivityAnalyzer({
      logger: c.resolve(tokens.ILogger),
      monteCarloSimulator: c.resolve(diagnosticsTokens.IMonteCarloSimulator),
    })
);
```

## Verification Commands
```bash
npm run test:unit -- --testPathPatterns="ExpressionDiagnosticsController"
npm run test:integration -- --testPathPatterns="expression-diagnostics"
npm run typecheck
npx eslint src/expressionDiagnostics/services/SensitivityAnalyzer.js src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js
```

## Dependencies
- **Depends on**: None (can run in parallel with other tracks)
- **Blocks**: EXPDIAMONCARREFREP-009 (sensitivity analyzer tests), EXPDIAMONCARREFREP-010 (report orchestrator)

## Outcome
- Added a dedicated `SensitivityAnalyzer` service, wired through DI and `expression-diagnostics.js`, and delegated controller sensitivity calls to it.
- Kept the Wilson interval helper in the controller (no extraction), matching actual call sites and updated scope.
- Updated integration test setup to provide `RandomStateGenerator` and `SensitivityAnalyzer` where required by constructors.
