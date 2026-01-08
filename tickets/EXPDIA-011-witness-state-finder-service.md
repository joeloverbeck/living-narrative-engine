# EXPDIA-011: Create WitnessStateFinder Service

## Summary

Implement guided search using simulated annealing to find satisfying states (witnesses) for expressions. When a witness cannot be found, return the "nearest miss" - the state that came closest to satisfying all prerequisites.

## Priority: Medium | Effort: Medium

## Rationale

For rare expressions, random sampling rarely produces a triggering state. Guided search uses optimization to find states that satisfy prerequisites, giving content authors concrete examples of when their expression would fire. The "nearest miss" helps debug impossible expressions.

## Dependencies

- **EXPDIA-010** (WitnessState model)
- **EXPDIA-002** (GateConstraintAnalyzer for constraint information)
- **EXPDIA-005** (DI registration pattern)

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/expressionDiagnostics/services/WitnessStateFinder.js` | **Create** |
| `src/expressionDiagnostics/services/index.js` | **Modify** (add export) |
| `src/dependencyInjection/tokens/tokens-diagnostics.js` | **Modify** (add token) |
| `src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js` | **Modify** (add registration) |
| `tests/unit/expressionDiagnostics/services/witnessStateFinder.test.js` | **Create** |

## Out of Scope

- **DO NOT** modify WitnessState model - that's EXPDIA-010
- **DO NOT** implement SMT solver - that's EXPDIA-013
- **DO NOT** create UI components - that's EXPDIA-012
- **DO NOT** implement ThresholdSuggester - that's EXPDIA-015
- **DO NOT** modify existing expression services

## Implementation Details

### WitnessStateFinder Service

```javascript
/**
 * @file WitnessStateFinder - Guided search for satisfying states
 * @see specs/expression-diagnostics.md Layer D
 */

import WitnessState from '../models/WitnessState.js';
import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * @typedef {Object} SearchConfig
 * @property {number} maxIterations - Maximum search iterations (default 10000)
 * @property {number} initialTemperature - Starting temperature for annealing (default 1.0)
 * @property {number} coolingRate - Temperature reduction per iteration (default 0.9997)
 * @property {number} restartThreshold - Iterations without improvement before restart (default 1000)
 * @property {boolean} useDynamicsConstraints - Constrain to realistic deltas (default false)
 */

/**
 * @typedef {Object} SearchResult
 * @property {boolean} found - True if exact witness found
 * @property {WitnessState|null} witness - The satisfying state (if found)
 * @property {WitnessState} nearestMiss - Best state found (always present)
 * @property {number} bestFitness - Fitness of best state (1 = perfect)
 * @property {number} iterationsUsed - Number of iterations performed
 * @property {string[]} violatedClauses - Clauses that failed in nearestMiss
 */

class WitnessStateFinder {
  /** @type {object} */
  #expressionEvaluator;

  /** @type {object} */
  #dataRegistry;

  /** @type {object} */
  #logger;

  /** @type {SearchConfig} */
  #defaultConfig = {
    maxIterations: 10000,
    initialTemperature: 1.0,
    coolingRate: 0.9997,
    restartThreshold: 1000,
    useDynamicsConstraints: false
  };

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
   * Find a witness state for an expression
   * @param {object} expression - Expression to find witness for
   * @param {Partial<SearchConfig>} [config]
   * @returns {SearchResult}
   */
  findWitness(expression, config = {}) {
    const cfg = { ...this.#defaultConfig, ...config };

    let currentState = WitnessState.createRandom();
    let currentFitness = this.#calculateFitness(expression, currentState);

    let bestState = currentState;
    let bestFitness = currentFitness;

    let temperature = cfg.initialTemperature;
    let iterationsWithoutImprovement = 0;

    for (let i = 0; i < cfg.maxIterations; i++) {
      // Check if we found a perfect witness
      if (bestFitness === 1) {
        return this.#createResult(true, bestState, bestFitness, i, expression);
      }

      // Generate neighbor state
      const neighbor = this.#generateNeighbor(currentState, temperature, cfg);
      const neighborFitness = this.#calculateFitness(expression, neighbor);

      // Simulated annealing acceptance
      if (this.#shouldAccept(currentFitness, neighborFitness, temperature)) {
        currentState = neighbor;
        currentFitness = neighborFitness;

        if (neighborFitness > bestFitness) {
          bestState = neighbor;
          bestFitness = neighborFitness;
          iterationsWithoutImprovement = 0;
        } else {
          iterationsWithoutImprovement++;
        }
      } else {
        iterationsWithoutImprovement++;
      }

      // Random restart if stuck
      if (iterationsWithoutImprovement >= cfg.restartThreshold) {
        currentState = WitnessState.createRandom();
        currentFitness = this.#calculateFitness(expression, currentState);
        iterationsWithoutImprovement = 0;
        temperature = cfg.initialTemperature * 0.5; // Partial reset
      }

      // Cool down
      temperature *= cfg.coolingRate;
    }

    // Return best found (may be imperfect)
    return this.#createResult(
      bestFitness === 1,
      bestFitness === 1 ? bestState : null,
      bestFitness,
      cfg.maxIterations,
      expression,
      bestState
    );
  }

  /**
   * Calculate fitness (0 = all fail, 1 = all pass)
   * @private
   */
  #calculateFitness(expression, state) {
    if (!expression?.prerequisites || expression.prerequisites.length === 0) {
      return 1; // No prerequisites = always passes
    }

    const context = this.#buildContext(state);
    let passedCount = 0;
    let totalPenalty = 0;

    for (const prereq of expression.prerequisites) {
      const { passed, penalty } = this.#evaluatePrerequisite(prereq, context);
      if (passed) {
        passedCount++;
      } else {
        totalPenalty += penalty;
      }
    }

    const passRatio = passedCount / expression.prerequisites.length;

    // Blend pass ratio with penalty to guide optimization
    // Higher fitness = more clauses passed, lower penalty
    const penaltyFactor = Math.exp(-totalPenalty * 0.1);
    return passRatio * 0.7 + penaltyFactor * 0.3;
  }

  /**
   * Evaluate prerequisite and calculate penalty
   * @private
   */
  #evaluatePrerequisite(prereq, context) {
    try {
      const jsonLogic = require('json-logic-js');
      const passed = jsonLogic.apply(prereq.logic, context);

      if (passed) {
        return { passed: true, penalty: 0 };
      }

      // Calculate how far from passing
      const penalty = this.#calculatePenalty(prereq.logic, context);
      return { passed: false, penalty };
    } catch {
      return { passed: false, penalty: 1 };
    }
  }

  /**
   * Calculate penalty for failed prerequisite
   * @private
   */
  #calculatePenalty(logic, context) {
    if (logic['>=']) {
      const [left, right] = logic['>='];
      if (left?.var && typeof right === 'number') {
        const actual = this.#getNestedValue(context, left.var);
        if (typeof actual === 'number') {
          return Math.max(0, right - actual);
        }
      }
    }

    if (logic['<=']) {
      const [left, right] = logic['<='];
      if (left?.var && typeof right === 'number') {
        const actual = this.#getNestedValue(context, left.var);
        if (typeof actual === 'number') {
          return Math.max(0, actual - right);
        }
      }
    }

    // Recurse into and/or
    if (logic.and) {
      return logic.and.reduce((sum, clause) =>
        sum + this.#calculatePenalty(clause, context), 0);
    }

    if (logic.or) {
      // For OR, take minimum penalty (easiest to satisfy)
      const penalties = logic.or.map(clause =>
        this.#calculatePenalty(clause, context));
      return Math.min(...penalties);
    }

    return 0.5; // Default penalty for unknown logic
  }

  /**
   * Generate neighbor state with perturbation
   * @private
   */
  #generateNeighbor(state, temperature, config) {
    const mood = { ...state.mood };
    const sexual = { ...state.sexual };

    // Perturbation magnitude based on temperature
    const magnitude = temperature * (config.useDynamicsConstraints ? 10 : 50);

    // Perturb a random subset of axes
    for (const axis of WitnessState.MOOD_AXES) {
      if (Math.random() < 0.5) {
        const delta = (Math.random() - 0.5) * 2 * magnitude;
        mood[axis] = Math.max(
          WitnessState.MOOD_RANGE.min,
          Math.min(WitnessState.MOOD_RANGE.max, mood[axis] + delta)
        );
      }
    }

    for (const axis of WitnessState.SEXUAL_AXES) {
      if (Math.random() < 0.5) {
        const delta = (Math.random() - 0.5) * 2 * magnitude;
        sexual[axis] = Math.max(
          WitnessState.SEXUAL_RANGE.min,
          Math.min(WitnessState.SEXUAL_RANGE.max, sexual[axis] + delta)
        );
      }
    }

    return new WitnessState({
      mood,
      sexual,
      fitness: 0, // Will be calculated
      isExact: false
    });
  }

  /**
   * Simulated annealing acceptance criterion
   * @private
   */
  #shouldAccept(currentFitness, newFitness, temperature) {
    if (newFitness >= currentFitness) {
      return true; // Always accept improvements
    }

    // Probabilistic acceptance for worse solutions
    const delta = newFitness - currentFitness;
    const probability = Math.exp(delta / temperature);
    return Math.random() < probability;
  }

  /**
   * Build evaluation context from witness state
   * @private
   */
  #buildContext(state) {
    // Convert to normalized form [-1, 1] for internal use
    const normalizedMood = {};
    for (const axis of WitnessState.MOOD_AXES) {
      normalizedMood[axis] = state.mood[axis] / 100;
    }

    // Calculate emotions from mood
    const emotions = this.#calculateEmotions(normalizedMood);

    // Convert sexual state to [0, 1]
    const normalizedSexual = {};
    for (const axis of WitnessState.SEXUAL_AXES) {
      normalizedSexual[axis] = state.sexual[axis] / 100;
    }

    const sexualStates = this.#calculateSexualStates(normalizedSexual);

    return {
      mood: normalizedMood,
      emotions,
      sexualStates
    };
  }

  /**
   * Calculate emotion intensities from mood
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
   * Get nested value from object
   * @private
   */
  #getNestedValue(obj, path) {
    return path.split('.').reduce((o, k) => o?.[k], obj);
  }

  /**
   * Create search result object
   * @private
   */
  #createResult(found, witness, fitness, iterations, expression, nearestMiss = null) {
    const bestState = witness || nearestMiss;
    const violatedClauses = found ? [] : this.#getViolatedClauses(expression, bestState);

    return {
      found,
      witness: found ? bestState.withChanges({ isExact: true, fitness: 1 }) : null,
      nearestMiss: bestState.withChanges({ fitness, isExact: false }),
      bestFitness: fitness,
      iterationsUsed: iterations,
      violatedClauses
    };
  }

  /**
   * Get list of violated clauses for a state
   * @private
   */
  #getViolatedClauses(expression, state) {
    if (!expression?.prerequisites) return [];

    const context = this.#buildContext(state);
    const violated = [];

    for (let i = 0; i < expression.prerequisites.length; i++) {
      const prereq = expression.prerequisites[i];
      const { passed } = this.#evaluatePrerequisite(prereq, context);
      if (!passed) {
        violated.push(`Clause ${i + 1}: ${JSON.stringify(prereq.logic).substring(0, 50)}`);
      }
    }

    return violated;
  }
}

export default WitnessStateFinder;
```

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:unit -- tests/unit/expressionDiagnostics/services/witnessStateFinder.test.js --verbose
```

### Unit Test Coverage Requirements

**witnessStateFinder.test.js:**
- Constructor throws if expressionEvaluator is missing
- Constructor throws if dataRegistry is missing
- Constructor throws if logger is missing
- `findWitness()` returns found=true for always-true expression
- `findWitness()` returns witness state when found
- `findWitness()` returns nearestMiss when not found
- `findWitness()` fitness=1 for perfect witness
- `findWitness()` fitness<1 for imperfect result
- `findWitness()` uses provided config options
- `findWitness()` respects maxIterations
- `findWitness()` performs random restarts when stuck
- Penalty function correctly calculates >= violations
- Penalty function correctly calculates <= violations
- Penalty function handles AND clauses
- Penalty function handles OR clauses
- Neighbor generation respects bounds
- Temperature affects perturbation magnitude
- Acceptance criterion accepts improvements
- Acceptance criterion probabilistically accepts worse
- violatedClauses populated correctly
- Works with dynamics constraints enabled

### Invariants That Must Remain True

1. **Fitness in [0, 1]** - Always properly bounded
2. **nearestMiss always present** - Even if witness not found
3. **Witness has fitness=1** - Only exact matches are witnesses
4. **Bounds respected** - Generated states always valid
5. **Terminates** - Never exceeds maxIterations

## Verification Commands

```bash
# Run unit tests
npm run test:unit -- tests/unit/expressionDiagnostics/services/witnessStateFinder.test.js --verbose

# Type checking
npm run typecheck
```

## Definition of Done

- [ ] `WitnessStateFinder.js` created with simulated annealing
- [ ] `services/index.js` updated with export
- [ ] DI token added to `tokens-diagnostics.js`
- [ ] Service registered in `expressionDiagnosticsRegistrations.js`
- [ ] Unit tests cover search algorithm
- [ ] Tests verify witness finding for easy expressions
- [ ] Tests verify nearestMiss for impossible expressions
- [ ] JSDoc documentation complete
- [ ] All tests pass
- [ ] No modifications to WitnessState model
