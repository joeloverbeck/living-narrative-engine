/**
 * @file Prototype Analysis Controller - UI controller for prototype overlap analysis page.
 *
 * Handles user interactions, progress reporting, and result rendering for the
 * prototype overlap analysis feature.
 * @see PrototypeOverlapAnalyzer
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * Controller for the Prototype Analysis page.
 *
 * Orchestrates the UI for running prototype overlap analysis, displaying
 * progress, and rendering recommendations.
 */
class PrototypeAnalysisController {
  #logger;
  #prototypeOverlapAnalyzer;

  // Analysis state
  #analysisInProgress = false;

  // DOM elements
  #prototypeFamilySelect;
  #sampleCountSelect;
  #runAnalysisBtn;
  #progressPanel;
  #progressBar;
  #progressStatus;
  #resultsPanel;
  #resultsMetadata;
  #recommendationsContainer;
  #emptyState;

  // Button state
  #originalButtonText = 'Run Analysis';

  /**
   * Constructs a new PrototypeAnalysisController instance.
   *
   * @param {object} deps - Dependencies object
   * @param {import('../../interfaces/coreServices.js').ILogger} deps.logger - ILogger
   * @param {object} deps.prototypeOverlapAnalyzer - IPrototypeOverlapAnalyzer with analyze()
   */
  constructor({ logger, prototypeOverlapAnalyzer }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'info', 'warn', 'error'],
    });

    validateDependency(
      prototypeOverlapAnalyzer,
      'IPrototypeOverlapAnalyzer',
      logger,
      { requiredMethods: ['analyze'] }
    );

    this.#logger = logger;
    this.#prototypeOverlapAnalyzer = prototypeOverlapAnalyzer;
  }

  /**
   * Initialize the controller by binding DOM elements and setting up event listeners.
   */
  async initialize() {
    this.#bindDomElements();
    this.#setupEventListeners();
    this.#enableControls();

    this.#logger.info('[PrototypeAnalysisController] Initialized');
  }

  /**
   * Bind all required DOM elements.
   *
   * @private
   */
  #bindDomElements() {
    this.#prototypeFamilySelect = document.getElementById('prototype-family');
    this.#sampleCountSelect = document.getElementById('sample-count');
    this.#runAnalysisBtn = document.getElementById('run-analysis-btn');
    this.#progressPanel = document.getElementById('progress-panel');
    this.#progressBar = document.getElementById('progress-bar');
    this.#progressStatus = document.getElementById('progress-status');
    this.#resultsPanel = document.getElementById('results-panel');
    this.#resultsMetadata = document.getElementById('results-metadata');
    this.#recommendationsContainer = document.getElementById(
      'recommendations-container'
    );
    this.#emptyState = document.getElementById('empty-state');

    // Validate critical DOM elements and store original button text
    if (!this.#runAnalysisBtn) {
      this.#logger.warn(
        '[PrototypeAnalysisController] Run analysis button not found'
      );
    } else {
      this.#originalButtonText =
        this.#runAnalysisBtn.textContent.trim() || 'Run Analysis';
    }
  }

  /**
   * Set up event listeners for UI interactions.
   *
   * @private
   */
  #setupEventListeners() {
    this.#runAnalysisBtn?.addEventListener('click', () => {
      this.#runAnalysis();
    });
  }

  /**
   * Enable controls (after initialization or analysis completion).
   *
   * @private
   */
  #enableControls() {
    if (this.#prototypeFamilySelect) {
      this.#prototypeFamilySelect.disabled = false;
    }
    if (this.#sampleCountSelect) {
      this.#sampleCountSelect.disabled = false;
    }
    if (this.#runAnalysisBtn) {
      this.#runAnalysisBtn.disabled = false;
    }
  }

  /**
   * Disable controls during analysis.
   *
   * @private
   */
  #disableControls() {
    if (this.#prototypeFamilySelect) {
      this.#prototypeFamilySelect.disabled = true;
    }
    if (this.#sampleCountSelect) {
      this.#sampleCountSelect.disabled = true;
    }
    if (this.#runAnalysisBtn) {
      this.#runAnalysisBtn.disabled = true;
    }
  }

  /**
   * Show the progress panel with initial state.
   *
   * @private
   */
  #showProgressPanel() {
    if (this.#progressPanel) {
      this.#progressPanel.hidden = false;
    }
    this.#updateProgress(0, 'Initializing...');
  }

  /**
   * Hide the progress panel.
   *
   * @private
   */
  #hideProgressPanel() {
    if (this.#progressPanel) {
      this.#progressPanel.hidden = true;
    }
  }

  /**
   * Update the progress bar and status text.
   *
   * @param {number} percent - Progress percentage (0-100)
   * @param {string} statusText - Status message to display
   * @private
   */
  #updateProgress(percent, statusText) {
    if (this.#progressBar) {
      const clampedPercent = Math.max(0, Math.min(100, percent));
      this.#progressBar.style.width = `${clampedPercent}%`;
      this.#progressBar.setAttribute('aria-valuenow', String(clampedPercent));
    }
    if (this.#progressStatus) {
      this.#progressStatus.textContent = statusText;
    }
  }

  /**
   * Handle progress callback from analyzer.
   * Handles both filtering stage (simple current/total) and evaluating stage
   * (nested pair + sample progress). Updates progress bar and button text.
   *
   * @param {string} stage - Current stage ('filtering' or 'evaluating')
   * @param {object} progressData - Progress data object
   * @param {number} [progressData.current] - Current item index (filtering)
   * @param {number} [progressData.total] - Total items (filtering)
   * @param {number} [progressData.pairIndex] - Current pair index (evaluating)
   * @param {number} [progressData.pairTotal] - Total pairs (evaluating)
   * @param {number} [progressData.sampleIndex] - Current sample index (evaluating)
   * @param {number} [progressData.sampleTotal] - Total samples (evaluating)
   * @private
   */
  #handleProgress(stage, progressData) {
    let percent = 0;
    let statusText = '';

    if (stage === 'filtering') {
      const { current, total } = progressData;
      // Filtering is 0-2% of progress (small initial phase)
      percent = total > 0 ? (current / total) * 2 : 0;
      statusText =
        current >= total
          ? 'Filtering complete'
          : `Filtering candidates (${current}/${total})...`;
    } else if (stage === 'evaluating') {
      const { pairIndex, pairTotal, sampleIndex, sampleTotal } = progressData;
      // Evaluation is 2-100% of progress
      const pairProgress = pairTotal > 0 ? pairIndex / pairTotal : 0;
      const sampleProgress = sampleTotal > 0 ? sampleIndex / sampleTotal : 0;
      // Combined progress: pair contribution + sample contribution within current pair
      const combinedProgress =
        pairProgress + sampleProgress / Math.max(pairTotal, 1);
      percent = 2 + combinedProgress * 98;
      statusText = `Pair ${pairIndex + 1}/${pairTotal} (${Math.round(sampleProgress * 100)}%)...`;
    }

    this.#updateProgress(percent, statusText);

    // Update button text with percentage
    if (this.#runAnalysisBtn) {
      this.#runAnalysisBtn.textContent = `${Math.round(percent)}%`;
    }
  }

  /**
   * Run the prototype overlap analysis.
   *
   * @private
   */
  async #runAnalysis() {
    if (this.#analysisInProgress) {
      this.#logger.warn(
        '[PrototypeAnalysisController] Analysis already in progress'
      );
      return;
    }

    this.#analysisInProgress = true;
    this.#disableControls();
    this.#showProgressPanel();
    this.#hideResults();

    const prototypeFamily = this.#prototypeFamilySelect?.value ?? 'emotion';
    const sampleCount = parseInt(
      this.#sampleCountSelect?.value ?? '8000',
      10
    );

    this.#logger.info(
      `[PrototypeAnalysisController] Starting analysis: family=${prototypeFamily}, samples=${sampleCount}`
    );

    try {
      const result = await this.#prototypeOverlapAnalyzer.analyze({
        prototypeFamily,
        sampleCount,
        onProgress: (stage, progressData) => {
          this.#handleProgress(stage, progressData);
        },
      });

      this.#updateProgress(100, 'Analysis complete');
      if (this.#runAnalysisBtn) {
        this.#runAnalysisBtn.textContent = '100%';
      }
      this.#renderResults(result);

      this.#logger.info(
        `[PrototypeAnalysisController] Analysis complete: ${result.recommendations.length} recommendations`
      );
    } catch (error) {
      this.#logger.error(
        '[PrototypeAnalysisController] Analysis failed',
        error
      );
      this.#renderError(error);
    } finally {
      this.#analysisInProgress = false;
      this.#hideProgressPanel();
      this.#enableControls();

      // Restore original button text
      if (this.#runAnalysisBtn) {
        this.#runAnalysisBtn.textContent = this.#originalButtonText;
      }
    }
  }

  /**
   * Hide the results panel.
   *
   * @private
   */
  #hideResults() {
    if (this.#resultsPanel) {
      this.#resultsPanel.hidden = true;
    }
  }

  /**
   * Render analysis results.
   *
   * @param {object} result - Analysis result from PrototypeOverlapAnalyzer
   * @param {Array} result.recommendations - Array of recommendation objects
   * @param {object} result.metadata - Analysis metadata
   * @private
   */
  #renderResults(result) {
    const { recommendations, nearMisses, metadata } = result;

    // Show results panel
    if (this.#resultsPanel) {
      this.#resultsPanel.hidden = false;
    }

    // Render metadata summary
    this.#renderMetadata(metadata);

    // Clear previous recommendations
    if (this.#recommendationsContainer) {
      this.#recommendationsContainer.innerHTML = '';
    }

    // Determine what to show
    const hasRecommendations = recommendations && recommendations.length > 0;
    const hasNearMisses = nearMisses && nearMisses.length > 0;

    // Show empty state or content
    if (!hasRecommendations && !hasNearMisses) {
      if (this.#emptyState) {
        this.#emptyState.hidden = false;
      }
    } else {
      if (this.#emptyState) {
        this.#emptyState.hidden = true;
      }

      // Render redundant pair recommendations first
      if (hasRecommendations) {
        recommendations.forEach((rec, index) => {
          this.#renderRecommendationCard(rec, index);
        });
      }

      // Render near-misses if present
      if (hasNearMisses) {
        this.#renderNearMissesSection(nearMisses);
      }
    }
  }


  /**
   * Render the near-misses section showing pairs that came close to redundancy.
   *
   * @param {Array} nearMisses - Array of near-miss pair information
   */
  #renderNearMissesSection(nearMisses) {
    if (!this.#recommendationsContainer || !nearMisses.length) return;

    const section = document.createElement('div');
    section.className = 'near-misses-section';

    const header = document.createElement('h3');
    header.className = 'near-misses-header';
    header.textContent = `Near-Miss Pairs (${nearMisses.length})`;

    const description = document.createElement('p');
    description.className = 'near-misses-description';
    description.textContent =
      'These pairs came close to redundancy thresholds but are still behaviorally distinct. Review if you want to further differentiate them.';

    section.appendChild(header);
    section.appendChild(description);

    const list = document.createElement('div');
    list.className = 'near-misses-list';

    nearMisses.forEach((nearMiss, index) => {
      const card = this.#renderNearMissCard(nearMiss, index);
      list.appendChild(card);
    });

    section.appendChild(list);
    this.#recommendationsContainer.appendChild(section);
  }

  /**
   * Render a single near-miss card.
   *
   * @param {object} nearMiss - Near-miss pair information
   * @param {number} index - Index in the list
   * @returns {HTMLElement} The card element
   */
  #renderNearMissCard(nearMiss, index) {
    const card = document.createElement('div');
    card.className = 'near-miss-card';

    const { prototypeA, prototypeB, nearMissInfo } = nearMiss;
    const correlation = nearMissInfo?.metrics?.pearsonCorrelation ?? 0;
    const gateOverlapRatio = nearMissInfo?.metrics?.gateOverlapRatio ?? 0;

    card.innerHTML = `
      <div class="near-miss-header">
        <span class="near-miss-index">#${index + 1}</span>
        <span class="near-miss-prototypes">
          <strong>${this.#escapeHtml(prototypeA)}</strong>
          <span class="arrow">↔</span>
          <strong>${this.#escapeHtml(prototypeB)}</strong>
        </span>
      </div>
      <div class="near-miss-metrics">
        <div class="metric">
          <span class="metric-label">Correlation:</span>
          <span class="metric-value">${correlation.toFixed(3)}</span>
        </div>
        <div class="metric">
          <span class="metric-label">Gate Overlap:</span>
          <span class="metric-value">${(gateOverlapRatio * 100).toFixed(1)}%</span>
        </div>
      </div>
      ${
        nearMissInfo?.reason
          ? `<div class="near-miss-reason">
               <span class="reason-label">Close to threshold:</span>
               <span class="reason-value">${this.#escapeHtml(nearMissInfo.reason)}</span>
             </div>`
          : ''
      }
    `;

    return card;
  }

  /**
   * Render metadata summary.
   *
   * @param {object} metadata - Analysis metadata
   * @private
   */
  #renderMetadata(metadata) {
    if (!this.#resultsMetadata) return;

    const {
      prototypeFamily,
      totalPrototypes,
      candidatePairsFound,
      candidatePairsEvaluated,
      redundantPairsFound,
      sampleCountPerPair,
      filteringStats,
      classificationBreakdown,
      summaryInsight,
    } = metadata;

    // Calculate filtering percentage
    const filteringPercentage =
      filteringStats?.totalPossiblePairs > 0
        ? (
            (filteringStats.passedFiltering /
              filteringStats.totalPossiblePairs) *
            100
          ).toFixed(1)
        : '0.0';

    // Build filtering breakdown text
    const filteringBreakdown = filteringStats
      ? `<div class="metadata-detail">
           <span class="detail-label">Total possible pairs:</span>
           <span class="detail-value">${filteringStats.totalPossiblePairs.toLocaleString()}</span>
         </div>
         <div class="metadata-detail">
           <span class="detail-label">Passed filtering:</span>
           <span class="detail-value">${filteringStats.passedFiltering.toLocaleString()} (${filteringPercentage}%)</span>
         </div>
         <div class="metadata-detail rejection-breakdown">
           <span class="detail-label">Rejected by:</span>
           <span class="detail-value">
             Axis overlap: ${filteringStats.rejectedByActiveAxisOverlap.toLocaleString()} |
             Sign agreement: ${filteringStats.rejectedBySignAgreement.toLocaleString()} |
             Cosine sim: ${filteringStats.rejectedByCosineSimilarity.toLocaleString()}
           </span>
         </div>`
      : '';

    // Build classification breakdown text (v2 property names)
    const classBreakdown = classificationBreakdown
      ? `<div class="metadata-detail">
           <span class="detail-label">Classification:</span>
           <span class="detail-value">
             <span class="classification-merge">${classificationBreakdown.mergeRecommended} merge</span> |
             <span class="classification-subsumed">${classificationBreakdown.subsumedRecommended} subsumed</span> |
             <span class="classification-nested">${classificationBreakdown.nestedSiblings} nested</span> |
             <span class="classification-separation">${classificationBreakdown.needsSeparation} separation</span> |
             <span class="classification-expression">${classificationBreakdown.convertToExpression} expression</span> |
             <span class="classification-distinct">${classificationBreakdown.keepDistinct} distinct</span>
           </span>
         </div>`
      : '';

    // Build summary insight text
    const summarySection = summaryInsight
      ? `<div class="summary-insight status-${this.#escapeHtml(summaryInsight.status)}">
           <strong>Summary:</strong> ${this.#escapeHtml(summaryInsight.message)}
           ${
             summaryInsight.closestPair
               ? `<div class="closest-pair">
                    Closest pair: <em>${this.#escapeHtml(summaryInsight.closestPair.prototypeA)}</em> ↔
                    <em>${this.#escapeHtml(summaryInsight.closestPair.prototypeB)}</em>
                    <div class="closest-pair-metrics">
                      <span title="Composite score: weighted combination of gate overlap (50%), correlation (30%), and global similarity (20%)">
                        composite: <strong>${this.#formatMetric(summaryInsight.closestPair.compositeScore)}</strong>
                      </span> |
                      <span title="Proportion of contexts where both prototypes fire">
                        gate overlap: ${this.#formatMetric(summaryInsight.closestPair.gateOverlapRatio)}
                      </span> |
                      <span title="Pearson correlation when both prototypes fire (co-pass only)">
                        correlation: ${this.#formatMetric(summaryInsight.closestPair.correlation)}
                      </span> |
                      <span title="Mean absolute output difference over ALL samples (not just co-pass)">
                        global diff: ${this.#formatMetric(summaryInsight.closestPair.globalMeanAbsDiff)}
                      </span>
                    </div>
                  </div>`
               : ''
           }
         </div>`
      : '';

    this.#resultsMetadata.innerHTML = `
      <div class="metadata-grid">
        <div class="metadata-item">
          <span class="metadata-label">Family:</span>
          <span class="metadata-value">${this.#escapeHtml(prototypeFamily)}</span>
        </div>
        <div class="metadata-item">
          <span class="metadata-label">Prototypes:</span>
          <span class="metadata-value">${totalPrototypes}</span>
        </div>
        <div class="metadata-item">
          <span class="metadata-label">Candidates:</span>
          <span class="metadata-value">${candidatePairsFound}</span>
        </div>
        <div class="metadata-item">
          <span class="metadata-label">Evaluated:</span>
          <span class="metadata-value">${candidatePairsEvaluated}</span>
        </div>
        <div class="metadata-item">
          <span class="metadata-label">Redundant:</span>
          <span class="metadata-value redundant-count">${redundantPairsFound}</span>
        </div>
        <div class="metadata-item">
          <span class="metadata-label">Samples/Pair:</span>
          <span class="metadata-value">${sampleCountPerPair}</span>
        </div>
      </div>
      
      <div class="metadata-expanded">
        <details class="filtering-details">
          <summary>Filtering Details</summary>
          ${filteringBreakdown}
        </details>
        
        ${classBreakdown}
        
        ${summarySection}
      </div>
    `;
  }

  /**
   * Render a single recommendation card.
   *
   * Handles both v1 format (prototypeA, prototypeB, actionableInsight, divergenceExamples)
   * and v2 format (prototypes: {a, b}, actions: [], evidence: {divergenceExamples}).
   *
   * @param {object} recommendation - Recommendation object
   * @param {number} index - Card index for unique IDs
   * @private
   */
  #renderRecommendationCard(recommendation, index) {
    if (!this.#recommendationsContainer) return;

    const {
      // v1 fields (backward compatible)
      prototypeA: v1ProtoA,
      prototypeB: v1ProtoB,
      summary,
      actionableInsight,
      divergenceExamples: v1Divergence,
      // v2 fields
      prototypes,
      actions,
      evidence,
      // Common fields
      severity,
      type,
    } = recommendation;

    // Extract prototype names: prefer v2 nested format, fall back to v1, then fallback text
    const prototypeA = prototypes?.a ?? v1ProtoA ?? 'Unknown A';
    const prototypeB = prototypes?.b ?? v1ProtoB ?? 'Unknown B';

    // Build actionable insight: prefer v2 actions array, fall back to v1 string
    let actionText;
    if (Array.isArray(actions) && actions.length > 0) {
      actionText = actions.join(' • ');
    } else if (actionableInsight) {
      actionText = actionableInsight;
    } else {
      actionText = 'No specific actions recommended.';
    }

    // Extract divergence examples: prefer v2 evidence.divergenceExamples, fall back to v1
    const divergenceExamples = evidence?.divergenceExamples ?? v1Divergence ?? [];

    // Build summary text: use v1 summary if available, otherwise derive from type
    const summaryText = summary ?? this.#deriveSummaryFromType(type);

    const severityClass = this.#getSeverityClass(severity);
    const typeLabel = this.#formatType(type);
    const cardId = `rec-card-${index}`;
    const detailsId = `rec-details-${index}`;

    const card = document.createElement('article');
    card.className = `recommendation-card ${severityClass}`;
    card.id = cardId;

    card.innerHTML = `
      <header class="rec-header">
        <div class="rec-prototypes">
          <span class="prototype-name">${this.#escapeHtml(prototypeA)}</span>
          <span class="vs-separator">↔</span>
          <span class="prototype-name">${this.#escapeHtml(prototypeB)}</span>
        </div>
        <div class="rec-badges">
          <span class="severity-badge ${severityClass}">${severity.toFixed(2)}</span>
          <span class="type-badge">${typeLabel}</span>
        </div>
      </header>
      <div class="rec-summary">
        <p>${this.#escapeHtml(summaryText)}</p>
      </div>
      <button class="rec-expander" aria-expanded="false" aria-controls="${detailsId}">
        Show Details
      </button>
      <div id="${detailsId}" class="rec-details" hidden>
        <div class="rec-insight">
          <h4>Actionable Insight</h4>
          <p>${this.#escapeHtml(actionText)}</p>
        </div>
        ${this.#renderDivergenceExamples(divergenceExamples)}
      </div>
    `;

    // Bind expander toggle
    const expander = card.querySelector('.rec-expander');
    const details = card.querySelector('.rec-details');
    expander?.addEventListener('click', () => {
      const isExpanded = expander.getAttribute('aria-expanded') === 'true';
      expander.setAttribute('aria-expanded', String(!isExpanded));
      expander.textContent = isExpanded ? 'Show Details' : 'Hide Details';
      if (details) {
        details.hidden = isExpanded;
      }
    });

    this.#recommendationsContainer.appendChild(card);
  }

  /**
   * Derive a summary from the recommendation type when summary is not provided.
   *
   * @param {string} type - Recommendation type
   * @returns {string} Derived summary text
   * @private
   */
  #deriveSummaryFromType(type) {
    const summaries = {
      prototype_merge_suggestion:
        'These prototypes behave nearly identically and may be candidates for merging.',
      prototype_subsumption_suggestion:
        'One prototype appears to be a behavioral subset of the other.',
      prototype_overlap_info:
        'These prototypes share significant structural similarity.',
      prototype_nested_siblings:
        'These prototypes have a nested relationship where one contains the other.',
      prototype_needs_separation:
        'These prototypes overlap significantly but serve different purposes.',
      prototype_distinct_info:
        'These prototypes are correctly distinct despite structural similarity.',
      prototype_expression_conversion:
        'These prototypes may be better expressed as a single parameterized definition.',
      // v1 types
      structurally_redundant:
        'These prototypes share significant structural overlap.',
      behaviorally_redundant:
        'These prototypes produce similar behavioral responses.',
      high_overlap: 'These prototypes have high overlap but are behaviorally distinct.',
      not_redundant: 'These prototypes are sufficiently distinct.',
    };
    return summaries[type] ?? 'Prototype overlap detected.';
  }

  /**
   * Render divergence examples section.
   *
   * @param {Array} examples - Array of divergence example objects
   * @returns {string} HTML string
   * @private
   */
  #renderDivergenceExamples(examples) {
    if (!examples || examples.length === 0) {
      return '';
    }

    const exampleItems = examples
      .slice(0, 3) // Show max 3 examples
      .map((ex) => {
        const diffFormatted =
          typeof ex.intensityDifference === 'number'
            ? ex.intensityDifference.toFixed(3)
            : 'N/A';
        return `
          <li class="divergence-example">
            <span class="diff-value">Δ ${diffFormatted}</span>
            <span class="example-context">${this.#escapeHtml(ex.contextSummary ?? '')}</span>
          </li>
        `;
      })
      .join('');

    return `
      <div class="rec-divergence">
        <h4>Divergence Examples</h4>
        <ul class="divergence-list">
          ${exampleItems}
        </ul>
      </div>
    `;
  }

  /**
   * Get CSS class for severity level.
   *
   * @param {number} severity - Severity score (0-1)
   * @returns {string} CSS class name
   * @private
   */
  #getSeverityClass(severity) {
    if (severity >= 0.8) return 'severity-high';
    if (severity >= 0.5) return 'severity-medium';
    return 'severity-low';
  }

  /**
   * Format classification type for display.
   *
   * Handles both v1 types (structurally_redundant, etc.) and
   * v2 types (prototype_merge_suggestion, prototype_nested_siblings, etc.).
   *
   * @param {string} type - Classification type
   * @returns {string} Human-readable label
   * @private
   */
  #formatType(type) {
    const typeLabels = {
      // v1 types (backward compatible)
      structurally_redundant: 'Structurally Redundant',
      behaviorally_redundant: 'Behaviorally Redundant',
      high_overlap: 'High Overlap',
      not_redundant: 'Not Redundant',
      // v2 types
      prototype_merge_suggestion: 'Merge Suggestion',
      prototype_subsumption_suggestion: 'Subsumption Suggestion',
      prototype_overlap_info: 'Overlap Info',
      prototype_nested_siblings: 'Nested Siblings',
      prototype_needs_separation: 'Needs Separation',
      prototype_distinct_info: 'Distinct',
      prototype_expression_conversion: 'Expression Conversion',
    };
    return typeLabels[type] ?? type;
  }

  /**
   * Render an error message.
   *
   * @param {Error} error - Error object
   * @private
   */
  #renderError(error) {
    if (!this.#resultsPanel) return;

    this.#resultsPanel.hidden = false;

    if (this.#resultsMetadata) {
      this.#resultsMetadata.innerHTML = '';
    }

    if (this.#recommendationsContainer) {
      this.#recommendationsContainer.innerHTML = `
        <div class="error-banner" role="alert">
          <h3>Analysis Failed</h3>
          <p>${this.#escapeHtml(error.message)}</p>
        </div>
      `;
    }

    if (this.#emptyState) {
      this.#emptyState.hidden = true;
    }
  }

  /**
   * Escape HTML to prevent XSS.
   *
   * @param {string} text - Raw text
   * @returns {string} Escaped HTML
   * @private
   */
  #escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Format a numeric metric for display.
   * Handles NaN, undefined, and formats numbers to 3 decimal places.
   *
   * @param {number|undefined} value - Metric value
   * @returns {string} Formatted metric string
   * @private
   */
  #formatMetric(value) {
    if (value === undefined || value === null || Number.isNaN(value)) {
      return 'N/A';
    }
    if (!Number.isFinite(value)) {
      return 'N/A';
    }
    return value.toFixed(3);
  }
}

export default PrototypeAnalysisController;
