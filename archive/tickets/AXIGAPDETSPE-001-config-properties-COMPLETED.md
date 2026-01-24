# AXIGAPDETSPE-001: Add Axis Gap Detection Configuration Properties

## Status

Completed

## Description

Add the configuration properties for axis gap detection to the prototype overlap config. These thresholds control the sensitivity of each detection method (PCA, hub detection, coverage gaps, multi-axis conflicts).

## Assumptions and Scope Updates

- `prototypeOverlapConfig.js` keeps the frozen config object and typedef near the top; insert new properties without line-number assumptions.
- Existing tests organize completeness checks by versioned groups (v2/v3). Add a new axis-gap property group rather than folding into the v3 completeness count unless explicitly required.
- No other runtime logic or DI wiring consumes these values in this ticket; only config and config tests are in scope.

## Files to Modify

- `src/expressionDiagnostics/config/prototypeOverlapConfig.js`
  - Add JSDoc `@property` entries to the typedef near the top of the file
  - Add new section with config properties near the end of the config object

- `tests/unit/expressionDiagnostics/config/prototypeOverlapConfig.test.js`
  - Add tests for new config properties

## Out of Scope

- Creating the AxisGapAnalyzer service (AXIGAPDETSPE-003)
- DI token creation (AXIGAPDETSPE-002)
- Any service logic that uses these config values
- Modifying any other config files
- Changing existing config property values

## Implementation Details

### Config Properties to Add

```javascript
// ========================================
// Axis Gap Detection Configuration
// ========================================

/** Enable axis gap detection in the analysis pipeline */
enableAxisGapDetection: true,

/** PCA Analysis Thresholds */
pcaResidualVarianceThreshold: 0.15,  // Flag if >15% unexplained variance
pcaKaiserThreshold: 1.0,              // Eigenvalue threshold for significance

/** Hub Prototype Detection */
hubMinDegree: 4,                      // Minimum overlap connections
hubMaxEdgeWeight: 0.9,                // Maximum edge weight (exclude near-duplicates)
hubMinNeighborhoodDiversity: 2,       // Minimum distinct clusters in neighborhood

/** Coverage Gap Detection */
coverageGapAxisDistanceThreshold: 0.6,  // Min distance from any axis
coverageGapMinClusterSize: 3,           // Min prototypes in cluster

/** Multi-Axis Conflict Detection */
multiAxisUsageThreshold: 1.5,         // IQR multiplier for "many axes"
multiAxisSignBalanceThreshold: 0.4,   // Max sign balance for "conflicting"
```

### JSDoc Typedef Additions

Add these `@property` entries to the `PrototypeOverlapConfig` typedef:

```javascript
 * @property {boolean} enableAxisGapDetection - Enable axis gap detection in pipeline
 * @property {number} pcaResidualVarianceThreshold - PCA residual variance threshold
 * @property {number} pcaKaiserThreshold - Kaiser criterion eigenvalue threshold
 * @property {number} hubMinDegree - Minimum overlap connections for hub detection
 * @property {number} hubMaxEdgeWeight - Maximum edge weight (exclude near-duplicates)
 * @property {number} hubMinNeighborhoodDiversity - Minimum clusters in neighborhood
 * @property {number} coverageGapAxisDistanceThreshold - Min distance from any axis
 * @property {number} coverageGapMinClusterSize - Min prototypes in cluster
 * @property {number} multiAxisUsageThreshold - IQR multiplier for many axes
 * @property {number} multiAxisSignBalanceThreshold - Max sign balance for conflicting
```

## Acceptance Criteria

### Tests That Must Pass

1. **prototypeOverlapConfig.test.js** - new tests:
   - `enableAxisGapDetection` should be `true` by default
   - `pcaResidualVarianceThreshold` should be `0.15`
   - `pcaKaiserThreshold` should be `1.0`
   - `hubMinDegree` should be `4`
   - `hubMaxEdgeWeight` should be `0.9`
   - `hubMinNeighborhoodDiversity` should be `2`
   - `coverageGapAxisDistanceThreshold` should be `0.6`
   - `coverageGapMinClusterSize` should be `3`
   - `multiAxisUsageThreshold` should be `1.5`
   - `multiAxisSignBalanceThreshold` should be `0.4`
   - All new properties are included in the frozen config object

### Invariants That Must Remain True

1. `PROTOTYPE_OVERLAP_CONFIG` remains frozen (`Object.isFrozen() === true`)
2. All existing config property tests continue to pass
3. All existing config property values remain unchanged
4. Config section comment follows existing pattern (`// ===...===`)

## Dependencies

None - this is the first ticket in the series.

## Estimated Diff Size

~40 lines of config code + ~50 lines of tests = ~90 lines total

## Outcome

Added axis-gap configuration defaults and JSDoc entries in `src/expressionDiagnostics/config/prototypeOverlapConfig.js`, plus unit tests for the new properties in `tests/unit/expressionDiagnostics/config/prototypeOverlapConfig.test.js`. No additional services, DI wiring, or UI changes were introduced beyond the configuration and tests described in scope.
