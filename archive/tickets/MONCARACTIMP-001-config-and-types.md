# MONCARACTIMP-001: Configuration & Type Definitions

## Summary

Create the configuration file and JSDoc type definitions for all actionability features. This is the foundation ticket that other services depend on.

## Priority

HIGH

## Effort

Small (~120 LOC)

## Dependencies

None - this is the first ticket in the initiative.

## Rationale

All actionability services need shared configuration values and type definitions. Centralizing these ensures consistency and makes tuning easier.

## Files to Create

| File | Change Type | Description |
|------|-------------|-------------|
| `src/expressionDiagnostics/config/actionabilityConfig.js` | CREATE | Configuration constants for all 5 improvements |

## Files to Modify

| File | Change Type | Description |
|------|-------------|-------------|
| `src/dependencyInjection/tokens/tokens-diagnostics.js` | MODIFY | Add tokens for new services (~8 tokens) |

## Out of Scope

- Service implementations (separate tickets)
- DI registrations (done when each service is created)
- Test utilities (created in service test tickets)
- Report formatting (separate tickets)

## Implementation Details

### actionabilityConfig.js Structure

```javascript
// src/expressionDiagnostics/config/actionabilityConfig.js

/**
 * @file Configuration for Monte Carlo actionability improvements
 */

// ============================================================
// TYPE DEFINITIONS (JSDoc)
// ============================================================

/**
 * @typedef {Object} BlockerInfo
 * @property {string} clauseId - Unique clause identifier
 * @property {string} clauseDescription - Human-readable description
 * @property {number} lastMileRate - Failure rate when all others pass
 * @property {number} impactScore - Estimated Δ trigger rate if removed
 * @property {number} compositeScore - Weighted combination score
 * @property {number} inRegimePassRate - Pass rate within mood regime
 * @property {'core'|'non-core'} classification - Blocker classification
 */

/**
 * @typedef {Object} DominantCoreResult
 * @property {BlockerInfo[]} coreBlockers - Top 1-3 blockers
 * @property {BlockerInfo[]} nonCoreConstraints - High-pass-rate clauses
 * @property {Map<string, number>} compositeScores - All clause scores
 */

/**
 * @typedef {Object} WitnessSearchResult
 * @property {boolean} found - Whether a reasonable candidate was found
 * @property {Object|null} bestCandidateState - The state that came closest
 * @property {number} andBlockScore - Fraction of clauses passing
 * @property {BlockingClauseInfo[]} blockingClauses - Clauses still failing
 * @property {ThresholdAdjustment[]} minimalAdjustments - Suggested changes
 * @property {SearchStatistics} searchStats - Performance metrics
 */

/**
 * @typedef {Object} BlockingClauseInfo
 * @property {string} clauseId
 * @property {string} clauseDescription
 * @property {number} observedValue
 * @property {number} threshold
 * @property {number} gap - threshold - observedValue
 */

/**
 * @typedef {Object} ThresholdAdjustment
 * @property {string} clauseId
 * @property {number} currentThreshold
 * @property {number} suggestedThreshold
 * @property {number} delta
 * @property {'high'|'medium'|'low'} confidence
 */

/**
 * @typedef {Object} SearchStatistics
 * @property {number} samplesEvaluated
 * @property {number} hillClimbIterations
 * @property {number} timeMs
 */

/**
 * @typedef {Object} OrBlockAnalysis
 * @property {string} blockId
 * @property {string} blockDescription
 * @property {OrAlternativeAnalysis[]} alternatives
 * @property {number} deadWeightCount
 * @property {RestructureRecommendation[]} recommendations
 * @property {string} impactSummary
 */

/**
 * @typedef {Object} OrAlternativeAnalysis
 * @property {number} alternativeIndex
 * @property {string} clauseDescription
 * @property {number} exclusiveCoverage - Pass rate when ONLY this alt passes
 * @property {number} marginalContribution - Δ OR pass rate if removed
 * @property {number} overlapRatio - Fraction covered by others too
 * @property {'meaningful'|'weak'|'dead-weight'} classification
 */

/**
 * @typedef {Object} RestructureRecommendation
 * @property {'delete'|'lower-threshold'|'replace'} action
 * @property {number} targetAlternative
 * @property {number} [suggestedValue]
 * @property {string} [suggestedReplacement]
 * @property {string} rationale
 * @property {string} predictedImpact
 */

/**
 * @typedef {Object} RecommendedEditSet
 * @property {[number, number]} targetBand - [minRate, maxRate]
 * @property {EditProposal|null} primaryRecommendation
 * @property {EditProposal[]} alternativeEdits
 * @property {string[]} notRecommended
 */

/**
 * @typedef {Object} EditProposal
 * @property {SingleEdit[]} edits
 * @property {number} predictedTriggerRate
 * @property {[number, number]} confidenceInterval
 * @property {'high'|'medium'|'low'} confidence
 * @property {'importance-sampling'|'extrapolation'} validationMethod
 * @property {number} score
 */

/**
 * @typedef {Object} SingleEdit
 * @property {string} clauseId
 * @property {'threshold'|'structure'} editType
 * @property {string|number} before
 * @property {string|number} after
 * @property {number} [delta]
 */

/**
 * @typedef {Object} ValidationResult
 * @property {number} estimatedRate
 * @property {[number, number]} confidenceInterval
 * @property {'high'|'medium'|'low'} confidence
 * @property {number} sampleCount
 * @property {number} effectiveSampleSize
 */

// ============================================================
// CONFIGURATION
// ============================================================

/**
 * Configuration for Monte Carlo actionability improvements.
 * Structure matches advancedMetricsConfig.js pattern (no Object.freeze).
 *
 * @type {ActionabilityConfig}
 */
export const actionabilityConfig = {
  // A. Minimal Blocker Set
  minimalBlockerSet: {
    enabled: true,
    maxCoreBlockers: 3,
    nonCorePassRateThreshold: 0.95,
    impactWeight: 0.6,
    lastMileWeight: 0.4,
    minMarginalExplanation: 0.05,
  },

  // B. Threshold Suggestions
  thresholdSuggestions: {
    enabled: true,
    targetPassRates: [0.01, 0.05, 0.10, 0.25],
    includeInNonZeroHitCases: true,
    showAbsoluteCeiling: true,
  },

  // C. Constructive Witness Search
  witnessSearch: {
    enabled: true,
    maxSamples: 5000,
    hillClimbSeeds: 10,
    hillClimbIterations: 100,
    perturbationDelta: 0.01,
    timeoutMs: 5000,
    minAndBlockScore: 0.5,
  },

  // D. OR Block Analysis
  orBlockAnalysis: {
    enabled: true,
    deadWeightThreshold: 0.01,
    weakContributorThreshold: 0.05,
    targetExclusiveCoverage: 0.08,
    enableReplacementSuggestions: false,
  },

  // E. Edit Set Generation
  editSetGeneration: {
    enabled: true,
    defaultTargetBand: [0.0001, 0.001],
    targetPassRates: [0.01, 0.05, 0.10],
    maxCandidatesToValidate: 10,
    maxEditProposals: 5,
    importanceSampling: {
      enabled: true,
      confidenceLevel: 0.95,
    },
  },
};

export default actionabilityConfig;
```

### tokens-diagnostics.js Additions

Add after existing tokens in the appropriate section:

```javascript
// === Actionability Services (MONCARACTIMP) ===
IMinimalBlockerSetCalculator: 'IMinimalBlockerSetCalculator',
IConstructiveWitnessSearcher: 'IConstructiveWitnessSearcher',
IOrBlockAnalyzer: 'IOrBlockAnalyzer',
IEditSetGenerator: 'IEditSetGenerator',
IImportanceSamplingValidator: 'IImportanceSamplingValidator',
IActionabilitySectionGenerator: 'IActionabilitySectionGenerator',
```

## Acceptance Criteria

### Tests That Must Pass

```bash
# Type checking must pass
npm run typecheck

# Linting must pass
npx eslint src/expressionDiagnostics/config/actionabilityConfig.js
npx eslint src/dependencyInjection/tokens/tokens-diagnostics.js
```

### Invariants That Must Remain True

1. All existing tokens in `tokens-diagnostics.js` must remain unchanged
2. Existing `advancedMetricsConfig.js` must not be modified
3. Config structure follows existing pattern (plain export, no `Object.freeze()` wrapper - matching `advancedMetricsConfig.js`)
4. Token names must follow `I` prefix convention

## Verification Commands

```bash
# Verify tokens added
grep -c "IMinimalBlockerSetCalculator" src/dependencyInjection/tokens/tokens-diagnostics.js

# Full validation
npm run typecheck
npx eslint src/expressionDiagnostics/config/actionabilityConfig.js src/dependencyInjection/tokens/tokens-diagnostics.js
```

## Estimated Diff Size

- `actionabilityConfig.js`: ~110 lines (new file)
- `tokens-diagnostics.js`: ~8 lines added

**Total**: ~120 lines

## Definition of Done

- [x] `actionabilityConfig.js` created with all 5 feature configs
- [x] All JSDoc type definitions included
- [x] Config follows existing `advancedMetricsConfig.js` pattern (plain export)
- [x] 6 new tokens added to `tokens-diagnostics.js`
- [x] `npm run typecheck` passes (no new errors introduced)
- [x] ESLint passes on both files

## Outcome

**Status**: COMPLETED

**Implementation Date**: 2026-01-18

### What Was Done

1. **Created `src/expressionDiagnostics/config/actionabilityConfig.js`** (259 lines)
   - 13 JSDoc type definitions for result/data types
   - 7 JSDoc config type definitions
   - Complete configuration for all 5 actionability features (A-E)
   - ESLint-compliant with proper lowercase `object` types and property descriptions

2. **Modified `src/dependencyInjection/tokens/tokens-diagnostics.js`**
   - Added 6 new service tokens for the MONCARACTIMP initiative:
     - `IMinimalBlockerSetCalculator`
     - `IConstructiveWitnessSearcher`
     - `IOrBlockAnalyzer`
     - `IEditSetGenerator`
     - `IImportanceSamplingValidator`
     - `IActionabilitySectionGenerator`

### Discrepancy Corrections Made to Ticket

- Updated ticket to specify plain export pattern (no `Object.freeze()`) matching existing `advancedMetricsConfig.js`
- Updated invariants section to match actual codebase patterns

### Verification Results

- ESLint: ✅ Both files pass with no errors or warnings
- TypeCheck: ✅ No new errors introduced (pre-existing CLI validation errors unrelated)
- Unit Tests: ✅ 135 test suites passed (diagnostics/tokens related)

### Notes for Dependent Tickets

The foundation is now in place for:
- MONCARACTIMP-002: Minimal Blocker Set Calculator
- MONCARACTIMP-003: Constructive Witness Searcher
- Subsequent service implementation tickets
