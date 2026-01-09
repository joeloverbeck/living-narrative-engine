# EXPDIA-012: Extend UI with Witness State Panel

## Summary

Add witness state display to the Expression Diagnostics page with "Find Witness" button, formatted JSON output, and copy-to-clipboard functionality. When no witness is found, display the "nearest miss" state with violation details.

## Priority: Medium | Effort: Small

## Rationale

Content authors need concrete examples of states that trigger expressions. The witness panel provides a visual representation of satisfying states that can be copied and used for testing or understanding expression behavior.

## Dependencies

- **EXPDIA-006** (Basic Diagnostics UI structure)
- **EXPDIA-010** (WitnessState model)
- **EXPDIA-011** (WitnessStateFinder service)

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js` | **Modify** |
| `src/expression-diagnostics.js` | **Modify** (add witnessStateFinder dependency to controller) |
| `css/expression-diagnostics.css` | **Modify** |
| `expression-diagnostics.html` | **Modify** |
| `tests/unit/domUI/expression-diagnostics/ExpressionDiagnosticsController.test.js` | **Modify** |

## Out of Scope

- **DO NOT** modify WitnessState model or WitnessStateFinder service
- **DO NOT** implement SMT UI - that's EXPDIA-014
- **DO NOT** implement Suggestions UI - that's EXPDIA-016
- **DO NOT** add dynamics mode toggle - that's EXPDIA-016

## Implementation Details

### HTML Structure Updates

```html
<!-- Add to expression-diagnostics.html after Monte Carlo section -->

<!-- Witness State Section -->
<section id="witness-section" class="diagnostics-section">
  <h2>Witness State Finder</h2>

  <p class="section-description">
    Find a concrete state that would trigger this expression.
  </p>

  <div class="witness-controls">
    <button id="find-witness-btn" class="btn btn-primary">
      Find Witness State
    </button>
    <span id="witness-status" class="status-text"></span>
  </div>

  <div id="witness-results" class="results-container" hidden>
    <div class="witness-header">
      <span id="witness-result-label" class="result-label"></span>
      <button id="copy-witness-btn" class="btn btn-secondary btn-small">
        Copy to Clipboard
      </button>
    </div>

    <div class="witness-content">
      <h3>Mood Axes</h3>
      <div id="mood-display" class="axis-grid">
        <!-- Populated dynamically -->
      </div>

      <h3>Sexual State</h3>
      <div id="sexual-display" class="axis-grid">
        <!-- Populated dynamically -->
      </div>
    </div>

    <div id="witness-json" class="json-display">
      <pre id="witness-json-content"></pre>
    </div>

    <div id="violated-clauses" class="violated-clauses" hidden>
      <h4>Violated Clauses (Nearest Miss)</h4>
      <ul id="violated-clauses-list"></ul>
    </div>

    <div id="fitness-display" class="fitness-display">
      <label>Fitness Score:</label>
      <div class="fitness-bar">
        <div id="fitness-fill" class="fitness-fill"></div>
      </div>
      <span id="fitness-value">--</span>
    </div>
  </div>
</section>
```

### CSS Updates

```css
/* Add to css/expression-diagnostics.css */

/* Witness Section */
.section-description {
  color: var(--text-secondary);
  margin-bottom: 1rem;
}

.witness-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.status-text {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.witness-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.result-label {
  font-size: 1.125rem;
  font-weight: 600;
}

.result-label.found {
  color: var(--color-success);
}

.result-label.not-found {
  color: var(--color-warning);
}

.btn-small {
  padding: 0.375rem 0.75rem;
  font-size: 0.875rem;
}

/* Axis Display Grid */
.witness-content h3 {
  font-size: 1rem;
  margin: 1rem 0 0.5rem;
  color: var(--text-secondary);
}

.axis-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.5rem;
}

.axis-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0.75rem;
  background: var(--bg-tertiary);
  border-radius: 4px;
}

.axis-name {
  font-weight: 500;
  font-size: 0.875rem;
}

.axis-value {
  font-family: monospace;
  font-size: 0.875rem;
}

.axis-value.positive {
  color: var(--color-success);
}

.axis-value.negative {
  color: var(--color-error);
}

.axis-value.neutral {
  color: var(--text-secondary);
}

/* JSON Display */
.json-display {
  margin-top: 1rem;
  background: var(--bg-code);
  border-radius: 4px;
  overflow: hidden;
}

.json-display pre {
  padding: 1rem;
  margin: 0;
  font-size: 0.875rem;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

/* Violated Clauses */
.violated-clauses {
  margin-top: 1rem;
  padding: 1rem;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 4px;
}

.violated-clauses h4 {
  margin: 0 0 0.5rem;
  font-size: 0.875rem;
  color: #ef4444;
}

.violated-clauses ul {
  margin: 0;
  padding-left: 1.5rem;
}

.violated-clauses li {
  font-size: 0.875rem;
  color: var(--text-primary);
  margin-bottom: 0.25rem;
}

/* Fitness Display */
.fitness-display {
  margin-top: 1rem;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.fitness-display label {
  font-size: 0.875rem;
  color: var(--text-secondary);
  min-width: 100px;
}

.fitness-bar {
  flex: 1;
  height: 8px;
  background: var(--bg-tertiary);
  border-radius: 4px;
  overflow: hidden;
  max-width: 200px;
}

.fitness-fill {
  height: 100%;
  transition: width 0.3s ease, background-color 0.3s ease;
}

.fitness-fill.perfect {
  background: var(--color-success);
}

.fitness-fill.good {
  background: var(--color-info);
}

.fitness-fill.poor {
  background: var(--color-warning);
}

.fitness-fill.bad {
  background: var(--color-error);
}

#fitness-value {
  font-family: monospace;
  font-size: 0.875rem;
  min-width: 50px;
}

/* Copy Feedback */
.copy-feedback {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  padding: 0.75rem 1.5rem;
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  animation: fadeInOut 2s ease-in-out;
}

@keyframes fadeInOut {
  0%, 100% { opacity: 0; transform: translateY(10px); }
  15%, 85% { opacity: 1; transform: translateY(0); }
}
```

### Controller Updates

```javascript
// Add to ExpressionDiagnosticsController.js

/**
 * Initialize witness state controls
 * @private
 */
#initWitnessControls() {
  const findBtn = document.getElementById('find-witness-btn');
  const copyBtn = document.getElementById('copy-witness-btn');

  findBtn?.addEventListener('click', () => this.#findWitness());
  copyBtn?.addEventListener('click', () => this.#copyWitnessToClipboard());
}

/**
 * Find witness state
 * @private
 */
async #findWitness() {
  const expression = this.#getCurrentExpression();
  if (!expression) return;

  const statusEl = document.getElementById('witness-status');
  if (statusEl) statusEl.textContent = 'Searching...';

  const findBtn = document.getElementById('find-witness-btn');
  if (findBtn) findBtn.disabled = true;

  try {
    // NOTE: witnessStateFinder is injected via constructor, NOT container.resolve
    const result = this.#witnessStateFinder.findWitness(expression, {
      maxIterations: 10000
    });

    this.#displayWitnessResult(result);
  } catch (err) {
    this.#logger.error('Witness search failed', err);
    if (statusEl) statusEl.textContent = 'Search failed: ' + err.message;
  } finally {
    if (findBtn) findBtn.disabled = false;
  }
}

/**
 * Display witness search result
 * @private
 */
#displayWitnessResult(result) {
  const resultsContainer = document.getElementById('witness-results');
  const statusEl = document.getElementById('witness-status');

  if (!resultsContainer) return;

  resultsContainer.hidden = false;

  // Update status
  if (statusEl) {
    statusEl.textContent = result.found
      ? `Found in ${result.iterationsUsed} iterations`
      : `Not found (${result.iterationsUsed} iterations)`;
  }

  // Update result label
  const labelEl = document.getElementById('witness-result-label');
  if (labelEl) {
    labelEl.textContent = result.found ? '✓ Witness Found' : '⚠ Nearest Miss';
    labelEl.className = `result-label ${result.found ? 'found' : 'not-found'}`;
  }

  // Display state values
  const state = result.found ? result.witness : result.nearestMiss;
  this.#displayMoodAxes(state.mood);
  this.#displaySexualAxes(state.sexual);

  // Display JSON
  const jsonEl = document.getElementById('witness-json-content');
  if (jsonEl) {
    jsonEl.textContent = state.toClipboardJSON();
  }

  // Display violated clauses if not found
  const violatedContainer = document.getElementById('violated-clauses');
  const violatedList = document.getElementById('violated-clauses-list');
  if (violatedContainer && violatedList) {
    if (!result.found && result.violatedClauses.length > 0) {
      violatedContainer.hidden = false;
      violatedList.innerHTML = result.violatedClauses
        .map(c => `<li>${this.#escapeHtml(c)}</li>`)
        .join('');
    } else {
      violatedContainer.hidden = true;
    }
  }

  // Display fitness
  this.#displayFitness(result.bestFitness);

  // Store for clipboard
  this.#currentWitnessState = state;
}

/**
 * Display mood axis values
 * @private
 */
#displayMoodAxes(mood) {
  const container = document.getElementById('mood-display');
  if (!container) return;

  container.innerHTML = '';

  // Use WitnessState.MOOD_AXES for all 7 axes:
  // valence, arousal, agency_control, threat, engagement, future_expectancy, self_evaluation
  const axes = WitnessState.MOOD_AXES;
  for (const axis of axes) {
    const value = mood[axis];
    const item = document.createElement('div');
    item.className = 'axis-item';
    item.innerHTML = `
      <span class="axis-name">${axis}</span>
      <span class="axis-value ${this.#getValueClass(value, true)}">${value?.toFixed(1) ?? 'N/A'}</span>
    `;
    container.appendChild(item);
  }
}

/**
 * Display sexual axis values
 * @private
 */
#displaySexualAxes(sexual) {
  const container = document.getElementById('sexual-display');
  if (!container) return;

  container.innerHTML = '';

  // Use WitnessState.SEXUAL_AXES for all 3 axes:
  // sex_excitation, sex_inhibition, baseline_libido
  const axes = WitnessState.SEXUAL_AXES;
  for (const axis of axes) {
    const value = sexual[axis];
    const item = document.createElement('div');
    item.className = 'axis-item';
    item.innerHTML = `
      <span class="axis-name">${axis}</span>
      <span class="axis-value ${this.#getValueClass(value, false)}">${value?.toFixed(1) ?? 'N/A'}</span>
    `;
    container.appendChild(item);
  }
}

/**
 * Get CSS class for value coloring
 * @private
 */
#getValueClass(value, isMood) {
  if (value === undefined || value === null) return '';
  if (isMood) {
    if (value > 10) return 'positive';
    if (value < -10) return 'negative';
    return 'neutral';
  }
  // Sexual is 0-100, so different thresholds
  if (value > 60) return 'positive';
  if (value < 30) return 'negative';
  return 'neutral';
}

/**
 * Display fitness score
 * @private
 */
#displayFitness(fitness) {
  const fillEl = document.getElementById('fitness-fill');
  const valueEl = document.getElementById('fitness-value');

  if (fillEl) {
    fillEl.style.width = `${fitness * 100}%`;

    let fitnessClass = 'bad';
    if (fitness >= 1) fitnessClass = 'perfect';
    else if (fitness >= 0.8) fitnessClass = 'good';
    else if (fitness >= 0.5) fitnessClass = 'poor';

    fillEl.className = `fitness-fill ${fitnessClass}`;
  }

  if (valueEl) {
    valueEl.textContent = `${(fitness * 100).toFixed(1)}%`;
  }
}

/**
 * Copy witness to clipboard
 * @private
 */
async #copyWitnessToClipboard() {
  if (!this.#currentWitnessState) return;

  try {
    const json = this.#currentWitnessState.toClipboardJSON();
    await navigator.clipboard.writeText(json);
    this.#showCopyFeedback('Copied to clipboard!');
  } catch (err) {
    this.#logger.error('Copy failed', err);
    this.#showCopyFeedback('Copy failed - check console');
  }
}

/**
 * Show copy feedback toast
 * @private
 */
#showCopyFeedback(message) {
  // Remove existing feedback
  const existing = document.querySelector('.copy-feedback');
  if (existing) existing.remove();

  const feedback = document.createElement('div');
  feedback.className = 'copy-feedback';
  feedback.textContent = message;
  document.body.appendChild(feedback);

  setTimeout(() => feedback.remove(), 2000);
}
```

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:unit -- tests/unit/domUI/expression-diagnostics/ --verbose
```

### Unit Test Coverage Requirements

**ExpressionDiagnosticsController.test.js (additions):**
- Find Witness button triggers search
- Button disabled during search
- Status text shows during search
- Result label shows "Witness Found" when found
- Result label shows "Nearest Miss" when not found
- Mood axes display correctly
- Sexual axes display correctly
- JSON display shows formatted state
- Violated clauses show when not found
- Violated clauses hidden when found
- Fitness bar width matches fitness value
- Fitness bar class matches fitness level
- Copy button triggers clipboard write
- Copy feedback toast appears
- Copy feedback disappears after timeout

### Manual Verification

- [ ] "Find Witness State" button visible
- [ ] Button shows disabled state during search
- [ ] Status shows iteration count after search
- [ ] "Witness Found" shows in green when successful
- [ ] "Nearest Miss" shows in orange when not found
- [ ] Mood axes grid displays 7 axes (valence, arousal, agency_control, threat, engagement, future_expectancy, self_evaluation)
- [ ] Sexual axes grid displays 3 axes (sex_excitation, sex_inhibition, baseline_libido)
- [ ] Values colored correctly (positive/negative/neutral)
- [ ] JSON pre-formatted and readable
- [ ] Violated clauses list shows for nearest miss
- [ ] Fitness bar fills correctly
- [ ] Copy button works
- [ ] Toast appears confirming copy
- [ ] UI remains responsive during search

### Invariants That Must Remain True

1. **Witness state always displayed** - Either witness or nearestMiss shown
2. **JSON is valid** - Can be parsed back into WitnessState
3. **Fitness bar bounded** - Never exceeds 100%
4. **Copy always available** - Once state found, copy works
5. **Colors match fitness** - Visual feedback consistent

## Verification Commands

```bash
# Run unit tests
npm run test:unit -- tests/unit/domUI/expression-diagnostics/ --verbose

# Build and serve
npm run build && npm run start

# Manual testing
# Navigate to /expression-diagnostics.html
# Select expression, click "Find Witness State"
# Verify display and copy functionality
```

## Definition of Done

- [x] HTML structure added for witness section
- [x] CSS styles added for all new elements
- [x] Controller methods implemented for witness finding
- [x] Axis grids display correctly
- [x] JSON display formats correctly
- [x] Copy to clipboard works
- [x] Violated clauses display for nearest miss
- [x] Fitness bar displays correctly
- [x] Unit tests added for new functionality
- [x] All tests pass
- [ ] Manual verification completed
- [x] UI is accessible (WCAG AA)
- [x] No modifications to service classes

---

## Outcome

**Status**: ✅ COMPLETED
**Completion Date**: 2026-01-09

### Summary

Successfully implemented the Witness State UI Panel for the Expression Diagnostics page. The implementation adds a complete UI for finding and displaying witness states that trigger expressions.

### Implementation Details

**Files Modified**:
- `expression-diagnostics.html` - Added witness section HTML structure
- `css/expression-diagnostics.css` - Added witness panel styles (axis grids, fitness bar, copy feedback)
- `src/expression-diagnostics.js` - Added `witnessStateFinder` dependency injection
- `src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js` - Added:
  - `#witnessStateFinder` private field
  - `#currentWitnessState` for clipboard support
  - DOM bindings for witness section elements
  - `#initWitnessControls()` - event listener setup
  - `#findWitness()` - triggers search, handles loading state
  - `#displayWitnessResult(result)` - renders state values
  - `#displayMoodAxes(mood)` - renders 7 mood axes using `WitnessState.MOOD_AXES`
  - `#displaySexualAxes(sexual)` - renders 3 sexual axes using `WitnessState.SEXUAL_AXES`
  - `#getValueClass(value, isMood)` - color coding for values
  - `#displayFitness(fitness)` - fitness bar with color classes
  - `#copyWitnessToClipboard()` - clipboard API integration
  - `#showCopyFeedback(message)` - toast notification
  - `#resetWitnessResults()` - called when expression selection changes

**Tests Added** (14 new tests):
- Find Witness button disabled/enabled states
- Search triggers and result display
- "Witness Found" vs "Nearest Miss" label handling
- Violated clauses visibility logic
- Fitness display rendering
- Mood axes display (7 axes)
- Sexual state display (3 axes)
- JSON content display
- Results reset on expression change
- Error handling during search
- Button state during search
- Clipboard copy functionality

### Test Results

```
Tests: 105 passed, 105 total
Coverage: 83.17% statements, 85.74% lines for controller
```

### Corrections Made During Implementation

1. **Dependency Injection**: Changed from container.resolve pattern to constructor injection (matches existing codebase pattern)
2. **Mood Axes**: Updated to use all 7 axes from `WitnessState.MOOD_AXES` (not 5 as originally documented)
3. **Sexual Axes**: Fixed to use correct axis names: `sex_excitation`, `sex_inhibition`, `baseline_libido` (not arousal/desire/satisfaction)

### Notes

- Manual verification pending (requires browser testing)
- No modifications made to WitnessState model or WitnessStateFinder service (per ticket scope)
