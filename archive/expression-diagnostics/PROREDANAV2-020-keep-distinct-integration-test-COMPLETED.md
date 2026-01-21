# PROREDANAV2-020: Integration Test for KEEP_DISTINCT Classification

## Status: COMPLETED

## Description

Create an integration test verifying the keep_distinct classification works correctly for prototype pairs with disjoint gate regions or insufficient overlap.

## Files to Touch

### Create
- `tests/integration/expressionDiagnostics/prototypeOverlap/keepDistinct.integration.test.js`

## Out of Scope

- Other classification tests
- UI tests
- Performance tests

## Outcome

### Implementation Notes

The original ticket made several incorrect assumptions about the implementation that were corrected during implementation:

1. **Recommendation Generation**: The ticket assumed `keep_distinct` pairs generate recommendations that can be accessed via `result.recommendations[0]`. However, examining `PrototypeOverlapAnalyzer.js:254-260`, `keep_distinct` is NOT in the `RECOMMENDATION_TYPES` array, so these pairs never generate recommendations.

2. **Evidence Access Pattern**: The ticket references `result.recommendations[0].evidence.gateOverlap.gateOverlapRatio` but:
   - `keep_distinct` pairs don't generate recommendations
   - The correct evidence field is `evidence.gateOverlap.jaccard`, not `gateOverlapRatio`

3. **Classification Tracking**: Since keep_distinct pairs don't generate recommendations, the test verifies:
   - Classification via `result.metadata.classificationBreakdown.keepDistinct`
   - Absence of actionable recommendations when prototypes are truly disjoint

### Tests Created

| Test | Description |
|------|-------------|
| `should classify disjoint prototypes via classificationBreakdown.keepDistinct` | Verifies correct classification tracking |
| `should NOT generate recommendations for keep_distinct pairs` | Confirms keep_distinct pairs don't create recommendations |
| `should produce deterministic results` | Ensures test reliability |
| `should have valid metadata structure` | Verifies complete metadata fields |
| `should classify elation ↔ despair as disjoint` | Tests additional patterns with opposite valence |
| `should filter out pairs with opposite weight signs in Stage A` | Tests Stage A filtering behavior |

### Prototype Design

Created disjoint prototypes with mutually exclusive gate requirements:
- `freeze_like`: `threat >= 0.60`, `arousal <= 0.20` (high threat, low arousal)
- `submission_like`: `threat <= 0.30`, `dominance <= -0.30` (low threat, low dominance)

The threat gates are mutually exclusive (`>= 0.60` vs `<= 0.30`), ensuring disjoint firing regions.

### Verification

```bash
# Run the specific integration test
npm run test:integration -- --testPathPatterns=keepDistinct.integration

# All tests pass ✓
```

## Original Ticket Content

### Changes Required (From Original Ticket)

*Note: These test examples were based on incorrect assumptions about the API. The actual implementation differs - see Outcome section above.*

### Acceptance Criteria

The following were adapted based on actual implementation:

1. **Classification tracked correctly**:
   - keepDistinct count incremented in classificationBreakdown

2. **No recommendations generated**:
   - keep_distinct is NOT in RECOMMENDATION_TYPES
   - No actionable recommendations for disjoint pairs

3. **Metadata structure valid**:
   - All classificationBreakdown fields present
   - candidatePairsEvaluated and sampleCountPerPair correct

4. **Deterministic results**:
   - Same classification breakdown on repeated runs

### Invariants That Remain True

- Full pipeline executes without errors
- Keep distinct is the fallback when nothing else matches
- No false positives for merge, subsumed, nested siblings, or needs separation
- Test is deterministic

## Estimated Size

~288 lines of test code (actual)

## Dependencies

- PROREDANAV2-017 (full orchestrator integration)

## Verification Commands

```bash
# Run this specific integration test
npm run test:integration -- --testPathPatterns=keepDistinct.integration

# Run all prototypeOverlap integration tests
npm run test:integration -- --testPathPatterns=prototypeOverlap
```
