/**
 * @file Unit tests for ReportOrchestrator
 */

import { describe, expect, it, jest } from '@jest/globals';
import ReportOrchestrator from '../../../../src/expressionDiagnostics/services/ReportOrchestrator.js';

describe('ReportOrchestrator', () => {
  it('generates report markdown and coordinates dependencies', () => {
    const logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    const sensitivityAnalyzer = {
      computeSensitivityData: jest.fn().mockReturnValue(['sensitivity']),
      computeGlobalSensitivityData: jest.fn().mockReturnValue(['global']),
    };
    const reportGenerator = {
      generate: jest.fn().mockReturnValue('# Report'),
    };
    const orchestrator = new ReportOrchestrator({
      logger,
      sensitivityAnalyzer,
      monteCarloReportGenerator: reportGenerator,
    });

    const simulationResult = { storedContexts: ['context'] };
    const blockers = [{ rank: 1 }];
    const prerequisites = [{ logic: { operator: 'and', children: [] } }];
    const staticAnalysis = { gateConflicts: [], unreachableThresholds: [] };

    const report = orchestrator.generateReport({
      expressionName: 'Test Expression',
      summary: 'Summary',
      simulationResult,
      blockers,
      prerequisites,
      staticAnalysis,
    });

    expect(report).toBe('# Report');
    expect(sensitivityAnalyzer.computeSensitivityData).toHaveBeenCalledWith(
      simulationResult.storedContexts,
      blockers
    );
    expect(
      sensitivityAnalyzer.computeGlobalSensitivityData
    ).toHaveBeenCalledWith(
      simulationResult.storedContexts,
      blockers,
      prerequisites
    );
    expect(reportGenerator.generate).toHaveBeenCalledWith({
      expressionName: 'Test Expression',
      simulationResult,
      blockers,
      summary: 'Summary',
      prerequisites,
      sensitivityData: ['sensitivity'],
      globalSensitivityData: ['global'],
      staticAnalysis,
    });
    expect(logger.info).toHaveBeenCalledWith(
      'ReportOrchestrator: Report generated successfully'
    );
  });

  it('returns empty string and warns when simulation result is missing', () => {
    const logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    const sensitivityAnalyzer = {
      computeSensitivityData: jest.fn(),
      computeGlobalSensitivityData: jest.fn(),
    };
    const reportGenerator = {
      generate: jest.fn(),
    };
    const orchestrator = new ReportOrchestrator({
      logger,
      sensitivityAnalyzer,
      monteCarloReportGenerator: reportGenerator,
    });

    const report = orchestrator.generateReport({
      expressionName: 'Test Expression',
      summary: 'Summary',
      simulationResult: null,
      blockers: [],
      prerequisites: null,
      staticAnalysis: null,
    });

    expect(report).toBe('');
    expect(logger.warn).toHaveBeenCalledWith(
      'ReportOrchestrator: No simulation result provided'
    );
    expect(sensitivityAnalyzer.computeSensitivityData).not.toHaveBeenCalled();
    expect(
      sensitivityAnalyzer.computeGlobalSensitivityData
    ).not.toHaveBeenCalled();
    expect(reportGenerator.generate).not.toHaveBeenCalled();
  });
});
