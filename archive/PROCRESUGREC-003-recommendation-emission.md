# PROCRESUGREC-003: Emit Prototype Creation Recommendation

## Summary

Add recommendation emission logic to `RecommendationEngine.generate` for `prototype_create_suggestion` using the new facts, synthesis outputs, and emission rules (A/B/C + spam brake).

## Priority: High | Effort: Medium

## Rationale

This is the core feature that decides when the proposed prototype is warranted and packages the recommendation payload with evidence and predicted fit metrics.

## Dependencies

- PROCRESUGREC-001 (facts data)
- PROCRESUGREC-002 (synthesis + evaluation)

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/expressionDiagnostics/services/RecommendationEngine.js` | **Update** |
| `tests/unit/expressionDiagnostics/services/recommendationEngine.test.js` | **Update** |

> **Note**: `RecommendationEvidenceBuilder.js` and `types/recommendations.js` were originally listed but do not exist. Evidence logic is inline in `RecommendationEngine.js` and types use JSDoc.

## Out of Scope

- **DO NOT** change ordering rules for existing recommendation types
- **DO NOT** remove or alter existing mismatch/gate clamp recommendations
- **DO NOT** modify prototype evaluation logic
- **DO NOT** add persistence or auto-creation of prototypes

## Implementation Details

- Add a new recommendation object when `(A && B) || C` evaluates true, with spam brake applied.
- Anchor clause selection: choose highest-impact clause referencing a prototype; tie-break by `clauseId`.
- Use threshold `t*` from anchor clause when present, else default `0.55`.
- Candidate set: top `K=10` by combinedScore; fallback to k-nearest by distance.
- Compute usability A, improvement B, and gap C exactly per spec.
- Synthesize prototype and compute predicted fit metrics.
- Populate `why`, `evidence`, `proposedPrototype`, `predictedFit`, and `relatedClauseIds` deterministically.
- Severity: existing impact mapping; fallback to `low` when no anchor clause.
- Confidence: `high` for (A && B) or (C && B); `medium` for C with sanity thresholds; `low` otherwise (do not emit).
- Ensure ordering is deterministic with existing recommendation sorting rules.

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:unit -- tests/unit/expressionDiagnostics/services/recommendationEngine.test.js --coverage=false
```

### Invariants That Must Remain True

- Existing recommendation ordering and types remain unchanged.
- New recommendation has deterministic `id` format and stable ordering.
- Recommendation emission is reproducible for identical inputs.
- No mutation of prototypes, regimes, or stored contexts.

## Definition of Done

- [x] New recommendation type emitted under specified conditions.
- [x] Evidence entries include gap, best existing, proposed fit, delta, target signature, and anchor prototype (if any).
- [x] Confidence and severity mapping follow spec.
- [x] Spam brake suppresses emission when required.
- [x] Unit tests cover A/B/C paths and non-emission cases.

## Outcome

**Status**: ✅ Completed

### Implementation Summary

Added `prototype_create_suggestion` recommendation emission to `RecommendationEngine.generate()` with the following features:

1. **A/B/C Emission Logic**:
   - **Condition A**: No usable existing prototype (gatePassRate < 0.30 OR pAtLeastT < 0.10 OR conflictRate > 0.20)
   - **Condition B**: Proposed prototype materially improves fit (pAtLeastT delta >= 0.15)
   - **Condition C**: Gap signal detected (nearestDistance > 0.45 OR distancePercentile >= 95)
   - Emission rule: `(A && B) || C` with sanity checks

2. **Spam Brake**: Suppresses emission when nearestDistance <= 0.35 AND best.pAtLeastT >= 0.15

3. **Anchor Clause Selection**: Highest-impact clause with prototypeId, tie-break by clauseId

4. **Threshold Selection**: Uses anchor clause thresholdValue when present, defaults to 0.55

5. **Confidence Mapping**:
   - `high`: (A && B) or (C && B)
   - `medium`: C only with sanity checks passed
   - `low`: Not emitted

6. **Evidence Building**: Includes gap evidence, best existing fit, proposed fit, delta, target signature, and anchor prototype

7. **Interpolation Fix**: Added interpolation to `#getPAtLeastTFromPredicted` for threshold values not exactly matching array entries

### Files Modified

| File | Changes |
|------|---------|
| `src/expressionDiagnostics/services/RecommendationEngine.js` | Added `#buildPrototypeCreateSuggestion` and ~15 helper methods |
| `tests/unit/expressionDiagnostics/services/recommendationEngine.test.js` | Added 11 new tests covering A/B/C paths and edge cases |
| `tests/unit/dependencyInjection/expressionDiagnosticsRegistrations.test.js` | Updated service count from 11 to 12 |

### Test Results

```
PASS tests/unit/expressionDiagnostics/services/recommendationEngine.test.js
PASS tests/unit/dependencyInjection/expressionDiagnosticsRegistrations.test.js

Test Suites: 2 passed, 2 total
Tests:       42 passed, 42 total
```

### New Tests Added

1. `does not emit prototype_create_suggestion when no synthesis service is provided`
2. `emits prototype_create_suggestion when A && B (no usable prototype, strong improvement)`
3. `emits prototype_create_suggestion when C true (gap signal) and sanity passes`
4. `does not emit when usable prototype exists and C not triggered`
5. `does not emit when B fails (improvement below threshold)`
6. `does not emit when spam brake triggers`
7. `uses anchor clause threshold when present`
8. `uses default threshold 0.55 when no anchor clause`
9. `confidence is high for (A && B) or (C && B)`
10. `confidence is medium for C without B`
11. `maintains deterministic ordering with existing recommendations`
