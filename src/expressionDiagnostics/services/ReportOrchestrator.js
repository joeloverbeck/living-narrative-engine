/**
 * @file Orchestrates report generation workflow for expression diagnostics.
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

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
    const sensitivityData = this.#sensitivityAnalyzer.computeSensitivityData(
      storedContexts,
      blockers
    );
    const globalSensitivityData =
      this.#sensitivityAnalyzer.computeGlobalSensitivityData(
        storedContexts,
        blockers,
        prerequisites
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
