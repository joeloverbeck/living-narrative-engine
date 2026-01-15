/**
 * @file Snapshot integration tests for MonteCarloReportGenerator
 *
 * These tests create a safety net for the refactoring effort by capturing
 * the exact output format of the report generator. Any formatting changes
 * during refactoring will cause these tests to fail, ensuring backwards
 * compatibility.
 *
 * ## Snapshot Update Process
 *
 * When intentional formatting changes are made:
 * 1. Review the diff to confirm changes are intentional
 * 2. Run: npm run test:integration -- tests/integration/expression-diagnostics/monteCarloReportSnapshot.integration.test.js --updateSnapshot
 * 3. Commit the updated snapshots with the code changes
 * @see reports/monteCarloReportGenerator-refactoring-analysis.md
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import MonteCarloReportGenerator from '../../../src/expressionDiagnostics/services/MonteCarloReportGenerator.js';
import PrototypeConstraintAnalyzer from '../../../src/expressionDiagnostics/services/PrototypeConstraintAnalyzer.js';
import PrototypeFitRankingService from '../../../src/expressionDiagnostics/services/PrototypeFitRankingService.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import standardSimulationResult from '../../fixtures/expressionDiagnostics/snapshotFixtures/standardSimulationResult.json';
import standardBlockersFixture from '../../fixtures/expressionDiagnostics/snapshotFixtures/standardBlockers.json';

// ============================================================================
// Test Fixtures and Helpers
// ============================================================================

/**
 * Create a minimal emotion prototype lookup for integration tests.
 *
 * @returns {object} Lookup data with emotion prototypes
 */
function createPrototypeLookup() {
  return {
    id: 'core:emotion_prototypes',
    entries: {
      joy: {
        weights: { valence: 1.0, arousal: 0.6 },
        gates: ['valence >= 0.3'],
      },
      fear: {
        weights: { valence: -0.8, arousal: 0.7, threat: 0.9 },
        gates: ['threat >= 0.2'],
      },
      curiosity: {
        weights: { valence: 0.5, arousal: 0.8 },
        gates: ['arousal >= 0.4'],
      },
    },
  };
}

/**
 * Create a data registry seeded with prototype lookups.
 *
 * @param {object} logger - Logger implementation
 * @returns {InMemoryDataRegistry} Seeded registry
 */
function createPrototypeDataRegistry(logger) {
  const registry = new InMemoryDataRegistry({ logger });
  registry.store('lookups', 'core:emotion_prototypes', createPrototypeLookup());
  return registry;
}

/**
 * Create a report generator wired for prototype analysis.
 *
 * @param {object} logger - Logger implementation
 * @returns {MonteCarloReportGenerator} Configured report generator
 */
function createPrototypeReportGenerator(logger) {
  const dataRegistry = createPrototypeDataRegistry(logger);
  const prototypeConstraintAnalyzer = new PrototypeConstraintAnalyzer({
    dataRegistry,
    logger,
  });
  const prototypeFitRankingService = new PrototypeFitRankingService({
    dataRegistry,
    logger,
    prototypeConstraintAnalyzer,
  });

  return new MonteCarloReportGenerator({
    logger,
    prototypeConstraintAnalyzer,
    prototypeFitRankingService,
  });
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Normalize timestamps in report to enable deterministic snapshot comparisons.
 * Timestamps change on every test run, so we replace them with a placeholder.
 *
 * @param {string} report - Report markdown
 * @returns {string} Report with timestamps normalized
 */
function normalizeTimestamps(report) {
  return report.replace(
    /\*\*Generated\*\*: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g,
    '**Generated**: [TIMESTAMP]'
  );
}

// ============================================================================
// Snapshot Test Suite
// ============================================================================

describe('MonteCarloReportGenerator Snapshot Tests', () => {
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
  // Full Report Snapshots
  // ==========================================================================

  describe('Full Report Snapshots', () => {
    it('generates consistent output for standard simulation', () => {
      const generator = new MonteCarloReportGenerator({ logger: mockLogger });

      // Deep clone fixtures to avoid mutation
      const simulationResult = JSON.parse(
        JSON.stringify(standardSimulationResult)
      );
      const { blockers } = JSON.parse(
        JSON.stringify(standardBlockersFixture)
      );

      const report = generator.generate({
        expressionName: 'test:snapshot_expression',
        simulationResult,
        blockers,
        summary: 'Snapshot test summary for refactoring safety',
      });

      expect(normalizeTimestamps(report)).toMatchSnapshot('standard-simulation-full-report');
    });

    it('generates consistent output with prototype fit analysis', () => {
      const generator = createPrototypeReportGenerator(mockLogger);

      const simulationResult = JSON.parse(
        JSON.stringify(standardSimulationResult)
      );
      const { blockers, prerequisites } = JSON.parse(
        JSON.stringify(standardBlockersFixture)
      );

      const report = generator.generate({
        expressionName: 'test:prototype_snapshot_expression',
        simulationResult,
        blockers,
        summary: 'Prototype fit snapshot test',
        prerequisites,
      });

      expect(normalizeTimestamps(report)).toMatchSnapshot('prototype-fit-full-report');
    });

    it('generates consistent output with sensitivity data', () => {
      const generator = new MonteCarloReportGenerator({ logger: mockLogger });

      const simulationResult = JSON.parse(
        JSON.stringify(standardSimulationResult)
      );
      const { blockers } = JSON.parse(
        JSON.stringify(standardBlockersFixture)
      );

      // Add sensitivity data for sweep analysis
      const sensitivityData = [
        {
          kind: 'marginalClausePassRateSweep',
          conditionPath: 'emotions.joy',
          operator: '>=',
          originalThreshold: 0.5,
          grid: [
            { threshold: 0.35, passRate: 0.85, passCount: 8500, sampleCount: 10000 },
            { threshold: 0.4, passRate: 0.7, passCount: 7000, sampleCount: 10000 },
            { threshold: 0.45, passRate: 0.5, passCount: 5000, sampleCount: 10000 },
            { threshold: 0.5, passRate: 0.25, passCount: 2500, sampleCount: 10000 },
            { threshold: 0.55, passRate: 0.1, passCount: 1000, sampleCount: 10000 },
            { threshold: 0.6, passRate: 0.05, passCount: 500, sampleCount: 10000 },
            { threshold: 0.65, passRate: 0.02, passCount: 200, sampleCount: 10000 },
          ],
        },
      ];

      const globalSensitivityData = [
        {
          kind: 'expressionTriggerRateSweep',
          varPath: 'emotions.joy',
          operator: '>=',
          originalThreshold: 0.5,
          isExpressionLevel: true,
          grid: [
            { threshold: 0.35, triggerRate: 0.45, triggerCount: 4500, sampleCount: 10000 },
            { threshold: 0.4, triggerRate: 0.35, triggerCount: 3500, sampleCount: 10000 },
            { threshold: 0.45, triggerRate: 0.25, triggerCount: 2500, sampleCount: 10000 },
            { threshold: 0.5, triggerRate: 0.15, triggerCount: 1500, sampleCount: 10000 },
            { threshold: 0.55, triggerRate: 0.08, triggerCount: 800, sampleCount: 10000 },
            { threshold: 0.6, triggerRate: 0.04, triggerCount: 400, sampleCount: 10000 },
            { threshold: 0.65, triggerRate: 0.02, triggerCount: 200, sampleCount: 10000 },
          ],
        },
      ];

      const report = generator.generate({
        expressionName: 'test:sensitivity_snapshot_expression',
        simulationResult,
        blockers,
        summary: 'Sensitivity analysis snapshot test',
        sensitivityData,
        globalSensitivityData,
      });

      expect(normalizeTimestamps(report)).toMatchSnapshot('sensitivity-analysis-full-report');
    });

    it('generates consistent output for zero trigger rate scenario', () => {
      const generator = new MonteCarloReportGenerator({ logger: mockLogger });

      const simulationResult = {
        triggerRate: 0,
        triggerCount: 0,
        sampleCount: 10000,
        confidenceInterval: { low: 0, high: 0.0003 },
        distribution: 'uniform',
        clauseFailures: [],
        storedContexts: [],
      };

      const { blockers } = JSON.parse(
        JSON.stringify(standardBlockersFixture)
      );

      const report = generator.generate({
        expressionName: 'test:zero_trigger_expression',
        simulationResult,
        blockers,
        summary: 'Zero trigger rate scenario',
      });

      expect(normalizeTimestamps(report)).toMatchSnapshot('zero-trigger-rate-report');
    });

    it('generates consistent output for high trigger rate scenario', () => {
      const generator = new MonteCarloReportGenerator({ logger: mockLogger });

      const simulationResult = {
        triggerRate: 0.95,
        triggerCount: 9500,
        sampleCount: 10000,
        confidenceInterval: { low: 0.94, high: 0.96 },
        distribution: 'uniform',
        clauseFailures: [],
        storedContexts: standardSimulationResult.storedContexts,
      };

      const report = generator.generate({
        expressionName: 'test:high_trigger_expression',
        simulationResult,
        blockers: [],
        summary: 'High trigger rate with no blockers',
      });

      expect(normalizeTimestamps(report)).toMatchSnapshot('high-trigger-rate-report');
    });
  });

  // ==========================================================================
  // Integrity Warnings Snapshots
  // ==========================================================================

  describe('Integrity Warnings Snapshots', () => {
    it('generates consistent integrity warnings output', () => {
      const generator = new MonteCarloReportGenerator({ logger: mockLogger });

      const simulationResult = JSON.parse(
        JSON.stringify(standardSimulationResult)
      );
      const { blockers, prerequisites } = JSON.parse(
        JSON.stringify(standardBlockersFixture)
      );

      const warnings = generator.collectReportIntegrityWarnings({
        simulationResult,
        blockers,
        prerequisites,
        sensitivityData: [],
        globalSensitivityData: [],
      });

      // Integrity warnings don't contain timestamps, no normalization needed
      expect(warnings).toMatchSnapshot('integrity-warnings');
    });
  });

  // ==========================================================================
  // Edge Case Snapshots
  // ==========================================================================

  describe('Edge Case Snapshots', () => {
    it('generates consistent output with empty blockers', () => {
      const generator = new MonteCarloReportGenerator({ logger: mockLogger });

      const simulationResult = JSON.parse(
        JSON.stringify(standardSimulationResult)
      );

      const report = generator.generate({
        expressionName: 'test:no_blockers_expression',
        simulationResult,
        blockers: [],
        summary: 'Expression with no blockers',
      });

      expect(normalizeTimestamps(report)).toMatchSnapshot('empty-blockers-report');
    });

    it('generates consistent output with OR-only breakdown', () => {
      const generator = new MonteCarloReportGenerator({ logger: mockLogger });

      const simulationResult = JSON.parse(
        JSON.stringify(standardSimulationResult)
      );

      // Use only the OR blocker from fixtures
      const { blockers } = JSON.parse(
        JSON.stringify(standardBlockersFixture)
      );
      const orBlocker = blockers.find((b) =>
        b.clauseDescription.includes('OR')
      );

      const report = generator.generate({
        expressionName: 'test:or_only_expression',
        simulationResult,
        blockers: orBlocker ? [orBlocker] : [],
        summary: 'OR-only blocker scenario',
      });

      expect(normalizeTimestamps(report)).toMatchSnapshot('or-only-breakdown-report');
    });
  });
});
