/**
 * @file Expression Diagnostics Controller - UI controller for expression diagnostics page.
 *
 * @see statusTheme.js - Single source of truth for status colors and CSS class generation
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import DiagnosticResult from '../../expressionDiagnostics/models/DiagnosticResult.js';
import { advancedMetricsConfig } from '../../expressionDiagnostics/config/advancedMetricsConfig.js';
import {
  getStatusCircleCssClass,
  getStatusThemeEntry,
} from '../../expressionDiagnostics/statusTheme.js';
import { copyToClipboard } from '../helpers/clipboardUtils.js';
import StatusSelectDropdown from './components/StatusSelectDropdown.js';
import ReportOrchestrator from '../../expressionDiagnostics/services/ReportOrchestrator.js';
import { buildSamplingCoverageConclusions } from '../../expressionDiagnostics/services/samplingCoverageConclusions.js';
import GateConstraint from '../../expressionDiagnostics/models/GateConstraint.js';
import {
  evaluateConstraint,
  extractMoodConstraints,
  filterContextsByConstraints,
  hasOrMoodConstraints,
} from '../../expressionDiagnostics/utils/moodRegimeUtils.js';
import {
  normalizeAffectTraits,
  normalizeMoodAxes,
  normalizeSexualAxes,
  resolveAxisValue,
} from '../../expressionDiagnostics/utils/axisNormalizationUtils.js';
import { evaluateSweepMonotonicity } from '../../expressionDiagnostics/utils/sweepIntegrityUtils.js';
import { resolveReportWorkerUrl } from './reportWorkerUrl.js';
import RecommendationFactsBuilder from '../../expressionDiagnostics/services/RecommendationFactsBuilder.js';
import RecommendationEngine from '../../expressionDiagnostics/services/RecommendationEngine.js';

const LOW_CONFIDENCE_SAMPLE_THRESHOLD = 200;

class ExpressionDiagnosticsController {
  #logger;
  #expressionRegistry;
  #gateAnalyzer;
  #boundsCalculator;
  #monteCarloSimulator;
  #failureExplainer;
  #expressionStatusService;
  #pathSensitiveAnalyzer;
  #reportGenerator;
  #reportModal;
  #reportOrchestrator;
  #prototypeFitRankingService;
  #prototypeConstraintAnalyzer;
  #sensitivityAnalyzer;
  #dataRegistry;
  #reportWorker = null;
  #reportWorkerTaskId = 0;
  #reportGenerationInProgress = false;

  #selectedExpression = null;
  #currentResult = null;
  #currentBlockers = [];
  #expressionStatuses = [];
  #currentPathSensitiveResult = null;
  #rawSimulationResult = null; // Raw result with storedContexts for sensitivity analysis

  // DOM elements
  #expressionSelectContainer;
  #statusSelectDropdown = null;
  #expressionDescription;
  #runStaticBtn;
  #statusIndicator;
  #statusMessage;
  #staticResults;
  #gateConflictsSection;
  #gateConflictsTable;
  #thresholdsSection;
  #thresholdsTable;
  // Monte Carlo DOM elements
  #sampleCountSelect;
  #distributionSelect;
  #runMcBtn;
  #mcResults;
  #mcRarityIndicator;
  #mcTriggerRate;
  #mcConfidenceInterval;
  #mcSummary;
  #mcPopulationSummaryContainer;
  #mcPopulationSampleCount;
  #mcPopulationInRegimeSampleCount;
  #mcPopulationStoredCount;
  #mcPopulationStoredInRegimeCount;
  #mcPopulationStoredLimit;
  #mcSamplingCoverageContainer;
  #mcSamplingCoverageSummary;
  #mcSamplingCoverageTables;
  #mcSamplingCoverageConclusionsContainer;
  #mcSamplingCoverageConclusionsList;
  #mcIntegrityWarningsContainer;
  #mcIntegrityWarningsSummary;
  #mcIntegrityWarningsList;
  #mcIntegrityWarningsImpact;
  #mcIntegrityDrilldownContainer;
  #mcIntegrityDrilldownSummary;
  #mcIntegrityDrilldownContent;
  #mcGateMetricsFlag;
  #mcRecommendationsContainer;
  #mcRecommendationsWarning;
  #mcRecommendationsWarningText;
  #mcRecommendationsList;
  #globalSensitivityMetricsFlag;
  #samplingCoverageMetricsFlag;
  #staticCrossReferenceMetricsFlag;
  #prototypeFitMetricsFlag;
  #blockersTbody;
  #generateReportBtn;
  // Problematic Expressions DOM elements
  #problematicPillsContainer;
  // Low Trigger Rate Expressions DOM elements
  #lowTriggerRatePillsContainer;
  #problematicErrorBanner;
  #problematicErrorTitle;
  #problematicErrorMessage;
  #problematicErrorGuidance;
  // MC Witnesses DOM elements (ground-truth witnesses from Monte Carlo)
  #mcWitnessesContainer;
  #mcWitnessesList;
  // Global Sensitivity DOM elements
  #globalSensitivityContainer;
  #globalSensitivityTables;
  // Static Cross-Reference DOM elements
  #staticCrossReferenceContainer;
  #staticCrossReferenceContent;
  #crossReferenceSummary;
  // Conditional Pass Rates DOM elements
  #conditionalPassRatesContainer;
  #conditionalPassRatesContent;
  #conditionalPassRatesWarning;
  #conditionalGateWarning;
  #conditionalPassMetricsFlag;
  #storedContextPopulationLabels = [];
  #latestIntegrityWarnings = [];
  // Last-Mile Decomposition DOM elements
  #lastMileDecompositionContainer;
  #lastMileDecompositionContent;
  #lastMileMetricsFlag;
  // Prototype Fit Analysis DOM elements
  #prototypeFitAnalysisContainer;
  #prototypeFitTbody;
  #prototypeFitDetails;
  #prototypeFitSuggestion;
  #prototypeFitWarning;
  // Implied Prototype DOM elements
  #impliedPrototypeContainer;
  #targetSignatureTbody;
  #similarityRankingTbody;
  #gatePassRankingTbody;
  #combinedRankingTbody;
  #impliedPrototypeWarning;
  #impliedPrototypeMetricsFlag;
  // Gap Detection DOM elements
  #gapDetectionContainer;
  #gapStatus;
  #nearestPrototypesTbody;
  #suggestedPrototypeSection;
  #suggestedPrototypeContent;
  #gapDetectionMetricsFlag;
  // Path-Sensitive Analysis DOM elements
  #pathSensitiveSection;
  #pathSensitiveSummary;
  #psStatusIndicator;
  #psSummaryMessage;
  #branchCount;
  #reachableCount;
  #branchCardsContainer;
  #knifeEdgeSummary;
  #keCount;
  #knifeEdgeTbody;
  // Branch filter toggle
  #showAllBranchesCheckbox;
  #showAllBranches = false;

  constructor({
    logger,
    expressionRegistry,
    gateAnalyzer,
    boundsCalculator,
    monteCarloSimulator,
    failureExplainer,
    expressionStatusService,
    pathSensitiveAnalyzer,
    reportGenerator,
    reportModal,
    prototypeFitRankingService = null,
    prototypeConstraintAnalyzer = null,
    sensitivityAnalyzer,
    dataRegistry,
  }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'info', 'warn', 'error'],
    });
    validateDependency(expressionRegistry, 'IExpressionRegistry', logger, {
      requiredMethods: ['getAllExpressions', 'getExpression'],
    });
    validateDependency(gateAnalyzer, 'IGateConstraintAnalyzer', logger, {
      requiredMethods: ['analyze'],
    });
    validateDependency(boundsCalculator, 'IIntensityBoundsCalculator', logger, {
      requiredMethods: ['analyzeExpression'],
    });
    validateDependency(monteCarloSimulator, 'IMonteCarloSimulator', logger, {
      requiredMethods: ['simulate'],
    });
    validateDependency(failureExplainer, 'IFailureExplainer', logger, {
      requiredMethods: ['analyzeHierarchicalBlockers', 'generateSummary'],
    });
    validateDependency(expressionStatusService, 'IExpressionStatusService', logger, {
      requiredMethods: ['scanAllStatuses', 'updateStatus', 'getProblematicExpressions'],
    });
    validateDependency(pathSensitiveAnalyzer, 'IPathSensitiveAnalyzer', logger, {
      requiredMethods: ['analyze'],
    });
    validateDependency(reportGenerator, 'IMonteCarloReportGenerator', logger, {
      requiredMethods: ['generate'],
    });
    validateDependency(reportModal, 'IMonteCarloReportModal', logger, {
      requiredMethods: ['showReport'],
    });
    validateDependency(sensitivityAnalyzer, 'ISensitivityAnalyzer', logger, {
      requiredMethods: ['computeSensitivityData', 'computeGlobalSensitivityData'],
    });
    validateDependency(dataRegistry, 'IDataRegistry', logger, {
      requiredMethods: ['getLookupData'],
    });
    if (prototypeConstraintAnalyzer) {
      validateDependency(
        prototypeConstraintAnalyzer,
        'IPrototypeConstraintAnalyzer',
        logger,
        {
          requiredMethods: ['analyzeEmotionThreshold', 'extractAxisConstraints'],
        }
      );
    }

    this.#logger = logger;
    this.#expressionRegistry = expressionRegistry;
    this.#gateAnalyzer = gateAnalyzer;
    this.#boundsCalculator = boundsCalculator;
    this.#monteCarloSimulator = monteCarloSimulator;
    this.#failureExplainer = failureExplainer;
    this.#expressionStatusService = expressionStatusService;
    this.#pathSensitiveAnalyzer = pathSensitiveAnalyzer;
    this.#reportGenerator = reportGenerator;
    this.#reportModal = reportModal;
    this.#prototypeFitRankingService = prototypeFitRankingService;
    this.#prototypeConstraintAnalyzer = prototypeConstraintAnalyzer;
    this.#sensitivityAnalyzer = sensitivityAnalyzer;
    this.#dataRegistry = dataRegistry;
    this.#reportOrchestrator = new ReportOrchestrator({
      logger,
      sensitivityAnalyzer,
      monteCarloReportGenerator: reportGenerator,
    });
  }

  async initialize() {
    this.#bindDomElements();
    this.#setupEventListeners();
    await this.#populateExpressionSelect();
    await this.#loadProblematicExpressionsPanel();
  }

  #bindDomElements() {
    this.#expressionSelectContainer = document.getElementById(
      'expression-select-container'
    );
    this.#expressionDescription = document.getElementById(
      'expression-description'
    );
    this.#runStaticBtn = document.getElementById('run-static-btn');
    this.#statusIndicator = document.getElementById('status-indicator');
    this.#statusMessage = document.getElementById('status-message');
    this.#staticResults = document.getElementById('static-results');
    this.#gateConflictsSection = document.getElementById(
      'gate-conflicts-section'
    );
    this.#gateConflictsTable = document.getElementById('gate-conflicts-table');
    this.#thresholdsSection = document.getElementById('thresholds-section');
    this.#thresholdsTable = document.getElementById('thresholds-table');
    // Monte Carlo elements
    this.#sampleCountSelect = document.getElementById('sample-count');
    this.#distributionSelect = document.getElementById('distribution');
    this.#runMcBtn = document.getElementById('run-mc-btn');
    this.#mcResults = document.getElementById('mc-results');
    this.#mcRarityIndicator = document.getElementById('mc-rarity-indicator');
    this.#mcTriggerRate = document.getElementById('mc-trigger-rate');
    this.#mcConfidenceInterval = document.getElementById(
      'mc-confidence-interval'
    );
    this.#mcSummary = document.getElementById('mc-summary');
    this.#mcPopulationSummaryContainer = document.getElementById(
      'mc-population-summary'
    );
    this.#mcPopulationSampleCount = document.getElementById(
      'mc-population-sample-count'
    );
    this.#mcPopulationInRegimeSampleCount = document.getElementById(
      'mc-population-in-regime-sample-count'
    );
    this.#mcPopulationStoredCount = document.getElementById(
      'mc-population-stored-count'
    );
    this.#mcPopulationStoredInRegimeCount = document.getElementById(
      'mc-population-stored-in-regime-count'
    );
    this.#mcPopulationStoredLimit = document.getElementById(
      'mc-population-stored-limit'
    );
    this.#mcSamplingCoverageContainer = document.getElementById(
      'mc-sampling-coverage'
    );
    this.#mcSamplingCoverageSummary =
      this.#mcSamplingCoverageContainer?.querySelector(
        '.sampling-coverage-summary'
      ) ?? null;
    this.#mcSamplingCoverageTables =
      this.#mcSamplingCoverageContainer?.querySelector(
        '.sampling-coverage-tables'
      ) ?? null;
    this.#mcSamplingCoverageConclusionsContainer =
      this.#mcSamplingCoverageContainer?.querySelector(
        '.sampling-coverage-conclusions'
      ) ?? null;
    this.#mcSamplingCoverageConclusionsList =
      this.#mcSamplingCoverageContainer?.querySelector(
        '.sampling-coverage-conclusions-list'
      ) ?? null;
    this.#mcIntegrityWarningsContainer = document.getElementById(
      'mc-integrity-warnings'
    );
    this.#mcIntegrityWarningsSummary = document.getElementById(
      'mc-integrity-warnings-summary'
    );
    this.#mcIntegrityWarningsList = document.getElementById(
      'mc-integrity-warnings-list'
    );
    this.#mcIntegrityWarningsImpact = document.getElementById(
      'mc-integrity-warnings-impact'
    );
    this.#mcIntegrityDrilldownContainer = document.getElementById(
      'mc-integrity-drilldown'
    );
    this.#mcIntegrityDrilldownSummary = document.getElementById(
      'mc-integrity-drilldown-summary'
    );
    this.#mcIntegrityDrilldownContent = document.getElementById(
      'mc-integrity-drilldown-content'
    );
    this.#mcGateMetricsFlag = document.getElementById('mc-gate-metrics-flag');
    this.#mcRecommendationsContainer = document.getElementById(
      'mc-recommendations'
    );
    this.#mcRecommendationsWarning = document.getElementById(
      'mc-recommendations-warning'
    );
    this.#mcRecommendationsWarningText =
      this.#mcRecommendationsWarning?.querySelector('.warning-text') ?? null;
    this.#mcRecommendationsList = document.getElementById(
      'mc-recommendations-list'
    );
    this.#globalSensitivityMetricsFlag = document.getElementById(
      'global-sensitivity-metrics-flag'
    );
    this.#samplingCoverageMetricsFlag = document.getElementById(
      'sampling-coverage-metrics-flag'
    );
    this.#staticCrossReferenceMetricsFlag = document.getElementById(
      'static-cross-reference-metrics-flag'
    );
    this.#prototypeFitMetricsFlag = document.getElementById(
      'prototype-fit-metrics-flag'
    );
    this.#blockersTbody = document.getElementById('blockers-tbody');
    this.#generateReportBtn = document.getElementById('generate-report-btn');
    // Problematic Expressions elements
    this.#problematicPillsContainer = document.getElementById(
      'problematic-pills-container'
    );
    // Low Trigger Rate Expressions elements
    this.#lowTriggerRatePillsContainer = document.getElementById(
      'low-trigger-rate-pills-container'
    );
    // MC Witnesses elements (ground-truth witnesses from Monte Carlo)
    this.#mcWitnessesContainer = document.getElementById('mc-witnesses');
    this.#mcWitnessesList = document.getElementById('mc-witnesses-list');
    // Global Sensitivity elements
    this.#globalSensitivityContainer = document.getElementById('global-sensitivity');
    this.#globalSensitivityTables = document.getElementById('global-sensitivity-tables');
    // Static Cross-Reference elements
    this.#staticCrossReferenceContainer = document.getElementById('static-cross-reference');
    this.#staticCrossReferenceContent = document.getElementById('static-cross-reference-content');
    this.#crossReferenceSummary = document.getElementById('cross-reference-summary');
    // Conditional Pass Rates elements
    this.#conditionalPassRatesContainer = document.getElementById('conditional-pass-rates');
    this.#conditionalPassRatesContent = document.getElementById('conditional-pass-rates-content');
    this.#conditionalPassRatesWarning = document.getElementById('conditional-pass-warning');
    this.#conditionalGateWarning = document.getElementById('conditional-gate-warning');
    this.#conditionalPassMetricsFlag = document.getElementById(
      'conditional-pass-metrics-flag'
    );
    this.#storedContextPopulationLabels = Array.from(
      document.querySelectorAll('[data-population-role="stored-contexts"]')
    );
    // Last-Mile Decomposition elements
    this.#lastMileDecompositionContainer = document.getElementById('last-mile-decomposition');
    this.#lastMileDecompositionContent = document.getElementById('last-mile-decomposition-content');
    this.#lastMileMetricsFlag = document.getElementById('last-mile-metrics-flag');
    // Prototype Fit Analysis elements
    this.#prototypeFitAnalysisContainer = document.getElementById('prototype-fit-analysis');
    this.#prototypeFitTbody = document.getElementById('prototype-fit-tbody');
    this.#prototypeFitDetails = document.getElementById('prototype-fit-details');
    this.#prototypeFitSuggestion = document.getElementById('prototype-fit-suggestion');
    this.#prototypeFitWarning = document.getElementById('prototype-fit-warning');
    this.#prototypeFitMetricsFlag = document.getElementById(
      'prototype-fit-metrics-flag'
    );
    // Implied Prototype elements
    this.#impliedPrototypeContainer = document.getElementById('implied-prototype');
    this.#targetSignatureTbody = document.getElementById('target-signature-tbody');
    this.#similarityRankingTbody = document.getElementById('similarity-ranking-tbody');
    this.#gatePassRankingTbody = document.getElementById('gate-pass-ranking-tbody');
    this.#combinedRankingTbody = document.getElementById('combined-ranking-tbody');
    this.#impliedPrototypeWarning = document.getElementById('implied-prototype-warning');
    this.#impliedPrototypeMetricsFlag = document.getElementById(
      'implied-prototype-metrics-flag'
    );
    // Gap Detection elements
    this.#gapDetectionContainer = document.getElementById('gap-detection');
    this.#gapStatus = document.getElementById('gap-status');
    this.#nearestPrototypesTbody = document.getElementById('nearest-prototypes-tbody');
    this.#suggestedPrototypeSection = document.getElementById('suggested-prototype');
    this.#suggestedPrototypeContent = document.getElementById('suggested-prototype-content');
    this.#gapDetectionMetricsFlag = document.getElementById(
      'gap-detection-metrics-flag'
    );
    // Path-Sensitive Analysis elements
    this.#pathSensitiveSection = document.getElementById('path-sensitive-results');
    this.#pathSensitiveSummary = document.getElementById('path-sensitive-summary');
    this.#psStatusIndicator = document.getElementById('ps-status-indicator');
    this.#psSummaryMessage = document.getElementById('ps-summary-message');
    this.#branchCount = document.getElementById('branch-count');
    this.#reachableCount = document.getElementById('reachable-count');
    this.#branchCardsContainer = document.getElementById('branch-cards-container');
    this.#knifeEdgeSummary = document.getElementById('knife-edge-summary');
    this.#keCount = document.getElementById('ke-count');
    this.#knifeEdgeTbody = document.getElementById('knife-edge-tbody');
    // Branch filter toggle
    this.#showAllBranchesCheckbox = document.getElementById('show-all-branches');
  }

  #setupEventListeners() {
    // Note: expression selection is handled by StatusSelectDropdown's onSelectionChange callback

    this.#runStaticBtn?.addEventListener('click', async () => {
      await this.#runStaticAnalysis();
    });

    this.#runMcBtn?.addEventListener('click', async () => {
      await this.#runMonteCarloSimulation();
    });

    // Note: Witness copy button is now bound dynamically in #displayMcWitnesses()

    this.#showAllBranchesCheckbox?.addEventListener('change', (e) => {
      this.#showAllBranches = e.target.checked;
      this.#applyBranchFilter();
    });

    this.#generateReportBtn?.addEventListener('click', () => {
      this.#handleGenerateReport();
    });

    this.#mcIntegrityWarningsList?.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      const button = target.closest('.integrity-sample-button');
      if (!button || !this.#mcIntegrityWarningsList?.contains(button)) {
        return;
      }
      const warningIndex = Number(button.dataset.warningIndex);
      const sampleIndex = Number(button.dataset.sampleIndex);
      if (!Number.isFinite(warningIndex) || !Number.isFinite(sampleIndex)) {
        return;
      }
      this.#renderIntegrityDrilldown(warningIndex, sampleIndex);
    });
  }

  async #populateExpressionSelect() {
    const expressions = this.#expressionRegistry.getAllExpressions();

    if (!this.#expressionSelectContainer) {
      this.#logger.debug(`Populated ${expressions.length} expressions`);
      return;
    }

    // Dispose existing dropdown if present
    if (this.#statusSelectDropdown) {
      this.#statusSelectDropdown.dispose();
      this.#statusSelectDropdown = null;
    }

    // Get sorted expression IDs
    const sortedIds = expressions
      .map((expr) => expr?.id)
      .filter((id) => typeof id === 'string' && id.trim() !== '')
      .sort((a, b) => a.localeCompare(b));

    // Build options with status information
    // Start with a placeholder option for "no selection"
    const options = [
      { value: '', label: '-- Select an expression --', status: null },
      ...sortedIds.map((expressionId) => ({
        value: expressionId,
        label: expressionId,
        status: this.#getStatusForExpression(expressionId),
      })),
    ];

    // Create the custom dropdown
    this.#statusSelectDropdown = new StatusSelectDropdown({
      containerElement: this.#expressionSelectContainer,
      onSelectionChange: (value) => this.#onExpressionSelected(value),
      logger: this.#logger,
      placeholder: '-- Select an expression --',
      id: 'expression-select',
    });

    this.#statusSelectDropdown.setOptions(options);

    this.#logger.debug(`Populated ${expressions.length} expressions`);
  }

  /**
   * Get the diagnostic status for an expression.
   *
   * @private
   * @param {string} expressionId - The expression ID
   * @returns {string} The diagnostic status ('unknown', 'impossible', etc.)
   */
  #getStatusForExpression(expressionId) {
    const statusEntry = this.#expressionStatuses.find(
      (e) => e.id === expressionId
    );
    return statusEntry?.diagnosticStatus || 'unknown';
  }

  /**
   * Display the saved diagnostic status for a selected expression.
   * Shows the appropriate colored circle and label based on the expression's
   * persisted diagnosticStatus field.
   *
   * @private
   * @param {string} expressionId - The expression ID
   */
  #displayExpressionStatus(expressionId) {
    const status = this.#getStatusForExpression(expressionId);
    const theme = getStatusThemeEntry(status);
    const cssCategory = status.replace(/_/g, '-');
    this.#updateStatus(cssCategory, theme.label, '');
  }

  #onExpressionSelected(expressionId) {
    if (!expressionId) {
      this.#selectedExpression = null;
      this.#expressionDescription.textContent = '';
      this.#runStaticBtn.disabled = true;
      if (this.#runMcBtn) this.#runMcBtn.disabled = true;
      this.#resetResults();
      return;
    }

    this.#selectedExpression =
      this.#expressionRegistry.getExpression(expressionId);

    if (this.#selectedExpression) {
      this.#expressionDescription.textContent =
        this.#selectedExpression.description || 'No description available';
      this.#runStaticBtn.disabled = false;
      if (this.#runMcBtn) this.#runMcBtn.disabled = false;
    } else {
      this.#expressionDescription.textContent = 'Expression not found';
      this.#runStaticBtn.disabled = true;
      if (this.#runMcBtn) this.#runMcBtn.disabled = true;
    }

    this.#resetResults();

    // Display the expression's saved diagnostic status (if any)
    if (this.#selectedExpression) {
      this.#displayExpressionStatus(expressionId);
    }
  }

  #resetResults() {
    this.#currentResult = null;
    this.#updateStatus('unknown', 'Unknown', '');
    this.#staticResults.innerHTML =
      '<p class="placeholder-text">Run static analysis to see results.</p>';
    this.#gateConflictsSection.hidden = true;
    this.#thresholdsSection.hidden = true;
    this.#resetMonteCarloResults();
    this.#resetWitnessResults();
    this.#resetPathSensitiveResults();
  }

  #resetWitnessResults() {
    // Reset MC-captured witness display
    if (this.#mcWitnessesContainer) {
      this.#mcWitnessesContainer.hidden = true;
    }
    if (this.#mcWitnessesList) {
      this.#mcWitnessesList.innerHTML = '';
    }
  }

  #resetMonteCarloResults() {
    if (this.#mcResults) this.#mcResults.hidden = true;
    if (this.#mcTriggerRate) this.#mcTriggerRate.textContent = '--';
    if (this.#mcConfidenceInterval)
      this.#mcConfidenceInterval.textContent = '(-- - --)';
    if (this.#mcSummary) this.#mcSummary.textContent = '';
    if (this.#mcPopulationSummaryContainer) {
      this.#mcPopulationSummaryContainer.hidden = true;
    }
    if (this.#mcPopulationSampleCount) {
      this.#mcPopulationSampleCount.textContent = '--';
    }
    if (this.#mcPopulationInRegimeSampleCount) {
      this.#mcPopulationInRegimeSampleCount.textContent = '--';
    }
    if (this.#mcPopulationStoredCount) {
      this.#mcPopulationStoredCount.textContent = '--';
    }
    if (this.#mcPopulationStoredInRegimeCount) {
      this.#mcPopulationStoredInRegimeCount.textContent = '--';
    }
    if (this.#mcPopulationStoredLimit) {
      this.#mcPopulationStoredLimit.textContent = '--';
    }
    this.#updateStoredContextPopulationLabels(null);
    if (this.#mcSamplingCoverageContainer) {
      this.#mcSamplingCoverageContainer.hidden = true;
    }
    if (this.#mcSamplingCoverageSummary) {
      this.#mcSamplingCoverageSummary.textContent = '';
    }
    if (this.#mcRecommendationsContainer) {
      this.#mcRecommendationsContainer.hidden = true;
    }
    if (this.#mcRecommendationsWarning) {
      this.#mcRecommendationsWarning.hidden = true;
    }
    if (this.#mcRecommendationsWarningText) {
      this.#mcRecommendationsWarningText.textContent = '';
    }
    if (this.#mcRecommendationsList) {
      this.#mcRecommendationsList.innerHTML = '';
    }
    if (this.#mcSamplingCoverageTables) {
      this.#mcSamplingCoverageTables.innerHTML = '';
    }
    if (this.#mcSamplingCoverageConclusionsContainer) {
      this.#mcSamplingCoverageConclusionsContainer.hidden = true;
    }
    if (this.#mcSamplingCoverageConclusionsList) {
      this.#mcSamplingCoverageConclusionsList.innerHTML = '';
    }
    if (this.#mcIntegrityWarningsContainer) {
      this.#mcIntegrityWarningsContainer.hidden = true;
    }
    if (this.#mcIntegrityWarningsSummary) {
      this.#mcIntegrityWarningsSummary.textContent = '';
    }
    if (this.#mcIntegrityWarningsList) {
      this.#mcIntegrityWarningsList.innerHTML = '';
    }
    if (this.#mcIntegrityWarningsImpact) {
      this.#mcIntegrityWarningsImpact.textContent = '';
    }
    this.#latestIntegrityWarnings = [];
    this.#resetIntegrityDrilldown();
    this.#toggleGateDependentMetrics(false);
    if (this.#blockersTbody) this.#blockersTbody.innerHTML = '';
    // Clear stored blockers for report generation
    this.#currentBlockers = [];
    // Reset conditional pass rates section
    if (this.#conditionalPassRatesContainer) {
      this.#conditionalPassRatesContainer.hidden = true;
    }
    if (this.#conditionalPassRatesContent) {
      this.#conditionalPassRatesContent.innerHTML = '';
    }
    // Reset last-mile decomposition section
    if (this.#lastMileDecompositionContainer) {
      this.#lastMileDecompositionContainer.hidden = true;
    }
    if (this.#lastMileDecompositionContent) {
      this.#lastMileDecompositionContent.innerHTML = '';
    }
  }

  async #runStaticAnalysis() {
    if (!this.#selectedExpression) return;

    this.#logger.info(
      `Running static analysis for: ${this.#selectedExpression.id}`
    );

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
        unreachableThresholds: thresholdIssues,
      });

      // Update UI
      this.#displayStaticResults(gateResult, thresholdIssues);
      this.#updateStatusFromResult();

      // Run path-sensitive analysis (provides per-branch details)
      await this.#runPathSensitiveAnalysis();

      // Persist the new status and refresh problematic panel
      const newStatus = this.#currentResult.rarityCategory;
      await this.#persistExpressionStatus(newStatus);
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
      this.#staticResults.innerHTML =
        '<p class="success-text">No static issues detected. All gates compatible, all thresholds reachable.</p>';
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

    const circleEl = this.#statusIndicator.querySelector('.status-circle-large');
    const labelEl = this.#statusIndicator.querySelector('.status-label');

    // Use CSS circle class instead of emoji text for consistent color rendering
    if (circleEl) {
      circleEl.className = `status-circle-large status-circle status-${category}`;
    }
    if (labelEl) labelEl.textContent = label;
    if (this.#statusMessage) this.#statusMessage.textContent = message;
  }

  async #runMonteCarloSimulation() {
    if (!this.#selectedExpression) return;

    // Disable button during simulation to prevent multiple clicks
    if (this.#runMcBtn) {
      this.#runMcBtn.disabled = true;
      this.#runMcBtn.textContent = 'Running...';
    }

    const sampleCount = parseInt(
      this.#sampleCountSelect?.value || '10000',
      10
    );
    const distribution = this.#distributionSelect?.value || 'uniform';

    this.#logger.info(
      `Running MC simulation for: ${this.#selectedExpression.id} ` +
        `(samples=${sampleCount}, dist=${distribution})`
    );

    try {
      const result = await this.#monteCarloSimulator.simulate(
        this.#selectedExpression,
        {
          sampleCount,
          distribution,
          trackClauses: true,
          storeSamplesForSensitivity: true,
          sensitivitySampleLimit: 10000,
          onProgress: (completed, total) => {
            if (this.#runMcBtn) {
              const pct = Math.round((100 * completed) / total);
              this.#runMcBtn.textContent = `${pct}%`;
            }
          },
        }
      );

      // Store raw result for sensitivity analysis during report generation
      this.#rawSimulationResult = result;

      const blockers = this.#failureExplainer.analyzeHierarchicalBlockers(
        result.clauseFailures
      );
      const summary = this.#failureExplainer.generateSummary(
        result.triggerRate,
        blockers
      );

      // Store results in DiagnosticResult model for unified status tracking
      if (!this.#currentResult) {
        // Create result if static analysis wasn't run first
        this.#currentResult = new DiagnosticResult(this.#selectedExpression.id);
      }
      this.#currentResult.setMonteCarloResults({
        triggerRate: result.triggerRate,
        sampleCount: result.sampleCount,
        distribution: result.distribution,
        confidenceInterval: result.confidenceInterval,
        clauseFailures: result.clauseFailures,
      });

      this.#displayMonteCarloResults(result, blockers, summary);

      // Update Status Summary to reflect Monte Carlo results
      this.#updateStatusFromResult();

      // Persist the new status and trigger rate, then refresh problematic panel
      const newStatus = this.#currentResult.rarityCategory;
      const triggerRate = this.#currentResult.triggerRate;
      await this.#persistExpressionStatus(newStatus, triggerRate);
    } catch (error) {
      this.#logger.error('Monte Carlo simulation failed:', error);
      this.#updateStatus('impossible', 'Simulation Error', error.message);
    } finally {
      // Re-enable button after simulation completes (success or error)
      if (this.#runMcBtn) {
        this.#runMcBtn.disabled = false;
        this.#runMcBtn.textContent = 'Run Simulation';
      }
    }
  }

  #displayMonteCarloResults(result, blockers, summary) {
    if (!this.#mcResults) return;

    const enrichedBlockers = this.#attachGateMetricsToBlockers(
      blockers,
      result.clauseFailures
    );

    // Store blockers for report generation
    this.#currentBlockers = enrichedBlockers;

    this.#mcResults.hidden = false;

    // Update rarity indicator using shared classification
    const rarityCategory = DiagnosticResult.getRarityCategoryForRate(
      result.triggerRate
    );
    this.#updateMcRarityIndicator(rarityCategory);

    // Update trigger rate
    if (this.#mcTriggerRate) {
      this.#mcTriggerRate.textContent = this.#formatPercentage(
        result.triggerRate
      );
    }

    // Update confidence interval
    if (this.#mcConfidenceInterval && result.confidenceInterval) {
      this.#mcConfidenceInterval.textContent =
        `(${this.#formatPercentage(result.confidenceInterval.low)} - ` +
        `${this.#formatPercentage(result.confidenceInterval.high)})`;
    }

    // Update summary
    if (this.#mcSummary) {
      this.#mcSummary.textContent = summary;
    }

    this.#updatePopulationSummary(result);

    this.#displaySamplingCoverage(result.samplingCoverage, result.samplingMode);

    const storedContexts = result?.storedContexts ?? [];
    const globalSensitivityData =
      this.#sensitivityAnalyzer.computeGlobalSensitivityData(
        storedContexts,
        enrichedBlockers,
        this.#selectedExpression?.prerequisites ?? null
      );
    const sensitivityData = this.#reportGenerator?.collectReportIntegrityWarnings
      ? this.#sensitivityAnalyzer.computeSensitivityData(
        storedContexts,
        enrichedBlockers
      )
      : [];

    this.#displayIntegrityWarnings(
      result,
      enrichedBlockers,
      sensitivityData,
      globalSensitivityData
    );

    // Update blockers table
    this.#populateBlockersTable(enrichedBlockers);

    // Display recommendations based on deterministic facts
    this.#displayRecommendations(result);

    // Display ground-truth witnesses from MC simulation
    this.#displayMcWitnesses(result.witnessAnalysis);

    // Display global expression sensitivity (how threshold changes affect whole expression)
    this.#displayGlobalSensitivity(globalSensitivityData);

    // Display conditional pass rates (emotion pass rates given mood constraints)
    this.#displayConditionalPassRates();

    // Display last-mile decomposition (why decisive blockers fail)
    this.#displayLastMileDecomposition();

    // Display static analysis cross-reference (compare static findings with MC observations)
    this.#displayStaticCrossReference();

    // Display prototype fit analysis sections (prototype fit, implied prototype, gap detection)
    // Deferred to idle time to avoid long animation frame handlers.
    this.#schedulePrototypeFitAnalysis();
  }

  #displayRecommendations(result) {
    if (!this.#mcRecommendationsContainer || !this.#mcRecommendationsList) {
      return;
    }

    if (!result || !this.#selectedExpression) {
      this.#mcRecommendationsContainer.hidden = true;
      return;
    }

    const factsBuilder = new RecommendationFactsBuilder({
      prototypeConstraintAnalyzer: this.#prototypeConstraintAnalyzer,
      logger: this.#logger,
    });
    const diagnosticFacts = factsBuilder.build({
      expression: this.#selectedExpression,
      simulationResult: result,
    });

    if (!diagnosticFacts) {
      this.#mcRecommendationsContainer.hidden = true;
      return;
    }

    const invariantFailures = (diagnosticFacts.invariants ?? []).filter(
      (inv) => inv.ok === false
    );
    const moodSampleCount = diagnosticFacts.moodRegime?.sampleCount ?? 0;
    const lowConfidence =
      Number.isFinite(moodSampleCount) &&
      moodSampleCount < LOW_CONFIDENCE_SAMPLE_THRESHOLD;

    const engine = new RecommendationEngine();
    const recommendations = engine.generate(diagnosticFacts);

    this.#mcRecommendationsList.innerHTML = '';
    if (this.#mcRecommendationsWarningText) {
      this.#mcRecommendationsWarningText.textContent = '';
    }
    if (this.#mcRecommendationsWarning) {
      this.#mcRecommendationsWarning.hidden = true;
    }

    if (invariantFailures.length > 0) {
      this.#mcRecommendationsContainer.hidden = false;
      if (this.#mcRecommendationsWarningText) {
        this.#mcRecommendationsWarningText.textContent =
          'Recommendations suppressed: invariant violations detected in diagnostic facts.';
      }
      if (this.#mcRecommendationsWarning) {
        this.#mcRecommendationsWarning.hidden = false;
      }
      return;
    }

    if (!Array.isArray(recommendations) || recommendations.length === 0) {
      this.#mcRecommendationsContainer.hidden = true;
      return;
    }

    if (lowConfidence && this.#mcRecommendationsWarningText) {
      this.#mcRecommendationsWarningText.textContent =
        `Low confidence: only ${moodSampleCount} mood-regime samples (min ${LOW_CONFIDENCE_SAMPLE_THRESHOLD}).`;
      if (this.#mcRecommendationsWarning) {
        this.#mcRecommendationsWarning.hidden = false;
      }
    }

    const clauseFactsLookup = new Map(
      (diagnosticFacts.clauses ?? []).map((clause) => [
        clause.clauseId,
        clause,
      ])
    );
    const prototypeFactsLookup = new Map(
      (diagnosticFacts.prototypes ?? []).map((prototype) => [
        prototype.prototypeId,
        prototype,
      ])
    );

    for (const recommendation of recommendations) {
      const { prototypeId, clauseId } =
        this.#parseRecommendationId(recommendation.id) ?? {};
      const clauseFacts = clauseId ? clauseFactsLookup.get(clauseId) : null;
      const prototypeFacts = prototypeId
        ? prototypeFactsLookup.get(prototypeId)
        : null;
      const impact =
        typeof clauseFacts?.impact === 'number' ? clauseFacts.impact : null;
      const confidence = lowConfidence
        ? 'low'
        : recommendation.confidence ?? 'low';

      const card = document.createElement('div');
      card.className = 'recommendation-card';

      const title = document.createElement('h4');
      title.textContent = recommendation.title ?? 'Recommendation';
      card.appendChild(title);

      const meta = document.createElement('div');
      meta.className = 'recommendation-meta';
      meta.appendChild(
        this.#createRecommendationBadge(
          `Type: ${recommendation.type ?? 'unknown'}`
        )
      );
      meta.appendChild(
        this.#createRecommendationBadge(
          `Severity: ${recommendation.severity ?? 'low'}`
        )
      );
      meta.appendChild(
        this.#createRecommendationBadge(`Confidence: ${confidence}`)
      );
      meta.appendChild(
        this.#createRecommendationBadge(
          `Impact (full sample): ${this.#formatImpact(impact)}`
        )
      );
      card.appendChild(meta);

      if (recommendation.why) {
        const why = document.createElement('p');
        why.className = 'recommendation-why';
        why.textContent = recommendation.why;
        card.appendChild(why);
      }

      const funnel = this.#buildRecommendationFunnel(
        prototypeFacts,
        impact
      );
      if (funnel) {
        card.appendChild(funnel);
      }

      const evidenceList = this.#buildRecommendationEvidenceList(
        recommendation.evidence ?? []
      );
      if (evidenceList) {
        card.appendChild(evidenceList);
      }

      const actionsList = this.#buildRecommendationActionsList(
        recommendation.actions ?? []
      );
      if (actionsList) {
        card.appendChild(actionsList);
      }

      const links = this.#buildRecommendationLinks(
        recommendation.relatedClauseIds ?? []
      );
      if (links) {
        card.appendChild(links);
      }

      this.#mcRecommendationsList.appendChild(card);
    }

    this.#mcRecommendationsContainer.hidden = false;
  }

  #attachGateMetricsToBlockers(blockers, clauseFailures) {
    if (!Array.isArray(blockers) || blockers.length === 0) {
      return blockers;
    }

    const lookup = new Map();
    if (Array.isArray(clauseFailures)) {
      for (const clause of clauseFailures) {
        if (clause?.clauseDescription) {
          lookup.set(clause.clauseDescription, clause);
        }
      }
    }

    if (lookup.size === 0) {
      return blockers;
    }

    return blockers.map((blocker) => {
      const clause = lookup.get(blocker.clauseDescription);
      if (!clause) return blocker;
      return {
        ...blocker,
        gateClampRateInRegime: clause.gateClampRateInRegime ?? null,
        passRateGivenGateInRegime: clause.passRateGivenGateInRegime ?? null,
        gatePassInRegimeCount: clause.gatePassInRegimeCount ?? null,
        gateFailInRegimeCount: clause.gateFailInRegimeCount ?? null,
        gatePassAndClausePassInRegimeCount:
          clause.gatePassAndClausePassInRegimeCount ?? null,
      };
    });
  }

  #displayIntegrityWarnings(result, blockers, sensitivityData, globalSensitivityData) {
    if (!this.#mcIntegrityWarningsContainer) {
      return;
    }

    const warnings = this.#resolveIntegrityWarnings(
      result,
      blockers,
      sensitivityData,
      globalSensitivityData
    );
    if (!Array.isArray(warnings) || warnings.length === 0) {
      this.#latestIntegrityWarnings = [];
      this.#mcIntegrityWarningsContainer.hidden = true;
      if (this.#mcIntegrityWarningsSummary) {
        this.#mcIntegrityWarningsSummary.textContent = '';
      }
      if (this.#mcIntegrityWarningsList) {
        this.#mcIntegrityWarningsList.innerHTML = '';
      }
      if (this.#mcIntegrityWarningsImpact) {
        this.#mcIntegrityWarningsImpact.textContent = '';
      }
      this.#resetIntegrityDrilldown();
      this.#toggleGateDependentMetrics(false);
      return;
    }

    this.#latestIntegrityWarnings = warnings;
    this.#resetIntegrityDrilldown();
    this.#mcIntegrityWarningsContainer.hidden = false;
    if (this.#mcIntegrityWarningsSummary) {
      const countLabel = warnings.length === 1 ? 'warning' : 'warnings';
      this.#mcIntegrityWarningsSummary.textContent =
        `Integrity ${countLabel}: ${warnings.length}`;
    }
    if (this.#mcIntegrityWarningsList) {
      this.#mcIntegrityWarningsList.innerHTML = '';
      warnings.forEach((warning, index) => {
        const item = document.createElement('li');
        const label = document.createElement('span');
        label.textContent = this.#formatIntegrityWarning(warning);
        item.appendChild(label);

        const sampleIndices = warning?.details?.sampleIndices;
        if (Array.isArray(sampleIndices) && sampleIndices.length > 0) {
          const samples = document.createElement('div');
          samples.className = 'integrity-warning-samples';
          const prefix = document.createElement('span');
          prefix.textContent = 'Samples:';
          samples.appendChild(prefix);
          for (const sampleIndex of sampleIndices) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'integrity-sample-button';
            button.textContent = String(sampleIndex);
            button.dataset.warningIndex = String(index);
            button.dataset.sampleIndex = String(sampleIndex);
            samples.appendChild(button);
          }
          item.appendChild(samples);
        }
        this.#mcIntegrityWarningsList.appendChild(item);
      });
    }
    const hasGateMismatchWarning = warnings.some(
      (warning) =>
        typeof warning?.code === 'string' && warning.code.startsWith('I')
    );
    if (this.#mcIntegrityWarningsImpact) {
      this.#mcIntegrityWarningsImpact.textContent = hasGateMismatchWarning
        ? 'Gate/final mismatches can invalidate pass-rate and blocker metrics; treat threshold feasibility as provisional until resolved.'
        : '';
    }
    this.#toggleGateDependentMetrics(hasGateMismatchWarning);
  }

  #toggleGateDependentMetrics(hasIntegrityWarnings) {
    if (this.#mcGateMetricsFlag) {
      this.#mcGateMetricsFlag.hidden = !hasIntegrityWarnings;
    }
    if (this.#conditionalPassMetricsFlag) {
      this.#conditionalPassMetricsFlag.hidden = !hasIntegrityWarnings;
    }
    if (this.#globalSensitivityMetricsFlag) {
      this.#globalSensitivityMetricsFlag.hidden = !hasIntegrityWarnings;
    }
    if (this.#lastMileMetricsFlag) {
      this.#lastMileMetricsFlag.hidden = !hasIntegrityWarnings;
    }
    if (this.#samplingCoverageMetricsFlag) {
      this.#samplingCoverageMetricsFlag.hidden = !hasIntegrityWarnings;
    }
    if (this.#staticCrossReferenceMetricsFlag) {
      this.#staticCrossReferenceMetricsFlag.hidden = !hasIntegrityWarnings;
    }
    if (this.#prototypeFitMetricsFlag) {
      this.#prototypeFitMetricsFlag.hidden = !hasIntegrityWarnings;
    }
    if (this.#impliedPrototypeMetricsFlag) {
      this.#impliedPrototypeMetricsFlag.hidden = !hasIntegrityWarnings;
    }
    if (this.#gapDetectionMetricsFlag) {
      this.#gapDetectionMetricsFlag.hidden = !hasIntegrityWarnings;
    }
  }

  #resolveIntegrityWarnings(
    result,
    blockers,
    sensitivityData = [],
    globalSensitivityData = []
  ) {
    if (!result || !Array.isArray(blockers)) {
      return [];
    }

    if (
      Array.isArray(result.reportIntegrityWarnings) &&
      result.reportIntegrityWarnings.length > 0
    ) {
      return result.reportIntegrityWarnings;
    }

    if (!this.#reportGenerator?.collectReportIntegrityWarnings) {
      return [];
    }

    return this.#reportGenerator.collectReportIntegrityWarnings({
      simulationResult: result,
      blockers,
      prerequisites: this.#selectedExpression?.prerequisites ?? null,
      sensitivityData,
      globalSensitivityData,
    });
  }

  #formatIntegrityWarning(warning) {
    const parts = [];
    if (warning?.populationHash) {
      parts.push(`population=${warning.populationHash}`);
    }
    if (warning?.prototypeId) {
      parts.push(`prototype=${warning.prototypeId}`);
    }
    const meta = parts.length > 0 ? ` (${parts.join(', ')})` : '';
    return `${warning?.code ?? 'WARN'}: ${warning?.message ?? ''}${meta}`;
  }

  #resetIntegrityDrilldown() {
    if (this.#mcIntegrityDrilldownContainer) {
      this.#mcIntegrityDrilldownContainer.hidden = true;
    }
    if (this.#mcIntegrityDrilldownSummary) {
      this.#mcIntegrityDrilldownSummary.textContent = '';
    }
    if (this.#mcIntegrityDrilldownContent) {
      this.#mcIntegrityDrilldownContent.innerHTML = '';
    }
  }

  #renderIntegrityDrilldown(warningIndex, sampleIndex) {
    if (
      !this.#mcIntegrityDrilldownContainer ||
      !this.#mcIntegrityDrilldownSummary ||
      !this.#mcIntegrityDrilldownContent
    ) {
      return;
    }

    const warning = this.#latestIntegrityWarnings?.[warningIndex];
    if (!warning) {
      this.#resetIntegrityDrilldown();
      return;
    }

    const storedContexts = this.#rawSimulationResult?.storedContexts;
    if (
      !Array.isArray(storedContexts) ||
      !Number.isInteger(sampleIndex) ||
      sampleIndex < 0 ||
      sampleIndex >= storedContexts.length
    ) {
      this.#mcIntegrityDrilldownSummary.textContent =
        'Drill-down unavailable for the selected sample index.';
      this.#mcIntegrityDrilldownContent.textContent = '';
      this.#mcIntegrityDrilldownContainer.hidden = false;
      return;
    }

    const context = storedContexts[sampleIndex];
    const prototypeId = warning?.prototypeId ?? null;
    const { type, trace, finalValue } =
      this.#resolveIntegrityTrace(context, prototypeId);

    const metaParts = [`Sample ${sampleIndex}`];
    if (prototypeId) {
      metaParts.push(`Prototype ${prototypeId}`);
    }
    if (warning?.populationHash) {
      metaParts.push(`Population ${warning.populationHash}`);
    }
    if (type) {
      metaParts.push(type === 'emotion' ? 'Emotion' : 'Sexual state');
    }
    this.#mcIntegrityDrilldownSummary.textContent = metaParts.join(' • ');

    this.#mcIntegrityDrilldownContent.innerHTML = '';

    const scaleNote = document.createElement('p');
    scaleNote.className = 'mc-integrity-drilldown-scale';
    scaleNote.textContent =
      'Axes: mood raw [-100, 100] -> normalized [-1, 1]; sexual raw [0, 100] -> normalized [0, 1]; traits raw [0, 100] -> normalized [0, 1].';
    this.#mcIntegrityDrilldownContent.appendChild(scaleNote);

    if (!trace) {
      const missing = document.createElement('p');
      missing.className = 'mc-integrity-drilldown-missing';
      missing.textContent = 'Gate trace unavailable for this sample.';
      this.#mcIntegrityDrilldownContent.appendChild(missing);
      if (typeof finalValue !== 'number') {
        this.#mcIntegrityDrilldownContainer.hidden = false;
        return;
      }
    }

    const grid = document.createElement('div');
    grid.className = 'mc-integrity-drilldown-grid';

    const addRow = (label, value) => {
      const item = document.createElement('div');
      item.className = 'mc-integrity-drilldown-item';
      const title = document.createElement('div');
      title.className = 'mc-integrity-drilldown-label';
      title.textContent = label;
      const body = document.createElement('div');
      body.className = 'mc-integrity-drilldown-value';
      body.textContent =
        typeof value === 'number' ? value.toFixed(4) : value ?? '—';
      item.appendChild(title);
      item.appendChild(body);
      grid.appendChild(item);
    };

    if (trace) {
      addRow('Raw (0..1)', trace.raw);
      addRow('Gated (0..1)', trace.gated);
      addRow('Final (0..1)', trace.final);
      addRow('Gate pass', trace.gatePass ? 'true' : 'false');
    }
    if (typeof finalValue === 'number') {
      addRow('Stored final (0..1)', finalValue);
    }

    this.#mcIntegrityDrilldownContent.appendChild(grid);
    this.#mcIntegrityDrilldownContainer.hidden = false;
  }

  #resolveIntegrityTrace(context, prototypeId) {
    if (!context || !prototypeId) {
      return { type: null, trace: null, finalValue: null };
    }
    const gateTrace = context?.gateTrace ?? null;
    if (gateTrace?.emotions?.[prototypeId]) {
      return {
        type: 'emotion',
        trace: gateTrace.emotions[prototypeId],
        finalValue: context?.emotions?.[prototypeId] ?? null,
      };
    }
    if (gateTrace?.sexualStates?.[prototypeId]) {
      return {
        type: 'sexual',
        trace: gateTrace.sexualStates[prototypeId],
        finalValue: context?.sexualStates?.[prototypeId] ?? null,
      };
    }
    if (
      context?.emotions &&
      Object.prototype.hasOwnProperty.call(context.emotions, prototypeId)
    ) {
      return {
        type: 'emotion',
        trace: null,
        finalValue: context.emotions[prototypeId],
      };
    }
    if (
      context?.sexualStates &&
      Object.prototype.hasOwnProperty.call(context.sexualStates, prototypeId)
    ) {
      return {
        type: 'sexual',
        trace: null,
        finalValue: context.sexualStates[prototypeId],
      };
    }
    return { type: null, trace: null, finalValue: null };
  }

  #updatePopulationSummary(result) {
    const summary = this.#normalizePopulationSummary(result);
    const populationMeta = result?.populationMeta ?? null;
    if (!this.#mcPopulationSummaryContainer || !summary) {
      if (this.#mcPopulationSummaryContainer) {
        this.#mcPopulationSummaryContainer.hidden = true;
      }
      this.#updateStoredContextPopulationLabels(null, null);
      return;
    }

    const formatCount = (value) =>
      Number.isFinite(value) ? value.toLocaleString() : '—';

    if (this.#mcPopulationSampleCount) {
      this.#mcPopulationSampleCount.textContent = formatCount(summary.sampleCount);
    }
    if (this.#mcPopulationInRegimeSampleCount) {
      this.#mcPopulationInRegimeSampleCount.textContent = formatCount(
        summary.inRegimeSampleCount
      );
    }
    if (this.#mcPopulationStoredCount) {
      this.#mcPopulationStoredCount.textContent = formatCount(
        summary.storedContextCount
      );
    }
    if (this.#mcPopulationStoredInRegimeCount) {
      this.#mcPopulationStoredInRegimeCount.textContent = formatCount(
        summary.storedInRegimeCount
      );
    }
    if (this.#mcPopulationStoredLimit) {
      this.#mcPopulationStoredLimit.textContent = formatCount(
        summary.storedContextLimit
      );
    }

    this.#mcPopulationSummaryContainer.hidden = false;
    this.#updateStoredContextPopulationLabels(summary, populationMeta);
  }

  #normalizePopulationSummary(result) {
    if (!result || typeof result !== 'object') {
      return null;
    }

    const summary = result.populationSummary ?? {};
    const sampleCount = summary.sampleCount ?? result.sampleCount;

    if (!Number.isFinite(sampleCount)) {
      return null;
    }

    const storedContexts = Array.isArray(result.storedContexts)
      ? result.storedContexts
      : [];

    return {
      sampleCount,
      inRegimeSampleCount:
        summary.inRegimeSampleCount ?? result.inRegimeSampleCount ?? 0,
      storedContextCount:
        summary.storedContextCount ?? storedContexts.length ?? 0,
      storedContextLimit: summary.storedContextLimit ?? 0,
      storedInRegimeCount:
        summary.storedInRegimeCount ?? summary.storedContextCount ?? storedContexts.length ?? 0,
    };
  }

  #updateStoredContextPopulationLabels(summary, populationMeta) {
    if (!Array.isArray(this.#storedContextPopulationLabels)) return;

    const storedHash = populationMeta?.storedGlobal?.hash ?? null;
    const hashLabel = storedHash ? `; hash ${storedHash}` : '';
    const label =
      summary && Number.isFinite(summary.storedContextCount)
        ? `Population: stored contexts (${summary.storedContextCount.toLocaleString()} of ${summary.sampleCount.toLocaleString()}, in-regime ${summary.storedInRegimeCount.toLocaleString()}, limit ${summary.storedContextLimit.toLocaleString()}${hashLabel}).`
        : '';

    for (const element of this.#storedContextPopulationLabels) {
      if (!element) continue;
      element.textContent = label;
    }
  }

  #schedulePrototypeFitAnalysis() {
    const runAnalysis = () => {
      void this.#displayPrototypeFitAnalysisAsync();
    };

    if (typeof globalThis.requestIdleCallback === 'function') {
      globalThis.requestIdleCallback(runAnalysis, { timeout: 500 });
    } else {
      setTimeout(runAnalysis, 0);
    }
  }

  #displaySamplingCoverage(samplingCoverage, samplingMode) {
    if (!this.#mcSamplingCoverageContainer) return;

    if (!samplingCoverage || typeof samplingCoverage !== 'object') {
      this.#mcSamplingCoverageContainer.hidden = true;
      if (this.#mcSamplingCoverageSummary) {
        this.#mcSamplingCoverageSummary.textContent = '';
      }
      if (this.#mcSamplingCoverageTables) {
        this.#mcSamplingCoverageTables.innerHTML = '';
      }
      this.#renderSamplingCoverageConclusions(null);
      return;
    }

    const summaryByDomain = Array.isArray(samplingCoverage.summaryByDomain)
      ? samplingCoverage.summaryByDomain
      : [];
    const variables = Array.isArray(samplingCoverage.variables)
      ? samplingCoverage.variables
      : [];
    const displayableVariables = variables.filter(
      (variable) => variable && variable.rating && variable.rating !== 'unknown'
    );
    const lowestCoverageVariables = this.#getLowestCoverageVariables(
      displayableVariables,
      3
    );

    if (summaryByDomain.length === 0 && lowestCoverageVariables.length === 0) {
      this.#mcSamplingCoverageContainer.hidden = true;
      if (this.#mcSamplingCoverageSummary) {
        this.#mcSamplingCoverageSummary.textContent = '';
      }
      if (this.#mcSamplingCoverageTables) {
        this.#mcSamplingCoverageTables.innerHTML = '';
      }
      this.#renderSamplingCoverageConclusions(null);
      return;
    }

    this.#mcSamplingCoverageContainer.hidden = false;

    if (this.#mcSamplingCoverageSummary) {
      this.#mcSamplingCoverageSummary.textContent =
        this.#buildSamplingCoverageSummary(summaryByDomain, samplingMode);
    }

    if (this.#mcSamplingCoverageTables) {
      this.#mcSamplingCoverageTables.innerHTML = '';
      if (summaryByDomain.length > 0) {
        this.#mcSamplingCoverageTables.appendChild(
          this.#buildSamplingCoverageSummaryTable(summaryByDomain)
        );
      }
      if (lowestCoverageVariables.length > 0) {
        this.#mcSamplingCoverageTables.appendChild(
          this.#buildSamplingCoverageLowestTable(lowestCoverageVariables)
        );
      }
    }

    this.#renderSamplingCoverageConclusions(
      buildSamplingCoverageConclusions(samplingCoverage, {
        includeWatchlist: true,
      })
    );
  }

  #renderSamplingCoverageConclusions(conclusions) {
    if (
      !this.#mcSamplingCoverageConclusionsContainer ||
      !this.#mcSamplingCoverageConclusionsList
    ) {
      return;
    }

    if (!conclusions) {
      this.#mcSamplingCoverageConclusionsContainer.hidden = true;
      this.#mcSamplingCoverageConclusionsList.innerHTML = '';
      return;
    }

    const items = [
      ...conclusions.domainConclusions,
      ...conclusions.variableSummary,
      ...conclusions.globalImplications,
      ...conclusions.watchlist,
    ];

    if (items.length === 0) {
      this.#mcSamplingCoverageConclusionsContainer.hidden = true;
      this.#mcSamplingCoverageConclusionsList.innerHTML = '';
      return;
    }

    this.#mcSamplingCoverageConclusionsContainer.hidden = false;
    this.#mcSamplingCoverageConclusionsList.innerHTML = '';

    for (const item of items) {
      const entry = document.createElement('li');
      entry.textContent = item.text;
      this.#mcSamplingCoverageConclusionsList.appendChild(entry);
    }
  }

  #populateBlockersTable(blockers) {
    if (!this.#blockersTbody) return;

    this.#blockersTbody.innerHTML = '';
    const clauseFailures = this.#rawSimulationResult?.clauseFailures ?? [];
    const chokeRankLookup = this.#buildChokeRankLookup(
      this.#rawSimulationResult?.ablationImpact ?? null
    );
    const clauseLookup = this.#buildClauseFailureLookup(clauseFailures);
    const storedContexts = this.#rawSimulationResult?.storedContexts ?? null;
    const prerequisites = this.#selectedExpression?.prerequisites ?? [];
    const moodConstraints = this.#extractMoodConstraintsForUI(prerequisites);
    const regimeContexts = this.#getMoodRegimeContextsForGateBreakdown(
      storedContexts,
      moodConstraints
    );

    for (const blocker of blockers) {
      const gateClampMetrics = this.#formatGateClampMetrics(blocker);
      const passGivenGateMetrics = this.#formatPassGivenGateMetrics(blocker);
      const classificationBadge = this.#buildGateClassificationBadge(blocker);
      const clauseFailure = clauseLookup.get(blocker.clauseDescription) ?? null;
      const chokeRank = this.#resolveChokeRankForBlocker(
        clauseFailure,
        chokeRankLookup
      );
      const clauseAnchorId = this.#resolveClauseAnchorId(clauseFailure);
      const gateBreakdownPanel = this.#buildGateBreakdownPanel(
        clauseFailure,
        regimeContexts
      );

      // Main blocker row
      const row = document.createElement('tr');
      row.classList.add('blocker-row');
      row.dataset.blockerId = `blocker-${blocker.rank}`;

      const expandToggle = blocker.hasHierarchy
        ? `<button class="expand-toggle" aria-expanded="false" aria-label="Expand breakdown">▶</button>`
        : `<span class="no-toggle"></span>`;

      row.innerHTML = `
        <td class="toggle-cell">${expandToggle}</td>
        <td>${blocker.rank}</td>
        <td class="choke-rank">${chokeRank}</td>
        <td><code ${clauseAnchorId ? `id="${clauseAnchorId}"` : ''}>${this.#escapeHtml(blocker.clauseDescription)}</code></td>
        <td>${this.#formatPercentage(blocker.failureRate)}</td>
        <td class="last-mile">${this.#formatLastMile(blocker)}</td>
        <td class="gate-clamp">${gateClampMetrics}</td>
        <td class="pass-gate">${passGivenGateMetrics}</td>
        <td class="gate-classification">${classificationBadge}</td>
        <td class="recommendation">${this.#formatRecommendation(blocker)}</td>
        <td><span class="severity-badge severity-${blocker.explanation.severity}">${blocker.explanation.severity}</span></td>
      `;

      // Add click handler for expand toggle
      if (blocker.hasHierarchy) {
        const toggle = row.querySelector('.expand-toggle');
        toggle.addEventListener('click', (e) => {
          e.stopPropagation();
          this.#toggleBreakdown(`blocker-${blocker.rank}`, blocker);
        });
      }

      this.#blockersTbody.appendChild(row);

      // Hidden breakdown row (initially collapsed)
      if (blocker.hasHierarchy) {
        const violationSummary = this.#formatViolationStats(blocker);
        const regimeDetails = this.#buildBlockerRegimeDetails(blocker);
        const breakdownRow = document.createElement('tr');
        breakdownRow.classList.add('breakdown-row', 'collapsed');
        breakdownRow.dataset.parentId = `blocker-${blocker.rank}`;
        breakdownRow.innerHTML = `
          <td colspan="11" class="breakdown-cell">
            ${regimeDetails}
            ${gateBreakdownPanel}
            <div class="blocker-violation-summary">
              <div class="blocker-violation-label">Violation</div>
              <div class="violation-stats">${violationSummary}</div>
            </div>
            <div class="hierarchical-tree">
              ${this.#renderHierarchicalTree(blocker.hierarchicalBreakdown, 0)}
            </div>
          </td>
        `;
        this.#blockersTbody.appendChild(breakdownRow);
      }
    }

    if (blockers.length === 0) {
      const row = document.createElement('tr');
      row.innerHTML =
        '<td colspan="11" class="no-data">No blockers identified</td>';
      this.#blockersTbody.appendChild(row);
    }
  }

  /**
   * Handle Generate Report button click.
   * Generates markdown report and displays in modal.
   *
   * @private
   */
  async #handleGenerateReport() {
    if (!this.#currentResult || !this.#selectedExpression) {
      this.#logger.warn('Cannot generate report: no simulation results');
      return;
    }

    if (!this.#reportGenerator || !this.#reportModal) {
      this.#logger.error('Report generator or modal not available');
      return;
    }

    if (this.#reportGenerationInProgress) {
      return;
    }

    this.#reportGenerationInProgress = true;
    if (this.#generateReportBtn) {
      this.#generateReportBtn.disabled = true;
    }

    const expressionName = this.#getExpressionName(this.#selectedExpression.id);
    const summary = this.#mcSummary?.textContent || '';
    const prerequisites = this.#selectedExpression?.prerequisites;

    // Collect static analysis data for cross-reference section
    const staticAnalysis = {
      gateConflicts: this.#currentResult.gateConflicts || [],
      unreachableThresholds: this.#currentResult.unreachableThresholds || [],
    };

    try {
      const report = await this.#generateReportContent({
        expressionName,
        simulationResult: this.#rawSimulationResult,
        blockers: this.#currentBlockers,
        summary,
        prerequisites: prerequisites ?? null,
        staticAnalysis,
      });

      this.#reportModal.showReport(report);
      this.#logger.debug('Report generated and displayed');
    } catch (err) {
      this.#logger.error('Failed to generate report:', err);
    } finally {
      this.#reportGenerationInProgress = false;
      if (this.#generateReportBtn) {
        this.#generateReportBtn.disabled = false;
      }
    }
  }

  async #generateReportContent({
    expressionName,
    simulationResult,
    blockers,
    summary,
    prerequisites,
    staticAnalysis,
  }) {
    if (this.#shouldUseReportWorker()) {
      const lookups = this.#getReportWorkerLookups();
      return this.#generateReportInWorker({
        expressionName,
        simulationResult,
        blockers,
        summary,
        prerequisites,
        staticAnalysis,
        lookups,
      });
    }

    return this.#reportOrchestrator.generateReport({
      expressionName,
      simulationResult,
      blockers,
      summary,
      prerequisites,
      staticAnalysis,
    });
  }

  #shouldUseReportWorker() {
    return typeof Worker !== 'undefined';
  }

  #getReportWorkerLookups() {
    const lookups = {};
    const emotionPrototypes = this.#dataRegistry?.getLookupData(
      'core:emotion_prototypes'
    );
    const sexualPrototypes = this.#dataRegistry?.getLookupData(
      'core:sexual_prototypes'
    );

    if (emotionPrototypes) {
      lookups['core:emotion_prototypes'] = emotionPrototypes;
    }
    if (sexualPrototypes) {
      lookups['core:sexual_prototypes'] = sexualPrototypes;
    }

    return lookups;
  }

  #ensureReportWorker() {
    if (this.#reportWorker) {
      return;
    }

    const workerConfig = resolveReportWorkerUrl({
      moduleUrl:
        typeof globalThis !== 'undefined'
          ? globalThis.__LNE_REPORT_WORKER_MODULE_URL__
          : undefined,
      documentBaseUrl: globalThis.document?.baseURI,
    });

    if (!workerConfig?.url) {
      this.#logger.error('Report worker URL could not be resolved');
      return;
    }

    const workerOptions = workerConfig.type ? { type: workerConfig.type } : {};
    this.#reportWorker = new Worker(workerConfig.url, workerOptions);
  }

  #generateReportInWorker(payload) {
    this.#ensureReportWorker();

    if (!this.#reportWorker) {
      return this.#reportOrchestrator.generateReport(payload);
    }

    const taskId = this.#reportWorkerTaskId + 1;
    this.#reportWorkerTaskId = taskId;

    return new Promise((resolve, reject) => {
      const handleMessage = (event) => {
        const data = event?.data;
        if (!data || data.id !== taskId) {
          return;
        }

        cleanup();

        if (data.type === 'report') {
          resolve(data.report ?? '');
        } else {
          reject(new Error(data.error || 'Report worker failed'));
        }
      };

      const handleError = (event) => {
        cleanup();
        reject(event?.error || new Error('Report worker failed'));
      };

      const cleanup = () => {
        this.#reportWorker?.removeEventListener('message', handleMessage);
        this.#reportWorker?.removeEventListener('error', handleError);
      };

      this.#reportWorker?.addEventListener('message', handleMessage);
      this.#reportWorker?.addEventListener('error', handleError);
      this.#reportWorker?.postMessage({ id: taskId, payload });
    });
  }


  /**
   * Toggle expand/collapse of a blocker's hierarchical breakdown.
   *
   * @private
   * @param {string} blockerId - The unique ID of the blocker row to toggle
   * @param {object} _blocker - The blocker data (unused but kept for future enhancements)
   */
  #toggleBreakdown(blockerId, _blocker) {
    const blockerRow = this.#blockersTbody.querySelector(
      `[data-blocker-id="${blockerId}"]`
    );
    const breakdownRow = this.#blockersTbody.querySelector(
      `[data-parent-id="${blockerId}"]`
    );
    const toggle = blockerRow?.querySelector('.expand-toggle');

    if (!blockerRow || !breakdownRow || !toggle) return;

    const isExpanded = toggle.getAttribute('aria-expanded') === 'true';

    if (isExpanded) {
      // Collapse
      toggle.setAttribute('aria-expanded', 'false');
      toggle.textContent = '▶';
      breakdownRow.classList.add('collapsed');
    } else {
      // Expand
      toggle.setAttribute('aria-expanded', 'true');
      toggle.textContent = '▼';
      breakdownRow.classList.remove('collapsed');
    }
  }

  /**
   * Render a hierarchical clause tree as nested HTML.
   *
   * @private
   * @param {object} node - Tree node (from toJSON)
   * @param {number} depth - Current depth (for indentation)
   * @param {boolean} isInsideOrBlock - True if this node is inside an OR block (last-mile N/A)
   * @returns {string} HTML string
   */
  #renderHierarchicalTree(node, depth, isInsideOrBlock = false) {
    if (!node) return '';

    const indent = depth * 1.5; // rem units
    const nodeIcon = this.#getNodeIcon(node.nodeType);

    // For OR blocks, show PASS rate (which is the meaningful metric)
    // For other blocks, show FAIL rate
    const isOrBlock = node.nodeType === 'or';
    // Track if this node or any ancestor is an OR block
    const isOrContext = isInsideOrBlock || isOrBlock;
    const displayRate = isOrBlock
      ? this.#calculateOrPassRate(node.children ?? [])
      : node.failureRate;
    const rateClass = isOrBlock
      ? this.#getPassRateColor(displayRate)
      : this.#getFailureColor(node.failureRate);
    const rateLabel = isOrBlock ? 'pass' : '';

    // Format violation for leaf nodes
    const violationDisplay =
      !node.isCompound && node.averageViolation > 0
        ? ` <span class="violation-badge">\u0394${node.averageViolation.toFixed(2)}</span>`
        : '';

    // Threshold display for leaf nodes
    const thresholdDisplay =
      !node.isCompound &&
      node.thresholdValue !== null &&
      node.thresholdValue !== undefined
        ? ` <span class="tree-threshold">thresh: ${this.#formatNumber(node.thresholdValue)}</span>`
        : '';

    // Max observed display for leaf nodes
    const maxObsDisplay =
      !node.isCompound &&
      node.maxObservedValue !== null &&
      node.maxObservedValue !== undefined
        ? ` <span class="tree-max-obs">max: ${this.#formatNumber(node.maxObservedValue)}</span>`
        : '';

    // Ceiling gap display for leaf nodes (show as metric, not just warning)
    const gapDisplay =
      !node.isCompound &&
      node.ceilingGap !== null &&
      node.ceilingGap !== undefined
        ? ` <span class="tree-gap ${node.ceilingGap > 0 ? 'positive' : 'negative'}">gap: ${this.#formatNumber(node.ceilingGap)}</span>`
        : '';

    // Tunability indicator for leaf nodes
    const tunabilityDisplay =
      !node.isCompound &&
      node.nearMissRate !== null &&
      node.nearMissRate !== undefined
        ? ` <span class="tree-tunability tunability-${this.#getTunabilityLevel(node.nearMissRate)}">${this.#getTunabilityLevel(node.nearMissRate)}</span>`
        : '';

    // Percentiles (if available) - show P50, P90, P95, P99
    const percentilesDisplay = this.#formatPercentilesDisplay(node);

    // Last-mile rate (if meaningful)
    // For leaf nodes inside OR blocks, last-mile is conceptually meaningless
    // (only one OR alternative needs to pass, so "last-mile" doesn't apply)
    let lastMileDisplay = '';
    if (!node.isCompound && isOrContext) {
      // Leaf inside OR block - show N/A indicator
      lastMileDisplay = ' <span class="tree-last-mile na">SB: N/A</span>';
    } else if (node.lastMileFailRate !== null && node.lastMileFailRate !== undefined) {
      lastMileDisplay = ` <span class="tree-last-mile">SB: ${this.#formatPercentage(node.lastMileFailRate)}</span>`;
    }

    // Ceiling warning (for critical ceiling detection)
    const ceilingDisplay =
      node.ceilingGap !== null && node.ceilingGap > 0
        ? ` <span class="tree-ceiling-warning">CEILING</span>`
        : '';

    // Build tree line prefix
    const isLastChild = false; // Simplified - always use ├
    const treePrefix = depth > 0 ? (isLastChild ? '└' : '├') : '';

    // Determine node state for data attributes
    const isDecisive = node.advancedAnalysis?.lastMileAnalysis?.isDecisive ?? false;
    const hasCeiling = node.ceilingGap !== null && node.ceilingGap > 0;
    const clauseAnchorId =
      !node.isCompound && node.clauseId
        ? this.#formatClauseAnchorId(node.clauseId)
        : '';

    // For OR blocks, show pass rate with label; for others, show failure rate
    const rateDisplay = isOrBlock
      ? `<span class="pass-rate ${rateClass}">${this.#formatPercentage(displayRate)} ${rateLabel}</span>`
      : `<span class="failure-rate ${rateClass}">${this.#formatPercentage(displayRate)}</span>`;

    let html = `
      <div class="tree-node" ${clauseAnchorId ? `id="${clauseAnchorId}"` : ''} style="padding-left: ${indent}rem" data-decisive="${isDecisive}" data-ceiling="${hasCeiling}">
        <span class="tree-prefix">${treePrefix}</span>
        <span class="node-icon ${node.nodeType}">${nodeIcon}</span>
        <span class="node-description">${this.#escapeHtml(node.description)}</span>
        ${rateDisplay}
        ${violationDisplay}${thresholdDisplay}${maxObsDisplay}${gapDisplay}${tunabilityDisplay}${percentilesDisplay}${lastMileDisplay}${ceilingDisplay}
      </div>
    `;

    // Render children recursively
    // Pass isOrContext so children know they're inside an OR block (for last-mile display)
    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        html += this.#renderHierarchicalTree(child, depth + 1, isOrContext);
      }

      // For OR nodes, add combined pass rate summary and contribution breakdown after children
      if (node.nodeType === 'or') {
        const passRate = this.#calculateOrPassRate(node.children);
        const contributionHtml = this.#generateOrContributionBreakdownHtml(node.children, depth);
        html += `<div class="tree-or-summary" style="padding-left: ${(depth + 1) * 1.5}rem">Combined: ${this.#formatPercentage(passRate)} pass rate</div>`;
        html += contributionHtml;
      }
    }

    return html;
  }

  /**
   * Calculate the combined pass rate for an OR block.
   * P(any pass) = 1 - P(all fail) = 1 - Π(failRate_i)
   *
   * @private
   * @param {object[]} children - Child nodes of the OR block
   * @returns {number} Combined pass rate (0 to 1)
   */
  #calculateOrPassRate(children) {
    let allFailProb = 1;
    for (const child of children) {
      allFailProb *= child.failureRate ?? 1;
    }
    return 1 - allFailProb;
  }

  /**
   * Generate HTML for OR contribution breakdown.
   * Shows which OR alternatives contribute most to the block passing.
   *
   * @private
   * @param {object[]} children - Child nodes of the OR block
   * @param {number} depth - Current depth for indentation
   * @returns {string} HTML string with contribution breakdown
   */
  #generateOrContributionBreakdownHtml(children, depth) {
    if (!children || children.length === 0) {
      return '';
    }

    // Collect contribution data from all children
    const contributions = [];

    for (const child of children) {
      const orContributionRate = child.orContributionRate;
      const orContributionCount = child.orContributionCount ?? 0;
      const orPassRate = child.orPassRate;
      const orPassCount = child.orPassCount ?? 0;
      const orExclusiveRate = child.orExclusivePassRate;
      const orExclusiveCount = child.orExclusivePassCount ?? 0;
      const orSuccessCount = child.orSuccessCount ?? 0;

      // Only include if we have contribution data
      if (
        typeof orContributionRate === 'number' ||
        typeof orPassRate === 'number' ||
        typeof orExclusiveRate === 'number' ||
        orContributionCount > 0 ||
        orPassCount > 0 ||
        orExclusiveCount > 0 ||
        orSuccessCount > 0
      ) {
        contributions.push({
          description: child.description ?? 'Unknown condition',
          passRate: orPassRate,
          passCount: orPassCount,
          exclusiveRate: orExclusiveRate,
          exclusiveCount: orExclusiveCount,
          contributionRate: orContributionRate,
          contributionCount: orContributionCount,
          successCount: orSuccessCount,
        });
      }
    }

    // No contribution data available
    if (contributions.length === 0) {
      return '';
    }

    // Sort by pass rate descending
    contributions.sort((a, b) => {
      const rateA = a.passRate ?? 0;
      const rateB = b.passRate ?? 0;
      if (rateB !== rateA) return rateB - rateA;
      const contribA = a.contributionRate ?? 0;
      const contribB = b.contributionRate ?? 0;
      return contribB - contribA;
    });

    const totalSuccesses = contributions[0]?.successCount ?? 0;
    if (totalSuccesses === 0) {
      return '';
    }

    // Build collapsible breakdown
    const indent = (depth + 1) * 1.5;
    let html = `<details class="or-contribution-breakdown" style="padding-left: ${indent}rem">`;
    html += `<summary>OR alternative coverage (${totalSuccesses} total passes)</summary>`;
    html += '<div class="contribution-note">First-pass share is order-dependent; use pass/exclusive rates for order-independent attribution.</div>';
    html += '<ul class="contribution-list">';

    for (const c of contributions) {
      const passRate =
        typeof c.passRate === 'number'
          ? this.#formatPercentage(c.passRate)
          : 'N/A';
      const exclusiveRate =
        typeof c.exclusiveRate === 'number'
          ? this.#formatPercentage(c.exclusiveRate)
          : 'N/A';
      const contributionRate =
        typeof c.contributionRate === 'number'
          ? this.#formatPercentage(c.contributionRate)
          : 'N/A';
      const passCountStr = `${c.passCount}/${c.successCount}`;
      const exclusiveCountStr = `${c.exclusiveCount}/${c.successCount}`;
      const contribCountStr = `${c.contributionCount}/${c.successCount}`;

      // Determine contribution class for color coding
      const contributionClass = this.#getContributionClass(c.contributionRate);

      html += `<li class="contribution-item ${contributionClass}">`;
      html += `<span class="contribution-desc">${this.#escapeHtml(c.description)}</span>: `;
      html += `<span class="contribution-rate">pass ${passRate} (${passCountStr})</span> `;
      html += `<span class="contribution-count">exclusive ${exclusiveRate} (${exclusiveCountStr})</span> `;
      html += `<span class="contribution-count">first-pass (order-dependent) ${contributionRate} (${contribCountStr})</span>`;
      html += '</li>';
    }

    html += '</ul></details>';
    return html;
  }

  /**
   * Get CSS class for contribution rate color coding.
   *
   * @private
   * @param {number|undefined} rate - Contribution rate (0 to 1)
   * @returns {string} CSS class
   */
  #getContributionClass(rate) {
    if (typeof rate !== 'number') return 'contribution-unknown';
    if (rate >= 0.3) return 'contribution-major';
    if (rate >= 0.1) return 'contribution-moderate';
    if (rate >= 0.01) return 'contribution-minor';
    return 'contribution-negligible';
  }

  /**
   * Get tunability level string from near-miss rate.
   *
   * @private
   * @param {number} nearMissRate - Near-miss rate (0 to 1)
   * @returns {string} 'high', 'moderate', or 'low'
   */
  #getTunabilityLevel(nearMissRate) {
    if (nearMissRate > 0.1) return 'high';
    if (nearMissRate >= 0.02) return 'moderate';
    return 'low';
  }

  /**
   * Get icon for node type.
   *
   * @private
   * @param {string} nodeType - The node type ('and', 'or', or 'leaf')
   * @returns {string} The icon character to display
   */
  #getNodeIcon(nodeType) {
    switch (nodeType) {
      case 'and':
        return '∧';
      case 'or':
        return '∨';
      case 'leaf':
      default:
        return '●';
    }
  }

  /**
   * Get CSS class for failure rate color coding.
   *
   * @private
   * @param {number} failureRate - The failure rate from 0 to 1
   * @returns {string} The CSS class for color coding
   */
  #getFailureColor(failureRate) {
    if (failureRate >= 0.9) return 'failure-critical';
    if (failureRate >= 0.5) return 'failure-high';
    return 'failure-normal';
  }

  /**
   * Get CSS class for pass rate color coding (used for OR blocks).
   * Inverted color logic: high pass rate is good, low pass rate is bad.
   *
   * @private
   * @param {number} passRate - The pass rate from 0 to 1
   * @returns {string} The CSS class for color coding
   */
  #getPassRateColor(passRate) {
    if (passRate >= 0.7) return 'pass-good';
    if (passRate >= 0.3) return 'pass-moderate';
    return 'pass-low';
  }

  /**
   * Get CSS class for near-miss rate color coding.
   *
   * @private
   * @param {number|null} nearMissRate - The near-miss rate from 0 to 1, or null
   * @returns {string} The CSS class for near-miss color coding
   */
  #getNearMissClass(nearMissRate) {
    if (nearMissRate === null || nearMissRate === undefined) return 'near-miss-na';
    if (nearMissRate > 0.1) return 'near-miss-high';
    if (nearMissRate > 0.02) return 'near-miss-moderate';
    return 'near-miss-low';
  }

  /**
   * Get CSS class for last-mile decisive blocker highlighting.
   *
   * @private
   * @param {object} blocker - Blocker object with advancedAnalysis
   * @returns {string} The CSS class for decisive highlighting (empty if not decisive)
   */
  #getLastMileClass(blocker) {
    const analysis = blocker.advancedAnalysis?.lastMileAnalysis;
    if (analysis?.isDecisive) return 'decisive';
    return '';
  }

  /**
   * Render ceiling warning badge if ceiling is detected.
   *
   * @private
   * @param {object} blocker - Blocker object with advancedAnalysis and hierarchicalBreakdown
   * @returns {string} HTML string with ceiling warning, or empty string
   */
  #renderCeilingWarning(blocker) {
    const analysis = blocker.advancedAnalysis?.ceilingAnalysis;
    if (analysis?.status !== 'ceiling_detected') return '';

    const maxVal = this.#formatNumber(blocker.hierarchicalBreakdown?.maxObservedValue);
    return `<div class="ceiling-warning">Threshold unreachable (max: ${maxVal})</div>`;
  }

  #updateMcRarityIndicator(category) {
    if (!this.#mcRarityIndicator) return;

    // Use STATUS_INDICATORS from DiagnosticResult as single source of truth
    const indicators = DiagnosticResult.STATUS_INDICATORS;
    const indicator = indicators[category] || indicators.unknown;

    // CSS class uses hyphens instead of underscores
    const cssCategory = category.replace(/_/g, '-');
    this.#mcRarityIndicator.className = `rarity-indicator rarity-${cssCategory}`;

    const circleEl = this.#mcRarityIndicator.querySelector('.rarity-circle');
    const labelEl = this.#mcRarityIndicator.querySelector('.rarity-label');

    // Use CSS circle class instead of emoji text for consistent color rendering
    if (circleEl) {
      circleEl.className = `rarity-circle status-circle status-${cssCategory}`;
    }
    if (labelEl) labelEl.textContent = indicator.label;
  }

  #formatPercentage(value) {
    if (value === 0) return '0%';
    if (value < 0.0001) return '<0.01%';
    if (value < 0.01) return (value * 100).toFixed(3) + '%';
    return (value * 100).toFixed(2) + '%';
  }

  #formatRateWithCounts(rate, count = null, total = null) {
    if (
      rate === null ||
      rate === undefined ||
      typeof rate !== 'number' ||
      Number.isNaN(rate)
    ) {
      return 'N/A';
    }
    const pct = this.#formatPercentage(rate);
    if (Number.isFinite(count) && Number.isFinite(total) && total > 0) {
      return `${pct} (${count} / ${total})`;
    }
    return pct;
  }

  #formatGateClampMetrics(blocker) {
    const rate = blocker.gateClampRateInRegime ?? null;
    const failCount = blocker.gateFailInRegimeCount ?? null;
    const passCount = blocker.gatePassInRegimeCount ?? null;
    const total =
      Number.isFinite(failCount) && Number.isFinite(passCount)
        ? failCount + passCount
        : null;
    return this.#formatRateWithCounts(rate, failCount, total);
  }

  #formatPassGivenGateMetrics(blocker) {
    const rate = blocker.passRateGivenGateInRegime ?? null;
    const passCount = blocker.gatePassAndClausePassInRegimeCount ?? null;
    const total = blocker.gatePassInRegimeCount ?? null;
    return this.#formatRateWithCounts(rate, passCount, total);
  }

  #createRecommendationBadge(label) {
    const badge = document.createElement('span');
    badge.className = 'recommendation-badge';
    badge.textContent = label;
    return badge;
  }

  #formatImpact(impact) {
    if (typeof impact !== 'number') {
      return 'N/A';
    }
    return this.#formatSignedPercentagePoints(impact);
  }

  #formatSignedPercentagePoints(value) {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return 'N/A';
    }
    const points = value * 100;
    const sign = points > 0 ? '+' : points < 0 ? '-' : '';
    return `${sign}${Math.abs(points).toFixed(2)} pp`;
  }

  #buildRecommendationFunnel(prototypeFacts, impact) {
    if (!prototypeFacts) {
      return null;
    }
    const funnel = document.createElement('div');
    funnel.className = 'recommendation-funnel';

    const moodSampleCount =
      typeof prototypeFacts.moodSampleCount === 'number'
        ? prototypeFacts.moodSampleCount
        : null;
    const gateClampRate =
      typeof prototypeFacts.gateFailRate === 'number'
        ? prototypeFacts.gateFailRate
        : null;
    const passGivenGate =
      typeof prototypeFacts.pThreshGivenGate === 'number'
        ? prototypeFacts.pThreshGivenGate
        : null;
    const effectivePass =
      typeof prototypeFacts.pThreshEffective === 'number'
        ? prototypeFacts.pThreshEffective
        : null;

    const funnelItems = [
      `Mood N: ${
        moodSampleCount !== null ? this.#formatNumber(moodSampleCount) : 'N/A'
      }`,
      `Gate clamp: ${
        gateClampRate !== null ? this.#formatPercentage(gateClampRate) : 'N/A'
      }`,
      `Pass | gate: ${
        passGivenGate !== null ? this.#formatPercentage(passGivenGate) : 'N/A'
      }`,
      `Effective pass: ${
        effectivePass !== null ? this.#formatPercentage(effectivePass) : 'N/A'
      }`,
      `Impact (full sample): ${this.#formatImpact(impact)}`,
    ];

    for (const item of funnelItems) {
      const span = document.createElement('span');
      span.textContent = item;
      funnel.appendChild(span);
    }

    return funnel;
  }

  #buildRecommendationEvidenceList(evidenceItems) {
    if (!Array.isArray(evidenceItems) || evidenceItems.length === 0) {
      return null;
    }
    const list = document.createElement('ul');
    list.className = 'recommendation-evidence';
    for (const evidence of evidenceItems) {
      const item = document.createElement('li');
      item.textContent = this.#formatRecommendationEvidence(evidence);
      list.appendChild(item);
    }
    return list;
  }

  #formatRecommendationEvidence(evidence) {
    const label = evidence?.label ?? 'Evidence';
    const numerator =
      typeof evidence?.numerator === 'number' ? evidence.numerator : null;
    const denominator =
      typeof evidence?.denominator === 'number' ? evidence.denominator : null;
    const value =
      typeof evidence?.value === 'number' ? evidence.value : null;

    const valueLabel =
      typeof value === 'number' ? this.#formatEvidenceValue(value) : 'N/A';
    const populationLabel = this.#formatPopulationLabel(evidence?.population);

    if (
      numerator !== null &&
      denominator !== null &&
      Number.isFinite(denominator) &&
      denominator !== 0 &&
      denominator !== 1 &&
      Number.isFinite(numerator)
    ) {
      const base = `${label}: ${numerator} / ${denominator} (${valueLabel})`;
      return populationLabel ? `${base} | ${populationLabel}` : base;
    }

    if (numerator !== null && denominator === 1) {
      const base = `${label}: ${this.#formatNumber(numerator)}`;
      return populationLabel ? `${base} | ${populationLabel}` : base;
    }

    const base = `${label}: ${valueLabel}`;
    return populationLabel ? `${base} | ${populationLabel}` : base;
  }

  #formatEvidenceValue(value) {
    if (value >= 0 && value <= 1) {
      return this.#formatPercentage(value);
    }
    return this.#formatNumber(value);
  }

  #formatPopulationLabel(population) {
    if (!population || typeof population.name !== 'string') {
      return null;
    }
    if (!Number.isFinite(population.count)) {
      return null;
    }
    return `Population: ${population.name} (N=${this.#formatNumber(
      population.count
    )})`;
  }

  #buildRecommendationActionsList(actions) {
    if (!Array.isArray(actions) || actions.length === 0) {
      return null;
    }
    const list = document.createElement('ul');
    list.className = 'recommendation-actions';
    for (const action of actions) {
      if (!action) {
        continue;
      }
      const item = document.createElement('li');
      item.textContent = action;
      list.appendChild(item);
    }
    return list;
  }

  #buildRecommendationLinks(relatedClauseIds) {
    if (!Array.isArray(relatedClauseIds) || relatedClauseIds.length === 0) {
      return null;
    }
    const container = document.createElement('div');
    container.className = 'recommendation-links';
    for (const clauseId of relatedClauseIds) {
      if (!clauseId) {
        continue;
      }
      const link = document.createElement('a');
      link.href = `#${this.#formatClauseAnchorId(clauseId)}`;
      link.textContent = `Jump to ${clauseId}`;
      container.appendChild(link);
    }
    return container;
  }

  #formatClauseAnchorId(clauseId) {
    return `clause-${String(clauseId).replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  }

  #parseRecommendationId(recommendationId) {
    const parts = String(recommendationId ?? '').split(':');
    if (parts.length < 3) {
      return null;
    }
    return {
      prototypeId: parts[1],
      clauseId: parts.slice(2).join(':'),
    };
  }

  #buildClauseFailureLookup(clauseFailures) {
    const lookup = new Map();
    if (!Array.isArray(clauseFailures)) {
      return lookup;
    }

    for (const clause of clauseFailures) {
      if (clause?.clauseDescription) {
        lookup.set(clause.clauseDescription, clause);
      }
    }

    return lookup;
  }

  #buildChokeRankLookup(ablationImpact) {
    const lookup = new Map();
    const impacts = ablationImpact?.clauseImpacts ?? [];
    if (!Array.isArray(impacts)) {
      return lookup;
    }
    for (const impact of impacts) {
      if (impact?.clauseId && Number.isFinite(impact.chokeRank)) {
        lookup.set(impact.clauseId, impact.chokeRank);
      }
    }
    return lookup;
  }

  #resolveChokeRankForBlocker(clauseFailure, chokeRankLookup) {
    if (!clauseFailure?.hierarchicalBreakdown || chokeRankLookup.size === 0) {
      return '—';
    }
    const clauseIds = [];
    this.#collectClauseIdsFromBreakdown(
      clauseFailure.hierarchicalBreakdown,
      clauseIds
    );
    const ranks = clauseIds
      .map((clauseId) => chokeRankLookup.get(clauseId))
      .filter((rank) => Number.isFinite(rank))
      .sort((a, b) => a - b);
    return ranks.length > 0 ? String(ranks[0]) : '—';
  }

  #resolveClauseAnchorId(clauseFailure) {
    if (!clauseFailure?.hierarchicalBreakdown) {
      return '';
    }
    const clauseIds = [];
    this.#collectClauseIdsFromBreakdown(
      clauseFailure.hierarchicalBreakdown,
      clauseIds
    );
    if (clauseIds.length === 0) {
      return '';
    }
    return this.#formatClauseAnchorId(clauseIds[0]);
  }

  #collectClauseIdsFromBreakdown(node, clauseIds) {
    if (!node) {
      return;
    }
    if (node.nodeType === 'leaf' && node.clauseId) {
      clauseIds.push(node.clauseId);
    }
    for (const child of node.children ?? []) {
      this.#collectClauseIdsFromBreakdown(child, clauseIds);
    }
  }

  #getMoodRegimeContextsForGateBreakdown(storedContexts, moodConstraints) {
    if (!Array.isArray(storedContexts) || storedContexts.length === 0) {
      return null;
    }

    if (!Array.isArray(moodConstraints) || moodConstraints.length === 0) {
      return storedContexts;
    }

    return this.#filterContextsByMoodConstraintsUI(
      storedContexts,
      moodConstraints
    );
  }

  #getGateClassificationThresholds() {
    const thresholds = advancedMetricsConfig?.gateClassificationThresholds;
    return {
      gateClampRateHigh:
        typeof thresholds?.gateClampRateHigh === 'number'
          ? thresholds.gateClampRateHigh
          : 0.5,
      passGivenGateLow:
        typeof thresholds?.passGivenGateLow === 'number'
          ? thresholds.passGivenGateLow
          : 0.2,
    };
  }

  #buildGateClassificationBadge(blocker) {
    const gateClampRate = blocker.gateClampRateInRegime;
    const passGivenGateRate = blocker.passRateGivenGateInRegime;

    if (
      !Number.isFinite(gateClampRate) &&
      !Number.isFinite(passGivenGateRate)
    ) {
      return '<span class="classification-badge classification-na">N/A</span>';
    }

    const thresholds = this.#getGateClassificationThresholds();
    const gateMismatch =
      Number.isFinite(gateClampRate) &&
      gateClampRate >= thresholds.gateClampRateHigh;
    const thresholdTooHigh =
      Number.isFinite(passGivenGateRate) &&
      passGivenGateRate <= thresholds.passGivenGateLow;

    let label = 'Balanced';
    let className = 'classification-balanced';

    if (gateMismatch && thresholdTooHigh) {
      label = 'Both';
      className = 'classification-both';
    } else if (gateMismatch) {
      label = 'Gate mismatch';
      className = 'classification-gate';
    } else if (thresholdTooHigh) {
      label = 'Threshold too high';
      className = 'classification-threshold';
    }

    const tooltip = [
      `Heuristic: Gate mismatch if Gate clamp (mood) \u2265 ${this.#formatPercentage(thresholds.gateClampRateHigh)}.`,
      `Threshold too high if Pass | gate (mood) \u2264 ${this.#formatPercentage(thresholds.passGivenGateLow)}.`,
      'Gate clamp uses mood-regime samples; Pass | gate uses gate-pass samples within mood-regime.',
    ].join(' ');

    return `<span class="classification-badge ${className}" title="${this.#escapeHtml(tooltip)}">${label}</span>`;
  }

  #buildGateBreakdownPanel(clauseFailure, regimeContexts) {
    if (!clauseFailure || !Array.isArray(regimeContexts) || regimeContexts.length === 0) {
      return '';
    }

    const variablePath = this.#resolveVariablePathFromClause(clauseFailure);
    const gateTarget = this.#resolveGateTargetForUi(variablePath);
    if (!gateTarget) {
      return '';
    }

    const prototype = this.#getGatePrototype(gateTarget.prototypeId);
    const gates = Array.isArray(prototype?.gates) ? prototype.gates : [];
    if (gates.length === 0) {
      return '';
    }

    const failureRates = this.#computeGateFailureRatesForUi(
      gates,
      regimeContexts,
      gateTarget.usePrevious
    );

    if (failureRates.length === 0) {
      return '';
    }

    const rows = failureRates
      .map((entry) => `
        <tr>
          <td><code>${this.#escapeHtml(entry.gate)}</code></td>
          <td>${this.#formatRateWithCounts(entry.failRate, entry.failCount, entry.total)}</td>
        </tr>
      `)
      .join('');

    return `
      <details class="gate-breakdown">
        <summary>Gate breakdown (mood-regime)</summary>
        <div class="gate-breakdown-meta">Denominator: ${regimeContexts.length} mood-regime samples.</div>
        <table class="results-table gate-breakdown-table">
          <thead>
            <tr>
              <th>Gate</th>
              <th title="Gate failure rate within mood-regime samples.">Fail rate (mood)</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </details>
    `;
  }

  #resolveVariablePathFromClause(clauseFailure) {
    const variablePath = clauseFailure?.hierarchicalBreakdown?.variablePath
      ?? clauseFailure?.variablePath;
    if (typeof variablePath === 'string') {
      return variablePath;
    }

    const description = clauseFailure?.clauseDescription ?? '';
    const match = description.match(/^(previousEmotions|emotions)\.\w+/);
    return match ? match[0] : null;
  }

  #resolveGateTargetForUi(variablePath) {
    if (!variablePath || typeof variablePath !== 'string') {
      return null;
    }

    if (variablePath.startsWith('emotions.')) {
      return {
        prototypeId: variablePath.slice('emotions.'.length),
        usePrevious: false,
      };
    }

    if (variablePath.startsWith('previousEmotions.')) {
      return {
        prototypeId: variablePath.slice('previousEmotions.'.length),
        usePrevious: true,
      };
    }

    return null;
  }

  #getGatePrototype(prototypeId) {
    const lookup = this.#dataRegistry?.getLookupData('core:emotion_prototypes');
    return lookup?.entries?.[prototypeId] ?? null;
  }

  #normalizeGateContextForUi(context, usePrevious) {
    const moodSource = usePrevious
      ? context?.previousMoodAxes
      : context?.moodAxes ?? context?.mood ?? {};
    const sexualSource = usePrevious
      ? context?.previousSexualAxes
      : context?.sexualAxes ?? context?.sexual ?? null;
    const sexualArousalSource = usePrevious
      ? context?.previousSexualArousal ?? null
      : context?.sexualArousal ?? null;

    const moodAxes = normalizeMoodAxes(moodSource);
    const sexualAxes = normalizeSexualAxes(sexualSource, sexualArousalSource);
    const traitAxes = normalizeAffectTraits(context?.affectTraits);

    return { moodAxes, sexualAxes, traitAxes };
  }

  #computeGateFailureRatesForUi(gates, contexts, usePrevious) {
    if (!Array.isArray(gates) || gates.length === 0) {
      return [];
    }
    if (!Array.isArray(contexts) || contexts.length === 0) {
      return [];
    }

    const parsedGates = gates
      .map((gate) => {
        try {
          return { gate, constraint: GateConstraint.parse(gate) };
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    if (parsedGates.length === 0) {
      return [];
    }

    const stats = new Map(
      parsedGates.map(({ gate }) => [gate, { failCount: 0 }])
    );

    for (const context of contexts) {
      const normalized = this.#normalizeGateContextForUi(context, usePrevious);
      for (const { gate, constraint } of parsedGates) {
        const axisValue = resolveAxisValue(
          constraint.axis,
          normalized.moodAxes,
          normalized.sexualAxes,
          normalized.traitAxes
        );
        if (!constraint.isSatisfiedBy(axisValue)) {
          const entry = stats.get(gate);
          if (entry) {
            entry.failCount += 1;
          }
        }
      }
    }

    return parsedGates.map(({ gate }) => {
      const entry = stats.get(gate);
      const failCount = entry?.failCount ?? 0;
      const total = contexts.length;
      return {
        gate,
        failCount,
        total,
        failRate: total > 0 ? failCount / total : null,
      };
    });
  }

  #formatCoverageValue(value) {
    if (!Number.isFinite(value)) {
      return '—';
    }
    return this.#formatPercentage(value);
  }

  #getLowestCoverageVariables(variables, limit) {
    if (!Array.isArray(variables) || variables.length === 0) {
      return [];
    }

    const ratingRank = {
      poor: 0,
      partial: 1,
      good: 2,
    };

    return [...variables]
      .filter((variable) => variable && variable.rating)
      .sort((a, b) => {
        const ratingDelta = (ratingRank[a.rating] ?? 3) - (ratingRank[b.rating] ?? 3);
        if (ratingDelta !== 0) {
          return ratingDelta;
        }
        const aScore =
          (Number.isFinite(a.rangeCoverage) ? a.rangeCoverage : 1) +
          (Number.isFinite(a.binCoverage) ? a.binCoverage : 1);
        const bScore =
          (Number.isFinite(b.rangeCoverage) ? b.rangeCoverage : 1) +
          (Number.isFinite(b.binCoverage) ? b.binCoverage : 1);
        return aScore - bScore;
      })
      .slice(0, limit);
  }

  #buildSamplingCoverageSummary(summaryByDomain, samplingMode) {
    if (!Array.isArray(summaryByDomain) || summaryByDomain.length === 0) {
      return samplingMode ? `Coverage (${samplingMode}): unknown` : 'Coverage: unknown';
    }

    const ratingRank = {
      poor: 0,
      partial: 1,
      good: 2,
    };

    const worstRating = summaryByDomain.reduce((current, summary) => {
      if (!summary?.rating) {
        return current;
      }
      if (!current) {
        return summary.rating;
      }
      return ratingRank[summary.rating] < ratingRank[current]
        ? summary.rating
        : current;
    }, null);

    const modeLabel = samplingMode ? ` (${samplingMode})` : '';
    const poorDomains = summaryByDomain
      .filter((summary) => summary.rating === 'poor')
      .map((summary) => summary.domain);

    if (poorDomains.length > 0) {
      return `Coverage${modeLabel}: ${worstRating} (low coverage in ${poorDomains.join(', ')})`;
    }

    return `Coverage${modeLabel}: ${worstRating}`;
  }

  #buildSamplingCoverageSummaryTable(summaryByDomain) {
    const container = document.createElement('div');
    const header = document.createElement('h4');
    header.textContent = 'Summary by Domain';
    container.appendChild(header);

    const table = document.createElement('table');
    table.className = 'results-table';
    table.innerHTML = `
      <thead>
        <tr>
          <th>Domain</th>
          <th>Variables</th>
          <th>Range Coverage</th>
          <th>Bin Coverage</th>
          <th>Tail Low</th>
          <th>Tail High</th>
          <th>Zero Rate Avg</th>
          <th>Rating</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;

    const tbody = table.querySelector('tbody');
    for (const summary of summaryByDomain) {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${this.#escapeHtml(summary.domain ?? '')}</td>
        <td>${summary.variableCount ?? 0}</td>
        <td>${this.#formatCoverageValue(summary.rangeCoverageAvg)}</td>
        <td>${this.#formatCoverageValue(summary.binCoverageAvg)}</td>
        <td>${this.#formatCoverageValue(summary.tailCoverageAvg?.low)}</td>
        <td>${this.#formatCoverageValue(summary.tailCoverageAvg?.high)}</td>
        <td>${this.#formatCoverageValue(summary.zeroRateAvg)}</td>
        <td>${this.#escapeHtml(summary.rating ?? '')}</td>
      `;
      tbody.appendChild(row);
    }

    container.appendChild(table);
    return container;
  }

  #buildSamplingCoverageLowestTable(variables) {
    const container = document.createElement('div');
    const header = document.createElement('h4');
    header.textContent = 'Lowest Coverage';
    container.appendChild(header);

    const table = document.createElement('table');
    table.className = 'results-table';
    table.innerHTML = `
      <thead>
        <tr>
          <th>Variable</th>
          <th>Range Coverage</th>
          <th>Bin Coverage</th>
          <th>Tail Low</th>
          <th>Tail High</th>
          <th>Rating</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;

    const tbody = table.querySelector('tbody');
    for (const variable of variables) {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td><code>${this.#escapeHtml(variable.variablePath ?? '')}</code></td>
        <td>${this.#formatCoverageValue(variable.rangeCoverage)}</td>
        <td>${this.#formatCoverageValue(variable.binCoverage)}</td>
        <td>${this.#formatCoverageValue(variable.tailCoverage?.low)}</td>
        <td>${this.#formatCoverageValue(variable.tailCoverage?.high)}</td>
        <td>${this.#escapeHtml(variable.rating ?? '')}</td>
      `;
      tbody.appendChild(row);
    }

    container.appendChild(table);
    return container;
  }

  #escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Format a numeric value for display with 2 decimal places.
   *
   * @private
   * @param {number|null|undefined} value - The value to format
   * @returns {string} Formatted string or 'N/A'
   */
  #formatNumber(value) {
    if (value === null || value === undefined) return 'N/A';
    return value.toFixed(2);
  }

  #formatThresholdValue(value, isIntegerDomain) {
    if (value === null || value === undefined || typeof value !== 'number' || isNaN(value)) {
      return 'N/A';
    }

    if (isIntegerDomain) {
      const rounded = Math.round(value);
      if (Math.abs(value - rounded) < 0.000001) {
        return String(rounded);
      }
    }

    return value.toFixed(2);
  }

  #formatEffectiveThreshold(value) {
    if (value === null || value === undefined || typeof value !== 'number' || isNaN(value)) {
      return '—';
    }
    return String(Math.round(value));
  }

  /**
   * Format percentiles display for tree nodes.
   * Shows P50, P90, P95, P99 with outlier skew detection.
   *
   * @private
   * @param {object} node - Tree node with violation percentile data
   * @returns {string} HTML span with percentiles or empty string
   */
  #formatPercentilesDisplay(node) {
    const p50 = node.violationP50;
    const p90 = node.violationP90;
    const p95 = node.violationP95;
    const p99 = node.violationP99;

    if (p50 === null || p50 === undefined) {
      return '';
    }

    // Detect outlier skew: when P99 >> P50, there are severe tail violations
    const hasOutlierSkew = p99 !== null && p50 > 0 && p99 / p50 > 3;
    const outlierFlag = hasOutlierSkew ? ' <span class="outlier-skew-flag">[OUTLIERS]</span>' : '';

    // Build percentile string
    let parts = [`p50: ${this.#formatNumber(p50)}`];
    if (p90 !== null && p90 !== undefined) {
      parts.push(`p90: ${this.#formatNumber(p90)}`);
    }
    if (p95 !== null && p95 !== undefined) {
      parts.push(`p95: ${this.#formatNumber(p95)}`);
    }
    if (p99 !== null && p99 !== undefined) {
      parts.push(`p99: ${this.#formatNumber(p99)}`);
    }

    return ` <span class="tree-percentiles">${parts.join(' | ')}${outlierFlag}</span>`;
  }

  /**
   * Format percentiles for breakdown nodes in the blockers table.
   * Similar to #formatPercentilesDisplay but for breakdown context.
   *
   * @private
   * @param {object} breakdown - Breakdown node with violation percentile data
   * @returns {string} HTML div with percentiles or empty string
   */
  #formatBreakdownPercentiles(breakdown) {
    const p50 = breakdown.violationP50;
    const p90 = breakdown.violationP90;
    const p95 = breakdown.violationP95;
    const p99 = breakdown.violationP99;

    if (p50 === null || p50 === undefined) {
      return '';
    }

    // Detect outlier skew
    const hasOutlierSkew = p99 !== null && p50 > 0 && p99 / p50 > 3;
    const outlierFlag = hasOutlierSkew ? ' <span class="outlier-skew-flag">[OUTLIERS]</span>' : '';

    // Build percentile parts
    let parts = [`p50: ${this.#formatNumber(p50)}`];
    if (p90 !== null && p90 !== undefined) {
      parts.push(`p90: ${this.#formatNumber(p90)}`);
    }
    if (p95 !== null && p95 !== undefined) {
      parts.push(`p95: ${this.#formatNumber(p95)}`);
    }
    if (p99 !== null && p99 !== undefined) {
      parts.push(`p99: ${this.#formatNumber(p99)}`);
    }

    return `<div class="violation-percentiles">${parts.join(' | ')}${outlierFlag}</div>`;
  }

  /**
   * Format violation statistics including percentiles and near-miss rate.
   * For compound nodes, aggregates statistics from leaf children.
   *
   * @private
   * @param {object} blocker - Blocker object with hierarchicalBreakdown
   * @returns {string} HTML string with violation stats
   */
  #formatViolationStats(blocker) {
    const breakdown = blocker.hierarchicalBreakdown;
    if (!breakdown) {
      return `<div class="violation-mean">\u03BC: ${this.#formatNumber(blocker.averageViolation)}</div>`;
    }

    // For compound nodes, show aggregated stats from leaves
    if (breakdown.isCompound) {
      return this.#formatCompoundViolationStats(breakdown, blocker);
    }

    // Leaf node: show standard stats
    let html = `<div class="violation-mean">\u03BC: ${this.#formatNumber(breakdown.averageViolation)}</div>`;

    // Show extended percentiles with outlier detection
    html += this.#formatBreakdownPercentiles(breakdown);

    if (breakdown.nearMissRate !== null && breakdown.nearMissRate !== undefined) {
      const nearMissClass = this.#getNearMissClass(breakdown.nearMissRate);
      html += `<div class="near-miss ${nearMissClass}">near-miss(\u03B5=${this.#formatNumber(breakdown.nearMissEpsilon)}): ${this.#formatPercentage(breakdown.nearMissRate)}</div>`;
    }

    // Add ceiling warning if detected
    html += this.#renderCeilingWarning(blocker);

    return html;
  }

  /**
   * Format violation statistics for compound nodes by aggregating leaf stats.
   *
   * @private
   * @param {object} breakdown - Hierarchical breakdown node (compound)
   * @param {object} blocker - Full blocker object
   * @returns {string} HTML string with aggregated violation stats
   */
  #formatCompoundViolationStats(breakdown, blocker) {
    const aggregated = this.#aggregateLeafStatsForDisplay(breakdown);

    let html = '';

    // Show worst violation from leaf conditions
    if (aggregated.worstViolation > 0) {
      html += `<div class="violation-mean">worst \u0394: ${this.#formatNumber(aggregated.worstViolation)} (${this.#escapeHtml(aggregated.worstDescription)})</div>`;
    } else {
      html += `<div class="violation-mean">\u03BC: ${this.#formatNumber(breakdown.averageViolation ?? 0)}</div>`;
    }

    // Show most tunable leaf's near-miss rate
    if (aggregated.tunableRate !== null && aggregated.tunableRate > 0) {
      const nearMissClass = this.#getNearMissClass(aggregated.tunableRate);
      html += `<div class="near-miss ${nearMissClass}">most tunable: ${this.#escapeHtml(aggregated.tunableDescription)} (${this.#formatPercentage(aggregated.tunableRate)})</div>`;
    }

    // Add ceiling warning if detected
    html += this.#renderCeilingWarning(blocker);

    return html;
  }

  #buildBlockerRegimeDetails(blocker) {
    const breakdown = blocker.hierarchicalBreakdown;
    if (!breakdown) return '';

    const inRegimeRate = breakdown.inRegimeFailureRate;
    const failGlobal = this.#formatPercentage(blocker.failureRate);
    const failRegime =
      typeof inRegimeRate === 'number'
        ? this.#formatPercentage(inRegimeRate)
        : 'N/A';
    const redundancyLabel = this.#formatRegimeRedundancy(
      breakdown.redundantInRegime
    );
    const achievableRange = this.#formatAchievableRange(breakdown);
    const statusInfo = this.#getAchievableStatusInfo(breakdown);
    const statusLabel = statusInfo?.label ?? 'N/A';
    const statusClass = statusInfo?.className ?? 'feasibility-unknown';
    const tuningDirection = this.#formatTuningDirection(
      breakdown.tuningDirection
    );

    return `
      <div class="blocker-regime-details">
        <div class="regime-detail">
          <span class="detail-label">Fail% global:</span>
          <span class="detail-value">${failGlobal}</span>
        </div>
        <div class="regime-detail">
          <span class="detail-label">Fail% | mood-pass:</span>
          <span class="detail-value">${failRegime}</span>
        </div>
        <div class="regime-detail">
          <span class="detail-label">Redundant in regime:</span>
          <span class="detail-value">${redundancyLabel}</span>
        </div>
        <div class="regime-detail">
          <span class="detail-label">Achievable range (mood-pass):</span>
          <span class="detail-value">${achievableRange}</span>
        </div>
        <div class="regime-detail">
          <span class="detail-label">Feasibility status:</span>
          <span class="detail-value">
            <span class="feasibility-badge ${statusClass}">${statusLabel}</span>
          </span>
        </div>
        <div class="regime-detail">
          <span class="detail-label">Tuning direction:</span>
          <span class="detail-value">${tuningDirection}</span>
        </div>
      </div>
    `;
  }

  #formatRegimeRedundancy(redundantInRegime) {
    if (typeof redundantInRegime !== 'boolean') {
      return 'N/A';
    }

    return redundantInRegime ? 'Yes' : 'No';
  }

  #formatAchievableRange(breakdown) {
    const min = breakdown.inRegimeMinObservedValue;
    const max = breakdown.inRegimeMaxObservedValue;
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      return 'N/A';
    }

    return `[${this.#formatNumber(min)}, ${this.#formatNumber(max)}]`;
  }

  #getAchievableStatusInfo(breakdown) {
    const operator = breakdown.comparisonOperator;
    const threshold = breakdown.thresholdValue;
    const min = breakdown.inRegimeMinObservedValue;
    const max = breakdown.inRegimeMaxObservedValue;

    if (
      !operator ||
      typeof threshold !== 'number' ||
      !Number.isFinite(min) ||
      !Number.isFinite(max)
    ) {
      return null;
    }

    let label = 'sometimes';
    let className = 'feasibility-sometimes';

    if (operator === '>=' || operator === '>') {
      if (min >= threshold || (operator === '>' && min > threshold)) {
        label = 'always';
        className = 'feasibility-always';
      } else if (max < threshold || (operator === '>' && max <= threshold)) {
        label = 'impossible';
        className = 'feasibility-impossible';
      }
    } else if (operator === '<=' || operator === '<') {
      if (max <= threshold || (operator === '<' && max < threshold)) {
        label = 'always';
        className = 'feasibility-always';
      } else if (min > threshold || (operator === '<' && min >= threshold)) {
        label = 'impossible';
        className = 'feasibility-impossible';
      }
    }

    return { label, className };
  }

  #formatTuningDirection(tuningDirection) {
    if (!tuningDirection) {
      return 'N/A';
    }

    const loosen = tuningDirection.loosen?.replace('_', ' ') ?? 'N/A';
    const tighten = tuningDirection.tighten?.replace('_', ' ') ?? 'N/A';
    return `loosen: ${this.#escapeHtml(loosen)}, tighten: ${this.#escapeHtml(
      tighten
    )}`;
  }

  /**
   * Aggregate statistics from leaf nodes of a compound breakdown for display.
   *
   * Uses impact-weighted scoring (nearMissRate × lastMileRate) to select the
   * most tunable condition, consistent with MonteCarloReportGenerator.
   *
   * @private
   * @param {object} breakdown - Hierarchical breakdown node
   * @returns {{worstViolation: number, worstDescription: string, tunableRate: number|null, tunableDescription: string, tunableEpsilon: number, tunableImpact: number|null}}
   */
  #aggregateLeafStatsForDisplay(breakdown) {
    const leaves = this.#flattenLeavesForDisplay(breakdown);

    let worstViolation = 0;
    let worstDescription = '';
    let tunableRate = null;
    let tunableDescription = '';
    let tunableEpsilon = 0;
    let tunableImpact = null;

    for (const leaf of leaves) {
      const avgViol = leaf.averageViolation ?? 0;
      const nearMissRate = leaf.nearMissRate;

      // Track worst violator
      if (avgViol > worstViolation) {
        worstViolation = avgViol;
        worstDescription = leaf.description ?? 'Unknown condition';
      }

      // Track most tunable (weighted by last-mile impact - consistent with report)
      if (typeof nearMissRate === 'number' && nearMissRate > 0) {
        // Weight tunability by last-mile impact (consistent with MonteCarloReportGenerator)
        const lastMileRate =
          leaf.siblingConditionedFailRate ??
          leaf.lastMileFailRate ??
          leaf.failureRate ??
          0;
        const impactScore = nearMissRate * lastMileRate;

        if (tunableImpact === null || impactScore > tunableImpact) {
          tunableRate = nearMissRate;
          tunableDescription = leaf.description ?? 'Unknown condition';
          tunableEpsilon = leaf.nearMissEpsilon ?? 0;
          tunableImpact = impactScore;
        }
      }
    }

    return {
      worstViolation,
      worstDescription,
      tunableRate,
      tunableDescription,
      tunableEpsilon,
      tunableImpact,
    };
  }

  /**
   * Flatten a hierarchical breakdown tree to get all leaf nodes.
   *
   * @private
   * @param {object} node - Hierarchical breakdown node
   * @param {object[]} [results=[]] - Accumulator for results
   * @returns {object[]} Array of leaf nodes
   */
  #flattenLeavesForDisplay(node, results = []) {
    if (!node) return results;

    // If this is a leaf node, add it to results
    if (node.nodeType === 'leaf' || !node.isCompound) {
      results.push(node);
    }

    // Recurse into children for compound nodes
    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        this.#flattenLeavesForDisplay(child, results);
      }
    }

    return results;
  }

  /**
   * Format last-mile failure rate statistics.
   *
   * @private
   * @param {object} blocker - Blocker object with failureRate and hierarchicalBreakdown
   * @returns {string} HTML string with last-mile stats
   */
  #formatLastMile(blocker) {
    const breakdown = blocker.hierarchicalBreakdown;
    const failureRate = blocker.failureRate;

    if (breakdown?.isSingleClause) {
      return `<div class="last-mile-single">${this.#formatPercentage(failureRate)}</div>`;
    }

    const lastMileRate = breakdown?.lastMileFailRate ?? blocker.lastMileFailRate;
    if (lastMileRate === null || lastMileRate === undefined) {
      return '<div class="last-mile-na">N/A</div>';
    }

    const decisiveClass = this.#getLastMileClass(blocker);
    return `
      <div class="last-mile-overall">fail_all: ${this.#formatPercentage(failureRate)}</div>
      <div class="last-mile-decisive ${decisiveClass}">fail_when_others_pass: ${this.#formatPercentage(lastMileRate)}</div>
    `;
  }

  /**
   * Format recommendation from advanced analysis.
   *
   * @private
   * @param {object} blocker - Blocker object with advancedAnalysis
   * @returns {string} HTML string with recommendation
   */
  #formatRecommendation(blocker) {
    const analysis = blocker.advancedAnalysis;
    if (!analysis?.recommendation) {
      return '';
    }

    const { action, priority, message } = analysis.recommendation;
    return `
      <div class="recommendation-action" data-action="${action}" data-priority="${priority}">
        ${this.#escapeHtml(message)}
      </div>
    `;
  }

  /**
   * Load and display the problematic expressions panel.
   * Fetches all expression statuses from the server and renders
   * problematic ones as clickable pills.
   *
   * @private
   */
  async #loadProblematicExpressionsPanel() {
    if (!this.#problematicPillsContainer) {
      this.#logger.warn('Problematic pills container not found in DOM');
      return;
    }

    try {
      this.#problematicPillsContainer.classList.add('loading');
      const scanResult = await this.#expressionStatusService.scanAllStatuses();
      if (scanResult.success) {
        this.#expressionStatuses = scanResult.expressions || [];
        this.#clearProblematicError();
      } else {
        this.#logger.warn('ExpressionStatusService: Scan failed', scanResult);
        this.#showProblematicError({
          errorType: scanResult.errorType,
          message: scanResult.message,
          context: 'scan',
        });
        this.#expressionStatuses = [];
      }

      // Fallback: if scan returns empty (timeout/error), use registry with unknown status
      if (this.#expressionStatuses.length === 0) {
        this.#logger.warn(
          'ExpressionStatusService: Scan returned empty, using registry fallback'
        );
        const allExpressions = this.#expressionRegistry.getAllExpressions();
        this.#expressionStatuses = allExpressions.map((expr) => ({
          id: expr.id,
          filePath: null, // Will use fallback path construction when persisting
          diagnosticStatus: 'unknown',
        }));
      }

      const problematic = this.#expressionStatusService.getProblematicExpressions(
        this.#expressionStatuses,
        10
      );

      this.#renderProblematicPills(problematic);

      // Render low trigger rate expressions section
      const lowTriggerRate = this.#expressionStatusService.getLowTriggerRateExpressions(
        this.#expressionStatuses,
        10
      );
      this.#renderLowTriggerRatePills(lowTriggerRate);

      // Update dropdown option statuses now that we have the data
      this.#updateDropdownStatuses();
    } catch (error) {
      this.#logger.error('Failed to load problematic expressions:', error);
      this.#showProblematicError({
        errorType: 'unknown',
        message: 'Failed to load expression statuses.',
        context: 'scan',
      });
      this.#problematicPillsContainer.innerHTML =
        '<p class="placeholder-text">Failed to load expression statuses.</p>';
    } finally {
      this.#problematicPillsContainer.classList.remove('loading');
    }
  }

  /**
   * Refresh problematic pills panel using the in-memory cache.
   * Used after persisting status to avoid race condition where scanAllStatuses()
   * might return stale data before the server has finished writing the file.
   *
   * @private
   */
  #refreshProblematicPillsFromCache() {
    // Note: Guard clause for missing container is unnecessary here because:
    // 1. This method is only called from #persistExpressionStatus()
    // 2. #persistExpressionStatus() requires #expressionStatuses to be populated
    // 3. #expressionStatuses is only populated if container existed during init
    // 4. If container existed during init, #problematicPillsContainer is set for controller lifetime
    // Therefore, if this method is reached, container is guaranteed to exist.
    const problematic = this.#expressionStatusService.getProblematicExpressions(
      this.#expressionStatuses,
      10
    );
    this.#renderProblematicPills(problematic);

    // Also refresh low trigger rate expressions
    const lowTriggerRate = this.#expressionStatusService.getLowTriggerRateExpressions(
      this.#expressionStatuses,
      10
    );
    this.#renderLowTriggerRatePills(lowTriggerRate);
  }

  /**
   * Render problematic expressions as clickable pill badges.
   *
   * @private
   * @param {Array<{id: string, filePath: string, diagnosticStatus: string}>} problematicExpressions
   */
  #renderProblematicPills(problematicExpressions) {
    if (!this.#problematicPillsContainer) return;

    this.#problematicPillsContainer.innerHTML = '';

    const selectableExpressions = this.#statusSelectDropdown
      ? problematicExpressions.filter((expr) =>
          this.#hasExpressionOption(expr.id)
        )
      : problematicExpressions;

    if (selectableExpressions.length === 0) {
      this.#problematicPillsContainer.innerHTML =
        '<p class="no-problems">All expressions have normal or frequent status.</p>';
      return;
    }

    for (const expr of selectableExpressions) {
      const pill = document.createElement('button');
      pill.className = 'expression-pill';
      pill.type = 'button';
      pill.setAttribute('aria-label', `Select expression ${expr.id}`);
      
      // Extract just the expression name (last segment after colon)
      const displayName = this.#getExpressionName(expr.id) || expr.id;
      
      // Status circle color class
      const statusClass = getStatusCircleCssClass(expr.diagnosticStatus, this.#logger);
      
      pill.innerHTML = `
        <span class="status-circle ${statusClass}"></span>
        <span class="pill-name" title="${expr.id}">${displayName}</span>
      `;
      
      // Click handler to select this expression in the dropdown
      pill.addEventListener('click', () => {
        this.#selectExpressionById(expr.id);
      });
      
      this.#problematicPillsContainer.appendChild(pill);
    }
  }

  /**
   * Render pills for expressions with low trigger rates.
   * Shows expressions sorted by trigger rate (lowest first) with percentage badges.
   * @param {Array<{id: string, diagnosticStatus: string|null, triggerRate: number|null}>} lowTriggerRateExpressions
   */
  #renderLowTriggerRatePills(lowTriggerRateExpressions) {
    if (!this.#lowTriggerRatePillsContainer) return;

    this.#lowTriggerRatePillsContainer.innerHTML = '';

    const selectableExpressions = this.#statusSelectDropdown
      ? lowTriggerRateExpressions.filter((expr) =>
          this.#hasExpressionOption(expr.id)
        )
      : lowTriggerRateExpressions;

    if (selectableExpressions.length === 0) {
      this.#lowTriggerRatePillsContainer.innerHTML =
        '<p class="no-data-message">No trigger rate data available. Run Monte Carlo analysis first.</p>';
      return;
    }

    for (const expr of selectableExpressions) {
      const pill = document.createElement('button');
      pill.className = 'expression-pill';
      pill.type = 'button';
      pill.setAttribute('aria-label', `Select expression ${expr.id}`);

      // Extract just the expression name (last segment after colon)
      const displayName = this.#getExpressionName(expr.id) || expr.id;

      // Status circle color class
      const statusClass = getStatusCircleCssClass(expr.diagnosticStatus, this.#logger);

      // Format trigger rate as percentage
      const triggerRatePercent = this.#expressionStatusService.formatTriggerRatePercent(
        expr.triggerRate
      );

      // Determine badge CSS class from status (convert to kebab-case)
      const statusBadgeClass = expr.diagnosticStatus
        ? `status-${expr.diagnosticStatus.replace(/_/g, '-')}`
        : '';

      pill.innerHTML = `
        <span class="status-circle ${statusClass}"></span>
        <span class="pill-name" title="${expr.id}">${displayName}</span>
        <span class="trigger-rate-badge ${statusBadgeClass}">${triggerRatePercent}</span>
      `;

      // Click handler to select this expression in the dropdown
      pill.addEventListener('click', () => {
        this.#selectExpressionById(expr.id);
      });

      this.#lowTriggerRatePillsContainer.appendChild(pill);
    }
  }

  #ensureProblematicErrorBanner() {
    if (this.#problematicErrorBanner) {
      return this.#problematicErrorBanner;
    }

    if (!this.#problematicPillsContainer) {
      return null;
    }

    let banner = document.getElementById('expression-diagnostics-error-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'expression-diagnostics-error-banner';
      banner.className = 'diagnostics-error-banner';
      banner.setAttribute('role', 'status');
      banner.setAttribute('aria-live', 'polite');
      banner.hidden = true;

      const title = document.createElement('div');
      title.className = 'diagnostics-error-title';

      const message = document.createElement('div');
      message.className = 'diagnostics-error-message';

      const guidance = document.createElement('div');
      guidance.className = 'diagnostics-error-guidance';

      banner.append(title, message, guidance);
      this.#problematicPillsContainer.parentElement?.insertBefore(
        banner,
        this.#problematicPillsContainer
      );
    }

    this.#problematicErrorBanner = banner;
    this.#problematicErrorTitle = banner.querySelector(
      '.diagnostics-error-title'
    );
    this.#problematicErrorMessage = banner.querySelector(
      '.diagnostics-error-message'
    );
    this.#problematicErrorGuidance = banner.querySelector(
      '.diagnostics-error-guidance'
    );

    return banner;
  }

  #getGuidanceForErrorType(errorType) {
    switch (errorType) {
      case 'connection_refused':
        return 'Start the LLM proxy server and confirm it is running at the configured URL.';
      case 'cors_blocked':
        return 'Check PROXY_ALLOWED_ORIGIN and ensure the client origin is allowed.';
      case 'timeout':
        return 'Check server logs and retry once the proxy is responsive.';
      case 'server_error':
        return 'Inspect server logs for the underlying error.';
      case 'validation_error':
        return 'Verify the request data and server version match expected schema.';
      case 'unknown':
      default:
        return 'Review the browser console and server logs for more details.';
    }
  }

  #showProblematicError({ errorType, message, context }) {
    const banner = this.#ensureProblematicErrorBanner();
    if (!banner) return;

    const title =
      context === 'update'
        ? 'Expression status update failed'
        : 'Expression status scan failed';

    if (this.#problematicErrorTitle) {
      this.#problematicErrorTitle.textContent = title;
    }
    if (this.#problematicErrorMessage) {
      this.#problematicErrorMessage.textContent =
        message || 'Request failed. Please try again.';
    }
    if (this.#problematicErrorGuidance) {
      this.#problematicErrorGuidance.textContent =
        this.#getGuidanceForErrorType(errorType);
    }

    banner.dataset.errorType = errorType || 'unknown';
    banner.hidden = false;
  }

  #clearProblematicError() {
    if (!this.#problematicErrorBanner) return;

    this.#problematicErrorBanner.hidden = true;
    this.#problematicErrorBanner.dataset.errorType = '';
    if (this.#problematicErrorTitle) this.#problematicErrorTitle.textContent = '';
    if (this.#problematicErrorMessage)
      this.#problematicErrorMessage.textContent = '';
    if (this.#problematicErrorGuidance)
      this.#problematicErrorGuidance.textContent = '';
  }

  #getExpressionName(expressionId) {
    if (typeof expressionId !== 'string') return '';
    const segments = expressionId.split(':');
    return segments[segments.length - 1];
  }

  /**
   * Update all dropdown option statuses from the loaded expression statuses.
   * Called after #loadProblematicExpressionsPanel() has populated #expressionStatuses.
   *
   * @private
   */
  #updateDropdownStatuses() {
    if (!this.#statusSelectDropdown || this.#expressionStatuses.length === 0) {
      return;
    }

    for (const statusEntry of this.#expressionStatuses) {
      this.#statusSelectDropdown.updateOptionStatus(
        statusEntry.id,
        statusEntry.diagnosticStatus
      );
    }

    this.#logger.debug(
      `Updated ${this.#expressionStatuses.length} dropdown option statuses`
    );
  }

  /**
   * Check if an expression exists in the dropdown.
   *
   * @private
   * @param {string} expressionId - The expression ID to check
   * @returns {boolean} True if the expression exists in the dropdown
   */
  #hasExpressionOption(expressionId) {
    if (!this.#statusSelectDropdown) return false;

    // Check by full ID first, then by name only
    const expressionName = this.#getExpressionName(expressionId);
    const currentOptions = this.#statusSelectDropdown.getOptions();

    return currentOptions.some(
      (opt) => opt.value === expressionId || opt.value === expressionName
    );
  }

  /**
   * Select an expression by ID, updating the dropdown and triggering selection.
   * Tries full namespaced ID first, then falls back to short name if needed.
   *
   * @private
   * @param {string} expressionId - The expression ID to select
   */
  #selectExpressionById(expressionId) {
    if (!this.#statusSelectDropdown) return;

    // Try full ID first (without triggering setValue's internal warning via silent check)
    const options = this.#statusSelectDropdown.getOptions();
    const hasFullId = options.some((opt) => opt.value === expressionId);

    if (hasFullId) {
      this.#statusSelectDropdown.setValue(expressionId, true);
      return;
    }

    // Fallback: try without namespace (for expressions without namespace prefix)
    const expressionName = this.#getExpressionName(expressionId);
    if (expressionName !== expressionId) {
      const hasShortName = options.some((opt) => opt.value === expressionName);
      if (hasShortName) {
        this.#statusSelectDropdown.setValue(expressionName, true);
      }
    }
    // Note: No "not found" warning needed here because:
    // 1. This method is only called from pill click handlers
    // 2. Pills are filtered by #hasExpressionOption() before rendering
    // 3. #hasExpressionOption() uses the same logic to check if expression exists
    // Therefore, any pill that renders will always have a matching dropdown option.
  }

  /**
   * Update the diagnostic status of the current expression and persist it.
   *
   * @private
   * @param {string} status - The new diagnostic status
   * @param {number|null} [triggerRate=null] - Optional trigger rate (0.0-1.0)
   */
  async #persistExpressionStatus(status, triggerRate = null) {
    if (!this.#selectedExpression) return;

    // Find the file path for the selected expression
    const expressionInfo = this.#expressionStatuses.find(
      e => e.id === this.#selectedExpression.id
    );

    let filePath = expressionInfo?.filePath;

    // Fallback: construct path from expression metadata if not found in scanned statuses
    if (!filePath) {
      const sourceFile = this.#selectedExpression._sourceFile;
      const modId = this.#selectedExpression._modId;

      if (sourceFile && modId) {
        filePath = `data/mods/${modId}/expressions/${sourceFile}`;
        this.#logger.debug(`Constructed file path from metadata: ${filePath}`);
      } else {
        this.#logger.warn(
          `Cannot persist status: no file path for ${this.#selectedExpression.id}`
        );
        return;
      }
    }

    try {
      const updateResult = await this.#expressionStatusService.updateStatus(
        filePath,
        status,
        triggerRate
      );
      if (!updateResult.success) {
        this.#logger.warn('ExpressionStatusService: Update failed', updateResult);
        this.#showProblematicError({
          errorType: updateResult.errorType,
          message: updateResult.message,
          context: 'update',
        });
        return;
      }

      this.#clearProblematicError();
      this.#logger.info(
        `Persisted status '${status}' for ${this.#selectedExpression.id}`
      );

      // Update the dropdown option's status circle
      if (this.#statusSelectDropdown) {
        this.#statusSelectDropdown.updateOptionStatus(
          this.#selectedExpression.id,
          status
        );
      }

      // Update local cache of expression statuses
      const existingEntry = this.#expressionStatuses.find(
        (e) => e.id === this.#selectedExpression.id
      );
      if (existingEntry) {
        existingEntry.diagnosticStatus = status;
        if (typeof triggerRate === 'number') {
          existingEntry.triggerRate = triggerRate;
        }
      }

      // Refresh the problematic panel using local cache to avoid race condition.
      // Using the in-memory cache (already updated above) instead of re-scanning
      // from disk prevents stale data from overwriting the correct dropdown status.
      this.#refreshProblematicPillsFromCache();
    } catch (error) {
      this.#logger.error('Failed to persist expression status:', error);
      this.#showProblematicError({
        errorType: 'unknown',
        message: error.message || 'Failed to persist expression status.',
        context: 'update',
      });
    }
  }

  // ========== MC Ground-Truth Witness Methods ==========

  /**
   * Display ground-truth witnesses from Monte Carlo simulation.
   * These are actual triggering states captured during simulation.
   *
   * @private
   * @param {object} witnessAnalysis - The witness analysis from MC simulation
   * @param {Array<object>} witnessAnalysis.witnesses - Array of witness states
   * @param {object|null} witnessAnalysis.nearestMiss - Nearest miss if no triggers
   */
  #displayMcWitnesses(witnessAnalysis) {
    if (!this.#mcWitnessesContainer || !this.#mcWitnessesList) return;

    const witnesses = witnessAnalysis?.witnesses ?? [];
    const nearestMiss = witnessAnalysis?.nearestMiss ?? null;

    // Clear previous content
    this.#mcWitnessesList.innerHTML = '';

    if (witnesses.length === 0 && !nearestMiss) {
      this.#mcWitnessesContainer.hidden = true;
      return;
    }

    this.#mcWitnessesContainer.hidden = false;

    // Display witnesses
    if (witnesses.length > 0) {
      const header = document.createElement('h4');
      header.textContent = `✅ Ground-Truth Witnesses (${witnesses.length})`;
      header.className = 'mc-witnesses-header';
      this.#mcWitnessesList.appendChild(header);

      const description = document.createElement('p');
      description.className = 'mc-witnesses-description';
      description.textContent =
        'These states were verified to trigger the expression during simulation.';
      this.#mcWitnessesList.appendChild(description);

      for (let i = 0; i < witnesses.length; i++) {
        const witnessCard = this.#createWitnessCard(witnesses[i], i + 1, true);
        this.#mcWitnessesList.appendChild(witnessCard);
      }
    }

    // Display nearest miss if no witnesses found
    if (witnesses.length === 0 && nearestMiss) {
      const header = document.createElement('h4');
      header.textContent = '⚠️ Nearest Miss';
      header.className = 'mc-witnesses-header mc-witnesses-miss';
      this.#mcWitnessesList.appendChild(header);

      const description = document.createElement('p');
      description.className = 'mc-witnesses-description';
      description.textContent =
        'No triggering states found. This is the closest sample to triggering.';
      this.#mcWitnessesList.appendChild(description);

      const missCard = this.#createWitnessCard(nearestMiss.sample, 1, false);
      this.#mcWitnessesList.appendChild(missCard);

      // Show failed leaves info if available
      if (nearestMiss.failedLeaves && nearestMiss.failedLeaves.length > 0) {
        const failedSection = document.createElement('div');
        failedSection.className = 'mc-witness-failed-section';
        failedSection.innerHTML = `
          <h5>Failed Conditions (${nearestMiss.failedLeafCount})</h5>
          <ul class="mc-witness-failed-list">
            ${nearestMiss.failedLeaves
              .map((f) => {
                const desc = f.description || 'Unknown condition';
                const details =
                  f.actual !== null && f.threshold !== null
                    ? ` (actual: ${f.actual}, needed: ${f.threshold})`
                    : '';
                return `<li><code>${desc}</code>${details}</li>`;
              })
              .join('')}
          </ul>
        `;
        this.#mcWitnessesList.appendChild(failedSection);
      }
    }
  }

  /**
   * Create a collapsible witness card for display.
   *
   * @private
   * @param {object} witness - The witness state data
   * @param {number} index - The witness index (1-based)
   * @param {boolean} isTriggering - Whether this is a triggering witness
   * @returns {HTMLElement} The witness card element
   */
  #createWitnessCard(witness, index, isTriggering) {
    const card = document.createElement('details');
    card.className = `mc-witness-card ${isTriggering ? 'witness-triggering' : 'witness-miss'}`;

    const summary = document.createElement('summary');
    summary.className = 'mc-witness-summary';
    summary.textContent = isTriggering
      ? `Witness #${index}`
      : `Nearest Miss #${index}`;
    card.appendChild(summary);

    const content = document.createElement('div');
    content.className = 'mc-witness-content';

    // Current mood state
    if (witness.current?.mood) {
      content.appendChild(
        this.#createStateSection('Current Mood', witness.current.mood)
      );
    }

    // Current sexual state
    if (witness.current?.sexual) {
      content.appendChild(
        this.#createStateSection('Current Sexual', witness.current.sexual)
      );
    }

    // Previous mood state (for temporal expressions)
    if (witness.previous?.mood) {
      content.appendChild(
        this.#createStateSection('Previous Mood', witness.previous.mood)
      );
    }

    // Previous sexual state
    if (witness.previous?.sexual) {
      content.appendChild(
        this.#createStateSection('Previous Sexual', witness.previous.sexual)
      );
    }

    // Affect traits
    if (witness.affectTraits) {
      content.appendChild(
        this.#createStateSection('Affect Traits', witness.affectTraits)
      );
    }

    // Computed emotions (current) - only referenced emotions from expression prerequisites
    if (
      witness.computedEmotions &&
      Object.keys(witness.computedEmotions).length > 0
    ) {
      content.appendChild(
        this.#createStateSection('Computed Emotions', witness.computedEmotions)
      );
    }

    // Previous computed emotions - for temporal/delta expressions
    if (
      witness.previousComputedEmotions &&
      Object.keys(witness.previousComputedEmotions).length > 0
    ) {
      content.appendChild(
        this.#createStateSection(
          'Previous Computed Emotions',
          witness.previousComputedEmotions
        )
      );
    }

    // Copy button
    const copyBtn = document.createElement('button');
    copyBtn.className = 'mc-witness-copy-btn';
    copyBtn.textContent = 'Copy JSON';
    copyBtn.addEventListener('click', () => this.#copyWitnessJson(witness));
    content.appendChild(copyBtn);

    card.appendChild(content);
    return card;
  }

  /**
   * Create a state section with axis values.
   *
   * @private
   * @param {string} label - Section label
   * @param {object} state - State object with axis values
   * @returns {HTMLElement} The section element
   */
  #createStateSection(label, state) {
    const section = document.createElement('div');
    section.className = 'mc-witness-state-section';

    const heading = document.createElement('h5');
    heading.textContent = label;
    section.appendChild(heading);

    const grid = document.createElement('div');
    grid.className = 'mc-witness-state-grid';

    // Computed Emotions sections contain float values in [0, 1] range
    // Other sections (Mood, Sexual, Affect Traits) contain integer values
    const isFloatSection =
      label === 'Computed Emotions' || label === 'Previous Computed Emotions';

    for (const [axis, value] of Object.entries(state)) {
      if (value === undefined || value === null) continue;

      let formattedValue;
      if (typeof value === 'number') {
        formattedValue = isFloatSection ? value.toFixed(2) : value.toFixed(0);
      } else {
        formattedValue = value;
      }

      const item = document.createElement('div');
      item.className = 'mc-witness-axis-item';
      item.innerHTML = `
        <span class="mc-witness-axis-name">${axis}</span>
        <span class="mc-witness-axis-value">${formattedValue}</span>
      `;
      grid.appendChild(item);
    }

    section.appendChild(grid);
    return section;
  }

  /**
   * Copy a witness state to clipboard as JSON.
   *
   * @private
   * @param {object} witness - The witness state to copy
   */
  async #copyWitnessJson(witness) {
    const json = JSON.stringify(witness, null, 2);
    const success = await copyToClipboard(json);
    this.#showCopyFeedback(success ? 'Copied to clipboard!' : 'Copy failed');
  }

  /**
   * Show temporary feedback message for copy operation.
   *
   * @private
   * @param {string} message - The message to display
   */
  #showCopyFeedback(message) {
    const toast = document.createElement('div');
    toast.className = 'diagnostics-copy-feedback show';
    toast.textContent = message;
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');

    // Append to MC witnesses container or fallback to body
    const container = this.#mcWitnessesContainer ?? document.body;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.remove('show');
      toast.addEventListener('transitionend', () => toast.remove(), {
        once: true,
      });
    }, 2000);
  }

  // ========== Global Sensitivity Display Methods ==========

  /**
   * Display global expression sensitivity data in the UI.
   * Shows how threshold changes affect the entire expression trigger rate.
   *
   * @private
   */
  #displayGlobalSensitivity(globalSensitivityData = null) {
    if (!this.#globalSensitivityContainer || !this.#globalSensitivityTables) {
      return;
    }

    // Compute global sensitivity data
    const sensitivityData = Array.isArray(globalSensitivityData)
      ? globalSensitivityData
      : this.#sensitivityAnalyzer.computeGlobalSensitivityData(
        this.#rawSimulationResult?.storedContexts ?? [],
        this.#currentBlockers,
        this.#selectedExpression?.prerequisites
      );

    if (!sensitivityData || sensitivityData.length === 0) {
      this.#globalSensitivityContainer.hidden = true;
      return;
    }

    // Clear previous content
    this.#globalSensitivityTables.innerHTML = '';
    this.#globalSensitivityContainer.hidden = false;

    const storedBaselineTriggerRate =
      this.#getStoredBaselineTriggerRate(sensitivityData);
    const baselineLabel = this.#buildSensitivityBaselineLabel(
      this.#rawSimulationResult?.triggerRate,
      storedBaselineTriggerRate
    );
    if (baselineLabel) {
      this.#globalSensitivityTables.appendChild(baselineLabel);
    }

    // Check for low confidence results
    const lowConfidenceResults = sensitivityData.filter((result) => {
      if (!result.grid || result.grid.length === 0) return false;
      const originalIndex = result.grid.findIndex(
        (pt) => Math.abs(pt.threshold - result.originalThreshold) < 0.001
      );
      if (originalIndex < 0) return false;
      const baseline = result.grid[originalIndex];
      const estimatedHits = baseline.triggerRate * baseline.sampleCount;
      return estimatedHits < 5;
    });

    if (lowConfidenceResults.length > 0) {
      const warning = document.createElement('div');
      warning.className = 'sensitivity-warning';
      warning.innerHTML = `
        <span class="warning-icon">⚠️</span>
        <span class="warning-text">
          Low confidence: fewer than 5 baseline expression hits.
          Global sensitivity tables are shown for reference.
        </span>
      `;
      this.#globalSensitivityTables.appendChild(warning);
    }

    // Generate a table for each sensitivity result
    for (const result of sensitivityData) {
      const tableContainer = this.#createSensitivityTable(result);
      this.#globalSensitivityTables.appendChild(tableContainer);
    }
  }

  #getStoredBaselineTriggerRate(sensitivityData) {
    if (!Array.isArray(sensitivityData)) {
      return null;
    }

    for (const result of sensitivityData) {
      if (!Array.isArray(result?.grid)) {
        continue;
      }
      const baselinePoint = result.grid.find(
        (point) =>
          Math.abs(point.threshold - result.originalThreshold) < 0.001
      );
      if (baselinePoint && typeof baselinePoint.triggerRate === 'number') {
        return baselinePoint.triggerRate;
      }
    }

    return null;
  }

  #buildSensitivityBaselineLabel(fullSampleTriggerRate, storedBaselineTriggerRate) {
    const parts = [];
    if (typeof fullSampleTriggerRate === 'number') {
      parts.push(
        `Baseline (full sample): ${this.#formatPercentage(fullSampleTriggerRate)}`
      );
    }
    if (typeof storedBaselineTriggerRate === 'number') {
      parts.push(
        `Baseline (stored contexts): ${this.#formatPercentage(
          storedBaselineTriggerRate
        )}`
      );
    }

    if (parts.length === 0) {
      return null;
    }

    const label = document.createElement('p');
    label.className = 'population-label';
    label.textContent = parts.join(' | ');
    return label;
  }

  /**
   * Create a sensitivity table for a single variable.
   *
   * @private
   * @param {object} result - Sensitivity result with varPath, operator, originalThreshold, grid
   * @returns {HTMLElement} The table container element
   */
  #createSensitivityTable(result) {
    const { varPath, operator, originalThreshold, grid } = result;
    const isIntegerDomain = result?.isIntegerDomain === true;

    if (!grid || grid.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'sensitivity-table-empty';
      empty.textContent = `No data for ${varPath}`;
      return empty;
    }

    const container = document.createElement('div');
    container.className = 'sensitivity-table-container';

    // Header
    const header = document.createElement('h4');
    header.className = 'sensitivity-table-header';
    header.innerHTML = `<code>${varPath}</code> ${this.#escapeHtml(operator)} [threshold]`;
    container.appendChild(header);

    const monotonicity = evaluateSweepMonotonicity({
      grid,
      rateKey: 'triggerRate',
      operator,
    });
    if (!monotonicity.isMonotonic && monotonicity.direction) {
      const directionLabel =
        monotonicity.direction === 'nonincreasing'
          ? 'non-increasing'
          : 'non-decreasing';
      const warning = document.createElement('div');
      warning.className = 'sensitivity-warning';
      warning.innerHTML = `
        <span class="warning-icon">⚠️</span>
        <span class="warning-text">
          Sweep is not ${directionLabel} as ${this.#escapeHtml(operator)} thresholds change.
        </span>
      `;
      container.appendChild(warning);
    }

    // Find original threshold index
    const originalIndex = grid.findIndex(
      (pt) => Math.abs(pt.threshold - originalThreshold) < 0.001
    );

    // Create table
    const table = document.createElement('table');
    table.className = 'results-table sensitivity-table';

    // Table header
    const thead = document.createElement('thead');
    thead.innerHTML = `
      <tr>
        <th>Threshold</th>
        ${isIntegerDomain ? '<th>Effective</th>' : ''}
        <th>Trigger Rate</th>
        <th>Change</th>
        <th>Samples</th>
      </tr>
    `;
    table.appendChild(thead);

    // Table body
    const tbody = document.createElement('tbody');
    for (let i = 0; i < grid.length; i++) {
      const point = grid[i];
      const isOriginal = i === originalIndex;

      // Calculate change from original
      let changeStr = '—';
      let changeClass = '';
      if (originalIndex >= 0 && i !== originalIndex) {
        const originalRate = grid[originalIndex].triggerRate;
        if (originalRate > 0 && point.triggerRate > 0) {
          const multiplier = point.triggerRate / originalRate;
          if (multiplier > 1) {
            const pctChange = (multiplier - 1) * 100;
            changeStr = `+${pctChange.toFixed(0)}%`;
            changeClass = 'change-positive';
          } else if (multiplier < 1) {
            const pctChange = (multiplier - 1) * 100;
            changeStr = `${pctChange.toFixed(0)}%`;
            changeClass = 'change-negative';
          }
        } else if (originalRate === 0 && point.triggerRate > 0) {
          changeStr = '+∞';
          changeClass = 'change-positive';
        } else if (originalRate > 0 && point.triggerRate === 0) {
          changeStr = '-100%';
          changeClass = 'change-negative';
        } else {
          changeStr = '0%';
        }
      }

      const row = document.createElement('tr');
      row.className = isOriginal ? 'sensitivity-row-baseline' : '';
      const thresholdDisplay = this.#formatThresholdValue(
        point.threshold,
        isIntegerDomain
      );
      const effectiveDisplay = this.#formatEffectiveThreshold(
        point.effectiveThreshold
      );
      row.innerHTML = `
        <td>${isOriginal ? '<strong>' : ''}${thresholdDisplay}${isOriginal ? '</strong>' : ''}</td>
        ${
          isIntegerDomain
            ? `<td>${isOriginal ? '<strong>' : ''}${effectiveDisplay}${isOriginal ? '</strong>' : ''}</td>`
            : ''
        }
        <td>${isOriginal ? '<strong>' : ''}${this.#formatPercentage(point.triggerRate)}${isOriginal ? '</strong>' : ''}</td>
        <td class="${changeClass}">${isOriginal ? '<strong>baseline (stored contexts)</strong>' : changeStr}</td>
        <td>${point.sampleCount.toLocaleString()}</td>
      `;
      tbody.appendChild(row);
    }
    table.appendChild(tbody);
    container.appendChild(table);

    if (isIntegerDomain) {
      const note = document.createElement('div');
      note.className = 'sensitivity-note';
      note.textContent =
        'Thresholds are integer-effective; decimals collapse to integer boundaries.';
      container.appendChild(note);
    }

    // Add actionable insight if applicable
    const insight = this.#generateSensitivityInsight(
      grid,
      originalIndex,
      isIntegerDomain
    );
    if (insight) {
      const insightDiv = document.createElement('div');
      insightDiv.className = 'sensitivity-insight';
      insightDiv.innerHTML = `<span class="insight-icon">💡</span> ${insight}`;
      container.appendChild(insightDiv);
    }

    return container;
  }

  /**
   * Generate an actionable insight based on sensitivity data.
   *
   * @private
   * @param {Array} grid - Grid of threshold/rate data
   * @param {number} originalIndex - Index of original threshold in grid
   * @returns {string|null} Insight message or null
   */
  #generateSensitivityInsight(grid, originalIndex, isIntegerDomain) {
    if (originalIndex < 0 || !grid[originalIndex]) return null;

    const originalRate = grid[originalIndex].triggerRate;
    const originalThreshold = grid[originalIndex].threshold;

    // If expression never triggers, find first threshold where it does
    if (originalRate === 0) {
      const betterOption = grid.find((pt) => pt.triggerRate > 0);
      if (betterOption && betterOption.threshold !== originalThreshold) {
        return `Adjusting threshold to <strong>${this.#formatThresholdValue(
          betterOption.threshold,
          isIntegerDomain
        )}</strong> would achieve ~${this.#formatPercentage(
          betterOption.triggerRate
        )} expression trigger rate.`;
      }
    }

    // If expression rarely triggers, find threshold with much higher rate
    if (originalRate > 0 && originalRate < 0.01) {
      const betterOption = grid.find((pt) => pt.triggerRate >= originalRate * 5);
      if (betterOption && betterOption.threshold !== originalThreshold) {
        return `Adjusting threshold to <strong>${this.#formatThresholdValue(
          betterOption.threshold,
          isIntegerDomain
        )}</strong> would increase trigger rate to ~${this.#formatPercentage(
          betterOption.triggerRate
        )}.`;
      }
    }

    return null;
  }

  // ========== Static Cross-Reference Methods ==========

  /**
   * Display static analysis cross-reference section.
   * Compares gate conflicts and unreachable thresholds from static analysis
   * with Monte Carlo observations.
   *
   * @private
   */
  #displayStaticCrossReference() {
    if (!this.#staticCrossReferenceContainer) return;

    // Get static analysis data
    const gateConflicts = this.#currentResult?.gateConflicts || [];
    const unreachableThresholds = this.#currentResult?.unreachableThresholds || [];

    // Skip if no static analysis data
    if (gateConflicts.length === 0 && unreachableThresholds.length === 0) {
      this.#staticCrossReferenceContainer.hidden = true;
      return;
    }

    // Show the container
    this.#staticCrossReferenceContainer.hidden = false;
    this.#staticCrossReferenceContent.innerHTML = '';

    // Display gate conflicts table
    if (gateConflicts.length > 0) {
      const gateSection = this.#createGateConflictsTable(gateConflicts);
      this.#staticCrossReferenceContent.appendChild(gateSection);
    }

    // Display unreachable thresholds table
    if (unreachableThresholds.length > 0) {
      const thresholdSection = this.#createUnreachableThresholdsTable(unreachableThresholds);
      this.#staticCrossReferenceContent.appendChild(thresholdSection);
    }

    // Display summary
    this.#displayCrossReferenceSummary(gateConflicts, unreachableThresholds);
  }

  /**
   * Display conditional pass rates section showing emotion pass rates given mood constraints.
   *
   * @private
   */
  #displayConditionalPassRates() {
    if (!this.#conditionalPassRatesContainer || !this.#conditionalPassRatesContent) {
      return;
    }

    // Need selected expression, stored contexts, and blockers
    if (!this.#selectedExpression || !this.#rawSimulationResult?.storedContexts) {
      this.#conditionalPassRatesContainer.hidden = true;
      this.#toggleOrConstraintWarning(this.#conditionalPassRatesWarning, false);
      this.#toggleOrConstraintWarning(this.#conditionalGateWarning, false);
      return;
    }

    const storedContexts = this.#rawSimulationResult.storedContexts;
    const blockers = this.#currentBlockers || [];
    const prerequisites = this.#selectedExpression.prerequisites || [];
    const hasOrMoodConstraints = this.#hasOrMoodConstraintsForUI(prerequisites);

    // Extract mood constraints from prerequisites
    const moodConstraints = this.#extractMoodConstraintsForUI(prerequisites);

    // Extract emotion conditions from blockers
    const emotionConditions = this.#extractEmotionConditionsForUI(blockers);

    // Skip if no mood constraints or emotion conditions
    if (moodConstraints.length === 0 || emotionConditions.length === 0) {
      this.#conditionalPassRatesContainer.hidden = true;
      this.#toggleOrConstraintWarning(this.#conditionalPassRatesWarning, false);
      this.#toggleOrConstraintWarning(this.#conditionalGateWarning, false);
      return;
    }

    // Filter contexts where all mood constraints pass
    const filteredContexts = this.#filterContextsByMoodConstraintsUI(
      storedContexts,
      moodConstraints
    );

    // Skip if no contexts pass mood constraints
    if (filteredContexts.length === 0) {
      this.#conditionalPassRatesContainer.hidden = true;
      this.#toggleOrConstraintWarning(this.#conditionalPassRatesWarning, false);
      this.#toggleOrConstraintWarning(this.#conditionalGateWarning, false);
      return;
    }

    // Compute conditional pass rates
    const conditionalRates = this.#computeConditionalPassRatesUI(
      filteredContexts,
      emotionConditions
    );

    // Build and display the UI
    this.#conditionalPassRatesContainer.hidden = false;
    this.#conditionalPassRatesContent.innerHTML = '';
    this.#toggleOrConstraintWarning(this.#conditionalPassRatesWarning, hasOrMoodConstraints);
    this.#toggleGateCompatibilityWarning();

    // Add filter info
    const filterInfo = document.createElement('div');
    filterInfo.className = 'conditional-filter-info';
    filterInfo.innerHTML = `<strong>${filteredContexts.length}</strong> contexts where all mood constraints pass (of ${storedContexts.length} total)`;
    this.#conditionalPassRatesContent.appendChild(filterInfo);

    // Add table
    const table = this.#createConditionalPassRatesTable(conditionalRates);
    this.#conditionalPassRatesContent.appendChild(table);
  }

  #toggleGateCompatibilityWarning() {
    if (!this.#conditionalGateWarning) return;

    const operatorLookup = this.#buildPrototypeOperatorLookup(
      this.#selectedExpression?.prerequisites
    );
    const incompatibilities = this.#collectGateCompatibilityIssues(
      this.#rawSimulationResult?.gateCompatibility,
      operatorLookup
    );

    if (incompatibilities.length === 0) {
      this.#conditionalGateWarning.hidden = true;
      return;
    }

    const blockingIssues = incompatibilities.filter((issue) => !issue.benign);
    const benignIssues = incompatibilities.filter((issue) => issue.benign);
    const displayedIssues =
      blockingIssues.length > 0 ? blockingIssues : benignIssues;
    const names = displayedIssues.slice(0, 3).map((item) => item.prototypeId);
    const extraCount = incompatibilities.length - names.length;
    const suffix = extraCount > 0 ? ` (+${extraCount} more)` : '';
    const label = names.length > 0 ? names.join(', ') : 'See report';
    const reason = displayedIssues[0]?.reason
      ? ` Example: ${this.#escapeHtml(displayedIssues[0].reason)}.`
      : '';
    const benignNote =
      blockingIssues.length > 0 && benignIssues.length > 0
        ? ` ${benignIssues.length} incompatibilit${
            benignIssues.length === 1 ? 'y' : 'ies'
          } benign for <=/< clauses.`
        : '';
    const benignOnly = blockingIssues.length === 0 && benignIssues.length > 0;

    this.#conditionalGateWarning.innerHTML = `
      <span class="warning-icon">${benignOnly ? 'ℹ️' : '⚠️'}</span>
      <span class="warning-text">
        ${
          benignOnly
            ? `Gate incompatibility is benign for <=/< clauses for ${this.#escapeHtml(
                label
              )}${suffix}.`
            : `Gate incompatibility detected for ${this.#escapeHtml(
                label
              )}${suffix}.`
        }${reason}${benignNote} See report for details.
      </span>
    `;
    this.#conditionalGateWarning.hidden = false;
  }

  #collectGateCompatibilityIssues(gateCompatibility, operatorLookup) {
    if (!gateCompatibility) return [];

    const issues = [];
    const { emotions = {}, sexualStates = {} } = gateCompatibility;
    const sources = [
      { source: emotions, type: 'emotion' },
      { source: sexualStates, type: 'sexual' },
    ];

    for (const { source, type } of sources) {
      for (const [prototypeId, status] of Object.entries(source)) {
        if (status?.compatible === false) {
          const lookupKey = `${type}:${prototypeId}`;
          const operators = operatorLookup?.get(lookupKey);
          const isBenignCeiling =
            operators &&
            operators.size > 0 &&
            Array.from(operators).every(
              (operator) => operator === '<=' || operator === '<'
            );
          issues.push({
            prototypeId,
            type,
            reason: status.reason ?? null,
            benign: isBenignCeiling,
          });
        }
      }
    }

    return issues;
  }

  /**
   * Extract mood constraints from prerequisites for UI display.
   *
   * @private
   * @param {object[]} prerequisites - Expression prerequisites
   * @returns {Array<{varPath: string, operator: string, threshold: number}>}
   */
  #extractMoodConstraintsForUI(prerequisites) {
    return extractMoodConstraints(prerequisites, {
      includeMoodAlias: true,
      andOnly: true,
    });
  }

  /**
   * Detect whether any mood-axis comparisons live inside OR blocks.
   *
   * @private
   * @param {object[]} prerequisites - Expression prerequisites
   * @returns {boolean}
   */
  #hasOrMoodConstraintsForUI(prerequisites) {
    return hasOrMoodConstraints(prerequisites, { includeMoodAlias: true });
  }

  /**
   * Toggle OR-mood-constraint warning visibility.
   *
   * @private
   * @param {HTMLElement|null} element - Warning element
   * @param {boolean} show - Whether to show
   */
  #toggleOrConstraintWarning(element, show) {
    if (!element) return;
    element.hidden = !show;
  }

  /**
   * Extract emotion conditions from blockers for UI display.
   *
   * @private
   * @param {object[]} blockers - Blockers from simulation
   * @returns {Array<{varPath: string, operator: string, threshold: number, display: string}>}
   */
  #extractEmotionConditionsForUI(blockers) {
    const conditions = [];
    const seen = new Set();

    for (const blocker of blockers) {
      const condition = blocker.condition || '';
      // Parse conditions like "emotions.anger >= 0.4"
      const match = condition.match(/^(emotions\.\w+)\s*(>=|<=|>|<|==)\s*([\d.]+)$/);
      if (match) {
        const [, varPath, operator, thresholdStr] = match;
        const key = `${varPath}:${operator}:${thresholdStr}`;
        if (!seen.has(key)) {
          seen.add(key);
          conditions.push({
            varPath,
            operator,
            threshold: parseFloat(thresholdStr),
            display: condition,
          });
        }
      }
    }

    return conditions;
  }

  #buildPrototypeOperatorLookup(prerequisites) {
    const lookup = new Map();
    const operators = ['>=', '>', '<=', '<', '=='];

    const addOperator = (varPath, operator) => {
      if (typeof varPath !== 'string') return;
      let type = null;
      let prototypeId = null;
      if (varPath.startsWith('emotions.')) {
        type = 'emotion';
        prototypeId = varPath.replace('emotions.', '');
      } else if (varPath.startsWith('sexualStates.')) {
        type = 'sexual';
        prototypeId = varPath.replace('sexualStates.', '');
      }
      if (!type || !prototypeId) return;

      const key = `${type}:${prototypeId}`;
      if (!lookup.has(key)) {
        lookup.set(key, new Set());
      }
      lookup.get(key).add(operator);
    };

    const extractFromLogic = (logic) => {
      if (!logic || typeof logic !== 'object') return;

      for (const operator of operators) {
        const clause = logic[operator];
        if (!clause) continue;
        const [left, right] = clause;
        if (left && typeof left === 'object' && left.var && typeof right === 'number') {
          addOperator(left.var, operator);
        }
      }

      if (Array.isArray(logic.and)) {
        for (const child of logic.and) {
          extractFromLogic(child);
        }
      }
      if (Array.isArray(logic.or)) {
        for (const child of logic.or) {
          extractFromLogic(child);
        }
      }
    };

    if (Array.isArray(prerequisites)) {
      for (const prereq of prerequisites) {
        extractFromLogic(prereq?.logic);
      }
    }

    return lookup;
  }

  /**
   * Filter stored contexts where all mood constraints pass.
   *
   * @private
   * @param {object[]} storedContexts - Simulation contexts
   * @param {Array} moodConstraints - Mood constraints to filter by
   * @returns {object[]} Filtered contexts
   */
  #filterContextsByMoodConstraintsUI(storedContexts, moodConstraints) {
    return filterContextsByConstraints(storedContexts, moodConstraints);
  }

  /**
   * Get nested value from an object using dot notation.
   *
   * @private
   * @param {object} obj - Object to get value from
   * @param {string} path - Dot-notation path (e.g., 'moodAxes.valence')
   * @returns {*} Value at path or undefined
   */
  #getNestedValueUI(obj, path) {
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
      if (current == null) return undefined;
      current = current[part];
    }
    return current;
  }

  /**
   * Evaluate a comparison operation.
   *
   * @private
   * @param {number} value - Value to compare
   * @param {string} operator - Comparison operator
   * @param {number} threshold - Threshold to compare against
   * @returns {boolean} Result of comparison
   */
  #evaluateComparisonUI(value, operator, threshold) {
    return evaluateConstraint(value, operator, threshold);
  }

  /**
   * Compute conditional pass rates for emotion conditions.
   *
   * @private
   * @param {object[]} filteredContexts - Contexts where mood constraints pass
   * @param {Array} emotionConditions - Emotion conditions to evaluate
   * @returns {Array} Pass rate data for each condition
   */
  #computeConditionalPassRatesUI(filteredContexts, emotionConditions) {
    const results = [];

    for (const condition of emotionConditions) {
      const passes = filteredContexts.filter((ctx) => {
        const value = this.#getNestedValueUI(ctx, condition.varPath);
        return this.#evaluateComparisonUI(value, condition.operator, condition.threshold);
      }).length;

      const rate = filteredContexts.length > 0 ? passes / filteredContexts.length : 0;
      const ci = this.#calculateWilsonIntervalUI(passes, filteredContexts.length);

      results.push({
        condition: condition.display,
        rate,
        passes,
        total: filteredContexts.length,
        ciLow: ci.low,
        ciHigh: ci.high,
      });
    }

    return results;
  }

  /**
   * Calculate Wilson score confidence interval.
   *
   * @private
   * @param {number} successes - Number of successes
   * @param {number} total - Total number of trials
   * @param {number} z - Z-score for confidence level (default: 1.96 for 95%)
   * @returns {{low: number, high: number}} Confidence interval bounds
   */
  #calculateWilsonIntervalUI(successes, total, z = 1.96) {
    if (total === 0) return { low: 0, high: 0 };

    const p = successes / total;
    const n = total;
    const z2 = z * z;

    const denominator = 1 + z2 / n;
    const center = p + z2 / (2 * n);
    const margin = z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n);

    return {
      low: Math.max(0, (center - margin) / denominator),
      high: Math.min(1, (center + margin) / denominator),
    };
  }

  /**
   * Create conditional pass rates table element.
   *
   * @private
   * @param {Array} conditionalRates - Pass rate data
   * @returns {HTMLTableElement} Table element
   */
  #createConditionalPassRatesTable(conditionalRates) {
    const table = document.createElement('table');
    table.className = 'conditional-pass-rates-table';

    // Header
    const thead = document.createElement('thead');
    thead.innerHTML = `
      <tr>
        <th>Condition</th>
        <th>P(pass | mood)</th>
        <th>Passes</th>
        <th>CI (95%)</th>
      </tr>
    `;
    table.appendChild(thead);

    // Body
    const tbody = document.createElement('tbody');
    for (const item of conditionalRates) {
      const row = document.createElement('tr');
      const rateClass = this.#getConditionalRateClass(item.rate);
      row.innerHTML = `
        <td><code>${this.#escapeHtml(item.condition)}</code></td>
        <td class="rate-cell ${rateClass}">${this.#formatPercentage(item.rate)}</td>
        <td>${item.passes}/${item.total}</td>
        <td>[${this.#formatPercentage(item.ciLow)}, ${this.#formatPercentage(item.ciHigh)}]</td>
      `;
      tbody.appendChild(row);
    }
    table.appendChild(tbody);

    return table;
  }

  /**
   * Get CSS class for conditional rate value.
   *
   * @private
   * @param {number} rate - Pass rate (0-1)
   * @returns {string} CSS class name
   */
  #getConditionalRateClass(rate) {
    if (rate < 0.2) return 'rate-low';
    if (rate < 0.5) return 'rate-medium';
    return 'rate-high';
  }

  /**
   * Display last-mile decomposition section for decisive blockers.
   *
   * @private
   */
  #displayLastMileDecomposition() {
    if (!this.#lastMileDecompositionContainer || !this.#lastMileDecompositionContent) {
      return;
    }

    // Need stored contexts and blockers
    if (!this.#rawSimulationResult?.storedContexts) {
      this.#lastMileDecompositionContainer.hidden = true;
      return;
    }

    const storedContexts = this.#rawSimulationResult.storedContexts;
    const blockers = this.#currentBlockers || [];

    // Find decisive blockers (high lastMileFailRate)
    const decisiveBlockers = blockers.filter((b) => {
      const lmRate = b.lastMileFailRate ?? 0;
      return lmRate >= 0.15 && b.condition?.startsWith('emotions.');
    });

    if (decisiveBlockers.length === 0) {
      this.#lastMileDecompositionContainer.hidden = true;
      return;
    }

    // Show container and clear content
    this.#lastMileDecompositionContainer.hidden = false;
    this.#lastMileDecompositionContent.innerHTML = '';

    // Create panel for each decisive blocker
    for (const blocker of decisiveBlockers) {
      const panel = this.#createDecompositionPanel(blocker, storedContexts, blockers);
      if (panel) {
        this.#lastMileDecompositionContent.appendChild(panel);
      }
    }

    // Hide if no panels were created
    if (this.#lastMileDecompositionContent.children.length === 0) {
      this.#lastMileDecompositionContainer.hidden = true;
    }
  }

  /**
   * Create decomposition panel for a decisive blocker.
   *
   * @private
   * @param {object} blocker - Blocker data
   * @param {object[]} storedContexts - Simulation contexts
   * @param {object[]} allBlockers - All blockers
   * @returns {HTMLElement|null} Panel element or null
   */
  #createDecompositionPanel(blocker, storedContexts, allBlockers) {
    // Find last-mile contexts for this blocker
    const lastMileContexts = this.#findLastMileContextsForUI(
      blocker,
      storedContexts,
      allBlockers
    );

    if (lastMileContexts.length < 5) {
      // Not enough data for meaningful decomposition
      return null;
    }

    // Extract emotion name from condition
    const emotionMatch = blocker.condition?.match(/emotions\.(\w+)/);
    if (!emotionMatch) return null;
    const emotionName = emotionMatch[1];

    // Get emotion values from last-mile contexts
    const emotionValues = lastMileContexts
      .map((ctx) => ctx.emotions?.[emotionName] ?? 0)
      .filter((v) => typeof v === 'number');

    if (emotionValues.length === 0) return null;

    // Compute distribution stats
    const stats = this.#computeDistributionStatsUI(emotionValues);

    // Try to get prototype weights and compute axis contributions
    const weights = this.#getPrototypeWeightsForUI(emotionName);
    let axisContributions = null;
    let dominantSuppressor = null;

    if (weights && Object.keys(weights).length > 0) {
      axisContributions = this.#computeAxisContributionsUI(lastMileContexts, weights);
      dominantSuppressor = this.#findDominantSuppressorUI(axisContributions);
    }

    // Build panel
    const panel = document.createElement('div');
    panel.className = 'decomposition-panel';

    // Header
    const header = document.createElement('div');
    header.className = 'decomposition-panel-header';
    header.innerHTML = `
      <span class="decomposition-panel-title">${this.#escapeHtml(blocker.condition)}</span>
      <span class="decomposition-context-count">${lastMileContexts.length} sole-blocker states</span>
    `;
    panel.appendChild(header);

    // Distribution stats
    const statsDiv = document.createElement('div');
    statsDiv.className = 'distribution-stats';
    statsDiv.innerHTML = `
      <div class="stat-item">
        <div class="stat-label">Min</div>
        <div class="stat-value">${stats.min.toFixed(3)}</div>
      </div>
      <div class="stat-item">
        <div class="stat-label">Median</div>
        <div class="stat-value">${stats.median.toFixed(3)}</div>
      </div>
      <div class="stat-item">
        <div class="stat-label">P90</div>
        <div class="stat-value">${stats.p90.toFixed(3)}</div>
      </div>
      <div class="stat-item">
        <div class="stat-label">Max</div>
        <div class="stat-value">${stats.max.toFixed(3)}</div>
      </div>
      <div class="stat-item">
        <div class="stat-label">Mean</div>
        <div class="stat-value">${stats.mean.toFixed(3)}</div>
      </div>
    `;
    panel.appendChild(statsDiv);

    // Axis contributions table (if available)
    if (axisContributions) {
      const table = this.#createAxisContributionsTable(axisContributions);
      panel.appendChild(table);
    }

    // Dominant suppressor callout
    if (dominantSuppressor) {
      const suppressorDiv = document.createElement('div');
      suppressorDiv.className = 'dominant-suppressor';
      suppressorDiv.innerHTML = `
        <span class="suppressor-icon">🔻</span>
        <span class="suppressor-text">
          Dominant Suppressor: <span class="suppressor-axis">${this.#escapeHtml(dominantSuppressor.axis)}</span>
          (mean contribution: <span class="suppressor-contribution">${dominantSuppressor.contribution.toFixed(3)}</span>)
        </span>
      `;
      panel.appendChild(suppressorDiv);
    }

    return panel;
  }

  /**
   * Find last-mile contexts where all blockers pass except the target.
   *
   * @private
   * @param {object} targetBlocker - Target blocker
   * @param {object[]} storedContexts - Simulation contexts
   * @param {object[]} allBlockers - All blockers
   * @returns {object[]} Last-mile contexts
   */
  #findLastMileContextsForUI(targetBlocker, storedContexts, allBlockers) {
    // Parse target condition
    const targetCondition = this.#parseBlockerConditionUI(targetBlocker.condition);
    if (!targetCondition) return [];

    // Parse all other blocker conditions
    const otherConditions = allBlockers
      .filter((b) => b !== targetBlocker)
      .map((b) => this.#parseBlockerConditionUI(b.condition))
      .filter(Boolean);

    // Find contexts where target fails but all others pass
    return storedContexts.filter((ctx) => {
      // Target must fail
      const targetValue = this.#getNestedValueUI(ctx, targetCondition.varPath);
      const targetPasses = this.#evaluateComparisonUI(
        targetValue,
        targetCondition.operator,
        targetCondition.threshold
      );
      if (targetPasses) return false;

      // All others must pass
      return otherConditions.every((cond) => {
        const value = this.#getNestedValueUI(ctx, cond.varPath);
        return this.#evaluateComparisonUI(value, cond.operator, cond.threshold);
      });
    });
  }

  /**
   * Parse blocker condition string into structured format.
   *
   * @private
   * @param {string} condition - Condition string (e.g., "emotions.anger >= 0.4")
   * @returns {{varPath: string, operator: string, threshold: number}|null}
   */
  #parseBlockerConditionUI(condition) {
    if (!condition) return null;
    const match = condition.match(/^(\w+\.\w+)\s*(>=|<=|>|<|==)\s*([\d.]+)$/);
    if (!match) return null;
    return {
      varPath: match[1],
      operator: match[2],
      threshold: parseFloat(match[3]),
    };
  }

  /**
   * Compute distribution statistics for an array of values.
   *
   * @private
   * @param {number[]} values - Array of numeric values
   * @returns {{min: number, max: number, median: number, p90: number, mean: number}}
   */
  #computeDistributionStatsUI(values) {
    if (values.length === 0) {
      return { min: 0, max: 0, median: 0, p90: 0, mean: 0 };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;

    return {
      min: sorted[0],
      max: sorted[n - 1],
      median: sorted[Math.floor(n / 2)],
      p90: sorted[Math.floor(n * 0.9)],
      mean: values.reduce((a, b) => a + b, 0) / n,
    };
  }

  /**
   * Get prototype weights for an emotion.
   *
   * @private
   * @param {string} emotionName - Name of the emotion
   * @returns {object|null} Weights object or null
   */
  #getPrototypeWeightsForUI(emotionName) {
    // Try to get weights from the prototype constraint analyzer if available
    // This is a simplified version - in a full implementation, we'd inject the analyzer
    // For now, return null and the UI will skip axis contributions
    return null;
  }

  /**
   * Compute per-axis contributions for last-mile contexts.
   *
   * @private
   * @param {object[]} contexts - Last-mile contexts
   * @param {object} weights - Prototype weights
   * @returns {object} Axis contributions
   */
  #computeAxisContributionsUI(contexts, weights) {
    const contributions = {};

    for (const [axis, weight] of Object.entries(weights)) {
      const axisContribs = contexts.map((ctx) => {
        const axisValue = ctx.moodAxes?.[axis] ?? 0;
        // Normalize: mood axes are typically [-100, 100], normalize to [-1, 1]
        const normalized = axisValue / 100;
        return normalized * weight;
      });

      const meanContribution =
        axisContribs.reduce((a, b) => a + b, 0) / axisContribs.length;
      const meanAxisValue =
        contexts
          .map((ctx) => ctx.moodAxes?.[axis] ?? 0)
          .reduce((a, b) => a + b, 0) / contexts.length;

      contributions[axis] = {
        weight,
        meanAxisValue,
        meanContribution,
      };
    }

    return contributions;
  }

  /**
   * Find the dominant suppressor axis (most negative contribution).
   *
   * @private
   * @param {object} axisContributions - Axis contributions
   * @returns {{axis: string, contribution: number}|null}
   */
  #findDominantSuppressorUI(axisContributions) {
    let minContribution = 0;
    let dominantAxis = null;

    for (const [axis, data] of Object.entries(axisContributions)) {
      if (data.meanContribution < minContribution) {
        minContribution = data.meanContribution;
        dominantAxis = axis;
      }
    }

    if (!dominantAxis) return null;

    return {
      axis: dominantAxis,
      contribution: minContribution,
    };
  }

  /**
   * Create axis contributions table.
   *
   * @private
   * @param {object} axisContributions - Axis contributions
   * @returns {HTMLTableElement} Table element
   */
  #createAxisContributionsTable(axisContributions) {
    const table = document.createElement('table');
    table.className = 'axis-contributions-table';

    // Header
    const thead = document.createElement('thead');
    thead.innerHTML = `
      <tr>
        <th>Axis</th>
        <th>Weight</th>
        <th>Mean Value</th>
        <th>Mean Contribution</th>
      </tr>
    `;
    table.appendChild(thead);

    // Body - sort by contribution (most negative first)
    const tbody = document.createElement('tbody');
    const entries = Object.entries(axisContributions).sort(
      (a, b) => a[1].meanContribution - b[1].meanContribution
    );

    for (const [axis, data] of entries) {
      const row = document.createElement('tr');
      const contribClass =
        data.meanContribution >= 0 ? 'contribution-positive' : 'contribution-negative';
      const sign = data.meanContribution >= 0 ? '+' : '';
      row.innerHTML = `
        <td><code>${this.#escapeHtml(axis)}</code></td>
        <td>${data.weight >= 0 ? '+' : ''}${data.weight.toFixed(2)}</td>
        <td>${data.meanAxisValue.toFixed(1)}</td>
        <td class="${contribClass}">${sign}${data.meanContribution.toFixed(3)}</td>
      `;
      tbody.appendChild(row);
    }
    table.appendChild(tbody);

    return table;
  }

  /**
   * Create gate conflicts cross-reference table.
   *
   * @private
   * @param {object[]} gateConflicts - Gate conflicts from static analysis
   * @returns {HTMLElement} Container with gate conflicts table
   */
  #createGateConflictsTable(gateConflicts) {
    const container = document.createElement('div');
    container.className = 'cross-reference-table-container';

    const heading = document.createElement('h4');
    heading.textContent = 'Gate Conflicts';
    container.appendChild(heading);

    const table = document.createElement('table');
    table.className = 'results-table cross-reference-table';

    // Header
    const thead = document.createElement('thead');
    thead.innerHTML = `
      <tr>
        <th>Axis</th>
        <th>Conflict</th>
        <th>Static Result</th>
        <th>MC Confirmation</th>
      </tr>
    `;
    table.appendChild(thead);

    // Body
    const tbody = document.createElement('tbody');
    for (const conflict of gateConflicts) {
      const row = document.createElement('tr');
      const axis = conflict.axis || 'unknown';
      const conflictDesc = this.#formatGateConflict(conflict);
      const mcConfirmation = this.#checkMcAxisConfirmation(axis);

      row.innerHTML = `
        <td>${this.#escapeHtml(axis)}</td>
        <td>${this.#escapeHtml(conflictDesc)}</td>
        <td class="static-impossible">❌ Impossible</td>
        <td class="mc-confirmation">${mcConfirmation}</td>
      `;
      tbody.appendChild(row);
    }
    table.appendChild(tbody);
    container.appendChild(table);

    return container;
  }

  /**
   * Create unreachable thresholds cross-reference table.
   *
   * @private
   * @param {object[]} unreachableThresholds - Unreachable thresholds from static analysis
   * @returns {HTMLElement} Container with unreachable thresholds table
   */
  #createUnreachableThresholdsTable(unreachableThresholds) {
    const container = document.createElement('div');
    container.className = 'cross-reference-table-container';

    const heading = document.createElement('h4');
    heading.textContent = 'Unreachable Thresholds';
    container.appendChild(heading);

    const table = document.createElement('table');
    table.className = 'results-table cross-reference-table';

    // Header
    const thead = document.createElement('thead');
    thead.innerHTML = `
      <tr>
        <th>Prototype</th>
        <th>Required</th>
        <th>Max Possible</th>
        <th>Gap</th>
        <th>MC Confirmation</th>
      </tr>
    `;
    table.appendChild(thead);

    // Body
    const tbody = document.createElement('tbody');
    for (const issue of unreachableThresholds) {
      const row = document.createElement('tr');
      const prototypeId = issue.prototypeId || 'unknown';
      const threshold = typeof issue.threshold === 'number' ? this.#formatNumber(issue.threshold) : '?';
      const maxPossible = typeof issue.maxPossible === 'number' ? this.#formatNumber(issue.maxPossible) : '?';
      const gap = typeof issue.threshold === 'number' && typeof issue.maxPossible === 'number'
        ? `+${this.#formatNumber(issue.threshold - issue.maxPossible)}`
        : '?';
      const mcConfirmation = this.#checkMcEmotionConfirmation(prototypeId);

      row.innerHTML = `
        <td>${this.#escapeHtml(prototypeId)}</td>
        <td>${threshold}</td>
        <td>${maxPossible}</td>
        <td class="gap-value">${gap}</td>
        <td class="mc-confirmation">${mcConfirmation}</td>
      `;
      tbody.appendChild(row);
    }
    table.appendChild(tbody);
    container.appendChild(table);

    return container;
  }

  /**
   * Format a gate conflict for display.
   *
   * @private
   * @param {object} conflict - Gate conflict info
   * @returns {string} Human-readable conflict description
   */
  #formatGateConflict(conflict) {
    if (conflict.description) {
      return conflict.description;
    }

    const requiredMin = conflict.requiredMin;
    const requiredMax = conflict.requiredMax;

    if (typeof requiredMin === 'number' && typeof requiredMax === 'number') {
      if (requiredMin > requiredMax) {
        return `Requires ≥${this.#formatNumber(requiredMin)} AND ≤${this.#formatNumber(requiredMax)}`;
      }
    }

    return 'Conflicting constraints';
  }

  /**
   * Check if MC results confirm a static analysis finding for an axis.
   *
   * @private
   * @param {string} axis - Axis name to check
   * @returns {string} HTML string with confirmation status
   */
  #checkMcAxisConfirmation(axis) {
    const blockers = this.#currentBlockers;

    if (!blockers || blockers.length === 0) {
      return '<span class="mc-no-data">— No MC data</span>';
    }

    // Check if any blocker references this axis
    for (const blocker of blockers) {
      const varPath = blocker.hierarchicalBreakdown?.variablePath || '';
      if (varPath.includes(axis) || varPath.includes(`moodAxes.${axis}`)) {
        const failRate = blocker.hierarchicalBreakdown?.failureRate;
        if (typeof failRate === 'number') {
          return `<span class="mc-confirmed">✅ Fails ${this.#formatPercentage(failRate)}</span>`;
        }
        return '<span class="mc-confirmed">✅ Confirmed</span>';
      }
    }

    return '<span class="mc-not-observed">— Not observed</span>';
  }

  /**
   * Check if MC results confirm a static analysis finding for an emotion/prototype.
   *
   * @private
   * @param {string} prototypeId - Emotion or sexual prototype ID
   * @returns {string} HTML string with confirmation status
   */
  #checkMcEmotionConfirmation(prototypeId) {
    const blockers = this.#currentBlockers;

    if (!blockers || blockers.length === 0) {
      return '<span class="mc-no-data">— No MC data</span>';
    }

    // Check if any blocker references this emotion/prototype
    for (const blocker of blockers) {
      const varPath = blocker.hierarchicalBreakdown?.variablePath || '';
      if (varPath.includes(`emotions.${prototypeId}`) || varPath.includes(`sexual.${prototypeId}`)) {
        const failRate = blocker.hierarchicalBreakdown?.failureRate;
        if (typeof failRate === 'number') {
          return `<span class="mc-confirmed">✅ Fails ${this.#formatPercentage(failRate)}</span>`;
        }
        return '<span class="mc-confirmed">✅ Confirmed</span>';
      }
    }

    return '<span class="mc-not-observed">— Not observed</span>';
  }

  /**
   * Display cross-reference summary.
   *
   * @private
   * @param {object[]} gateConflicts - Gate conflicts from static analysis
   * @param {object[]} unreachableThresholds - Unreachable thresholds from static analysis
   */
  #displayCrossReferenceSummary(gateConflicts, unreachableThresholds) {
    if (!this.#crossReferenceSummary) return;

    const totalStaticIssues = gateConflicts.length + unreachableThresholds.length;
    const hasMcBlockers = this.#currentBlockers && this.#currentBlockers.length > 0;

    let summaryHtml = '';

    if (totalStaticIssues > 0 && hasMcBlockers) {
      summaryHtml = `
        <div class="cross-reference-summary-confirmed">
          ✅ <strong>Confirmed</strong>: Static analysis issues are corroborated by Monte Carlo simulation.
        </div>
      `;
    } else if (totalStaticIssues > 0 && !hasMcBlockers) {
      summaryHtml = `
        <div class="cross-reference-summary-discrepancy">
          ⚠️ <strong>Discrepancy</strong>: Static analysis found issues but MC shows no blockers. May indicate path-sensitivity.
        </div>
      `;
    } else {
      summaryHtml = `
        <div class="cross-reference-summary-agreement">
          ✅ <strong>Agreement</strong>: Both analyses agree on the expression state.
        </div>
      `;
    }

    this.#crossReferenceSummary.innerHTML = summaryHtml;
  }

  // ========== Path-Sensitive Analysis Methods ==========

  /**
   * Run path-sensitive analysis on the selected expression.
   *
   * @private
   */
  async #runPathSensitiveAnalysis() {
    if (!this.#selectedExpression) return;

    this.#logger.info(
      `Running path-sensitive analysis for: ${this.#selectedExpression.id}`
    );

    try {
      const result = await this.#pathSensitiveAnalyzer.analyze(
        this.#selectedExpression
      );
      this.#currentPathSensitiveResult = result;

      // Update DiagnosticResult with path-sensitive analysis
      // This can override impossibility if feasible branches exist
      if (this.#currentResult) {
        this.#currentResult.setPathSensitiveResults({
          overallStatus: result.overallStatus,
          feasibleBranchCount: result.feasibleBranchCount,
          branchCount: result.branchCount,
        });
        // Refresh status display after path-sensitive update
        this.#updateStatusFromResult();
      }

      this.#displayPathSensitiveResults(result);
    } catch (error) {
      this.#logger.error('Path-sensitive analysis failed:', error);
      this.#resetPathSensitiveResults();
    }
  }

  /**
   * Display path-sensitive analysis results.
   *
   * @private
   * @param {import('../../expressionDiagnostics/models/PathSensitiveResult.js').default} result
   */
  #displayPathSensitiveResults(result) {
    if (!this.#pathSensitiveSection) return;

    // Show the section
    this.#pathSensitiveSection.hidden = false;

    // Update summary
    if (this.#pathSensitiveSummary) {
      this.#pathSensitiveSummary.dataset.status = result.overallStatus;
    }
    if (this.#psStatusIndicator) {
      this.#psStatusIndicator.textContent = result.statusEmoji;
    }
    if (this.#psSummaryMessage) {
      this.#psSummaryMessage.textContent = result.getSummaryMessage();
    }

    // Update counts
    if (this.#branchCount) {
      this.#branchCount.textContent = result.branchCount;
    }
    if (this.#reachableCount) {
      this.#reachableCount.textContent = result.fullyReachableBranchIds.length;
    }

    // Render branch cards
    this.#renderBranchCards(result);

    // Render knife-edge summary
    this.#renderKnifeEdgeSummary(result);
  }

  /**
   * Render branch cards for path-sensitive results.
   *
   * @private
   * @param {import('../../expressionDiagnostics/models/PathSensitiveResult.js').default} result
   */
  #renderBranchCards(result) {
    if (!this.#branchCardsContainer) return;

    this.#branchCardsContainer.innerHTML = '';

    const template = document.getElementById('branch-card-template');
    if (!template) {
      this.#logger.warn('Branch card template not found');
      return;
    }

    for (const branch of result.branches) {
      const card = this.#createBranchCard(branch, result, template);
      this.#branchCardsContainer.appendChild(card);
    }

    this.#applyBranchFilter();
  }

  /**
   * Apply branch visibility filter based on toggle state.
   * Hides reachable branches unless "Show All" is enabled.
   *
   * @private
   */
  #applyBranchFilter() {
    if (!this.#branchCardsContainer) return;

    const cards = this.#branchCardsContainer.querySelectorAll('.branch-card');
    for (const card of cards) {
      if (card.dataset.status === 'reachable') {
        card.classList.toggle('filtered-hidden', !this.#showAllBranches);
      }
    }
  }

  /**
   * Create a single branch card element.
   *
   * @private
   * @param {import('../../expressionDiagnostics/models/AnalysisBranch.js').default} branch
   * @param {import('../../expressionDiagnostics/models/PathSensitiveResult.js').default} result
   * @param {HTMLTemplateElement} template
   * @returns {HTMLElement}
   */
  #createBranchCard(branch, result, template) {
    const card = template.content.cloneNode(true).querySelector('.branch-card');

    // Determine status
    let status = 'reachable';
    if (branch.isInfeasible) {
      status = 'infeasible';
    } else if (branch.knifeEdges && branch.knifeEdges.length > 0) {
      status = 'knife-edge';
    } else {
      const branchReachability = result.getReachabilityForBranch(branch.branchId);
      const allReachable = branchReachability.every((r) => r.isReachable);
      if (!allReachable) {
        status = 'unreachable';
      }
    }

    card.dataset.status = status;

    // Status icon
    const statusIcons = {
      reachable: '✅',
      'knife-edge': '⚠️',
      unreachable: '❌',
      infeasible: '🚫',
    };
    const statusIcon = card.querySelector('.branch-status-icon');
    if (statusIcon) {
      statusIcon.textContent = statusIcons[status];
    }

    // Title
    const title = card.querySelector('.branch-title');
    if (title) {
      title.textContent = branch.description || `Branch ${branch.branchId}`;
    }

    // Prototypes - show active (gates enforced) vs inactive (gates ignored) partitioning
    const prototypeList = card.querySelector('.prototype-list');
    if (prototypeList) {
      const activePrototypes = branch.activePrototypes || [];
      const inactivePrototypes = branch.inactivePrototypes || [];

      if (activePrototypes.length > 0 || inactivePrototypes.length > 0) {
        // Show partitioned view when we have direction info
        const parts = [];
        if (activePrototypes.length > 0) {
          parts.push(`Active (gates enforced): ${activePrototypes.join(', ')}`);
        }
        if (inactivePrototypes.length > 0) {
          parts.push(`Inactive (gates ignored): ${inactivePrototypes.join(', ')}`);
        }
        prototypeList.innerHTML = parts.join('<br>');
      } else {
        // Fallback to old behavior
        prototypeList.textContent =
          branch.requiredPrototypes?.join(', ') || 'none';
      }
    }

    // Threshold table (if unreachable or knife-edge)
    if (status === 'unreachable' || status === 'knife-edge') {
      const branchReachability = result.getReachabilityForBranch(branch.branchId);
      const unreachable = branchReachability.filter((r) => !r.isReachable);

      if (unreachable.length > 0) {
        const thresholdsDiv = card.querySelector('.branch-thresholds');
        if (thresholdsDiv) {
          thresholdsDiv.hidden = false;

          const tbody = card.querySelector('.threshold-tbody');
          if (tbody) {
            for (const r of unreachable) {
              const row = document.createElement('tr');
              row.innerHTML = `
                <td>${this.#escapeHtml(r.prototypeId)}</td>
                <td>${r.threshold.toFixed(2)}</td>
                <td>${r.maxPossible.toFixed(2)}</td>
                <td>${r.gap.toFixed(2)}</td>
              `;
              tbody.appendChild(row);
            }
          }
        }
      }
    }

    // Knife-edge warning
    if (branch.knifeEdges && branch.knifeEdges.length > 0) {
      const keDiv = card.querySelector('.branch-knife-edges');
      if (keDiv) {
        keDiv.hidden = false;

        const keMessage = branch.knifeEdges
          .map((ke) => {
            // Use dual-scale format if available, fall back to legacy formats
            const interval =
              typeof ke.formatDualScaleInterval === 'function'
                ? ke.formatDualScaleInterval()
                : typeof ke.formatInterval === 'function'
                  ? ke.formatInterval()
                  : `[${ke.min?.toFixed(2) || '?'}, ${ke.max?.toFixed(2) || '?'}]`;
            return `${ke.axis}: ${interval}`;
          })
          .join('; ');
        const keMessageEl = card.querySelector('.ke-message');
        if (keMessageEl) {
          keMessageEl.textContent = keMessage;
        }
      }
    }

    return card;
  }

  /**
   * Render knife-edge summary section.
   *
   * @private
   * @param {import('../../expressionDiagnostics/models/PathSensitiveResult.js').default} result
   */
  #renderKnifeEdgeSummary(result) {
    if (!this.#knifeEdgeSummary) return;

    const allKnifeEdges = result.allKnifeEdges;

    if (allKnifeEdges.length === 0) {
      this.#knifeEdgeSummary.hidden = true;
      return;
    }

    this.#knifeEdgeSummary.hidden = false;

    if (this.#keCount) {
      this.#keCount.textContent = allKnifeEdges.length;
    }

    if (this.#knifeEdgeTbody) {
      this.#knifeEdgeTbody.innerHTML = '';

      for (const ke of allKnifeEdges) {
        const row = document.createElement('tr');
        // Use dual-scale format if available, fall back to legacy formats
        const interval =
          typeof ke.formatDualScaleInterval === 'function'
            ? ke.formatDualScaleInterval()
            : typeof ke.formatInterval === 'function'
              ? ke.formatInterval()
              : `[${ke.min?.toFixed(2) || '?'}, ${ke.max?.toFixed(2) || '?'}]`;
        const width =
          typeof ke.width === 'number' ? ke.width.toFixed(3) : '?';
        const rawWidth =
          typeof ke.width === 'number' ? Math.round(ke.width * 100) : '?';
        const contributors =
          typeof ke.formatContributors === 'function'
            ? ke.formatContributors()
            : ke.contributingPrototypes?.join(', ') || '-';

        row.innerHTML = `
          <td>${this.#escapeHtml(ke.axis || '-')}</td>
          <td>${interval}</td>
          <td>${width} (raw: ${rawWidth})</td>
          <td>${this.#escapeHtml(contributors)}</td>
          <td>${this.#escapeHtml(ke.branchId || '-')}</td>
        `;
        this.#knifeEdgeTbody.appendChild(row);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Prototype Fit Analysis Display Methods
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Display all prototype fit analysis sections: prototype fit, implied prototype, gap detection.
   *
   * @private
   */
  async #displayPrototypeFitAnalysisAsync() {
    // Require service and data
    if (!this.#prototypeFitRankingService) {
      this.#hidePrototypeFitSections();
      return;
    }

    if (!this.#selectedExpression || !this.#rawSimulationResult?.storedContexts) {
      this.#hidePrototypeFitSections();
      return;
    }

    const prerequisites = this.#selectedExpression.prerequisites || [];
    const storedContexts = this.#rawSimulationResult.storedContexts;
    const hasOrMoodConstraints = this.#hasOrMoodConstraintsForUI(prerequisites);

    try {
      // Perform all three analyses
      const fitResults = await this.#prototypeFitRankingService.analyzeAllPrototypeFitAsync(
        prerequisites,
        storedContexts
      );
      const impliedPrototype = await this.#prototypeFitRankingService.computeImpliedPrototypeAsync(
        prerequisites,
        storedContexts
      );
      const gapDetection = await this.#prototypeFitRankingService.detectPrototypeGapsAsync(
        prerequisites,
        storedContexts
      );

      // Display each section
      // analyzeAllPrototypeFit returns { leaderboard, currentPrototype, bestAlternative, improvementFactor }
      this.#displayPrototypeFitTable(fitResults?.leaderboard ?? [], hasOrMoodConstraints);
      this.#displayImpliedPrototype(impliedPrototype, hasOrMoodConstraints);
      this.#displayGapDetection(gapDetection);
    } catch (err) {
      this.#logger.error('Failed to display prototype fit analysis:', err);
      this.#hidePrototypeFitSections();
    }
  }

  /**
   * Hide all prototype fit analysis sections.
   *
   * @private
   */
  #hidePrototypeFitSections() {
    if (this.#prototypeFitAnalysisContainer) {
      this.#prototypeFitAnalysisContainer.hidden = true;
    }
    this.#toggleOrConstraintWarning(this.#prototypeFitWarning, false);
    if (this.#impliedPrototypeContainer) {
      this.#impliedPrototypeContainer.hidden = true;
    }
    this.#toggleOrConstraintWarning(this.#impliedPrototypeWarning, false);
    if (this.#gapDetectionContainer) {
      this.#gapDetectionContainer.hidden = true;
    }
  }

  /**
   * Display the prototype fit analysis table.
   *
   * @private
   * @param {Array<object>} fitResults - Array of prototype fit results
   */
  #displayPrototypeFitTable(fitResults, hasOrMoodConstraints = false) {
    if (!this.#prototypeFitAnalysisContainer || !this.#prototypeFitTbody) {
      return;
    }

    // Defensive: ensure fitResults is an array
    if (!Array.isArray(fitResults) || fitResults.length === 0) {
      this.#prototypeFitAnalysisContainer.hidden = true;
      this.#toggleOrConstraintWarning(this.#prototypeFitWarning, false);
      return;
    }

    this.#prototypeFitAnalysisContainer.hidden = false;
    this.#prototypeFitTbody.innerHTML = '';
    this.#toggleOrConstraintWarning(this.#prototypeFitWarning, hasOrMoodConstraints);

    // Display top 10 results
    const topResults = fitResults.slice(0, 10);

    for (const result of topResults) {
      const row = document.createElement('tr');

      // Color coding for composite score
      const scoreClass = this.#getScoreColorClass(result.compositeScore);

      // Gate pass rate
      const gatePassPercent = (result.gatePassRate * 100).toFixed(1);

      // P(I >= threshold)
      const intensityPercent = result.intensityDistribution?.pAboveThreshold
        ? (result.intensityDistribution.pAboveThreshold * 100).toFixed(1)
        : '-';

      // Conflict indicator
      const conflictClass = result.conflictScore > 0.3 ? 'conflict-high' : '';
      const conflictPercent = (result.conflictScore * 100).toFixed(0);

      // Composite score
      const compositePercent = (result.compositeScore * 100).toFixed(1);

      row.innerHTML = `
        <td class="rank-cell">${result.rank}</td>
        <td class="prototype-name">${this.#escapeHtml(result.prototypeId)}</td>
        <td>${gatePassPercent}%</td>
        <td>${intensityPercent}%</td>
        <td class="${conflictClass}">${conflictPercent}%</td>
        <td class="${scoreClass}">${compositePercent}%</td>
      `;
      this.#prototypeFitTbody.appendChild(row);
    }

    // Display details for top 3
    this.#displayPrototypeFitDetails(topResults.slice(0, 3));

    // Display suggestion if best fit is poor
    this.#displayPrototypeFitSuggestionIfNeeded(topResults);
  }

  /**
   * Display detailed breakdown for top prototypes.
   *
   * @private
   * @param {Array<object>} topResults - Top prototype results
   */
  #displayPrototypeFitDetails(topResults) {
    if (!this.#prototypeFitDetails) return;

    this.#prototypeFitDetails.innerHTML = '';

    for (const result of topResults) {
      const detailCard = document.createElement('div');
      detailCard.className = 'prototype-detail-card';

      // Build intensity quantiles string
      const dist = result.intensityDistribution || {};
      const quantiles = `P50: ${(dist.p50 ?? 0).toFixed(2)} | P90: ${(dist.p90 ?? 0).toFixed(2)} | P95: ${(dist.p95 ?? 0).toFixed(2)}`;

      // Build conflicts list
      const conflictsList = result.conflictingAxes?.length > 0
        ? result.conflictingAxes.map(c =>
            `${c.axis} (w=${c.weight?.toFixed(2) || '?'}, dir=${c.direction || '?'})`
          ).join(', ')
        : 'None';

      const range = result.inRegimeAchievableRange ?? {};
      const rangeLabel =
        Number.isFinite(range.min) && Number.isFinite(range.max)
          ? `[${this.#formatNumber(range.min)}, ${this.#formatNumber(range.max)}]`
          : 'N/A';
      const gateCompatibility = result.gateCompatibility;
      const gateLabel =
        gateCompatibility?.compatible === true
          ? '✅ compatible'
          : gateCompatibility?.compatible === false
            ? '⚠️ incompatible'
            : 'N/A';
      const gateReason = gateCompatibility?.reason
        ? ` (${this.#escapeHtml(gateCompatibility.reason)})`
        : '';

      detailCard.innerHTML = `
        <h4>#${result.rank} ${this.#escapeHtml(result.prototypeId)}</h4>
        <div class="detail-row">
          <span class="detail-label">Intensity Quantiles:</span>
          <span class="detail-value">${quantiles}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Conflict Magnitude:</span>
          <span class="detail-value">${(result.conflictMagnitude ?? 0).toFixed(2)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Conflicting Axes:</span>
          <span class="detail-value conflicts-list">${conflictsList}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Gate Compatibility (regime):</span>
          <span class="detail-value">${gateLabel}${gateReason}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">In-Regime Range (gated):</span>
          <span class="detail-value">${rangeLabel}</span>
        </div>
      `;
      this.#prototypeFitDetails.appendChild(detailCard);
    }
  }

  /**
   * Display a suggestion if the best prototype fit is poor.
   *
   * @private
   * @param {Array<object>} topResults - Top prototype results
   */
  #displayPrototypeFitSuggestionIfNeeded(topResults) {
    if (!this.#prototypeFitSuggestion) return;

    this.#prototypeFitSuggestion.innerHTML = '';

    if (!topResults || topResults.length === 0) return;

    const best = topResults[0];
    // Suggest if composite score < 30% or P(I>=t) < 20%
    const pAbove = best.intensityDistribution?.pAboveThreshold ?? 0;
    if (best.compositeScore < 0.3 || pAbove < 0.2) {
      this.#prototypeFitSuggestion.innerHTML = `
        <div class="suggestion-warning">
          <span class="suggestion-icon">💡</span>
          <span class="suggestion-text">
            Best matching prototype (<strong>${this.#escapeHtml(best.prototypeId)}</strong>)
            has weak fit (${(best.compositeScore * 100).toFixed(0)}% composite,
            ${(pAbove * 100).toFixed(0)}% intensity pass rate).
            Consider reviewing the expression's prerequisites or creating a new prototype.
          </span>
        </div>
      `;
    }
  }

  /**
   * Display the implied prototype analysis.
   *
   * @private
   * @param {object|null} impliedAnalysis - Implied prototype analysis result
   */
  #displayImpliedPrototype(impliedAnalysis, hasOrMoodConstraints = false) {
    if (!this.#impliedPrototypeContainer) return;

    if (!impliedAnalysis) {
      this.#impliedPrototypeContainer.hidden = true;
      this.#toggleOrConstraintWarning(this.#impliedPrototypeWarning, false);
      return;
    }

    this.#impliedPrototypeContainer.hidden = false;
    this.#toggleOrConstraintWarning(this.#impliedPrototypeWarning, hasOrMoodConstraints);

    // Display target signature
    this.#displayTargetSignature(impliedAnalysis.targetSignature);

    // Display ranking tables
    this.#displayImpliedRankings(
      impliedAnalysis.bySimilarity,
      impliedAnalysis.byGatePass,
      impliedAnalysis.byCombined
    );
  }

  /**
   * Display the target signature table.
   *
   * @private
   * @param {Map<string, {direction: number, importance: number}>} targetSignature - Target signature map
   */
  #displayTargetSignature(targetSignature) {
    if (!this.#targetSignatureTbody) return;

    this.#targetSignatureTbody.innerHTML = '';

    if (!targetSignature || targetSignature.size === 0) return;

    // Sort by importance descending
    const entries = Array.from(targetSignature.entries())
      .sort((a, b) => b[1].importance - a[1].importance);

    for (const [axis, data] of entries) {
      const row = document.createElement('tr');

      const directionLabel = data.direction > 0 ? '↑ High' : data.direction < 0 ? '↓ Low' : '— Neutral';
      const directionClass = data.direction > 0 ? 'direction-high' : data.direction < 0 ? 'direction-low' : '';
      const importancePercent = (data.importance * 100).toFixed(0);

      row.innerHTML = `
        <td>${this.#escapeHtml(axis)}</td>
        <td class="${directionClass}">${directionLabel}</td>
        <td>${importancePercent}%</td>
      `;
      this.#targetSignatureTbody.appendChild(row);
    }
  }

  /**
   * Display implied prototype ranking tables.
   *
   * @private
   * @param {Array} bySimilarity - Top 5 by similarity
   * @param {Array} byGatePass - Top 5 by gate pass
   * @param {Array} byCombined - Top 5 by combined score
   */
  #displayImpliedRankings(bySimilarity, byGatePass, byCombined) {
    this.#populateImpliedRankingTable(this.#similarityRankingTbody, bySimilarity, 'similarity');
    this.#populateImpliedRankingTable(this.#gatePassRankingTbody, byGatePass, 'gatePass');
    this.#populateImpliedRankingTable(this.#combinedRankingTbody, byCombined, 'combined');
  }

  /**
   * Populate an implied prototype ranking table.
   *
   * @private
   * @param {HTMLElement|null} tbody - The tbody element
   * @param {Array} rankings - Array of ranking results
   * @param {string} primaryMetric - 'similarity' | 'gatePass' | 'combined'
   */
  #populateImpliedRankingTable(tbody, rankings, primaryMetric) {
    if (!tbody) return;

    tbody.innerHTML = '';

    if (!rankings || rankings.length === 0) return;

    for (let i = 0; i < rankings.length; i++) {
      const result = rankings[i];
      const row = document.createElement('tr');

      const similarity = ((result.cosineSimilarity ?? 0) * 100).toFixed(0);
      const gatePass = ((result.gatePassRate ?? 0) * 100).toFixed(0);
      const combined = ((result.combinedScore ?? 0) * 100).toFixed(0);

      // Highlight the primary metric
      const simClass = primaryMetric === 'similarity' ? 'primary-metric' : '';
      const gateClass = primaryMetric === 'gatePass' ? 'primary-metric' : '';
      const combClass = primaryMetric === 'combined' ? 'primary-metric' : '';

      row.innerHTML = `
        <td class="rank-cell">${i + 1}</td>
        <td class="prototype-name">${this.#escapeHtml(result.prototypeId)}</td>
        <td class="${simClass}">${similarity}%</td>
        <td class="${gateClass}">${gatePass}%</td>
        <td class="${combClass}">${combined}%</td>
      `;
      tbody.appendChild(row);
    }
  }

  /**
   * Display gap detection results.
   *
   * @private
   * @param {object|null} gapResult - Gap detection result
   */
  #displayGapDetection(gapResult) {
    if (!this.#gapDetectionContainer) return;

    if (!gapResult) {
      this.#gapDetectionContainer.hidden = true;
      return;
    }

    this.#gapDetectionContainer.hidden = false;

    // Display gap status indicator
    this.#displayGapStatus(gapResult);

    // Display nearest prototypes table
    this.#displayNearestPrototypes(gapResult.kNearestNeighbors);

    // Display suggested prototype if gap detected
    this.#displaySuggestedPrototype(gapResult);
  }

  /**
   * Display gap detection status indicator.
   *
   * @private
   * @param {object} gapResult - Gap detection result
   */
  #displayGapStatus(gapResult) {
    if (!this.#gapStatus) return;

    const distance = (gapResult.nearestDistance ?? 0).toFixed(2);
    const contextHtml = gapResult.distanceContext
      ? `<div class="gap-context">${this.#escapeHtml(gapResult.distanceContext)}</div>`
      : '';

    if (gapResult.gapDetected) {
      this.#gapStatus.innerHTML = `
        <div class="gap-status-warning">
          <span class="gap-icon">⚠️</span>
          <span class="gap-message">
            <strong>Coverage Gap Detected</strong> -
            Nearest prototype is ${distance} units away.
            ${gapResult.coverageWarning || 'No existing prototype closely matches this expression\'s constraint pattern.'}
          </span>
          ${contextHtml}
        </div>
      `;
    } else {
      this.#gapStatus.innerHTML = `
        <div class="gap-status-ok">
          <span class="gap-icon">✅</span>
          <span class="gap-message">
            <strong>Good Coverage</strong> -
            Nearest prototype is ${distance} units away.
            Existing prototypes adequately cover this expression's constraint pattern.
          </span>
          ${contextHtml}
        </div>
      `;
    }
  }

  /**
   * Display k-nearest prototypes table.
   *
   * @private
   * @param {Array} neighbors - k-nearest neighbor results
   */
  #displayNearestPrototypes(neighbors) {
    if (!this.#nearestPrototypesTbody) return;

    this.#nearestPrototypesTbody.innerHTML = '';

    if (!neighbors || neighbors.length === 0) return;

    for (let i = 0; i < neighbors.length; i++) {
      const neighbor = neighbors[i];
      const row = document.createElement('tr');

      const distance = (neighbor.combinedDistance ?? 0).toFixed(3);
      const weightDist = (neighbor.weightDistance ?? 0).toFixed(3);
      const gateDist = (neighbor.gateDistance ?? 0).toFixed(3);

      // Color code distance
      const distanceClass = this.#getDistanceColorClass(neighbor.combinedDistance ?? 0);

      row.innerHTML = `
        <td class="rank-cell">${i + 1}</td>
        <td class="prototype-name">${this.#escapeHtml(neighbor.prototypeId)}</td>
        <td class="${distanceClass}">${distance}</td>
        <td>${weightDist}</td>
        <td>${gateDist}</td>
      `;
      this.#nearestPrototypesTbody.appendChild(row);
    }
  }

  /**
   * Display suggested prototype if gap is detected.
   *
   * @private
   * @param {object} gapResult - Gap detection result
   */
  #displaySuggestedPrototype(gapResult) {
    if (!this.#suggestedPrototypeSection || !this.#suggestedPrototypeContent) {
      return;
    }

    if (!gapResult.gapDetected || !gapResult.suggestedPrototype) {
      this.#suggestedPrototypeSection.hidden = true;
      return;
    }

    this.#suggestedPrototypeSection.hidden = false;

    const suggested = gapResult.suggestedPrototype;

    // Build weights display
    const weightsHtml = Object.entries(suggested.weights || {})
      .map(([axis, weight]) => `<span class="suggested-weight">${axis}: ${weight.toFixed(2)}</span>`)
      .join(' ');

    // Build gates display
    const gatesHtml = (suggested.gates || [])
      .map(gate => `<span class="suggested-gate">${this.#escapeHtml(gate)}</span>`)
      .join(' ');

    this.#suggestedPrototypeContent.innerHTML = `
      <div class="suggested-prototype-card">
        <div class="suggested-section">
          <h5>Suggested Weights</h5>
          <div class="suggested-weights">${weightsHtml || 'None'}</div>
        </div>
        <div class="suggested-section">
          <h5>Suggested Gates</h5>
          <div class="suggested-gates">${gatesHtml || 'None'}</div>
        </div>
        <div class="suggested-section">
          <h5>Rationale</h5>
          <p class="suggested-rationale">${this.#escapeHtml(suggested.rationale || 'Distance-weighted average of nearest prototypes.')}</p>
        </div>
      </div>
    `;
  }

  /**
   * Get CSS class for composite score color coding.
   *
   * @private
   * @param {number} score - Composite score 0-1
   * @returns {string} CSS class
   */
  #getScoreColorClass(score) {
    if (score >= 0.7) return 'score-high';
    if (score >= 0.4) return 'score-medium';
    return 'score-low';
  }

  /**
   * Get CSS class for distance color coding.
   *
   * @private
   * @param {number} distance - Distance value
   * @returns {string} CSS class
   */
  #getDistanceColorClass(distance) {
    if (distance <= 0.3) return 'distance-close';
    if (distance <= 0.5) return 'distance-medium';
    return 'distance-far';
  }

  /**
   * Reset path-sensitive results display.
   *
   * @private
   */
  #resetPathSensitiveResults() {
    this.#currentPathSensitiveResult = null;

    if (this.#pathSensitiveSection) {
      this.#pathSensitiveSection.hidden = true;
    }
    if (this.#branchCardsContainer) {
      this.#branchCardsContainer.innerHTML = '';
    }
    if (this.#knifeEdgeTbody) {
      this.#knifeEdgeTbody.innerHTML = '';
    }
    if (this.#knifeEdgeSummary) {
      this.#knifeEdgeSummary.hidden = true;
    }
  }
}

export default ExpressionDiagnosticsController;
