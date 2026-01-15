/**
 * @file reportGeneratorFactory - Creates fully wired MonteCarloReportGenerator
 * @description Factory for worker-thread usage without DI container.
 */

import MonteCarloReportGenerator from './MonteCarloReportGenerator.js';
import ReportFormattingService from './ReportFormattingService.js';
import WitnessFormatter from './WitnessFormatter.js';
import StatisticalComputationService from './StatisticalComputationService.js';
import ReportDataExtractor from './ReportDataExtractor.js';
import BlockerTreeTraversal from './BlockerTreeTraversal.js';
import ReportIntegrityAnalyzer from './ReportIntegrityAnalyzer.js';
import {
  PrototypeSectionGenerator,
  BlockerSectionGenerator,
  CoreSectionGenerator,
} from './sectionGenerators/index.js';

/**
 * Creates a fully wired MonteCarloReportGenerator.
 *
 * @param {object} options
 * @param {object} options.logger - Required logger instance
 * @param {object} [options.prototypeConstraintAnalyzer] - Optional prototype analyzer
 * @param {object} [options.prototypeFitRankingService] - Optional ranking service
 * @param {object} [options.prototypeSynthesisService] - Optional synthesis service
 * @returns {MonteCarloReportGenerator}
 */
export function createReportGenerator({
  logger,
  prototypeConstraintAnalyzer = null,
  prototypeFitRankingService = null,
  prototypeSynthesisService = null,
}) {
  if (!logger) {
    throw new Error('createReportGenerator requires logger');
  }

  const formattingService = new ReportFormattingService();
  const witnessFormatter = new WitnessFormatter({ formattingService });
  const statisticalService = new StatisticalComputationService();
  const dataExtractor = new ReportDataExtractor({
    logger,
    prototypeConstraintAnalyzer,
  });
  const treeTraversal = new BlockerTreeTraversal();
  const integrityAnalyzer = new ReportIntegrityAnalyzer({
    formattingService,
    statisticalService,
    treeTraversal,
    dataExtractor,
    prototypeConstraintAnalyzer,
    logger,
  });

  const coreSectionGenerator = new CoreSectionGenerator({
    formattingService,
    witnessFormatter,
    statisticalService,
    dataExtractor,
  });

  const prototypeSectionGenerator = new PrototypeSectionGenerator({
    formattingService,
    witnessFormatter,
    statisticalService,
    dataExtractor,
    treeTraversal,
    prototypeConstraintAnalyzer,
    prototypeFitRankingService,
    logger,
  });

  const blockerSectionGenerator = new BlockerSectionGenerator({
    formattingService,
    treeTraversal,
    dataExtractor,
    prototypeSectionGenerator,
  });

  return new MonteCarloReportGenerator({
    logger,
    prototypeConstraintAnalyzer,
    prototypeFitRankingService,
    prototypeSynthesisService,
    formattingService,
    witnessFormatter,
    statisticalService,
    dataExtractor,
    treeTraversal,
    integrityAnalyzer,
    coreSectionGenerator,
    prototypeSectionGenerator,
    blockerSectionGenerator,
  });
}

export default createReportGenerator;
