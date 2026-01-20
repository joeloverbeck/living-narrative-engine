# PROOVEANA-009: PrototypeAnalysisController

## Description

Implement the UI controller that bridges the Prototype Overlap Analyzer service with the DOM. This controller handles user interactions, manages analysis execution, displays progress, and renders results.

## Files to Create

- `src/domUI/prototype-analysis/PrototypeAnalysisController.js`
- `tests/unit/domUI/prototype-analysis/prototypeAnalysisController.test.js`

## Files to Modify

- `src/prototype-analysis-main.js` (instantiate controller)
- `src/dependencyInjection/registrations/prototypeOverlapRegistrations.js` (add controller registration)

## Out of Scope

- Integration tests - PROOVEANA-010
- Visual styling refinements
- Any changes to core services

## Implementation Details

### PrototypeAnalysisController.js

```javascript
/**
 * @file PrototypeAnalysisController - UI controller for Prototype Overlap Analysis page
 * @see specs/prototype-overlap-analyzer.md
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * DOM element IDs used by the controller
 */
const DOM_IDS = {
  prototypeFamily: 'prototype-family',
  sampleCount: 'sample-count',
  runButton: 'run-analysis-btn',
  progressPanel: 'progress-panel',
  progressBar: 'progress-bar',
  progressStatus: 'progress-status',
  resultsPanel: 'results-panel',
  resultsMetadata: 'results-metadata',
  recommendationsContainer: 'recommendations-container',
  emptyState: 'empty-state',
};

class PrototypeAnalysisController {
  #prototypeOverlapAnalyzer;
  #logger;

  // DOM element references
  #elements = {};

  /**
   * @param {object} deps
   * @param {object} deps.prototypeOverlapAnalyzer - IPrototypeOverlapAnalyzer
   * @param {object} deps.logger - ILogger
   */
  constructor({ prototypeOverlapAnalyzer, logger }) {
    validateDependency(prototypeOverlapAnalyzer, 'IPrototypeOverlapAnalyzer', logger, {
      requiredMethods: ['analyze'],
    });
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'warn', 'error'],
    });

    this.#prototypeOverlapAnalyzer = prototypeOverlapAnalyzer;
    this.#logger = logger;
  }

  /**
   * Initialize the controller and bind event listeners.
   */
  initialize() {
    this.#cacheElements();
    this.#bindEventListeners();
    this.#logger.debug('[PrototypeAnalysisController] Initialized');
  }

  /**
   * Cache DOM element references.
   */
  #cacheElements() {
    for (const [key, id] of Object.entries(DOM_IDS)) {
      this.#elements[key] = document.getElementById(id);
    }
  }

  /**
   * Bind event listeners to controls.
   */
  #bindEventListeners() {
    this.#elements.runButton?.addEventListener('click', () => this.#handleRunAnalysis());
  }

  /**
   * Handle run analysis button click.
   */
  async #handleRunAnalysis() {
    const family = this.#elements.prototypeFamily?.value ?? 'emotion';
    const sampleCount = parseInt(this.#elements.sampleCount?.value ?? '8000', 10);

    this.#setControlsEnabled(false);
    this.#showProgressPanel();

    try {
      const result = await this.#prototypeOverlapAnalyzer.analyze({
        prototypeFamily: family,
        sampleCount,
        onProgress: (stage, completed, total) => {
          this.#updateProgress(stage, completed, total);
        },
      });

      this.#renderResults(result);
    } catch (error) {
      this.#logger.error('[PrototypeAnalysisController] Analysis failed:', error);
      this.#showError(error.message);
    } finally {
      this.#setControlsEnabled(true);
    }
  }

  /**
   * Enable/disable controls during analysis.
   */
  #setControlsEnabled(enabled) {
    this.#elements.runButton.disabled = !enabled;
    this.#elements.prototypeFamily.disabled = !enabled;
    this.#elements.sampleCount.disabled = !enabled;
  }

  /**
   * Show progress panel.
   */
  #showProgressPanel() {
    this.#elements.progressPanel?.classList.remove('hidden');
    this.#elements.resultsPanel?.classList.add('hidden');
    this.#updateProgress('initializing', 0, 1);
  }

  /**
   * Update progress display.
   */
  #updateProgress(stage, completed, total) {
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    this.#elements.progressBar.style.width = `${percent}%`;
    this.#elements.progressBar.setAttribute('aria-valuenow', percent);

    const stageText = stage === 'filtering' ? 'Filtering candidates...'
      : stage === 'evaluating' ? `Evaluating pair ${completed} of ${total}...`
      : 'Initializing...';
    this.#elements.progressStatus.textContent = stageText;
  }

  /**
   * Render analysis results.
   */
  #renderResults(result) {
    this.#elements.progressPanel?.classList.add('hidden');
    this.#elements.resultsPanel?.classList.remove('hidden');

    // Render metadata
    this.#elements.resultsMetadata.innerHTML = this.#formatMetadata(result.metadata);

    // Render recommendations or empty state
    if (result.recommendations.length === 0) {
      this.#elements.recommendationsContainer.innerHTML = '';
      this.#elements.emptyState?.classList.remove('hidden');
    } else {
      this.#elements.emptyState?.classList.add('hidden');
      this.#elements.recommendationsContainer.innerHTML = result.recommendations
        .map(rec => this.#renderRecommendationCard(rec))
        .join('');
      this.#bindCardExpanders();
    }
  }

  /**
   * Format metadata for display.
   */
  #formatMetadata(metadata) {
    return `
      <strong>Analysis Complete</strong><br>
      Prototypes analyzed: ${metadata.totalPrototypes}<br>
      Candidate pairs: ${metadata.candidatePairs}<br>
      Pairs evaluated: ${metadata.processedPairs}<br>
      Time elapsed: ${(metadata.elapsed / 1000).toFixed(1)}s
    `;
  }

  /**
   * Render a recommendation card.
   */
  #renderRecommendationCard(recommendation) {
    const severityClass = recommendation.severity >= 0.7 ? 'severity-high'
      : recommendation.severity >= 0.4 ? 'severity-medium'
      : 'severity-low';

    const typeLabel = recommendation.type === 'prototype_merge_suggestion' ? 'Merge'
      : recommendation.type === 'prototype_subsumption_suggestion' ? 'Subsumption'
      : 'Info';

    const badgeClass = recommendation.type === 'prototype_merge_suggestion' ? 'badge-merge'
      : 'badge-subsumption';

    return `
      <article class="recommendation-card ${severityClass}" data-recommendation-id="${recommendation.prototypes.a}-${recommendation.prototypes.b}">
        <header class="recommendation-header">
          <h3 class="recommendation-title">
            ${recommendation.prototypes.a} ↔ ${recommendation.prototypes.b}
          </h3>
          <div class="recommendation-badges">
            <span class="badge ${badgeClass}">${typeLabel}</span>
            <span class="badge">Severity: ${(recommendation.severity * 100).toFixed(0)}%</span>
          </div>
        </header>

        <div class="recommendation-actions">
          <strong>Suggested Actions:</strong>
          <ul>
            ${recommendation.actions.map(action => `<li>${action}</li>`).join('')}
          </ul>
        </div>

        <button class="btn btn-sm expand-toggle" aria-expanded="false">
          Show Details
        </button>

        <div class="recommendation-details">
          ${this.#renderRecommendationDetails(recommendation)}
        </div>
      </article>
    `;
  }

  /**
   * Render recommendation details section.
   */
  #renderRecommendationDetails(recommendation) {
    return `
      <h4>Candidate Metrics (Stage A)</h4>
      <ul>
        <li>Active Axis Overlap: ${(recommendation.candidateMetrics.activeAxisOverlap * 100).toFixed(1)}%</li>
        <li>Sign Agreement: ${(recommendation.candidateMetrics.signAgreement * 100).toFixed(1)}%</li>
        <li>Weight Cosine Similarity: ${recommendation.candidateMetrics.weightCosineSimilarity.toFixed(3)}</li>
      </ul>

      <h4>Behavioral Metrics (Stage B)</h4>
      <ul>
        <li>Gate Overlap (Both/Either): ${(recommendation.behaviorMetrics.gateOverlap.onBothRate / recommendation.behaviorMetrics.gateOverlap.onEitherRate * 100).toFixed(1)}%</li>
        <li>Intensity Correlation: ${recommendation.behaviorMetrics.intensity.pearsonCorrelation.toFixed(3)}</li>
        <li>Mean Absolute Difference: ${recommendation.behaviorMetrics.intensity.meanAbsDiff.toFixed(3)}</li>
      </ul>

      ${this.#renderDivergenceExamples(recommendation.evidence.divergenceExamples)}
    `;
  }

  /**
   * Render divergence examples.
   */
  #renderDivergenceExamples(examples) {
    if (!examples || examples.length === 0) return '';

    return `
      <h4>Top Divergence Examples</h4>
      <table class="divergence-table">
        <thead>
          <tr>
            <th>Intensity A</th>
            <th>Intensity B</th>
            <th>Difference</th>
          </tr>
        </thead>
        <tbody>
          ${examples.map(ex => `
            <tr>
              <td>${ex.intensityA.toFixed(3)}</td>
              <td>${ex.intensityB.toFixed(3)}</td>
              <td>${ex.absDiff.toFixed(3)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  /**
   * Bind card expander buttons.
   */
  #bindCardExpanders() {
    const buttons = this.#elements.recommendationsContainer.querySelectorAll('.expand-toggle');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const card = btn.closest('.recommendation-card');
        const isExpanded = card.classList.toggle('expanded');
        btn.textContent = isExpanded ? 'Hide Details' : 'Show Details';
        btn.setAttribute('aria-expanded', isExpanded);
      });
    });
  }

  /**
   * Show error message.
   */
  #showError(message) {
    this.#elements.progressPanel?.classList.add('hidden');
    this.#elements.resultsPanel?.classList.remove('hidden');
    this.#elements.resultsMetadata.innerHTML = `<span class="error">Error: ${message}</span>`;
    this.#elements.recommendationsContainer.innerHTML = '';
    this.#elements.emptyState?.classList.add('hidden');
  }
}

export default PrototypeAnalysisController;
```

### Update prototypeOverlapRegistrations.js

```javascript
import PrototypeAnalysisController from '../../domUI/prototype-analysis/PrototypeAnalysisController.js';

// Add to registerPrototypeOverlapServices:
registrar.singletonFactory(
  diagnosticsTokens.IPrototypeAnalysisController,
  (c) => new PrototypeAnalysisController({
    prototypeOverlapAnalyzer: c.resolve(diagnosticsTokens.IPrototypeOverlapAnalyzer),
    logger: c.resolve(coreTokens.ILogger),
  })
);
```

## Acceptance Criteria

### Tests That Must Pass

```javascript
it('binds to DOM elements on initialize')
it('disables controls during analysis')
it('shows progress panel during analysis')
it('updates progress bar width')
it('updates status text')
it('renders recommendation cards')
it('handles empty results')
it('re-enables controls after analysis')
it('handles analysis errors gracefully')
```

### Invariants

- Controller does not modify analyzer behavior
- DOM updates are isolated to prototype-analysis page
- All DOM manipulations use cached element references
- `npm run test:unit -- --grep "prototypeAnalysisController"` passes
- `npx eslint <created-files>` passes

## Verification Commands

```bash
npm run test:unit -- --testPathPattern="prototypeAnalysisController"
npx eslint src/domUI/prototype-analysis/PrototypeAnalysisController.js
```

## Dependencies

- PROOVEANA-005 (PrototypeOverlapAnalyzer)
- PROOVEANA-006 (DI registration)
- PROOVEANA-008 (UI infrastructure)

## Estimated Diff Size

- Source: ~350 lines
- Tests: ~400 lines
- DI registration: ~10 lines
- **Total: ~760 lines**
