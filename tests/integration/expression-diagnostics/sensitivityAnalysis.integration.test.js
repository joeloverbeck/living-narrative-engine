/**
 * @file Integration tests for sensitivity analysis flow in expression diagnostics.
 * Validates MonteCarloSimulator -> FailureExplainer -> SensitivityAnalyzer -> ReportOrchestrator.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import MonteCarloSimulator from '../../../src/expressionDiagnostics/services/MonteCarloSimulator.js';
import FailureExplainer from '../../../src/expressionDiagnostics/services/FailureExplainer.js';
import SensitivityAnalyzer from '../../../src/expressionDiagnostics/services/SensitivityAnalyzer.js';
import ReportOrchestrator from '../../../src/expressionDiagnostics/services/ReportOrchestrator.js';
import MonteCarloReportGenerator from '../../../src/expressionDiagnostics/services/MonteCarloReportGenerator.js';
import RandomStateGenerator from '../../../src/expressionDiagnostics/services/RandomStateGenerator.js';
import EmotionCalculatorAdapter from '../../../src/expressionDiagnostics/adapters/EmotionCalculatorAdapter.js';
import EmotionCalculatorService from '../../../src/emotions/emotionCalculatorService.js';
import { buildPopulationHash } from '../../../src/expressionDiagnostics/utils/populationHashUtils.js';

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const buildEmotionCalculatorAdapter = (dataRegistry, logger) =>
  new EmotionCalculatorAdapter({
    emotionCalculatorService: new EmotionCalculatorService({
      dataRegistry,
      logger,
    }),
    logger,
  });

const mockEmotionPrototypes = {
  entries: {
    joy: { weights: { valence: 1.0 }, gates: [] },
    fear: { weights: { threat: 1.0 }, gates: [] },
    excitement: { weights: { arousal: 1.0 }, gates: [] },
  },
};

const mockSexualPrototypes = {
  entries: {},
};

describe('Sensitivity analysis integration', () => {
  let logger;
  let dataRegistry;
  let monteCarloSimulator;
  let failureExplainer;
  let sensitivityAnalyzer;
  let reportOrchestrator;

  beforeEach(() => {
    logger = createLogger();
    dataRegistry = {
      get: jest.fn((category, lookupId) => {
        if (category !== 'lookups') {
          return null;
        }
        if (lookupId === 'core:emotion_prototypes') {
          return mockEmotionPrototypes;
        }
        if (lookupId === 'core:sexual_prototypes') {
          return mockSexualPrototypes;
        }
        return null;
      }),
    };

    const randomStateGenerator = new RandomStateGenerator({ logger });
    const emotionCalculatorAdapter = buildEmotionCalculatorAdapter(
      dataRegistry,
      logger
    );

    monteCarloSimulator = new MonteCarloSimulator({
      logger,
      dataRegistry,
      emotionCalculatorAdapter,
      randomStateGenerator,
    });

    failureExplainer = new FailureExplainer({ logger, dataRegistry });
    sensitivityAnalyzer = new SensitivityAnalyzer({
      logger,
      monteCarloSimulator,
    });
    reportOrchestrator = new ReportOrchestrator({
      logger,
      sensitivityAnalyzer,
      monteCarloReportGenerator: new MonteCarloReportGenerator({ logger }),
    });
  });

  it('computes sensitivity grids after simulation and blocker analysis', async () => {
    const expression = {
      id: 'test:sensitivity_flow',
      prerequisites: [
        {
          logic: {
            and: [
              { '>=': [{ var: 'emotions.joy' }, 0.5] },
              { '<=': [{ var: 'emotions.fear' }, 0.4] },
            ],
          },
        },
      ],
    };

    const simulationResult = await monteCarloSimulator.simulate(expression, {
      sampleCount: 300,
      distribution: 'uniform',
      storeSamplesForSensitivity: true,
    });
    const blockers = failureExplainer.analyzeHierarchicalBlockers(
      simulationResult.clauseFailures
    );
    const sensitivityData = sensitivityAnalyzer.computeSensitivityData(
      simulationResult.storedContexts,
      blockers
    );
    const expectedPopulationHash = buildPopulationHash(
      simulationResult.storedContexts.map((_, index) => index),
      'all'
    );

    expect(Array.isArray(sensitivityData)).toBe(true);
    expect(sensitivityData.length).toBeGreaterThan(0);

    const conditionPaths = sensitivityData.map((result) => result.conditionPath);
    expect(conditionPaths).toContain('emotions.joy');
    expect(conditionPaths).toContain('emotions.fear');

    for (const result of sensitivityData) {
      expect(result.populationHash).toBe(expectedPopulationHash);
      expect(Array.isArray(result.grid)).toBe(true);
      expect(result.grid.length).toBeGreaterThan(0);
      for (const point of result.grid) {
        expect(point.passRate).toBeGreaterThanOrEqual(0);
        expect(point.passRate).toBeLessThanOrEqual(1);
      }
    }
  });

  it('computes global sensitivity grids using expression logic', async () => {
    const expression = {
      id: 'test:global_sensitivity_flow',
      prerequisites: [
        {
          logic: {
            and: [
              { '>=': [{ var: 'emotions.joy' }, 0.5] },
              { '>=': [{ var: 'emotions.excitement' }, 0.3] },
              { '<=': [{ var: 'emotions.fear' }, 0.4] },
            ],
          },
        },
      ],
    };

    const simulationResult = await monteCarloSimulator.simulate(expression, {
      sampleCount: 400,
      distribution: 'uniform',
      storeSamplesForSensitivity: true,
    });
    const blockers = failureExplainer.analyzeHierarchicalBlockers(
      simulationResult.clauseFailures
    );
    const globalSensitivity = sensitivityAnalyzer.computeGlobalSensitivityData(
      simulationResult.storedContexts,
      blockers,
      expression.prerequisites
    );
    const expectedPopulationHash = buildPopulationHash(
      simulationResult.storedContexts.map((_, index) => index),
      'all'
    );

    expect(Array.isArray(globalSensitivity)).toBe(true);
    expect(globalSensitivity.length).toBeGreaterThan(0);
    for (const result of globalSensitivity) {
      expect(result.isExpressionLevel).toBe(true);
      expect(result.populationHash).toBe(expectedPopulationHash);
      expect(Array.isArray(result.grid)).toBe(true);
      for (const point of result.grid) {
        expect(point.triggerRate).toBeGreaterThanOrEqual(0);
        expect(point.triggerRate).toBeLessThanOrEqual(1);
      }
    }
  });

  it('generates report sections when sensitivity data is available', async () => {
    const expression = {
      id: 'test:report_sensitivity',
      prerequisites: [
        { logic: { '>=': [{ var: 'emotions.joy' }, 0.5] } },
      ],
    };

    const simulationResult = await monteCarloSimulator.simulate(expression, {
      sampleCount: 200,
      distribution: 'uniform',
      storeSamplesForSensitivity: true,
    });
    const blockers = failureExplainer.analyzeHierarchicalBlockers(
      simulationResult.clauseFailures
    );

    const report = reportOrchestrator.generateReport({
      expressionName: 'Test Expression',
      summary: '',
      simulationResult,
      blockers,
      prerequisites: expression.prerequisites,
    });

    expect(report).toContain('## Marginal Clause Pass-Rate Sweep');
    expect(report).toContain('## Global Expression Sensitivity Analysis');
  });

  it('omits sensitivity sections when sensitivity data is unavailable', async () => {
    const expression = {
      id: 'test:report_no_sensitivity',
      prerequisites: [
        { logic: { '>=': [{ var: 'emotions.joy' }, 0.5] } },
      ],
    };

    const simulationResult = await monteCarloSimulator.simulate(expression, {
      sampleCount: 200,
      distribution: 'uniform',
      storeSamplesForSensitivity: false,
    });
    const blockers = failureExplainer.analyzeHierarchicalBlockers(
      simulationResult.clauseFailures
    );

    const report = reportOrchestrator.generateReport({
      expressionName: 'Test Expression',
      summary: '',
      simulationResult,
      blockers,
      prerequisites: expression.prerequisites,
    });

    expect(report).not.toContain('## Marginal Clause Pass-Rate Sweep');
    expect(report).not.toContain('## Global Expression Sensitivity Analysis');
  });
});
