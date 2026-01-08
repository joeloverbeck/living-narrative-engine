# EXPDIA-006: Create Basic Diagnostics UI (HTML/CSS/Entry Point)

## Summary

Create the Expression Diagnostics page with expression selector, static analysis controls, and results display. This delivers the MVP: content authors can select an expression and run static analysis to detect gate conflicts and unreachable thresholds.

## Priority: High | Effort: Medium

## Rationale

A working UI enables immediate value delivery. Content authors can start diagnosing impossible expressions even before Monte Carlo and witness finding are implemented.

## Dependencies

- **EXPDIA-001** through **EXPDIA-005** must be completed (models, services, DI)

## Files to Touch

| File | Change Type |
|------|-------------|
| `expression-diagnostics.html` | **Create** |
| `css/expression-diagnostics.css` | **Create** |
| `src/expression-diagnostics.js` | **Create** (entry point) |
| `src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js` | **Create** |
| `scripts/build.config.js` | **Modify** (add bundle + htmlFiles) |
| `index.html` | **Modify** (add navigation button) |
| `tests/unit/domUI/expression-diagnostics/ExpressionDiagnosticsController.test.js` | **Create** |

## Out of Scope

- **DO NOT** implement Monte Carlo UI - that's EXPDIA-009
- **DO NOT** implement Witness State UI - that's EXPDIA-012
- **DO NOT** implement SMT UI - that's EXPDIA-014
- **DO NOT** implement Suggestions UI - that's EXPDIA-016
- **DO NOT** modify existing services

## Implementation Details

### HTML Page Structure

```html
<!-- expression-diagnostics.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Expression Diagnostics - Living Narrative Engine</title>
  <link rel="stylesheet" href="css/style.css" />
  <link rel="stylesheet" href="css/expression-diagnostics.css" />
</head>
<body>
  <div class="diagnostics-container">
    <header class="diagnostics-header">
      <h1>Expression Diagnostics</h1>
      <button id="back-button" class="menu-button">Back to Menu</button>
    </header>

    <main class="diagnostics-main">
      <!-- Expression Selection Panel -->
      <section class="panel expression-selection-panel">
        <h2>Expression Selection</h2>
        <div class="form-group">
          <label for="expression-select">Select Expression:</label>
          <select id="expression-select" class="form-select">
            <option value="">-- Select an expression --</option>
          </select>
        </div>
        <p id="expression-description" class="expression-description"></p>
      </section>

      <!-- Analysis Controls Panel -->
      <section class="panel analysis-controls-panel">
        <h2>Analysis Controls</h2>
        <div class="button-group">
          <button id="run-static-btn" class="action-button" disabled>
            Run Static Analysis
          </button>
          <!-- Future buttons will be added here -->
          <!-- <button id="run-monte-carlo-btn">Run Monte Carlo</button> -->
          <!-- <button id="find-witness-btn">Find Witness</button> -->
          <!-- <button id="run-all-btn">Run All</button> -->
        </div>
      </section>

      <!-- Results Area -->
      <div class="results-area">
        <!-- Status Summary -->
        <section class="panel status-panel">
          <h2>Status Summary</h2>
          <div id="status-indicator" class="status-indicator status-unknown">
            <span class="status-emoji">⚪</span>
            <span class="status-label">Not Analyzed</span>
          </div>
          <p id="status-message" class="status-message"></p>
        </section>

        <!-- Static Analysis Details -->
        <section class="panel static-analysis-panel">
          <h2>Static Analysis Results</h2>
          <div id="static-results" class="results-content">
            <p class="placeholder-text">Run static analysis to see results.</p>
          </div>
        </section>

        <!-- Gate Conflicts Table -->
        <section class="panel gate-conflicts-panel" id="gate-conflicts-section" hidden>
          <h2>Gate Conflicts</h2>
          <table id="gate-conflicts-table" class="results-table">
            <thead>
              <tr>
                <th>Axis</th>
                <th>Required</th>
                <th>Conflicting Prototypes</th>
                <th>Gates</th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </section>

        <!-- Unreachable Thresholds Table -->
        <section class="panel thresholds-panel" id="thresholds-section" hidden>
          <h2>Unreachable Thresholds</h2>
          <table id="thresholds-table" class="results-table">
            <thead>
              <tr>
                <th>Prototype</th>
                <th>Type</th>
                <th>Required</th>
                <th>Max Possible</th>
                <th>Gap</th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </section>
      </div>
    </main>
  </div>

  <script src="expression-diagnostics.js"></script>
</body>
</html>
```

### CSS Styles

```css
/* css/expression-diagnostics.css */

.diagnostics-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1rem;
}

.diagnostics-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--border-color, #444);
}

.diagnostics-header h1 {
  margin: 0;
  font-size: 1.75rem;
}

.diagnostics-main {
  display: grid;
  gap: 1rem;
}

/* Panels */
.panel {
  background: var(--panel-bg, #1e1e1e);
  border: 1px solid var(--border-color, #444);
  border-radius: 8px;
  padding: 1rem;
}

.panel h2 {
  margin: 0 0 1rem 0;
  font-size: 1.1rem;
  color: var(--heading-color, #e0e0e0);
}

/* Form Elements */
.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.form-select {
  width: 100%;
  padding: 0.5rem;
  background: var(--input-bg, #2a2a2a);
  border: 1px solid var(--border-color, #444);
  border-radius: 4px;
  color: var(--text-color, #e0e0e0);
  font-size: 1rem;
}

.expression-description {
  font-style: italic;
  color: var(--text-muted, #888);
  margin: 0;
}

/* Button Group */
.button-group {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.action-button {
  padding: 0.5rem 1rem;
  background: var(--button-bg, #4a4a4a);
  border: 1px solid var(--border-color, #555);
  border-radius: 4px;
  color: var(--text-color, #e0e0e0);
  cursor: pointer;
  font-size: 0.9rem;
  transition: background 0.2s;
}

.action-button:hover:not(:disabled) {
  background: var(--button-hover-bg, #5a5a5a);
}

.action-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Status Indicator */
.status-indicator {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  border-radius: 6px;
  font-weight: 600;
}

.status-emoji {
  font-size: 1.5rem;
}

.status-unknown { background: var(--status-unknown-bg, #333); }
.status-impossible { background: var(--status-red-bg, #4a1a1a); color: #ff6b6b; }
.status-extremely-rare { background: var(--status-orange-bg, #4a3a1a); color: #ffa94d; }
.status-rare { background: var(--status-yellow-bg, #4a4a1a); color: #ffd43b; }
.status-normal { background: var(--status-green-bg, #1a4a1a); color: #69db7c; }
.status-frequent { background: var(--status-blue-bg, #1a2a4a); color: #74c0fc; }

.status-message {
  margin-top: 0.5rem;
  color: var(--text-muted, #888);
}

/* Results Area */
.results-area {
  display: grid;
  gap: 1rem;
}

.results-content {
  min-height: 100px;
}

.placeholder-text {
  color: var(--text-muted, #666);
  font-style: italic;
}

/* Results Tables */
.results-table {
  width: 100%;
  border-collapse: collapse;
}

.results-table th,
.results-table td {
  padding: 0.5rem;
  text-align: left;
  border-bottom: 1px solid var(--border-color, #333);
}

.results-table th {
  background: var(--table-header-bg, #2a2a2a);
  font-weight: 600;
}

.results-table tbody tr:hover {
  background: var(--table-row-hover, #2a2a2a);
}

/* Responsive */
@media (min-width: 768px) {
  .results-area {
    grid-template-columns: 1fr 2fr;
  }

  .status-panel {
    grid-column: 1;
  }

  .static-analysis-panel,
  .gate-conflicts-panel,
  .thresholds-panel {
    grid-column: 2;
  }
}
```

### Entry Point

```javascript
// src/expression-diagnostics.js

import { CommonBootstrapper } from './bootstrapper/CommonBootstrapper.js';
import { tokens } from './dependencyInjection/tokens.js';
import { diagnosticsTokens } from './dependencyInjection/tokens/tokens-diagnostics.js';
import { registerExpressionDiagnosticsServices } from './dependencyInjection/registrations/expressionDiagnosticsRegistrations.js';
import ExpressionDiagnosticsController from './domUI/expression-diagnostics/ExpressionDiagnosticsController.js';
import { shouldAutoInitializeDom } from './utils/environmentUtils.js';

let controller = null;

async function initialize() {
  const bootstrapper = new CommonBootstrapper();

  try {
    await bootstrapper.bootstrap({
      containerConfigType: 'minimal',
      worldName: 'default',
      postInitHook: async (services, container) => {
        // Register diagnostics services
        registerExpressionDiagnosticsServices(container);

        // Resolve dependencies
        const logger = container.resolve(tokens.ILogger);
        const expressionRegistry = container.resolve(tokens.IExpressionRegistry);
        const gateAnalyzer = container.resolve(diagnosticsTokens.IGateConstraintAnalyzer);
        const boundsCalculator = container.resolve(diagnosticsTokens.IIntensityBoundsCalculator);

        // Initialize controller
        controller = new ExpressionDiagnosticsController({
          logger,
          expressionRegistry,
          gateAnalyzer,
          boundsCalculator
        });

        await controller.initialize();

        logger.info('Expression Diagnostics initialized');
      }
    });
  } catch (error) {
    bootstrapper.displayFatalStartupError(`Failed to initialize: ${error.message}`, error);
  }
}

// Back button handler
document.getElementById('back-button')?.addEventListener('click', () => {
  window.location.href = 'index.html';
});

if (shouldAutoInitializeDom()) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
}
```

### Controller

```javascript
// src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js

import { validateDependency } from '../../utils/dependencyUtils.js';
import DiagnosticResult from '../../expressionDiagnostics/models/DiagnosticResult.js';

class ExpressionDiagnosticsController {
  #logger;
  #expressionRegistry;
  #gateAnalyzer;
  #boundsCalculator;

  #selectedExpression = null;
  #currentResult = null;

  // DOM elements
  #expressionSelect;
  #expressionDescription;
  #runStaticBtn;
  #statusIndicator;
  #statusMessage;
  #staticResults;
  #gateConflictsSection;
  #gateConflictsTable;
  #thresholdsSection;
  #thresholdsTable;

  constructor({ logger, expressionRegistry, gateAnalyzer, boundsCalculator }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'info', 'warn', 'error']
    });
    validateDependency(expressionRegistry, 'IExpressionRegistry', logger, {
      requiredMethods: ['getAllExpressions', 'getExpression']
    });
    validateDependency(gateAnalyzer, 'IGateConstraintAnalyzer', logger, {
      requiredMethods: ['analyze']
    });
    validateDependency(boundsCalculator, 'IIntensityBoundsCalculator', logger, {
      requiredMethods: ['analyzeExpression']
    });

    this.#logger = logger;
    this.#expressionRegistry = expressionRegistry;
    this.#gateAnalyzer = gateAnalyzer;
    this.#boundsCalculator = boundsCalculator;
  }

  async initialize() {
    this.#bindDomElements();
    this.#setupEventListeners();
    await this.#populateExpressionSelect();
  }

  #bindDomElements() {
    this.#expressionSelect = document.getElementById('expression-select');
    this.#expressionDescription = document.getElementById('expression-description');
    this.#runStaticBtn = document.getElementById('run-static-btn');
    this.#statusIndicator = document.getElementById('status-indicator');
    this.#statusMessage = document.getElementById('status-message');
    this.#staticResults = document.getElementById('static-results');
    this.#gateConflictsSection = document.getElementById('gate-conflicts-section');
    this.#gateConflictsTable = document.getElementById('gate-conflicts-table');
    this.#thresholdsSection = document.getElementById('thresholds-section');
    this.#thresholdsTable = document.getElementById('thresholds-table');
  }

  #setupEventListeners() {
    this.#expressionSelect?.addEventListener('change', (e) => {
      this.#onExpressionSelected(e.target.value);
    });

    this.#runStaticBtn?.addEventListener('click', () => {
      this.#runStaticAnalysis();
    });
  }

  async #populateExpressionSelect() {
    const expressions = this.#expressionRegistry.getAllExpressions();

    for (const expr of expressions) {
      const option = document.createElement('option');
      option.value = expr.id;
      option.textContent = expr.id;
      this.#expressionSelect?.appendChild(option);
    }

    this.#logger.debug(`Populated ${expressions.length} expressions`);
  }

  #onExpressionSelected(expressionId) {
    if (!expressionId) {
      this.#selectedExpression = null;
      this.#expressionDescription.textContent = '';
      this.#runStaticBtn.disabled = true;
      this.#resetResults();
      return;
    }

    this.#selectedExpression = this.#expressionRegistry.getExpression(expressionId);

    if (this.#selectedExpression) {
      this.#expressionDescription.textContent =
        this.#selectedExpression.description || 'No description available';
      this.#runStaticBtn.disabled = false;
    } else {
      this.#expressionDescription.textContent = 'Expression not found';
      this.#runStaticBtn.disabled = true;
    }

    this.#resetResults();
  }

  #resetResults() {
    this.#currentResult = null;
    this.#updateStatus('unknown', 'Not Analyzed', '');
    this.#staticResults.innerHTML = '<p class="placeholder-text">Run static analysis to see results.</p>';
    this.#gateConflictsSection.hidden = true;
    this.#thresholdsSection.hidden = true;
  }

  #runStaticAnalysis() {
    if (!this.#selectedExpression) return;

    this.#logger.info(`Running static analysis for: ${this.#selectedExpression.id}`);

    try {
      // Gate conflict analysis
      const gateResult = this.#gateAnalyzer.analyze(this.#selectedExpression);

      // Intensity bounds analysis
      const thresholdIssues = this.#boundsCalculator.analyzeExpression(
        this.#selectedExpression,
        gateResult.axisIntervals
      );

      // Build result
      this.#currentResult = new DiagnosticResult(this.#selectedExpression.id);
      this.#currentResult.setStaticAnalysis({
        gateConflicts: gateResult.conflicts,
        unreachableThresholds: thresholdIssues
      });

      // Update UI
      this.#displayStaticResults(gateResult, thresholdIssues);
      this.#updateStatusFromResult();

    } catch (error) {
      this.#logger.error('Static analysis failed:', error);
      this.#updateStatus('impossible', 'Analysis Error', error.message);
    }
  }

  #displayStaticResults(gateResult, thresholdIssues) {
    // Gate conflicts
    if (gateResult.conflicts.length > 0) {
      this.#gateConflictsSection.hidden = false;
      this.#renderGateConflictsTable(gateResult.conflicts);
    } else {
      this.#gateConflictsSection.hidden = true;
    }

    // Unreachable thresholds
    if (thresholdIssues.length > 0) {
      this.#thresholdsSection.hidden = false;
      this.#renderThresholdsTable(thresholdIssues);
    } else {
      this.#thresholdsSection.hidden = true;
    }

    // Summary
    if (gateResult.conflicts.length === 0 && thresholdIssues.length === 0) {
      this.#staticResults.innerHTML = '<p class="success-text">No static issues detected. All gates compatible, all thresholds reachable.</p>';
    } else {
      this.#staticResults.innerHTML = `
        <p>Found ${gateResult.conflicts.length} gate conflict(s) and ${thresholdIssues.length} unreachable threshold(s).</p>
      `;
    }
  }

  #renderGateConflictsTable(conflicts) {
    const tbody = this.#gateConflictsTable.querySelector('tbody');
    tbody.innerHTML = '';

    for (const conflict of conflicts) {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${conflict.axis}</td>
        <td>[${conflict.required.min.toFixed(2)}, ${conflict.required.max.toFixed(2)}]</td>
        <td>${conflict.prototypes.join(', ')}</td>
        <td>${conflict.gates.join('; ')}</td>
      `;
      tbody.appendChild(row);
    }
  }

  #renderThresholdsTable(thresholdIssues) {
    const tbody = this.#thresholdsTable.querySelector('tbody');
    tbody.innerHTML = '';

    for (const issue of thresholdIssues) {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${issue.prototypeId}</td>
        <td>${issue.type}</td>
        <td>${issue.threshold.toFixed(2)}</td>
        <td>${issue.maxPossible.toFixed(2)}</td>
        <td>${issue.gap.toFixed(2)}</td>
      `;
      tbody.appendChild(row);
    }
  }

  #updateStatusFromResult() {
    if (!this.#currentResult) return;

    const indicator = this.#currentResult.statusIndicator;
    const category = this.#currentResult.rarityCategory;

    this.#updateStatus(
      category.replace('_', '-'),
      indicator.label,
      this.#currentResult.impossibilityReason || ''
    );
  }

  #updateStatus(category, label, message) {
    // Remove all status classes
    this.#statusIndicator.className = 'status-indicator';
    this.#statusIndicator.classList.add(`status-${category}`);

    const emoji = this.#statusIndicator.querySelector('.status-emoji');
    const labelEl = this.#statusIndicator.querySelector('.status-label');

    const emojiMap = {
      'unknown': '⚪',
      'impossible': '🔴',
      'extremely-rare': '🟠',
      'rare': '🟡',
      'normal': '🟢',
      'frequent': '🔵'
    };

    if (emoji) emoji.textContent = emojiMap[category] || '⚪';
    if (labelEl) labelEl.textContent = label;
    if (this.#statusMessage) this.#statusMessage.textContent = message;
  }
}

export default ExpressionDiagnosticsController;
```

### Build Configuration Update

Add to `scripts/build.config.js`:

```javascript
// In the bundles array:
{
  name: 'expression-diagnostics',
  entry: 'src/expression-diagnostics.js',
  output: 'expression-diagnostics.js',
}

// In the htmlFiles array:
'expression-diagnostics.html'
```

### Navigation Button (index.html)

Add to index.html in the appropriate button section:

```html
<button id="expression-diagnostics-button" class="menu-button">
  <span class="button-icon" aria-hidden="true">🔬</span>
  <span class="button-text">Expression Diagnostics</span>
</button>

<script>
  document.getElementById('expression-diagnostics-button').addEventListener('click', () => {
    window.location.href = 'expression-diagnostics.html';
  });
</script>
```

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:unit -- tests/unit/domUI/expression-diagnostics/ --verbose
npm run build
```

### Unit Test Coverage Requirements

**ExpressionDiagnosticsController.test.js:**
- Constructor throws if logger is missing
- Constructor throws if expressionRegistry is missing
- Constructor throws if gateAnalyzer is missing
- Constructor throws if boundsCalculator is missing
- `initialize()` populates expression dropdown
- Expression selection updates description
- Expression selection enables Run Static button
- `#runStaticAnalysis()` calls both analyzers
- Gate conflicts displayed in table
- Unreachable thresholds displayed in table
- Status indicator updates correctly for each category
- Reset clears all results when new expression selected

### Manual Verification

- [ ] Page loads at `/expression-diagnostics.html`
- [ ] Expression dropdown populates with loaded expressions
- [ ] Selecting expression shows description and enables button
- [ ] "Run Static Analysis" analyzes and shows results
- [ ] Gate conflicts table appears when conflicts exist
- [ ] Thresholds table appears when unreachable thresholds exist
- [ ] Status indicator shows correct color/emoji
- [ ] Back button returns to index

### Invariants That Must Remain True

1. **Follows CSS patterns** from expressions-simulator.css
2. **Uses CommonBootstrapper pattern** like other tool pages
3. **Back navigation works** correctly
4. **Build succeeds** with new bundle configuration
5. **No console errors** on page load

## Verification Commands

```bash
# Create directory structure
mkdir -p src/domUI/expression-diagnostics
mkdir -p tests/unit/domUI/expression-diagnostics

# Build
npm run build

# Type checking
npm run typecheck

# Run unit tests
npm run test:unit -- tests/unit/domUI/expression-diagnostics/ --verbose

# Manual test
npm start
# Navigate to http://localhost:8080/expression-diagnostics.html
```

## Definition of Done

- [ ] `expression-diagnostics.html` created
- [ ] `css/expression-diagnostics.css` created
- [ ] `src/expression-diagnostics.js` entry point created
- [ ] `ExpressionDiagnosticsController.js` created
- [ ] `scripts/build.config.js` updated
- [ ] `index.html` updated with navigation button
- [ ] Unit tests cover controller functionality
- [ ] Build succeeds with new bundle
- [ ] Manual verification passes all checks
- [x] No console errors on page load

---

## Outcome

**Status**: ✅ COMPLETED

**Implementation Date**: 2026-01-08

### Discrepancies from Original Ticket

1. **Method name fix**: Ticket originally used `getExpressions()` in controller code and dependency validation. The actual method in `ExpressionRegistry` is `getAllExpressions()`. Ticket was corrected prior to implementation.

### Files Created

- `expression-diagnostics.html` - HTML page with expression selector, analysis controls, and results display
- `css/expression-diagnostics.css` - Styling for status indicators, panels, and tables
- `src/expression-diagnostics.js` - Entry point using CommonBootstrapper pattern
- `src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js` - Controller handling UI interactions
- `tests/unit/domUI/expression-diagnostics/ExpressionDiagnosticsController.test.js` - Comprehensive unit tests (25 tests)

### Files Modified

- `scripts/build.config.js` - Added bundle and htmlFiles entries
- `index.html` - Added navigation button in Emotions section with click handler
- `tests/unit/index.test.js` - Updated expected button list to include new button

### Test Results

- 25 unit tests passing with 100% line coverage on controller
- All 44,723 unit tests passing
- Build completes successfully

### Technical Notes

- Uses Jest's jsdom environment directly via `document.body.innerHTML` rather than creating separate JSDOM instance
- Follows expressions-simulator.js patterns for CommonBootstrapper usage
- Registers diagnostics services via `registerExpressionDiagnosticsServices(container)` in postInitHook
