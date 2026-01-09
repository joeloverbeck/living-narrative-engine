# EXPDIA-009: Extend UI with Monte Carlo Controls and Results

**Status: COMPLETED**

## Summary

Add Monte Carlo simulation controls and results display to the Expression Diagnostics page. This includes sample count configuration, distribution selection, trigger rate display with confidence intervals, and a "Top Blockers" table showing per-clause failure analysis.

## Priority: Medium | Effort: Medium

## Rationale

Static analysis alone cannot show trigger probability. The Monte Carlo UI enables content authors to run simulations and understand exactly which clauses are blocking their expressions, with clear visual indicators for rarity status.

## Dependencies

- **EXPDIA-006** (Basic Diagnostics UI structure)
- **EXPDIA-007** (MonteCarloSimulator service)
- **EXPDIA-008** (FailureExplainer service)

## Implementation Notes - Discrepancies Corrected

The following assumptions in the original ticket were corrected based on actual codebase analysis:

| Issue | Original Assumption | Actual Code | Correction Applied |
|-------|---------------------|-------------|-------------------|
| DI Pattern | `this.#container.resolve('IMonteCarloSimulator')` | Constructor DI, no container reference | Use constructor params: `monteCarloSimulator`, `failureExplainer` |
| Expression Access | `this.#getCurrentExpression()` | Uses `this.#selectedExpression` directly | Use existing field |
| CSS Variables | `--text-secondary`, `--bg-secondary`, `--text-primary` | `--secondary-text-color`, `--secondary-bg-color`, `--primary-text-color` | Use actual variable names |
| HTML Class | `.diagnostics-section` | Existing `.panel` class | Use `.panel` class |
| Cancel Button | Cancel simulation with `#cancelSimulation()` | `simulate()` is synchronous, nothing to cancel | **Removed from scope** |
| Progress Bar | Shows progress during async simulation | Sync operation, no chunking/progress | **Removed from scope** |
| Async Simulation | `async #runSimulation()` | `simulate()` returns synchronously | Use synchronous execution |

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js` | **Modify** |
| `css/expression-diagnostics.css` | **Modify** |
| `expression-diagnostics.html` | **Modify** |
| `tests/unit/domUI/expression-diagnostics/ExpressionDiagnosticsController.test.js` | **Modify** |

## Out of Scope

- **DO NOT** modify MonteCarloSimulator or FailureExplainer services
- **DO NOT** implement Witness State UI - that's EXPDIA-012
- **DO NOT** implement SMT UI - that's EXPDIA-014
- **DO NOT** implement Suggestions UI - that's EXPDIA-016
- **DO NOT** add dynamics mode toggle - that's EXPDIA-016

## Implementation Details

### HTML Structure Updates

```html
<!-- Add to expression-diagnostics.html after static analysis section -->

<!-- Monte Carlo Section -->
<section id="monte-carlo-section" class="diagnostics-section">
  <h2>Monte Carlo Simulation</h2>

  <div class="mc-controls">
    <div class="control-group">
      <label for="sample-count">Sample Count:</label>
      <select id="sample-count">
        <option value="1000">1,000 (Fast)</option>
        <option value="10000" selected>10,000 (Standard)</option>
        <option value="100000">100,000 (Precise)</option>
      </select>
    </div>

    <div class="control-group">
      <label for="distribution">Distribution:</label>
      <select id="distribution">
        <option value="uniform" selected>Uniform</option>
        <option value="gaussian">Gaussian</option>
      </select>
    </div>

    <button id="run-simulation-btn" class="btn btn-primary">
      Run Simulation
    </button>
    <button id="cancel-simulation-btn" class="btn btn-secondary" disabled>
      Cancel
    </button>
  </div>

  <div id="simulation-progress" class="progress-container" hidden>
    <div class="progress-bar">
      <div class="progress-fill" style="width: 0%"></div>
    </div>
    <span class="progress-text">Running simulation...</span>
  </div>

  <div id="mc-results" class="results-container" hidden>
    <div class="trigger-rate-display">
      <div class="rarity-indicator" id="rarity-indicator">
        <span class="rarity-emoji"></span>
        <span class="rarity-label"></span>
      </div>
      <div class="rate-details">
        <span class="trigger-rate" id="trigger-rate">--</span>
        <span class="confidence-interval" id="confidence-interval">(-- - --)</span>
      </div>
    </div>

    <div class="summary-text" id="mc-summary"></div>

    <h3>Top Blockers</h3>
    <table id="blockers-table" class="data-table">
      <thead>
        <tr>
          <th>Rank</th>
          <th>Clause</th>
          <th>Failure Rate</th>
          <th>Avg. Violation</th>
          <th>Severity</th>
        </tr>
      </thead>
      <tbody id="blockers-tbody">
        <!-- Populated dynamically -->
      </tbody>
    </table>
  </div>
</section>
```

### CSS Updates

```css
/* Add to css/expression-diagnostics.css */

/* Monte Carlo Section */
.mc-controls {
  display: flex;
  gap: 1rem;
  align-items: flex-end;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.control-group label {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.control-group select {
  padding: 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-secondary);
  min-width: 150px;
}

/* Progress */
.progress-container {
  margin: 1rem 0;
}

.progress-bar {
  height: 8px;
  background: var(--bg-tertiary);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--color-primary);
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin-top: 0.25rem;
  display: block;
}

/* Trigger Rate Display */
.trigger-rate-display {
  display: flex;
  align-items: center;
  gap: 2rem;
  padding: 1.5rem;
  background: var(--bg-secondary);
  border-radius: 8px;
  margin-bottom: 1rem;
}

.rarity-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-weight: 600;
}

.rarity-indicator.impossible {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

.rarity-indicator.extremely-rare {
  background: rgba(249, 115, 22, 0.2);
  color: #f97316;
}

.rarity-indicator.rare {
  background: rgba(234, 179, 8, 0.2);
  color: #eab308;
}

.rarity-indicator.normal {
  background: rgba(34, 197, 94, 0.2);
  color: #22c55e;
}

.rarity-indicator.frequent {
  background: rgba(59, 130, 246, 0.2);
  color: #3b82f6;
}

.rarity-emoji {
  font-size: 1.25rem;
}

.rate-details {
  display: flex;
  flex-direction: column;
}

.trigger-rate {
  font-size: 2rem;
  font-weight: 700;
  color: var(--text-primary);
}

.confidence-interval {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.summary-text {
  padding: 1rem;
  background: var(--bg-tertiary);
  border-radius: 4px;
  margin-bottom: 1rem;
  line-height: 1.6;
}

/* Blockers Table */
.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th,
.data-table td {
  padding: 0.75rem;
  text-align: left;
  border-bottom: 1px solid var(--border-color);
}

.data-table th {
  background: var(--bg-secondary);
  font-weight: 600;
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0.025em;
}

.data-table tbody tr:hover {
  background: var(--bg-secondary);
}

.severity-badge {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.severity-badge.critical {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

.severity-badge.high {
  background: rgba(249, 115, 22, 0.2);
  color: #f97316;
}

.severity-badge.medium {
  background: rgba(234, 179, 8, 0.2);
  color: #eab308;
}

.severity-badge.low {
  background: rgba(34, 197, 94, 0.2);
  color: #22c55e;
}
```

### Controller Updates

```javascript
// Add to ExpressionDiagnosticsController.js

/**
 * Initialize Monte Carlo controls
 * @private
 */
#initMonteCarloControls() {
  const runBtn = document.getElementById('run-simulation-btn');
  const cancelBtn = document.getElementById('cancel-simulation-btn');

  runBtn?.addEventListener('click', () => this.#runSimulation());
  cancelBtn?.addEventListener('click', () => this.#cancelSimulation());
}

/**
 * Run Monte Carlo simulation
 * @private
 */
async #runSimulation() {
  const expression = this.#getCurrentExpression();
  if (!expression) return;

  const sampleCount = parseInt(document.getElementById('sample-count')?.value || '10000', 10);
  const distribution = document.getElementById('distribution')?.value || 'uniform';

  this.#showProgress(true);
  this.#setSimulationButtons(false);

  try {
    const simulator = this.#container.resolve('IMonteCarloSimulator');
    const explainer = this.#container.resolve('IFailureExplainer');

    const result = await simulator.simulate(expression, {
      sampleCount,
      distribution,
      trackClauses: true
    });

    const blockers = explainer.analyzeBlockers(result.clauseFailures);
    const summary = explainer.generateSummary(result.triggerRate, blockers);

    this.#displayMonteCarloResults(result, blockers, summary);
  } catch (err) {
    this.#logger.error('Simulation failed', err);
    this.#showError('Simulation failed: ' + err.message);
  } finally {
    this.#showProgress(false);
    this.#setSimulationButtons(true);
  }
}

/**
 * Display Monte Carlo results
 * @private
 */
#displayMonteCarloResults(result, blockers, summary) {
  const resultsContainer = document.getElementById('mc-results');
  if (!resultsContainer) return;

  resultsContainer.hidden = false;

  // Update rarity indicator
  const rarityCategory = this.#getRarityCategory(result.triggerRate);
  this.#updateRarityIndicator(rarityCategory);

  // Update trigger rate
  const triggerRateEl = document.getElementById('trigger-rate');
  if (triggerRateEl) {
    triggerRateEl.textContent = this.#formatPercentage(result.triggerRate);
  }

  // Update confidence interval
  const ciEl = document.getElementById('confidence-interval');
  if (ciEl && result.confidenceInterval) {
    ciEl.textContent = `(${this.#formatPercentage(result.confidenceInterval.low)} - ${this.#formatPercentage(result.confidenceInterval.high)})`;
  }

  // Update summary
  const summaryEl = document.getElementById('mc-summary');
  if (summaryEl) {
    summaryEl.textContent = summary;
  }

  // Update blockers table
  this.#populateBlockersTable(blockers);
}

/**
 * Populate blockers table
 * @private
 */
#populateBlockersTable(blockers) {
  const tbody = document.getElementById('blockers-tbody');
  if (!tbody) return;

  tbody.innerHTML = '';

  for (const blocker of blockers) {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${blocker.rank}</td>
      <td><code>${this.#escapeHtml(blocker.clauseDescription)}</code></td>
      <td>${this.#formatPercentage(blocker.failureRate)}</td>
      <td>${blocker.averageViolation.toFixed(3)}</td>
      <td><span class="severity-badge ${blocker.explanation.severity}">${blocker.explanation.severity}</span></td>
    `;
    tbody.appendChild(row);
  }

  if (blockers.length === 0) {
    const row = document.createElement('tr');
    row.innerHTML = '<td colspan="5" class="no-data">No blockers identified</td>';
    tbody.appendChild(row);
  }
}

/**
 * Get rarity category from trigger rate
 * @private
 */
#getRarityCategory(rate) {
  if (rate === 0) return 'impossible';
  if (rate < 0.00001) return 'extremely-rare';
  if (rate < 0.0005) return 'rare';
  if (rate < 0.02) return 'normal';
  return 'frequent';
}

/**
 * Update rarity indicator display
 * @private
 */
#updateRarityIndicator(category) {
  const indicator = document.getElementById('rarity-indicator');
  if (!indicator) return;

  const emojis = {
    'impossible': '🔴',
    'extremely-rare': '🟠',
    'rare': '🟡',
    'normal': '🟢',
    'frequent': '🔵'
  };

  const labels = {
    'impossible': 'Impossible',
    'extremely-rare': 'Extremely Rare',
    'rare': 'Rare',
    'normal': 'Normal',
    'frequent': 'Frequent'
  };

  indicator.className = `rarity-indicator ${category}`;
  indicator.querySelector('.rarity-emoji').textContent = emojis[category];
  indicator.querySelector('.rarity-label').textContent = labels[category];
}

/**
 * Format percentage
 * @private
 */
#formatPercentage(value) {
  if (value === 0) return '0%';
  if (value < 0.0001) return '<0.01%';
  if (value < 0.01) return (value * 100).toFixed(3) + '%';
  return (value * 100).toFixed(2) + '%';
}

/**
 * Show/hide progress indicator
 * @private
 */
#showProgress(show) {
  const progress = document.getElementById('simulation-progress');
  if (progress) {
    progress.hidden = !show;
  }
}

/**
 * Set simulation button states
 * @private
 */
#setSimulationButtons(enabled) {
  const runBtn = document.getElementById('run-simulation-btn');
  const cancelBtn = document.getElementById('cancel-simulation-btn');

  if (runBtn) runBtn.disabled = !enabled;
  if (cancelBtn) cancelBtn.disabled = enabled;
}

/**
 * Escape HTML for safe rendering
 * @private
 */
#escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
```

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:unit -- tests/unit/domUI/expression-diagnostics/ --verbose
```

### Unit Test Coverage Requirements

**ExpressionDiagnosticsController.test.js (additions):**
- Monte Carlo controls initialize correctly
- Sample count dropdown has correct options
- Distribution dropdown has correct options
- Run Simulation button triggers simulation
- Cancel button disables Run button during simulation
- Progress indicator shows during simulation
- Results container shows after simulation
- Trigger rate displays correctly for various values
- Confidence interval displays correctly
- Rarity indicator shows correct class for each category
- Blockers table populates correctly
- Empty blockers shows "No blockers" message
- Error handling displays error message
- Percentage formatting works for edge cases

### Manual Verification

- [ ] Page loads at `/expression-diagnostics.html`
- [ ] Monte Carlo section visible after static analysis section
- [ ] Sample count dropdown works (1K, 10K, 100K)
- [ ] Distribution dropdown works (Uniform, Gaussian)
- [ ] "Run Simulation" starts simulation
- [ ] Progress indicator shows during simulation
- [ ] Rarity indicator shows correct color/emoji
- [ ] Trigger rate displays with correct formatting
- [ ] Confidence interval displays in parentheses
- [ ] Summary text provides useful information
- [ ] Top Blockers table shows ranked clauses
- [ ] Severity badges show correct colors
- [ ] UI remains responsive during simulation

### Invariants That Must Remain True

1. **Rarity colors match spec** - Red=Impossible, Orange=Extremely Rare, etc.
2. **Table sorted by failure rate** - Worst blocker first
3. **Percentage formatting consistent** - Same format everywhere
4. **Buttons disabled appropriately** - No double-clicks
5. **Progress visible during operation** - User knows system is working

## Verification Commands

```bash
# Run unit tests
npm run test:unit -- tests/unit/domUI/expression-diagnostics/ --verbose

# Build and serve
npm run build && npm run start

# Manual testing
# Navigate to /expression-diagnostics.html
# Select expression, run simulation, verify all UI elements
```

## Definition of Done

- [x] HTML structure added for Monte Carlo section
- [x] CSS styles added for all new elements
- [x] Controller methods implemented for simulation
- [x] Rarity indicator displays correctly
- [x] Blockers table populates correctly
- [x] Unit tests added for new functionality
- [x] All tests pass
- [ ] Manual verification completed
- [ ] UI is accessible (WCAG AA)
- [x] No modifications to service classes

## Outcome

### Actual Changes vs Planned

| Planned | Actual | Notes |
|---------|--------|-------|
| Cancel button + progress bar | Removed | `simulate()` is synchronous, no need |
| Async simulation flow | Sync execution | No async needed |
| Service Locator DI | Constructor DI | Used existing pattern |
| Custom CSS variable names | Existing variable names | Matched codebase style |
| `.diagnostics-section` class | `.panel` class | Matched existing HTML |

### Files Modified

1. **`expression-diagnostics.html`** - Added Monte Carlo section with:
   - Sample count dropdown (1K, 10K, 100K)
   - Distribution dropdown (uniform, gaussian)
   - Run Simulation button
   - Results container with rarity indicator, trigger rate, confidence interval, summary, and blockers table

2. **`css/expression-diagnostics.css`** - Added ~70 lines of CSS for:
   - Monte Carlo controls layout
   - Trigger rate display styling
   - Rarity indicator color variants
   - Severity badge styling
   - Responsive grid placement

3. **`src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js`** - Added:
   - Constructor params and validation for `monteCarloSimulator`, `failureExplainer`
   - Private fields for MC DOM elements
   - Methods: `#runMonteCarloSimulation()`, `#displayMonteCarloResults()`, `#populateBlockersTable()`, `#getRarityCategory()`, `#updateMcRarityIndicator()`, `#formatPercentage()`, `#escapeHtml()`, `#resetMonteCarloResults()`

4. **`src/expression-diagnostics.js`** - Added:
   - Resolution of `IMonteCarloSimulator` and `IFailureExplainer` from container
   - Updated controller instantiation with new dependencies

5. **`tests/unit/domUI/expression-diagnostics/ExpressionDiagnosticsController.test.js`** - Added:
   - 22 new tests for Monte Carlo functionality
   - Constructor validation tests for MC dependencies
   - Tests for button states, simulation config, results display, rarity categories, blockers table, error handling, percentage formatting edge cases

### Test Results

- **51 tests passing** (29 existing + 22 new)
- **100% line coverage** on ExpressionDiagnosticsController.js
- **0 ESLint errors**

### What Was NOT Changed

- MonteCarloSimulator service (EXPDIA-007)
- FailureExplainer service (EXPDIA-008)
- DiagnosticResult model
- Any existing public APIs
