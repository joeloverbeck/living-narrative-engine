# PROOVEANA-000: Configuration and DI Tokens

## Description

Create the configuration constants and DI tokens required for the Prototype Overlap Analyzer feature. This ticket establishes the foundational configuration that all subsequent PROOVEANA tickets depend on.

## Files to Create

- `src/expressionDiagnostics/config/prototypeOverlapConfig.js`

## Files to Modify

- `src/dependencyInjection/tokens/tokens-diagnostics.js`

## Out of Scope

- Service implementations
- DI registrations (PROOVEANA-006)
- Tests for config (config is just data)
- Any other files

## Implementation Details

### prototypeOverlapConfig.js

```javascript
/**
 * @file Configuration for Prototype Overlap Analysis
 * @see specs/prototype-overlap-analyzer.md
 */

export const PROTOTYPE_OVERLAP_CONFIG = Object.freeze({
  // Stage A: Candidate filtering
  activeAxisEpsilon: 0.08,
  candidateMinActiveAxisOverlap: 0.60,
  candidateMinSignAgreement: 0.80,
  candidateMinCosineSimilarity: 0.85,

  // Stage B: Behavioral sampling
  sampleCountPerPair: 8000,
  divergenceExamplesK: 5,
  dominanceDelta: 0.05,

  // Classification thresholds
  minOnEitherRateForMerge: 0.05,
  minGateOverlapRatio: 0.90,
  minCorrelationForMerge: 0.98,
  maxMeanAbsDiffForMerge: 0.03,
  maxExclusiveRateForSubsumption: 0.01,
  minCorrelationForSubsumption: 0.95,
  minDominanceForSubsumption: 0.95,

  // Safety limits
  maxCandidatePairs: 5000,
  maxSamplesTotal: 1000000,
});

export default PROTOTYPE_OVERLAP_CONFIG;
```

### DI Tokens

Add to `tokens-diagnostics.js`:

```javascript
// Prototype Overlap Analysis (PROOVEANA series)
ICandidatePairFilter: 'ICandidatePairFilter',
IBehavioralOverlapEvaluator: 'IBehavioralOverlapEvaluator',
IOverlapClassifier: 'IOverlapClassifier',
IOverlapRecommendationBuilder: 'IOverlapRecommendationBuilder',
IPrototypeOverlapAnalyzer: 'IPrototypeOverlapAnalyzer',
IPrototypeAnalysisController: 'IPrototypeAnalysisController',
```

## Acceptance Criteria

1. `PROTOTYPE_OVERLAP_CONFIG` exports frozen object with all constants matching spec values
2. All 6 tokens added to `diagnosticsTokens`
3. `npm run typecheck` passes
4. No circular imports introduced
5. Config values match spec exactly

## Invariants

- Config object is frozen (immutable)
- Token names follow existing pattern (`I` prefix, PascalCase)
- `npx eslint <created-files>` passes

## Verification Commands

```bash
npm run typecheck
npx eslint src/expressionDiagnostics/config/prototypeOverlapConfig.js \
           src/dependencyInjection/tokens/tokens-diagnostics.js
```

## Dependencies

None

## Estimated Diff Size

- New config file: ~50 lines
- Token additions: ~8 lines
- **Total: ~58 lines**
