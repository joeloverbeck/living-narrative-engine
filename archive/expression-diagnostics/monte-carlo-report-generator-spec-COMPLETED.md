# Monte Carlo Report Generator Specification

## Overview

Add a "Generate Report" button to the Monte Carlo Simulation section of `expression-diagnostics.html` that produces a comprehensive markdown report of the simulation analysis. The report is designed for consumption by AI assistants (e.g., ChatGPT) to provide tuning recommendations for expression prerequisites.

## Motivation

Currently, users copy the hierarchical output from the Monte Carlo simulation UI and paste it to ChatGPT for tuning guidance. This workflow is suboptimal because:
1. The UI output is not structured for AI consumption
2. Metric definitions are not included
3. Actionable recommendations require human interpretation
4. The copy process is manual and error-prone

The report generator will produce a self-contained markdown document with all meaningful analysis data, problem indicators, actionable recommendations, and a legend explaining all metrics.

---

## Meaningful Data from Monte Carlo Simulation

### Global Simulation Results
| Metric | Type | Description |
|--------|------|-------------|
| `triggerRate` | number (0-1) | Probability that expression triggers |
| `triggerCount` | number | Raw count of successful triggers |
| `sampleCount` | number | Total samples evaluated (e.g., 10,000) |
| `confidenceInterval` | {low, high} | Wilson score 95% confidence bounds |
| `distribution` | string | 'uniform' or 'gaussian' |
| `rarityCategory` | string | impossible, extremely_rare, rare, normal, frequent |

### Per-Blocker Metrics
| Metric | Type | Description |
|--------|------|-------------|
| `clauseDescription` | string | Human-readable condition (e.g., "emotions.joy >= 0.65") |
| `variablePath` | string | Variable being compared (e.g., "emotions.joy") |
| `comparisonOperator` | string | >=, <=, >, <, == |
| `thresholdValue` | number | Threshold value in condition |
| `failureRate` | number (0-1) | Proportion of samples where clause failed |
| `failureCount` | number | Raw failure count |
| `averageViolation` | number | Mean magnitude of constraint miss when failed |
| `violationP50` | number | Median violation magnitude |
| `violationP90` | number | 90th percentile violation magnitude |
| `nearMissRate` | number (0-1) | Proportion of samples within epsilon of threshold |
| `nearMissEpsilon` | number | Epsilon tolerance used for near-miss detection |
| `lastMileFailRate` | number (0-1) | Failure rate when all OTHER clauses passed |
| `lastMileFailCount` | number | Raw count of last-mile failures |
| `othersPassedCount` | number | Samples where all other clauses passed |
| `isSingleClause` | boolean | Whether this is the only clause |
| `maxObservedValue` | number | Maximum value observed for the variable |
| `ceilingGap` | number | threshold - maxObserved (positive = unreachable) |

### Analysis Results (from FailureExplainer)
| Analysis | Possible Statuses | Description |
|----------|-------------------|-------------|
| Percentile Analysis | heavy_tail, some_severe, normal, no_data | Distribution shape of violations |
| Near-Miss Analysis | high, moderate, low, no_data | Tunability via threshold adjustment |
| Ceiling Analysis | ceiling_detected, achievable, no_data | Whether threshold is reachable |
| Last-Mile Analysis | decisive_blocker, rarely_decisive, moderate, single_clause, no_data | Whether clause is the final obstacle |
| Recommendation | redesign, tune_threshold, adjust_upstream, lower_priority, investigate | Action to take |
| Severity | critical, high, medium, low | Priority level |

---

## Problem Indicators and Actions

The report will flag specific problem patterns and provide guidance:

### 1. Ceiling Effect (Critical)
- **Detection**: `ceilingGap > 0` (threshold > maxObservedValue)
- **Flag**: `[CEILING]`
- **Guidance**: "Threshold is unreachable by tuning alone. Consider: (1) Lower the threshold value, (2) Adjust upstream gates that limit the variable, (3) Redesign the condition entirely."

### 2. Decisive Blocker (High Priority)
- **Detection**: `lastMileFailRate / failureRate > 1.5` OR `isSingleClause`
- **Flag**: `[DECISIVE]`
- **Guidance**: "This clause is the primary bottleneck. Tune this first for maximum impact."

### 3. High Tunability (Quick Wins)
- **Detection**: `nearMissRate > 0.10` (>10%)
- **Flag**: `[TUNABLE]`
- **Guidance**: "Many samples are borderline. Small threshold adjustments will significantly improve trigger rate."

### 4. Low Tunability (Upstream Fix Required)
- **Detection**: `nearMissRate < 0.02` (<2%)
- **Flag**: `[UPSTREAM]`
- **Guidance**: "Values are far from threshold. Adjust prototypes, gates, or emotional weights rather than threshold."

### 5. Heavy-Tailed Distribution
- **Detection**: `violationP50 < averageViolation * 0.5`
- **Flag**: `[OUTLIERS-SKEW]`
- **Guidance**: "Median violation is much lower than mean. Most failures are minor; a few severe outliers skew the average."

### 6. Severe Outliers Present
- **Detection**: `violationP90 > averageViolation * 2`
- **Flag**: `[SEVERE-TAIL]`
- **Guidance**: "Some samples fail badly while most are moderate. Consider whether the severe cases are edge conditions to accept or fix."

---

## Report Format (Markdown)

```markdown
# Monte Carlo Analysis Report

**Expression**: {expressionName}
**Generated**: {timestamp}
**Distribution**: {uniform|gaussian}
**Sample Size**: {sampleCount}

---

## Executive Summary

**Trigger Rate**: {triggerRate}% (95% CI: {low}% - {high}%)
**Rarity**: {rarityCategory}

{summary text from FailureExplainer}

---

## Blocker Analysis

### Blocker #{rank}: `{clauseDescription}`

**Condition**: `{variablePath} {operator} {threshold}`
**Failure Rate**: {failureRate}% ({failureCount} / {sampleCount})
**Severity**: {severity}

#### Flags
{flags list, e.g., [CEILING] [DECISIVE] etc., or "None"}

#### Distribution Analysis
- **Average Violation**: {averageViolation}
- **Median (P50)**: {violationP50}
- **90th Percentile (P90)**: {violationP90}
- **Interpretation**: {percentileAnalysis.insight}

#### Ceiling Analysis
- **Max Observed**: {maxObservedValue}
- **Threshold**: {thresholdValue}
- **Ceiling Gap**: {ceilingGap} {(achievable|UNREACHABLE)}
- **Insight**: {ceilingAnalysis.insight}

#### Near-Miss Analysis
- **Near-Miss Rate**: {nearMissRate}% (epsilon: {epsilon})
- **Tunability**: {high|moderate|low}
- **Insight**: {nearMissAnalysis.insight}

#### Last-Mile Analysis
- **Last-Mile Failure Rate**: {lastMileFailRate}%
- **Others Passed Count**: {othersPassedCount}
- **Is Decisive**: {yes|no}
- **Insight**: {lastMileAnalysis.insight}

#### Recommendation
**Action**: {action}
**Priority**: {priority}
**Guidance**: {message}

---

{...repeat for each blocker...}

---

## Legend

### Global Metrics
- **Trigger Rate**: Probability (0-100%) that the expression evaluates to true across random samples
- **Confidence Interval**: 95% Wilson score interval indicating statistical certainty of the trigger rate
- **Sample Size**: Number of random state pairs generated for simulation
- **Rarity Categories**: impossible (0%), extremely_rare (<0.001%), rare (<0.05%), normal (<2%), frequent (≥2%)

### Per-Clause Metrics
- **Failure Rate**: Percentage of samples where this specific clause evaluated to false
- **Violation Magnitude**: How far the actual value was from the threshold when the clause failed
- **P50 (Median)**: Middle value of violations; 50% of failures had violations at or below this
- **P90 (90th Percentile)**: 90% of failures had violations at or below this; indicates severity of worst cases
- **Near-Miss Rate**: Percentage of ALL samples where the value was within epsilon of the threshold (close calls)
- **Epsilon**: The tolerance distance used to detect near-misses (typically 5% of value range)
- **Last-Mile Failure Rate**: Failure rate only among samples where ALL OTHER clauses passed; reveals if this clause is the final bottleneck
- **Ceiling Gap**: (Threshold - Max Observed). Positive = threshold is unreachable; negative = threshold is achievable

### Tunability Levels
- **High**: >10% near-miss rate; threshold adjustments will help significantly
- **Moderate**: 2-10% near-miss rate; threshold adjustments may help somewhat
- **Low**: <2% near-miss rate; threshold adjustments won't help; fix upstream

### Severity Levels
- **Critical**: Ceiling detected or fundamentally broken condition
- **High**: Decisive blocker with tuning potential
- **Medium**: Moderate contributor to failures
- **Low**: Other clauses fail first; lower priority

### Recommended Actions
- **redesign**: Condition is fundamentally problematic; rethink the logic
- **tune_threshold**: Adjust threshold value; quick win available
- **adjust_upstream**: Modify prototypes, gates, or weights that feed this variable
- **lower_priority**: Focus on other blockers first
- **investigate**: Needs further analysis
```

---

## Implementation Plan

### New Files

#### 1. `src/expressionDiagnostics/services/MonteCarloReportGenerator.js`
Pure service class that generates markdown report from simulation data.

```javascript
/**
 * @file MonteCarloReportGenerator - Generates markdown reports from Monte Carlo simulation results
 */

class MonteCarloReportGenerator {
  #logger;

  constructor({ logger }) {
    this.#logger = logger;
  }

  /**
   * Generate a complete markdown report from simulation results.
   * @param {object} params
   * @param {string} params.expressionName - Name of the expression analyzed
   * @param {object} params.simulationResult - Raw result from MonteCarloSimulator
   * @param {object[]} params.blockers - Analyzed blockers from FailureExplainer
   * @param {string} params.summary - Summary text from FailureExplainer
   * @returns {string} Markdown report content
   */
  generate({ expressionName, simulationResult, blockers, summary }) {
    // Implementation details...
  }

  // Private methods for each section...
  #generateHeader(expressionName, simulationResult)
  #generateExecutiveSummary(simulationResult, summary)
  #generateBlockerSection(blocker, rank)
  #generateFlags(blocker)
  #generateDistributionAnalysis(blocker)
  #generateCeilingAnalysis(blocker)
  #generateNearMissAnalysis(blocker)
  #generateLastMileAnalysis(blocker)
  #generateRecommendation(blocker)
  #generateLegend()
  #formatPercentage(value, decimals = 2)
  #formatNumber(value, decimals = 2)
}

export default MonteCarloReportGenerator;
```

#### 2. `src/domUI/expression-diagnostics/MonteCarloReportModal.js`
Modal renderer extending BaseModalRenderer.

```javascript
/**
 * @file MonteCarloReportModal - Modal for displaying and copying MC analysis reports
 */

import { BaseModalRenderer } from '../baseModalRenderer.js';
import { copyToClipboard } from '../helpers/clipboardUtils.js';

class MonteCarloReportModal extends BaseModalRenderer {
  #reportContent = '';

  constructor({ logger, documentContext, validatedEventDispatcher }) {
    super({
      logger,
      documentContext,
      validatedEventDispatcher,
      elementsConfig: {
        modalElement: '#mc-report-modal',
        closeButton: '#mc-report-close-btn',
        statusMessageElement: '#mc-report-status',
        copyButton: '#mc-report-copy-btn',
        contentArea: '#mc-report-content'
      }
    });

    this._operationInProgressAffectedElements = ['copyButton'];
    this.#bindEvents();
  }

  showReport(markdownContent) {
    this.#reportContent = markdownContent;
    this.show();
  }

  _onShow() {
    // Populate content area with markdown
    this.elements.contentArea.textContent = this.#reportContent;
  }

  _onHide() {
    this.#reportContent = '';
  }

  #bindEvents() {
    this._addDomListener(this.elements.copyButton, 'click', () => this.#handleCopy());
  }

  async #handleCopy() {
    const success = await copyToClipboard(this.#reportContent);
    if (success) {
      this._displayStatusMessage('Copied to clipboard!', 'success');
    } else {
      this._displayStatusMessage('Failed to copy. Please select and copy manually.', 'error');
    }

    // Auto-clear after 2 seconds
    setTimeout(() => this._clearStatusMessage(), 2000);
  }
}

export default MonteCarloReportModal;
```

### HTML Additions to `expression-diagnostics.html`

#### Button (inside `#mc-results` div, in results header area after line 182)
Add the button inside the results section so it only appears when results are visible:

```html
<!-- Inside mc-results div, after the mc-summary paragraph -->
<div class="mc-results-actions">
  <button id="generate-report-btn" class="action-button action-button--secondary">
    Generate Report
  </button>
</div>
```

#### Modal Structure (at end of body, before closing `</body>`)
```html
<!-- Monte Carlo Report Modal -->
<div id="mc-report-modal" class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="mc-report-title" style="display: none;">
  <div class="modal-content modal-content--large">
    <div class="modal-header">
      <h2 id="mc-report-title">Monte Carlo Analysis Report</h2>
      <button id="mc-report-close-btn" class="modal-close-btn" aria-label="Close">×</button>
    </div>
    <div class="modal-body">
      <pre id="mc-report-content" class="mc-report-content"></pre>
    </div>
    <div class="modal-footer">
      <div id="mc-report-status" class="status-message-area"></div>
      <button id="mc-report-copy-btn" class="btn btn-primary">
        Copy to Clipboard
      </button>
    </div>
  </div>
</div>
```

### CSS Additions

Add to `css/expression-diagnostics.css` or create new `css/components/_mc-report-modal.css`:

```css
/* Monte Carlo Report Modal */
.modal-content--large {
  max-width: 900px;
  max-height: 85vh;
}

.mc-report-content {
  white-space: pre-wrap;
  word-wrap: break-word;
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.875rem;
  line-height: 1.5;
  background: var(--bg-secondary, #1e1e1e);
  color: var(--text-primary, #e0e0e0);
  padding: 1rem;
  border-radius: 4px;
  overflow-y: auto;
  max-height: 60vh;
  user-select: text;
}

.action-button--secondary {
  background: var(--bg-tertiary, #3a3a3a);
  border: 1px solid var(--border-color, #555);
}

.action-button--secondary:hover:not(:disabled) {
  background: var(--bg-hover, #4a4a4a);
}

.action-button--secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

### Controller Modifications to `ExpressionDiagnosticsController.js`

#### New Properties
```javascript
#generateReportBtn;
#reportModal;
#reportGenerator;
#currentBlockers = [];
```

#### Constructor DI
Add `MonteCarloReportGenerator` and `MonteCarloReportModal` as dependencies.

#### Bind DOM Elements
```javascript
#bindDomElements() {
  // ... existing bindings ...
  this.#generateReportBtn = document.querySelector('#generate-report-btn');
}
```

#### Setup Event Listeners
```javascript
#setupEventListeners() {
  // ... existing listeners ...
  if (this.#generateReportBtn) {
    this.#generateReportBtn.addEventListener('click', () => this.#handleGenerateReport());
  }
}
```

#### Store Blockers for Report
In `#displayMonteCarloResults()`:
```javascript
// Store blockers for report generation
this.#currentBlockers = blockers;
```

In `#resetMonteCarloResults()`:
```javascript
// Clear stored blockers
this.#currentBlockers = [];
```

Note: Since the button is inside `#mc-results` which has `hidden` attribute, no explicit enable/disable is needed - the button naturally appears/hides with the results section.

#### Generate Report Handler
```javascript
#handleGenerateReport() {
  if (!this.#currentResult || !this.#selectedExpression) {
    this.#logger.warn('Cannot generate report: no simulation results');
    return;
  }

  const expressionName = this.#getExpressionName(this.#selectedExpression);
  const summary = this.#mcSummary?.textContent || '';

  const report = this.#reportGenerator.generate({
    expressionName,
    simulationResult: this.#currentResult,
    blockers: this.#currentBlockers,
    summary
  });

  this.#reportModal.showReport(report);
}
```

### DI Registration

Add to appropriate DI registration file:
```javascript
// tokens
MonteCarloReportGenerator: 'MonteCarloReportGenerator',
MonteCarloReportModal: 'MonteCarloReportModal',

// registrations
container.register(tokens.MonteCarloReportGenerator, MonteCarloReportGenerator);
container.register(tokens.MonteCarloReportModal, MonteCarloReportModal);
```

---

## Testing Plan

### Unit Tests

#### `tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.test.js`
- Test report generation with complete data
- Test report generation with missing optional fields
- Test each section generator method
- Test flag detection logic
- Test number formatting
- Test edge cases (0% trigger rate, 100% trigger rate, no blockers)

#### `tests/unit/domUI/expression-diagnostics/MonteCarloReportModal.test.js`
- Test modal show/hide lifecycle
- Test copy button functionality
- Test status message display
- Test content population
- Mock `copyToClipboard` for testing

### Integration Tests

#### `tests/integration/expression-diagnostics/monteCarloReport.integration.test.js`
- Run full simulation → generate report → verify report content
- Verify all blocker data is represented
- Verify flags are correctly detected
- Test copy functionality in realistic scenario

---

## Files to Modify

| File | Action |
|------|--------|
| `src/expressionDiagnostics/services/MonteCarloReportGenerator.js` | **CREATE** |
| `src/domUI/expression-diagnostics/MonteCarloReportModal.js` | **CREATE** |
| `expression-diagnostics.html` | **MODIFY** - Add button + modal HTML |
| `css/expression-diagnostics.css` | **MODIFY** - Add modal styles |
| `src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js` | **MODIFY** - Wire up button and modal |
| `src/dependencyInjection/tokens/tokens-domUI.js` | **MODIFY** - Add tokens |
| `src/dependencyInjection/registrations/domUIRegistrations.js` | **MODIFY** - Register services |
| `tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.test.js` | **CREATE** |
| `tests/unit/domUI/expression-diagnostics/MonteCarloReportModal.test.js` | **CREATE** |
| `tests/integration/expression-diagnostics/monteCarloReport.integration.test.js` | **CREATE** |

---

## Clipboard Reuse

The implementation will reuse the existing clipboard functionality from `src/domUI/helpers/clipboardUtils.js`:

```javascript
import { copyToClipboard } from '../helpers/clipboardUtils.js';

// Usage in modal:
const success = await copyToClipboard(this.#reportContent);
```

This provides:
- Modern Clipboard API with `execCommand` fallback
- Boolean success/failure return
- No need for reimplementation

The modal will use `_displayStatusMessage()` from `BaseModalRenderer` for feedback instead of `showCopyFeedback()` (which is designed for floating feedback on buttons, not modal status areas).

---

## Acceptance Criteria

1. [ ] "Generate Report" button appears next to "Run Simulation" button
2. [ ] Button is disabled until a simulation is run
3. [ ] Clicking button opens modal with markdown report
4. [ ] Report contains all meaningful simulation data as specified
5. [ ] Report includes problem flags with actionable guidance
6. [ ] Legend section defines all metrics (not repeated per blocker)
7. [ ] Copy to Clipboard button works and shows feedback
8. [ ] Modal closes via X button, backdrop click, or Escape key
9. [ ] Report is formatted for AI assistant consumption
10. [ ] All unit and integration tests pass

---

## Future Enhancements (Out of Scope)

- Export to file (download .md file)
- Rendered markdown view toggle
- Report history/comparison
- Custom report templates
- Direct integration with AI APIs
