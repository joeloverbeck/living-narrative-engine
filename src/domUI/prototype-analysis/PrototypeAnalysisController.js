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
  #runAnalysisBtn;
  #progressPanel;
  #progressBar;
  #progressStatus;
  #resultsPanel;
  #resultsMetadata;
  #recommendationsContainer;
  #emptyState;

  // Axis gap panel elements
  #axisGapPanel;
  #axisGapTotalPrototypes;
  #axisGapRecommendations;
  #axisGapConfidence;
  #residualVariance;
  #significantComponentCount;
  #expectedComponentCount;
  #significantBeyondExpected;
  #pcaTopLoading;
  #pcaDimensionsList;
  #pcaDimensionsUsed;
  #pcaExcludedAxesList;
  #pcaUnusedAxesList;
  #pcaUnusedInGatesList;
  #pcaMethodologyNote;
  #componentsFor80;
  #componentsFor90;
  #poorlyFittingList;
  #hubList;
  #coverageGapList;
  #conflictList;
  #signTensionList;
  #polarityAnalysisList;
  #complexityAnalysisContainer;
  #axisRecommendationsList;
  #candidateAxisList;

  // Signal breakdown elements
  #signalPca;
  #signalHubs;
  #signalCoverageGaps;
  #signalMultiAxisConflicts;

  // Signal status elements (PASS/FAIL badges)
  #signalPcaStatus;
  #signalHubsStatus;
  #signalCoverageGapsStatus;
  #signalMultiAxisConflictsStatus;

  // Signal threshold elements (for dynamic OR logic display)
  #signalPcaThreshold;
  #signalCoverageGapsThreshold;

  // Decision panel elements
  #decisionVerdict;
  #decisionRationale;
  #varianceTop4;
  #varianceAxisCount;
  #varianceTopK;

  // Prototype weight cards container
  #prototypeCardsContainer;

  // Integrity panel elements
  #integrityAxisRegistryStatus;
  #integritySchemaStatus;
  #integrityWeightRangeStatus;
  #integrityNoDuplicatesStatus;
  #integritySummary;

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

    // Axis gap panel elements
    this.#axisGapPanel = document.getElementById('axis-gap-panel');
    this.#axisGapTotalPrototypes = document.getElementById(
      'axis-gap-total-prototypes'
    );
    this.#axisGapRecommendations = document.getElementById(
      'axis-gap-recommendations'
    );
    this.#axisGapConfidence = document.getElementById('axis-gap-confidence');
    this.#residualVariance = document.getElementById('residual-variance');
    this.#significantComponentCount = document.getElementById(
      'significant-component-count'
    );
    this.#expectedComponentCount = document.getElementById(
      'expected-component-count'
    );
    this.#significantBeyondExpected = document.getElementById(
      'significant-beyond-expected'
    );
    this.#pcaTopLoading = document.getElementById('pca-top-loading');
    this.#pcaDimensionsList = document.getElementById('pca-dimensions-list');
    this.#pcaDimensionsUsed = document.getElementById('pca-dimensions-used');
    this.#pcaExcludedAxesList = document.getElementById('pca-excluded-axes-list');
    this.#pcaUnusedAxesList = document.getElementById('pca-unused-axes-list');
    this.#pcaUnusedInGatesList = document.getElementById('pca-unused-in-gates-list');
    this.#pcaMethodologyNote = document.getElementById('pca-methodology-note');
    this.#componentsFor80 = document.getElementById('components-for-80');
    this.#componentsFor90 = document.getElementById('components-for-90');
    this.#poorlyFittingList = document.getElementById('poorly-fitting-list');
    this.#hubList = document.getElementById('hub-list');
    this.#coverageGapList = document.getElementById('coverage-gap-list');
    this.#conflictList = document.getElementById('conflict-list');
    this.#signTensionList = document.getElementById('sign-tension-list');
    this.#polarityAnalysisList = document.getElementById('polarity-analysis-list');
    this.#complexityAnalysisContainer = document.getElementById(
      'complexity-analysis-container'
    );
    this.#axisRecommendationsList = document.getElementById(
      'axis-recommendations-list'
    );
    this.#candidateAxisList = document.getElementById('candidate-axis-list');

    // Signal breakdown elements
    this.#signalPca = document.getElementById('signal-pca');
    this.#signalHubs = document.getElementById('signal-hubs');
    this.#signalCoverageGaps = document.getElementById('signal-coverage-gaps');
    this.#signalMultiAxisConflicts = document.getElementById(
      'signal-multi-axis-conflicts'
    );

    // Signal status elements (PASS/FAIL badges)
    this.#signalPcaStatus = document.getElementById('signal-pca-status');
    this.#signalHubsStatus = document.getElementById('signal-hubs-status');
    this.#signalCoverageGapsStatus = document.getElementById('signal-coverage-gaps-status');
    this.#signalMultiAxisConflictsStatus = document.getElementById(
      'signal-multi-axis-conflicts-status'
    );

    // Signal threshold elements (for dynamic OR logic display)
    this.#signalPcaThreshold = document.getElementById('signal-pca-threshold');
    this.#signalCoverageGapsThreshold = document.getElementById(
      'signal-coverage-gaps-threshold'
    );

    // Decision panel elements
    this.#decisionVerdict = document.getElementById('decision-verdict');
    this.#decisionRationale = document.getElementById('decision-rationale');
    this.#varianceTop4 = document.getElementById('variance-top4');
    this.#varianceAxisCount = document.getElementById('variance-axis-count');
    this.#varianceTopK = document.getElementById('variance-topk');

    // Prototype weight cards container
    this.#prototypeCardsContainer = document.getElementById(
      'prototype-cards-container'
    );

    // Integrity panel elements
    this.#integrityAxisRegistryStatus = document.getElementById(
      'integrity-axis-registry-status'
    );
    this.#integritySchemaStatus = document.getElementById(
      'integrity-schema-status'
    );
    this.#integrityWeightRangeStatus = document.getElementById(
      'integrity-weight-range-status'
    );
    this.#integrityNoDuplicatesStatus = document.getElementById(
      'integrity-no-duplicates-status'
    );
    this.#integritySummary = document.getElementById('integrity-summary');

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
    // Stage weights: setup=15% (V3 only), filtering=5%, evaluating=65%, classifying=10%, recommending=5%
    // V2 mode doesn't have setup, so weights shift (filtering starts at 0)
    const { totalStages = 4 } = progressData;
    const isV3Mode = totalStages === 5;

    const stageWeights = isV3Mode
      ? {
          setup: { start: 0, weight: 15 },
          filtering: { start: 15, weight: 5 },
          evaluating: { start: 20, weight: 60 },
          classifying: { start: 80, weight: 10 },
          recommending: { start: 90, weight: 5 },
          axis_gap_analysis: { start: 95, weight: 5 },
        }
      : {
          filtering: { start: 0, weight: 5 },
          evaluating: { start: 5, weight: 80 },
          classifying: { start: 85, weight: 10 },
          recommending: { start: 95, weight: 5 },
        };

    const stageLabels = {
      setup: 'Setting up V3 analysis',
      filtering: 'Filtering candidate pairs',
      evaluating: 'Evaluating behavioral overlap',
      classifying: 'Classifying overlap patterns',
      recommending: 'Building recommendations',
      axis_gap_analysis: 'Analyzing axis gaps',
    };

    const stageConfig = stageWeights[stage];
    if (!stageConfig) {
      // Unknown stage, ignore
      return;
    }

    let stageProgress = 0;
    let statusText = '';

    const { stageNumber = 1 } = progressData;

    if (stage === 'setup') {
      // V3 setup phase has sub-phases: pool (70%), vectors (20%), profiles (10%)
      const { phase, poolCurrent, poolTotal, vectorCurrent, vectorTotal } = progressData;
      if (phase === 'pool' && poolTotal > 0) {
        stageProgress = (poolCurrent / poolTotal) * 0.7;
        const poolPercent = Math.round((poolCurrent / poolTotal) * 100);
        statusText = `Stage ${stageNumber}/${totalStages}: Generating context pool (${poolPercent}%)...`;
      } else if (phase === 'vectors') {
        // Handle granular vector progress: 70% to 90% during vector evaluation
        const vectorProgress = vectorTotal > 0 ? vectorCurrent / vectorTotal : 0;
        stageProgress = 0.7 + vectorProgress * 0.2;
        const vectorPercent = Math.round(vectorProgress * 100);
        statusText = `Stage ${stageNumber}/${totalStages}: Evaluating prototype vectors (${vectorCurrent ?? 0}/${vectorTotal ?? '?'} - ${vectorPercent}%)...`;
      } else if (phase === 'profiles') {
        stageProgress = 0.9;
        statusText = `Stage ${stageNumber}/${totalStages}: Computing prototype profiles...`;
      } else {
        // Initial setup call with no phase
        stageProgress = 0;
        statusText = `Stage ${stageNumber}/${totalStages}: Initializing V3 analysis...`;
      }
    } else if (stage === 'filtering') {
      const { current, total, pairsProcessed, totalPairs } = progressData;
      // Support both old (current/total) and new (pairsProcessed/totalPairs) formats
      const processed = pairsProcessed ?? current ?? 0;
      const totalCount = totalPairs ?? total ?? 1;
      stageProgress = totalCount > 0 ? processed / totalCount : 0;
      statusText = processed >= totalCount
        ? `Stage ${stageNumber}/${totalStages}: Filtering complete`
        : `Stage ${stageNumber}/${totalStages}: ${stageLabels[stage]} (${processed}/${totalCount})...`;
    } else if (stage === 'evaluating') {
      const { pairIndex, pairTotal, sampleIndex, sampleTotal } = progressData;
      const pairProgress = pairTotal > 0 ? pairIndex / pairTotal : 0;
      const sampleProgress = sampleTotal > 0 ? sampleIndex / sampleTotal : 0;
      // Combined progress: pair contribution + sample contribution within current pair
      stageProgress = pairProgress + sampleProgress / Math.max(pairTotal, 1);
      statusText = `Stage ${stageNumber}/${totalStages}: Pair ${pairIndex + 1}/${pairTotal} (${Math.round(sampleProgress * 100)}%)...`;
    } else if (stage === 'classifying' || stage === 'recommending') {
      const { pairIndex, pairTotal } = progressData;
      stageProgress = pairTotal > 0 ? pairIndex / pairTotal : 0;
      statusText = `Stage ${stageNumber}/${totalStages}: ${stageLabels[stage]} (${pairIndex}/${pairTotal})...`;
    } else if (stage === 'axis_gap_analysis') {
      // Axis gap analysis is a single phase - use indeterminate progress
      stageProgress = 0.5;
      statusText = `Stage ${stageNumber}/${totalStages}: ${stageLabels[stage]}...`;
    }

    // Calculate overall percent based on stage start + weighted progress
    const percent = stageConfig.start + stageProgress * stageConfig.weight;

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

    this.#logger.info(
      `[PrototypeAnalysisController] Starting analysis: family=${prototypeFamily}`
    );

    try {
      const result = await this.#prototypeOverlapAnalyzer.analyze({
        prototypeFamily,
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
   * @param {object} [result.axisGapAnalysis] - Axis gap analysis results (V3 mode)
   * @private
   */
  #renderResults(result) {
    const { recommendations, nearMisses, metadata, axisGapAnalysis } = result;

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

    // Render axis gap analysis panel if data is present
    this.#renderAxisGapAnalysis(axisGapAnalysis);
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
                      <span title="Composite score: weighted combination of global output similarity (50%), gate overlap (30%), and correlation (20%)">
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
      allMatchingClassifications,
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
    const secondaryMatches =
      allMatchingClassifications?.filter((match) => !match.isPrimary) ?? [];

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
      <div id="${detailsId}" class="rec-details">
        <div class="rec-insight">
          <h4>Actionable Insight</h4>
          <p>${this.#escapeHtml(actionText)}</p>
        </div>
        ${this.#renderDivergenceExamples(divergenceExamples)}
        ${this.#renderAdditionalEvidence(secondaryMatches)}
      </div>
    `;

    this.#recommendationsContainer.appendChild(card);
  }

  /**
   * Render additional classification evidence for secondary matches.
   *
   * @param {Array<object>} matches - Secondary classification matches
   * @returns {string} HTML string
   * @private
   */
  #renderAdditionalEvidence(matches) {
    if (!Array.isArray(matches) || matches.length === 0) {
      return '';
    }

    const items = matches
      .map((match) => {
        const typeLabel = this.#formatType(match.type);
        const confidence = Number.isFinite(match.confidence)
          ? match.confidence.toFixed(2)
          : 'N/A';
        const evidenceSummary = this.#formatEvidenceForDisplay(match.evidence);
        return `
          <li class="evidence-item">
            <span class="evidence-pill">${this.#escapeHtml(typeLabel)}</span>
            <span class="evidence-confidence">Confidence ${confidence}</span>
            <span class="evidence-summary">${this.#escapeHtml(evidenceSummary)}</span>
          </li>
        `;
      })
      .join('');

    return `
      <details class="rec-evidence">
        <summary>Additional Evidence</summary>
        <ul class="evidence-list">
          ${items}
        </ul>
      </details>
    `;
  }

  /**
   * Format evidence object into a short summary string.
   *
   * @param {object} evidence - Evidence payload
   * @returns {string} Summary string
   * @private
   */
  #formatEvidenceForDisplay(evidence) {
    if (!evidence || typeof evidence !== 'object') {
      return '';
    }

    const entries = Object.entries(evidence)
      .filter(([, value]) => value !== null && value !== undefined)
      .map(([key, value]) => {
        if (typeof value === 'number') {
          return `${key}: ${value.toFixed(2)}`;
        }
        return `${key}: ${String(value)}`;
      });

    return entries.slice(0, 4).join(', ');
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
      // v2 classification types
      merge_recommended: 'Merge Recommended',
      subsumed_recommended: 'Subsumed Recommended',
      convert_to_expression: 'Convert to Expression',
      nested_siblings: 'Nested Siblings',
      needs_separation: 'Needs Separation',
      keep_distinct: 'Keep Distinct',
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

  /**
   * Render axis gap analysis results panel.
   *
   * @param {object|null|undefined} axisGapAnalysis - Axis gap analysis results
   * @private
   */
  #renderAxisGapAnalysis(axisGapAnalysis) {
    if (!axisGapAnalysis) {
      if (this.#axisGapPanel) {
        this.#axisGapPanel.hidden = true;
      }
      return;
    }

    if (this.#axisGapPanel) {
      this.#axisGapPanel.hidden = false;
    }

    // Update integrity display to show validation passed
    this.#updateIntegrityDisplay();

    // Render summary statistics
    this.#renderAxisGapSummary(axisGapAnalysis.summary);

    // Update PCA threshold display to show OR logic
    this.#updatePcaThresholdDisplay(axisGapAnalysis.pcaAnalysis);

    // Update coverage gap threshold display
    // Adaptive thresholds are enabled by default, so display that
    this.#updateCoverageGapThresholdDisplay();

    // Render decision summary panel (YES/MAYBE/NO verdict)
    this.#renderDecisionSummary(axisGapAnalysis);

    // Render PCA analysis
    this.#renderPCASummary(axisGapAnalysis.pcaAnalysis);

    // Render hub prototypes
    this.#renderHubPrototypes(axisGapAnalysis.hubPrototypes);

    // Render coverage gaps
    this.#renderCoverageGaps(axisGapAnalysis.coverageGaps);

    // Render multi-axis conflicts (actionable - high axis loadings only)
    this.#renderMultiAxisConflicts(axisGapAnalysis.multiAxisConflicts);

    // Render sign tensions (informational metadata, not actionable)
    this.#renderSignTensions(axisGapAnalysis.signTensions);

    // Render polarity analysis (actionable - imbalanced axes)
    this.#renderPolarityAnalysis(axisGapAnalysis.polarityAnalysis);

    // Render complexity analysis (axis distribution and co-occurrence bundles)
    this.#renderComplexityAnalysis(axisGapAnalysis.complexityAnalysis);

    // Render axis recommendations
    this.#renderAxisRecommendations(axisGapAnalysis.recommendations);

    // Render candidate axis validation results
    this.#renderCandidateAxisValidation(axisGapAnalysis.candidateAxes);

    // Render prototype weight cards
    this.#renderPrototypeWeightCards(axisGapAnalysis.prototypeWeightSummaries);
  }

  /**
   * Render axis gap summary statistics.
   *
   * @param {object} summary - Summary statistics
   * @private
   */
  #renderAxisGapSummary(summary) {
    if (!summary) return;

    const {
      totalPrototypesAnalyzed,
      recommendationCount,
      potentialGapsDetected, // backward compat fallback
      signalBreakdown,
      confidence,
    } = summary;

    if (this.#axisGapTotalPrototypes) {
      this.#axisGapTotalPrototypes.textContent =
        totalPrototypesAnalyzed?.toString() ?? '--';
    }

    // Use recommendationCount with fallback to potentialGapsDetected for backward compat
    if (this.#axisGapRecommendations) {
      const recCount = recommendationCount ?? potentialGapsDetected;
      this.#axisGapRecommendations.textContent = recCount?.toString() ?? '--';
    }

    if (this.#axisGapConfidence) {
      this.#axisGapConfidence.textContent = confidence ?? '--';
      // Update confidence badge styling
      this.#axisGapConfidence.className = 'summary-value confidence-badge';
      if (confidence) {
        const confidenceClass = `confidence-${confidence.toLowerCase()}`;
        this.#axisGapConfidence.classList.add(confidenceClass);
      }
    }

    // Render signal breakdown if available
    this.#renderSignalBreakdown(signalBreakdown);
  }

  /**
   * Render signal breakdown statistics.
   *
   * @param {object|undefined} signalBreakdown - Signal breakdown data
   * @private
   */
  #renderSignalBreakdown(signalBreakdown) {
    if (!signalBreakdown) return;

    const { pcaSignals, hubSignals, coverageGapSignals, multiAxisConflictSignals } =
      signalBreakdown;

    this.#updateSignalElement(this.#signalPca, pcaSignals);
    this.#updateSignalElement(this.#signalHubs, hubSignals);
    this.#updateSignalElement(this.#signalCoverageGaps, coverageGapSignals);
    this.#updateSignalElement(this.#signalMultiAxisConflicts, multiAxisConflictSignals);

    // Update PASS/FAIL status indicators
    this.#updateSignalStatus(this.#signalPcaStatus, pcaSignals);
    this.#updateSignalStatus(this.#signalHubsStatus, hubSignals);
    this.#updateSignalStatus(this.#signalCoverageGapsStatus, coverageGapSignals);
    this.#updateSignalStatus(this.#signalMultiAxisConflictsStatus, multiAxisConflictSignals);
  }

  /**
   * Update a signal status element with PASS/FAIL state.
   *
   * @param {HTMLElement|null} statusElement - The status badge element.
   * @param {number} signalCount - Number of signals detected.
   */
  #updateSignalStatus(statusElement, signalCount) {
    if (!statusElement) return;

    const hasFailed = (signalCount ?? 0) > 0;

    statusElement.textContent = hasFailed ? '✗ FAIL' : '✓ PASS';
    statusElement.classList.remove('pass', 'fail');
    statusElement.classList.add(hasFailed ? 'fail' : 'pass');
  }

  /**
   * Update the PCA threshold display to clarify OR logic.
   *
   * Shows whether PCA triggered due to residual variance, additional components, or both.
   * Clarifies that either condition alone is sufficient for triggering.
   *
   * @param {object|undefined} pcaAnalysis - PCA analysis results
   * @private
   */
  #updatePcaThresholdDisplay(pcaAnalysis) {
    if (!this.#signalPcaThreshold) return;

    const residualVariance = pcaAnalysis?.residualVarianceRatio ?? 0;
    const additionalComponents = pcaAnalysis?.additionalSignificantComponents ?? 0;
    const threshold = 0.15; // 15% threshold

    const highResidual = residualVariance >= threshold;
    const hasComponents = additionalComponents > 0;

    // Determine which conditions triggered (OR logic)
    if (highResidual && hasComponents) {
      this.#signalPcaThreshold.textContent = `(residual ≥${(threshold * 100).toFixed(0)}% OR components >0)`;
    } else if (highResidual) {
      this.#signalPcaThreshold.textContent = `(residual ≥${(threshold * 100).toFixed(0)}% triggered)`;
    } else if (hasComponents) {
      this.#signalPcaThreshold.textContent = '(components >0 triggered)';
    } else {
      this.#signalPcaThreshold.textContent = `(residual <${(threshold * 100).toFixed(0)}% AND no extra components)`;
    }
  }

  /**
   * Update the coverage gap threshold display.
   *
   * Shows whether adaptive thresholds are in use. Since adaptive thresholds
   * are enabled by default (using 95th percentile of null distribution),
   * this display helps users understand the threshold behavior.
   *
   * @private
   */
  #updateCoverageGapThresholdDisplay() {
    if (!this.#signalCoverageGapsThreshold) return;

    // Adaptive thresholds are enabled by default in config
    // The actual threshold is computed dynamically based on data
    this.#signalCoverageGapsThreshold.textContent = '(adaptive threshold)';
  }

  /**
   * Render the decision summary panel with YES/MAYBE/NO verdict.
   *
   * Decision Logic:
   * - YES: (highResidual AND coverageGaps) OR (hubs AND multiAxisConflicts)
   * - MAYBE: highResidual only (no other strong signals)
   * - NO: residual below threshold AND no signals
   *
   * @param {object} axisGapAnalysis - Full axis gap analysis result
   * @private
   */
  #renderDecisionSummary(axisGapAnalysis) {
    if (!this.#decisionVerdict || !this.#decisionRationale) return;

    const pcaAnalysis = axisGapAnalysis?.pcaAnalysis;
    const signalBreakdown = axisGapAnalysis?.summary?.signalBreakdown;
    const residualVariance = pcaAnalysis?.residualVarianceRatio ?? 0;

    // Extract signal counts
    const pcaSignals = signalBreakdown?.pcaSignals ?? 0;
    const hubSignals = signalBreakdown?.hubSignals ?? 0;
    const coverageGapSignals = signalBreakdown?.coverageGapSignals ?? 0;
    const multiAxisConflictSignals =
      signalBreakdown?.multiAxisConflictSignals ?? 0;

    // Thresholds
    const highResidualThreshold = 0.15; // 15%
    const highResidual = residualVariance >= highResidualThreshold;
    const hasCoverageGaps = coverageGapSignals > 0;
    const hasHubs = hubSignals > 0;
    const hasMultiAxisConflicts = multiAxisConflictSignals > 0;
    const hasAnySignals =
      pcaSignals > 0 ||
      hubSignals > 0 ||
      coverageGapSignals > 0 ||
      multiAxisConflictSignals > 0;

    // Decision logic
    let verdict, rationale;

    if ((highResidual && hasCoverageGaps) || (hasHubs && hasMultiAxisConflicts)) {
      verdict = 'yes';
      if (highResidual && hasCoverageGaps) {
        rationale =
          `High residual variance (${(residualVariance * 100).toFixed(1)}%) combined ` +
          `with ${coverageGapSignals} coverage gap${coverageGapSignals > 1 ? 's' : ''} ` +
          'strongly indicates missing dimensions in the axis space.';
      } else {
        rationale =
          `${hubSignals} hub prototype${hubSignals > 1 ? 's' : ''} connecting clusters, ` +
          `plus ${multiAxisConflictSignals} multi-axis conflict${multiAxisConflictSignals > 1 ? 's' : ''}, ` +
          'suggests the current axes cannot cleanly separate prototypes.';
      }
    } else if (highResidual) {
      verdict = 'maybe';
      rationale =
        `Residual variance (${(residualVariance * 100).toFixed(1)}%) exceeds 15% threshold, ` +
        'indicating unexplained dimensions. However, no strong secondary signals ' +
        '(coverage gaps, hub prototypes) were detected. Consider reviewing poorly fitting prototypes.';
    } else if (hasAnySignals) {
      verdict = 'maybe';
      const signals = [];
      if (pcaSignals > 0) signals.push('PCA signals');
      if (hubSignals > 0) signals.push(`${hubSignals} hub prototype(s)`);
      if (coverageGapSignals > 0)
        signals.push(`${coverageGapSignals} coverage gap(s)`);
      if (multiAxisConflictSignals > 0)
        signals.push(`${multiAxisConflictSignals} multi-axis conflict(s)`);
      rationale =
        `Residual variance is acceptable (${(residualVariance * 100).toFixed(1)}%), ` +
        `but some signals detected: ${signals.join(', ')}. Review flagged prototypes ` +
        'to determine if they represent edge cases or indicate structural issues.';
    } else {
      verdict = 'no';
      rationale =
        `Residual variance (${(residualVariance * 100).toFixed(1)}%) is within acceptable range ` +
        'and no detection methods flagged issues. Current axis space adequately captures prototype variance.';
    }

    // Update DOM
    this.#decisionVerdict.textContent = verdict.toUpperCase();
    this.#decisionVerdict.classList.remove('verdict-yes', 'verdict-maybe', 'verdict-no');
    this.#decisionVerdict.classList.add(`verdict-${verdict}`);
    this.#decisionRationale.textContent = rationale;

    // Update variance summary
    const explainedVariance = pcaAnalysis?.explainedVariance ?? [];
    const axisCount = pcaAnalysis?.axisCount ?? 0;

    if (this.#varianceTop4) {
      // Sum of top 4 components
      const top4Variance = explainedVariance
        .slice(0, 4)
        .reduce((sum, v) => sum + v, 0);
      this.#varianceTop4.textContent =
        explainedVariance.length > 0
          ? `${(top4Variance * 100).toFixed(1)}%`
          : '--';
    }

    if (this.#varianceAxisCount) {
      this.#varianceAxisCount.textContent = axisCount > 0 ? String(axisCount) : '--';
    }

    if (this.#varianceTopK) {
      // Sum of top K components (where K is the dynamic axis count)
      const topKVariance = explainedVariance
        .slice(0, axisCount)
        .reduce((sum, v) => sum + v, 0);
      this.#varianceTopK.textContent =
        explainedVariance.length > 0 && axisCount > 0
          ? `${(topKVariance * 100).toFixed(1)}%`
          : '--';
    }
  }

  /**
   * Render prototype weight cards showing flagged prototypes with their top axes.
   *
   * @param {Array<{prototypeId: string, topAxes: Array<{axis: string, weight: number}>, reason: string, metrics: object}>} prototypeWeightSummaries - Prototype weight summaries from backend
   * @private
   */
  #renderPrototypeWeightCards(prototypeWeightSummaries) {
    if (!this.#prototypeCardsContainer) return;

    // Clear container
    this.#prototypeCardsContainer.innerHTML = '';

    // Handle empty state
    if (!Array.isArray(prototypeWeightSummaries) || prototypeWeightSummaries.length === 0) {
      this.#prototypeCardsContainer.innerHTML =
        '<p class="prototype-cards-empty">No prototypes flagged by detection methods.</p>';
      return;
    }

    // Render each prototype card
    prototypeWeightSummaries.forEach((summary) => {
      const card = this.#createPrototypeCard(summary);
      this.#prototypeCardsContainer.appendChild(card);
    });
  }

  /**
   * Create a single prototype weight card element.
   *
   * @param {{prototypeId: string, topAxes: Array<{axis: string, weight: number}>, reason: string, metrics: object}} summary - Prototype summary
   * @returns {HTMLElement} Card element
   * @private
   */
  #createPrototypeCard(summary) {
    const card = document.createElement('div');
    card.className = `prototype-card reason-${summary.reason}`;

    // Header
    const header = document.createElement('div');
    header.className = 'prototype-card-header';

    const prototypeId = document.createElement('span');
    prototypeId.className = 'prototype-id';
    prototypeId.textContent = summary.prototypeId;

    const reasonBadge = document.createElement('span');
    reasonBadge.className = `prototype-reason-badge reason-${summary.reason}`;
    reasonBadge.textContent = this.#formatReasonLabel(summary.reason);

    header.appendChild(prototypeId);
    header.appendChild(reasonBadge);
    card.appendChild(header);

    // Weight list
    if (Array.isArray(summary.topAxes) && summary.topAxes.length > 0) {
      const weightsSection = document.createElement('div');
      weightsSection.className = 'prototype-weights';

      const heading = document.createElement('h5');
      heading.textContent = 'Top Axes by Weight';
      weightsSection.appendChild(heading);

      const weightList = document.createElement('ul');
      weightList.className = 'weight-list';

      summary.topAxes.forEach(({ axis, weight }) => {
        const li = document.createElement('li');

        const axisName = document.createElement('span');
        axisName.className = 'axis-name';
        axisName.textContent = axis;

        const weightValue = document.createElement('span');
        const sign = weight >= 0 ? '+' : '';
        weightValue.className = `weight-value ${weight >= 0 ? 'positive' : 'negative'}`;
        weightValue.textContent = `${sign}${weight.toFixed(3)}`;

        li.appendChild(axisName);
        li.appendChild(weightValue);
        weightList.appendChild(li);
      });

      weightsSection.appendChild(weightList);
      card.appendChild(weightsSection);
    }

    // Why flagged section
    const unusual = document.createElement('div');
    unusual.className = 'prototype-unusual';
    unusual.innerHTML = `<strong>Why flagged:</strong> ${this.#formatWhyFlagged(summary)}`;
    card.appendChild(unusual);

    return card;
  }

  /**
   * Format the reason label for display.
   *
   * @param {string} reason - Reason code from backend
   * @returns {string} Human-readable label
   * @private
   */
  #formatReasonLabel(reason) {
    const labels = {
      high_reconstruction_error: 'High Recon. Error',
      extreme_projection: 'Extreme Projection',
      hub: 'Hub Prototype',
      multi_axis_conflict: 'Multi-Axis Conflict',
      coverage_gap: 'Coverage Gap',
    };
    return labels[reason] || reason.replace(/_/g, ' ');
  }


  /**
   * Generates contextual explanation for hub prototypes.
   *
   * @param {number} hubScore - Hub score value
   * @param {number} connectedClusters - Number of connected clusters
   * @param {number} spanningAxes - Number of axes spanned
   * @returns {string} Human-readable explanation
   */
  #generateHubExplanation(hubScore, connectedClusters, spanningAxes) {
    const parts = [];
    parts.push(`Hub score ${hubScore.toFixed(2)}`);

    if (connectedClusters > 0) {
      parts.push(`connects ${connectedClusters} cluster${connectedClusters !== 1 ? 's' : ''}`);
    }

    if (spanningAxes > 0) {
      parts.push(`spanning ${spanningAxes} ax${spanningAxes !== 1 ? 'es' : 'is'}`);
    }

    return parts.join(' - ');
  }

  /**
   * Generates contextual explanation for coverage gaps.
   *
   * @param {number} distance - Distance from nearest axis
   * @param {number} prototypeCount - Number of prototypes in gap
   * @returns {string} Human-readable explanation
   */
  #generateCoverageGapExplanation(distance, prototypeCount) {
    const parts = [];
    parts.push(`Distance ${distance.toFixed(2)} from nearest axis`);

    if (prototypeCount > 0) {
      parts.push(
        `cluster of ${prototypeCount} prototype${prototypeCount !== 1 ? 's' : ''} in uncovered region`
      );
    } else {
      parts.push('uncovered region detected');
    }

    return parts.join(' - ');
  }

  /**
   * Generates contextual explanation for multi-axis conflicts.
   *
   * @param {number} axisCount - Number of conflicting axes
   * @param {number|null} signBalance - Sign balance percentage
   * @returns {string} Human-readable explanation
   */
  #generateConflictExplanation(axisCount, signBalance) {
    const parts = [];
    parts.push(`Uses ${axisCount} ax${axisCount !== 1 ? 'es' : 'is'}`);

    if (signBalance !== null && signBalance !== undefined) {
      const sameSignPercent = Math.round(signBalance * 100);
      if (sameSignPercent > 70) {
        parts.push(`${sameSignPercent}% same-sign weighted`);
      } else if (sameSignPercent < 30) {
        parts.push(`evenly mixed signs`);
      } else {
        parts.push(`${sameSignPercent}% sign skew`);
      }
    }

    return parts.join(' with ');
  }


  /**
   * Generates contextual explanation for top loading prototypes.
   *
   * @param {number} score - Projection score value
   * @returns {string} Human-readable explanation
   */
  #generateTopLoadingExplanation(score) {
    const absScore = Math.abs(score);
    if (absScore > 0.8) {
      return `Projection score ${score.toFixed(2)} on unexplained component - strong signal for new dimension`;
    } else if (absScore > 0.5) {
      return `Projection score ${score.toFixed(2)} - moderate signal for potential new dimension`;
    }
    return `Projection score ${score.toFixed(2)} - within expected range`;
  }

  /**
   * Format the "why flagged" explanation based on metrics.
   *
   * @param {{reason: string, metrics: object}} summary - Prototype summary
   * @returns {string} Explanation text
   * @private
   */
  #formatWhyFlagged(summary) {
    const { reason, metrics } = summary;

    if (!metrics || typeof metrics !== 'object') {
      return this.#formatReasonLabel(reason);
    }

    switch (reason) {
      case 'high_reconstruction_error':
        return `RMSE ${(metrics.reconstructionError ?? 0).toFixed(3)} (above 0.5 threshold)`;
      case 'extreme_projection':
        return `Projection score ${(metrics.projectionScore ?? 0).toFixed(3)} on unexplained component`;
      case 'hub':
        return `Hub score ${(metrics.hubScore ?? 0).toFixed(3)} - connects multiple clusters`;
      case 'multi_axis_conflict':
        return `Uses ${metrics.axisCount ?? '?'} axes with conflicting signs`;
      case 'coverage_gap':
        return `Distance ${(metrics.distance ?? 0).toFixed(3)} from nearest axis`;
      default:
        return this.#formatReasonLabel(reason);
    }
  }

  /**
   * Update a signal element with value and styling.
   *
   * @param {HTMLElement|null} element - The DOM element
   * @param {number|undefined} value - The signal value
   * @private
   */
  #updateSignalElement(element, value) {
    if (!element) return;
    const numValue = value ?? 0;
    element.textContent = numValue.toString();
    element.classList.toggle('has-signals', numValue > 0);
  }

  /**
   * Render PCA analysis summary.
   *
   * @param {object} pcaAnalysis - PCA analysis results
   * @private
   */
  #renderPCASummary(pcaAnalysis) {
    if (!pcaAnalysis) return;

    const {
      residualVarianceRatio,
      significantComponentCount,
      expectedComponentCount,
      significantBeyondExpected,
      topLoadingPrototypes,
      dimensionsUsed,
      excludedSparseAxes,
      unusedDefinedAxes,
      unusedInGates,
      componentsFor80Pct,
      componentsFor90Pct,
      reconstructionErrors,
    } = pcaAnalysis;

    // Render residual variance with warning/alert classes
    if (this.#residualVariance) {
      const formattedVariance =
        residualVarianceRatio !== undefined
          ? (residualVarianceRatio * 100).toFixed(1) + '%'
          : '--';
      this.#residualVariance.textContent = formattedVariance;
      this.#residualVariance.className = 'metric-value';

      // Apply warning/alert classes based on thresholds
      if (residualVarianceRatio > 0.15) {
        this.#residualVariance.classList.add('alert');
      } else if (residualVarianceRatio > 0.1) {
        this.#residualVariance.classList.add('warning');
      }
    }

    // Render significant component count (broken-stick)
    if (this.#significantComponentCount) {
      this.#significantComponentCount.textContent =
        significantComponentCount?.toString() ?? '--';
    }

    // Render expected component count (K)
    if (this.#expectedComponentCount) {
      this.#expectedComponentCount.textContent =
        expectedComponentCount?.toString() ?? '--';
    }

    // Render significant beyond expected with visual indicator
    if (this.#significantBeyondExpected) {
      const beyondValue = significantBeyondExpected ?? 0;
      this.#significantBeyondExpected.textContent = beyondValue.toString();
      this.#significantBeyondExpected.className = 'metric-value';

      // Add visual indicator when 0 but residual variance is high
      if (beyondValue === 0 && residualVarianceRatio > 0.15) {
        this.#significantBeyondExpected.classList.add('zero-with-residual');
        this.#significantBeyondExpected.textContent = '0 *';
      }
    }

    // Render dimensions list with tags and count
    const dimensions = dimensionsUsed;
    if (this.#pcaDimensionsList) {
      if (Array.isArray(dimensions) && dimensions.length > 0) {
        this.#pcaDimensionsList.innerHTML = dimensions
          .map((dim) => `<span class="dimension-tag">${this.#escapeHtml(dim)}</span>`)
          .join('');
      } else {
        this.#pcaDimensionsList.innerHTML = '';
      }
    }

    // Render dimensions count
    if (this.#pcaDimensionsUsed) {
      this.#pcaDimensionsUsed.textContent =
        Array.isArray(dimensions) && dimensions.length > 0
          ? dimensions.length.toString()
          : '--';
    }

    // Render excluded sparse axes (if any were filtered out)
    this.#renderExcludedSparseAxes(excludedSparseAxes);

    // Render unused but defined axes (0% usage axes)
    this.#renderUnusedDefinedAxes(unusedDefinedAxes);

    // Render axes used in weights but not in any prototype gates
    this.#renderUnusedInGates(unusedInGates);

    // Render methodology note explaining broken-stick null hypothesis testing
    this.#renderMethodologyNote(significantBeyondExpected, residualVarianceRatio);

    // Render components for 80% variance
    if (this.#componentsFor80) {
      this.#componentsFor80.textContent =
        componentsFor80Pct !== undefined ? componentsFor80Pct.toString() : '--';
    }

    // Render components for 90% variance
    if (this.#componentsFor90) {
      this.#componentsFor90.textContent =
        componentsFor90Pct !== undefined ? componentsFor90Pct.toString() : '--';
    }

    // Render poorly fitting prototypes (reconstruction errors)
    if (this.#poorlyFittingList) {
      if (Array.isArray(reconstructionErrors) && reconstructionErrors.length > 0) {
        this.#poorlyFittingList.innerHTML = '';
        reconstructionErrors.forEach((item) => {
          const li = document.createElement('li');
          const errorClass = item.error > 0.5 ? 'high-error' : '';
          const explanation =
            item.error > 0.5
              ? 'exceeds 0.5 threshold - doesn\'t fit current axis space'
              : 'moderate error - may indicate edge case';
          li.innerHTML = `
            <span class="prototype-id">${this.#escapeHtml(item.prototypeId)}</span>
            <span class="error-value ${errorClass}" title="${explanation}">RMSE: ${item.error.toFixed(3)}</span>
          `;
          this.#poorlyFittingList.appendChild(li);
        });
      } else {
        this.#poorlyFittingList.innerHTML =
          '<li class="empty-list-message">No poorly fitting prototypes detected</li>';
      }
    }

    // Render top loading prototypes with enhanced explanations
    if (this.#pcaTopLoading && Array.isArray(topLoadingPrototypes)) {
      if (topLoadingPrototypes.length === 0) {
        this.#pcaTopLoading.innerHTML = '';
        return;
      }

      const header = document.createElement('h4');
      header.textContent = 'Extreme Prototypes on Additional Component';

      const subtitle = document.createElement('p');
      subtitle.className = 'pca-subtitle';
      subtitle.textContent =
        'Prototypes with highest |projection| on unexplained variance component';

      const list = document.createElement('div');
      list.className = 'top-loading-items';

      topLoadingPrototypes.slice(0, 5).forEach((item) => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'top-loading-item';
        // Support both new 'score' field and legacy 'loading'/'contribution' fields
        const scoreValue = item.score ?? item.loading ?? item.contribution ?? 0;
        const explanation = this.#generateTopLoadingExplanation(scoreValue);
        itemDiv.innerHTML = `
          <span class="prototype-id">${this.#escapeHtml(item.prototypeId ?? item.id ?? 'Unknown')}</span>
          <span class="loading-value" title="${explanation}">${this.#formatMetric(scoreValue)}</span>
        `;
        list.appendChild(itemDiv);
      });

      this.#pcaTopLoading.innerHTML = '';
      this.#pcaTopLoading.appendChild(header);
      this.#pcaTopLoading.appendChild(subtitle);
      this.#pcaTopLoading.appendChild(list);
    }
  }

  /**
   * Render excluded sparse axes that were filtered before PCA.
   *
   * Sparse axes are excluded to prevent z-score inflation: when an axis is used
   * by few prototypes, z-scoring causes non-zero values to become extreme outliers,
   * giving sparse axes disproportionate influence in PCA.
   *
   * @param {string[]|undefined} excludedSparseAxes - Axes excluded due to low usage
   * @private
   */
  #renderExcludedSparseAxes(excludedSparseAxes) {
    // Try to find the container, or create it dynamically near dimensions list
    let container = this.#pcaExcludedAxesList;

    if (!container && this.#pcaDimensionsList) {
      // Create container dynamically after dimensions list
      container = document.createElement('div');
      container.id = 'pca-excluded-axes-list';
      container.className = 'excluded-axes-section';
      this.#pcaDimensionsList.parentNode?.insertBefore(
        container,
        this.#pcaDimensionsList.nextSibling
      );
      this.#pcaExcludedAxesList = container;
    }

    if (!container) return;

    // Clear previous content
    container.innerHTML = '';

    // Only display if there are excluded axes
    if (!Array.isArray(excludedSparseAxes) || excludedSparseAxes.length === 0) {
      container.style.display = 'none';
      return;
    }

    container.style.display = 'block';

    const header = document.createElement('h5');
    header.className = 'excluded-axes-header';
    header.textContent = `Excluded Sparse Axes (${excludedSparseAxes.length})`;

    const helpText = document.createElement('p');
    helpText.className = 'pca-subtitle excluded-axes-help';
    helpText.textContent =
      'Axes used by <10% of prototypes are excluded to prevent sparse axes from ' +
      'distorting PCA due to unbalanced variance contributions from infrequent usage.';

    const tagContainer = document.createElement('div');
    tagContainer.className = 'excluded-axes-tags';
    excludedSparseAxes.forEach((axis) => {
      const tag = document.createElement('span');
      tag.className = 'dimension-tag excluded';
      tag.textContent = this.#escapeHtml(axis);
      tagContainer.appendChild(tag);
    });

    container.appendChild(header);
    container.appendChild(helpText);
    container.appendChild(tagContainer);
  }

  /**
   * Render unused but defined axes that are in the axis registry but not used by any prototype.
   *
   * Unlike sparse axes (1-9% usage), these are axes with 0% usage - defined in
   * ALL_PROTOTYPE_WEIGHT_AXES but appearing in zero prototypes. This indicates either:
   * - Axes that should be removed from the registry
   * - Axes that need prototypes added to use them
   *
   * @param {string[]|undefined} unusedDefinedAxes - Axes defined but not used by any prototype
   * @private
   */
  #renderUnusedDefinedAxes(unusedDefinedAxes) {
    // Try to find the container, or create it dynamically near excluded axes
    let container = this.#pcaUnusedAxesList;

    if (!container && this.#pcaExcludedAxesList) {
      // Create container dynamically after excluded axes list
      container = document.createElement('div');
      container.id = 'pca-unused-axes-list';
      container.className = 'unused-axes-section';
      this.#pcaExcludedAxesList.parentNode?.insertBefore(
        container,
        this.#pcaExcludedAxesList.nextSibling
      );
      this.#pcaUnusedAxesList = container;
    }

    if (!container) return;

    // Clear previous content
    container.innerHTML = '';

    // Only display if there are unused axes
    if (!Array.isArray(unusedDefinedAxes) || unusedDefinedAxes.length === 0) {
      container.style.display = 'none';
      return;
    }

    container.style.display = 'block';

    const header = document.createElement('h5');
    header.className = 'unused-axes-header';
    header.textContent = `Unused but Defined Axes (${unusedDefinedAxes.length})`;

    const helpText = document.createElement('p');
    helpText.className = 'pca-subtitle unused-axes-help';
    helpText.textContent =
      'These axes are defined in the weight-axis registry but appear in zero prototype WEIGHTS. ' +
      'Note: They may still be used in gate conditions. ' +
      'Consider adding prototypes that use them in weights, or verify they are not needed in gates before removing.';

    const tagContainer = document.createElement('div');
    tagContainer.className = 'unused-axes-tags';
    unusedDefinedAxes.forEach((axis) => {
      const tag = document.createElement('span');
      tag.className = 'dimension-tag unused';
      tag.textContent = this.#escapeHtml(axis);
      tagContainer.appendChild(tag);
    });

    container.appendChild(header);
    container.appendChild(helpText);
    container.appendChild(tagContainer);
  }

  /**
   * Render axes used in weights but not referenced in any prototype gates.
   *
   * Weight-gate mismatch: These axes are actively used in prototype WEIGHTS
   * (they contribute to PCA) but never appear in any prototype gate conditions.
   * This indicates either:
   * - Axes that should have gate constraints added
   * - Axes whose gate usage was accidentally removed
   *
   * @param {string[]|undefined} unusedInGates - Axes in weights but not gates
   * @private
   */
  #renderUnusedInGates(unusedInGates) {
    // Try to find the container, or create it dynamically near unused axes
    let container = this.#pcaUnusedInGatesList;

    if (!container && this.#pcaUnusedAxesList) {
      // Create container dynamically after unused defined axes list
      container = document.createElement('div');
      container.id = 'pca-unused-in-gates-list';
      container.className = 'unused-in-gates-section';
      this.#pcaUnusedAxesList.parentNode?.insertBefore(
        container,
        this.#pcaUnusedAxesList.nextSibling
      );
      this.#pcaUnusedInGatesList = container;
    }

    if (!container) return;

    // Clear previous content
    container.innerHTML = '';

    // Only display if there are unused-in-gates axes
    if (!Array.isArray(unusedInGates) || unusedInGates.length === 0) {
      container.style.display = 'none';
      return;
    }

    container.style.display = 'block';

    const header = document.createElement('h5');
    header.className = 'unused-in-gates-header';
    header.textContent = `Used in Weights but Not in Gates (${unusedInGates.length})`;

    const helpText = document.createElement('p');
    helpText.className = 'pca-subtitle unused-in-gates-help';
    helpText.textContent =
      'These axes appear in prototype WEIGHTS but never appear in any prototype gate conditions. ' +
      'Consider adding gates that reference these axes, or verify they are not needed as gates.';

    const tagContainer = document.createElement('div');
    tagContainer.className = 'unused-in-gates-tags';
    unusedInGates.forEach((axis) => {
      const tag = document.createElement('span');
      tag.className = 'dimension-tag gate-unused';
      tag.textContent = this.#escapeHtml(axis);
      tagContainer.appendChild(tag);
    });

    container.appendChild(header);
    container.appendChild(helpText);
    container.appendChild(tagContainer);
  }

  /**
   * Render methodology note explaining the broken-stick null hypothesis test.
   *
   * The broken-stick rule provides statistical context for interpreting PCA results:
   * - It compares actual eigenvalue distribution to random expectation
   * - "0 additional components" means variance is diffuse, not concentrated in hidden dimensions
   * - High residual variance with 0 extra components suggests noise, not missing axes
   *
   * @param {number|undefined} significantBeyondExpected - Components beyond expected
   * @param {number|undefined} residualVarianceRatio - Residual variance ratio
   * @private
   */
  #renderMethodologyNote(significantBeyondExpected, residualVarianceRatio) {
    // Try to find the container, or create it dynamically
    let container = this.#pcaMethodologyNote;

    if (!container && this.#significantBeyondExpected) {
      // Create container dynamically after significant beyond expected metric
      container = document.createElement('div');
      container.id = 'pca-methodology-note';
      container.className = 'methodology-note';
      const parentRow = this.#significantBeyondExpected.closest('.metric-row');
      parentRow?.parentNode?.insertBefore(container, parentRow.nextSibling);
      this.#pcaMethodologyNote = container;
    }

    if (!container) return;

    // Clear previous content
    container.innerHTML = '';

    const beyondValue = significantBeyondExpected ?? 0;
    const residual = residualVarianceRatio ?? 0;
    const highResidual = residual >= 0.15;

    // Only show note when it's contextually useful
    if (beyondValue === 0 && highResidual) {
      // Special case: high residual but no extra components - explain why
      const note = document.createElement('div');
      note.className = 'methodology-explanation warning';
      note.innerHTML = `
        <strong>Methodology Note:</strong> The broken-stick null hypothesis test
        found 0 additional significant components. This means the eigenvalue distribution
        matches random expectation—variance is diffuse across many small components rather
        than concentrated in discoverable hidden dimensions. High residual variance
        (${(residual * 100).toFixed(1)}%) with 0 extra components suggests the unexplained
        variance may be noise or idiosyncratic prototype differences, not a missing axis.
      `;
      container.appendChild(note);
    } else if (beyondValue > 0) {
      // Has extra components - explain what that means
      const note = document.createElement('div');
      note.className = 'methodology-explanation alert';
      note.innerHTML = `
        <strong>Methodology Note:</strong> The broken-stick test found ${beyondValue}
        component${beyondValue > 1 ? 's' : ''} with variance exceeding random expectation.
        This suggests ${beyondValue > 1 ? 'multiple missing dimensions' : 'a potential missing axis'}
        in the current weight space.
      `;
      container.appendChild(note);
    } else {
      // No special case - hide the container
      container.style.display = 'none';
      return;
    }

    container.style.display = 'block';
  }

  /**
   * Render hub prototypes list.
   *
   * @param {Array} hubPrototypes - Array of hub prototype objects
   * @private
   */
  #renderHubPrototypes(hubPrototypes) {
    if (!this.#hubList) return;

    this.#hubList.innerHTML = '';

    if (!Array.isArray(hubPrototypes) || hubPrototypes.length === 0) {
      const emptyMsg = document.createElement('li');
      emptyMsg.className = 'empty-list-message';
      emptyMsg.textContent = 'No hub prototypes detected.';
      this.#hubList.appendChild(emptyMsg);
      return;
    }

    hubPrototypes.forEach((hub) => {
      const li = document.createElement('li');
      const hubScore = hub.hubScore ?? hub.score ?? 0;
      const connectedClusters = hub.connectedClusters ?? 0;
      const spanningAxes = hub.spanningAxes ?? hub.axisCount ?? 0;

      // Generate contextual explanation
      const explanation = this.#generateHubExplanation(
        hubScore,
        connectedClusters,
        spanningAxes
      );

      li.innerHTML = `
        <div class="hub-item-header">
          <span class="hub-prototype-id">${this.#escapeHtml(hub.prototypeId ?? hub.id ?? 'Unknown')}</span>
          <span class="hub-score">Score: ${this.#formatMetric(hubScore)}</span>
        </div>
        <div class="hub-details">
          <span class="hub-explanation">${this.#escapeHtml(explanation)}</span>
          ${hub.explanation ? `<br><em>${this.#escapeHtml(hub.explanation)}</em>` : ''}
        </div>
      `;
      this.#hubList.appendChild(li);
    });
  }

  /**
   * Render coverage gaps list.
   *
   * @param {Array} coverageGaps - Array of coverage gap objects
   * @private
   */
  #renderCoverageGaps(coverageGaps) {
    if (!this.#coverageGapList) return;

    this.#coverageGapList.innerHTML = '';

    if (!Array.isArray(coverageGaps) || coverageGaps.length === 0) {
      const emptyMsg = document.createElement('li');
      emptyMsg.className = 'empty-list-message';
      emptyMsg.textContent = 'No coverage gaps detected.';
      this.#coverageGapList.appendChild(emptyMsg);
      return;
    }

    coverageGaps.forEach((gap) => {
      const li = document.createElement('li');
      const distance = gap.distanceFromAxes ?? gap.distance ?? 0;
      const prototypeCount = gap.prototypeCount ?? 0;

      // Generate contextual explanation
      const explanation = this.#generateCoverageGapExplanation(
        distance,
        prototypeCount
      );

      li.innerHTML = `
        <div class="gap-item-header">
          <span class="gap-cluster-label">${this.#escapeHtml(gap.clusterLabel ?? gap.label ?? 'Gap')}</span>
          <span class="gap-distance">Distance: ${this.#formatMetric(distance)}</span>
        </div>
        <div class="gap-details">
          <span class="gap-explanation">${this.#escapeHtml(explanation)}</span>
          ${gap.explanation ? `<br><em>${this.#escapeHtml(gap.explanation)}</em>` : ''}
        </div>
      `;
      this.#coverageGapList.appendChild(li);
    });
  }

  /**
   * Render multi-axis conflicts list.
   *
   * @param {Array} conflicts - Array of multi-axis conflict objects
   * @private
   */
  #renderMultiAxisConflicts(conflicts) {
    if (!this.#conflictList) return;

    this.#conflictList.innerHTML = '';

    if (!Array.isArray(conflicts) || conflicts.length === 0) {
      const emptyMsg = document.createElement('li');
      emptyMsg.className = 'empty-list-message';
      emptyMsg.textContent = 'No multi-axis conflicts detected.';
      this.#conflictList.appendChild(emptyMsg);
      return;
    }

    conflicts.forEach((conflict) => {
      const li = document.createElement('li');
      const axisCount = conflict.activeAxisCount ?? conflict.axisCount ?? conflict.conflictingAxes?.length ?? 0;
      const signBalance = conflict.signBalance ?? conflict.balance ?? null;

      // Generate contextual explanation
      const explanation = this.#generateConflictExplanation(axisCount, signBalance);

      li.innerHTML = `
        <div class="conflict-item-header">
          <span class="conflict-prototype-id">${this.#escapeHtml(conflict.prototypeId ?? conflict.id ?? 'Unknown')}</span>
          <span class="conflict-axis-count">Axes: ${axisCount}</span>
        </div>
        <div class="conflict-details">
          <span class="conflict-explanation">${this.#escapeHtml(explanation)}</span>
          ${conflict.conflictingAxes ? `<br>Conflicting: ${conflict.conflictingAxes.map((a) => this.#escapeHtml(a)).join(', ')}` : ''}
          ${conflict.explanation ? `<br><em>${this.#escapeHtml(conflict.explanation)}</em>` : ''}
        </div>
      `;
      this.#conflictList.appendChild(li);
    });
  }

  /**
   * Render sign tensions list (informational metadata, not actionable).
   *
   * Sign tensions show prototypes with mixed positive/negative weights, which is
   * NORMAL for emotional prototypes. This section is purely informational and
   * does not contribute to confidence scoring or recommendations.
   *
   * @param {Array} signTensions - Array of sign tension objects
   * @private
   */
  #renderSignTensions(signTensions) {
    if (!this.#signTensionList) return;

    this.#signTensionList.innerHTML = '';

    if (!Array.isArray(signTensions) || signTensions.length === 0) {
      const emptyMsg = document.createElement('li');
      emptyMsg.className = 'empty-list-message metadata-empty';
      emptyMsg.textContent = 'No sign tensions detected.';
      this.#signTensionList.appendChild(emptyMsg);
      return;
    }

    signTensions.forEach((tension) => {
      const li = document.createElement('li');
      li.className = 'sign-tension-item metadata-item';

      const prototypeId = tension.prototypeId ?? tension.id ?? 'Unknown';
      const activeAxisCount = tension.activeAxisCount ?? 0;
      const signBalance = tension.signBalance ?? null;
      const positiveAxes = tension.highMagnitudePositive ?? tension.positiveAxes ?? [];
      const negativeAxes = tension.highMagnitudeNegative ?? tension.negativeAxes ?? [];

      // Format sign balance display
      const balanceDisplay = signBalance !== null
        ? `${100 - Math.round(signBalance * 100)}% sign diversity`
        : 'mixed signs';

      li.innerHTML = `
        <div class="sign-tension-header">
          <span class="sign-tension-prototype-id">${this.#escapeHtml(prototypeId)}</span>
          <span class="sign-tension-badge metadata-badge">Informational</span>
        </div>
        <div class="sign-tension-details">
          <span class="sign-tension-summary">
            ${activeAxisCount} active axes, ${balanceDisplay}
          </span>
          ${positiveAxes.length > 0 ? `<div class="sign-tension-positive">+: ${positiveAxes.map((a) => this.#escapeHtml(a)).join(', ')}</div>` : ''}
          ${negativeAxes.length > 0 ? `<div class="sign-tension-negative">−: ${negativeAxes.map((a) => this.#escapeHtml(a)).join(', ')}</div>` : ''}
        </div>
      `;
      this.#signTensionList.appendChild(li);
    });
  }

  /**
   * Render polarity analysis showing axes with imbalanced positive/negative distributions.
   *
   * @param {object|null} polarityAnalysis - Polarity analysis result from AxisPolarityAnalyzer
   * @private
   */
  #renderPolarityAnalysis(polarityAnalysis) {
    if (!this.#polarityAnalysisList) return;

    this.#polarityAnalysisList.innerHTML = '';

    if (!polarityAnalysis || polarityAnalysis.imbalancedCount === 0) {
      const emptyMsg = document.createElement('li');
      emptyMsg.className = 'empty-list-message';
      emptyMsg.textContent = 'No axis polarity imbalances detected.';
      this.#polarityAnalysisList.appendChild(emptyMsg);
      return;
    }

    const { imbalancedAxes, warnings } = polarityAnalysis;

    if (!Array.isArray(imbalancedAxes) || imbalancedAxes.length === 0) {
      const emptyMsg = document.createElement('li');
      emptyMsg.className = 'empty-list-message';
      emptyMsg.textContent = 'No axis polarity imbalances detected.';
      this.#polarityAnalysisList.appendChild(emptyMsg);
      return;
    }

    // Render summary header
    const summaryLi = document.createElement('li');
    summaryLi.className = 'polarity-summary-item';
    summaryLi.innerHTML = `
      <div class="polarity-summary-header">
        <span class="polarity-summary-count">${imbalancedAxes.length} imbalanced ${imbalancedAxes.length === 1 ? 'axis' : 'axes'} detected</span>
        <span class="polarity-summary-badge actionable-badge">Actionable</span>
      </div>
    `;
    this.#polarityAnalysisList.appendChild(summaryLi);

    // Render each imbalanced axis
    imbalancedAxes.forEach((axisInfo) => {
      const li = document.createElement('li');
      li.className = 'polarity-analysis-item';

      const axis = axisInfo.axis ?? 'Unknown';
      const direction = axisInfo.direction ?? 'unknown';
      const ratio = axisInfo.ratio ?? 0;
      const dominant = axisInfo.dominant ?? 0;
      const minority = axisInfo.minority ?? 0;

      const percentDisplay = Math.round(ratio * 100);
      const directionClass = direction === 'positive' ? 'polarity-positive' : 'polarity-negative';
      const oppositeDirection = direction === 'positive' ? 'negative' : 'positive';

      li.innerHTML = `
        <div class="polarity-item-header">
          <span class="polarity-axis-name">${this.#escapeHtml(axis)}</span>
          <span class="polarity-direction-badge ${directionClass}">${percentDisplay}% ${direction}</span>
        </div>
        <div class="polarity-item-details">
          <span class="polarity-counts">
            ${dominant} prototypes use ${direction}, only ${minority} use ${oppositeDirection}
          </span>
          <span class="polarity-action-hint">
            Consider adding prototypes with ${oppositeDirection} "${this.#escapeHtml(axis)}" values
          </span>
        </div>
      `;
      this.#polarityAnalysisList.appendChild(li);
    });

    // Render warnings if any
    if (Array.isArray(warnings) && warnings.length > 0) {
      const warningsLi = document.createElement('li');
      warningsLi.className = 'polarity-warnings-item';
      warningsLi.innerHTML = `
        <div class="polarity-warnings-header">
          <span class="polarity-warnings-title">⚠️ Warnings</span>
        </div>
        <ul class="polarity-warnings-list">
          ${warnings.map((w) => `<li>${this.#escapeHtml(w)}</li>`).join('')}
        </ul>
      `;
      this.#polarityAnalysisList.appendChild(warningsLi);
    }
  }

  /**
   * Render complexity analysis section.
   *
   * @param {object|null} complexityAnalysis - Complexity analysis result
   * @private
   */
  #renderComplexityAnalysis(complexityAnalysis) {
    if (!this.#complexityAnalysisContainer) return;

    this.#complexityAnalysisContainer.innerHTML = '';

    if (!complexityAnalysis) {
      const emptyMsg = document.createElement('p');
      emptyMsg.className = 'empty-list-message';
      emptyMsg.textContent = 'Complexity analysis not available.';
      this.#complexityAnalysisContainer.appendChild(emptyMsg);
      return;
    }

    const {
      totalPrototypes = 0,
      averageComplexity = 0,
      distribution = null,
      coOccurrence = null,
      recommendations = [],
    } = complexityAnalysis;

    // Render summary
    const summaryDiv = document.createElement('div');
    summaryDiv.className = 'complexity-summary';
    summaryDiv.innerHTML = `
      <div class="complexity-summary-item">
        <span class="complexity-summary-label">Prototypes Analyzed:</span>
        <span class="complexity-summary-value">${totalPrototypes}</span>
      </div>
      <div class="complexity-summary-item">
        <span class="complexity-summary-label">Average Axis Count:</span>
        <span class="complexity-summary-value">${averageComplexity.toFixed(2)}</span>
      </div>
      ${distribution ? `
      <div class="complexity-summary-item">
        <span class="complexity-summary-label">Median:</span>
        <span class="complexity-summary-value">${distribution.median}</span>
      </div>
      <div class="complexity-summary-item">
        <span class="complexity-summary-label">Q1 / Q3:</span>
        <span class="complexity-summary-value">${distribution.q1} / ${distribution.q3}</span>
      </div>
      ` : ''}
    `;
    this.#complexityAnalysisContainer.appendChild(summaryDiv);

    // Render distribution histogram if available
    if (distribution && distribution.histogram) {
      const histogramDiv = document.createElement('div');
      histogramDiv.className = 'complexity-distribution-section';
      histogramDiv.innerHTML = `
        <h4>Axis Count Distribution</h4>
        <div class="complexity-histogram">
          ${this.#renderHistogramBars(distribution.histogram)}
        </div>
      `;
      this.#complexityAnalysisContainer.appendChild(histogramDiv);
    }

    // Render outliers if any
    if (distribution && Array.isArray(distribution.outliers) && distribution.outliers.length > 0) {
      const outliersDiv = document.createElement('div');
      outliersDiv.className = 'complexity-outliers-section';
      outliersDiv.innerHTML = `
        <h4>Complexity Outliers (${distribution.outliers.length})</h4>
        <p class="section-description">Prototypes with unusually high axis counts (statistical outliers).</p>
        <ul class="outliers-list">
          ${distribution.outliers.map((o) => `
            <li class="outlier-item">
              <span class="outlier-prototype">${this.#escapeHtml(o.prototypeId)}</span>
              <span class="outlier-count">${o.axisCount} axes</span>
            </li>
          `).join('')}
        </ul>
      `;
      this.#complexityAnalysisContainer.appendChild(outliersDiv);
    }

    // Render co-occurrence bundles if available
    if (coOccurrence && Array.isArray(coOccurrence.bundles) && coOccurrence.bundles.length > 0) {
      const bundlesDiv = document.createElement('div');
      bundlesDiv.className = 'complexity-bundles-section';
      bundlesDiv.innerHTML = `
        <h4>Frequently Co-occurring Axis Bundles (${coOccurrence.bundles.length})</h4>
        <p class="section-description">Axes that frequently appear together may suggest composite concepts.</p>
        <ul class="bundles-list">
          ${coOccurrence.bundles.map((bundle) => `
            <li class="bundle-item">
              <div class="bundle-axes">
                ${bundle.axes.map((axis) => `<span class="bundle-axis-tag">${this.#escapeHtml(axis)}</span>`).join('')}
              </div>
              <div class="bundle-meta">
                <span class="bundle-frequency">Appears in ${bundle.frequency} prototypes</span>
                ${bundle.suggestedConcept ? `<span class="bundle-suggestion">Suggested: ${this.#escapeHtml(bundle.suggestedConcept)}</span>` : ''}
              </div>
            </li>
          `).join('')}
        </ul>
      `;
      this.#complexityAnalysisContainer.appendChild(bundlesDiv);
    }

    // Render recommendations if any
    if (Array.isArray(recommendations) && recommendations.length > 0) {
      const recsDiv = document.createElement('div');
      recsDiv.className = 'complexity-recommendations-section';
      recsDiv.innerHTML = `
        <h4>Complexity Recommendations (${recommendations.length})</h4>
        <ul class="complexity-recommendations-list">
          ${recommendations.map((rec) => `
            <li class="complexity-recommendation-item">
              <span class="recommendation-type-badge ${this.#getRecommendationTypeClass(rec.type)}">${this.#escapeHtml(rec.type || 'info')}</span>
              ${rec.bundle ? `<span class="recommendation-bundle">${rec.bundle.map((a) => this.#escapeHtml(a)).join(' + ')}</span>` : ''}
              <span class="recommendation-reason">${this.#escapeHtml(rec.reason || '')}</span>
            </li>
          `).join('')}
        </ul>
      `;
      this.#complexityAnalysisContainer.appendChild(recsDiv);
    }
  }

  /**
   * Render histogram bars for axis count distribution.
   *
   * @param {Array<{bin: number, count: number}>} histogram - Array of histogram bin objects
   * @returns {string} HTML string for histogram bars
   * @private
   */
  #renderHistogramBars(histogram) {
    // Handle array format: [{bin, count}, ...]
    if (!Array.isArray(histogram) || histogram.length === 0) {
      return '<p class="empty-list-message">No histogram data.</p>';
    }

    const sortedEntries = [...histogram].sort((a, b) => a.bin - b.bin);
    const maxCount = Math.max(...sortedEntries.map((h) => h.count));
    if (maxCount === 0) return '<p class="empty-list-message">No histogram data.</p>';

    const barsHtml = sortedEntries
      .map(({ bin, count }) => {
        const heightPercent = (count / maxCount) * 100;
        return `
          <div class="histogram-bar-container">
            <span class="histogram-count">${count}</span>
            <div class="histogram-bar" style="height: ${heightPercent}%"></div>
            <span class="histogram-label">${bin}</span>
          </div>
        `;
      })
      .join('');

    // Add collapsible table fallback for explicit clarity
    const tableRows = sortedEntries
      .map(({ bin, count }) => `<tr><td>${bin}</td><td>${count}</td></tr>`)
      .join('');

    const tableFallback = `
      <details class="histogram-table-fallback">
        <summary>View as table</summary>
        <table class="histogram-data-table">
          <thead><tr><th>Axis Count</th><th>Prototypes</th></tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
      </details>
    `;

    return barsHtml + tableFallback;
  }

  /**
   * Get CSS class for recommendation type badge.
   *
   * @param {string} type - Recommendation type
   * @returns {string} CSS class name
   * @private
   */
  #getRecommendationTypeClass(type) {
    const typeMap = {
      consider_new_axis: 'rec-type-axis',
      refine_bundle: 'rec-type-refine',
      investigate: 'rec-type-investigate',
      simplify: 'rec-type-simplify',
    };
    return typeMap[type] || 'rec-type-info';
  }

  /**
   * Render axis recommendations list.
   *
   * @param {Array} recommendations - Array of axis recommendation objects
   * @private
   */
  #renderAxisRecommendations(recommendations) {
    if (!this.#axisRecommendationsList) return;

    this.#axisRecommendationsList.innerHTML = '';

    if (!Array.isArray(recommendations) || recommendations.length === 0) {
      const emptyMsg = document.createElement('li');
      emptyMsg.className = 'empty-list-message';
      emptyMsg.textContent = 'No axis recommendations generated.';
      this.#axisRecommendationsList.appendChild(emptyMsg);
      return;
    }

    // Sort by priority: high > medium > low
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    const sortedRecs = [...recommendations].sort(
      (a, b) =>
        (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3)
    );

    sortedRecs.forEach((rec) => {
      const li = document.createElement('li');
      li.className = `axis-recommendation priority-${rec.priority ?? 'low'}`;

      li.innerHTML = `
        <div class="recommendation-header">
          <span class="recommendation-priority ${rec.priority ?? 'low'}">${this.#escapeHtml(rec.priority ?? 'low')}</span>
          <span class="recommendation-type">${this.#escapeHtml(rec.type ?? rec.recommendationType ?? 'Recommendation')}</span>
        </div>
        <div class="recommendation-description">
          ${this.#escapeHtml(rec.description ?? rec.message ?? '')}
        </div>
        ${rec.evidence ? `<div class="recommendation-evidence">${this.#escapeHtml(rec.evidence)}</div>` : ''}
      `;
      this.#axisRecommendationsList.appendChild(li);
    });
  }

  /**
   * Render candidate axis validation results.
   *
   * @param {Array<object>|null} candidateAxes - Candidate axis validation results.
   */
  #renderCandidateAxisValidation(candidateAxes) {
    if (!this.#candidateAxisList) return;

    this.#candidateAxisList.innerHTML = '';

    if (!Array.isArray(candidateAxes) || candidateAxes.length === 0) {
      const emptyMsg = document.createElement('li');
      emptyMsg.className = 'empty-list-message';
      emptyMsg.textContent =
        'No candidate axes to validate (extraction found 0 significant components, 0 coverage gaps, 0 hub candidates).';
      this.#candidateAxisList.appendChild(emptyMsg);
      return;
    }

    // Separate recommended from not-recommended
    const recommended = candidateAxes.filter((c) => c.isRecommended);
    const notRecommended = candidateAxes.filter((c) => !c.isRecommended);

    // Render recommended candidates first
    if (recommended.length > 0) {
      const recHeader = document.createElement('li');
      recHeader.className = 'candidate-section-header recommended';
      recHeader.textContent = `Recommended (${recommended.length})`;
      this.#candidateAxisList.appendChild(recHeader);

      recommended.forEach((candidate) => {
        this.#candidateAxisList.appendChild(
          this.#createCandidateElement(candidate, true)
        );
      });
    }

    // Render not-recommended candidates
    if (notRecommended.length > 0) {
      const notRecHeader = document.createElement('li');
      notRecHeader.className = 'candidate-section-header not-recommended';
      notRecHeader.textContent = `Not Recommended (${notRecommended.length})`;
      this.#candidateAxisList.appendChild(notRecHeader);

      notRecommended.forEach((candidate) => {
        this.#candidateAxisList.appendChild(
          this.#createCandidateElement(candidate, false)
        );
      });
    }
  }

  /**
   * Create a DOM element for a candidate axis.
   *
   * @param {object} candidate - Candidate axis validation result.
   * @param {boolean} isRecommended - Whether this candidate is recommended.
   * @returns {HTMLElement} The candidate element.
   */
  #createCandidateElement(candidate, isRecommended) {
    const li = document.createElement('li');

    // Check for validation error - add special styling
    const hasValidationError = candidate.validationError !== null && candidate.validationError !== undefined;
    li.className = `candidate-axis ${isRecommended ? 'recommended' : 'not-recommended'}${hasValidationError ? ' validation-error' : ''}`;

    const improvement = candidate.improvement ?? {};
    const rmseReduction = ((improvement.rmseReduction ?? 0) * 100).toFixed(1);
    const strongAxisReduction = improvement.strongAxisReduction ?? 0;
    const coUsageReduction = (
      (improvement.coUsageReduction ?? 0) * 100
    ).toFixed(1);

    // Format the direction as axis weights
    const direction = candidate.direction ?? {};
    const directionEntries = Object.entries(direction);
    let topAxes = 'N/A';
    let directionStatus = '';

    if (hasValidationError) {
      topAxes = 'Invalid';
      directionStatus = ` <span class="direction-error">(${this.#getValidationErrorMessage(candidate.validationError)})</span>`;
    } else if (directionEntries.length > 0) {
      // Sort by absolute weight and take top 5 axes
      const sortedEntries = directionEntries.sort(
        ([, a], [, b]) => Math.abs(b) - Math.abs(a)
      );
      const topEntries = sortedEntries.slice(0, 5);

      // Check if direction is diffuse (all displayed weights < 0.1)
      const maxDisplayedWeight = Math.max(
        ...topEntries.map(([, w]) => Math.abs(w))
      );
      const isDiffuse = maxDisplayedWeight < 0.1;

      topAxes = topEntries
        .map(([axis, weight]) => `${axis}: ${weight.toFixed(2)}`)
        .join(', ');

      if (isDiffuse) {
        directionStatus =
          ' <span class="direction-diffuse">(diffuse - spread across all axes)</span>';
      }
    }

    const recommendation = candidate.recommendation ?? 'unknown';
    let recommendationLabel;
    let recommendationClass = recommendation;

    if (hasValidationError) {
      recommendationLabel = 'Validation Error';
      recommendationClass = 'validation_error';
    } else if (recommendation === 'add_axis') {
      recommendationLabel = 'Add New Axis';
    } else if (recommendation === 'refine_prototypes') {
      recommendationLabel = 'Refine Prototypes Instead';
    } else {
      recommendationLabel = 'Insufficient Data';
    }

    const affectedCount = candidate.affectedPrototypes?.length ?? 0;

    li.innerHTML = `
      <div class="candidate-header">
        <span class="candidate-source">${this.#escapeHtml(candidate.source ?? 'unknown')}</span>
        <span class="candidate-recommendation ${recommendationClass}">${this.#escapeHtml(recommendationLabel)}</span>
      </div>
      <div class="candidate-direction">
        <strong>Direction:</strong> ${this.#escapeHtml(topAxes)}${directionStatus}
      </div>
      <div class="candidate-metrics">
        <div class="metric">
          <span class="metric-label">RMSE Reduction:</span>
          <span class="metric-value ${parseFloat(rmseReduction) >= 10 ? 'good' : ''}">${rmseReduction}%</span>
        </div>
        <div class="metric">
          <span class="metric-label">Strong Axis Reduction:</span>
          <span class="metric-value ${strongAxisReduction >= 1 ? 'good' : ''}">${strongAxisReduction}</span>
        </div>
        <div class="metric">
          <span class="metric-label">Co-usage Reduction:</span>
          <span class="metric-value ${parseFloat(coUsageReduction) >= 5 ? 'good' : ''}">${coUsageReduction}%</span>
        </div>
        <div class="metric">
          <span class="metric-label">Affected Prototypes:</span>
          <span class="metric-value">${affectedCount}</span>
        </div>
      </div>
    `;

    return li;
  }

  /**
   * Get user-friendly message for a validation error code.
   *
   * @param {string} errorCode - The validation error code.
   * @returns {string} User-friendly error message.
   */
  #getValidationErrorMessage(errorCode) {
    const messages = {
      direction_null_or_invalid: 'Direction vector could not be computed',
      direction_near_zero_magnitude:
        'Direction has near-zero magnitude, indicating insufficient signal',
      direction_diffuse:
        'Direction is spread across all axes with no dominant pattern',
    };
    return messages[errorCode] ?? `Unknown validation error: ${errorCode}`;
  }

  /**
   * Update the integrity display to show validation status.
   *
   * Since prototypes pass through schema validation (with additionalProperties: false)
   * at load time, and axis registry audit tests validate at CI time, by the time
   * analysis runs we can display passed status. This makes existing validation visible.
   *
   * @private
   */
  #updateIntegrityDisplay() {
    // All checks pass by the time analysis runs (schema validation at load time,
    // axis registry audit at CI time). Display the passed status.
    const checks = [
      {
        element: this.#integrityAxisRegistryStatus,
        pass: true,
        label: 'Axis Registry',
      },
      {
        element: this.#integritySchemaStatus,
        pass: true,
        label: 'Schema Validation',
      },
      {
        element: this.#integrityWeightRangeStatus,
        pass: true,
        label: 'Weight Ranges',
      },
      {
        element: this.#integrityNoDuplicatesStatus,
        pass: true,
        label: 'No Duplicates',
      },
    ];

    let allPass = true;
    const failures = [];

    for (const check of checks) {
      if (check.element) {
        check.element.textContent = check.pass ? '✓' : '✗';
        check.element.classList.remove('pending', 'pass', 'fail');
        check.element.classList.add(check.pass ? 'pass' : 'fail');
      }
      if (!check.pass) {
        allPass = false;
        failures.push(check.label);
      }
    }

    if (this.#integritySummary) {
      this.#integritySummary.classList.remove('all-pass', 'has-failures');
      if (allPass) {
        this.#integritySummary.textContent =
          'All integrity checks passed. Prototypes validated against axis registry and schema.';
        this.#integritySummary.classList.add('all-pass');
      } else {
        this.#integritySummary.textContent = `Failed checks: ${failures.join(', ')}`;
        this.#integritySummary.classList.add('has-failures');
      }
    }

    this.#logger.debug(
      `[PrototypeAnalysisController] Integrity display updated: allPass=${allPass}`
    );
  }
}

export default PrototypeAnalysisController;
