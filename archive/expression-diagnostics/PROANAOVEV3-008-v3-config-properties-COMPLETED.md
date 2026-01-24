# PROANAOVEV3-008: V3 Configuration Properties

## Status: COMPLETED ✅

## Summary

Add all v3-related configuration properties to `prototypeOverlapConfig.js` to externalize the hardcoded defaults in v3 services, enabling configuration-driven customization.

## Motivation

The v3 services (SharedContextPoolGenerator, AgreementMetricsCalculator, PrototypeProfileCalculator, ActionableSuggestionEngine) currently have sensible defaults hardcoded in their constructors. Adding these to the central config file allows:
1. External configuration without code changes
2. Consistency documentation of all available parameters
3. Test coverage of default values

## Assumptions Corrections (from original ticket)

### Corrected Assumptions:

1. **Axis Ranges**: The original ticket assumed all axes use `{min: -1, max: 1}`. This is incorrect:
   - Mood axes use raw values `{min: -100, max: 100}` per `MOOD_AXIS_RANGE`
   - Affect traits use `{min: 0, max: 100}` per `AFFECT_TRAIT_RANGE`
   - Sexual axes use normalized values `{min: 0, max: 1}`
   - The `ActionableSuggestionEngine` already handles this via `DEFAULT_AXIS_RANGE_BY_CATEGORY`, mapping by axis category
   - **Resolution**: Axis ranges are omitted from config since they're already correctly derived from `prototypeAxisConstants.js` by category. Adding them would create a second source of truth.

2. **Feature Flags**: The original ticket proposed `enableV3Analysis`, `useV3Classification`, `enableDataDrivenSuggestions` flags.
   - The spec states "V3 is the only analysis path; v2 code has been removed"
   - These flags serve no purpose since v3 is always enabled
   - **Resolution**: Feature flags are omitted as unnecessary.

3. **V2 Properties**: The original ticket said to remove/deprecate v2 properties.
   - The v2.1 multi-route filtering (`enableMultiRouteFiltering`) is still actively used
   - Removing v2 properties would break existing functionality
   - **Resolution**: V2 properties are retained; this ticket only adds v3 parameters.

4. **Axis List**: The ticket listed 12 axes but `self_control` is an affect trait, not a mood axis. The 10 mood axes are: valence, arousal, agency_control, threat, engagement, future_expectancy, self_evaluation, affiliation, inhibitory_control, uncertainty.

## Files to Modify

### Configuration
- `src/expressionDiagnostics/config/prototypeOverlapConfig.js`

### Unit Tests (Update)
- `tests/unit/expressionDiagnostics/config/prototypeOverlapConfig.test.js`

## Implementation Details

### Configuration Properties to Add

```javascript
{
  // === V3 Shared Context Pool (ticket 001) ===
  sharedPoolSize: 50000,                // Total contexts in pool
  enableStratifiedSampling: false,      // Stratify by mood regime (default false per service)
  stratumCount: 5,                      // Number of strata
  stratificationStrategy: 'uniform',    // 'uniform' | 'mood-regime' | 'extremes-enhanced'
  poolRandomSeed: null,                 // null for random, number for reproducible

  // === V3 Agreement Metrics (ticket 004) ===
  confidenceLevel: 0.95,                // For Wilson CI
  minSamplesForReliableCorrelation: 500, // Correlation reliability threshold

  // === V3 Classification Thresholds (ticket 010) ===
  maxMaeCoPassForMerge: 0.03,           // MAE threshold for merge
  maxRmseCoPassForMerge: 0.05,          // RMSE threshold for merge
  maxMaeGlobalForMerge: 0.08,           // Global MAE threshold for merge
  minActivationJaccardForMerge: 0.85,   // Jaccard threshold for merge
  minConditionalProbForNesting: 0.95,   // P(A|B) threshold for nesting
  minConditionalProbCILowerForNesting: 0.90, // CI lower bound for nesting
  symmetryTolerance: 0.05,              // Tolerance for symmetric P(A|B) ≈ P(B|A)
  asymmetryRequired: 0.1,               // Min asymmetry for subsumption
  maxMaeDeltaForExpression: 0.05,       // Max MAE for expression conversion
  maxExclusiveForSubsumption: 0.05,     // Max exclusive activation for subsumption

  // === V3 Prototype Profile (ticket 005) ===
  lowVolumeThreshold: 0.05,             // < 5% activation = rare
  lowNoveltyThreshold: 0.15,            // Small delta from cluster
  singleAxisFocusThreshold: 0.6,        // > 60% weight on one axis
  clusteringMethod: 'k-means',          // 'k-means' | 'hierarchical'
  clusterCount: 10,                     // Number of prototype clusters

  // === V3 Actionable Suggestions (ticket 007) ===
  minSamplesForStump: 100,              // Min samples for decision stump
  minInfoGainForSuggestion: 0.05,       // Min info gain for suggestion
  divergenceThreshold: 0.1,             // Min divergence for sample inclusion
  maxSuggestionsPerPair: 3,             // Max suggestions per pair
  minOverlapReductionForSuggestion: 0.1, // Min overlap reduction
  minActivationRateAfterSuggestion: 0.01, // Min activation after applying
}
```

Note: Axis ranges are intentionally omitted. The `ActionableSuggestionEngine` correctly derives ranges from `prototypeAxisConstants.js` via `getAxisCategory()`, ensuring the config stays in sync with the constants module.

## Out of Scope

- Implementing services that use these configs (tickets 001-007 already done)
- Modifying existing services to read from config (tickets 010-014)
- Removing/deprecating v2 properties (still in use by multi-route filtering)

## Acceptance Criteria

- [x] All v3 configuration properties added with sensible defaults
- [x] Defaults match those hardcoded in the v3 services
- [x] V2 configuration properties retained (still in use)
- [x] Unit tests cover:
  - All new v3 properties have expected defaults
  - Config structure validation
  - V3 section completeness check
- [x] `npm run typecheck` passes
- [x] `npx eslint src/expressionDiagnostics/config/prototypeOverlapConfig.js` passes

## Dependencies

None - configuration is independent.

## Estimated Complexity

Low - adding properties with defaults to match existing service constants.

## Outcome

**Implementation completed successfully.**

### Changes Made

**`src/expressionDiagnostics/config/prototypeOverlapConfig.js`:**
- Added 28 v3 configuration properties organized by service category:
  - Shared Context Pool (5): sharedPoolSize, enableStratifiedSampling, stratumCount, stratificationStrategy, poolRandomSeed
  - Agreement Metrics (2): confidenceLevel, minSamplesForReliableCorrelation
  - Classification Thresholds (10): maxMaeCoPassForMerge, maxRmseCoPassForMerge, maxMaeGlobalForMerge, minActivationJaccardForMerge, minConditionalProbForNesting, minConditionalProbCILowerForNesting, symmetryTolerance, asymmetryRequired, maxMaeDeltaForExpression, maxExclusiveForSubsumption
  - Prototype Profile (5): lowVolumeThreshold, lowNoveltyThreshold, singleAxisFocusThreshold, clusteringMethod, clusterCount
  - Actionable Suggestions (6): minSamplesForStump, minInfoGainForSuggestion, divergenceThreshold, maxSuggestionsPerPair, minOverlapReductionForSuggestion, minActivationRateAfterSuggestion
- Updated JSDoc typedef with all 28 new property definitions

**`tests/unit/expressionDiagnostics/config/prototypeOverlapConfig.test.js`:**
- Added comprehensive tests for all 28 v3 properties (~450 lines)
- Tests cover: default values, type validation, and semantic invariants
- Added v3 completeness check ensuring all properties exist
- Total: 135 tests passing

### Verification
- ESLint passes on modified files
- All 135 unit tests pass
- Defaults match values in v3 services (verified against SharedContextPoolGenerator, AgreementMetricsCalculator, PrototypeProfileCalculator, ActionableSuggestionEngine)
