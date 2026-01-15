# Prototype Create Suggestion Recommendation

## Summary
Add a deterministic recommendation that proposes a new prototype when the expression's implied mood signature is not well covered by existing prototypes. The recommendation includes a concrete proposed prototype (name, weights, gates) and predicted fit metrics in the expression's mood regime.

## Goals
- Emit a data-driven recommendation when existing prototypes fail to represent the target signature for a mood regime.
- Provide a deterministic, reproducible proposed prototype with predicted fit metrics.
- Preserve existing report determinism and recommendation ordering.

## Non-goals
- Auto-modifying or saving prototype data.
- Generating prose-heavy, subjective naming beyond deterministic rules.
- Replacing existing prototype mismatch or gate clamp recommendations.

## Data dependencies
Extend DiagnosticFacts produced by `src/expressionDiagnostics/services/RecommendationFactsBuilder.js` with:
- `moodRegime.bounds`: normalized AND-only bounds (axis -> { min?, max? }).
- `moodRegime.sampleCount`: count of stored contexts in regime.
- `storedMoodRegimeContexts`: stored contexts filtered by the mood regime (do not include raw values outside allowed axes).
- `prototypeDefinitions`: per prototype id, include `weights` and `gates` used by evaluation (pull from simulationResult or the same source used by PrototypeFitRankingService).
- `prototypeFit`: the existing fit ranking output (leaderboard entries, combinedScore, distance, and kNearest list) from `PrototypeFitRankingService` if available.
- `gapDetection`: `nearestDistance`, `nearestDistancePercentile` (if available), and `kNearestNeighbors` from `PrototypeFitRankingService`.
- `targetSignature`: the implied prototype signature (axis + dir + importance) used by the fit ranking service. If not provided, derive it from prerequisites using the same logic used for `impliedPrototype` in the report generator.

Notes:
- The RecommendationFactsBuilder currently only receives `simulationResult`; to avoid duplication, wire `PrototypeFitRankingService` into it in the same way MonteCarloReportGenerator uses it, or pass precomputed fit analysis on `simulationResult`.
- Ensure `storedMoodRegimeContexts` is built from `simulationResult.storedContexts` using existing `extractMoodConstraints` and `filterContextsByConstraints` helpers.

## Recommendation schema
Recommendation object appended by `RecommendationEngine.generate`:
- `id`: `prototype_create_suggestion:${expressionId || 'unknown'}:${anchorClauseId || 'none'}`
- `type`: `prototype_create_suggestion`
- `title`: `Prototype creation suggested`
- `severity`: `low | medium | high`
- `confidence`: `low | medium | high`
- `why`: short, deterministic rationale (1-3 sentences).
- `evidence`: array of structured entries (see Evidence section).
- `proposedPrototype`:
  - `name`: deterministic, unique.
  - `weights`: Record<AxisName, number>.
  - `gates`: string[].
  - `derivedFrom`: `{ anchorPrototype?, targetSignature?, regimeBounds? }`.
- `predictedFit`:
  - `population`: `stored-mood-regime`
  - `N`: number
  - `gatePassRate`: number
  - `mean`: number
  - `p95`: number
  - `pAtLeastT`: Array<{ t: number; p: number }>
  - `conflicts?`: Array<{ axis: AxisName; kind: string }>
  - `comparison`: `bestExistingPrototype`, `bestExisting`, `delta`
- `relatedClauseIds`: string[]

## Emission logic
A recommendation is emitted if `(A && B) || C`:

Definitions:
- Candidate set `CAND`: top K prototypes by combinedScore from `prototypeFit.leaderboard`. Fallback: k-nearest by distance if combinedScore missing. Use `K = 10`.
- Threshold `t*`: if an anchor clause exists and has a numeric threshold, use it. Otherwise use `0.55`.

A) No usable existing prototype
- `usable(p)` if:
  - `gatePassRate >= 0.30`
  - `pAtLeastT(t*) >= 0.10`
  - `conflictRate <= 0.20` if conflictRate exists.
- A is true when no prototype in `CAND` is usable.

B) Proposed prototype materially improves fit
- Let `best` be the best existing in `CAND` by lexicographic score: `pAtLeastT(t*)`, then `gatePassRate`, then `p95`.
- Require `pAtLeastT_new(t*) - pAtLeastT_best(t*) >= 0.15`.
- If both values are `< 0.05`, require `pAtLeastT_new(t*) >= 0.10`.

C) Prototype space gap signal
- `nearestDistance > 0.45` or `nearestDistancePercentile >= 95`.
- If C holds, require sanity: `gatePassRate_new >= 0.20` and at least 3 non-zero weights.

Spam brake
- Do not emit if `nearestDistance <= 0.35` and `bestExisting.pAtLeastT(t*) >= 0.15`.

Confidence
- `high`: (A && B) or (C && B)
- `medium`: C true, B only meets sanity thresholds
- `low`: otherwise (should not emit)

Severity
- Use the existing `RecommendationEngine` impact-based severity mapping for the anchor clause impact.
- If no anchor clause, default to `low`.

## Anchor clause selection
- Choose the highest-impact clause that references a prototype (`clause.prototypeId`).
- If multiple tie, sort by `clauseId` and pick the first.

## Prototype synthesis
Deterministic algorithm:
1) Build target vector `v` from `targetSignature` (dir up => +importance, dir down => -importance). Normalize to `v_norm`.
2) If anchor prototype exists, set `w0` and `g0` from its weights/gates; else use zero vector and empty gates.
3) Blend: `w = w0 + 0.70 * v_norm`.
4) Regime conflict resolution:
   - If a regime max is very low (<= 0.10) and `w[a] > 0.25`, clamp to 0 unless target signature wants positive, then clamp to +0.10.
   - If a regime min is very high (>= -0.10) and `w[a] < -0.25`, clamp to 0 unless target signature wants negative, then clamp to -0.10.
5) Clamp weights to [-1, 1].
6) Sparsify: keep top 6 axes by abs(weight); ensure at least 3 non-zero weights.
7) Gates:
   - Start with anchor gates in original order.
   - Add up to 3 regime-derived gates for axes with importance >= 0.45:
     - dir up and regime has min -> `axis >= min`
     - dir down and regime has max -> `axis <= max`
   - Drop any gate unsatisfiable under regime bounds.
   - Append added gates sorted by descending importance, then axis name.
8) Name:
   - Base: anchor prototype id if present, else `prototype`.
   - Modifier: `up_<axis>` or `down_<axis>` for the strongest abs importance axis in target signature.
   - Name format: `<modifier>_<base>`. If collision, append `_v2`, `_v3` deterministically.

## Predicted fit evaluation
Evaluate the synthesized prototype on `storedMoodRegimeContexts` using the same prototype evaluation logic used for existing prototypes (gate pass rate and intensity distribution). Compute:
- gatePassRate
- mean intensity
- p95 intensity
- pAtLeastT for `t*`, `t* - 0.1`, `t* + 0.1` (clamped to [0, 1])
- optional conflict indicators derived from axis conflicts if available

## Evidence
Minimum evidence entries:
- Gap evidence (if C triggered): `nearestDistance`, `nearestDistancePercentile`.
- Best existing prototype fit: gatePassRate + P(I >= t*).
- Proposed prototype fit: gatePassRate + P(I >= t*).
- Delta P(I >= t*).
- Target signature summary (axis, dir, importance).
- Anchor prototype used (if any).

All evidence values must be deterministic and reproducible.

## Determinism and invariants
- Deterministic outputs (ordering and numeric formatting) for identical inputs.
- No mutation of existing prototypes.
- Weights in [-1, 1], at least 3 non-zero weights.
- Gates satisfiable within regime bounds and parseable by existing gate parser.
- Predicted fit metrics must be finite; intensity in [0, 1].

## Recommendation ordering
Keep existing `RecommendationEngine` ordering (severity desc, then type, then clause id). New recommendation type should sort deterministically with current recommendations.

## Testing
Unit tests in `tests/unit/expressionDiagnostics/services/recommendationEngine.test.js` and a new synthesis test module:
- Emits when A && B true (no usable prototype and strong improvement).
- Does not emit when usable prototype exists and C not triggered.
- Does not emit when B fails.
- Emits when C true and sanity thresholds pass.
- Deterministic synthesis (name/weights/gates order stable).
- Weight bounds and sparsity.
- Conflict resolution clamps.
- Gate generation respects satisfiability and ordering.

Integration tests in `tests/integration/expression-diagnostics/monteCarloReportRecommendations.integration.test.js`:
- Recommendation present with schema-valid payload.
- No emission when fit is good and gap is low.
- Stable sorting when multiple recommendations exist.
