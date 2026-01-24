# AXIGAPDETSPE-005: Implement Hub Prototype Detection Method

## Description

Implement the `#identifyHubPrototypes()` private method in AxisGapAnalyzer that finds prototypes with many moderate overlaps spanning multiple clusters. Hub prototypes are indicators of missing dimensions - they connect disparate concepts that might share an unexpressed axis.

## Assumptions Reassessed

- `AxisGapAnalyzer.analyze()` is still a stub (AXIGAPDETSPE-008), so hub detection must be testable without running the full analysis pipeline.
- Stage C classification results do not currently persist a composite score; hub detection must derive edge weights from fields available in the `pairResults` input.
- Prototype profile clustering uses `nearestClusterId` on profiles (from `PrototypeProfileCalculator`), not a bespoke cluster assignment structure.

## Files to Modify

- `src/expressionDiagnostics/services/AxisGapAnalyzer.js`
  - Replace `#identifyHubPrototypes()` stub with full implementation
  - Add any necessary private helper methods

- `tests/unit/expressionDiagnostics/services/axisGapAnalyzer.test.js`
  - Add `describe('Hub Detection', ...)` test suite

## Out of Scope

- PCA analysis implementation (AXIGAPDETSPE-004)
- Coverage gap detection implementation (AXIGAPDETSPE-006)
- Multi-axis conflict detection implementation (AXIGAPDETSPE-007)
- Report synthesis / public `analyze()` (AXIGAPDETSPE-008)
- Pipeline integration (AXIGAPDETSPE-009)
- UI integration (AXIGAPDETSPE-010)
- Modifying the pair results format from Stage C

## Implementation Details

### Algorithm

1. **Build overlap graph** from pair results
   - Nodes = prototype IDs
   - Edges = pairs with usable overlap metrics or explicit overlap score
   - Edge weights = explicit `overlapScore`/`edgeWeight` if provided, otherwise derived from available classification metrics

2. **For each prototype**, compute:
   - `degree` = number of edges (overlapping pairs)
   - `edgeWeightVariance` = variance of edge weights
   - `hubScore` = `degree × (1 - variance(edge_weights))`

3. **Compute neighborhood diversity** for each prototype:
   - Get cluster assignments from `profiles` map (`nearestClusterId`)
   - Count distinct clusters among neighbors
   - `neighborhoodDiversity` = count of distinct clusters

4. **Flag as hub** if ALL conditions met:
   - `degree >= hubMinDegree` (default: 4)
   - No edge with weight > `hubMaxEdgeWeight` (default: 0.9) - excludes near-duplicates
   - `neighborhoodDiversity >= hubMinNeighborhoodDiversity` (default: 2)

5. **Generate axis concept suggestion** from common attributes of neighbors

### Return Shape

```javascript
[
  {
    prototypeId: string,
    hubScore: number,
    overlappingPrototypes: string[],    // IDs of connected prototypes
    neighborhoodDiversity: number,       // Count of distinct clusters
    suggestedAxisConcept: string,        // e.g., "epistemic uncertainty"
  },
  // ... more hubs
]
```

### Helper Methods Needed

```javascript
#buildOverlapGraph(pairResults)       // Returns adjacency structure
#computeHubScore(nodeId, graph)       // Returns hub score
#getNeighborhoodDiversity(nodeId, graph, profiles) // Returns cluster count
#suggestAxisConcept(prototypeId, neighbors, prototypes) // Returns string
```

## Acceptance Criteria

### Tests That Must Pass

1. **Hub Detection test suite**:
   - `should flag prototypes with many moderate overlaps`
     - Create pair results with one prototype having 5 moderate-weight edges
     - Verify prototype appears in hub list
     - Verify `hubScore > 0`

   - `should not flag prototypes with single high overlap`
     - Create prototype with one edge weight > 0.9
     - Verify prototype NOT in hub list (near-duplicate exclusion)

   - `should not flag prototypes with low degree`
     - Create prototype with only 2 edges
     - Verify prototype NOT in hub list (degree < threshold)

   - `should compute neighborhood diversity correctly`
     - Create prototype connected to neighbors in 3 different clusters
     - Verify `neighborhoodDiversity === 3`

   - `should exclude prototype when neighbors are same cluster`
     - Create prototype with 5 neighbors all in same cluster
     - Verify prototype NOT in hub list (diversity < threshold)

   - `should return empty array when no pair results`
     - Pass empty pairResults array
     - Verify returns `[]`

   - `should generate meaningful axis concept suggestion`
     - Verify `suggestedAxisConcept` is non-empty string
2. **Command**:
   - `npm run test:unit -- --testPathPatterns axisGapAnalyzer.test.js --coverage=false`

### Invariants That Must Remain True

1. Method remains private (`#identifyHubPrototypes`)
2. Hub score is always non-negative
3. `neighborhoodDiversity` is always a positive integer
4. Prototypes with near-duplicate edges (weight > 0.9) are never flagged
5. `npm run typecheck` remains a required pre-push gate, but is not part of this ticket’s mandatory run list
6. `npx eslint src/expressionDiagnostics/services/AxisGapAnalyzer.js` remains a required pre-push gate, but is not part of this ticket’s mandatory run list

## Dependencies

- AXIGAPDETSPE-003 (service scaffold must exist)

## Estimated Diff Size

~180 lines of implementation + ~140 lines of tests = ~320 lines total

## Status

- [x] Completed

## Outcome

Implemented hub detection with overlap graph weighting derived from explicit scores or classification metrics, and added unit tests covering degree, near-duplicate exclusion, neighborhood diversity, and suggestion generation. No pipeline integration or analyze() changes were made, consistent with scope.
