# EXPDIA-013: Integrate Z3 WASM and Create SmtSolver Service

## Summary

Add Z3 WASM integration for formal verification of expression satisfiability. The SMT solver can mathematically prove expressions are impossible (returning an UNSAT core showing the conflicting constraints) or find satisfying assignments when possible.

## Priority: Medium | Effort: Large

## Rationale

While static analysis and Monte Carlo provide heuristic insights, SMT solving offers formal proofs. When Z3 returns UNSAT, the expression is mathematically impossible - not just "unlikely." The unsat core precisely identifies which constraints cause the conflict.

**Note**: Z3 WASM adds ~5MB to the bundle. This feature is optional and should be lazy-loaded.

## Dependencies

- **EXPDIA-001** (AxisInterval model for constraint representation)
- **EXPDIA-005** (DI registration pattern)
- **EXPDIA-010** (WitnessState model for SAT results)

## Files to Touch

| File | Change Type |
|------|-------------|
| `package.json` | **Modify** (add z3-solver dependency) |
| `src/expressionDiagnostics/services/SmtSolver.js` | **Create** |
| `src/expressionDiagnostics/services/index.js` | **Modify** (add export) |
| `src/dependencyInjection/tokens/tokens-diagnostics.js` | **Modify** (add token) |
| `src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js` | **Modify** (add registration) |
| `tests/unit/expressionDiagnostics/services/smtSolver.test.js` | **Create** |
| `tests/integration/expressionDiagnostics/smtIntegration.integration.test.js` | **Create** |

## Out of Scope

- **DO NOT** modify existing static analysis services
- **DO NOT** create UI components - that's EXPDIA-014
- **DO NOT** implement ThresholdSuggester - that's EXPDIA-015
- **DO NOT** optimize bundle size - that's future work
- **DO NOT** implement timeout handling for solver (keep simple for MVP)

## Implementation Details

### Package.json Update

```json
{
  "dependencies": {
    "z3-solver": "^4.12.4"
  }
}
```

### SmtSolver Service

```javascript
/**
 * @file SmtSolver - Z3 WASM integration for formal verification
 * @see specs/expression-diagnostics.md Layer B
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * @typedef {Object} SmtResult
 * @property {'sat' | 'unsat' | 'unknown'} status - Satisfiability status
 * @property {object|null} model - Satisfying assignment (if SAT)
 * @property {string[]|null} unsatCore - Conflicting constraints (if UNSAT)
 * @property {number} solveTimeMs - Time to solve
 * @property {boolean} z3Available - Whether Z3 loaded successfully
 */

/**
 * @typedef {Object} Constraint
 * @property {string} name - Constraint identifier
 * @property {string} expression - SMT-LIB expression
 */

class SmtSolver {
  /** @type {object|null} */
  #z3 = null;

  /** @type {boolean} */
  #isLoading = false;

  /** @type {Promise<boolean>|null} */
  #loadPromise = null;

  /** @type {object} */
  #dataRegistry;

  /** @type {object} */
  #logger;

  /**
   * @param {Object} deps
   * @param {object} deps.dataRegistry - IDataRegistry for prototype lookups
   * @param {object} deps.logger - ILogger
   */
  constructor({ dataRegistry, logger }) {
    validateDependency(dataRegistry, 'IDataRegistry', logger, {
      requiredMethods: ['getLookupData']
    });
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'warn', 'error', 'info']
    });

    this.#dataRegistry = dataRegistry;
    this.#logger = logger;
  }

  /**
   * Check if Z3 is available
   * @returns {boolean}
   */
  get isAvailable() {
    return this.#z3 !== null;
  }

  /**
   * Lazy load Z3 WASM
   * @returns {Promise<boolean>}
   */
  async ensureLoaded() {
    if (this.#z3) return true;
    if (this.#loadPromise) return this.#loadPromise;

    this.#loadPromise = this.#loadZ3();
    return this.#loadPromise;
  }

  /**
   * Load Z3 WASM module
   * @private
   */
  async #loadZ3() {
    if (this.#isLoading) return false;
    this.#isLoading = true;

    try {
      this.#logger.info('Loading Z3 WASM solver...');
      const startTime = performance.now();

      // Dynamic import to enable lazy loading
      const { init } = await import('z3-solver');
      this.#z3 = await init();

      const loadTime = performance.now() - startTime;
      this.#logger.info(`Z3 loaded in ${loadTime.toFixed(0)}ms`);

      return true;
    } catch (err) {
      this.#logger.error('Failed to load Z3', err);
      return false;
    } finally {
      this.#isLoading = false;
    }
  }

  /**
   * Solve expression satisfiability
   * @param {object} expression - Expression to analyze
   * @returns {Promise<SmtResult>}
   */
  async solve(expression) {
    const startTime = performance.now();

    const loaded = await this.ensureLoaded();
    if (!loaded) {
      return {
        status: 'unknown',
        model: null,
        unsatCore: null,
        solveTimeMs: performance.now() - startTime,
        z3Available: false
      };
    }

    try {
      const { Context, em } = this.#z3;
      const ctx = new Context('main');

      // Build constraints from expression
      const constraints = this.#buildConstraints(ctx, expression);

      if (constraints.length === 0) {
        return {
          status: 'sat',
          model: {},
          unsatCore: null,
          solveTimeMs: performance.now() - startTime,
          z3Available: true
        };
      }

      // Create solver with unsat core tracking
      const solver = new ctx.Solver();
      solver.set('unsat_core', true);

      // Add named constraints for core extraction
      for (const { name, constraint } of constraints) {
        solver.assert(constraint);
      }

      const result = await solver.check();

      if (result === 'sat') {
        const model = solver.model();
        const assignment = this.#extractModel(ctx, model, constraints);

        return {
          status: 'sat',
          model: assignment,
          unsatCore: null,
          solveTimeMs: performance.now() - startTime,
          z3Available: true
        };
      }

      if (result === 'unsat') {
        const core = solver.unsat_core();
        const coreNames = core.map(c => c.toString());

        return {
          status: 'unsat',
          model: null,
          unsatCore: coreNames,
          solveTimeMs: performance.now() - startTime,
          z3Available: true
        };
      }

      return {
        status: 'unknown',
        model: null,
        unsatCore: null,
        solveTimeMs: performance.now() - startTime,
        z3Available: true
      };
    } catch (err) {
      this.#logger.error('SMT solving failed', err);
      return {
        status: 'unknown',
        model: null,
        unsatCore: null,
        solveTimeMs: performance.now() - startTime,
        z3Available: true
      };
    }
  }

  /**
   * Build Z3 constraints from expression prerequisites
   * @private
   */
  #buildConstraints(ctx, expression) {
    if (!expression?.prerequisites) return [];

    const constraints = [];
    const variables = new Map();

    // Create variables for mood axes
    const moodAxes = ['valence', 'energy', 'dominance', 'novelty', 'threat'];
    for (const axis of moodAxes) {
      const v = ctx.Real.const(`mood_${axis}`);
      variables.set(`mood.${axis}`, v);

      // Add bounds: [-1, 1]
      constraints.push({
        name: `bound_${axis}_low`,
        constraint: ctx.And(v.ge(-1), v.le(1))
      });
    }

    // Create variables for sexual axes
    const sexualAxes = ['sex_excitation', 'sex_inhibition', 'baseline_libido'];
    for (const axis of sexualAxes) {
      const v = ctx.Real.const(`sexual_${axis}`);
      variables.set(`sexual.${axis}`, v);

      // Add bounds: [0, 1]
      constraints.push({
        name: `bound_${axis}_low`,
        constraint: ctx.And(v.ge(0), v.le(1))
      });
    }

    // Create derived emotion variables
    this.#addEmotionConstraints(ctx, variables, constraints);

    // Create derived sexual state variables
    this.#addSexualStateConstraints(ctx, variables, constraints);

    // Add prerequisite constraints
    for (let i = 0; i < expression.prerequisites.length; i++) {
      const prereq = expression.prerequisites[i];
      const constraint = this.#logicToZ3(ctx, prereq.logic, variables);

      if (constraint) {
        constraints.push({
          name: `prereq_${i}`,
          constraint
        });
      }
    }

    return constraints;
  }

  /**
   * Add emotion intensity constraints based on prototypes
   * @private
   */
  #addEmotionConstraints(ctx, variables, constraints) {
    const lookup = this.#dataRegistry.getLookupData('core:emotion_prototypes');
    if (!lookup?.entries) return;

    for (const [id, prototype] of Object.entries(lookup.entries)) {
      if (!prototype.weights) continue;

      // Create emotion intensity variable
      const emotionVar = ctx.Real.const(`emotion_${id}`);
      variables.set(`emotions.${id}`, emotionVar);

      // Build weighted sum constraint
      // emotion = sum(weight_i * axis_i) / sum(|weight_i|)
      let weightSum = 0;
      const terms = [];

      for (const [axis, weight] of Object.entries(prototype.weights)) {
        const moodVar = variables.get(`mood.${axis}`);
        if (moodVar) {
          terms.push(moodVar.mul(weight));
          weightSum += Math.abs(weight);
        }
      }

      if (terms.length > 0 && weightSum > 0) {
        const sum = terms.reduce((a, b) => a.add(b));
        const normalized = sum.div(weightSum);

        // Clamp to [0, 1]
        const clamped = ctx.If(
          normalized.lt(0),
          ctx.Real.val(0),
          ctx.If(normalized.gt(1), ctx.Real.val(1), normalized)
        );

        constraints.push({
          name: `emotion_def_${id}`,
          constraint: emotionVar.eq(clamped)
        });
      }

      // Add gates as constraints
      if (prototype.gates) {
        for (const gate of prototype.gates) {
          const gateConstraint = this.#parseGateToZ3(ctx, gate, variables);
          if (gateConstraint) {
            constraints.push({
              name: `gate_${id}_${gate}`,
              constraint: ctx.Implies(emotionVar.gt(0), gateConstraint)
            });
          }
        }
      }
    }
  }

  /**
   * Add sexual state intensity constraints based on prototypes
   * @private
   */
  #addSexualStateConstraints(ctx, variables, constraints) {
    const lookup = this.#dataRegistry.getLookupData('core:sexual_prototypes');
    if (!lookup?.entries) return;

    for (const [id, prototype] of Object.entries(lookup.entries)) {
      if (!prototype.weights) continue;

      const stateVar = ctx.Real.const(`sexual_state_${id}`);
      variables.set(`sexualStates.${id}`, stateVar);

      let weightSum = 0;
      const terms = [];

      for (const [axis, weight] of Object.entries(prototype.weights)) {
        const axisVar = variables.get(`sexual.${axis}`);
        if (axisVar) {
          terms.push(axisVar.mul(weight));
          weightSum += Math.abs(weight);
        }
      }

      if (terms.length > 0 && weightSum > 0) {
        const sum = terms.reduce((a, b) => a.add(b));
        const normalized = sum.div(weightSum);

        const clamped = ctx.If(
          normalized.lt(0),
          ctx.Real.val(0),
          ctx.If(normalized.gt(1), ctx.Real.val(1), normalized)
        );

        constraints.push({
          name: `sexual_def_${id}`,
          constraint: stateVar.eq(clamped)
        });
      }
    }
  }

  /**
   * Convert JSON Logic to Z3 constraint
   * @private
   */
  #logicToZ3(ctx, logic, variables) {
    if (!logic || typeof logic !== 'object') return null;

    // Handle >= comparison
    if (logic['>=']) {
      const [left, right] = logic['>='];
      const leftZ3 = this.#valueToZ3(ctx, left, variables);
      const rightZ3 = this.#valueToZ3(ctx, right, variables);
      if (leftZ3 && rightZ3) {
        return leftZ3.ge(rightZ3);
      }
    }

    // Handle <= comparison
    if (logic['<=']) {
      const [left, right] = logic['<='];
      const leftZ3 = this.#valueToZ3(ctx, left, variables);
      const rightZ3 = this.#valueToZ3(ctx, right, variables);
      if (leftZ3 && rightZ3) {
        return leftZ3.le(rightZ3);
      }
    }

    // Handle AND
    if (logic.and) {
      const clauses = logic.and
        .map(c => this.#logicToZ3(ctx, c, variables))
        .filter(Boolean);
      if (clauses.length === 0) return null;
      return ctx.And(...clauses);
    }

    // Handle OR
    if (logic.or) {
      const clauses = logic.or
        .map(c => this.#logicToZ3(ctx, c, variables))
        .filter(Boolean);
      if (clauses.length === 0) return null;
      return ctx.Or(...clauses);
    }

    return null;
  }

  /**
   * Convert value reference to Z3 expression
   * @private
   */
  #valueToZ3(ctx, value, variables) {
    if (typeof value === 'number') {
      return ctx.Real.val(value);
    }

    if (typeof value === 'object' && value.var) {
      return variables.get(value.var);
    }

    return null;
  }

  /**
   * Parse gate string to Z3 constraint
   * @private
   */
  #parseGateToZ3(ctx, gateStr, variables) {
    // Parse "axis >= threshold" or "axis <= threshold"
    const match = gateStr.match(/^(\w+)\s*(>=|<=|>|<)\s*([\d.-]+)$/);
    if (!match) return null;

    const [, axis, op, thresholdStr] = match;
    const threshold = parseFloat(thresholdStr);
    const axisVar = variables.get(`mood.${axis}`);

    if (!axisVar) return null;

    switch (op) {
      case '>=': return axisVar.ge(threshold);
      case '<=': return axisVar.le(threshold);
      case '>': return axisVar.gt(threshold);
      case '<': return axisVar.lt(threshold);
      default: return null;
    }
  }

  /**
   * Extract satisfying assignment from Z3 model
   * @private
   */
  #extractModel(ctx, model, constraints) {
    const assignment = {
      mood: {},
      sexual: {},
      emotions: {},
      sexualStates: {}
    };

    // Extract mood axes
    for (const axis of ['valence', 'energy', 'dominance', 'novelty', 'threat']) {
      const decl = ctx.Real.const(`mood_${axis}`);
      const val = model.eval(decl);
      assignment.mood[axis] = parseFloat(val.toString());
    }

    // Extract sexual axes
    for (const axis of ['sex_excitation', 'sex_inhibition', 'baseline_libido']) {
      const decl = ctx.Real.const(`sexual_${axis}`);
      const val = model.eval(decl);
      assignment.sexual[axis] = parseFloat(val.toString());
    }

    return assignment;
  }
}

export default SmtSolver;
```

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:unit -- tests/unit/expressionDiagnostics/services/smtSolver.test.js --verbose
npm run test:integration -- tests/integration/expressionDiagnostics/smtIntegration.integration.test.js --verbose
```

### Unit Test Coverage Requirements

**smtSolver.test.js:**
- Constructor throws if dataRegistry is missing
- Constructor throws if logger is missing
- `isAvailable` returns false initially
- `isAvailable` returns true after load
- `ensureLoaded()` returns promise
- `ensureLoaded()` caches load result
- `solve()` returns z3Available=false if load fails
- `solve()` returns SAT for always-satisfiable expression
- `solve()` returns UNSAT for impossible expression
- `solve()` returns model for SAT result
- `solve()` returns unsatCore for UNSAT result
- `solve()` handles expressions with no prerequisites
- Constraint building handles >= comparisons
- Constraint building handles <= comparisons
- Constraint building handles AND clauses
- Constraint building handles OR clauses
- Gate constraints applied correctly

**smtIntegration.integration.test.js:**
- Z3 WASM loads successfully
- Simple SAT expression returns satisfying model
- Gate conflict expression returns UNSAT
- Intensity bound violation returns UNSAT
- Unsat core identifies conflicting constraints
- Model values are within expected bounds

### Invariants That Must Remain True

1. **Z3 lazy-loaded** - Not loaded until first use
2. **Load cached** - Only loads once per session
3. **UNSAT means impossible** - Mathematically proven
4. **Model within bounds** - All values in valid ranges
5. **Graceful degradation** - Works without Z3 (returns unknown)

## Verification Commands

```bash
# Install z3-solver
npm install z3-solver

# Run unit tests
npm run test:unit -- tests/unit/expressionDiagnostics/services/smtSolver.test.js --verbose

# Run integration tests
npm run test:integration -- tests/integration/expressionDiagnostics/smtIntegration.integration.test.js --verbose

# Type checking
npm run typecheck

# Bundle size check
npm run build && ls -la dist/*.js
```

## Definition of Done

- [ ] z3-solver added to package.json
- [ ] `SmtSolver.js` created with Z3 integration
- [ ] `services/index.js` updated with export
- [ ] DI token added to `tokens-diagnostics.js`
- [ ] Service registered in `expressionDiagnosticsRegistrations.js`
- [ ] Unit tests cover constraint building
- [ ] Integration tests verify Z3 functionality
- [ ] Lazy loading implemented
- [ ] Unsat core extraction works
- [ ] JSDoc documentation complete
- [ ] All tests pass
