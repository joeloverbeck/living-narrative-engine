# Monte Carlo recommendations section - assessment of ChatGPT contribution

## Scope
Assess ChatGPT's claims and suggestions in `brainstorming/monte-carlo-recommendations-section.md` against the current codebase. For each statement, note whether it is a claim (and if true) and/or a suggestion (and if beneficial).

## Sources reviewed
- `src/expressionDiagnostics/services/MonteCarloSimulator.js`
- `src/expressionDiagnostics/models/HierarchicalClauseNode.js`
- `src/expressionDiagnostics/services/MonteCarloReportGenerator.js`
- `src/expressionDiagnostics/services/RecommendationFactsBuilder.js`
- `src/expressionDiagnostics/services/RecommendationEngine.js`
- `src/expressionDiagnostics/services/PrototypeConstraintAnalyzer.js`
- `src/expressionDiagnostics/models/AxisInterval.js`
- `src/expressionDiagnostics/utils/axisNormalizationUtils.js`
- `src/expressionDiagnostics/services/RandomStateGenerator.js`
- `src/validation/expressionPrerequisiteValidator.js`

## Assessment table
Legend: Claim truth = true / false / partial / unknown. Benefit = beneficial / conditional / neutral / risky / unknown.

| ID | Statement (condensed) | Claim? | Truth | Suggestion/Feature? | Benefit | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Implementation touches five logical areas. | No | N/A | Yes | Beneficial | Reasonable decomposition; maps to simulator, report, recommendations, etc. |
| 2 | Need a pre-pass to find emotion-threshold leaves, their gates, and gate axes. | No | N/A | Yes | Beneficial | No explicit analysis plan exists today; would be needed for per-clause gate-axis recommendations. |
| 3 | Output an AnalysisPlan with trackedGateAxes and emotionClauseGateMap. | No | N/A | Yes | Beneficial | Useful to scope histogram collection and per-clause mapping. |
| 4 | You already compute in-regime pass (moodPass). | Yes | True | No | N/A | Monte Carlo tracks in-regime samples and in-regime evaluation counts. (`src/expressionDiagnostics/services/MonteCarloSimulator.js`) |
| 5 | You already compute gate pass vs clamp per emotion clause and show it in a table. | Yes | True | No | N/A | Gate pass/clamp in-regime exists and is rendered in the leaf breakdown when gate metrics are enabled. (`src/expressionDiagnostics/models/HierarchicalClauseNode.js`, `src/expressionDiagnostics/services/MonteCarloReportGenerator.js`) |
| 6 | Need axis distributions within mood regime for tracked axes. | No | N/A | Yes | Beneficial | Required to compute fractionBelowG and soft alignment. No histogram collection exists today. |
| 7 | Mood axes are discrete in [-100..100]; exact counts are trivial and preferable. | Yes | Partial | Yes | Conditional | Mood axes are defined on [-100, 100], and MC sampling rounds values, but stored contexts may be non-integer. Histogram bins are still useful; not always exact. (`src/expressionDiagnostics/services/RandomStateGenerator.js`, `src/validation/expressionPrerequisiteValidator.js`) |
| 8 | Sexual/trait axes are in [0..100]; counts for [0..100] are appropriate. | Yes | Partial | Yes | Conditional | Ranges are normalized from [0, 100], but values can be continuous. Binning is still helpful. (`src/expressionDiagnostics/services/PrototypeFitRankingService.js`) |
| 9 | Add per-gate-axis fails-gate counters within mood regime for summaries. | No | N/A | Yes | Beneficial | Would support quick diagnostics; not present today. |
| 10 | New recommender runs after mood-regime bounds, per-clause gateClampRate, gate predicates, and axis histograms are available. | No | N/A | Yes | Beneficial | Aligns with data dependencies for the feature. |
| 11 | gateClampRate should be computed as gateClampCount_inMood / moodRegimeCount. | Yes | True | No | N/A | Current gateClampRateInRegime is derived from pass rate within in-regime counts. (`src/expressionDiagnostics/models/HierarchicalClauseNode.js`) |
| 12 | Use per-axis bounds to check if regime implies gate predicates. | No | N/A | Yes | Beneficial | Existing gate compatibility already checks interval conflicts; this is a finer-grained, per-clause implication test. (`src/expressionDiagnostics/services/MonteCarloSimulator.js`) |
| 13 | If all gate predicates are implied, do not emit; high clamp rate would indicate a bug. | No | N/A | Yes | Conditional | Good guardrail, but clamp could still be non-zero if there is a scale mismatch or other non-axis gating, so treat as conditional. |
| 14 | fractionBelowG/fractionAboveG inside mood regime should be computed from histograms. | No | N/A | Yes | Beneficial | Required for the recommendation evidence and soft alignment. |
| 15 | Soft alignment via quantiles; clamp to not be stricter than gate. | No | N/A | Yes | Conditional | Useful option, but may weaken the alignment signal; keep optional. |
| 16 | keepRatio (newRegimeSize / oldRegimeSize) equals shrink only for single-axis constraints; multi-axis needs replay. | Yes | True | No | N/A | Correlations make independent-axis approximations unreliable. |
| 17 | Keep a reservoir of mood-regime samples to replay candidate constraints. | No | N/A | Yes | Beneficial | Enables exact keepRatio and predicted clamp rate for combined constraints. |
| 18 | Predict clamp reduction and clause pass improvement by replaying mood-regime samples. | No | N/A | Yes | Beneficial | Fits the "authoritative" requirement; extra CPU but worth it. |
| 19 | Evaluate combinations of gate constraints (K=2/3) and score by clamp reduction * keepRatio. | No | N/A | Yes | Conditional | Useful for multi-gate prototypes; combinatorial growth manageable with small K. |
| 20 | Invariants: gatePassCount + gateClampCount == moodRegimeCount. | Yes | True | No | N/A | Matches existing in-regime counting model. (`src/expressionDiagnostics/models/HierarchicalClauseNode.js`) |
| 21 | Invariant: gateClampRate == 1 - gatePassRate. | Yes | True | No | N/A | Current implementation derives clamp rate from pass rate. (`src/expressionDiagnostics/models/HierarchicalClauseNode.js`) |
| 22 | If regime implies all gates, gateClampRate should be ~0. | Yes | Partial | No | N/A | True if axis scales and gate parsing match; can be violated by scale mismatches or missing axes. |
| 23 | Histogram sum must equal mood-regime sample count. | Yes | True | No | N/A | Standard histogram integrity check. |
| 24 | Quantile monotonicity is an invariant. | Yes | True | No | N/A | Standard property of quantiles. |
| 25 | Emit only when clampRate threshold, gate predicate not implied, and predClampRate improves by MIN_DELTA. | No | N/A | Yes | Beneficial | Matches "authoritative" requirement and avoids no-op recommendations. |
| 26 | Never emit constraints already present or weaker than existing bounds. | No | N/A | Yes | Beneficial | Prevents redundant or misleading guidance. |
| 27 | If hard alignment is used, predClampRate should drop close to 0 for that gate axis. | No | N/A | Yes | Conditional | Good validation signal, but only if gates are axis-aligned and scaled consistently. |
| 28 | Unit tests for implication logic, histogram fractions, quantiles, replay correctness. | No | N/A | Yes | Beneficial | Targeted tests are aligned with current test strategy. |
| 29 | Integration tests covering emit / no-emit conditions and payload snapshot. | No | N/A | Yes | Beneficial | Matches existing integration test style in expression diagnostics. |
| 30 | Property-based test: hard alignment implies zero failures on that axis in new regime. | No | N/A | Yes | Conditional | Valuable if property-test infra exists; optional otherwise. |
| 31 | Recommendation card should answer 5 questions and include denominators. | No | N/A | Yes | Beneficial | Aligns with existing evidence formatting in report generator. |
| 32 | Always print denominators and mark low confidence for small N. | No | N/A | Yes | Beneficial | Matches current invariant-driven recommendation gating. |
| 33 | TL;DR checklist (pre-scan, histogram, propose g', replay, emit only if improve). | No | N/A | Yes | Beneficial | Good implementation summary. |

## Notes on alignment with current system
- Gate pass/clamp rates within mood regime already exist per leaf emotion clause via `HierarchicalClauseNode`, and are surfaced in the report when gate metrics are enabled.
- Gate compatibility with regime constraints is already computed at the prototype level, but the proposed recommendation needs per-clause, per-axis evidence and shrink/prediction logic.
- No existing histogram or replay infrastructure appears in the current Monte Carlo diagnostics; those would need to be added for the new recommendation.

## Open questions
- Do we already persist enough mood-regime samples to replay candidate constraints without expanding storage? If not, what budget is acceptable?
- Should soft alignment be enabled by default or only when hard alignment fails MIN_KEEP?
- What MIN_KEEP and MIN_DELTA thresholds should be used to avoid spurious recommendations?
