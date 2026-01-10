# EXPDIA-014: Add SMT Analysis to UI with Unsat Core Display

> **STATUS: REJECTED (2026-01-09)**
>
> **Reason**: Depends on EXPDIA-013 (SmtSolver service) which was rejected. The existing UI already surfaces static analysis conflicts and Monte Carlo results, which provide equivalent diagnostic value without the 5MB Z3 WASM dependency.
>
> See analysis: `.claude/plans/binary-strolling-wolf.md`

---

## Summary

Add SMT solver integration to the Expression Diagnostics page with "Run SMT Analysis" button, loading indicator during Z3 initialization, SAT/UNSAT result display, and human-readable unsat core presentation for impossible expressions.

## Priority: Medium | Effort: Medium

## Rationale

While Monte Carlo shows probability, SMT analysis provides mathematical certainty. When an expression is truly impossible, the unsat core tells content authors exactly which combination of constraints creates the contradiction - information that random sampling cannot provide.

## Dependencies

- **EXPDIA-006** (Basic Diagnostics UI structure)
- **EXPDIA-013** (SmtSolver service)

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js` | **Modify** |
| `css/expression-diagnostics.css` | **Modify** |
| `expression-diagnostics.html` | **Modify** |
| `tests/unit/domUI/expression-diagnostics/ExpressionDiagnosticsController.test.js` | **Modify** |

## Out of Scope

- **DO NOT** modify SmtSolver service - that's EXPDIA-013
- **DO NOT** implement ThresholdSuggester - that's EXPDIA-015
- **DO NOT** implement Suggestions UI - that's EXPDIA-016
- **DO NOT** add dynamics mode toggle - that's EXPDIA-016
- **DO NOT** optimize Z3 bundle size - future work

## Implementation Details

### HTML Structure Updates

```html
<!-- Add to expression-diagnostics.html after Witness State section -->

<!-- SMT Analysis Section -->
<section id="smt-section" class="diagnostics-section">
  <h2>Formal Verification (SMT Solver)</h2>

  <p class="section-description">
    Mathematically prove whether this expression can ever trigger.
    Uses Z3 theorem prover for formal verification.
  </p>

  <div class="smt-controls">
    <button id="run-smt-btn" class="btn btn-primary">
      Run SMT Analysis
    </button>
    <span id="smt-status" class="status-text"></span>
  </div>

  <div id="smt-loading" class="loading-container" hidden>
    <div class="loading-spinner"></div>
    <span class="loading-text">Loading Z3 solver (~5MB)...</span>
  </div>

  <div id="smt-results" class="results-container" hidden>
    <div class="smt-verdict">
      <span id="smt-verdict-icon" class="verdict-icon"></span>
      <span id="smt-verdict-label" class="verdict-label"></span>
    </div>

    <div id="smt-sat-result" class="sat-result" hidden>
      <h3>Satisfying Assignment Found</h3>
      <p class="result-description">
        This expression is mathematically possible. The solver found a concrete
        state that satisfies all prerequisites.
      </p>
      <div id="smt-model-display" class="model-display">
        <pre id="smt-model-content"></pre>
      </div>
      <button id="copy-smt-model-btn" class="btn btn-secondary btn-small">
        Copy Model
      </button>
    </div>

    <div id="smt-unsat-result" class="unsat-result" hidden>
      <h3>Mathematically Impossible</h3>
      <p class="result-description">
        No state can ever satisfy all prerequisites simultaneously.
        The following constraints form an unsatisfiable core:
      </p>

      <div id="unsat-core-display" class="unsat-core">
        <h4>Conflicting Constraints</h4>
        <ul id="unsat-core-list"></ul>
      </div>

      <div id="unsat-explanation" class="unsat-explanation">
        <h4>Why This Is Impossible</h4>
        <p id="unsat-explanation-text"></p>
      </div>
    </div>

    <div id="smt-error-result" class="error-result" hidden>
      <h3>Analysis Failed</h3>
      <p id="smt-error-message"></p>
    </div>

    <div class="smt-timing">
      <label>Analysis Time:</label>
      <span id="smt-timing-value">--</span>
    </div>
  </div>
</section>
```

### CSS Updates

```css
/* Add to css/expression-diagnostics.css */

/* SMT Section */
.smt-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

/* Loading State */
.loading-container {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 2rem;
  background: var(--bg-secondary);
  border-radius: 8px;
  margin: 1rem 0;
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border: 3px solid var(--border-color);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  color: var(--text-secondary);
}

/* Verdict Display */
.smt-verdict {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.5rem;
  background: var(--bg-secondary);
  border-radius: 8px;
  margin-bottom: 1rem;
}

.verdict-icon {
  font-size: 2rem;
}

.verdict-label {
  font-size: 1.5rem;
  font-weight: 700;
}

.smt-verdict.sat {
  border-left: 4px solid var(--color-success);
}

.smt-verdict.sat .verdict-label {
  color: var(--color-success);
}

.smt-verdict.unsat {
  border-left: 4px solid var(--color-error);
}

.smt-verdict.unsat .verdict-label {
  color: var(--color-error);
}

.smt-verdict.error {
  border-left: 4px solid var(--color-warning);
}

.smt-verdict.error .verdict-label {
  color: var(--color-warning);
}

/* SAT Result */
.sat-result {
  margin-top: 1rem;
}

.sat-result h3 {
  color: var(--color-success);
  margin-bottom: 0.5rem;
}

.result-description {
  color: var(--text-secondary);
  margin-bottom: 1rem;
}

.model-display {
  background: var(--bg-code);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 1rem;
}

.model-display pre {
  padding: 1rem;
  margin: 0;
  font-size: 0.875rem;
  overflow-x: auto;
  white-space: pre-wrap;
}

/* UNSAT Result */
.unsat-result {
  margin-top: 1rem;
}

.unsat-result h3 {
  color: var(--color-error);
  margin-bottom: 0.5rem;
}

.unsat-core {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 4px;
  padding: 1rem;
  margin: 1rem 0;
}

.unsat-core h4 {
  margin: 0 0 0.75rem;
  font-size: 0.875rem;
  color: #ef4444;
}

.unsat-core ul {
  margin: 0;
  padding-left: 1.5rem;
}

.unsat-core li {
  margin-bottom: 0.5rem;
  font-family: monospace;
  font-size: 0.875rem;
}

.unsat-core li code {
  background: rgba(0, 0, 0, 0.2);
  padding: 0.125rem 0.375rem;
  border-radius: 3px;
}

.unsat-explanation {
  background: var(--bg-tertiary);
  border-radius: 4px;
  padding: 1rem;
  margin-top: 1rem;
}

.unsat-explanation h4 {
  margin: 0 0 0.5rem;
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.unsat-explanation p {
  margin: 0;
  line-height: 1.6;
}

/* Error Result */
.error-result {
  margin-top: 1rem;
}

.error-result h3 {
  color: var(--color-warning);
  margin-bottom: 0.5rem;
}

#smt-error-message {
  color: var(--text-secondary);
  font-family: monospace;
  background: var(--bg-code);
  padding: 1rem;
  border-radius: 4px;
}

/* Timing Display */
.smt-timing {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--text-secondary);
}

#smt-timing-value {
  font-family: monospace;
}
```

### Controller Updates

```javascript
// Add to ExpressionDiagnosticsController.js

/** @type {boolean} */
#z3Loaded = false;

/** @type {object|null} */
#smtSolver = null;

/**
 * Initialize SMT controls
 * @private
 */
#initSmtControls() {
  const runBtn = document.getElementById('run-smt-btn');
  const copyBtn = document.getElementById('copy-smt-model-btn');

  runBtn?.addEventListener('click', () => this.#runSmtAnalysis());
  copyBtn?.addEventListener('click', () => this.#copySmtModel());
}

/**
 * Run SMT analysis
 * @private
 */
async #runSmtAnalysis() {
  const expression = this.#getCurrentExpression();
  if (!expression) return;

  const statusEl = document.getElementById('smt-status');
  const loadingEl = document.getElementById('smt-loading');
  const resultsEl = document.getElementById('smt-results');
  const runBtn = document.getElementById('run-smt-btn');

  // Reset state
  if (resultsEl) resultsEl.hidden = true;
  if (runBtn) runBtn.disabled = true;

  try {
    // Show loading if Z3 not yet loaded
    if (!this.#z3Loaded) {
      if (loadingEl) loadingEl.hidden = false;
      if (statusEl) statusEl.textContent = 'Loading Z3 solver...';
    } else {
      if (statusEl) statusEl.textContent = 'Analyzing...';
    }

    const startTime = performance.now();

    // Lazy load SMT solver
    if (!this.#smtSolver) {
      this.#smtSolver = await this.#container.resolve('ISmtSolver');
      this.#z3Loaded = true;
    }

    if (loadingEl) loadingEl.hidden = true;
    if (statusEl) statusEl.textContent = 'Running analysis...';

    const result = await this.#smtSolver.checkSatisfiability(expression);

    const elapsed = performance.now() - startTime;
    this.#displaySmtResult(result, elapsed);

  } catch (err) {
    this.#logger.error('SMT analysis failed', err);
    this.#displaySmtError(err);
  } finally {
    if (loadingEl) loadingEl.hidden = true;
    if (runBtn) runBtn.disabled = false;
    if (statusEl) statusEl.textContent = '';
  }
}

/**
 * Display SMT result
 * @private
 */
#displaySmtResult(result, elapsed) {
  const resultsEl = document.getElementById('smt-results');
  const verdictEl = document.querySelector('.smt-verdict');
  const satResultEl = document.getElementById('smt-sat-result');
  const unsatResultEl = document.getElementById('smt-unsat-result');
  const errorResultEl = document.getElementById('smt-error-result');
  const timingEl = document.getElementById('smt-timing-value');

  if (!resultsEl) return;

  resultsEl.hidden = false;

  // Hide all result sections
  if (satResultEl) satResultEl.hidden = true;
  if (unsatResultEl) unsatResultEl.hidden = true;
  if (errorResultEl) errorResultEl.hidden = true;

  // Update timing
  if (timingEl) {
    timingEl.textContent = `${elapsed.toFixed(0)}ms`;
  }

  if (result.status === 'SAT') {
    this.#displaySatResult(result, verdictEl, satResultEl);
  } else if (result.status === 'UNSAT') {
    this.#displayUnsatResult(result, verdictEl, unsatResultEl);
  } else {
    this.#displaySmtError(new Error(result.error || 'Unknown error'));
  }
}

/**
 * Display SAT result
 * @private
 */
#displaySatResult(result, verdictEl, satResultEl) {
  if (verdictEl) {
    verdictEl.className = 'smt-verdict sat';
    const iconEl = verdictEl.querySelector('.verdict-icon');
    const labelEl = verdictEl.querySelector('.verdict-label');
    if (iconEl) iconEl.textContent = '✓';
    if (labelEl) labelEl.textContent = 'Mathematically Possible (SAT)';
  }

  if (satResultEl) {
    satResultEl.hidden = false;

    const modelEl = document.getElementById('smt-model-content');
    if (modelEl && result.model) {
      modelEl.textContent = JSON.stringify(result.model, null, 2);
    }
  }

  // Store for clipboard
  this.#currentSmtModel = result.model;
}

/**
 * Display UNSAT result
 * @private
 */
#displayUnsatResult(result, verdictEl, unsatResultEl) {
  if (verdictEl) {
    verdictEl.className = 'smt-verdict unsat';
    const iconEl = verdictEl.querySelector('.verdict-icon');
    const labelEl = verdictEl.querySelector('.verdict-label');
    if (iconEl) iconEl.textContent = '✗';
    if (labelEl) labelEl.textContent = 'Mathematically Impossible (UNSAT)';
  }

  if (unsatResultEl) {
    unsatResultEl.hidden = false;

    // Display unsat core
    const coreListEl = document.getElementById('unsat-core-list');
    if (coreListEl && result.unsatCore) {
      coreListEl.innerHTML = result.unsatCore
        .map(constraint => `<li><code>${this.#escapeHtml(constraint)}</code></li>`)
        .join('');
    }

    // Generate human-readable explanation
    const explanationEl = document.getElementById('unsat-explanation-text');
    if (explanationEl && result.unsatCore) {
      explanationEl.textContent = this.#generateUnsatExplanation(result.unsatCore);
    }
  }
}

/**
 * Generate human-readable explanation for unsat core
 * @private
 */
#generateUnsatExplanation(unsatCore) {
  if (!unsatCore || unsatCore.length === 0) {
    return 'The solver could not determine the specific conflicting constraints.';
  }

  if (unsatCore.length === 1) {
    return `The constraint "${unsatCore[0]}" is inherently unsatisfiable.`;
  }

  // Look for common patterns
  const constraints = unsatCore.join(' AND ');

  // Check for range conflicts (x >= A AND x <= B where A > B)
  const rangePattern = /(\w+)\s*>=\s*([\d.]+).*\1\s*<=\s*([\d.]+)/;
  const rangeMatch = constraints.match(rangePattern);
  if (rangeMatch) {
    const [, variable, lower, upper] = rangeMatch;
    if (parseFloat(lower) > parseFloat(upper)) {
      return `The variable "${variable}" must be both >= ${lower} AND <= ${upper}, which is impossible since ${lower} > ${upper}.`;
    }
  }

  return `These ${unsatCore.length} constraints cannot all be satisfied simultaneously. ` +
    `They form a logical contradiction where satisfying some constraints necessarily violates others.`;
}

/**
 * Display SMT error
 * @private
 */
#displaySmtError(err) {
  const resultsEl = document.getElementById('smt-results');
  const verdictEl = document.querySelector('.smt-verdict');
  const satResultEl = document.getElementById('smt-sat-result');
  const unsatResultEl = document.getElementById('smt-unsat-result');
  const errorResultEl = document.getElementById('smt-error-result');

  if (resultsEl) resultsEl.hidden = false;
  if (satResultEl) satResultEl.hidden = true;
  if (unsatResultEl) unsatResultEl.hidden = true;

  if (verdictEl) {
    verdictEl.className = 'smt-verdict error';
    const iconEl = verdictEl.querySelector('.verdict-icon');
    const labelEl = verdictEl.querySelector('.verdict-label');
    if (iconEl) iconEl.textContent = '⚠';
    if (labelEl) labelEl.textContent = 'Analysis Failed';
  }

  if (errorResultEl) {
    errorResultEl.hidden = false;
    const msgEl = document.getElementById('smt-error-message');
    if (msgEl) {
      msgEl.textContent = err.message || 'Unknown error occurred';
    }
  }
}

/**
 * Copy SMT model to clipboard
 * @private
 */
async #copySmtModel() {
  if (!this.#currentSmtModel) return;

  try {
    const json = JSON.stringify(this.#currentSmtModel, null, 2);
    await navigator.clipboard.writeText(json);
    this.#showCopyFeedback('Model copied to clipboard!');
  } catch (err) {
    this.#logger.error('Copy failed', err);
    this.#showCopyFeedback('Copy failed - check console');
  }
}
```

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:unit -- tests/unit/domUI/expression-diagnostics/ --verbose
```

### Unit Test Coverage Requirements

**ExpressionDiagnosticsController.test.js (additions):**
- Run SMT button triggers analysis
- Button disabled during analysis
- Loading indicator shows during Z3 load
- Loading indicator hides after Z3 loads
- Z3 loads only once (lazy loading)
- SAT result displays correctly
- SAT verdict shows green checkmark
- SAT model displays formatted JSON
- Copy Model button works for SAT result
- UNSAT result displays correctly
- UNSAT verdict shows red X
- Unsat core list populates
- Unsat explanation generates
- Error result displays for failures
- Error message shows in error result
- Timing displays elapsed milliseconds
- Status text updates during analysis

### Manual Verification

- [ ] "Run SMT Analysis" button visible
- [ ] Loading spinner shows during Z3 initialization
- [ ] Loading text indicates file size (~5MB)
- [ ] Second analysis doesn't show loading (cached)
- [ ] SAT result shows "Mathematically Possible"
- [ ] SAT result displays model as JSON
- [ ] Copy Model button works
- [ ] UNSAT result shows "Mathematically Impossible"
- [ ] Unsat core displays as list
- [ ] Explanation text is human-readable
- [ ] Error state shows when Z3 fails to load
- [ ] Timing shows analysis duration
- [ ] UI remains responsive during analysis

### Invariants That Must Remain True

1. **Z3 loaded once** - Only loads on first analysis
2. **Loading state visible** - User knows download in progress
3. **SAT/UNSAT distinct** - Clear visual differentiation
4. **Error graceful** - Page functional even if Z3 unavailable
5. **Model copyable** - Valid JSON for SAT results

## Verification Commands

```bash
# Run unit tests
npm run test:unit -- tests/unit/domUI/expression-diagnostics/ --verbose

# Build and serve
npm run build && npm run start

# Manual testing
# Navigate to /expression-diagnostics.html
# Select expression, click "Run SMT Analysis"
# Verify loading state (first time)
# Verify result display (SAT or UNSAT)
# Test copy functionality
```

## Definition of Done

- [ ] HTML structure added for SMT section
- [ ] CSS styles added for all new elements
- [ ] Controller methods implemented for SMT analysis
- [ ] Loading state shows during Z3 initialization
- [ ] SAT result displays with model
- [ ] UNSAT result displays with unsat core
- [ ] Human-readable explanation generated
- [ ] Copy model button works
- [ ] Error state handles Z3 failures
- [ ] Unit tests added for new functionality
- [ ] All tests pass
- [ ] Manual verification completed
- [ ] UI is accessible (WCAG AA)
- [ ] No modifications to SmtSolver service
