# MONCARACTIMP-006: ConstructiveWitnessSearcher Service

## Summary

Implement the `ConstructiveWitnessSearcher` service that performs optimization search to find the nearest-feasible state when an expression has zero triggers, identifying blocking clauses and minimal threshold adjustments.

## Priority

HIGH

## Effort

Large (~400 LOC)

## Dependencies

- MONCARACTIMP-001 (Configuration & Type Definitions)

## API Corrections (Critical Implementation Notes)

> **Note**: The original ticket assumptions about dependency APIs were incorrect. The following corrections must be applied during implementation:

### 1. RandomStateGenerator API

**Original Assumption**: `stateGenerator.generateInRegime(constraints)` method exists
**Reality**: Only `generate(distribution, samplingMode)` exists

**Resolution**: Use `stateGenerator.generate('uniform', 'static')` and accept all states. The hill-climb phase will naturally move toward feasible states.

### 2. ExpressionEvaluator Return Type

**Original Assumption**: `evaluateWithTracking()` returns `{ clausesPassing, totalClauses, clauseResults }`
**Reality**: `evaluateWithTracking()` returns `{ triggered, clauseResults, atomTruthMap }` with complex signature

**Resolution**: For scoring, use `evaluatePrerequisite(prereq, context)` for each prerequisite to count passing clauses:
```javascript
#scoreState(state, expression) {
  const prereqs = expression.prerequisites ?? [];
  if (prereqs.length === 0) return 0;
  const passing = prereqs.filter(p =>
    this.#expressionEvaluator.evaluatePrerequisite(p, state)
  ).length;
  return passing / prereqs.length;
}
```

## Rationale

When simulation finds zero triggers, content creators hit a dead end. This service transforms "0 triggers" from a dead end into actionable guidance by finding the state that comes closest to triggering and calculating the smallest threshold adjustments needed.

> "This is the single biggest improvement you can make for both humans and LLMs." - brainstorming doc

## Files to Create

| File | Change Type | Description |
|------|-------------|-------------|
| `src/expressionDiagnostics/services/ConstructiveWitnessSearcher.js` | CREATE | Service implementation |

## Files to Modify

| File | Change Type | Description |
|------|-------------|-------------|
| `src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js` | MODIFY | Register the service |

## Out of Scope

- Unit tests (MONCARACTIMP-007)
- Integration with report generators (MONCARACTIMP-014)
- Report formatting/output (MONCARACTIMP-014)
- SMT solver integration (deferred)
- LP approximation for linear constraints (deferred)
- Multi-objective optimization

## Implementation Details

### Algorithm: Random Search + Hill Climb

**Phase 1: Seeding**
1. Sample N random states from mood-regime (N = 5000 default)
2. Score each state by AND block satisfaction score: `score = clauses_passing / total_clauses`
3. Select top M candidates (M = 10) as hill-climb seeds

**Phase 2: Hill Climbing**
1. For each seed, perform gradient-free optimization:
   - Perturb each variable by small delta (±0.01)
   - Keep perturbation if score improves
   - Repeat for K iterations (K = 100)
2. Track best state found across all climbs

**Phase 3: Analysis**
1. Identify blocking clauses: Clauses that still fail in best state
2. For each blocking clause, calculate minimal adjustment: `delta = threshold - observed_value`
3. Rank adjustments by magnitude (smallest first)

### Service Implementation

```javascript
// src/expressionDiagnostics/services/ConstructiveWitnessSearcher.js

/**
 * @file ConstructiveWitnessSearcher - Finds nearest-feasible state for zero-trigger expressions
 * @see specs/monte-carlo-actionability-improvements.md
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { actionabilityConfig } from '../config/actionabilityConfig.js';

/** @typedef {import('../config/actionabilityConfig.js').WitnessSearchResult} WitnessSearchResult */
/** @typedef {import('../config/actionabilityConfig.js').BlockingClauseInfo} BlockingClauseInfo */
/** @typedef {import('../config/actionabilityConfig.js').ThresholdAdjustment} ThresholdAdjustment */

class ConstructiveWitnessSearcher {
  #config;
  #logger;
  #stateGenerator;
  #expressionEvaluator;

  /**
   * @param {Object} deps
   * @param {Object} deps.logger - Logger instance
   * @param {Object} deps.stateGenerator - Service to generate random states in regime
   * @param {Object} deps.expressionEvaluator - Service to evaluate expressions with tracking
   * @param {Object} [deps.config] - Optional config override
   */
  constructor({
    logger,
    stateGenerator,
    expressionEvaluator,
    config = actionabilityConfig.witnessSearch,
  }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });
    validateDependency(stateGenerator, 'IRandomStateGenerator', logger, {
      requiredMethods: ['generate'],
    });
    validateDependency(expressionEvaluator, 'IExpressionEvaluator', logger, {
      requiredMethods: ['evaluatePrerequisite'],
    });

    this.#logger = logger;
    this.#stateGenerator = stateGenerator;
    this.#expressionEvaluator = expressionEvaluator;
    this.#config = config;
  }

  /**
   * Search for the nearest state to triggering an expression
   * @param {Object} expression - The expression to analyze
   * @param {Object} moodRegimeConstraints - Constraints defining valid states
   * @param {Object} [options] - Optional overrides
   * @returns {Promise<WitnessSearchResult>}
   */
  async search(expression, moodRegimeConstraints, options = {}) {
    const startTime = Date.now();
    const timeout = options.timeoutMs ?? this.#config.timeoutMs;
    const maxSamples = options.maxSamples ?? this.#config.maxSamples;

    this.#logger.debug(
      `ConstructiveWitnessSearcher: Starting search with ${maxSamples} samples, ${timeout}ms timeout`
    );

    try {
      // Phase 1: Generate seed candidates
      const seeds = await this.#generateSeeds(
        expression,
        moodRegimeConstraints,
        maxSamples,
        startTime,
        timeout
      );

      if (seeds.length === 0) {
        return this.#buildEmptyResult(startTime, 'No valid seeds generated');
      }

      // Check timeout after seeding
      if (Date.now() - startTime > timeout) {
        this.#logger.debug('ConstructiveWitnessSearcher: Timeout after seeding phase');
        return this.#buildTimeoutResult(seeds[0], startTime);
      }

      // Phase 2: Hill climb from best seeds
      const topSeeds = seeds.slice(0, this.#config.hillClimbSeeds);
      const remainingTime = timeout - (Date.now() - startTime);

      const climbedResults = [];
      for (const seed of topSeeds) {
        if (Date.now() - startTime > timeout) break;

        const timeForThisClimb = Math.max(100, remainingTime / topSeeds.length);
        const climbed = await this.#hillClimb(
          seed,
          expression,
          moodRegimeConstraints,
          timeForThisClimb
        );
        climbedResults.push(climbed);
      }

      if (climbedResults.length === 0) {
        return this.#buildTimeoutResult(seeds[0], startTime);
      }

      // Phase 3: Select best and analyze
      const best = this.#selectBest(climbedResults);
      const analysis = this.#analyzeBlockers(best, expression);

      const result = {
        found: best.score >= this.#config.minAndBlockScore,
        bestCandidateState: best.state,
        andBlockScore: best.score,
        blockingClauses: analysis.blockingClauses,
        minimalAdjustments: analysis.adjustments,
        searchStats: {
          samplesEvaluated: seeds.length,
          hillClimbIterations: this.#config.hillClimbIterations * climbedResults.length,
          timeMs: Date.now() - startTime,
        },
      };

      this.#logger.debug(
        `ConstructiveWitnessSearcher: Search complete. Score=${best.score.toFixed(3)}, ` +
        `blocking=${analysis.blockingClauses.length}, time=${result.searchStats.timeMs}ms`
      );

      return result;
    } catch (err) {
      this.#logger.error('ConstructiveWitnessSearcher: Search failed', err);
      return this.#buildEmptyResult(startTime, err.message);
    }
  }

  /**
   * @param {Object} expression
   * @param {Object} constraints
   * @param {number} maxSamples
   * @param {number} startTime
   * @param {number} timeout
   * @returns {Promise<Array<{state: Object, score: number}>>}
   */
  async #generateSeeds(expression, constraints, maxSamples, startTime, timeout) {
    const samples = [];
    const batchSize = 100;

    for (let i = 0; i < maxSamples; i += batchSize) {
      if (Date.now() - startTime > timeout * 0.5) {
        // Use at most half the timeout for seeding
        break;
      }

      const batchEnd = Math.min(i + batchSize, maxSamples);
      for (let j = i; j < batchEnd; j++) {
        try {
          const state = this.#stateGenerator.generateInRegime
            ? this.#stateGenerator.generateInRegime(constraints)
            : this.#stateGenerator.generate(constraints);

          const score = this.#scoreState(state, expression);
          samples.push({ state, score });
        } catch {
          // Skip invalid state generation
        }
      }
    }

    // Sort by score descending
    return samples.sort((a, b) => b.score - a.score);
  }

  /**
   * Score state by fraction of clauses passing
   * @param {Object} state
   * @param {Object} expression
   * @returns {number}
   */
  #scoreState(state, expression) {
    try {
      const result = this.#expressionEvaluator.evaluateWithTracking
        ? this.#expressionEvaluator.evaluateWithTracking(expression, state)
        : this.#evaluateWithBasicTracking(expression, state);

      if (result.totalClauses === 0) return 0;
      return result.clausesPassing / result.totalClauses;
    } catch {
      return 0;
    }
  }

  /**
   * Fallback evaluation when evaluator doesn't have tracking
   * @param {Object} expression
   * @param {Object} state
   * @returns {{clausesPassing: number, totalClauses: number, clauseResults: Array}}
   */
  #evaluateWithBasicTracking(expression, state) {
    const result = this.#expressionEvaluator.evaluate(expression, state);
    // If only boolean result, can't determine clause breakdown
    if (typeof result === 'boolean') {
      return {
        clausesPassing: result ? 1 : 0,
        totalClauses: 1,
        clauseResults: [],
      };
    }
    return result;
  }

  /**
   * @param {{state: Object, score: number}} seed
   * @param {Object} expression
   * @param {Object} constraints
   * @param {number} remainingTime
   * @returns {Promise<{state: Object, score: number}>}
   */
  async #hillClimb(seed, expression, constraints, remainingTime) {
    let current = { ...seed };
    const deadline = Date.now() + remainingTime;
    const iterations = this.#config.hillClimbIterations;

    for (let i = 0; i < iterations; i++) {
      if (Date.now() > deadline) break;

      // Already found perfect state
      if (current.score >= 1.0) break;

      const neighbor = this.#perturbState(current.state, constraints);
      const neighborScore = this.#scoreState(neighbor, expression);

      if (neighborScore > current.score) {
        current = { state: neighbor, score: neighborScore };
      }
    }

    return current;
  }

  /**
   * @param {Object} state
   * @param {Object} constraints
   * @returns {Object}
   */
  #perturbState(state, constraints) {
    const perturbed = JSON.parse(JSON.stringify(state));
    const numericPaths = this.#getNumericPaths(perturbed);

    if (numericPaths.length === 0) return perturbed;

    // Perturb random numeric field
    const pathToPerturb = numericPaths[Math.floor(Math.random() * numericPaths.length)];
    const delta = (Math.random() - 0.5) * 2 * this.#config.perturbationDelta;

    this.#applyPerturbation(perturbed, pathToPerturb, delta, constraints);
    return perturbed;
  }

  /**
   * Get all paths to numeric values in state
   * @param {Object} obj
   * @param {string} prefix
   * @returns {string[]}
   */
  #getNumericPaths(obj, prefix = '') {
    const paths = [];

    for (const [key, value] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${key}` : key;

      if (typeof value === 'number') {
        paths.push(path);
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        paths.push(...this.#getNumericPaths(value, path));
      }
    }

    return paths;
  }

  /**
   * @param {Object} obj
   * @param {string} path
   * @param {number} delta
   * @param {Object} constraints
   */
  #applyPerturbation(obj, path, delta, constraints) {
    const parts = path.split('.');
    let current = obj;

    for (let i = 0; i < parts.length - 1; i++) {
      current = current[parts[i]];
      if (!current) return;
    }

    const lastKey = parts[parts.length - 1];
    const oldValue = current[lastKey];

    if (typeof oldValue !== 'number') return;

    let newValue = oldValue + delta;

    // Apply constraints if available
    const constraintKey = path.replace(/\./g, '_');
    if (constraints) {
      const min = constraints[`${constraintKey}_min`] ?? constraints.min ?? -Infinity;
      const max = constraints[`${constraintKey}_max`] ?? constraints.max ?? Infinity;
      newValue = Math.max(min, Math.min(max, newValue));
    }

    // Apply common bounds (emotions 0-1, axes -100 to 100)
    if (path.includes('emotions') || path.includes('sexual')) {
      newValue = Math.max(0, Math.min(1, newValue));
    } else if (path.includes('Axes') || path.includes('axes')) {
      newValue = Math.max(-100, Math.min(100, newValue));
    }

    current[lastKey] = newValue;
  }

  /**
   * @param {Array<{state: Object, score: number}>} candidates
   * @returns {{state: Object, score: number}}
   */
  #selectBest(candidates) {
    return candidates.reduce(
      (best, c) => (c.score > best.score ? c : best),
      { state: null, score: -1 }
    );
  }

  /**
   * @param {{state: Object, score: number}} best
   * @param {Object} expression
   * @returns {{blockingClauses: BlockingClauseInfo[], adjustments: ThresholdAdjustment[]}}
   */
  #analyzeBlockers(best, expression) {
    if (!best.state) {
      return { blockingClauses: [], adjustments: [] };
    }

    const result = this.#expressionEvaluator.evaluateWithTracking
      ? this.#expressionEvaluator.evaluateWithTracking(expression, best.state)
      : this.#evaluateWithBasicTracking(expression, best.state);

    const clauseResults = result.clauseResults ?? [];

    const blocking = clauseResults
      .filter((c) => !c.passed)
      .map((c) => ({
        clauseId: c.clauseId ?? c.id ?? 'unknown',
        clauseDescription: c.description ?? 'Unknown clause',
        observedValue: c.actualValue ?? c.observed ?? 0,
        threshold: c.threshold ?? 0,
        gap: (c.threshold ?? 0) - (c.actualValue ?? c.observed ?? 0),
      }));

    const adjustments = blocking.map((b) => ({
      clauseId: b.clauseId,
      currentThreshold: b.threshold,
      suggestedThreshold: b.observedValue,
      delta: b.observedValue - b.threshold,
      confidence: Math.abs(b.gap) < 0.05 ? 'high' : Math.abs(b.gap) < 0.15 ? 'medium' : 'low',
    }));

    // Sort by smallest absolute delta first
    adjustments.sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta));

    return { blockingClauses: blocking, adjustments };
  }

  /**
   * @param {number} startTime
   * @param {string} reason
   * @returns {WitnessSearchResult}
   */
  #buildEmptyResult(startTime, reason) {
    this.#logger.debug(`ConstructiveWitnessSearcher: Empty result - ${reason}`);
    return {
      found: false,
      bestCandidateState: null,
      andBlockScore: 0,
      blockingClauses: [],
      minimalAdjustments: [],
      searchStats: {
        samplesEvaluated: 0,
        hillClimbIterations: 0,
        timeMs: Date.now() - startTime,
      },
    };
  }

  /**
   * @param {{state: Object, score: number}} best
   * @param {number} startTime
   * @returns {WitnessSearchResult}
   */
  #buildTimeoutResult(best, startTime) {
    this.#logger.debug('ConstructiveWitnessSearcher: Returning timeout result');
    return {
      found: best && best.score >= this.#config.minAndBlockScore,
      bestCandidateState: best?.state ?? null,
      andBlockScore: best?.score ?? 0,
      blockingClauses: [],
      minimalAdjustments: [],
      searchStats: {
        samplesEvaluated: 0,
        hillClimbIterations: 0,
        timeMs: Date.now() - startTime,
      },
    };
  }
}

export default ConstructiveWitnessSearcher;
```

### DI Registration

Add to `expressionDiagnosticsRegistrations.js`:

```javascript
import ConstructiveWitnessSearcher from '../expressionDiagnostics/services/ConstructiveWitnessSearcher.js';

// In registerExpressionDiagnosticsServices():
registrar.singletonFactory(
  diagnosticsTokens.IConstructiveWitnessSearcher,
  (c) =>
    new ConstructiveWitnessSearcher({
      logger: c.resolve(tokens.ILogger),
      stateGenerator: c.resolve(diagnosticsTokens.IRandomStateGenerator),
      expressionEvaluator: c.resolve(diagnosticsTokens.IMonteCarloExpressionEvaluator),
    })
);
```

## Acceptance Criteria

### Tests That Must Pass

```bash
# Type checking
npm run typecheck

# Linting
npx eslint src/expressionDiagnostics/services/ConstructiveWitnessSearcher.js
npx eslint src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js

# Service can be instantiated (with mocks)
node -e "
const ConstructiveWitnessSearcher = require('./src/expressionDiagnostics/services/ConstructiveWitnessSearcher.js').default;
const mockGen = { generateInRegime: () => ({ emotions: { joy: 0.5 } }), generate: () => ({}) };
const mockEval = { evaluateWithTracking: () => ({ clausesPassing: 1, totalClauses: 2, clauseResults: [] }), evaluate: () => true };
const searcher = new ConstructiveWitnessSearcher({ logger: console, stateGenerator: mockGen, expressionEvaluator: mockEval });
console.log('Service instantiated:', typeof searcher.search === 'function');
"
```

### Invariants That Must Remain True

1. `search()` must return valid `WitnessSearchResult` structure
2. Search must respect timeout configuration
3. AND block score must be in range [0, 1]
4. Minimal adjustments must be sorted by smallest delta first
5. Empty/invalid input must return empty result, not throw
6. State perturbations must respect domain bounds (emotions 0-1, axes -100 to 100)

## Verification Commands

```bash
# Verify service file exists
ls -la src/expressionDiagnostics/services/ConstructiveWitnessSearcher.js

# Verify DI registration
grep -n "IConstructiveWitnessSearcher" src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js

# Full validation
npm run typecheck
npx eslint src/expressionDiagnostics/services/ConstructiveWitnessSearcher.js
```

## Estimated Diff Size

- `ConstructiveWitnessSearcher.js`: ~400 lines (new file)
- `expressionDiagnosticsRegistrations.js`: ~10 lines added

**Total**: ~410 lines

## Definition of Done

- [ ] `ConstructiveWitnessSearcher.js` created with full implementation
- [ ] Service registered in DI container with proper dependencies
- [ ] `npm run typecheck` passes
- [ ] ESLint passes
- [ ] Service can be instantiated with mock dependencies
- [ ] `search()` returns valid structure with blocking clauses and adjustments
