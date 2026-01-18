# MONCARACTIMP-010: EditSetGenerator Service

## Summary

Implement the `EditSetGenerator` service that generates and ranks edit proposals to achieve target trigger rate bands, using insights from MinimalBlockerSetCalculator, OrBlockAnalyzer, and validation from ImportanceSamplingValidator.

## Priority

MEDIUM

## Effort

Medium (~320 LOC)

## Dependencies

- MONCARACTIMP-001 (Configuration & Type Definitions)
- MONCARACTIMP-002 (MinimalBlockerSetCalculator)
- MONCARACTIMP-004 (OrBlockAnalyzer)
- MONCARACTIMP-008 (ImportanceSamplingValidator)

## Rationale

Content creators need concrete, validated edit recommendations to move expressions from zero-trigger to desired target bands. This service synthesizes insights from other analyzers to produce actionable, ranked edit proposals.

## Files to Create

| File | Change Type | Description |
|------|-------------|-------------|
| `src/expressionDiagnostics/services/EditSetGenerator.js` | CREATE | Service implementation |

## Files to Modify

| File | Change Type | Description |
|------|-------------|-------------|
| `src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js` | MODIFY | Register the service |

## Out of Scope

- Unit tests (MONCARACTIMP-011)
- Integration tests (MONCARACTIMP-016)
- Report formatting (MONCARACTIMP-014)
- AI/ML-based edit suggestions
- Full expression rewriting

## Implementation Details

### Edit Generation Strategy

1. **Identify blockers** via MinimalBlockerSetCalculator
2. **Analyze OR blocks** via OrBlockAnalyzer
3. **Generate candidate edits**:
   - Threshold adjustments for core blockers
   - Dead-weight removal from OR blocks
   - Combined multi-edit proposals
4. **Validate candidates** via ImportanceSamplingValidator
5. **Rank by** predicted rate proximity to target band

### Service Implementation

```javascript
// src/expressionDiagnostics/services/EditSetGenerator.js

/**
 * @file EditSetGenerator - Generates ranked edit proposals for target trigger rates
 * @see specs/monte-carlo-actionability-improvements.md
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { actionabilityConfig } from '../config/actionabilityConfig.js';

/** @typedef {import('../config/actionabilityConfig.js').RecommendedEditSet} RecommendedEditSet */
/** @typedef {import('../config/actionabilityConfig.js').EditProposal} EditProposal */
/** @typedef {import('../config/actionabilityConfig.js').SingleEdit} SingleEdit */
/** @typedef {import('../config/actionabilityConfig.js').BlockerInfo} BlockerInfo */
/** @typedef {import('../config/actionabilityConfig.js').OrBlockAnalysis} OrBlockAnalysis */

class EditSetGenerator {
  #config;
  #logger;
  #blockerCalculator;
  #orBlockAnalyzer;
  #validator;

  /**
   * @param {Object} deps
   * @param {Object} deps.logger - Logger instance
   * @param {Object} deps.blockerCalculator - MinimalBlockerSetCalculator
   * @param {Object} deps.orBlockAnalyzer - OrBlockAnalyzer
   * @param {Object} deps.validator - ImportanceSamplingValidator
   * @param {Object} [deps.config] - Optional config override
   */
  constructor({
    logger,
    blockerCalculator,
    orBlockAnalyzer,
    validator,
    config = actionabilityConfig.editSetGeneration,
  }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });
    validateDependency(blockerCalculator, 'IMinimalBlockerSetCalculator', logger, {
      requiredMethods: ['calculate'],
    });
    validateDependency(orBlockAnalyzer, 'IOrBlockAnalyzer', logger, {
      requiredMethods: ['analyze'],
    });
    validateDependency(validator, 'IImportanceSamplingValidator', logger, {
      requiredMethods: ['validate'],
    });

    this.#logger = logger;
    this.#blockerCalculator = blockerCalculator;
    this.#orBlockAnalyzer = orBlockAnalyzer;
    this.#validator = validator;
    this.#config = config;
  }

  /**
   * Generate recommended edit set for target band
   * @param {Object} simulationResult - Monte Carlo simulation result
   * @param {[number, number]} [targetBand] - Target trigger rate range
   * @returns {RecommendedEditSet}
   */
  generate(simulationResult, targetBand = this.#config.defaultTargetBand) {
    if (!simulationResult) {
      this.#logger.debug('EditSetGenerator: No simulation result provided');
      return this.#emptyResult(targetBand);
    }

    try {
      // Step 1: Identify blockers
      const blockerResult = this.#blockerCalculator.calculate(simulationResult);
      const coreBlockers = blockerResult.coreBlockers || [];

      // Step 2: Analyze OR blocks
      const orBlocks = simulationResult.orBlocks || [];
      const orAnalyses = orBlocks.map((block) =>
        this.#orBlockAnalyzer.analyze(block, simulationResult)
      );

      // Step 3: Generate candidate edits
      const candidates = this.#generateCandidates(
        coreBlockers,
        orAnalyses,
        simulationResult
      );

      this.#logger.debug(
        `EditSetGenerator: Generated ${candidates.length} candidate edits`
      );

      // Step 4: Validate and score candidates
      const validatedCandidates = this.#validateCandidates(
        candidates,
        simulationResult,
        targetBand
      );

      // Step 5: Rank and select
      const rankedProposals = this.#rankProposals(validatedCandidates, targetBand);

      // Step 6: Build result
      return this.#buildResult(rankedProposals, targetBand);
    } catch (err) {
      this.#logger.error('EditSetGenerator: Generation error', err);
      return this.#emptyResult(targetBand);
    }
  }

  /**
   * Generate candidate edit proposals
   * @param {BlockerInfo[]} coreBlockers
   * @param {OrBlockAnalysis[]} orAnalyses
   * @param {Object} simulationResult
   * @returns {EditProposal[]}
   */
  #generateCandidates(coreBlockers, orAnalyses, simulationResult) {
    const candidates = [];

    // Generate threshold edits for core blockers
    for (const blocker of coreBlockers) {
      const thresholdEdits = this.#generateThresholdEdits(blocker, simulationResult);
      candidates.push(...thresholdEdits);
    }

    // Generate OR block restructure edits
    for (const analysis of orAnalyses) {
      const orEdits = this.#generateOrBlockEdits(analysis);
      candidates.push(...orEdits);
    }

    // Generate combined edits (top blocker + OR cleanup)
    if (coreBlockers.length > 0 && orAnalyses.length > 0) {
      const combinedEdits = this.#generateCombinedEdits(
        coreBlockers,
        orAnalyses,
        simulationResult
      );
      candidates.push(...combinedEdits);
    }

    return candidates;
  }

  /**
   * Generate threshold adjustment proposals for a blocker
   * @param {BlockerInfo} blocker
   * @param {Object} simulationResult
   * @returns {EditProposal[]}
   */
  #generateThresholdEdits(blocker, simulationResult) {
    const proposals = [];
    const clause = this.#findClause(blocker.clauseId, simulationResult);

    if (!clause || typeof clause.threshold !== 'number') {
      return proposals;
    }

    const currentThreshold = clause.threshold;
    const quantiles = clause.quantiles || simulationResult.quantiles?.[blocker.clauseId];

    // Generate proposals for different target pass rates
    for (const targetRate of this.#config.targetPassRates) {
      const suggestedThreshold = this.#calculateThresholdForRate(
        currentThreshold,
        targetRate,
        quantiles
      );

      if (suggestedThreshold !== null && suggestedThreshold !== currentThreshold) {
        proposals.push({
          edits: [{
            clauseId: blocker.clauseId,
            editType: 'threshold',
            before: currentThreshold,
            after: suggestedThreshold,
            delta: suggestedThreshold - currentThreshold,
          }],
          predictedTriggerRate: 0, // Will be filled by validator
          confidenceInterval: [0, 1],
          confidence: 'low',
          validationMethod: 'importance-sampling',
          score: 0,
        });
      }
    }

    return proposals;
  }

  /**
   * Calculate threshold for target pass rate
   * @param {number} currentThreshold
   * @param {number} targetRate
   * @param {Object} [quantiles]
   * @returns {number|null}
   */
  #calculateThresholdForRate(currentThreshold, targetRate, quantiles) {
    // Use quantile data if available
    if (quantiles) {
      const percentile = Math.round((1 - targetRate) * 100);
      const key = `p${percentile}`;
      if (quantiles[key] !== undefined) {
        return quantiles[key];
      }
    }

    // Estimate based on linear interpolation
    // Assuming roughly linear relationship near threshold
    const adjustmentFactor = 1 - targetRate;
    return currentThreshold * adjustmentFactor;
  }

  /**
   * Generate OR block restructure proposals
   * @param {OrBlockAnalysis} analysis
   * @returns {EditProposal[]}
   */
  #generateOrBlockEdits(analysis) {
    const proposals = [];

    // Convert OR analysis recommendations to edit proposals
    for (const rec of analysis.recommendations || []) {
      if (rec.action === 'delete') {
        proposals.push({
          edits: [{
            clauseId: `${analysis.blockId}[${rec.targetAlternative}]`,
            editType: 'structure',
            before: 'present',
            after: 'deleted',
          }],
          predictedTriggerRate: 0,
          confidenceInterval: [0, 1],
          confidence: 'low',
          validationMethod: 'extrapolation',
          score: 0,
        });
      } else if (rec.action === 'lower-threshold' && rec.suggestedValue !== undefined) {
        const alt = analysis.alternatives[rec.targetAlternative];
        proposals.push({
          edits: [{
            clauseId: `${analysis.blockId}[${rec.targetAlternative}]`,
            editType: 'threshold',
            before: alt?._threshold ?? 0,
            after: rec.suggestedValue,
            delta: rec.suggestedValue - (alt?._threshold ?? 0),
          }],
          predictedTriggerRate: 0,
          confidenceInterval: [0, 1],
          confidence: 'low',
          validationMethod: 'importance-sampling',
          score: 0,
        });
      }
    }

    return proposals;
  }

  /**
   * Generate combined edit proposals
   * @param {BlockerInfo[]} blockers
   * @param {OrBlockAnalysis[]} orAnalyses
   * @param {Object} simulationResult
   * @returns {EditProposal[]}
   */
  #generateCombinedEdits(blockers, orAnalyses, simulationResult) {
    const proposals = [];

    // Combine top blocker threshold edit with top OR cleanup
    if (blockers.length === 0) {
      return proposals;
    }

    const topBlocker = blockers[0];
    const clause = this.#findClause(topBlocker.clauseId, simulationResult);

    if (!clause || typeof clause.threshold !== 'number') {
      return proposals;
    }

    // Find best OR block cleanup
    let bestOrEdit = null;
    for (const analysis of orAnalyses) {
      const deleteRecs = (analysis.recommendations || []).filter(r => r.action === 'delete');
      if (deleteRecs.length > 0) {
        bestOrEdit = {
          clauseId: `${analysis.blockId}[${deleteRecs[0].targetAlternative}]`,
          editType: 'structure',
          before: 'present',
          after: 'deleted',
        };
        break;
      }
    }

    if (bestOrEdit) {
      // Combine: lower threshold + remove dead weight
      const modestThreshold = clause.threshold * 0.9; // 10% reduction

      proposals.push({
        edits: [
          {
            clauseId: topBlocker.clauseId,
            editType: 'threshold',
            before: clause.threshold,
            after: modestThreshold,
            delta: modestThreshold - clause.threshold,
          },
          bestOrEdit,
        ],
        predictedTriggerRate: 0,
        confidenceInterval: [0, 1],
        confidence: 'low',
        validationMethod: 'importance-sampling',
        score: 0,
      });
    }

    return proposals;
  }

  /**
   * Validate candidates using importance sampling
   * @param {EditProposal[]} candidates
   * @param {Object} simulationResult
   * @param {[number, number]} targetBand
   * @returns {EditProposal[]}
   */
  #validateCandidates(candidates, simulationResult, targetBand) {
    const validated = [];
    const samples = simulationResult.samples || [];
    const context = this.#buildExpressionContext(simulationResult);

    const maxToValidate = Math.min(
      candidates.length,
      this.#config.maxCandidatesToValidate
    );

    for (let i = 0; i < maxToValidate; i++) {
      const candidate = candidates[i];
      const validation = this.#validator.validate(candidate, samples, context);

      validated.push({
        ...candidate,
        predictedTriggerRate: validation.estimatedRate,
        confidenceInterval: validation.confidenceInterval,
        confidence: validation.confidence,
      });
    }

    return validated;
  }

  /**
   * Rank proposals by proximity to target band
   * @param {EditProposal[]} proposals
   * @param {[number, number]} targetBand
   * @returns {EditProposal[]}
   */
  #rankProposals(proposals, targetBand) {
    const [minTarget, maxTarget] = targetBand;
    const targetCenter = (minTarget + maxTarget) / 2;

    return proposals
      .map((proposal) => {
        // Score based on distance to target band
        const rate = proposal.predictedTriggerRate;
        let score = 0;

        if (rate >= minTarget && rate <= maxTarget) {
          // In target band: high score, closer to center is better
          score = 100 - Math.abs(rate - targetCenter) * 100;
        } else if (rate < minTarget) {
          // Below target: penalize by distance
          score = 50 - (minTarget - rate) * 100;
        } else {
          // Above target: penalize by distance
          score = 50 - (rate - maxTarget) * 100;
        }

        // Boost high-confidence proposals
        if (proposal.confidence === 'high') {
          score += 10;
        } else if (proposal.confidence === 'medium') {
          score += 5;
        }

        // Penalize large edits (prefer minimal changes)
        const editMagnitude = proposal.edits.reduce((sum, e) => {
          if (e.editType === 'threshold' && typeof e.delta === 'number') {
            return sum + Math.abs(e.delta);
          }
          return sum + 0.1; // Small penalty for structure edits
        }, 0);
        score -= editMagnitude * 10;

        return { ...proposal, score };
      })
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Build final result
   * @param {EditProposal[]} rankedProposals
   * @param {[number, number]} targetBand
   * @returns {RecommendedEditSet}
   */
  #buildResult(rankedProposals, targetBand) {
    const maxProposals = this.#config.maxEditProposals;

    const primaryRecommendation = rankedProposals[0] ?? null;
    const alternativeEdits = rankedProposals.slice(1, maxProposals);

    // Identify proposals not recommended (low confidence or far from target)
    const notRecommended = rankedProposals
      .slice(maxProposals)
      .filter((p) => p.confidence === 'low' || p.score < 0)
      .map((p) => this.#describeEdit(p));

    return {
      targetBand,
      primaryRecommendation,
      alternativeEdits,
      notRecommended,
    };
  }

  /**
   * Describe an edit proposal in human-readable form
   * @param {EditProposal} proposal
   * @returns {string}
   */
  #describeEdit(proposal) {
    const descriptions = proposal.edits.map((e) => {
      if (e.editType === 'threshold') {
        return `${e.clauseId}: ${e.before} → ${e.after}`;
      }
      return `${e.clauseId}: ${e.before} → ${e.after}`;
    });
    return descriptions.join(', ');
  }

  /**
   * Find clause by ID
   * @param {string} clauseId
   * @param {Object} simulationResult
   * @returns {Object|null}
   */
  #findClause(clauseId, simulationResult) {
    const clauses = simulationResult.expression?.clauses || [];
    return clauses.find((c) => c.id === clauseId) ?? null;
  }

  /**
   * Build expression context for validator
   * @param {Object} simulationResult
   * @returns {Object}
   */
  #buildExpressionContext(simulationResult) {
    return {
      clauses: simulationResult.expression?.clauses || [],
      orBlocks: simulationResult.orBlocks || [],
    };
  }

  /**
   * Return empty result for error cases
   * @param {[number, number]} targetBand
   * @returns {RecommendedEditSet}
   */
  #emptyResult(targetBand) {
    return {
      targetBand,
      primaryRecommendation: null,
      alternativeEdits: [],
      notRecommended: [],
    };
  }
}

export default EditSetGenerator;
```

### DI Registration

Add to `expressionDiagnosticsRegistrations.js`:

```javascript
import EditSetGenerator from '../expressionDiagnostics/services/EditSetGenerator.js';

// In registerExpressionDiagnosticsServices():
registrar.singletonFactory(
  diagnosticsTokens.IEditSetGenerator,
  (c) =>
    new EditSetGenerator({
      logger: c.resolve(tokens.ILogger),
      blockerCalculator: c.resolve(diagnosticsTokens.IMinimalBlockerSetCalculator),
      orBlockAnalyzer: c.resolve(diagnosticsTokens.IOrBlockAnalyzer),
      validator: c.resolve(diagnosticsTokens.IImportanceSamplingValidator),
    })
);
```

## Acceptance Criteria

### Tests That Must Pass

```bash
# Type checking
npm run typecheck

# Linting
npx eslint src/expressionDiagnostics/services/EditSetGenerator.js
npx eslint src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js

# Service can be instantiated
node -e "
const EditSetGenerator = require('./src/expressionDiagnostics/services/EditSetGenerator.js').default;
// Note: Requires mock dependencies
console.log('Module loaded successfully');
"
```

### Invariants That Must Remain True

1. `generate()` must return valid `RecommendedEditSet` structure
2. Primary recommendation must be highest-scored proposal
3. Alternatives must be sorted by score descending
4. Edit proposals must have valid `SingleEdit[]` structure
5. Invalid input must return empty result, not throw
6. Existing DI registrations must not be affected

## Verification Commands

```bash
# Verify service file exists
ls -la src/expressionDiagnostics/services/EditSetGenerator.js

# Verify DI registration
grep -n "IEditSetGenerator" src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js

# Full validation
npm run typecheck
npx eslint src/expressionDiagnostics/services/EditSetGenerator.js
```

## Estimated Diff Size

- `EditSetGenerator.js`: ~320 lines (new file)
- `expressionDiagnosticsRegistrations.js`: ~10 lines added

**Total**: ~330 lines

## Definition of Done

- [x] `EditSetGenerator.js` created with full implementation
- [x] Service registered in DI container
- [x] `npm run typecheck` passes
- [x] ESLint passes
- [x] Service can be instantiated with mock dependencies
- [x] `generate()` returns valid structure
- [x] Integrates with MinimalBlockerSetCalculator
- [x] Integrates with OrBlockAnalyzer
- [x] Integrates with ImportanceSamplingValidator
- [x] Proposals ranked by target band proximity

## Outcome

**Status**: COMPLETED

**Date**: 2026-01-18

**Implementation Summary**:
- Created `src/expressionDiagnostics/services/EditSetGenerator.js` (~500 LOC)
- Registered service in DI container via `expressionDiagnosticsRegistrations.js`
- Created comprehensive unit tests: `tests/unit/expressionDiagnostics/services/editSetGenerator.test.js` (47 tests)

**Verification Results**:
- ESLint: Passed (0 errors)
- Unit tests: 47/47 passed
- Related service regression tests: 139/139 passed (minimalBlockerSetCalculator, orBlockAnalyzer, importanceSamplingValidator)

**Key Implementation Details**:
- Corrected method signatures from ticket assumptions:
  - `blockerCalculator.calculate(clauses, simulationResult)` - extracts clauses from multiple locations
  - `validator.validate(proposal, originalSamples, expressionContext)` - correct parameter names
- Implemented graceful degradation (returns empty result instead of throwing for invalid input)
- Comprehensive scoring algorithm with proximity to target band, confidence boost, and simplicity bonus
