# EXPDIA-016: Add Dynamics Mode and Suggestions to UI

## Summary

Add dynamics mode toggle that constrains analysis to realistic per-turn deltas, and a suggestions panel showing threshold adjustments that would improve trigger rates. Each suggestion displays original value, suggested value, and estimated improvement.

## Priority: Medium | Effort: Medium

## Rationale

Pure mathematical analysis may find states that are reachable in theory but impossible to reach through normal gameplay. Dynamics mode constrains analysis to states reachable within N turns. The suggestions panel turns diagnostic data into actionable guidance for content authors.

## Dependencies

- **EXPDIA-006** (Basic Diagnostics UI structure)
- **EXPDIA-009** (Monte Carlo UI for integration)
- **EXPDIA-012** (Witness State UI for integration)
- **EXPDIA-015** (ThresholdSuggester service)

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js` | **Modify** |
| `css/expression-diagnostics.css` | **Modify** |
| `expression-diagnostics.html` | **Modify** |
| `tests/unit/domUI/expression-diagnostics/ExpressionDiagnosticsController.test.js` | **Modify** |

## Out of Scope

- **DO NOT** modify ThresholdSuggester service - that's EXPDIA-015
- **DO NOT** modify MonteCarloSimulator or WitnessStateFinder services
- **DO NOT** auto-apply suggestions to expression files
- **DO NOT** implement expression export/import functionality
- **DO NOT** add character-specific starting state configuration

## Implementation Details

### HTML Structure Updates

```html
<!-- Add to expression-diagnostics.html at the top of the controls area -->

<!-- Global Analysis Mode -->
<div id="analysis-mode-controls" class="mode-controls">
  <div class="mode-toggle">
    <label class="toggle-label">
      <input type="checkbox" id="dynamics-mode-toggle">
      <span class="toggle-slider"></span>
      <span class="toggle-text">Dynamics Mode</span>
    </label>
    <span class="mode-info" title="Constrain analysis to states reachable through normal gameplay">ⓘ</span>
  </div>

  <div id="dynamics-config" class="dynamics-config" hidden>
    <div class="config-row">
      <label for="max-turns">Max Turns:</label>
      <input type="number" id="max-turns" min="1" max="100" value="10">
    </div>
    <div class="config-row">
      <label for="mood-delta">Mood Delta/Turn:</label>
      <input type="number" id="mood-delta" min="1" max="50" value="10" step="1">
    </div>
    <div class="config-row">
      <label for="sexual-delta">Sexual Delta/Turn:</label>
      <input type="number" id="sexual-delta" min="1" max="20" value="5" step="1">
    </div>
  </div>
</div>

<!-- Add after SMT section -->

<!-- Suggestions Section -->
<section id="suggestions-section" class="diagnostics-section">
  <h2>Threshold Suggestions</h2>

  <p class="section-description">
    Actionable recommendations for improving your expression's trigger rate.
  </p>

  <div class="suggestions-controls">
    <button id="generate-suggestions-btn" class="btn btn-primary">
      Generate Suggestions
    </button>
    <span id="suggestions-status" class="status-text"></span>
  </div>

  <div id="suggestions-results" class="results-container" hidden>
    <div class="suggestions-summary">
      <div class="rate-comparison">
        <div class="rate-item">
          <span class="rate-label">Current Rate</span>
          <span id="current-rate-value" class="rate-value">--</span>
        </div>
        <span class="rate-arrow">→</span>
        <div class="rate-item">
          <span class="rate-label">Potential Rate</span>
          <span id="potential-rate-value" class="rate-value improved">--</span>
        </div>
      </div>
      <p id="suggestions-summary-text" class="summary-text"></p>
    </div>

    <div id="suggestions-list" class="suggestions-list">
      <!-- Populated dynamically -->
    </div>

    <div id="no-suggestions" class="no-suggestions" hidden>
      <p>No threshold adjustments were identified that would significantly improve the trigger rate.</p>
      <p class="hint">Consider reviewing the expression's logic structure or prerequisite requirements.</p>
    </div>
  </div>
</section>
```

### CSS Updates

```css
/* Add to css/expression-diagnostics.css */

/* Mode Controls */
.mode-controls {
  background: var(--bg-secondary);
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1.5rem;
}

.mode-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.toggle-label input {
  display: none;
}

.toggle-slider {
  position: relative;
  width: 48px;
  height: 24px;
  background: var(--bg-tertiary);
  border-radius: 12px;
  transition: background 0.2s;
}

.toggle-slider::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  background: var(--text-secondary);
  border-radius: 50%;
  transition: transform 0.2s, background 0.2s;
}

.toggle-label input:checked + .toggle-slider {
  background: var(--color-primary);
}

.toggle-label input:checked + .toggle-slider::after {
  transform: translateX(24px);
  background: white;
}

.toggle-text {
  font-weight: 500;
}

.mode-info {
  color: var(--text-secondary);
  cursor: help;
  font-size: 0.875rem;
}

/* Dynamics Config */
.dynamics-config {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-color);
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
}

.config-row {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.config-row label {
  font-size: 0.75rem;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.025em;
}

.config-row input {
  padding: 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-primary);
  width: 100%;
}

/* Suggestions Section */
.suggestions-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.suggestions-summary {
  background: var(--bg-secondary);
  padding: 1.5rem;
  border-radius: 8px;
  margin-bottom: 1rem;
}

.rate-comparison {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2rem;
  margin-bottom: 1rem;
}

.rate-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.rate-label {
  font-size: 0.75rem;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.025em;
}

.rate-value {
  font-size: 2rem;
  font-weight: 700;
  color: var(--text-primary);
}

.rate-value.improved {
  color: var(--color-success);
}

.rate-arrow {
  font-size: 1.5rem;
  color: var(--text-secondary);
}

.suggestions-summary .summary-text {
  margin: 0;
  text-align: center;
  color: var(--text-secondary);
  line-height: 1.6;
}

/* Suggestions List */
.suggestions-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.suggestion-card {
  background: var(--bg-secondary);
  border-radius: 8px;
  padding: 1rem;
  border-left: 4px solid var(--color-primary);
}

.suggestion-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.75rem;
}

.suggestion-field {
  font-family: monospace;
  font-size: 0.875rem;
  color: var(--color-primary);
  background: rgba(59, 130, 246, 0.1);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}

.suggestion-improvement {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-success);
}

.suggestion-values {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.75rem;
  font-family: monospace;
}

.value-change {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.value-label {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.value-current {
  color: var(--color-error);
  text-decoration: line-through;
  opacity: 0.7;
}

.value-arrow {
  color: var(--text-secondary);
}

.value-suggested {
  color: var(--color-success);
  font-weight: 600;
}

.suggestion-rationale {
  font-size: 0.875rem;
  color: var(--text-secondary);
  line-height: 1.5;
  margin: 0;
}

.suggestion-actions {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border-color);
  display: flex;
  gap: 0.5rem;
}

/* No Suggestions State */
.no-suggestions {
  text-align: center;
  padding: 2rem;
  background: var(--bg-secondary);
  border-radius: 8px;
}

.no-suggestions p {
  margin: 0;
  color: var(--text-secondary);
}

.no-suggestions .hint {
  margin-top: 0.5rem;
  font-size: 0.875rem;
  opacity: 0.8;
}

/* Dynamics Mode Indicator */
.dynamics-indicator {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  background: rgba(234, 179, 8, 0.2);
  color: #eab308;
  border-radius: 4px;
  margin-left: 0.5rem;
}

.dynamics-indicator::before {
  content: '⚡';
}
```

### Controller Updates

```javascript
// Add to ExpressionDiagnosticsController.js

/** @type {boolean} */
#dynamicsMode = false;

/** @type {object} */
#dynamicsConfig = {
  maxTurns: 10,
  moodDelta: 10,
  sexualDelta: 5
};

/** @type {object|null} */
#lastMcResult = null;

/**
 * Initialize dynamics mode controls
 * @private
 */
#initDynamicsControls() {
  const toggle = document.getElementById('dynamics-mode-toggle');
  const maxTurns = document.getElementById('max-turns');
  const moodDelta = document.getElementById('mood-delta');
  const sexualDelta = document.getElementById('sexual-delta');

  toggle?.addEventListener('change', (e) => {
    this.#dynamicsMode = e.target.checked;
    this.#updateDynamicsConfigVisibility();
    this.#updateDynamicsIndicators();
  });

  maxTurns?.addEventListener('change', (e) => {
    this.#dynamicsConfig.maxTurns = parseInt(e.target.value, 10);
  });

  moodDelta?.addEventListener('change', (e) => {
    this.#dynamicsConfig.moodDelta = parseInt(e.target.value, 10);
  });

  sexualDelta?.addEventListener('change', (e) => {
    this.#dynamicsConfig.sexualDelta = parseInt(e.target.value, 10);
  });
}

/**
 * Update dynamics config visibility
 * @private
 */
#updateDynamicsConfigVisibility() {
  const configEl = document.getElementById('dynamics-config');
  if (configEl) {
    configEl.hidden = !this.#dynamicsMode;
  }
}

/**
 * Update dynamics mode indicators across sections
 * @private
 */
#updateDynamicsIndicators() {
  const sections = ['monte-carlo-section', 'witness-section', 'suggestions-section'];

  for (const sectionId of sections) {
    const section = document.getElementById(sectionId);
    if (!section) continue;

    const h2 = section.querySelector('h2');
    if (!h2) continue;

    // Remove existing indicator
    const existing = h2.querySelector('.dynamics-indicator');
    if (existing) existing.remove();

    // Add indicator if dynamics mode enabled
    if (this.#dynamicsMode) {
      const indicator = document.createElement('span');
      indicator.className = 'dynamics-indicator';
      indicator.textContent = `${this.#dynamicsConfig.maxTurns} turns`;
      indicator.title = `Constrained to ${this.#dynamicsConfig.maxTurns} turns max`;
      h2.appendChild(indicator);
    }
  }
}

/**
 * Get dynamics constraints for analysis
 * @private
 */
#getDynamicsConstraints() {
  if (!this.#dynamicsMode) return null;

  return {
    maxTurns: this.#dynamicsConfig.maxTurns,
    moodDelta: this.#dynamicsConfig.moodDelta,
    sexualDelta: this.#dynamicsConfig.sexualDelta
  };
}

/**
 * Initialize suggestions controls
 * @private
 */
#initSuggestionsControls() {
  const generateBtn = document.getElementById('generate-suggestions-btn');
  generateBtn?.addEventListener('click', () => this.#generateSuggestions());
}

/**
 * Generate threshold suggestions
 * @private
 */
async #generateSuggestions() {
  const expression = this.#getCurrentExpression();
  if (!expression) return;

  // Require Monte Carlo to have been run first
  if (!this.#lastMcResult) {
    this.#showSuggestionsError('Run Monte Carlo simulation first to generate suggestions.');
    return;
  }

  const statusEl = document.getElementById('suggestions-status');
  const generateBtn = document.getElementById('generate-suggestions-btn');

  if (statusEl) statusEl.textContent = 'Analyzing...';
  if (generateBtn) generateBtn.disabled = true;

  try {
    const suggester = this.#container.resolve('IThresholdSuggester');

    const result = suggester.generateSuggestions(expression, this.#lastMcResult, {
      maxSuggestions: 5,
      conservativeMode: true
    });

    this.#displaySuggestions(result);
  } catch (err) {
    this.#logger.error('Suggestion generation failed', err);
    this.#showSuggestionsError('Failed to generate suggestions: ' + err.message);
  } finally {
    if (generateBtn) generateBtn.disabled = false;
    if (statusEl) statusEl.textContent = '';
  }
}

/**
 * Display suggestions results
 * @private
 */
#displaySuggestions(result) {
  const resultsEl = document.getElementById('suggestions-results');
  const listEl = document.getElementById('suggestions-list');
  const noSuggestionsEl = document.getElementById('no-suggestions');

  if (!resultsEl) return;

  resultsEl.hidden = false;

  // Update rate comparison
  const currentRateEl = document.getElementById('current-rate-value');
  const potentialRateEl = document.getElementById('potential-rate-value');
  const summaryTextEl = document.getElementById('suggestions-summary-text');

  if (currentRateEl) {
    currentRateEl.textContent = this.#formatPercentage(result.currentRate);
  }

  if (potentialRateEl) {
    potentialRateEl.textContent = this.#formatPercentage(result.bestPossibleRate);
  }

  if (summaryTextEl) {
    summaryTextEl.textContent = result.summary;
  }

  // Display suggestions or no-suggestions message
  if (result.suggestions.length === 0) {
    if (listEl) listEl.innerHTML = '';
    if (noSuggestionsEl) noSuggestionsEl.hidden = false;
  } else {
    if (noSuggestionsEl) noSuggestionsEl.hidden = true;
    this.#populateSuggestionsList(result.suggestions, listEl);
  }
}

/**
 * Populate suggestions list
 * @private
 */
#populateSuggestionsList(suggestions, listEl) {
  if (!listEl) return;

  listEl.innerHTML = '';

  for (const suggestion of suggestions) {
    const card = document.createElement('div');
    card.className = 'suggestion-card';
    card.innerHTML = `
      <div class="suggestion-header">
        <span class="suggestion-field">${this.#escapeHtml(suggestion.field)}</span>
        <span class="suggestion-improvement">+${(suggestion.improvement * 100).toFixed(2)}%</span>
      </div>

      <div class="suggestion-values">
        <span class="value-label">${suggestion.operator}</span>
        <div class="value-change">
          <span class="value-current">${suggestion.currentThreshold}</span>
          <span class="value-arrow">→</span>
          <span class="value-suggested">${suggestion.suggestedThreshold}</span>
        </div>
      </div>

      <p class="suggestion-rationale">${this.#escapeHtml(suggestion.rationale)}</p>

      <div class="suggestion-actions">
        <button class="btn btn-secondary btn-small copy-suggestion-btn"
                data-field="${this.#escapeHtml(suggestion.field)}"
                data-value="${suggestion.suggestedThreshold}">
          Copy Value
        </button>
      </div>
    `;

    // Add click handler for copy button
    const copyBtn = card.querySelector('.copy-suggestion-btn');
    copyBtn?.addEventListener('click', () => {
      this.#copySuggestionValue(suggestion);
    });

    listEl.appendChild(card);
  }
}

/**
 * Copy suggestion value to clipboard
 * @private
 */
async #copySuggestionValue(suggestion) {
  try {
    const text = `${suggestion.field}: ${suggestion.suggestedThreshold}`;
    await navigator.clipboard.writeText(text);
    this.#showCopyFeedback('Suggestion copied!');
  } catch (err) {
    this.#logger.error('Copy failed', err);
    this.#showCopyFeedback('Copy failed');
  }
}

/**
 * Show suggestions error
 * @private
 */
#showSuggestionsError(message) {
  const resultsEl = document.getElementById('suggestions-results');
  const listEl = document.getElementById('suggestions-list');
  const noSuggestionsEl = document.getElementById('no-suggestions');

  if (resultsEl) resultsEl.hidden = false;
  if (listEl) listEl.innerHTML = '';
  if (noSuggestionsEl) {
    noSuggestionsEl.hidden = false;
    const p = noSuggestionsEl.querySelector('p');
    if (p) p.textContent = message;
  }
}

// Update Monte Carlo simulation to store result
// (Modify existing #runSimulation method)
// After: this.#displayMonteCarloResults(result, blockers, summary);
// Add: this.#lastMcResult = result;
```

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:unit -- tests/unit/domUI/expression-diagnostics/ --verbose
```

### Unit Test Coverage Requirements

**ExpressionDiagnosticsController.test.js (additions):**
- Dynamics mode toggle shows/hides config
- Dynamics mode updates indicators on sections
- Max turns input updates config
- Mood delta input updates config
- Sexual delta input updates config
- Generate Suggestions requires MC result first
- Generate Suggestions button triggers generation
- Suggestions summary displays current/potential rates
- Suggestion cards display field and values
- Suggestion cards display improvement percentage
- Suggestion cards display rationale
- No suggestions state displays correctly
- Copy suggestion button copies value
- Dynamics indicators appear when mode enabled
- Dynamics indicators show turn count
- Error message displays when generation fails
- MC result stored for suggestions

### Manual Verification

- [ ] Dynamics mode toggle works
- [ ] Config inputs appear when mode enabled
- [ ] Section headers show dynamics indicator
- [ ] Indicator shows configured turn count
- [ ] "Generate Suggestions" requires MC first
- [ ] Suggestions show current vs potential rate
- [ ] Each suggestion shows field and values
- [ ] Original value has strikethrough
- [ ] Suggested value highlighted green
- [ ] Improvement percentage displayed
- [ ] Rationale text is readable
- [ ] Copy button copies value
- [ ] No suggestions message displays when appropriate
- [ ] UI responsive during generation

### Invariants That Must Remain True

1. **Dynamics indicators sync** - All sections show same mode state
2. **MC prerequisite enforced** - Suggestions require MC result
3. **Suggestions actionable** - Every suggestion has copy button
4. **Config persists** - Values maintained across analyses
5. **No auto-apply** - Never modify expression files

## Verification Commands

```bash
# Run unit tests
npm run test:unit -- tests/unit/domUI/expression-diagnostics/ --verbose

# Build and serve
npm run build && npm run start

# Manual testing
# Navigate to /expression-diagnostics.html
# Toggle dynamics mode, configure values
# Run Monte Carlo simulation
# Generate suggestions
# Verify display and copy functionality
```

## Definition of Done

- [ ] HTML structure added for dynamics controls and suggestions
- [ ] CSS styles added for all new elements
- [ ] Dynamics mode toggle implemented
- [ ] Dynamics config inputs functional
- [ ] Section indicators update correctly
- [ ] Generate Suggestions implemented
- [ ] Suggestion cards display correctly
- [ ] Copy suggestion value works
- [ ] No suggestions state handled
- [ ] Unit tests added for new functionality
- [ ] All tests pass
- [ ] Manual verification completed
- [ ] UI is accessible (WCAG AA)
- [ ] No modifications to ThresholdSuggester service
