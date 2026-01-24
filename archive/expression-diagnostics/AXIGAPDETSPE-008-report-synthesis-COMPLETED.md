# AXIGAPDETSPE-008: Implement Report Synthesis and Public analyze() Method

**Status**: ✅ COMPLETED

## Outcome

Successfully implemented the `analyze()` orchestration method and `#synthesizeReport()` private method in AxisGapAnalyzer. All 4 detection methods are now tied together to produce the final AxisGapReport with prioritized recommendations.

### Implementation Summary

- **`analyze()` method**: Replaced stub with full orchestration logic including:
  - Feature flag check (`enableAxisGapDetection`)
  - Input coercion for defensive handling (null/undefined → safe defaults)
  - Sequential calls to all 4 detection methods with progress callbacks
  - Final synthesis call to produce report

- **`#synthesizeReport()` method**: Implemented report synthesis including:
  - Method trigger counting
  - Confidence level computation (low/medium/high based on triggered methods)
  - Recommendation generation with priority rules (NEW_AXIS, INVESTIGATE, REFINE_EXISTING)
  - Priority-based recommendation sorting

- **Helper methods added**:
  - `#buildEmptyReport()` - Returns empty report structure
  - `#countTriggeredMethods()` - Counts how many detection methods produced results
  - `#computeConfidenceLevel()` - Converts method count to confidence level
  - `#generateRecommendations()` - Creates recommendations based on detection results
  - `#buildRecommendation()` - Factory for individual recommendation objects
  - `#sortRecommendationsByPriority()` - Sorts recommendations (high → medium → low)
  - `#findRelatedGap()` - Finds coverage gap related to a hub prototype
  - `#mergeUniquePrototypes()` - Deduplicates affected prototype IDs

- **Test suites added**:
  - "Report Synthesis" suite with 12 tests
  - "analyze() orchestration" suite with 10 tests

### Verification Results

- ✅ All 57 unit tests pass
- ✅ ESLint passes (no errors)
- ⚠️ Typecheck has pre-existing errors (not from this implementation)

### Files Modified

- `src/expressionDiagnostics/services/AxisGapAnalyzer.js` (~200 lines)
- `tests/unit/expressionDiagnostics/services/axisGapAnalyzer.test.js` (~180 lines)

---

## Description

Implement the `#synthesizeReport()` private method and complete the public `analyze()` method in AxisGapAnalyzer. This ticket ties together all detection methods and produces the final AxisGapReport with prioritized recommendations.

## Files to Modify

- `src/expressionDiagnostics/services/AxisGapAnalyzer.js`
  - Replace `#synthesizeReport()` stub with full implementation
  - Replace `analyze()` stub with full orchestration logic
  - Add recommendation generation helpers

- `tests/unit/expressionDiagnostics/services/axisGapAnalyzer.test.js`
  - Add `describe('Report Synthesis', ...)` test suite
  - Add `describe('analyze() orchestration', ...)` test suite

## Out of Scope

- PCA analysis implementation (AXIGAPDETSPE-004 - must be done first)
- Hub detection implementation (AXIGAPDETSPE-005 - must be done first)
- Coverage gap detection implementation (AXIGAPDETSPE-006 - must be done first)
- Multi-axis conflict detection implementation (AXIGAPDETSPE-007 - must be done first)
- Pipeline integration (AXIGAPDETSPE-009)
- UI integration (AXIGAPDETSPE-010)

## Implementation Details

### analyze() Orchestration

```javascript
analyze(prototypes, outputVectors, profiles, pairResults, onProgress) {
  if (!this.#config.enableAxisGapDetection) {
    return this.#buildEmptyReport();
  }

  onProgress?.('axis_gap_pca', { phase: 'start' });
  const pcaResult = this.#runPCAAnalysis(prototypes);

  onProgress?.('axis_gap_hubs', { phase: 'start' });
  const hubPrototypes = this.#identifyHubPrototypes(pairResults);

  onProgress?.('axis_gap_coverage', { phase: 'start' });
  const coverageGaps = this.#detectCoverageGaps(profiles);

  onProgress?.('axis_gap_conflicts', { phase: 'start' });
  const multiAxisConflicts = this.#detectMultiAxisConflicts(prototypes);

  onProgress?.('axis_gap_synthesis', { phase: 'start' });
  return this.#synthesizeReport(
    pcaResult,
    hubPrototypes,
    coverageGaps,
    multiAxisConflicts,
    prototypes
  );
}
```

### #synthesizeReport() Implementation

1. **Aggregate findings** from all detection methods
2. **Generate recommendations** based on combined evidence:
   - `NEW_AXIS`: High PCA residual + hub prototypes + coverage gaps
   - `INVESTIGATE`: Moderate signals from 2+ methods
   - `REFINE_EXISTING`: Multi-axis conflicts suggesting axis overlap
3. **Prioritize recommendations** by evidence strength
4. **Compute overall confidence** level

### Return Shape (AxisGapReport)

```javascript
{
  summary: {
    totalPrototypesAnalyzed: number,
    potentialGapsDetected: number,
    confidence: 'low' | 'medium' | 'high',
  },

  pcaAnalysis: {
    residualVarianceRatio: number,
    additionalSignificantComponents: number,
    topLoadingPrototypes: Array<{ prototypeId, loading }>,
  },

  hubPrototypes: Array<{
    prototypeId, hubScore, overlappingPrototypes,
    neighborhoodDiversity, suggestedAxisConcept,
  }>,

  coverageGaps: Array<{
    clusterId, centroidPrototypes, distanceToNearestAxis,
    suggestedAxisDirection,
  }>,

  multiAxisConflicts: Array<{
    prototypeId, activeAxisCount, signBalance,
    positiveAxes, negativeAxes,
  }>,

  recommendations: Array<{
    priority: 'high' | 'medium' | 'low',
    type: 'NEW_AXIS' | 'INVESTIGATE' | 'REFINE_EXISTING',
    description: string,
    affectedPrototypes: string[],
    evidence: string[],
  }>,
}
```

### Recommendation Priority Rules

| Condition | Priority | Type |
|-----------|----------|------|
| PCA residual > 0.15 + coverage gap | high | NEW_AXIS |
| Hub prototype + coverage gap | high | NEW_AXIS |
| PCA residual > 0.15 alone | medium | INVESTIGATE |
| Hub prototype alone | medium | INVESTIGATE |
| Coverage gap alone | medium | INVESTIGATE |
| Multi-axis conflict | low | REFINE_EXISTING |

### Confidence Level Calculation

- `high`: 3+ detection methods triggered
- `medium`: 2 detection methods triggered
- `low`: 0-1 detection methods triggered

## Acceptance Criteria

### Tests That Must Pass

1. **Report Synthesis test suite**:
   - `should generate NEW_AXIS recommendation when PCA + coverage gap`
   - `should generate INVESTIGATE recommendation for single-method signals`
   - `should generate REFINE_EXISTING for multi-axis conflicts only`
   - `should sort recommendations by priority (high → medium → low)`
   - `should include affected prototypes from all contributing methods`
   - `should include evidence strings describing each signal`
   - `should compute confidence level correctly`

2. **analyze() orchestration test suite**:
   - `should call all detection methods in sequence`
   - `should report progress at each phase`
   - `should return empty report when enableAxisGapDetection is false`
   - `should aggregate results from all methods into final report`
   - `should handle empty prototypes array gracefully`
   - `should handle empty pairResults gracefully`
   - `should handle empty profiles gracefully`

### Invariants That Must Remain True

1. `recommendations` array is always sorted by priority (high first)
2. `affectedPrototypes` contains only valid prototype IDs
3. `evidence` array is never empty for any recommendation
4. `summary.potentialGapsDetected` equals `recommendations.length`
5. `summary.confidence` is always one of 'low', 'medium', 'high'
6. When `enableAxisGapDetection` is false, returns empty report (not null)
7. All detection methods are called even if some return empty results
8. `npm run typecheck` passes
9. `npx eslint src/expressionDiagnostics/services/AxisGapAnalyzer.js` passes

## Dependencies

- AXIGAPDETSPE-004 (PCA analysis must be implemented)
- AXIGAPDETSPE-005 (Hub detection must be implemented)
- AXIGAPDETSPE-006 (Coverage gap detection must be implemented)
- AXIGAPDETSPE-007 (Multi-axis conflict detection must be implemented)

## Estimated Diff Size

~200 lines of implementation + ~180 lines of tests = ~380 lines total
