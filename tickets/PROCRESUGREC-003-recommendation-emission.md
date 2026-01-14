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
| `src/expressionDiagnostics/services/RecommendationEvidenceBuilder.js` | **Update** (if evidence helpers exist) |
| `src/expressionDiagnostics/types/recommendations.js` | **Update** (if schema/typing exists) |
| `tests/unit/expressionDiagnostics/services/recommendationEngine.test.js` | **Update** |

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

- [ ] New recommendation type emitted under specified conditions.
- [ ] Evidence entries include gap, best existing, proposed fit, delta, target signature, and anchor prototype (if any).
- [ ] Confidence and severity mapping follow spec.
- [ ] Spam brake suppresses emission when required.
- [ ] Unit tests cover A/B/C paths and non-emission cases.
