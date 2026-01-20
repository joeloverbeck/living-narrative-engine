# PROOVEANA-008: UI Infrastructure

## Status: COMPLETED

## Description

Create the UI infrastructure for the Prototype Overlap Analysis page including the HTML page, CSS styles, JavaScript entry point, and build configuration. This establishes the static page structure that the controller (PROOVEANA-009) will bring to life.

## Corrections Made During Implementation

The original ticket contained several discrepancies with actual codebase patterns:

1. **CommonBootstrapper Location**: Corrected from `src/characterBuilder/CommonBootstrapper.js` to `src/bootstrapper/CommonBootstrapper.js`
2. **Bootstrap API**: Corrected from constructor with `postInitHook` + `.boot()` to `new CommonBootstrapper()` + `bootstrap({ postInitHook })`
3. **CSS Reference**: Corrected from `css/common.css` to `css/style.css` (no common.css exists)
4. **Script Tag**: Corrected from `<script type="module" src="dist/...">` to `<script src="...">` (no type module, no dist path)
5. **CSS Variables**: Corrected from assumed variables to actual theme variables (`--panel-bg-color`, `--border-color-subtle`, etc.)
6. **Index Navigation**: Corrected from `<li><a href>` pattern to button-based with click handlers
7. **DI Token**: No change needed - `IPrototypeAnalysisController` already exists in `tokens-diagnostics.js`

## Files to Create

- `prototype-analysis.html`
- `css/prototype-analysis.css`
- `src/prototype-analysis.js`

## Files to Modify

- `index.html` (add navigation button in Emotions section)
- `scripts/build.config.js` (add bundle and HTML file)

## Out of Scope

- Controller implementation - PROOVEANA-009
- Dynamic behavior (just static page structure)
- Integration tests - PROOVEANA-010

## Implementation Details

### prototype-analysis.html (Corrected)

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Prototype Overlap Analysis - Living Narrative Engine</title>
  <link rel="stylesheet" href="css/style.css" />
  <link rel="stylesheet" href="css/prototype-analysis.css" />
</head>
<body>
  <div class="diagnostics-container">
    <header class="diagnostics-header">
      <h1>Prototype Overlap Analysis</h1>
      <button id="back-button" class="menu-button">Back to Menu</button>
    </header>

    <main class="diagnostics-main">
      <!-- Controls Panel -->
      <section class="panel controls-panel">
        <h2>Analysis Controls</h2>
        <div class="form-group">
          <label for="prototype-family">Prototype Family:</label>
          <select id="prototype-family" class="form-select">
            <option value="emotion">Emotions</option>
            <option value="sexual">Sexual States</option>
          </select>
        </div>
        <div class="form-group">
          <label for="sample-count">Sample Count:</label>
          <select id="sample-count" class="form-select">
            <option value="2000">2,000 (Fast)</option>
            <option value="8000" selected>8,000 (Standard)</option>
            <option value="20000">20,000 (Thorough)</option>
          </select>
        </div>
        <button id="run-analysis-btn" class="action-button">
          Run Analysis
        </button>
      </section>

      <!-- Progress Panel (hidden by default) -->
      <section id="progress-panel" class="panel progress-panel" hidden>
        <h2>Analysis Progress</h2>
        <div class="progress-bar-container">
          <div id="progress-bar" class="progress-bar" role="progressbar"
               aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">
          </div>
        </div>
        <p id="progress-status" class="progress-status">Initializing...</p>
      </section>

      <!-- Results Panel (hidden by default) -->
      <section id="results-panel" class="panel results-panel" hidden>
        <h2>Analysis Results</h2>
        <div id="results-metadata" class="results-metadata"></div>
        <div id="recommendations-container" class="recommendations-container">
          <!-- Recommendation cards will be inserted here -->
        </div>
        <div id="empty-state" class="empty-state" hidden>
          <p>No overlapping prototypes detected. All prototypes are sufficiently distinct.</p>
        </div>
      </section>
    </main>
  </div>

  <script src="prototype-analysis.js"></script>
</body>
</html>
```

### prototype-analysis.css (Corrected - uses actual CSS variables)

```css
/* css/prototype-analysis.css */

/**
 * Prototype Overlap Analysis Page Styles
 * Follows patterns from expression-diagnostics.css
 * Uses actual CSS variables from theme (_default-theme.css)
 */

/* Controls Panel */
.controls-panel .form-group {
  display: inline-block;
  margin-right: 1rem;
  margin-bottom: 0.5rem;
}

/* Progress Panel */
.progress-panel .progress-bar-container {
  height: 8px;
  background: var(--border-color-subtle);
  border-radius: 4px;
  overflow: hidden;
}

.progress-panel .progress-bar {
  height: 100%;
  background: var(--accent-color-primary);
  width: 0%;
  transition: width 0.3s ease;
}

.progress-panel .progress-status {
  margin-top: 0.5rem;
  color: var(--secondary-text-color);
  font-size: 0.9rem;
}

/* Results Panel */
.results-panel .results-metadata {
  margin-bottom: 1rem;
  padding: 0.75rem;
  background: var(--input-bg-color);
  border-radius: 4px;
  font-size: 0.9rem;
}

/* Recommendation Cards */
.recommendations-container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.recommendation-card {
  padding: 1rem;
  border: 1px solid var(--border-color-subtle);
  border-radius: 8px;
  border-left: 4px solid var(--status-uncommon-fill);
  background: var(--panel-bg-color);
}

.recommendation-card.severity-high {
  border-left-color: var(--status-impossible-fill);
}

.recommendation-card.severity-medium {
  border-left-color: var(--status-extremely-rare-fill);
}

.recommendation-card.severity-low {
  border-left-color: var(--status-normal-fill);
}

.recommendation-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.75rem;
}

.recommendation-title {
  font-weight: 600;
  font-size: 1.1rem;
  color: var(--primary-text-color);
}

.recommendation-badges {
  display: flex;
  gap: 0.5rem;
}

.badge {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
}

.badge-merge {
  background: var(--status-impossible-bg);
  color: var(--status-impossible-text);
}

.badge-subsumption {
  background: var(--status-extremely-rare-bg);
  color: var(--status-extremely-rare-text);
}

.recommendation-details {
  display: none;
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border-color-subtle);
}

.recommendation-card.expanded .recommendation-details {
  display: block;
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 2rem;
  color: var(--secondary-text-color);
}
```

### prototype-analysis.js (Corrected - follows expression-diagnostics.js pattern)

```javascript
// prototype-analysis.js

import { CommonBootstrapper } from './bootstrapper/CommonBootstrapper.js';
import { tokens } from './dependencyInjection/tokens.js';
import { registerExpressionServices } from './dependencyInjection/registrations/expressionsRegistrations.js';
import { registerExpressionDiagnosticsServices } from './dependencyInjection/registrations/expressionDiagnosticsRegistrations.js';
import { shouldAutoInitializeDom } from './utils/environmentUtils.js';

/**
 * Initialize the Prototype Analysis page.
 */
async function initialize() {
  const bootstrapper = new CommonBootstrapper();

  try {
    await bootstrapper.bootstrap({
      containerConfigType: 'minimal',
      worldName: 'default',
      postInitHook: async (services, container) => {
        registerExpressionServices(container);
        registerExpressionDiagnosticsServices(container);

        const logger = container.resolve(tokens.ILogger);
        logger.info('[PrototypeAnalysis] Bootstrap complete.');

        // Controller resolution deferred to PROOVEANA-009
      },
    });
  } catch (error) {
    bootstrapper.displayFatalStartupError(
      `Failed to initialize Prototype Analysis: ${error.message}`,
      error
    );
  }
}

// Back button handler
document.getElementById('back-button')?.addEventListener('click', () => {
  window.location.href = 'index.html';
});

export { initialize };

if (shouldAutoInitializeDom()) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
}
```

### Update build.config.js

```javascript
// Add to bundles array (after expression-diagnostics):
{
  name: 'prototype-analysis',
  entry: 'src/prototype-analysis.js',
  output: 'prototype-analysis.js',
},

// Add to htmlFiles array:
'prototype-analysis.html',
```

### Update index.html (Corrected - button-based navigation)

Add button in the Emotions section (inside the 2-column grid):

```html
<button
  id="prototype-analysis-button"
  class="menu-button nav-button nav-button--blue"
>
  <span class="button-icon" aria-hidden="true">🧬</span>
  <span class="button-text">Prototype Overlap Analysis</span>
</button>
```

Add click handler in script section:

```javascript
document
  .getElementById('prototype-analysis-button')
  .addEventListener('click', () => {
    window.location.href = 'prototype-analysis.html';
  });
```

## Acceptance Criteria

1. **HTML page** includes:
   - Header with title and back button (following expression-diagnostics.html pattern)
   - Controls panel (family selector, sample count selector, run button)
   - Progress panel (hidden by default)
   - Results panel (hidden by default)
   - Uses `.diagnostics-container`, `.diagnostics-header`, `.diagnostics-main` classes

2. **CSS file** follows existing patterns from `expression-diagnostics.css`:
   - Uses actual CSS variables (`--panel-bg-color`, `--border-color-subtle`, etc.)
   - Uses status colors (`--status-*-fill`, `--status-*-bg`, `--status-*-text`)

3. **Entry point** follows `expression-diagnostics.js` pattern:
   - Uses `CommonBootstrapper` from `./bootstrapper/CommonBootstrapper.js`
   - Uses `bootstrap({ postInitHook })` method
   - Registers expression services
   - Back button handler with `#back-button` ID

4. **Build config** updated:
   - Bundle entry added with `entry: 'src/prototype-analysis.js'`
   - HTML file added to `htmlFiles` array

5. **Index.html** updated:
   - Button added in Emotions section
   - Click handler added in script section

### Tests That Must Pass

- `npm run build` succeeds
- Page loads without JS errors (static only)
- Navigation from index works
- Back button returns to index

### Invariants

- HTML follows accessibility patterns (labels, ARIA)
- CSS uses actual theme CSS variables
- `npx eslint src/prototype-analysis.js` passes

## Verification Commands

```bash
npm run build
npx eslint src/prototype-analysis.js
npm run typecheck
```

## Dependencies

- PROOVEANA-000 (tokens) - Already completed

## Estimated Diff Size

- HTML: ~70 lines
- CSS: ~100 lines
- JS entry: ~50 lines
- Build config changes: ~5 lines
- Index.html changes: ~10 lines
- Ticket corrections: ~100 lines
- **Total: ~335 lines**

## Outcome

Implementation followed corrected patterns from actual codebase analysis:
- Corrected 7 discrepancies between ticket assumptions and codebase reality
- All files created following established patterns from expression-diagnostics page
- No DI token changes needed (token already existed)
