# MONCARREPCON-007: Prototype fit parity for normalization and axes

## Summary
Align PrototypeFitRankingService with shared normalization helpers, including affect traits and raw sexual axes, and label prototype types in report tables when relevant.

## Assumptions check
- `src/expressionDiagnostics/utils/axisNormalizationUtils.js` already exists and is used elsewhere; update it as needed rather than creating it.
- Monte Carlo stored contexts already include `sexualAxes` and `affectTraits` (see `MonteCarloSimulator.#buildContext`), so parity work should use them directly.
- Prototype fit reporting currently assumes only emotion prototypes in headings/table labels; adjust labels when sexual prototypes appear.

## File list (expected to touch)
- src/expressionDiagnostics/services/PrototypeFitRankingService.js
- src/expressionDiagnostics/utils/axisNormalizationUtils.js
- src/expressionDiagnostics/services/MonteCarloReportGenerator.js
- tests/unit/expressionDiagnostics/services/prototypeFitRankingService.normalization.test.js (new)

## Out of scope
- Any changes to Monte Carlo sampling or stored context selection.
- Any changes to population metadata or report integrity warnings.
- Any changes to expression prerequisite semantics.

## Acceptance criteria
- PrototypeFitRankingService resolves axes using shared normalization (traits -> sexual -> mood) and includes affect traits + raw sexual axes when present.
- Report tables that include sexual state prototypes clearly label prototype type (emotion vs sexual).
- Existing behavior is preserved for contexts without sexual axes or traits, including contexts that already provide normalized axes.

## Tests
- `npm run test:unit -- --testPathPatterns tests/unit/expressionDiagnostics/services/prototypeFitRankingService.normalization.test.js --coverage=false`

## Invariants
- Normalization logic used by PrototypeFitRankingService matches EmotionCalculatorService and axisNormalizationUtils.
- No changes to prototype weight definitions or expression data.

## Status
- [x] Completed

## Outcome
- Updated PrototypeFitRankingService to use shared normalization with affect traits + raw sexual axes (including pre-normalized inputs).
- Added prototype type labeling in fit/implied/gap report tables when sexual prototypes are present.
- Added unit tests for normalization parity across mood/sexual/trait axes.
