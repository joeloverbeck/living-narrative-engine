/**
 * @file Worker thread integration tests for MonteCarloReportGenerator
 *
 * These tests verify that the worker thread pattern used in MonteCarloReportWorker.js
 * correctly creates and uses MonteCarloReportGenerator. Since the worker uses
 * Web Worker APIs (self.addEventListener), we test by recreating the worker's
 * dependency instantiation pattern and verifying output parity.
 *
 * These tests track the worker factory pattern introduced in
 * MONCARREPGENREFANA-012.
 * @see src/expressionDiagnostics/workers/MonteCarloReportWorker.js
 * @see reports/monteCarloReportGenerator-refactoring-analysis.md
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import MonteCarloReportGenerator from '../../../src/expressionDiagnostics/services/MonteCarloReportGenerator.js';
import PrototypeConstraintAnalyzer from '../../../src/expressionDiagnostics/services/PrototypeConstraintAnalyzer.js';
import PrototypeFitRankingService from '../../../src/expressionDiagnostics/services/PrototypeFitRankingService.js';
import ReportOrchestrator from '../../../src/expressionDiagnostics/services/ReportOrchestrator.js';
import SensitivityAnalyzer from '../../../src/expressionDiagnostics/services/SensitivityAnalyzer.js';
import { createReportGenerator } from '../../../src/expressionDiagnostics/services/reportGeneratorFactory.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import standardSimulationResult from '../../fixtures/expressionDiagnostics/snapshotFixtures/standardSimulationResult.json';
import standardBlockersFixture from '../../fixtures/expressionDiagnostics/snapshotFixtures/standardBlockers.json';

// ============================================================================
// Worker-Style Dependencies (mirrors MonteCarloReportWorker.js)
// ============================================================================

/**
 * Minimal logger matching WorkerLogger in MonteCarloReportWorker.js
 */
class WorkerStyleLogger {
  debug() {}
  info() {}
  warn() {}
  error() {}
}

/**
 * Minimal data registry matching WorkerDataRegistry in MonteCarloReportWorker.js
 */
class WorkerStyleDataRegistry {
  #lookups;

  constructor(lookups = {}) {
    this.#lookups = lookups;
  }

  getLookupData(key) {
    return this.#lookups[key] || null;
  }

  get() {
    return null;
  }
}

/**
 * Minimal sensitivity simulator matching SensitivitySimulator in MonteCarloReportWorker.js
 *
 * Note: This is a simplified version for testing. The actual worker has a full
 * implementation of computeThresholdSensitivity and computeExpressionSensitivity.
 */
class WorkerStyleSensitivitySimulator {
  // eslint-disable-next-line no-unused-vars
  constructor({ logger }) {
    // Logger available for debugging if needed
  }

  computeThresholdSensitivity(
    storedContexts,
    varPath,
    operator,
    originalThreshold,
    options = {}
  ) {
    const { steps = 9, stepSize = 0.05 } = options;

    if (!storedContexts || storedContexts.length === 0) {
      return {
        kind: 'marginalClausePassRateSweep',
        conditionPath: varPath,
        operator,
        originalThreshold,
        grid: [],
      };
    }

    const grid = [];
    const halfSteps = Math.floor(steps / 2);

    for (let i = -halfSteps; i <= halfSteps; i++) {
      const threshold = originalThreshold + i * stepSize;
      let passCount = 0;

      for (const context of storedContexts) {
        const actualValue = this.#getNestedValue(context, varPath);
        if (actualValue === undefined || actualValue === null) continue;

        const passes = this.#evaluateThresholdCondition(
          actualValue,
          operator,
          threshold
        );
        if (passes) passCount++;
      }

      const passRate = passCount / storedContexts.length;

      grid.push({
        threshold,
        passRate,
        passCount,
        sampleCount: storedContexts.length,
      });
    }

    return {
      kind: 'marginalClausePassRateSweep',
      conditionPath: varPath,
      operator,
      originalThreshold,
      grid,
    };
  }

  computeExpressionSensitivity() {
    // Simplified for testing
    return {
      kind: 'expressionTriggerRateSweep',
      grid: [],
      isExpressionLevel: true,
    };
  }

  #getNestedValue(obj, path) {
    return path.split('.').reduce((o, k) => o?.[k], obj);
  }

  #evaluateThresholdCondition(actual, operator, threshold) {
    switch (operator) {
      case '>=':
        return actual >= threshold;
      case '>':
        return actual > threshold;
      case '<=':
        return actual <= threshold;
      case '<':
        return actual < threshold;
      default:
        return false;
    }
  }
}

/**
 * Recreates the worker's buildReport function for testing.
 * This mirrors the exact pattern used in MonteCarloReportWorker.js
 *
 * @param {object} payload - The payload that would be sent to the worker
 * @returns {string} Generated report markdown
 */
function buildReportWorkerStyle(payload) {
  const logger = new WorkerStyleLogger();
  const dataRegistry = new WorkerStyleDataRegistry(payload.lookups || {});
  const prototypeConstraintAnalyzer = new PrototypeConstraintAnalyzer({
    dataRegistry,
    logger,
  });
  const prototypeFitRankingService = new PrototypeFitRankingService({
    dataRegistry,
    logger,
    prototypeConstraintAnalyzer,
  });
  const reportGenerator = createReportGenerator({
    logger,
    prototypeConstraintAnalyzer,
    prototypeFitRankingService,
  });
  const sensitivityAnalyzer = new SensitivityAnalyzer({
    logger,
    monteCarloSimulator: new WorkerStyleSensitivitySimulator({ logger }),
  });
  const reportOrchestrator = new ReportOrchestrator({
    logger,
    sensitivityAnalyzer,
    monteCarloReportGenerator: reportGenerator,
    dataRegistry,
  });

  return reportOrchestrator.generateReport(payload);
}

// ============================================================================
// Main Thread Style Dependencies (for comparison)
// ============================================================================

/**
 * Creates a report using the same pattern as main thread usage.
 *
 * @param {object} params - Generation parameters
 * @param {object} mockLogger - Mock logger implementation
 * @returns {string} Generated report markdown
 */
function generateReportMainThreadStyle(params, mockLogger) {
  const dataRegistry = new InMemoryDataRegistry({ logger: mockLogger });

  // Seed with lookups if provided
  if (params.lookups) {
    for (const [key, value] of Object.entries(params.lookups)) {
      dataRegistry.store('lookups', key, value);
    }
  }

  const prototypeConstraintAnalyzer = new PrototypeConstraintAnalyzer({
    dataRegistry,
    logger: mockLogger,
  });
  const prototypeFitRankingService = new PrototypeFitRankingService({
    dataRegistry,
    logger: mockLogger,
    prototypeConstraintAnalyzer,
  });

  const generator = new MonteCarloReportGenerator({
    logger: mockLogger,
    prototypeConstraintAnalyzer,
    prototypeFitRankingService,
  });

  return generator.generate({
    expressionName: params.expressionName,
    simulationResult: params.simulationResult,
    blockers: params.blockers,
    summary: params.summary || '',
    prerequisites: params.prerequisites || null,
    sensitivityData: params.sensitivityData || [],
    globalSensitivityData: params.globalSensitivityData || [],
    staticAnalysis: params.staticAnalysis || null,
  });
}

// ============================================================================
// Worker Integration Test Suite
// ============================================================================

describe('MonteCarloReportWorker Integration Tests', () => {
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
  });

  // ==========================================================================
  // Worker Report Generation Tests
  // ==========================================================================

  describe('Worker Report Generation', () => {
    it('creates MonteCarloReportGenerator with dependencies using worker pattern', () => {
      const payload = {
        expressionName: 'test:worker_expression',
        simulationResult: JSON.parse(JSON.stringify(standardSimulationResult)),
        blockers: JSON.parse(JSON.stringify(standardBlockersFixture.blockers)),
        summary: 'Worker test summary',
      };

      // This should not throw - it verifies the instantiation pattern works
      const report = buildReportWorkerStyle(payload);

      expect(typeof report).toBe('string');
      expect(report.length).toBeGreaterThan(0);
      expect(report).toContain('# Monte Carlo Analysis Report');
    });

    it('produces report with expected sections via worker pattern', () => {
      const payload = {
        expressionName: 'test:worker_sections_expression',
        simulationResult: JSON.parse(JSON.stringify(standardSimulationResult)),
        blockers: JSON.parse(JSON.stringify(standardBlockersFixture.blockers)),
        summary: 'Worker sections test',
      };

      const report = buildReportWorkerStyle(payload);

      // Verify major sections are present
      expect(report).toContain('## Executive Summary');
      expect(report).toContain('## Blocker Analysis');
      expect(report).toContain('## Legend');
    });

    it('handles prototype lookups in worker pattern', () => {
      const payload = {
        expressionName: 'test:worker_prototype_expression',
        simulationResult: JSON.parse(JSON.stringify(standardSimulationResult)),
        blockers: JSON.parse(JSON.stringify(standardBlockersFixture.blockers)),
        prerequisites: standardBlockersFixture.prerequisites,
        summary: 'Worker prototype test',
        lookups: {
          'core:emotion_prototypes': {
            id: 'core:emotion_prototypes',
            entries: {
              joy: {
                weights: { valence: 1.0, arousal: 0.6 },
                gates: ['valence >= 0.3'],
              },
            },
          },
        },
      };

      const report = buildReportWorkerStyle(payload);

      expect(typeof report).toBe('string');
      expect(report.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Output Parity Tests
  // ==========================================================================

  describe('Worker vs Main Thread Parity', () => {
    /**
     * Removes timestamp lines from report for comparison purposes.
     * Timestamps differ by milliseconds between calls, so we normalize them.
     *
     * @param {string} report - Report markdown
     * @returns {string} Report with timestamps normalized
     */
    function normalizeTimestamps(report) {
      return report.replace(/\*\*Generated\*\*: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g, '**Generated**: [TIMESTAMP]');
    }

    it('worker pattern produces structurally similar output to main thread', () => {
      const simulationResult = JSON.parse(
        JSON.stringify(standardSimulationResult)
      );
      const blockers = JSON.parse(
        JSON.stringify(standardBlockersFixture.blockers)
      );

      const workerPayload = {
        expressionName: 'test:parity_expression',
        simulationResult,
        blockers,
        summary: 'Parity test',
      };

      const workerReport = buildReportWorkerStyle(workerPayload);
      const mainThreadReport = generateReportMainThreadStyle(
        workerPayload,
        mockLogger
      );

      // Both should produce valid reports
      expect(typeof workerReport).toBe('string');
      expect(typeof mainThreadReport).toBe('string');

      // Both should contain the same major sections
      const sections = [
        '# Monte Carlo Analysis Report',
        '## Executive Summary',
        '## Blocker Analysis',
        '## Legend',
      ];

      for (const section of sections) {
        expect(workerReport).toContain(section);
        expect(mainThreadReport).toContain(section);
      }

      // Worker uses ReportOrchestrator which invokes SensitivityAnalyzer,
      // while main thread uses MonteCarloReportGenerator.generate() directly.
      // The worker report may contain additional sensitivity data sections.
      // We verify structural equivalence by checking that both reports
      // share the same core sections (normalized for timestamps).
      const normalizedWorker = normalizeTimestamps(workerReport);
      const normalizedMain = normalizeTimestamps(mainThreadReport);

      // Both should have the same expression name
      expect(normalizedWorker).toContain('**Expression**: test:parity_expression');
      expect(normalizedMain).toContain('**Expression**: test:parity_expression');

      // Both should have the same executive summary section
      expect(normalizedWorker).toContain('**Trigger Rate**: 15.00%');
      expect(normalizedMain).toContain('**Trigger Rate**: 15.00%');

      // Both should have the same blocker analysis
      expect(normalizedWorker).toContain('emotions.joy >= 0.5');
      expect(normalizedMain).toContain('emotions.joy >= 0.5');

      // Worker may have additional sensitivity sections, but core is shared
      expect(normalizedWorker.length).toBeGreaterThanOrEqual(normalizedMain.length);
    });

    it('both patterns handle empty blockers identically', () => {
      const simulationResult = JSON.parse(
        JSON.stringify(standardSimulationResult)
      );

      const payload = {
        expressionName: 'test:empty_blockers_parity',
        simulationResult,
        blockers: [],
        summary: 'Empty blockers parity test',
      };

      const workerReport = buildReportWorkerStyle(payload);
      const mainThreadReport = generateReportMainThreadStyle(payload, mockLogger);

      // Normalize timestamps for comparison
      const normalizedWorker = normalizeTimestamps(workerReport);
      const normalizedMain = normalizeTimestamps(mainThreadReport);

      // Both reports should share the same core structure
      // Worker may have additional sensitivity sections
      expect(normalizedWorker).toContain('**Expression**: test:empty_blockers_parity');
      expect(normalizedMain).toContain('**Expression**: test:empty_blockers_parity');

      // Both should have the Legend section
      expect(normalizedWorker).toContain('## Legend');
      expect(normalizedMain).toContain('## Legend');

      // Worker report should be at least as long as main thread report
      expect(normalizedWorker.length).toBeGreaterThanOrEqual(normalizedMain.length);
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================

  describe('Error Handling', () => {
    it('handles missing simulationResult gracefully', () => {
      const payload = {
        expressionName: 'test:missing_result',
        simulationResult: null,
        blockers: [],
        summary: 'Missing result test',
      };

      // Should not throw, but may produce minimal output or handle gracefully
      expect(() => buildReportWorkerStyle(payload)).not.toThrow();
    });

    it('handles undefined blockers gracefully', () => {
      const payload = {
        expressionName: 'test:undefined_blockers',
        simulationResult: JSON.parse(JSON.stringify(standardSimulationResult)),
        blockers: undefined,
        summary: 'Undefined blockers test',
      };

      // Should not throw
      expect(() => buildReportWorkerStyle(payload)).not.toThrow();
    });

    it('handles empty payload gracefully', () => {
      const payload = {};

      // Should not throw - worker pattern should be resilient
      expect(() => buildReportWorkerStyle(payload)).not.toThrow();
    });

    it('handles malformed simulation data gracefully', () => {
      const payload = {
        expressionName: 'test:malformed',
        simulationResult: {
          triggerRate: 'not a number',
          sampleCount: -1,
        },
        blockers: [],
        summary: 'Malformed data test',
      };

      // Should not throw
      expect(() => buildReportWorkerStyle(payload)).not.toThrow();
    });
  });

  // ==========================================================================
  // Sensitivity Analysis in Worker Context
  // ==========================================================================

  describe('Sensitivity Analysis via Worker Pattern', () => {
    it('worker pattern can run with sensitivity data', () => {
      const payload = {
        expressionName: 'test:worker_sensitivity',
        simulationResult: JSON.parse(JSON.stringify(standardSimulationResult)),
        blockers: JSON.parse(JSON.stringify(standardBlockersFixture.blockers)),
        summary: 'Worker sensitivity test',
        sensitivityData: [
          {
            kind: 'marginalClausePassRateSweep',
            conditionPath: 'emotions.joy',
            operator: '>=',
            originalThreshold: 0.5,
            grid: [
              { threshold: 0.4, passRate: 0.6, passCount: 6000, sampleCount: 10000 },
              { threshold: 0.5, passRate: 0.25, passCount: 2500, sampleCount: 10000 },
              { threshold: 0.6, passRate: 0.05, passCount: 500, sampleCount: 10000 },
            ],
          },
        ],
      };

      const report = buildReportWorkerStyle(payload);

      expect(typeof report).toBe('string');
      expect(report.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Regression Tests for Future Factory Pattern
  // ==========================================================================

  describe('Factory Pattern Preparation', () => {
    it('worker instantiation pattern uses factory to create service graph', () => {
      // This test documents the current instantiation pattern
      const logger = new WorkerStyleLogger();
      const dataRegistry = new WorkerStyleDataRegistry({});

      const prototypeConstraintAnalyzer = new PrototypeConstraintAnalyzer({
        dataRegistry,
        logger,
      });

      const prototypeFitRankingService = new PrototypeFitRankingService({
        dataRegistry,
        logger,
        prototypeConstraintAnalyzer,
      });

      const reportGenerator = createReportGenerator({
        logger,
        prototypeConstraintAnalyzer,
        prototypeFitRankingService,
      });

      const sensitivityAnalyzer = new SensitivityAnalyzer({
        logger,
        monteCarloSimulator: new WorkerStyleSensitivitySimulator({ logger }),
      });

      const reportOrchestrator = new ReportOrchestrator({
        logger,
        sensitivityAnalyzer,
        monteCarloReportGenerator: reportGenerator,
        dataRegistry,
      });

      // Verify all services were created
      expect(prototypeConstraintAnalyzer).toBeDefined();
      expect(prototypeFitRankingService).toBeDefined();
      expect(reportGenerator).toBeDefined();
      expect(sensitivityAnalyzer).toBeDefined();
      expect(reportOrchestrator).toBeDefined();

      // Verify service methods exist
      expect(typeof reportGenerator.generate).toBe('function');
      expect(typeof reportOrchestrator.generateReport).toBe('function');
    });
  });
});
