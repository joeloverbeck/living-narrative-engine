# Monte Carlo Sampling Coverage Conclusions

## Goal

Extend Sampling Coverage output with an interpretation layer that explains what the coverage metrics imply for feasibility confidence. The additions must appear in both the markdown report and the in-page Monte Carlo results, using the existing coverage payload (summary + per-variable metrics) without naming specific variables or emotions by default.

## Motivation

Current sampling coverage output is purely descriptive (tables + notes). Content creators still need to translate metrics into conclusions such as “upper extremes are untested” or “failures here are likely real.” The conclusions-engine rules in `brainstorming/conclusions-engine.md` provide a structured way to derive those insights. Implementing them gives a concise, actionable narrative that complements the existing data.

## Current Implementation (Reference)

### Key Files
- `expression-diagnostics.html` (Sampling Coverage container markup)
- `src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js` (in-page Sampling Coverage rendering)
- `src/expressionDiagnostics/services/MonteCarloReportGenerator.js` (Sampling Coverage report section)
- `src/expressionDiagnostics/services/monteCarloSamplingCoverage.js` (coverage calculation + ratings)

### Current Output
- **In-page**: summary line + Summary by Domain table + Lowest Coverage table
- **Report**: Sampling Coverage section with tables + notes + warning block if any domain is `poor`

No conclusions/interpretation layer is provided.

## Proposed Additions

Add a “Coverage Conclusions” block derived from existing coverage data, using the rule set in `brainstorming/conclusions-engine.md` with the following constraints:
- **No specific variable names** by default. Only aggregate counts or minima/maxima.
- **Domain-level conclusions** prioritized by severity (critical → warn → info).
- **Global implications** (feasibility interpretation) if tail starvation or clumping is detected.
- **Optional watchlist summary** as numeric minima/maxima without listing variable names.

These conclusions should appear:
- In the **report** under Sampling Coverage (after tables and notes).
- In the **in-page** Sampling Coverage panel under the tables.

## Conclusions Engine (Derived Logic)

### Inputs
From `samplingCoverage`:
- `summaryByDomain[]`: `domain`, `variableCount`, `rangeCoverageAvg`, `binCoverageAvg`, `tailCoverageAvg.{low,high}`, `rating`
- `variables[]`: `rangeCoverage`, `binCoverage`, `tailCoverage.{low,high}`, `rating`
- `config.tailPercent`

### Derived Metrics (per domain)
- `expectedTail = tailPercent`
- `tailLowRatio = tailLow / expectedTail`
- `tailHighRatio = tailHigh / expectedTail`
- `tailMinRatio = min(tailLowRatio, tailHighRatio)`
- `tailMaxRatio = max(tailLowRatio, tailHighRatio)`
- `tailAsymmetry = tailMaxRatio / max(tailMinRatio, 1e-9)`
- `tailStarvedSide = high|low`

### Domain Rules (Severity Ordered)
Apply these rules per domain using the templates in `brainstorming/conclusions-engine.md`:
- **D1/D2 (critical)**: Tail near-zero (ratio < 0.05)
- **D3 (warn/critical)**: Tail asymmetry >= 6 warn, >= 20 critical
- **D4 (warn/critical)**: Range coverage < 0.80 warn, < 0.65 critical
- **D5 (warn)**: Bin coverage < 0.75
- **D6 (info)**: Healthy if range >= 0.90, bins >= 0.90, tails >= 0.7

Suppress weaker tail-related rules for a domain if a stronger tail rule already fired.

### Variable-Level Summary Rules (Aggregate Counts)
Use variables with known coverage (rating != `unknown`):
- **V1**: Count tailHighRatio < 0.05
- **V2**: Count tailLowRatio < 0.05
- **V3**: Count rangeCoverage < 0.80

Emit a single “Across variables” summary line if any count > 0. Severity = critical if count >= 25% of variables, warn if > 0 but < 25%.

### Global Implications
If any domain has starved/near-starved tail (ratio < 0.2), emit:
- I1 (upper tail) and/or I2 (lower tail) from `brainstorming/conclusions-engine.md`

If any domain has bin coverage < 0.75, emit I5 (regime bias) once globally.

### Optional Watchlist Summary (Numeric Only)
If included, emit up to 2 numeric bullets:
- Worst range coverage (min)
- Worst upper tail coverage (min tailHigh)
- Worst lower tail coverage (min tailLow)

## UI Changes (Non-Report Output)

### expression-diagnostics.html
Add a conclusions container under `#mc-sampling-coverage`:
```
<div class="sampling-coverage-conclusions" hidden>
  <h4>Coverage Conclusions</h4>
  <ul class="sampling-coverage-conclusions-list"></ul>
</div>
```

### ExpressionDiagnosticsController
- Add selectors/refs for the conclusions container and list.
- Extend `#displaySamplingCoverage` to:
  - Build conclusions via a shared utility (see below).
  - Hide the conclusions block if no conclusions are generated.
  - Render bullets as plain list items (no variable names).
- Keep summary/tables logic unchanged.

## Report Changes

### MonteCarloReportGenerator
Add a “### Coverage Conclusions” subsection after the existing notes/warnings:
- Bullet list for domain conclusions (severity ordered).
- Optional variable summary bullet.
- Optional global implications bullets.
- Optional watchlist numeric bullets.

If no conclusions are emitted, omit this subsection entirely.

## Shared Utility

Create a new helper module (name TBD, e.g. `samplingCoverageConclusions.js`) that:
- Accepts `samplingCoverage` and returns structured conclusions:
  - `domainConclusions[]` (severity + text)
  - `variableSummary[]`
  - `globalImplications[]`
  - `watchlist[]`
- Provides a single `buildSamplingCoverageConclusions()` function used by both UI and report generator.

## Acceptance Criteria

- Report includes a Coverage Conclusions section when coverage data exists and rules fire.
- In-page Sampling Coverage panel includes a Coverage Conclusions list when conclusions are present.
- No specific variable names appear in conclusions by default.
- Conclusions respect severity ordering and the rule suppression rules.
- No changes required to the Monte Carlo simulator payload format.

## Tests

- Add unit tests for the conclusions builder rules (domain + variable + implications).
- Extend `monteCarloReportGenerator` tests to assert conclusion subsection rendering.
- Extend ExpressionDiagnosticsController tests to validate UI rendering and hiding behavior.

## Open Questions

- Should the optional watchlist numeric bullets be enabled by default, or behind a toggle?
- Should the UI display severity badges (critical/warn/info) or keep plain text?
