/**
 * @file Orchestrates report generation workflow for expression diagnostics.
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { extractMoodConstraints } from '../utils/moodRegimeUtils.js';

class ReportOrchestrator {
  #logger;
  #sensitivityAnalyzer;
  #monteCarloReportGenerator;

  constructor({ logger, sensitivityAnalyzer, monteCarloReportGenerator }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });
    validateDependency(sensitivityAnalyzer, 'ISensitivityAnalyzer', logger, {
      requiredMethods: ['computeSensitivityData', 'computeGlobalSensitivityData'],
    });
    validateDependency(
      monteCarloReportGenerator,
      'IMonteCarloReportGenerator',
      logger,
      {
        requiredMethods: ['generate'],
      }
    );

    this.#logger = logger;
    this.#sensitivityAnalyzer = sensitivityAnalyzer;
    this.#monteCarloReportGenerator = monteCarloReportGenerator;
  }

  /**
   * Generate a complete Monte Carlo analysis report.
   * @param {object} params
   * @param {string} params.expressionName
   * @param {string} params.summary
   * @param {object} params.simulationResult
   * @param {Array} params.blockers
   * @param {Array|null} params.prerequisites
   * @param {object|null} params.staticAnalysis
   * @returns {string}
   */
  generateReport({
    expressionName,
    summary,
    simulationResult,
    blockers,
    prerequisites,
    staticAnalysis = null,
  }) {
    if (!simulationResult) {
      this.#logger.warn('ReportOrchestrator: No simulation result provided');
      return '';
    }

    const storedContexts = simulationResult.storedContexts ?? [];
    const baselineTriggerRate = simulationResult.triggerRate ?? null;

    // Extract mood constraints for near-miss pool filtering
    const moodConstraints = extractMoodConstraints(prerequisites, {
      includeMoodAlias: true,
      andOnly: true,
    });

    const sensitivityOptions = {
      baselineTriggerRate,
      moodConstraints,
    };

    const sensitivityData = this.#sensitivityAnalyzer.computeSensitivityData(
      storedContexts,
      blockers,
      sensitivityOptions
    );
    const globalSensitivityData =
      this.#sensitivityAnalyzer.computeGlobalSensitivityData(
        storedContexts,
        blockers,
        prerequisites,
        sensitivityOptions
      );

    const reportMarkdown = this.#monteCarloReportGenerator.generate({
      expressionName,
      simulationResult,
      blockers,
      summary,
      prerequisites,
      sensitivityData,
      globalSensitivityData,
      staticAnalysis,
    });

    this.#logger.info('ReportOrchestrator: Report generated successfully');
    return reportMarkdown;
  }
}

export default ReportOrchestrator;
