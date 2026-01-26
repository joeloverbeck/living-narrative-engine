/**
 * @file Prototype Analysis Controller - UI controller for prototype overlap analysis page.
 *
 * Handles user interactions, progress reporting, and result rendering for the
 * prototype overlap analysis feature.
 * @see PrototypeOverlapAnalyzer
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import PCAResultsRenderer from './renderers/PCAResultsRenderer.js';
import AxisGapRenderer from './renderers/AxisGapRenderer.js';
import DecisionSummaryRenderer from './renderers/DecisionSummaryRenderer.js';
import ProgressTrackingService from './services/ProgressTrackingService.js';
import MetadataRenderer from './renderers/MetadataRenderer.js';
import ComplexityRenderer from './renderers/ComplexityRenderer.js';
import WeightCardsRenderer from './renderers/WeightCardsRenderer.js';
import IntegrityRenderer from './renderers/IntegrityRenderer.js';

/**
 * Controller for the Prototype Analysis page.
 *
 * Orchestrates the UI for running prototype overlap analysis, displaying
 * progress, and rendering recommendations.
 */
class PrototypeAnalysisController {
  #logger;
  #prototypeOverlapAnalyzer;
  #pcaResultsRenderer;
  #axisGapRenderer;
  #decisionSummaryRenderer;
  #progressTrackingService;
  #metadataRenderer;
  #complexityRenderer;
  #weightCardsRenderer;
  #integrityRenderer;

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
    this.#pcaResultsRenderer = new PCAResultsRenderer({ logger });
    this.#axisGapRenderer = new AxisGapRenderer({ logger });
    this.#decisionSummaryRenderer = new DecisionSummaryRenderer({ logger });
    this.#progressTrackingService = new ProgressTrackingService({ logger });
    this.#metadataRenderer = new MetadataRenderer({ logger });
    this.#complexityRenderer = new ComplexityRenderer({ logger });
    this.#weightCardsRenderer = new WeightCardsRenderer({ logger });
    this.#integrityRenderer = new IntegrityRenderer({ logger });
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

  /**
   * Get progress elements for the tracking service.
   *
   * @returns {import('./services/ProgressTrackingService.js').ProgressElements} Progress DOM elements
   * @private
   */
  #getProgressElements() {
    return {
      progressPanel: this.#progressPanel,
      progressBar: this.#progressBar,
      progressStatus: this.#progressStatus,
      runAnalysisBtn: this.#runAnalysisBtn,
    };
  }

  /**
   * Get metadata-related DOM elements for the MetadataRenderer.
   *
   * @returns {import('./renderers/MetadataRenderer.js').MetadataElements} Metadata DOM elements
   * @private
   */
  #getMetadataElements() {
    return {
      resultsMetadata: this.#resultsMetadata,
      recommendationsContainer: this.#recommendationsContainer,
    };
  }

  /**
   * Get complexity-related DOM elements for the ComplexityRenderer.
   *
   * @returns {import('./renderers/ComplexityRenderer.js').ComplexityElements} Complexity DOM elements
   * @private
   */
  #getComplexityElements() {
    return {
      complexityAnalysisContainer: this.#complexityAnalysisContainer,
    };
  }

  /**
   * Get weight cards DOM elements for the WeightCardsRenderer.
   *
   * @returns {import('./renderers/WeightCardsRenderer.js').WeightCardsElements} Weight cards DOM elements
   * @private
   */
  #getWeightCardsElements() {
    return {
      prototypeCardsContainer: this.#prototypeCardsContainer,
    };
  }

  /**
   * Get integrity DOM elements for the IntegrityRenderer.
   *
   * @returns {import('./renderers/IntegrityRenderer.js').IntegrityElements} Integrity DOM elements
   * @private
   */
  #getIntegrityElements() {
    return {
      axisRegistryStatus: this.#integrityAxisRegistryStatus,
      schemaStatus: this.#integritySchemaStatus,
      weightRangeStatus: this.#integrityWeightRangeStatus,
      noDuplicatesStatus: this.#integrityNoDuplicatesStatus,
      summary: this.#integritySummary,
    };
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

    const progressElements = this.#getProgressElements();
    this.#progressTrackingService.showPanel(progressElements);
    this.#hideResults();

    const prototypeFamily = this.#prototypeFamilySelect?.value ?? 'emotion';

    this.#logger.info(
      `[PrototypeAnalysisController] Starting analysis: family=${prototypeFamily}`
    );

    try {
      const result = await this.#prototypeOverlapAnalyzer.analyze({
        prototypeFamily,
        onProgress: (stage, progressData) => {
          this.#progressTrackingService.handleProgress(stage, progressData, progressElements);
        },
      });

      this.#progressTrackingService.markComplete(progressElements);
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
      this.#progressTrackingService.hidePanel(progressElements);
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
    const metadataElements = this.#getMetadataElements();

    // Show results panel
    if (this.#resultsPanel) {
      this.#resultsPanel.hidden = false;
    }

    // Render metadata summary (delegated to MetadataRenderer)
    this.#metadataRenderer.renderMetadata(metadata, metadataElements);

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

      // Render redundant pair recommendations first (delegated to MetadataRenderer)
      if (hasRecommendations) {
        recommendations.forEach((rec, index) => {
          this.#metadataRenderer.renderRecommendationCard(rec, index, metadataElements);
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

    // Build elements object for axis gap renderer
    const axisGapElements = {
      axisGapTotalPrototypes: this.#axisGapTotalPrototypes,
      axisGapRecommendations: this.#axisGapRecommendations,
      axisGapConfidence: this.#axisGapConfidence,
      signalPca: this.#signalPca,
      signalHubs: this.#signalHubs,
      signalCoverageGaps: this.#signalCoverageGaps,
      signalMultiAxisConflicts: this.#signalMultiAxisConflicts,
      signalPcaStatus: this.#signalPcaStatus,
      signalHubsStatus: this.#signalHubsStatus,
      signalCoverageGapsStatus: this.#signalCoverageGapsStatus,
      signalMultiAxisConflictsStatus: this.#signalMultiAxisConflictsStatus,
      signalPcaThreshold: this.#signalPcaThreshold,
      signalCoverageGapsThreshold: this.#signalCoverageGapsThreshold,
      hubList: this.#hubList,
      coverageGapList: this.#coverageGapList,
      conflictList: this.#conflictList,
      signTensionList: this.#signTensionList,
      polarityAnalysisList: this.#polarityAnalysisList,
    };

    // Update integrity display to show validation passed (delegated to IntegrityRenderer)
    const integrityElements = this.#getIntegrityElements();
    this.#integrityRenderer.updateIntegrityDisplay(integrityElements);

    // Render summary statistics (delegated to AxisGapRenderer)
    this.#axisGapRenderer.renderSummary(axisGapAnalysis.summary, axisGapElements);

    // Update PCA threshold display to show OR logic (delegated)
    this.#axisGapRenderer.updatePcaThresholdDisplay(axisGapAnalysis.pcaAnalysis, axisGapElements);

    // Update coverage gap threshold display (delegated)
    this.#axisGapRenderer.updateCoverageGapThresholdDisplay(axisGapElements);

    // Render decision summary panel (YES/MAYBE/NO verdict) - delegated to DecisionSummaryRenderer
    const decisionElements = {
      decisionVerdict: this.#decisionVerdict,
      decisionRationale: this.#decisionRationale,
      varianceTop4: this.#varianceTop4,
      varianceAxisCount: this.#varianceAxisCount,
      varianceTopK: this.#varianceTopK,
    };
    this.#decisionSummaryRenderer.render(axisGapAnalysis, decisionElements);

    // Render PCA analysis
    this.#renderPCASummary(axisGapAnalysis.pcaAnalysis);

    // Render hub prototypes (delegated to AxisGapRenderer)
    this.#axisGapRenderer.renderHubPrototypes(axisGapAnalysis.hubPrototypes, axisGapElements);

    // Render coverage gaps (delegated to AxisGapRenderer)
    this.#axisGapRenderer.renderCoverageGaps(axisGapAnalysis.coverageGaps, axisGapElements);

    // Render multi-axis conflicts (delegated to AxisGapRenderer)
    this.#axisGapRenderer.renderMultiAxisConflicts(axisGapAnalysis.multiAxisConflicts, axisGapElements);

    // Render sign tensions (delegated to AxisGapRenderer)
    this.#axisGapRenderer.renderSignTensions(axisGapAnalysis.signTensions, axisGapElements);

    // Render polarity analysis (delegated to AxisGapRenderer)
    this.#axisGapRenderer.renderPolarityAnalysis(axisGapAnalysis.polarityAnalysis, axisGapElements);

    // Render complexity analysis (delegated to ComplexityRenderer)
    const complexityElements = this.#getComplexityElements();
    this.#complexityRenderer.renderComplexityAnalysis(axisGapAnalysis.complexityAnalysis, complexityElements);

    // Render axis recommendations
    this.#renderAxisRecommendations(axisGapAnalysis.recommendations);

    // Render candidate axis validation results
    this.#renderCandidateAxisValidation(axisGapAnalysis.candidateAxes);

    // Render prototype weight cards (delegated to WeightCardsRenderer)
    const weightCardsElements = this.#getWeightCardsElements();
    this.#weightCardsRenderer.renderPrototypeWeightCards(axisGapAnalysis.prototypeWeightSummaries, weightCardsElements);
  }

  /**
   * Render axis gap summary statistics.
   *
   * @param {object} summary - Summary statistics
   * @private
   */
  

  /**
   * Render signal breakdown statistics.
   *
   * @param {object|undefined} signalBreakdown - Signal breakdown data
   * @private
   */
  

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
  

  /**
   * Render PCA analysis summary.
   *
   * @param {object} pcaAnalysis - PCA analysis results
   * @private
   */
  #renderPCASummary(pcaAnalysis) {
    // Delegate to specialized renderer with current DOM elements
    this.#pcaResultsRenderer.render(pcaAnalysis, {
      residualVariance: this.#residualVariance,
      significantComponentCount: this.#significantComponentCount,
      expectedComponentCount: this.#expectedComponentCount,
      significantBeyondExpected: this.#significantBeyondExpected,
      pcaDimensionsList: this.#pcaDimensionsList,
      pcaDimensionsUsed: this.#pcaDimensionsUsed,
      pcaExcludedAxesList: this.#pcaExcludedAxesList,
      pcaUnusedAxesList: this.#pcaUnusedAxesList,
      pcaUnusedInGatesList: this.#pcaUnusedInGatesList,
      pcaMethodologyNote: this.#pcaMethodologyNote,
      componentsFor80: this.#componentsFor80,
      componentsFor90: this.#componentsFor90,
      poorlyFittingList: this.#poorlyFittingList,
      pcaTopLoading: this.#pcaTopLoading,
    });
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
}

export default PrototypeAnalysisController;
