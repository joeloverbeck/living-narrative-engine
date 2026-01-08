# EXPDIA-007: Create MonteCarloSimulator Service

## Summary

Implement Monte Carlo simulation for statistical trigger probability estimation. This service samples random mood/sexual states, evaluates expressions, and calculates trigger rates with confidence intervals and per-clause failure tracking.

## Priority: High | Effort: Medium

## Rationale

Static analysis can prove impossibility but cannot estimate trigger probability for possible expressions. Monte Carlo simulation provides statistical estimates of how often an expression will fire under realistic conditions, helping content authors understand expression rarity and identify bottleneck clauses.

## Dependencies

- **EXPDIA-001** (AxisInterval model for understanding value ranges)
- **EXPDIA-004** (DiagnosticResult model for storing results)
- **EXPDIA-005** (DI registration pattern established)

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/expressionDiagnostics/services/MonteCarloSimulator.js` | **Create** |
| `src/expressionDiagnostics/services/index.js` | **Modify** (add export) |
| `src/dependencyInjection/tokens/tokens-diagnostics.js` | **Modify** (add token) |
| `src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js` | **Modify** (add registration) |
| `tests/unit/expressionDiagnostics/services/monteCarloSimulator.test.js` | **Create** |
| `tests/fixtures/expressionDiagnostics/easyExpression.expression.json` | **Create** |
| `tests/fixtures/expressionDiagnostics/rareExpression.expression.json` | **Create** |

## Out of Scope

- **DO NOT** modify GateConstraintAnalyzer or IntensityBoundsCalculator
- **DO NOT** implement FailureExplainer - that's EXPDIA-008
- **DO NOT** implement WitnessStateFinder - that's EXPDIA-011
- **DO NOT** create UI components - that's EXPDIA-009
- **DO NOT** modify existing expression evaluation services

## Implementation Details

### MonteCarloSimulator Service

```javascript
/**
 * @file MonteCarloSimulator - Statistical trigger probability estimation
 * @see specs/expression-diagnostics.md Layer C
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * @typedef {'uniform' | 'gaussian'} DistributionType
 */

/**
 * @typedef {Object} SimulationConfig
 * @property {number} sampleCount - Number of samples (default 10000)
 * @property {DistributionType} distribution - Distribution type
 * @property {boolean} trackClauses - Track per-clause failures
 * @property {number} confidenceLevel - CI level (default 0.95)
 */

/**
 * @typedef {Object} ClauseResult
 * @property {string} clauseDescription
 * @property {number} failureCount
 * @property {number} failureRate
 * @property {number} averageViolation
 * @property {number} clauseIndex
 */

/**
 * @typedef {Object} SimulationResult
 * @property {number} triggerRate - Probability of triggering [0, 1]
 * @property {number} triggerCount - Number of successful triggers
 * @property {number} sampleCount - Total samples evaluated
 * @property {{ low: number, high: number }} confidenceInterval
 * @property {ClauseResult[]} clauseFailures - Per-clause failure data
 * @property {DistributionType} distribution
 */

class MonteCarloSimulator {
  /** @type {object} */
  #expressionEvaluator;

  /** @type {object} */
  #dataRegistry;

  /** @type {object} */
  #logger;

  /**
   * @param {Object} deps
   * @param {object} deps.expressionEvaluator - IExpressionEvaluatorService
   * @param {object} deps.dataRegistry - IDataRegistry
   * @param {object} deps.logger - ILogger
   */
  constructor({ expressionEvaluator, dataRegistry, logger }) {
    validateDependency(expressionEvaluator, 'IExpressionEvaluatorService', logger, {
      requiredMethods: ['evaluateWithContext']
    });
    validateDependency(dataRegistry, 'IDataRegistry', logger, {
      requiredMethods: ['getLookupData']
    });
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'warn', 'error']
    });

    this.#expressionEvaluator = expressionEvaluator;
    this.#dataRegistry = dataRegistry;
    this.#logger = logger;
  }

  /**
   * Run Monte Carlo simulation for an expression
   * @param {object} expression - Expression to evaluate
   * @param {SimulationConfig} [config]
   * @returns {SimulationResult}
   */
  simulate(expression, config = {}) {
    const {
      sampleCount = 10000,
      distribution = 'uniform',
      trackClauses = true,
      confidenceLevel = 0.95
    } = config;

    let triggerCount = 0;
    const clauseTracking = trackClauses ? this.#initClauseTracking(expression) : null;

    for (let i = 0; i < sampleCount; i++) {
      const state = this.#generateRandomState(distribution);
      const result = this.#evaluateWithTracking(expression, state, clauseTracking);

      if (result.triggered) {
        triggerCount++;
      }
    }

    const triggerRate = triggerCount / sampleCount;
    const confidenceInterval = this.#calculateConfidenceInterval(
      triggerRate,
      sampleCount,
      confidenceLevel
    );

    return {
      triggerRate,
      triggerCount,
      sampleCount,
      confidenceInterval,
      clauseFailures: clauseTracking ? this.#finalizeClauseResults(clauseTracking, sampleCount) : [],
      distribution
    };
  }

  /**
   * Generate random state based on distribution
   * @private
   */
  #generateRandomState(distribution) {
    const moodAxes = ['valence', 'energy', 'dominance', 'novelty', 'threat'];
    const sexualAxes = ['sex_excitation', 'sex_inhibition', 'baseline_libido'];

    const mood = {};
    const sexual = {};

    for (const axis of moodAxes) {
      mood[axis] = this.#sampleValue(distribution, -1, 1);
    }

    for (const axis of sexualAxes) {
      sexual[axis] = this.#sampleValue(distribution, 0, 1);
    }

    return { mood, sexual };
  }

  /**
   * Sample a value from the specified distribution
   * @private
   */
  #sampleValue(distribution, min, max) {
    if (distribution === 'gaussian') {
      // Box-Muller transform, clamped to range
      const u1 = Math.random();
      const u2 = Math.random();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      const mid = (min + max) / 2;
      const spread = (max - min) / 6; // 99.7% within range
      const value = mid + z * spread;
      return Math.max(min, Math.min(max, value));
    }

    // Uniform distribution
    return min + Math.random() * (max - min);
  }

  /**
   * Initialize clause tracking data structure
   * @private
   */
  #initClauseTracking(expression) {
    const clauses = [];
    if (!expression?.prerequisites) return clauses;

    for (let i = 0; i < expression.prerequisites.length; i++) {
      clauses.push({
        clauseIndex: i,
        description: this.#describeClause(expression.prerequisites[i]),
        failureCount: 0,
        violationSum: 0
      });
    }

    return clauses;
  }

  /**
   * Describe a clause in human-readable form
   * @private
   */
  #describeClause(prerequisite) {
    const logic = prerequisite?.logic;
    if (!logic) return 'Unknown clause';

    // Simple description extraction
    if (logic['>=']) {
      const [left, right] = logic['>='];
      if (left?.var && typeof right === 'number') {
        return `${left.var} >= ${right}`;
      }
    }

    if (logic['<=']) {
      const [left, right] = logic['<='];
      if (left?.var && typeof right === 'number') {
        return `${left.var} <= ${right}`;
      }
    }

    if (logic.and || logic.or) {
      const op = logic.and ? 'AND' : 'OR';
      const count = (logic.and || logic.or).length;
      return `${op} of ${count} conditions`;
    }

    return JSON.stringify(logic).substring(0, 50);
  }

  /**
   * Evaluate expression with clause tracking
   * @private
   */
  #evaluateWithTracking(expression, state, clauseTracking) {
    // Build context from state
    const context = this.#buildContext(state);

    // Evaluate each prerequisite separately for tracking
    if (clauseTracking && expression?.prerequisites) {
      for (let i = 0; i < expression.prerequisites.length; i++) {
        const prereq = expression.prerequisites[i];
        const passed = this.#evaluatePrerequisite(prereq, context);

        if (!passed) {
          clauseTracking[i].failureCount++;
          // Calculate violation magnitude (simplified)
          const violation = this.#estimateViolation(prereq, context);
          clauseTracking[i].violationSum += violation;
        }
      }
    }

    // Full evaluation
    const triggered = this.#evaluateAllPrerequisites(expression, context);
    return { triggered };
  }

  /**
   * Build evaluation context from state
   * @private
   */
  #buildContext(state) {
    // Calculate emotions from mood using prototypes
    const emotions = this.#calculateEmotions(state.mood);
    const sexualStates = this.#calculateSexualStates(state.sexual);

    return {
      mood: state.mood,
      emotions,
      sexualStates,
      // Add other context as needed
    };
  }

  /**
   * Calculate emotion intensities from mood axes
   * @private
   */
  #calculateEmotions(mood) {
    const lookup = this.#dataRegistry.getLookupData('core:emotion_prototypes');
    if (!lookup?.entries) return {};

    const emotions = {};
    for (const [id, prototype] of Object.entries(lookup.entries)) {
      if (prototype.weights) {
        let sum = 0;
        let weightSum = 0;
        for (const [axis, weight] of Object.entries(prototype.weights)) {
          if (mood[axis] !== undefined) {
            sum += mood[axis] * weight;
            weightSum += Math.abs(weight);
          }
        }
        emotions[id] = weightSum > 0 ? Math.max(0, Math.min(1, sum / weightSum)) : 0;
      }
    }
    return emotions;
  }

  /**
   * Calculate sexual state intensities
   * @private
   */
  #calculateSexualStates(sexual) {
    const lookup = this.#dataRegistry.getLookupData('core:sexual_prototypes');
    if (!lookup?.entries) return {};

    const states = {};
    for (const [id, prototype] of Object.entries(lookup.entries)) {
      if (prototype.weights) {
        let sum = 0;
        let weightSum = 0;
        for (const [axis, weight] of Object.entries(prototype.weights)) {
          if (sexual[axis] !== undefined) {
            sum += sexual[axis] * weight;
            weightSum += Math.abs(weight);
          }
        }
        states[id] = weightSum > 0 ? Math.max(0, Math.min(1, sum / weightSum)) : 0;
      }
    }
    return states;
  }

  /**
   * Evaluate a single prerequisite
   * @private
   */
  #evaluatePrerequisite(prereq, context) {
    try {
      // Use JSON Logic for evaluation
      const jsonLogic = require('json-logic-js');
      return jsonLogic.apply(prereq.logic, context);
    } catch {
      return false;
    }
  }

  /**
   * Evaluate all prerequisites
   * @private
   */
  #evaluateAllPrerequisites(expression, context) {
    if (!expression?.prerequisites) return true;

    for (const prereq of expression.prerequisites) {
      if (!this.#evaluatePrerequisite(prereq, context)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Estimate violation magnitude for a failed prerequisite
   * @private
   */
  #estimateViolation(prereq, context) {
    const logic = prereq?.logic;
    if (!logic) return 0;

    if (logic['>=']) {
      const [left, right] = logic['>='];
      if (left?.var && typeof right === 'number') {
        const actual = this.#getNestedValue(context, left.var);
        if (typeof actual === 'number') {
          return Math.max(0, right - actual);
        }
      }
    }

    return 0.1; // Default small violation
  }

  /**
   * Get nested value from object using dot notation
   * @private
   */
  #getNestedValue(obj, path) {
    return path.split('.').reduce((o, k) => o?.[k], obj);
  }

  /**
   * Finalize clause results with rates
   * @private
   */
  #finalizeClauseResults(clauseTracking, sampleCount) {
    return clauseTracking
      .map(c => ({
        clauseDescription: c.description,
        clauseIndex: c.clauseIndex,
        failureCount: c.failureCount,
        failureRate: c.failureCount / sampleCount,
        averageViolation: c.failureCount > 0 ? c.violationSum / c.failureCount : 0
      }))
      .sort((a, b) => b.failureRate - a.failureRate);
  }

  /**
   * Calculate Wilson score confidence interval
   * @private
   */
  #calculateConfidenceInterval(rate, n, level) {
    // Wilson score interval for binomial proportion
    const z = this.#getZScore(level);
    const denominator = 1 + z * z / n;
    const center = rate + z * z / (2 * n);
    const margin = z * Math.sqrt((rate * (1 - rate) + z * z / (4 * n)) / n);

    return {
      low: Math.max(0, (center - margin) / denominator),
      high: Math.min(1, (center + margin) / denominator)
    };
  }

  /**
   * Get z-score for confidence level
   * @private
   */
  #getZScore(level) {
    // Common z-scores
    if (level >= 0.99) return 2.576;
    if (level >= 0.95) return 1.96;
    if (level >= 0.90) return 1.645;
    return 1.96; // Default to 95%
  }
}

export default MonteCarloSimulator;
```

### Test Fixtures

```json
// tests/fixtures/expressionDiagnostics/easyExpression.expression.json
{
  "id": "test:easy_trigger",
  "description": "Expression that triggers frequently (>50% of the time)",
  "priority": 100,
  "prerequisites": [
    {
      "logic": {
        ">=": [{ "var": "emotions.curiosity" }, 0.1]
      }
    }
  ],
  "_comment": "Low threshold means high trigger rate"
}
```

```json
// tests/fixtures/expressionDiagnostics/rareExpression.expression.json
{
  "id": "test:rare_trigger",
  "description": "Expression that triggers rarely (<1% of the time)",
  "priority": 100,
  "prerequisites": [
    {
      "logic": {
        "and": [
          { ">=": [{ "var": "emotions.joy" }, 0.9] },
          { ">=": [{ "var": "emotions.confidence" }, 0.9] },
          { "<=": [{ "var": "emotions.fear" }, 0.1] }
        ]
      }
    }
  ],
  "_comment": "Multiple high thresholds make this rare"
}
```

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:unit -- tests/unit/expressionDiagnostics/services/monteCarloSimulator.test.js --verbose
```

### Unit Test Coverage Requirements

**monteCarloSimulator.test.js:**
- Constructor throws if expressionEvaluator is missing
- Constructor throws if dataRegistry is missing
- Constructor throws if logger is missing
- `simulate()` returns triggerRate in [0, 1] range
- `simulate()` returns correct sampleCount
- `simulate()` returns valid confidence interval
- `simulate()` with uniform distribution samples correctly
- `simulate()` with gaussian distribution samples correctly
- `simulate()` with trackClauses=true returns clause failures
- `simulate()` with trackClauses=false returns empty clauseFailures
- Easy expression has high trigger rate (>0.3)
- Rare expression has low trigger rate (<0.1)
- Clause failures sorted by failureRate descending
- Confidence interval narrows with more samples
- Wilson score interval correctly calculated

### Invariants That Must Remain True

1. **Trigger rate always in [0, 1]** - Properly bounded probability
2. **Sample count matches config** - All samples evaluated
3. **Confidence interval contains rate** - Statistical validity
4. **Clause failures sum <= sample count** - Each sample counted once
5. **Distribution affects results** - Gaussian vs Uniform produce different patterns
6. **Deterministic with seed** - Same seed produces same results (if seeding added)

## Verification Commands

```bash
# Run unit tests
npm run test:unit -- tests/unit/expressionDiagnostics/services/monteCarloSimulator.test.js --verbose

# Type checking
npm run typecheck

# Verify service resolution
node -e "import('./src/dependencyInjection/tokens.js').then(m => console.log(m.diagnosticsTokens.IMonteCarloSimulator))"
```

## Definition of Done

- [ ] `MonteCarloSimulator.js` created with all methods implemented
- [ ] `services/index.js` updated with export
- [ ] DI token added to `tokens-diagnostics.js`
- [ ] Service registered in `expressionDiagnosticsRegistrations.js`
- [ ] Test fixtures created (easyExpression, rareExpression)
- [ ] Unit tests cover all public methods
- [ ] Tests verify statistical properties
- [ ] JSDoc documentation complete
- [ ] All tests pass
- [ ] No modifications to existing expression services
