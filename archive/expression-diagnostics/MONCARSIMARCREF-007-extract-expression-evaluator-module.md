# MONCARSIMARCREF-007: Extract ExpressionEvaluator Module

## Summary

Extract expression evaluation methods from `MonteCarloSimulator.js` into a new `ExpressionEvaluator` class. This is Priority 2 for extraction because it's "core functionality, enables unit testing." The report notes that `#evaluateHierarchicalNode` is 164 lines and `#finalizeClauseResults` is 111 lines - both candidates for further decomposition within this module.

## Status

Completed

## Priority: High | Effort: High

## Rationale

The ExpressionEvaluator handles the core simulation logic:
- JSON Logic evaluation with clause tracking
- Hierarchical tree building and evaluation
- Result finalization with statistics
- Prerequisite batch evaluation

This is the heart of the Monte Carlo simulation and extracting it enables comprehensive unit testing of expression evaluation logic independent of the full simulator.

## Dependencies

- **MONCARSIMARCREF-001** through **MONCARSIMARCREF-005** (Phase 1 integration tests should already be in place)
- **MONCARSIMARCREF-006** (ContextBuilder already extracted and registered as `IMonteCarloContextBuilder`)

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/expressionDiagnostics/services/simulatorCore/ExpressionEvaluator.js` | **Create** |
| `src/expressionDiagnostics/services/MonteCarloSimulator.js` | **Modify** - Remove extracted methods, delegate to ExpressionEvaluator |
| `src/dependencyInjection/tokens/tokens-diagnostics.js` | **Modify** - Add `IMonteCarloExpressionEvaluator` token |
| `src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js` | **Modify** - Register ExpressionEvaluator |
| `tests/unit/expressionDiagnostics/services/simulatorCore/expressionEvaluator.test.js` | **Create** |
| `tests/unit/dependencyInjection/expressionDiagnosticsRegistrations.test.js` | **Modify** - Update DI registration expectations |

## Out of Scope

- **DO NOT** extract context building methods (that's MONCARSIMARCREF-006)
- **DO NOT** extract gate evaluation methods (that's MONCARSIMARCREF-008); gate outcome recording remains in `MonteCarloSimulator` and is invoked via a callback
- **DO NOT** extract prototype evaluation methods (that's MONCARSIMARCREF-009)
- **DO NOT** extract sensitivity analysis methods (that's MONCARSIMARCREF-010)
- **DO NOT** extract violation analysis methods (that's MONCARSIMARCREF-011)
- **DO NOT** extract variable path validation methods (that's MONCARSIMARCREF-012)
- **DO NOT** modify any other module or service
- **DO NOT** change the public API of MonteCarloSimulator
- **DO NOT** decompose the large methods yet (that can be a future ticket)

## Implementation Details

### Methods to Extract

From `MonteCarloSimulator.js`:

```javascript
// Methods to move to ExpressionEvaluator.js
#initClauseTracking()             // Clause tracking initialization
#describeClause()                 // Human-readable clause descriptions
#evaluateWithTracking()           // Main evaluation with clause tracking
#evaluateHierarchicalNode()       // Tree node evaluation (164 lines)
#finalizeClauseResults()          // Result finalization (111 lines)
#evaluateLeafCondition()          // Leaf condition evaluation with JSON Logic
#evaluateThresholdCondition()     // Threshold comparisons (<, >, <=, >=)
#buildHierarchicalTree()          // Constructs logical clause tree
#evaluateAllPrerequisites()       // Batch prerequisite evaluation
#evaluatePrerequisite()           // Single prerequisite evaluation
#describeLeafCondition()          // Human-readable leaf descriptions
#describeOperand()                // Operand descriptions for leaf formatting
#extractThresholdFromLogic()      // Threshold metadata extraction
#reverseOperator()                // Support reversed threshold comparisons
#estimateViolation()              // Fallback violation estimation
#estimateLeafViolation()          // Leaf-level violation estimation
#resolveValue()                   // Resolve values in JSON Logic operands
#extractActualValue()             // Extract actual value for ceiling analysis
#extractCeilingData()             // Extract worst ceiling data for clause results
#recordSiblingConditionedStats()  // Track sibling-conditioned stats
```

### New ExpressionEvaluator Class Structure

```javascript
/**
 * @file ExpressionEvaluator.js
 * @description Evaluates JSON Logic expressions with clause tracking and hierarchical analysis
 */

import jsonLogic from 'json-logic-js';

class ExpressionEvaluator {
  #gateOutcomeRecorder;

  /**
   * @param {Object} [deps]
   * @param {(node: import('../../models/HierarchicalClauseNode.js').default, context: object, clausePassed: boolean, inRegime: boolean, gateContextCache: object|null) => void} [deps.gateOutcomeRecorder]
   */
  constructor({ gateOutcomeRecorder } = {}) {
    this.#gateOutcomeRecorder = gateOutcomeRecorder ?? null;
  }

  /**
   * Evaluates expression with full clause tracking
   * @param {Object} expression - The expression to evaluate
   * @param {Object} context - Evaluation context
   * @param {Array|null} clauseTracking - Tracking array for clause failures
   * @param {boolean} inRegime - Whether mood constraints passed for this sample
   * @param {object|null} gateContextCache - Cached gate context for the sample
   * @param {Object} [options] - Evaluation options
   * @param {(node: import('../../models/HierarchicalClauseNode.js').default, context: object, clausePassed: boolean, inRegime: boolean, gateContextCache: object|null) => void} [options.gateOutcomeRecorder]
   * @returns {Object} Evaluation result with tracking data
   */
  evaluateWithTracking(
    expression,
    context,
    clauseTracking,
    inRegime,
    gateContextCache,
    options
  ) {
    // Extracted logic from #evaluateWithTracking
  }

  /**
   * Evaluates a hierarchical node in the clause tree
   * @param {Object} node - Tree node to evaluate
   * @param {Object} context - Evaluation context
   * @param {boolean} inRegime - Whether mood constraints passed for this sample
   * @param {object|null} gateContextCache - Cached gate context for the sample
   * @param {Map<string, boolean>|null} atomTruthMap - Atom cache for leaf evaluation
   * @param {(node: import('../../models/HierarchicalClauseNode.js').default, context: object, clausePassed: boolean, inRegime: boolean, gateContextCache: object|null) => void} [gateOutcomeRecorder]
   * @returns {Object} Node evaluation result
   */
  evaluateHierarchicalNode(
    node,
    context,
    inRegime,
    gateContextCache,
    atomTruthMap,
    gateOutcomeRecorder
  ) {
    // Extracted logic from #evaluateHierarchicalNode (164 lines)
  }

  /**
   * Finalizes clause results after all samples processed
   * @param {Object} clauseTracking - Accumulated clause statistics
   * @param {number} sampleCount - Total samples processed
   * @returns {Object} Finalized clause results
   */
  finalizeClauseResults(clauseTracking, sampleCount) {
    // Extracted logic from #finalizeClauseResults (111 lines)
  }

  /**
   * Evaluates a leaf condition using JSON Logic
   * @param {Object} condition - Leaf condition
   * @param {Object} context - Evaluation context
   * @returns {boolean} Condition result
   */
  evaluateLeafCondition(condition, context) {
    // Extracted logic from #evaluateLeafCondition
  }

  /**
   * Evaluates threshold comparison conditions
   * @param {number} actual - Actual value from context
   * @param {string} operator - Comparison operator
   * @param {number} threshold - Threshold value
   * @returns {boolean} Comparison result
   */
  evaluateThresholdCondition(actual, operator, threshold) {
    // Extracted logic from #evaluateThresholdCondition
  }

  /**
   * Builds hierarchical clause tree from expression
   * @param {Object} logic - Expression logic to analyze
   * @returns {Object} Hierarchical tree structure
   */
  buildHierarchicalTree(logic) {
    // Extracted logic from #buildHierarchicalTree
  }

  /**
   * Evaluates all prerequisites in batch
   * @param {Object} expression - Expression with prerequisites array
   * @param {Object} context - Evaluation context
   * @returns {Object} Batch evaluation results
   */
  evaluateAllPrerequisites(expression, context) {
    // Extracted logic from #evaluateAllPrerequisites
  }

  /**
   * Evaluates single prerequisite
   * @param {Object} prerequisite - Prerequisite to evaluate
   * @param {Object} context - Evaluation context
   * @returns {boolean} Prerequisite result
   */
  evaluatePrerequisite(prerequisite, context) {
    // Extracted logic from #evaluatePrerequisite
  }

  /**
   * Builds human-readable clause description
   * @param {Object} clause - Clause to describe
   * @returns {string} Human-readable description
   */
  buildClauseDescription(clause) {
    // Extracted logic from #buildClauseDescription
  }

  /**
   * Initializes clause tracking structure
   * @param {Object} expression - Expression to track
   * @returns {Object} Initialized tracking structure
   */
  initializeClauseTracking(expression) {
    // Extracted logic from #initializeClauseTracking
  }

  /**
   * Updates clause statistics with sample result
   * @param {Object} tracking - Clause tracking structure
   * @param {Object} result - Sample evaluation result
   */
  updateClauseStatistics(tracking, result) {
    // Extracted logic from #updateClauseStatistics
  }
}

export default ExpressionEvaluator;
```

### DI Token Addition

In `tokens-diagnostics.js`:
```javascript
export const diagnosticsTokens = freeze({
  // ... existing tokens
  ContextBuilder: 'ContextBuilder',
  ExpressionEvaluator: 'ExpressionEvaluator',
});
```

### DI Registration

In `diagnosticsRegistrations.js`:
```javascript
import ExpressionEvaluator from '../services/simulatorCore/ExpressionEvaluator.js';

// In registration function
registrar.singletonFactory(tokens.ExpressionEvaluator, (c) =>
  new ExpressionEvaluator({
    logger: c.resolve(tokens.ILogger),
    contextBuilder: c.resolve(tokens.ContextBuilder),
  })
);
```

### MonteCarloSimulator Modification

Replace extracted methods with delegation:

```javascript
// In MonteCarloSimulator constructor, add:
this.#expressionEvaluator = expressionEvaluator; // New dependency

// Replace method bodies with:
#evaluateWithTracking(expression, context, options) {
  return this.#expressionEvaluator.evaluateWithTracking(expression, context, options);
}

#evaluateHierarchicalNode(node, context) {
  return this.#expressionEvaluator.evaluateHierarchicalNode(node, context);
}

// Similar for all other extracted methods
```

### Unit Test Structure

```javascript
/**
 * @file expressionEvaluator.test.js
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ExpressionEvaluator from '../../../../../src/expressionDiagnostics/services/simulatorCore/ExpressionEvaluator.js';

describe('ExpressionEvaluator', () => {
  let evaluator;
  let mockLogger;
  let mockContextBuilder;

  beforeEach(() => {
    mockLogger = { debug: jest.fn(), warn: jest.fn(), error: jest.fn() };
    mockContextBuilder = {
      buildContext: jest.fn(),
      buildKnownContextKeys: jest.fn(),
    };

    evaluator = new ExpressionEvaluator({
      logger: mockLogger,
      contextBuilder: mockContextBuilder,
    });
  });

  describe('constructor', () => {
    it('should validate required dependencies', () => {
      expect(() => new ExpressionEvaluator({})).toThrow();
    });
  });

  describe('evaluateWithTracking', () => {
    it('should evaluate simple expression with tracking', () => {
      // Test matching integration test expectations
    });

    it('should track clause failures accurately', () => {
      // Test clause failure tracking
    });
  });

  describe('evaluateHierarchicalNode', () => {
    it('should evaluate AND node correctly', () => {
      // Test AND semantics
    });

    it('should evaluate OR node correctly', () => {
      // Test OR semantics
    });

    it('should handle deeply nested nodes', () => {
      // Test nested tree evaluation
    });
  });

  describe('finalizeClauseResults', () => {
    it('should compute correct trigger rate', () => {
      // Test triggerCount / sampleCount
    });

    it('should compute confidence interval', () => {
      // Test CI calculation
    });
  });

  describe('evaluateLeafCondition', () => {
    it('should evaluate >= threshold correctly', () => {
      // Test >= comparison
    });

    it('should evaluate <= threshold correctly', () => {
      // Test <= comparison
    });
  });

  describe('evaluateThresholdCondition', () => {
    it('should handle all comparison operators', () => {
      // Test >=, <=, >, <, ==
    });
  });

  describe('buildHierarchicalTree', () => {
    it('should build correct tree for AND expression', () => {
      // Test AND tree structure
    });

    it('should build correct tree for OR expression', () => {
      // Test OR tree structure
    });

    it('should assign unique node IDs', () => {
      // Test ID assignment
    });
  });

  describe('describeClause', () => {
    it('should generate human-readable descriptions', () => {
      // Test description generation
    });
  });

  // ... tests for each public method
});
```

## Acceptance Criteria

### Tests That Must Pass

```bash
# Existing expression evaluation integration test (already present)
npm run test:integration -- tests/integration/expression-diagnostics/monteCarloExpressionEvaluation.integration.test.js --coverage=false --verbose

# New unit tests must pass
npm run test:unit -- tests/unit/expressionDiagnostics/services/simulatorCore/expressionEvaluator.test.js --coverage=false --verbose

# Updated DI registration unit tests
npm run test:unit -- tests/unit/dependencyInjection/expressionDiagnosticsRegistrations.test.js --coverage=false --verbose
```

### Specific Requirements

1. **New ExpressionEvaluator class created** with extracted methods
2. **DI token added** for `IMonteCarloExpressionEvaluator`
3. **DI registration added** for ExpressionEvaluator
4. **MonteCarloSimulator updated** to delegate to ExpressionEvaluator
5. **Unit tests created** for ExpressionEvaluator (targeted coverage on extracted behavior)
6. **Expression evaluation integration tests pass** (proving behavior unchanged)

### Invariants That Must Remain True

1. **Public API of MonteCarloSimulator unchanged** - 3 public methods, same signatures
2. **JSON Logic evaluation unchanged** - Same results for all expressions
3. **Hierarchical tree structure unchanged** - Same tree shape and node IDs
4. **Clause tracking unchanged** - Same statistics and failure tracking
5. **No circular dependencies introduced**

## Verification Commands

```bash
# Run expression evaluation integration tests
npm run test:integration -- tests/integration/expression-diagnostics/monteCarloExpressionEvaluation.integration.test.js --coverage=false --verbose

# Run new unit tests
npm run test:unit -- tests/unit/expressionDiagnostics/services/simulatorCore/expressionEvaluator.test.js --coverage=false --verbose

# Updated DI registration unit tests
npm run test:unit -- tests/unit/dependencyInjection/expressionDiagnosticsRegistrations.test.js --coverage=false --verbose

# Lint modified files
npx eslint src/expressionDiagnostics/services/simulatorCore/ExpressionEvaluator.js src/expressionDiagnostics/services/MonteCarloSimulator.js

# Check file sizes
wc -l src/expressionDiagnostics/services/simulatorCore/ExpressionEvaluator.js
wc -l src/expressionDiagnostics/services/MonteCarloSimulator.js
```

## Definition of Done

- [x] `ExpressionEvaluator.js` created in `src/expressionDiagnostics/services/simulatorCore/`
- [x] Extracted evaluation + tracking methods moved from MonteCarloSimulator
- [x] DI token added to `tokens-diagnostics.js`
- [x] DI registration added to `expressionDiagnosticsRegistrations.js`
- [x] MonteCarloSimulator updated to inject and delegate to ExpressionEvaluator
- [x] Unit tests added for ExpressionEvaluator
- [x] Expression evaluation integration tests pass
- [x] Lint run on modified files (existing warnings/errors remain in legacy JSDoc + unused members)
- [x] No circular dependencies

## Outcome

Extracted expression-evaluation and clause-tracking logic into `ExpressionEvaluator` with delegate wrappers in `MonteCarloSimulator`, plus DI token/registration updates and focused unit tests. The originally listed non-existent methods (e.g., `#evaluateLogicNode`) were removed from scope, and gate outcome recording remains in `MonteCarloSimulator` via a callback instead of being extracted. Lint was run and surfaced pre-existing JSDoc and unused-member errors in `MonteCarloSimulator` beyond the scope of this ticket.
