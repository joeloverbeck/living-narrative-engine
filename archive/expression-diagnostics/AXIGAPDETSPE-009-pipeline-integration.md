# AXIGAPDETSPE-009: Integrate AxisGapAnalyzer into V3 Pipeline

## Description

Integrate the AxisGapAnalyzer into the PrototypeOverlapAnalyzer as Stage C.5 (post-classification, pre-recommendation). This enables axis gap detection as part of the standard V3 analysis pipeline.

## Files to Modify

- `src/expressionDiagnostics/services/PrototypeOverlapAnalyzer.js`
  - Add optional `axisGapAnalyzer` dependency to constructor
  - Add Stage C.5 execution after classification loop
  - Include `axisGapAnalysis` in return object
  - Add progress reporting for axis gap analysis phase

- `src/dependencyInjection/registrations/prototypeOverlapRegistrations.js`
  - Update PrototypeOverlapAnalyzer registration to inject AxisGapAnalyzer

- `tests/unit/expressionDiagnostics/services/prototypeOverlapAnalyzer.test.js`
  - Add tests for new axisGapAnalyzer dependency
  - Add tests for axisGapAnalysis in return object

- `tests/integration/expressionDiagnostics/prototypeOverlap/prototypeOverlapAnalyzer.integration.test.js`
  - Add tests for V3 pipeline with axis gap detection

## Files to Create

- `tests/integration/expressionDiagnostics/axisGapDetection.integration.test.js`
  - Full integration tests for axis gap detection feature
  - Historical validation test (confusion → uncertainty axis)

- `tests/performance/expressionDiagnostics/axisGapAnalysisPerformance.performance.test.js`
  - Performance tests for axis gap analysis

## Out of Scope

- AxisGapAnalyzer implementation (AXIGAPDETSPE-003 through 008)
- UI integration (AXIGAPDETSPE-010)
- Config properties (AXIGAPDETSPE-001)
- DI token (AXIGAPDETSPE-002)
- Modifying Stage A, B, C, or D logic
- Changing the V2 pipeline behavior

## Implementation Details

### Constructor Update

```javascript
constructor({
  // ... existing deps ...
  axisGapAnalyzer = null, // NEW: optional dependency
}) {
  // ... existing validation ...

  // Axis gap analyzer is optional
  if (axisGapAnalyzer) {
    validateDependency(axisGapAnalyzer, 'IAxisGapAnalyzer', logger, {
      requiredMethods: ['analyze'],
    });
  }

  this.#axisGapAnalyzer = axisGapAnalyzer;
}
```

### Stage C.5 Integration

After the Stage C classification loop and before Stage D recommendation building:

```javascript
// Stage C.5: Axis Gap Detection (V3 only)
let axisGapAnalysis = null;
if (this.#config.enableAxisGapDetection && this.#axisGapAnalyzer && isV3Mode) {
  onProgress?.('analyzing_axis_gaps', {
    phase: 'start',
    stageNumber: 4.5,
    totalStages: 5,
  });

  axisGapAnalysis = this.#axisGapAnalyzer.analyze(
    prototypes,
    outputVectors,
    profiles,
    classifiedResults,
    (phase, details) => {
      onProgress?.('analyzing_axis_gaps', { phase, ...details });
    }
  );
}
```

### Return Object Update

```javascript
return {
  recommendations: [...],
  nearMisses: [...],
  metadata: {
    // ... existing metadata ...
    analysisMode: isV3Mode ? 'v3' : 'v2',
  },
  // NEW: Axis gap analysis results (null if not performed)
  axisGapAnalysis,
};
```

### DI Registration Update

```javascript
registrar.singletonFactory(
  diagnosticsTokens.IPrototypeOverlapAnalyzer,
  (c) =>
    new PrototypeOverlapAnalyzer({
      // ... existing deps ...
      // Add axis gap analyzer
      axisGapAnalyzer: c.resolve(diagnosticsTokens.IAxisGapAnalyzer),
    })
);
```

## Acceptance Criteria

### Tests That Must Pass

1. **prototypeOverlapAnalyzer.test.js** - new tests:
   - `should accept optional axisGapAnalyzer dependency`
   - `should work without axisGapAnalyzer (backward compatible)`
   - `should include axisGapAnalysis in V3 mode results`
   - `should not include axisGapAnalysis in V2 mode results`
   - `should not call axisGapAnalyzer when enableAxisGapDetection is false`
   - `should report progress for analyzing_axis_gaps stage`

2. **prototypeOverlapAnalyzer.integration.test.js** - new tests:
   - `should include axisGapAnalysis in full V3 pipeline`
   - `should return null axisGapAnalysis when feature disabled`

3. **axisGapDetection.integration.test.js** - new file:
   - `should detect missing uncertainty axis in historical prototypes`
     - Use pre-uncertainty prototypes (confusion, perplexity, doubt, curiosity)
     - Verify recommendation includes NEW_AXIS type
     - Verify affectedPrototypes includes expected IDs
   - `should not flag false positives for well-differentiated prototypes`
     - Use current well-tuned prototypes
     - Verify `pcaAnalysis.residualVarianceRatio < 0.15`
   - `should complete full pipeline with axis gap analysis`
     - Run full V3 pipeline
     - Verify `axisGapAnalysis` is present and properly structured

4. **axisGapAnalysisPerformance.performance.test.js** - new file:
   - `PCA analysis should complete in < 100ms for 100 prototypes`
   - `Hub detection should complete in < 200ms for 5000 pairs`
   - `Full pipeline overhead should be < 15% increase`

### Invariants That Must Remain True

1. V2 pipeline behavior is unchanged (no axisGapAnalysis field)
2. V3 pipeline without axisGapAnalyzer works (backward compatible)
3. Existing tests continue to pass
4. `axisGapAnalysis` is null (not undefined) when not performed
5. Progress callback receives correct stage number (4.5)
6. Performance overhead < 15% of baseline V3 pipeline
7. `npm run typecheck` passes
8. `npx eslint src/expressionDiagnostics/services/PrototypeOverlapAnalyzer.js src/dependencyInjection/registrations/prototypeOverlapRegistrations.js` passes

## Dependencies

- AXIGAPDETSPE-008 (AxisGapAnalyzer must be fully implemented)

## Estimated Diff Size

~50 lines service changes + ~30 lines registration + ~200 lines integration tests + ~100 lines performance tests = ~380 lines total
