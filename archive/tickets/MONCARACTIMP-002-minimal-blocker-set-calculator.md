# MONCARACTIMP-002: MinimalBlockerSetCalculator Service

## Summary

Implement the `MinimalBlockerSetCalculator` service that identifies the 1-3 dominant blockers from expressions with many clauses (often 10-20+).

## Priority

HIGH

## Effort

Medium (~200 LOC)

## Dependencies

- MONCARACTIMP-001 (Configuration & Type Definitions)

## Rationale

For AND-heavy expressions, users don't want 19 lines of statistics—they want the 1-3 clauses that actually matter. This service distinguishes "Core blockers" (tune these first) from "Non-core constraints" (already passing, don't worry about).

## Files to Create

| File | Change Type | Description |
|------|-------------|-------------|
| `src/expressionDiagnostics/services/MinimalBlockerSetCalculator.js` | CREATE | Service implementation |

## Files to Modify

| File | Change Type | Description |
|------|-------------|-------------|
| `src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js` | MODIFY | Register the service |

## Out of Scope

- Unit tests (MONCARACTIMP-003)
- Integration with report generators (MONCARACTIMP-013)
- Report formatting/output (MONCARACTIMP-014)
- OR block analysis (separate service)
- Constructive witness search (separate service)

## Implementation Details

### Algorithm Overview

1. **Collect Metrics** for each clause:
   - `lastMileFailRate`: Failure rate when ALL other clauses pass
   - `impactScore`: Estimated Δ trigger rate if this clause were removed
   - `inRegimePassRate`: Pass rate within mood regime

2. **Compute Composite Score**:
   ```
   compositeScore = (impactWeight × impactScore) + (lastMileWeight × lastMileRate)
   ```
   Default weights: `impactWeight = 0.6`, `lastMileWeight = 0.4`

3. **Classify Clauses**:
   - **Core Blocker**: Top K clauses by composite score (K ∈ {1, 2, 3})
   - **Non-Core Constraint**: Clauses with `inRegimePassRate >= 0.95`

4. **Select Core Count**:
   - Start with K=1
   - Add clause to core if it explains ≥15% of remaining failures
   - Stop at K=3 or when marginal explanatory power < 5%

### Service Implementation

```javascript
// src/expressionDiagnostics/services/MinimalBlockerSetCalculator.js

/**
 * @file MinimalBlockerSetCalculator - Identifies dominant blockers from clause data
 * @see specs/monte-carlo-actionability-improvements.md
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { actionabilityConfig } from '../config/actionabilityConfig.js';

/** @typedef {import('../config/actionabilityConfig.js').DominantCoreResult} DominantCoreResult */
/** @typedef {import('../config/actionabilityConfig.js').BlockerInfo} BlockerInfo */

class MinimalBlockerSetCalculator {
  #config;
  #logger;

  /**
   * @param {Object} deps
   * @param {Object} deps.logger - Logger instance
   * @param {Object} [deps.config] - Optional config override
   */
  constructor({ logger, config = actionabilityConfig.minimalBlockerSet }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });

    this.#logger = logger;
    this.#config = config;
  }

  /**
   * Identifies the dominant blockers from clause data
   * @param {Object[]} clauses - Array of clause objects with tracking data
   * @param {Object} simulationResult - Full simulation result for context
   * @returns {DominantCoreResult}
   */
  calculate(clauses, simulationResult) {
    if (!Array.isArray(clauses) || clauses.length === 0) {
      this.#logger.debug('MinimalBlockerSetCalculator: No clauses to analyze');
      return {
        coreBlockers: [],
        nonCoreConstraints: [],
        compositeScores: new Map(),
      };
    }

    const scored = this.#scoreAllClauses(clauses, simulationResult);
    const ranked = this.#rankByCompositeScore(scored);
    const core = this.#selectCoreBlockers(ranked, simulationResult);
    const nonCore = this.#classifyNonCore(ranked, core);

    this.#logger.debug(
      `MinimalBlockerSetCalculator: Found ${core.length} core blockers, ${nonCore.length} non-core constraints`
    );

    return {
      coreBlockers: core,
      nonCoreConstraints: nonCore,
      compositeScores: new Map(scored.map((s) => [s.clauseId, s.compositeScore])),
    };
  }

  /**
   * @param {Object[]} clauses
   * @param {Object} result
   * @returns {Object[]}
   */
  #scoreAllClauses(clauses, result) {
    return clauses.map((clause) => {
      const lastMileRate = this.#extractLastMileRate(clause);
      const impactScore = this.#estimateImpact(clause, result);
      const inRegimePassRate = this.#extractInRegimePassRate(clause);

      return {
        clauseId: clause.id ?? clause.clauseId ?? `clause_${clauses.indexOf(clause)}`,
        clauseDescription: clause.description ?? 'Unknown clause',
        lastMileRate,
        impactScore,
        inRegimePassRate,
        compositeScore: this.#computeComposite(lastMileRate, impactScore),
        originalClause: clause,
      };
    });
  }

  /**
   * @param {number} lastMileRate
   * @param {number} impactScore
   * @returns {number}
   */
  #computeComposite(lastMileRate, impactScore) {
    const { impactWeight, lastMileWeight } = this.#config;
    return impactWeight * impactScore + lastMileWeight * lastMileRate;
  }

  /**
   * @param {Object} clause
   * @returns {number}
   */
  #extractLastMileRate(clause) {
    // lastMileFailRate: when all OTHER clauses pass, how often does THIS one fail?
    if (typeof clause.lastMileFailRate === 'number') {
      return clause.lastMileFailRate;
    }
    // Fallback: compute from lastMileFailCount / othersPassedCount
    if (clause.lastMileFailCount != null && clause.othersPassedCount != null) {
      return clause.othersPassedCount > 0
        ? clause.lastMileFailCount / clause.othersPassedCount
        : 0;
    }
    return 0;
  }

  /**
   * @param {Object} clause
   * @returns {number}
   */
  #extractInRegimePassRate(clause) {
    if (typeof clause.inRegimePassRate === 'number') {
      return clause.inRegimePassRate;
    }
    if (clause.inRegimeEvaluationCount > 0) {
      const passes = clause.inRegimeEvaluationCount - (clause.inRegimeFailureCount ?? 0);
      return passes / clause.inRegimeEvaluationCount;
    }
    return 1.0; // Default to passing if unknown
  }

  /**
   * Estimate impact score (ablation impact)
   * @param {Object} clause
   * @param {Object} result
   * @returns {number}
   */
  #estimateImpact(clause, result) {
    // Impact = contribution to overall failure rate
    // Approximation: failure rate of this clause × correlation factor
    const clauseFailRate = 1 - this.#extractInRegimePassRate(clause);
    const lastMile = this.#extractLastMileRate(clause);

    // If this clause has high last-mile rate, it's likely the bottleneck
    // Impact ≈ lastMileRate when others are mostly passing
    // Weight by failure rate to avoid over-counting easy clauses
    return Math.min(1.0, clauseFailRate * 0.5 + lastMile * 0.5);
  }

  /**
   * @param {Object[]} scored
   * @returns {Object[]}
   */
  #rankByCompositeScore(scored) {
    return [...scored].sort((a, b) => b.compositeScore - a.compositeScore);
  }

  /**
   * @param {Object[]} ranked
   * @param {Object} _result
   * @returns {BlockerInfo[]}
   */
  #selectCoreBlockers(ranked, _result) {
    const core = [];
    let remainingExplanation = 1.0;

    for (const clause of ranked) {
      if (core.length >= this.#config.maxCoreBlockers) break;

      // Skip clauses that are already mostly passing
      if (clause.inRegimePassRate >= this.#config.nonCorePassRateThreshold) {
        continue;
      }

      const marginalExplanation =
        remainingExplanation > 0 ? clause.impactScore / remainingExplanation : 0;

      // After first blocker, require meaningful marginal contribution
      if (core.length > 0 && marginalExplanation < this.#config.minMarginalExplanation) {
        break;
      }

      core.push({
        clauseId: clause.clauseId,
        clauseDescription: clause.clauseDescription,
        lastMileRate: clause.lastMileRate,
        impactScore: clause.impactScore,
        compositeScore: clause.compositeScore,
        inRegimePassRate: clause.inRegimePassRate,
        classification: 'core',
      });

      remainingExplanation -= clause.impactScore;
      remainingExplanation = Math.max(0, remainingExplanation);
    }

    return core;
  }

  /**
   * @param {Object[]} ranked
   * @param {BlockerInfo[]} core
   * @returns {BlockerInfo[]}
   */
  #classifyNonCore(ranked, core) {
    const coreIds = new Set(core.map((c) => c.clauseId));

    return ranked
      .filter((c) => !coreIds.has(c.clauseId))
      .filter((c) => c.inRegimePassRate >= this.#config.nonCorePassRateThreshold)
      .map((c) => ({
        clauseId: c.clauseId,
        clauseDescription: c.clauseDescription,
        lastMileRate: c.lastMileRate,
        impactScore: c.impactScore,
        compositeScore: c.compositeScore,
        inRegimePassRate: c.inRegimePassRate,
        classification: 'non-core',
      }));
  }
}

export default MinimalBlockerSetCalculator;
```

### DI Registration

Add to `expressionDiagnosticsRegistrations.js`:

```javascript
import MinimalBlockerSetCalculator from '../expressionDiagnostics/services/MinimalBlockerSetCalculator.js';

// In registerExpressionDiagnosticsServices():
registrar.singletonFactory(
  diagnosticsTokens.IMinimalBlockerSetCalculator,
  (c) =>
    new MinimalBlockerSetCalculator({
      logger: c.resolve(tokens.ILogger),
    })
);
```

## Acceptance Criteria

### Tests That Must Pass

```bash
# Type checking
npm run typecheck

# Linting
npx eslint src/expressionDiagnostics/services/MinimalBlockerSetCalculator.js
npx eslint src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js

# Service can be instantiated
node -e "
const MinimalBlockerSetCalculator = require('./src/expressionDiagnostics/services/MinimalBlockerSetCalculator.js').default;
const calc = new MinimalBlockerSetCalculator({ logger: console });
console.log('Service instantiated:', typeof calc.calculate === 'function');
"
```

### Invariants That Must Remain True

1. `calculate()` must return valid `DominantCoreResult` structure
2. Core blockers count must never exceed `maxCoreBlockers` (default 3)
3. Non-core constraints must have `inRegimePassRate >= nonCorePassRateThreshold`
4. Empty clause array must return empty result, not throw
5. Existing DI registrations must not be affected

## Verification Commands

```bash
# Verify service file exists
ls -la src/expressionDiagnostics/services/MinimalBlockerSetCalculator.js

# Verify DI registration
grep -n "IMinimalBlockerSetCalculator" src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js

# Full validation
npm run typecheck
npx eslint src/expressionDiagnostics/services/MinimalBlockerSetCalculator.js
```

## Estimated Diff Size

- `MinimalBlockerSetCalculator.js`: ~200 lines (new file)
- `expressionDiagnosticsRegistrations.js`: ~8 lines added

**Total**: ~210 lines

## Definition of Done

- [ ] `MinimalBlockerSetCalculator.js` created with full implementation
- [ ] Service registered in DI container
- [ ] `npm run typecheck` passes
- [ ] ESLint passes
- [ ] Service can be instantiated and `calculate()` returns valid structure
