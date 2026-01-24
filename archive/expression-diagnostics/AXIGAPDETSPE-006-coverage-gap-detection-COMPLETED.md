# AXIGAPDETSPE-006: Implement Coverage Gap Detection Method

## Description

Implement the `#detectCoverageGaps()` private method in AxisGapAnalyzer that identifies prototype clusters distant from any existing axis. Clusters that don't align with known axes suggest the need for new dimensions.

## Assumptions Reassessed

- `AxisGapAnalyzer.analyze()` remains a stub (AXIGAPDETSPE-008), so coverage gap detection must be testable via test-only helpers.
- Prototype profiles include `nearestClusterId` only; cluster centroids must be derived from prototype weight vectors.
- Axis alignment should treat positive and negative directions as aligned (absolute cosine similarity), avoiding false gaps for clusters aligned with negative axis directions.

## Files to Modify

- `src/expressionDiagnostics/services/AxisGapAnalyzer.js`
  - Replace `#detectCoverageGaps()` stub with full implementation
  - Add any necessary private helper methods

- `tests/unit/expressionDiagnostics/services/axisGapAnalyzer.test.js`
  - Add `describe('Coverage Gap Detection', ...)` test suite

## Out of Scope

- PCA analysis implementation (AXIGAPDETSPE-004)
- Hub detection implementation (AXIGAPDETSPE-005)
- Multi-axis conflict detection implementation (AXIGAPDETSPE-007)
- Report synthesis / public `analyze()` (AXIGAPDETSPE-008)
- Pipeline integration (AXIGAPDETSPE-009)
- UI integration (AXIGAPDETSPE-010)
- Modifying the PrototypeProfileCalculator clustering logic

## Implementation Details

### Algorithm

1. **Get clustering** from profiles (via PrototypeProfileCalculator)
   - Profiles contain cluster assignments (`nearestClusterId`), not cluster centroids
   - Prototype weight vectors come from the prototype definitions, not profiles

2. **Compute axis unit vectors** for each mood axis
   - Unit vector for axis A has weight 1.0 for A, 0.0 for all others

3. **For each cluster**:
   - Compute cluster centroid (average of member prototype weight vectors)
   - Compute cosine distance from centroid to each axis unit vector
   - Use absolute cosine similarity to treat negative axis alignment as aligned
   - Find minimum distance (nearest axis)

4. **Flag cluster** if ALL conditions met:
   - `distanceToNearestAxis >= coverageGapAxisDistanceThreshold` (default: 0.6)
   - `clusterSize >= coverageGapMinClusterSize` (default: 3)

5. **Compute suggested axis direction** as normalized centroid vector

### Return Shape

```javascript
[
  {
    clusterId: string,
    centroidPrototypes: string[],       // IDs of prototypes in cluster
    distanceToNearestAxis: number,      // 0.0 - 1.0
    suggestedAxisDirection: {           // Normalized weight vector
      arousal: number,
      valence: number,
      // ... other axes
    },
  },
  // ... more gaps
]
```

### Helper Methods Needed

```javascript
#extractClusters(profiles)                 // Returns cluster map from profiles
#collectAxes(prototypes)                   // Returns list of axes from weights
#buildPrototypeLookup(prototypes)          // Returns id -> prototype map
#computeClusterCentroid(members, prototypes, axes) // Returns weight vector
#computeCosineDistance(vecA, vecB)         // Returns 0.0-1.0 distance
#getAxisUnitVectors(axes)                  // Returns map of axis -> unit vector
#normalizeVector(vec)                      // Returns unit vector
```

### Cosine Distance Formula

```
cosineDistance = 1 - (A · B) / (||A|| × ||B||)
```

Where `·` is dot product and `||X||` is vector magnitude.

## Acceptance Criteria

### Tests That Must Pass

1. **Coverage Gap Detection test suite**:
   - `should identify clusters distant from all axes`
     - Create cluster of 4 prototypes with centroid far from any axis
     - Verify cluster appears in coverage gaps
     - Verify `distanceToNearestAxis >= 0.6`

   - `should not flag clusters aligned with existing axis`
     - Create cluster centered near arousal axis
     - Verify cluster NOT in coverage gaps

   - `should not flag clusters smaller than threshold`
     - Create distant cluster with only 2 members
     - Verify cluster NOT in coverage gaps (size < 3)

   - `should compute cosine distance correctly`
     - Known vectors with known distance
     - Verify computed distance matches expected

   - `should compute cluster centroid correctly`
     - Cluster with 3 known prototypes
     - Verify centroid is average of weight vectors

   - `should return empty array when no profiles`
     - Pass empty profiles Map
     - Verify returns `[]`

   - `should include suggested axis direction`
     - Verify `suggestedAxisDirection` is non-null object
     - Verify direction is normalized (magnitude ≈ 1.0)

### Invariants That Must Remain True

1. Method remains private (`#detectCoverageGaps`)
2. `distanceToNearestAxis` is always between 0.0 and 1.0 (clamped)
3. `suggestedAxisDirection` is always a normalized vector (magnitude ≈ 1.0) for flagged clusters
4. `centroidPrototypes` contains only valid prototype IDs
5. Small clusters (< threshold) are never flagged regardless of distance
6. `npm run typecheck` passes
7. `npx eslint src/expressionDiagnostics/services/AxisGapAnalyzer.js` passes

## Dependencies

- AXIGAPDETSPE-003 (service scaffold must exist)

## Estimated Diff Size

~150 lines of implementation + ~130 lines of tests = ~280 lines total

## Status

- [x] Completed

## Outcome

Implemented coverage gap detection using profile-based cluster membership and prototype weights, added helpers for centroid and cosine distance calculation, and added unit tests covering detection thresholds, centroid math, cosine distance, and normalized suggested axis directions. No changes were made to pipeline integration or analyze() orchestration, consistent with scope.
