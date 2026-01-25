/**
 * @file MonteCarloReportGenerator - Generates markdown reports from Monte Carlo simulation results
 * @see specs/monte-carlo-report-generator.md
 */

import { getTunableVariableInfo } from '../config/advancedMetricsConfig.js';
import { validateDependency } from '../../utils/dependencyUtils.js';
import {
  evaluateConstraint,
  extractMoodConstraints,
  filterContextsByConstraints,
  formatConstraints,
  hasOrMoodConstraints,
  convertAxisConstraintsToMoodConstraints,
  mergeConstraints,
} from '../utils/moodRegimeUtils.js';
import {
  REPORT_INTEGRITY_EPSILON,
  buildReportIntegrityWarning,
} from '../utils/reportIntegrityUtils.js';
import {
  evaluateSweepMonotonicity,
  findBaselineGridPoint,
} from '../utils/sweepIntegrityUtils.js';
import RecommendationFactsBuilder from './RecommendationFactsBuilder.js';
import RecommendationEngine from './RecommendationEngine.js';
import ReportFormattingService from './ReportFormattingService.js';
import WitnessFormatter from './WitnessFormatter.js';
import StatisticalComputationService from './StatisticalComputationService.js';
import ReportDataExtractor from './ReportDataExtractor.js';
import BlockerTreeTraversal from './BlockerTreeTraversal.js';
import ReportIntegrityAnalyzer from './ReportIntegrityAnalyzer.js';
import PrototypeSectionGenerator from './sectionGenerators/PrototypeSectionGenerator.js';
import SensitivitySectionGenerator from './sectionGenerators/SensitivitySectionGenerator.js';
import BlockerSectionGenerator from './sectionGenerators/BlockerSectionGenerator.js';
import CoreSectionGenerator from './sectionGenerators/CoreSectionGenerator.js';
import NonAxisClauseExtractor from './NonAxisClauseExtractor.js';
import NonAxisFeasibilityAnalyzer from './NonAxisFeasibilityAnalyzer.js';
import FitFeasibilityConflictDetector from './FitFeasibilityConflictDetector.js';
import NonAxisFeasibilitySectionGenerator from './sectionGenerators/NonAxisFeasibilitySectionGenerator.js';
import ConflictWarningSectionGenerator from './sectionGenerators/ConflictWarningSectionGenerator.js';

/**
 * Generates comprehensive markdown reports from Monte Carlo simulation results.
 * This is a pure data-transformation service with no UI dependencies.
 */
class MonteCarloReportGenerator {
  #logger;
  #prototypeConstraintAnalyzer;
  #prototypeFitRankingService;
  #prototypeSynthesisService;
  #formattingService;
  #witnessFormatter;
  #statisticalService;
  #dataExtractor;
  #treeTraversal;
  #integrityAnalyzer;
  #coreSectionGenerator;
  #prototypeSectionGenerator;
  #sensitivitySectionGenerator;
  #blockerSectionGenerator;
  #prototypeGateAlignmentAnalyzer;
  #nonAxisClauseExtractor;
  #nonAxisFeasibilityAnalyzer;
  #fitFeasibilityConflictDetector;
  #nonAxisFeasibilitySectionGenerator;
  #conflictWarningSectionGenerator;
  #actionabilitySectionGenerator;
  #emotionSimilarityService;

  /**
   * @param {object} deps
   * @param {import('../../interfaces/coreServices.js').ILogger} deps.logger
   * @param {import('./PrototypeConstraintAnalyzer.js').default} [deps.prototypeConstraintAnalyzer] - Optional analyzer for prototype math
   * @param {import('./PrototypeFitRankingService.js').default} [deps.prototypeFitRankingService] - Optional service for prototype fit analysis
   * @param {import('./PrototypeSynthesisService.js').default} [deps.prototypeSynthesisService] - Optional service for prototype synthesis
   * @param {import('./ReportFormattingService.js').default} [deps.formattingService] - Optional formatting service (created internally if not provided)
   * @param {import('./WitnessFormatter.js').default} [deps.witnessFormatter] - Optional witness formatter (created internally if not provided)
   * @param {import('./StatisticalComputationService.js').default} [deps.statisticalService] - Optional statistical computation service (created internally if not provided)
   * @param {import('./ReportDataExtractor.js').default} [deps.dataExtractor] - Optional data extractor service (created internally if not provided)
   * @param {import('./BlockerTreeTraversal.js').default} [deps.treeTraversal] - Optional tree traversal service (created internally if not provided)
   * @param {import('./ReportIntegrityAnalyzer.js').default} [deps.integrityAnalyzer] - Optional integrity analyzer (created internally if not provided)
   * @param {import('./sectionGenerators/CoreSectionGenerator.js').default} [deps.coreSectionGenerator] - Optional core section generator (created internally if not provided)
   * @param {import('./sectionGenerators/PrototypeSectionGenerator.js').default} [deps.prototypeSectionGenerator] - Optional prototype section generator (created internally if not provided)
   * @param {import('./sectionGenerators/SensitivitySectionGenerator.js').default} [deps.sensitivitySectionGenerator] - Optional sensitivity section generator (created internally if not provided)
   * @param {import('./sectionGenerators/BlockerSectionGenerator.js').default} [deps.blockerSectionGenerator] - Optional blocker section generator (created internally if not provided)
   * @param {import('./PrototypeGateAlignmentAnalyzer.js').default} [deps.prototypeGateAlignmentAnalyzer] - Optional prototype gate alignment analyzer
   * @param {import('./NonAxisClauseExtractor.js').default} [deps.nonAxisClauseExtractor] - Optional non-axis clause extractor (created via lazy init if not provided)
   * @param {import('./NonAxisFeasibilityAnalyzer.js').default} [deps.nonAxisFeasibilityAnalyzer] - Optional non-axis feasibility analyzer (created via lazy init if not provided)
   * @param {import('./FitFeasibilityConflictDetector.js').default} [deps.fitFeasibilityConflictDetector] - Optional fit/feasibility conflict detector (created via lazy init if not provided)
   * @param {import('./sectionGenerators/NonAxisFeasibilitySectionGenerator.js').default} [deps.nonAxisFeasibilitySectionGenerator] - Optional non-axis feasibility section generator (created via lazy init if not provided)
   * @param {import('./sectionGenerators/ConflictWarningSectionGenerator.js').default} [deps.conflictWarningSectionGenerator] - Optional conflict warning section generator (created via lazy init if not provided)
   * @param {import('./sectionGenerators/ActionabilitySectionGenerator.js').default} [deps.actionabilitySectionGenerator] - Optional actionability section generator
   * @param {import('./EmotionSimilarityService.js').default} [deps.emotionSimilarityService] - Optional emotion similarity service for overconstrained detection
   */
  constructor({
    logger,
    prototypeConstraintAnalyzer = null,
    prototypeFitRankingService = null,
    prototypeSynthesisService = null,
    formattingService = null,
    witnessFormatter = null,
    statisticalService = null,
    dataExtractor = null,
    treeTraversal = null,
    integrityAnalyzer = null,
    coreSectionGenerator = null,
    prototypeSectionGenerator = null,
    sensitivitySectionGenerator = null,
    blockerSectionGenerator = null,
    prototypeGateAlignmentAnalyzer = null,
    nonAxisClauseExtractor = null,
    nonAxisFeasibilityAnalyzer = null,
    fitFeasibilityConflictDetector = null,
    nonAxisFeasibilitySectionGenerator = null,
    conflictWarningSectionGenerator = null,
    actionabilitySectionGenerator = null,
    emotionSimilarityService = null,
  }) {
    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });
    this.#logger = logger;
    this.#prototypeConstraintAnalyzer = prototypeConstraintAnalyzer;
    this.#prototypeFitRankingService = prototypeFitRankingService;
    this.#prototypeSynthesisService = prototypeSynthesisService;
    this.#formattingService = formattingService ?? new ReportFormattingService();
    this.#witnessFormatter =
      witnessFormatter ??
      new WitnessFormatter({ formattingService: this.#formattingService });
    this.#statisticalService =
      statisticalService ?? new StatisticalComputationService();
    this.#dataExtractor =
      dataExtractor ??
      new ReportDataExtractor({
        logger: this.#logger,
        prototypeConstraintAnalyzer: this.#prototypeConstraintAnalyzer,
      });
    this.#treeTraversal = treeTraversal ?? new BlockerTreeTraversal();
    this.#integrityAnalyzer =
      integrityAnalyzer ??
      new ReportIntegrityAnalyzer({
        formattingService: this.#formattingService,
        statisticalService: this.#statisticalService,
        treeTraversal: this.#treeTraversal,
        dataExtractor: this.#dataExtractor,
        prototypeConstraintAnalyzer: this.#prototypeConstraintAnalyzer,
        logger: this.#logger,
      });
    this.#coreSectionGenerator =
      coreSectionGenerator ??
      new CoreSectionGenerator({
        formattingService: this.#formattingService,
        witnessFormatter: this.#witnessFormatter,
        statisticalService: this.#statisticalService,
        dataExtractor: this.#dataExtractor,
      });
    this.#prototypeSectionGenerator =
      prototypeSectionGenerator ??
      new PrototypeSectionGenerator({
        formattingService: this.#formattingService,
        witnessFormatter: this.#witnessFormatter,
        statisticalService: this.#statisticalService,
        dataExtractor: this.#dataExtractor,
        treeTraversal: this.#treeTraversal,
        prototypeConstraintAnalyzer: this.#prototypeConstraintAnalyzer,
        prototypeFitRankingService: this.#prototypeFitRankingService,
        logger: this.#logger,
      });
    this.#sensitivitySectionGenerator =
      sensitivitySectionGenerator ??
      new SensitivitySectionGenerator({
        formattingService: this.#formattingService,
        sweepWarningBuilder: (result, options) =>
          this.#buildSweepWarningsForResult(result, options),
      });
    this.#blockerSectionGenerator =
      blockerSectionGenerator ??
      new BlockerSectionGenerator({
        formattingService: this.#formattingService,
        treeTraversal: this.#treeTraversal,
        dataExtractor: this.#dataExtractor,
        prototypeSectionGenerator: this.#prototypeSectionGenerator,
      });
    this.#prototypeGateAlignmentAnalyzer = prototypeGateAlignmentAnalyzer;
    this.#nonAxisClauseExtractor = nonAxisClauseExtractor;
    this.#nonAxisFeasibilityAnalyzer = nonAxisFeasibilityAnalyzer;
    this.#fitFeasibilityConflictDetector = fitFeasibilityConflictDetector;
    this.#nonAxisFeasibilitySectionGenerator = nonAxisFeasibilitySectionGenerator;
    this.#conflictWarningSectionGenerator = conflictWarningSectionGenerator;
    this.#actionabilitySectionGenerator = actionabilitySectionGenerator;
    this.#emotionSimilarityService = emotionSimilarityService;
  }

  /**
   * Generate a complete markdown report from simulation results.
   * @param {object} params
   * @param {string} params.expressionName - Name of the expression analyzed
   * @param {object} params.simulationResult - Raw result from MonteCarloSimulator
   * @param {object[]} params.blockers - Analyzed blockers from FailureExplainer
   * @param {string} params.summary - Summary text from FailureExplainer
   * @param {Array} [params.prerequisites] - Optional expression prerequisites for prototype analysis
   * @param {import('./MonteCarloSimulator.js').SensitivityResult[]} [params.sensitivityData] - Optional sensitivity analysis results
   * @param {object} [params.staticAnalysis] - Optional static analysis results for cross-reference
   * @param {object[]} [params.staticAnalysis.gateConflicts] - Gate conflicts from static analysis
   * @param {object[]} [params.staticAnalysis.unreachableThresholds] - Unreachable thresholds from static analysis
   * @returns {string} Markdown report content
   */
  generate({
    expressionName,
    simulationResult,
    blockers,
    summary,
    prerequisites = null,
    sensitivityData = [],
    globalSensitivityData = [],
    staticAnalysis = null,
  }) {
    this.#logger.debug(`Generating report for expression: ${expressionName}`);

    const populationSummary =
      this.#coreSectionGenerator.resolvePopulationSummary(simulationResult);
    const existingWarnings = Array.isArray(simulationResult?.reportIntegrityWarnings)
      ? simulationResult.reportIntegrityWarnings
      : [];

    // Extract axis constraints from prerequisites if analyzer is available
    const axisConstraints = this.#extractAxisConstraints(prerequisites);
    const hasOrMoodConstraintsFlag = hasOrMoodConstraints(prerequisites, {
      includeMoodAlias: true,
    });
    // Extract direct moodAxes.* constraints from prerequisites
    const directMoodConstraints = extractMoodConstraints(prerequisites, {
      includeMoodAlias: true,
      andOnly: true,
    });
    // Convert prototype-derived axis constraints to mood constraint format
    const gateBasedConstraints = convertAxisConstraintsToMoodConstraints(axisConstraints);
    // Merge: direct constraints take precedence, prototype gates fill gaps
    const moodConstraints = mergeConstraints(directMoodConstraints, gateBasedConstraints);
    const storedPopulations = this.#coreSectionGenerator.buildStoredContextPopulations(
      simulationResult.storedContexts,
      moodConstraints
    );
    const sweepWarningContext = this.#buildSweepWarningContext({
      blockers,
      globalSensitivityData,
    });
    const reportIntegrityWarnings = this.#integrityAnalyzer.collect({
      blockers,
      axisConstraints,
      storedContexts: simulationResult.storedContexts,
      moodConstraints,
      storedPopulations,
      simulationResult,
      sensitivityData,
      globalSensitivityData,
    });
    const mergedWarnings = this.#mergeReportIntegrityWarnings(
      existingWarnings,
      reportIntegrityWarnings
    );

    if (simulationResult && typeof simulationResult === 'object') {
      simulationResult.reportIntegrityWarnings = mergedWarnings;
    }

    // Perform prototype fit analysis if service is available
    const prototypeFitAnalysis = this.#prototypeSectionGenerator.performPrototypeFitAnalysis(
      prerequisites,
      simulationResult.storedContexts
    );

    // Run prototype gate alignment analysis if analyzer is available
    let prototypeGateAlignmentSection = '';
    let gateAlignmentResult = null;
    if (this.#prototypeGateAlignmentAnalyzer && prerequisites) {
      const emotionConditions =
        this.#extractEmotionConditionsFromPrereqs(prerequisites);
      const transformedConditions =
        this.#transformEmotionConditionsForGateAnalysis(emotionConditions);
      gateAlignmentResult = this.#prototypeGateAlignmentAnalyzer.analyze(
        prerequisites,
        transformedConditions
      );
      prototypeGateAlignmentSection =
        this.#generatePrototypeGateAlignmentSection(gateAlignmentResult);
    }

    // Non-axis feasibility analysis (emotions, sexual states, deltas)
    const inRegimeContexts = this.#filterContextsByMoodConstraints(
      simulationResult.storedContexts ?? [],
      moodConstraints
    );

    const nonAxisFeasibility = this.#getOrCreateNonAxisFeasibilityAnalyzer().analyze(
      prerequisites ?? [],
      inRegimeContexts,
      expressionName
    );

    // Conflict detection between prototype fit and feasibility
    const fitFeasibilityConflicts = this.#getOrCreateFitFeasibilityConflictDetector().detect(
      prototypeFitAnalysis?.fitResults ?? null,
      nonAxisFeasibility,
      gateAlignmentResult
    );

    const sections = [
      this.#coreSectionGenerator.generateHeader(expressionName, simulationResult),
      this.#coreSectionGenerator.generatePopulationSummary(populationSummary),
      this.#coreSectionGenerator.generateIntegritySummarySection(mergedWarnings),
      this.#coreSectionGenerator.generateSignalLineageSection(),
      this.#coreSectionGenerator.generateExecutiveSummary(
        simulationResult,
        summary
      ),
      this.#coreSectionGenerator.generateSanityBoxSection(
        simulationResult,
        blockers
      ),
      this.#coreSectionGenerator.generateSamplingCoverageSection(
        simulationResult.samplingCoverage,
        simulationResult.samplingMode
      ),
      this.#coreSectionGenerator.generateWitnessSection(simulationResult),
      this.#blockerSectionGenerator.generateBlockerAnalysis(
        blockers,
        simulationResult.sampleCount,
        axisConstraints,
        simulationResult.storedContexts,
        populationSummary,
        storedPopulations,
        hasOrMoodConstraintsFlag,
        moodConstraints,
        simulationResult.gateCompatibility,
        simulationResult
      ),
      this.#generateRecommendationsSection({
        expressionName,
        prerequisites,
        simulationResult,
        blockers,
      }),
      this.#generateConditionalPassRatesSection(
        prerequisites,
        blockers,
        simulationResult.storedContexts,
        populationSummary,
        storedPopulations,
        hasOrMoodConstraintsFlag
      ),
      this.#generateLastMileDecompositionSection(
        blockers,
        simulationResult.storedContexts,
        populationSummary,
        storedPopulations
      ),
      this.#sensitivitySectionGenerator.generateGlobalSensitivitySection(
        globalSensitivityData,
        populationSummary,
        storedPopulations,
        sweepWarningContext,
        simulationResult?.triggerRate ?? null
      ),
      this.#sensitivitySectionGenerator.generateSensitivityAnalysis(
        sensitivityData,
        populationSummary,
        storedPopulations,
        sweepWarningContext
      ),
      // Prototype Fit & Gap Analysis sections
      this.#prototypeSectionGenerator.generatePrototypeFitSection(
        prototypeFitAnalysis?.fitResults,
        populationSummary,
        storedPopulations,
        hasOrMoodConstraintsFlag
      ),
      // Conflict warnings and non-axis feasibility (must follow prototype fit)
      this.#getOrCreateConflictWarningSectionGenerator().generate(fitFeasibilityConflicts),
      this.#getOrCreateNonAxisFeasibilitySectionGenerator().generate(
        nonAxisFeasibility,
        populationSummary?.inRegimeSampleCount ?? storedPopulations?.storedMoodRegime?.count ?? 0
      ),
      this.#prototypeSectionGenerator.generateImpliedPrototypeSection(
        prototypeFitAnalysis?.impliedPrototype,
        populationSummary,
        storedPopulations,
        hasOrMoodConstraintsFlag
      ),
      this.#prototypeSectionGenerator.generateGapDetectionSection(
        prototypeFitAnalysis?.gapDetection,
        populationSummary,
        storedPopulations
      ),
      this.#generateActionabilitySection(simulationResult),
      prototypeGateAlignmentSection,
      this.#coreSectionGenerator.generateStaticCrossReference(
        staticAnalysis,
        blockers
      ),
      this.#coreSectionGenerator.generateReportIntegrityWarningsSection(
        mergedWarnings
      ),
      this.#coreSectionGenerator.generateLegend(),
    ];

    return sections
      .filter((section) => typeof section === 'string' && section.trim().length > 0)
      .join('\n');
  }

  /**
   * Collect report integrity warnings for non-report UI surfaces.
   * @param {object} params
   * @param {object} params.simulationResult
   * @param {object[]} params.blockers
   * @param {Array|null} [params.prerequisites]
   * @param {Array} [params.sensitivityData]
   * @param {Array} [params.globalSensitivityData]
   * @returns {Array<object>}
   */
  collectReportIntegrityWarnings({
    simulationResult,
    blockers,
    prerequisites = null,
    sensitivityData = [],
    globalSensitivityData = [],
  }) {
    if (!simulationResult || !Array.isArray(blockers)) {
      return [];
    }

    const existingWarnings = Array.isArray(simulationResult?.reportIntegrityWarnings)
      ? simulationResult.reportIntegrityWarnings
      : [];
    const axisConstraints = this.#extractAxisConstraints(prerequisites);
    // Extract direct moodAxes.* constraints from prerequisites
    const directMoodConstraints = extractMoodConstraints(prerequisites, {
      includeMoodAlias: true,
      andOnly: true,
    });
    // Convert prototype-derived axis constraints to mood constraint format
    const gateBasedConstraints = convertAxisConstraintsToMoodConstraints(axisConstraints);
    // Merge: direct constraints take precedence, prototype gates fill gaps
    const moodConstraints = mergeConstraints(directMoodConstraints, gateBasedConstraints);
    const storedPopulations = this.#coreSectionGenerator.buildStoredContextPopulations(
      simulationResult.storedContexts,
      moodConstraints
    );

    const newWarnings = this.#integrityAnalyzer.collect({
      blockers,
      axisConstraints,
      storedContexts: simulationResult.storedContexts,
      moodConstraints,
      storedPopulations,
      simulationResult,
      sensitivityData,
      globalSensitivityData,
    });

    const mergedWarnings = this.#mergeReportIntegrityWarnings(
      existingWarnings,
      newWarnings
    );
    simulationResult.reportIntegrityWarnings = mergedWarnings;
    return mergedWarnings;
  }

  // ===========================================================================
  // Lazy Initialization Getters for Non-Axis Feasibility Services
  // ===========================================================================

  /**
   * Get or lazily create the NonAxisClauseExtractor.
   * @private
   * @returns {import('./NonAxisClauseExtractor.js').default}
   */
  #getOrCreateNonAxisClauseExtractor() {
    if (!this.#nonAxisClauseExtractor) {
      this.#nonAxisClauseExtractor = new NonAxisClauseExtractor({
        logger: this.#logger,
      });
    }
    return this.#nonAxisClauseExtractor;
  }

  /**
   * Get or lazily create the NonAxisFeasibilityAnalyzer.
   * @private
   * @returns {import('./NonAxisFeasibilityAnalyzer.js').default}
   */
  #getOrCreateNonAxisFeasibilityAnalyzer() {
    if (!this.#nonAxisFeasibilityAnalyzer) {
      this.#nonAxisFeasibilityAnalyzer = new NonAxisFeasibilityAnalyzer({
        logger: this.#logger,
        clauseExtractor: this.#getOrCreateNonAxisClauseExtractor(),
      });
    }
    return this.#nonAxisFeasibilityAnalyzer;
  }

  /**
   * Get or lazily create the FitFeasibilityConflictDetector.
   * @private
   * @returns {import('./FitFeasibilityConflictDetector.js').default}
   */
  #getOrCreateFitFeasibilityConflictDetector() {
    if (!this.#fitFeasibilityConflictDetector) {
      this.#fitFeasibilityConflictDetector = new FitFeasibilityConflictDetector({
        logger: this.#logger,
      });
    }
    return this.#fitFeasibilityConflictDetector;
  }

  /**
   * Get or lazily create the NonAxisFeasibilitySectionGenerator.
   * @private
   * @returns {import('./sectionGenerators/NonAxisFeasibilitySectionGenerator.js').default}
   */
  #getOrCreateNonAxisFeasibilitySectionGenerator() {
    if (!this.#nonAxisFeasibilitySectionGenerator) {
      this.#nonAxisFeasibilitySectionGenerator = new NonAxisFeasibilitySectionGenerator({
        logger: this.#logger,
      });
    }
    return this.#nonAxisFeasibilitySectionGenerator;
  }

  /**
   * Get or lazily create the ConflictWarningSectionGenerator.
   * @private
   * @returns {import('./sectionGenerators/ConflictWarningSectionGenerator.js').default}
   */
  #getOrCreateConflictWarningSectionGenerator() {
    if (!this.#conflictWarningSectionGenerator) {
      this.#conflictWarningSectionGenerator = new ConflictWarningSectionGenerator({
        logger: this.#logger,
      });
    }
    return this.#conflictWarningSectionGenerator;
  }

  /**
   * Get or lazily create the ActionabilitySectionGenerator.
   * @private
   * @returns {import('./sectionGenerators/ActionabilitySectionGenerator.js').default|null}
   */
  #getOrCreateActionabilitySectionGenerator() {
    if (!this.#actionabilitySectionGenerator) {
      // Lazy initialization requires complex dependency chain
      // Prefer DI injection; this fallback is for backwards compatibility
      this.#logger.warn(
        'MonteCarloReportGenerator: ActionabilitySectionGenerator not injected, ' +
          'actionability section will be skipped'
      );
      return null;
    }
    return this.#actionabilitySectionGenerator;
  }

  /**
   * Generate actionability section for low trigger rate expressions.
   * @private
   * @param {object} simulationResult - Simulation result
   * @returns {string} Markdown section or empty string
   */
  #generateActionabilitySection(simulationResult) {
    if (!simulationResult) {
      return '';
    }

    const triggerRate = simulationResult.triggerRate ?? 0;

    // Only generate for low trigger rate expressions (<10%)
    if (triggerRate >= 0.1) {
      return '';
    }

    const generator = this.#getOrCreateActionabilitySectionGenerator();
    if (!generator) {
      return '';
    }

    try {
      const result = generator.generate(simulationResult);
      if (
        !result ||
        !Array.isArray(result.formatted) ||
        result.formatted.length === 0
      ) {
        return '';
      }
      return result.formatted.join('\n');
    } catch (err) {
      this.#logger.error(
        'MonteCarloReportGenerator: Actionability section generation failed',
        err
      );
      return '';
    }
  }

  /**
   * Extract axis constraints from expression prerequisites.
   * @private
   * @param {Array|null} prerequisites - Expression prerequisites
   * @returns {Map<string, {min: number, max: number}>|null}
   */
  #extractAxisConstraints(prerequisites) {
    return this.#dataExtractor.extractAxisConstraints(prerequisites);
  }

  /**
   * Transform emotion conditions from varPath format to type+id format for gate analysis.
   * @private
   * @param {Array<{varPath: string, operator: string, threshold: number}>} emotionConditions
   * @returns {Array<{type: string, id: string, operator: string, threshold: number}>}
   */
  #transformEmotionConditionsForGateAnalysis(emotionConditions) {
    if (!Array.isArray(emotionConditions)) {
      return [];
    }
    return emotionConditions
      .filter((c) => c.varPath?.startsWith('emotions.'))
      .map((c) => ({
        type: 'emotion',
        id: c.varPath.replace('emotions.', ''),
        operator: c.operator,
        threshold: c.threshold,
      }));
  }

  /**
   * Generate Prototype Gate Alignment section.
   * @private
   * @param {import('./PrototypeGateAlignmentAnalyzer.js').AlignmentAnalysisResult|null} result
   * @returns {string} Markdown section content
   */
  #generatePrototypeGateAlignmentSection(result) {
    if (!result || result.contradictions.length === 0) {
      return '';
    }

    const lines = [
      '## Prototype Gate Alignment',
      '',
      '| Emotion | Prototype Gate | Regime (axis) | Status | Distance |',
      '|---------|----------------|---------------|--------|----------|',
    ];

    for (const c of result.contradictions) {
      const regimeStr = `${c.axis} ∈ [${c.regime.min.toFixed(2)}, ${c.regime.max.toFixed(2)}]`;
      const statusBadge = c.severity === 'critical' ? '**CONTRADICTION**' : 'contradiction';
      lines.push(
        `| ${c.emotionId} | \`${c.gateString}\` | ${regimeStr} | ${statusBadge} | ${c.distance.toFixed(3)} |`
      );
    }

    lines.push('');

    // Add recommendations per critical contradiction
    const criticalContradictions = result.contradictions.filter(
      (c) => c.severity === 'critical'
    );
    for (const c of criticalContradictions) {
      lines.push(
        `> **Unreachable emotion under regime**: \`emotions.${c.emotionId}\` is always 0 in-regime ` +
          `because prototype gate \`${c.gateString}\` contradicts regime \`${c.axis} >= ${c.regime.min.toFixed(2)}\`.`
      );
      lines.push(
        `> **Fix**: Relax regime on \`${c.axis}\`, loosen the prototype gate, ` +
          `or replace/create a prototype (e.g., focused_${c.emotionId.split('_').pop()}).`
      );
      lines.push('');
    }

    return lines.join('\n');
  }

  #buildSweepWarningContext({ blockers, globalSensitivityData }) {
    return {
      andOnly: this.#treeTraversal.isAndOnlyBlockers(blockers),
      baselineTriggerRate: this.#extractBaselineTriggerRate(globalSensitivityData),
    };
  }

  #extractBaselineTriggerRate(globalSensitivityData) {
    return this.#dataExtractor.extractBaselineTriggerRate(globalSensitivityData);
  }

  #buildSweepWarningsForResult(
    result,
    { rateKey, scope, andOnly, baselineTriggerRate }
  ) {
    const warnings = [];
    if (!result || !Array.isArray(result.grid)) {
      return warnings;
    }

    const operator = result?.operator;
    const conditionLabel = result?.conditionPath ?? result?.varPath ?? 'unknown';
    const populationHash = result?.populationHash ?? null;

    const monotonicity = evaluateSweepMonotonicity({
      grid: result.grid,
      rateKey,
      operator,
    });

    if (!monotonicity.isMonotonic && monotonicity.direction) {
      const directionLabel =
        monotonicity.direction === 'nonincreasing'
          ? 'non-increasing'
          : 'non-decreasing';
      warnings.push(
        buildReportIntegrityWarning({
          code: 'S4_SWEEP_NON_MONOTONIC',
          message: `Sweep for ${conditionLabel} is not ${directionLabel} as ${operator} thresholds change.`,
          populationHash,
          signal: conditionLabel,
          details: {
            operator,
            rateKey,
            direction: monotonicity.direction,
            violations: monotonicity.violations,
          },
        })
      );
    }

    if (scope === 'marginal' && andOnly && typeof baselineTriggerRate === 'number') {
      const baselinePoint = findBaselineGridPoint(
        result.grid,
        result.originalThreshold
      );
      const baselinePassRate = baselinePoint?.passRate;

      if (
        typeof baselinePassRate === 'number' &&
        baselineTriggerRate > baselinePassRate + REPORT_INTEGRITY_EPSILON
      ) {
        warnings.push(
          buildReportIntegrityWarning({
            code: 'S1_TRIGGER_EXCEEDS_CLAUSE_PASS',
            message: `Stored-context trigger rate (${this.#formattingService.formatPercentage(
              baselineTriggerRate
            )}) exceeds clause pass rate (${this.#formattingService.formatPercentage(
              baselinePassRate
            )}) for ${conditionLabel}.`,
            populationHash,
            signal: conditionLabel,
            details: {
              operator,
              baselineTriggerRate,
              baselinePassRate,
            },
          })
        );
      }
    }

    return warnings;
  }

  #mergeReportIntegrityWarnings(existing, incoming) {
    const merged = [];
    const seen = new Set();
    const combined = [...(existing ?? []), ...(incoming ?? [])].filter(Boolean);

    for (const warning of combined) {
      const key = [
        warning.code ?? '',
        warning.prototypeId ?? '',
        warning.populationHash ?? '',
        warning.signal ?? '',
        warning.message ?? '',
      ].join('|');
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      merged.push(warning);
    }

    return merged;
  }


  // ============================================================================
  // CLAIM 5: Conditional Pass Rates Under Mood Regime
  // ============================================================================



  /**
   * Extract emotion/sexual conditions from prerequisites (not from blockers).
   * These are the conditions we'll compute conditional pass rates for.
   * @private
   * @param {Array} prerequisites - Expression prerequisites
   * @returns {Array<{varPath: string, operator: string, threshold: number, display: string}>}
   */
  #extractEmotionConditionsFromPrereqs(prerequisites) {
    return this.#dataExtractor.extractEmotionConditionsFromPrereqs(prerequisites);
  }


  /**
   * Get a nested value from an object using a dot-separated path.
   * @private
   * @param {object} obj - Object to traverse
   * @param {string} path - Dot-separated path (e.g., 'moodAxes.valence')
   * @returns {*} The value at the path, or undefined
   */
  

  /**
   * Evaluate a comparison operation.
   * @private
   * @param {number} value - The actual value
   * @param {string} operator - Comparison operator
   * @param {number} threshold - Threshold value
   * @returns {boolean}
   */
  

  /**
   * Filter contexts where all mood constraints pass.
   * @private
   * @param {Array} storedContexts - Stored simulation contexts
   * @param {Array} moodConstraints - Mood constraints to filter by
   * @returns {Array} Contexts where all mood constraints pass
   */
  #filterContextsByMoodConstraints(storedContexts, moodConstraints) {
    return filterContextsByConstraints(storedContexts, moodConstraints);
  }

  /**
   * Calculate Wilson score confidence interval.
   * @private
   * @param {number} successes - Number of successes
   * @param {number} total - Total trials
   * @param {number} z - Z-score (default 1.96 for 95% CI)
   * @returns {{low: number, high: number}}
   */
  

  /**
   * Compute conditional pass rates for emotion conditions given mood constraints pass.
   * @private
   * @param {Array} filteredContexts - Contexts where mood constraints pass
   * @param {Array} emotionConditions - Emotion conditions to evaluate
   * @returns {Array<{condition: string, conditionalPassRate: number, passes: number, total: number, ci: {low: number, high: number}}>}
   */
  

  /**
   * Generate the Conditional Pass Rates section.
   * Shows P(emotion_condition | mood_constraints_pass).
   * @private
   * @param {Array} prerequisites - Expression prerequisites
   * @param {Array} blockers - Analyzed blockers
   * @param {Array} storedContexts - Stored simulation contexts
   * @returns {string} Markdown section
   */
  #generateConditionalPassRatesSection(
    prerequisites,
    blockers,
    storedContexts,
    populationSummary,
    storedPopulations,
    hasOrMoodConstraints = false
  ) {
    if (!prerequisites || !storedContexts || storedContexts.length === 0) {
      return '';
    }

    // Extract mood constraints and emotion conditions
    const moodConstraints = extractMoodConstraints(prerequisites, {
      includeMoodAlias: true,
      andOnly: true,
    });
    const emotionConditions = this.#extractEmotionConditionsFromPrereqs(prerequisites);

    // Need both mood constraints and emotion conditions for this analysis to be meaningful
    if (moodConstraints.length === 0 || emotionConditions.length === 0) {
      return '';
    }

    // Filter contexts by mood constraints
    const filteredContexts = this.#filterContextsByMoodConstraints(
      storedContexts,
      moodConstraints
    );

    // If very few contexts pass mood constraints, this analysis isn't reliable
    const orConstraintWarning = hasOrMoodConstraints
      ? this.#formattingService.formatOrMoodConstraintWarning()
      : '';
    const populationLabel =
      this.#formattingService.formatStoredContextPopulationLabel(
        populationSummary,
        storedPopulations?.storedMoodRegime ?? null
      );

    if (filteredContexts.length < 10) {
      return `## Conditional Pass Rates

${orConstraintWarning}${populationLabel}**Note**: Only ${filteredContexts.length} out of ${storedContexts.length} samples passed all mood constraints.
Conditional analysis requires more samples for reliable estimates.

---
`;
    }

    // Compute conditional pass rates
    const passRates = this.#statisticalService.computeConditionalPassRates(filteredContexts, emotionConditions);

    // Format mood constraints for display
    const moodConstraintsList = formatConstraints(moodConstraints);

    // Build the table
    const tableHeader = '| Condition | P(pass \\| mood) | Passes | CI (95%) |';
    const tableDivider = '|-----------|-----------------|--------|----------|';
    const tableRows = passRates.map((r) => {
      const rateStr = this.#formattingService.formatPercentage(r.conditionalPassRate);
      const passesStr = `${r.passes}/${r.total}`;
      const ciStr = `[${this.#formattingService.formatPercentage(r.ci.low)}, ${this.#formattingService.formatPercentage(r.ci.high)}]`;
      return `| \`${r.condition}\` | ${rateStr} | ${passesStr} | ${ciStr} |`;
    });

    return `## Conditional Pass Rates (Given Mood Constraints Satisfied)

${orConstraintWarning}${populationLabel}**Mood regime filter**: ${filteredContexts.length} contexts where all mood constraints pass
- Constraints: ${moodConstraintsList}

${tableHeader}
${tableDivider}
${tableRows.join('\n')}

**Interpretation**: These rates show how often each emotion condition passes
when the mood state is already suitable. Low rates indicate emotion-specific
blockers that persist even in favorable mood regimes.

---
`;
  }

  // ============================================================================
  // CLAIM 6: Last-Mile Decomposition for Decisive Blockers
  // ============================================================================

  /**
   * Find last-mile contexts for a specific blocker.
   * Last-mile contexts are those where all OTHER clauses pass except the target.
   * @private
   * @param {object} blocker - The blocker to find last-mile contexts for
   * @param {Array} storedContexts - Stored simulation contexts
   * @param {Array} allBlockers - All blockers (to check sibling clause pass/fail)
   * @returns {Array} Contexts where only this blocker fails
   */
  #findLastMileContextsForBlocker(blocker, storedContexts, allBlockers) {
    if (!storedContexts || storedContexts.length === 0) return [];

    const hb = blocker.hierarchicalBreakdown ?? {};

    // Get the leaf conditions from this blocker
    const leaves = hb.isCompound ? this.#treeTraversal.flattenLeaves(hb) : [hb];
    if (leaves.length === 0) return [];

    // For compound blockers, we look at contexts where THIS blocker fails
    // but all OTHER blockers pass. This uses the pre-computed lastMileFailRate.
    const lastMileData = blocker.advancedAnalysis?.lastMileAnalysis ?? {};
    if (!lastMileData.lastMileFailRate || lastMileData.lastMileFailRate === 0) {
      return [];
    }

    // Find contexts matching last-mile criteria
    // A last-mile context is one where this condition fails but siblings pass
    // We need to evaluate the specific condition against each context
    const targetVarPath = hb.variablePath;
    const targetOperator = hb.comparisonOperator;
    const targetThreshold = hb.thresholdValue;

    if (!targetVarPath || targetOperator === undefined) {
      // Can't evaluate compound nodes directly - would need full prerequisite evaluation
      return [];
    }

    // Filter to contexts where this specific condition fails
    return storedContexts.filter((ctx) => {
      const value = this.#statisticalService.getNestedValue(ctx, targetVarPath);
      // This condition must FAIL (return false means it fails the check)
      return !evaluateConstraint(value, targetOperator, targetThreshold);
    });
  }

  /**
   * Compute distribution statistics for a set of values.
   * @private
   * @param {Array<number>} values - Array of numeric values
   * @returns {{min: number, median: number, p90: number, max: number, mean: number, count: number}|null}
   */
  

  /**
   * Get prototype weights for an emotion or sexual state.
   * @private
   * @param {string} prototypeId - Prototype ID
   * @param {'emotion'|'sexual'} [type='emotion'] - Prototype type
   * @returns {object|null} Weights object or null
   */
  #getPrototypeWeights(prototypeId, type = 'emotion') {
    return this.#dataExtractor.getPrototypeWeights(prototypeId, type);
  }

  /**
   * Normalize an axis value to the appropriate range.
   * Mood axes: [-100, 100] → [-1, 1]
   * Sexual axes: Already in [0, 1]
   * @private
   * @param {string} axis - Axis name
   * @param {number} value - Raw axis value
   * @returns {number} Normalized value
   */
  

  /**
   * Compute per-axis contributions to an emotion or sexual state value.
   * @private
   * @param {Array} contexts - Last-mile contexts
   * @param {object} weights - Prototype weights
   * @returns {object} Axis contributions with mean contribution and mean value
   */

  /**
   * Generate the Last-Mile Decomposition section for decisive blockers.
   * @private
   * @param {Array} blockers - Analyzed blockers
   * @param {Array} storedContexts - Stored simulation contexts
   * @returns {string} Markdown section
   */
  #generateLastMileDecompositionSection(
    blockers,
    storedContexts,
    populationSummary,
    storedPopulations
  ) {
    if (!blockers || blockers.length === 0 || !storedContexts || storedContexts.length === 0) {
      return '';
    }

    const populationLabel =
      this.#formattingService.formatStoredContextPopulationLabel(
        populationSummary,
        storedPopulations?.storedGlobal ?? null
      );
    const sections = [];

    for (const blocker of blockers) {
      const hb = blocker.hierarchicalBreakdown ?? {};
      const adv = blocker.advancedAnalysis ?? {};
      const lastMileData = adv.lastMileAnalysis ?? {};

      // Only analyze decisive blockers (high last-mile failure rate)
      const lastMileFailRate = lastMileData.lastMileFailRate ?? 0;
      if (lastMileFailRate < 0.1) continue; // Only blockers with >10% last-mile rate

      // Match both emotion and sexual state conditions where we can get prototype weights
      const varPath = hb.variablePath ?? '';
      const tunableInfo = getTunableVariableInfo(varPath);
      if (!tunableInfo) continue;
      if (tunableInfo.domain !== 'emotions' && tunableInfo.domain !== 'sexualStates') {
        continue;
      }

      const prototypeId = tunableInfo.name;
      const prototypeType = tunableInfo.domain === 'emotions' ? 'emotion' : 'sexual';
      const contextKey = tunableInfo.domain === 'emotions' ? 'emotions' : 'sexualStates';
      const threshold = hb.thresholdValue;

      // Get prototype weights
      const weights = this.#getPrototypeWeights(prototypeId, prototypeType);
      if (!weights || Object.keys(weights).length === 0) continue;

      // Find last-mile contexts for this blocker
      const lastMileContexts = this.#findLastMileContextsForBlocker(blocker, storedContexts, blockers);
      if (lastMileContexts.length < 5) continue; // Need enough samples

      // Compute prototype value distribution in last-mile contexts
      const prototypeValues = lastMileContexts.map((ctx) => {
        return this.#statisticalService.getNestedValue(ctx, `${contextKey}.${prototypeId}`) ?? 0;
      });
      const distribution = this.#statisticalService.computeDistributionStats(prototypeValues);
      if (!distribution) continue;

      // Compute per-axis contributions
      const contributions = this.#statisticalService.computeAxisContributions(lastMileContexts, weights);

      // Find dominant suppressor
      const suppressor = this.#treeTraversal.findDominantSuppressor(contributions);

      // Format the section
      const sectionTitle = `### Last-Mile Decomposition: \`${varPath}\``;

      // Distribution table
      const distTable = `| Statistic | Value |
|-----------|-------|
| Min | ${this.#formattingService.formatNumber(distribution.min)} |
| Median | ${this.#formattingService.formatNumber(distribution.median)} |
| P90 | ${this.#formattingService.formatNumber(distribution.p90)} |
| Max | ${this.#formattingService.formatNumber(distribution.max)} |
| Mean | ${this.#formattingService.formatNumber(distribution.mean)} |`;

      // Axis contributions table
      const contribHeader = '| Axis | Weight | Mean Value | Mean Contribution |';
      const contribDivider = '|------|--------|------------|-------------------|';
      const contribRows = Object.entries(contributions)
        .sort(([, a], [, b]) => b.meanContribution - a.meanContribution)
        .map(([axis, data]) => {
          const weightStr = data.weight >= 0 ? `+${this.#formattingService.formatNumber(data.weight)}` : this.#formattingService.formatNumber(data.weight);
          const contribStr = data.meanContribution >= 0
            ? `+${this.#formattingService.formatNumber(data.meanContribution)}`
            : this.#formattingService.formatNumber(data.meanContribution);
          return `| ${axis} | ${weightStr} | ${this.#formattingService.formatNumber(data.meanAxisValue)} | ${contribStr} |`;
        });

      // Suppressor insight
      const prototypeLabel = prototypeType === 'emotion' ? 'emotion' : 'sexual state';
      let suppressorInsight = '';
      if (suppressor.axis) {
        const axisData = contributions[suppressor.axis];
        const direction = axisData.weight < 0 ? 'high positive' : 'low negative';
        suppressorInsight = `**🔻 Dominant Suppressor**: \`${suppressor.axis}\` (mean contribution: ${this.#formattingService.formatNumber(suppressor.contribution)})
- ${direction.charAt(0).toUpperCase() + direction.slice(1)} ${suppressor.axis} values are suppressing ${prototypeId} intensity
- To trigger this expression, ${suppressor.axis} would need to ${axisData.weight < 0 ? 'decrease' : 'increase'}`;
      }

      // Interpretation
      const gapToThreshold = threshold - distribution.mean;
      const interpretation = `**Interpretation**: The ${prototypeLabel} averages ${this.#formattingService.formatNumber(distribution.mean)} but needs ≥${threshold} to pass.
The gap of ${this.#formattingService.formatNumber(gapToThreshold)} is ${gapToThreshold > 0.2 ? 'substantial' : 'small'}.
${suppressor.axis ? `The ${suppressor.axis} axis is the primary blocker.` : 'No single axis dominates the suppression.'}`;

      // Format section header based on prototype type
      const distributionTitle = prototypeType === 'emotion' ? 'Emotion Value Distribution' : 'Sexual State Value Distribution';

      sections.push(`${sectionTitle}

**${lastMileContexts.length} states** where all conditions pass except \`${varPath} >= ${threshold}\`

#### ${distributionTitle}
${distTable}

#### Per-Axis Contributions to ${varPath}
${contribHeader}
${contribDivider}
${contribRows.join('\n')}

${suppressorInsight}

${interpretation}

---`);
    }

    if (sections.length === 0) {
      return '';
    }

    return `## Last-Mile Decomposition

Analysis of decisive blockers: what's preventing these emotions from reaching their thresholds?

${populationLabel}${sections.join('\n')}`;
  }

  /**
   * Generate the deterministic recommendations section based on MC diagnostics.
   * @private
   * @param {object} params
   * @param {string} params.expressionName
   * @param {Array|null} params.prerequisites
   * @param {object} params.simulationResult
   * @param {Array} [params.blockers] - Blocker hierarchy for overconstrained detection
   * @returns {string}
   */
  #generateRecommendationsSection({ expressionName, prerequisites, simulationResult, blockers = [] }) {
    if (!simulationResult) {
      return '';
    }

    const expression = {
      id: expressionName ?? null,
      prerequisites: Array.isArray(prerequisites) ? prerequisites : null,
    };

    // Detect overconstrained conjunctions from blockers
    const overconstrainedDetails = this.#coreSectionGenerator.detectOverconstrainedConjunctions(blockers);

    const factsBuilder = new RecommendationFactsBuilder({
      prototypeConstraintAnalyzer: this.#prototypeConstraintAnalyzer,
      prototypeFitRankingService: this.#prototypeFitRankingService,
      logger: this.#logger,
    });
    const diagnosticFacts = factsBuilder.build({
      expression,
      simulationResult,
      overconstrainedDetails,
    });

    if (!diagnosticFacts) {
      return '';
    }

    const invariantFailures = (diagnosticFacts.invariants ?? []).filter(
      (inv) => inv.ok === false
    );
    if (invariantFailures.length > 0) {
      return `## Recommendations

> Recommendations suppressed: invariant violations detected in diagnostic facts.

---
`;
    }

    const engine = new RecommendationEngine({
      prototypeSynthesisService: this.#prototypeSynthesisService,
      emotionSimilarityService: this.#emotionSimilarityService,
    });
    const recommendations = engine.generate(diagnosticFacts);
    if (!Array.isArray(recommendations) || recommendations.length === 0) {
      return '';
    }

    const impactByClauseId = new Map(
      (diagnosticFacts.clauses ?? []).map((clause) => [
        clause.clauseId,
        clause.impact,
      ])
    );

    const cards = recommendations.map((recommendation, index) =>
      this.#formatRecommendationCard(recommendation, index, impactByClauseId)
    );

    return `## Recommendations

${cards.join('\n')}

---
`;
  }

  /**
   * Format a single recommendation as a markdown "card".
   * @private
   * @param {object} recommendation
   * @param {number} index
   * @param {Map<string, number>} impactByClauseId
   * @returns {string}
   */
  #formatRecommendationCard(recommendation, index, impactByClauseId) {
    const title = recommendation.title ?? 'Recommendation';
    const confidence = recommendation.confidence ?? 'low';
    const severity = recommendation.severity ?? 'low';
    const type = recommendation.type ?? 'unknown';
    const impact = this.#resolveRecommendationImpact(
      recommendation,
      impactByClauseId
    );
    const impactStr =
      typeof impact === 'number' ? this.#formattingService.formatSignedPercentagePoints(impact) : 'n/a';

    const evidenceLines = this.#formatRecommendationEvidence(
      recommendation.evidence ?? []
    );
    const actionLines = this.#formatRecommendationActions(
      recommendation.actions ?? []
    );
    const relatedClauseLinks = this.#formatRecommendationLinks(
      recommendation.relatedClauseIds ?? []
    );

    const bullets = [
      `- **Type**: ${type}`,
      `- **Severity**: ${severity}`,
      `- **Confidence**: ${confidence}`,
      `- **Clause Pass-Rate Impact**: ${impactStr}`,
    ];

    if (recommendation.why) {
      bullets.push(`- **Why**: ${recommendation.why}`);
    }
    if (evidenceLines.length > 0) {
      bullets.push(`- **Evidence**:\n${evidenceLines.join('\n')}`);
    }
    if (actionLines.length > 0) {
      bullets.push(`- **Actions**:\n${actionLines.join('\n')}`);
    }
    if (recommendation.predictedEffect) {
      bullets.push(`- **Predicted Effect**: ${recommendation.predictedEffect}`);
    }
    if (relatedClauseLinks.length > 0) {
      bullets.push(`- **Related Clauses**: ${relatedClauseLinks.join(', ')}`);
    }

    return `### Recommendation ${index + 1}: ${title}

${bullets.join('\n')}
`;
  }

  #resolveRecommendationImpact(recommendation, impactByClauseId) {
    const relatedClauseIds = recommendation.relatedClauseIds ?? [];
    for (const clauseId of relatedClauseIds) {
      if (impactByClauseId.has(clauseId)) {
        return impactByClauseId.get(clauseId);
      }
    }
    return null;
  }

  #formatRecommendationEvidence(evidence) {
    if (!Array.isArray(evidence) || evidence.length === 0) {
      return [];
    }

    return evidence.map((entry) => {
      // Handle simple label/value format (used by sole-blocker recommendations)
      if (
        typeof entry.value === 'string' &&
        entry.numerator === undefined &&
        entry.denominator === undefined
      ) {
        return `  - ${entry.label}: ${entry.value}`;
      }

      // Handle complex format with numerator/denominator
      const numerator = this.#formattingService.formatEvidenceCount(entry.numerator);
      const denominator = this.#formattingService.formatEvidenceCount(entry.denominator);
      const ratio = `${numerator}/${denominator}`;
      const valueStr = this.#formattingService.formatEvidenceValue(
        entry.value,
        entry.denominator
      );
      const populationLabel = this.#formattingService.formatPopulationEvidenceLabel(
        entry.population
      );
      const base = `  - ${entry.label}: ${ratio} (${valueStr})`;
      return populationLabel ? `${base} | ${populationLabel}` : base;
    });
  }


  #formatRecommendationActions(actions) {
    if (!Array.isArray(actions) || actions.length === 0) {
      return [];
    }
    return actions.map((action) => {
      // Handle object format with label/detail (used by sole-blocker recommendations)
      if (typeof action === 'object' && action !== null && action.label) {
        const detail = action.detail ? ` — ${action.detail}` : '';
        return `  - ${action.label}${detail}`;
      }
      // Handle simple string format
      return `  - ${action}`;
    });
  }

  #formatRecommendationLinks(relatedClauseIds) {
    if (!Array.isArray(relatedClauseIds) || relatedClauseIds.length === 0) {
      return [];
    }

    return relatedClauseIds.map((clauseId) => {
      const anchorId = this.#buildClauseAnchorId(clauseId);
      if (anchorId) {
        return `[${clauseId}](#${anchorId})`;
      }
      return clauseId;
    });
  }



  #buildClauseAnchorId(clauseId) {
    if (!clauseId) {
      return null;
    }
    const token = String(clauseId)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return token ? `clause-${token}` : null;
  }

  // ========================================================================
  // Prototype Math Methods (for emotion/sexual threshold conditions)
  // ========================================================================














}

export default MonteCarloReportGenerator;
