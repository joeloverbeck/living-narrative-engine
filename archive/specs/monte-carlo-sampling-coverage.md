# Specification: Monte Carlo Sampling Coverage Metrics

## Goal

Add sampling coverage metrics to the Monte Carlo pipeline so expression diagnostics can show whether the simulation actually explored the input space needed for reliable conclusions. Surface those metrics in both the markdown report and the in-page (non-report) results in `expression-diagnostics.html`.

## Motivation

The current Monte Carlo report is rich on per-clause failure analysis, but it does not answer a basic question: "Did we sample enough of the input space to trust the outcome?" When expressions rarely trigger, we need to distinguish "genuinely rare" from "not covered by sampling". Coverage metrics make this visible without adding more manual analysis steps.

## Scope

### In Scope

- Compute sampling coverage for all numeric variables referenced by the expression.
- Report global coverage summaries by domain (mood axes, emotions, sexual states, previous state deltas).
- Add a compact, actionable summary to the in-page Monte Carlo results.
- Add a detailed section to the markdown report, including low-coverage warnings.

### Out of Scope

- Changing the sampling algorithm or distribution itself.
- Replacing existing per-clause or prototype coverage metrics.
- UI redesign beyond adding a coverage section.

## Definitions

### Coverage Metrics (per variable)

- **Observed Range**: `[minObserved, maxObserved]` across all samples.
- **Range Coverage**: `(maxObserved - minObserved) / (domainMax - domainMin)` as a percentage.
- **Bin Coverage**: percentage of histogram bins that received at least one sample.
- **Tail Coverage**: share of samples in the bottom/top 10% of the domain (two values).
- **Coverage Rating**: `good`, `partial`, `poor`, based on range and bin coverage thresholds.

### Domains

Coverage is computed per domain using the same ranges the generator uses:

- `moodAxes.*`: use the configured numeric range (e.g., -100 to 100).
- `emotions.*`: use [0, 1].
- `sexualStates.*`: use the configured range.
- `previousMoodAxes.*`, `previousEmotions.*`, `previousSexualStates.*`: same domain range as their current counterparts.

## Current State (Reference)

- Monte Carlo sampling is driven by `src/expressionDiagnostics/services/MonteCarloSimulator.js`.
- Reporting is produced by `src/expressionDiagnostics/services/MonteCarloReportGenerator.js`.
- In-page output is rendered by `src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js`.
- The HTML container exists in `expression-diagnostics.html` under the Monte Carlo results section.

## Proposed Data Model

Extend the Monte Carlo simulation result to include a `samplingCoverage` payload.

```js
{
  samplingCoverage: {
    summaryByDomain: [
      {
        domain: 'moodAxes',
        variableCount: 6,
        rangeCoverageAvg: 0.72,
        binCoverageAvg: 0.65,
        tailCoverageAvg: { low: 0.08, high: 0.06 },
        rating: 'partial',
      }
    ],
    variables: [
      {
        variablePath: 'moodAxes.valence',
        domain: 'moodAxes',
        minObserved: -87.2,
        maxObserved: 64.1,
        rangeCoverage: 0.76,
        binCoverage: 0.70,
        tailCoverage: { low: 0.11, high: 0.05 },
        rating: 'good',
        sampleCount: 10000,
      }
    ],
    config: {
      binCount: 10,
      minSamplesPerBin: 1,
      tailPercent: 0.10,
    },
  },
}
```

## Coverage Collection Algorithm

### 1. Identify Variables

- Use `collectVarPaths()` (already used in the simulator) to extract all variable paths referenced by the expression.
- Filter to numeric paths only (mood axes, emotions, sexual states, previous state variants).
- Ignore non-numeric leaves (boolean, string, enum comparisons).

### 2. Resolve Domain Ranges

- Reuse the ranges defined by the random state generator.
- If a domain range is unavailable, mark the variable coverage as `unknown` and exclude it from summaries.

### 3. Stream Metrics Per Sample

For each variable:

- Track `minObserved` and `maxObserved`.
- Maintain a fixed-size histogram (bin count configurable, default 10).
- Track tail counts for low/high percentiles.

This should be done incrementally without storing raw samples.

### 4. Finalize Metrics

After sampling:

- Compute `rangeCoverage` from observed range and domain bounds.
- Compute `binCoverage` from histogram occupancy.
- Compute `tailCoverage` from counts and total samples.
- Assign `rating`:
  - `good`: rangeCoverage >= 0.75 AND binCoverage >= 0.60
  - `partial`: rangeCoverage >= 0.40 AND binCoverage >= 0.30
  - `poor`: anything below partial

### 5. Build Domain Summary

Aggregate variable metrics per domain:

- Average range coverage.
- Average bin coverage.
- Average tail coverage.
- Overall rating derived from averages.

## Report Output (Markdown)

Add a new section near the top (after Executive Summary):

```
## Sampling Coverage

### Summary by Domain
| Domain | Variables | Range Coverage | Bin Coverage | Tail Low | Tail High | Rating |
|--------|-----------|----------------|--------------|----------|-----------|--------|
| moodAxes | 6 | 72% | 65% | 8% | 6% | partial |
| emotions | 4 | 54% | 30% | 2% | 1% | poor |

### Lowest Coverage Variables
| Variable | Range Coverage | Bin Coverage | Tail Low | Tail High | Rating |
|----------|----------------|--------------|----------|-----------|--------|
| emotions.anger | 22% | 10% | 0% | 0% | poor |
| moodAxes.threat | 35% | 20% | 1% | 0% | poor |

Notes:
- Range coverage is observed span divided by domain span.
- Bin coverage is occupancy across N equal-width bins.
- Tail coverage indicates whether samples reach extremes.
```

### Report Warnings

- If any domain rating is `poor`, add a warning block:
  - "Sampling coverage is low for emotions. Trigger rate may be understated."
- If variables referenced by clauses have `poor` coverage and also show ceiling effects, highlight both.

## In-Page Output (Non-Report)

Add a new "Sampling Coverage" panel within the Monte Carlo results area:

- **Placement**: After the trigger-rate summary and before "Top Blockers".
- **Contents**:
  - A short one-line verdict (e.g., "Coverage: partial (emotions are poorly covered)").
  - A compact summary table by domain (range and bin coverage, rating).
  - A "lowest coverage" list (top 3 variables).

### HTML Additions

Add a container to `expression-diagnostics.html`:

```html
<div id="mc-sampling-coverage" class="mc-sampling-coverage-container" hidden>
  <h3>Sampling Coverage</h3>
  <p class="sampling-coverage-summary"></p>
  <div class="sampling-coverage-tables"></div>
</div>
```

### Controller Integration

Extend `ExpressionDiagnosticsController` to:

- Read `result.samplingCoverage`.
- Render the summary and tables into `#mc-sampling-coverage`.
- Hide the section when coverage data is missing or unknown.

## Configuration

Add a config entry (parallel to advanced metrics):

```js
const samplingCoverageConfig = {
  enabled: true,
  binCount: 10,
  minSamplesPerBin: 1,
  tailPercent: 0.10,
};
```

## Edge Cases

- **No numeric variables**: hide coverage output and omit the report section.
- **Unknown domain range**: mark variable coverage as `unknown` and exclude from summaries.
- **Small sample sizes**: add a warning if `sampleCount < binCount * 5`.
- **Dynamic sampling mode**: include the sampling mode string in the coverage summary header.

## Testing Strategy

### Unit Tests

- Coverage computation for a controlled set of samples.
- Bin occupancy and range coverage math.
- Rating thresholds.

### Integration Tests

- Simulation output includes `samplingCoverage` when enabled.
- Report generator renders the new section.
- UI renders and hides the section correctly.

## Success Criteria

- Coverage metrics are visible in both report and in-page output.
- Users can identify when low trigger rates are due to sampling coverage gaps.
- Runtime impact stays minimal (no more than a few percent in simulation time).

## Open Questions

- Should range coverage use domain bounds or observed bounds from the generator in dynamic mode?
- Do we need a different bin count per domain (e.g., more bins for mood axes)?
