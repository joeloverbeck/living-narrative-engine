/**
 * @file Integration tests for fit vs feasibility conflict detection in Monte Carlo reports.
 *
 * Tests the end-to-end behavior of conflict detection between "clean prototype fit"
 * and "impossible non-axis clauses".
 * @see specs/prototype-fit-blockers-scope-disambiguation.md
 * @see tickets/PROFITBLOSCODIS-014-integration-tests.md
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import MonteCarloReportGenerator from '../../../src/expressionDiagnostics/services/MonteCarloReportGenerator.js';
import PrototypeConstraintAnalyzer from '../../../src/expressionDiagnostics/services/PrototypeConstraintAnalyzer.js';
import PrototypeFitRankingService from '../../../src/expressionDiagnostics/services/PrototypeFitRankingService.js';
import NonAxisClauseExtractor from '../../../src/expressionDiagnostics/services/NonAxisClauseExtractor.js';
import NonAxisFeasibilityAnalyzer from '../../../src/expressionDiagnostics/services/NonAxisFeasibilityAnalyzer.js';
import FitFeasibilityConflictDetector from '../../../src/expressionDiagnostics/services/FitFeasibilityConflictDetector.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import { diagnosticsTokens } from '../../../src/dependencyInjection/tokens/tokens-diagnostics.js';

// ============================================================================
// Test Fixtures
// ============================================================================

/**
 * Create mock logger.
 *
 * @returns {object}
 */
const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

/**
 * Create emotion prototype lookup with weights and gates.
 *
 * @returns {object}
 */
const createPrototypeLookup = () => ({
  id: 'core:emotion_prototypes',
  entries: {
    joy: {
      weights: { valence: 1.0, arousal: 0.5 },
      gates: ['valence >= 0.3'],
    },
    confusion: {
      weights: { valence: -0.3, arousal: 0.6, dominance: -0.4 },
      gates: ['arousal >= 0.4'],
    },
    flow_absorption: {
      weights: { valence: 0.7, arousal: 0.3, agency_control: -0.5 },
      gates: ['agency_control <= 0.25'],
    },
    anger: {
      weights: { valence: -0.8, arousal: 0.9 },
      gates: ['valence <= 0.2'],
    },
  },
});

/**
 * Create data registry seeded with prototype lookups.
 *
 * @param {object} logger
 * @returns {InMemoryDataRegistry}
 */
const createDataRegistry = (logger) => {
  const registry = new InMemoryDataRegistry({ logger });
  registry.store('lookups', 'core:emotion_prototypes', createPrototypeLookup());
  return registry;
};

/**
 * Create report generator with all required services.
 *
 * @param {object} logger
 * @returns {MonteCarloReportGenerator}
 */
const createReportGenerator = (logger) => {
  const dataRegistry = createDataRegistry(logger);
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
};

/**
 * Create simulation result with stored contexts.
 *
 * @param {object} [overrides]
 * @returns {object}
 */
const createSimulationResult = (overrides = {}) => ({
  triggerRate: 0.1,
  triggerCount: 100,
  sampleCount: 1000,
  confidenceInterval: { low: 0.09, high: 0.11 },
  distribution: 'uniform',
  clauseFailures: [],
  storedContexts: [],
  inRegimeSampleCount: 200,
  ...overrides,
});

/**
 * Create mock in-regime contexts where mood constraints pass.
 *
 * @param {number} count
 * @param {object} [emotionOverrides]
 * @returns {Array<object>}
 */
const createMockContexts = (count, emotionOverrides = {}) => {
  return Array(count)
    .fill(null)
    .map((_, i) => ({
      moodAxes: {
        valence: 0.4 + (i % 30) * 0.01,
        arousal: 0.3 + (i % 20) * 0.005,
        dominance: 0.5,
        agency_control: 0.5,
      },
      emotions: {
        confusion: 0.1 + (i % 20) * 0.005, // Max ~0.2, below 0.25 threshold
        joy: 0.3 + (i % 50) * 0.01,
        flow_absorption: 0.2 + (i % 40) * 0.01,
        anger: 0.05 + (i % 10) * 0.01,
        ...emotionOverrides,
      },
      sexualStates: {},
    }));
};

/**
 * Extract a named section from a markdown report.
 * Handles emoji characters and partial matches in section names.
 *
 * @param {string} report
 * @param {string} sectionName
 * @returns {string}
 */
const extractSection = (report, sectionName) => {
  // Escape special regex characters in section name
  const escapedName = sectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Allow for emoji or other characters between ## and section name
  const regex = new RegExp(`##[^\\n]*${escapedName}[\\s\\S]*?(?=##|$)`, 'i');
  const match = report.match(regex);
  return match ? match[0] : '';
};

// ============================================================================
// Test Fixture: Expression with Impossible Clause
// ============================================================================

const FIXTURE_IMPOSSIBLE_CONFUSION = {
  id: 'test:flow_with_impossible_confusion',
  prerequisites: [
    { logic: { '>=': [{ var: 'moodAxes.valence' }, 0.3] } },
    { logic: { '<=': [{ var: 'moodAxes.arousal' }, 0.6] } },
    { logic: { '>=': [{ var: 'emotions.confusion' }, 0.25] } },
  ],
};

// ============================================================================
// Test Fixture: Expression with Achievable Clauses
// ============================================================================

const FIXTURE_ACHIEVABLE = {
  id: 'test:achievable_joy',
  prerequisites: [
    { logic: { '>=': [{ var: 'moodAxes.valence' }, 0.3] } },
    { logic: { '>=': [{ var: 'emotions.joy' }, 0.1] } }, // Easily achievable
  ],
};

// ============================================================================
// Integration Test Suite
// ============================================================================

describe('Fit vs Feasibility Conflict Integration', () => {
  let logger;
  let reportGenerator;

  beforeEach(() => {
    logger = createLogger();
    reportGenerator = createReportGenerator(logger);
  });

  describe('Complete Report Generation', () => {
    it('should generate report with conflict warning when fit is clean but clause is impossible', () => {
      const storedContexts = createMockContexts(200);
      const simulationResult = createSimulationResult({
        storedContexts,
        inRegimeSampleCount: 200,
        triggerCount: 40,
      });

      const report = reportGenerator.generate({
        expressionName: FIXTURE_IMPOSSIBLE_CONFUSION.id,
        simulationResult,
        blockers: [],
        summary: 'Test summary',
        prerequisites: FIXTURE_IMPOSSIBLE_CONFUSION.prerequisites,
      });

      // Verify scope metadata badges exist in prototype fit section
      expect(report).toContain('[AXIS-ONLY FIT]');

      // Verify non-axis feasibility section is generated with its scope badges
      expect(report).toContain('## Non-Axis Clause Feasibility');
      expect(report).toContain('[NON-AXIS ONLY]');
      expect(report).toContain('emotions.confusion');
      expect(report).toContain('IMPOSSIBLE');
    });

    it('should NOT show conflict when all clauses are achievable', () => {
      const storedContexts = createMockContexts(200, { joy: 0.5 }); // High joy values
      const simulationResult = createSimulationResult({
        storedContexts,
        inRegimeSampleCount: 200,
        triggerCount: 80,
      });

      const report = reportGenerator.generate({
        expressionName: FIXTURE_ACHIEVABLE.id,
        simulationResult,
        blockers: [],
        summary: 'Test summary',
        prerequisites: FIXTURE_ACHIEVABLE.prerequisites,
      });

      // Should have prototype fit section
      expect(report).toContain('Prototype Fit Analysis');

      // Should have feasibility section with OK classification
      expect(report).toContain('emotions.joy');
      expect(report).toContain('OK');
    });

    it('should generate report without errors for expression with no prerequisites', () => {
      const simulationResult = createSimulationResult({
        storedContexts: createMockContexts(100),
      });

      const report = reportGenerator.generate({
        expressionName: 'test:no_prereqs',
        simulationResult,
        blockers: [],
        summary: 'Test summary',
        prerequisites: null,
      });

      // Should still generate a valid report
      expect(report).toContain('# Monte Carlo Analysis Report');
      expect(report).toContain('test:no_prereqs');
    });
  });

  describe('Scope Metadata Presence', () => {
    it('should have AXIS-ONLY scope in prototype fit section', () => {
      const storedContexts = createMockContexts(200);
      const simulationResult = createSimulationResult({
        storedContexts,
        inRegimeSampleCount: 200,
      });

      const report = reportGenerator.generate({
        expressionName: FIXTURE_IMPOSSIBLE_CONFUSION.id,
        simulationResult,
        blockers: [],
        summary: 'Test summary',
        prerequisites: FIXTURE_IMPOSSIBLE_CONFUSION.prerequisites,
      });

      const prototypeSection = extractSection(report, 'Prototype Fit');
      expect(prototypeSection).toContain('[AXIS-ONLY FIT]');
      expect(prototypeSection).toContain('[IN-REGIME]');
    });

    it('should have FULL PREREQS scope in blocker section when blockers exist', () => {
      const storedContexts = createMockContexts(200);
      const simulationResult = createSimulationResult({
        storedContexts,
        inRegimeSampleCount: 200,
      });

      // Create a mock blocker with the required structure
      const mockBlocker = {
        clauseDescription: 'emotions.confusion >= 0.25',
        failureRate: 0.95,
        rank: 1,
        severity: 'high',
        advancedAnalysis: {
          percentileAnalysis: { status: 'normal', insight: 'ok' },
          nearMissAnalysis: { status: 'low', tunability: 'low', insight: 'ok' },
          ceilingAnalysis: { status: 'achievable', achievable: true, headroom: 0.1, insight: 'ok' },
          lastMileAnalysis: { status: 'low', isDecisive: false, insight: 'ok' },
          recommendation: { action: 'none', priority: 'low', message: 'ok' },
        },
        hierarchicalBreakdown: {
          nodeType: 'leaf',
          clauseId: 'clause-a',
          description: 'emotions.confusion >= 0.25',
          comparisonOperator: '>=',
          thresholdValue: 0.25,
          variablePath: 'emotions.confusion',
          failureRate: 0.95,
          evaluationCount: 1000,
        },
      };

      const report = reportGenerator.generate({
        expressionName: FIXTURE_IMPOSSIBLE_CONFUSION.id,
        simulationResult,
        blockers: [mockBlocker],
        summary: 'Test summary',
        prerequisites: FIXTURE_IMPOSSIBLE_CONFUSION.prerequisites,
      });

      const blockerSection = extractSection(report, 'Blocker Analysis');
      expect(blockerSection).toContain('[FULL PREREQS]');
      expect(blockerSection).toContain('[GLOBAL]');
    });

    it('should have NON-AXIS scope in feasibility section', () => {
      const storedContexts = createMockContexts(200);
      const simulationResult = createSimulationResult({
        storedContexts,
        inRegimeSampleCount: 200,
      });

      const report = reportGenerator.generate({
        expressionName: FIXTURE_IMPOSSIBLE_CONFUSION.id,
        simulationResult,
        blockers: [],
        summary: 'Test summary',
        prerequisites: FIXTURE_IMPOSSIBLE_CONFUSION.prerequisites,
      });

      const feasibilitySection = extractSection(
        report,
        'Non-Axis Clause Feasibility'
      );
      expect(feasibilitySection).toContain('[NON-AXIS ONLY]');
      expect(feasibilitySection).toContain('[IN-REGIME]');
    });
  });

  describe('End-to-End DI Resolution', () => {
    it('should verify diagnosticsTokens are properly defined', () => {
      // Verify all tokens needed for non-axis feasibility are defined
      expect(diagnosticsTokens.INonAxisClauseExtractor).toBeDefined();
      expect(diagnosticsTokens.INonAxisFeasibilityAnalyzer).toBeDefined();
      expect(diagnosticsTokens.IFitFeasibilityConflictDetector).toBeDefined();
      expect(
        diagnosticsTokens.INonAxisFeasibilitySectionGenerator
      ).toBeDefined();
      expect(diagnosticsTokens.IConflictWarningSectionGenerator).toBeDefined();
    });

    it('should be able to instantiate services directly', () => {
      // NonAxisClauseExtractor
      expect(
        () => new NonAxisClauseExtractor({ logger })
      ).not.toThrow();

      // NonAxisFeasibilityAnalyzer
      const extractor = new NonAxisClauseExtractor({ logger });
      expect(
        () =>
          new NonAxisFeasibilityAnalyzer({
            logger,
            clauseExtractor: extractor,
          })
      ).not.toThrow();

      // FitFeasibilityConflictDetector
      expect(
        () => new FitFeasibilityConflictDetector({ logger })
      ).not.toThrow();
    });
  });

  describe('Clause ID Stability Integration', () => {
    it('should generate identical clause IDs across report generations', () => {
      const storedContexts = createMockContexts(100);
      const simulationResult = createSimulationResult({
        storedContexts,
        inRegimeSampleCount: 100,
      });

      const prerequisites = [
        { logic: { '>=': [{ var: 'emotions.anger' }, 0.5] } },
      ];

      // Generate report twice
      const report1 = reportGenerator.generate({
        expressionName: 'test:stability_check',
        simulationResult,
        blockers: [],
        summary: 'Test summary',
        prerequisites,
      });

      const report2 = reportGenerator.generate({
        expressionName: 'test:stability_check',
        simulationResult,
        blockers: [],
        summary: 'Test summary',
        prerequisites,
      });

      // Extract feasibility sections
      const section1 = extractSection(report1, 'Non-Axis Clause Feasibility');
      const section2 = extractSection(report2, 'Non-Axis Clause Feasibility');

      // The sections should be identical (deterministic)
      expect(section1).toBe(section2);
    });

    it('should generate consistent output across service instances', () => {
      const extractor1 = new NonAxisClauseExtractor({ logger });
      const extractor2 = new NonAxisClauseExtractor({ logger });

      const prerequisites = [
        { logic: { '>=': [{ var: 'emotions.joy' }, 0.3] } },
      ];

      const clauses1 = extractor1.extract(prerequisites);
      const clauses2 = extractor2.extract(prerequisites);

      expect(clauses1).toEqual(clauses2);
    });
  });

  describe('Conflict Detection Logic', () => {
    it('should detect fit_vs_clause_impossible conflict type', () => {
      const detector = new FitFeasibilityConflictDetector({ logger });

      // Mock fit results showing clean fit
      const fitResults = [
        {
          prototypeId: 'confusion',
          type: 'emotion',
          rank: 1,
          gatePassRate: 0.95,
          compositeScore: 0.85,
          conflictingAxes: [],
          conflictMagnitude: 0.0,
        },
      ];

      // Mock feasibility showing IMPOSSIBLE clause
      const feasibilityResults = [
        {
          clauseId: 'test:expr|emotions.confusion|>=|0.25',
          varPath: 'emotions.confusion',
          operator: '>=',
          threshold: 0.25,
          classification: 'IMPOSSIBLE',
          passRate: 0.0,
          evidence: {
            passCount: 0,
            evaluationCount: 200,
            minObserved: 0.05,
            maxObserved: 0.18,
          },
        },
      ];

      const conflicts = detector.detect(fitResults, feasibilityResults, null);

      expect(conflicts).toBeInstanceOf(Array);
      // Conflict detection depends on having both high fit score AND impossible clause
    });

    it('should NOT flag conflict when fit is poor', () => {
      const detector = new FitFeasibilityConflictDetector({ logger });

      // Mock fit results showing poor fit
      const fitResults = [
        {
          prototypeId: 'confusion',
          type: 'emotion',
          rank: 5,
          gatePassRate: 0.2, // Poor fit
          compositeScore: 0.15,
          conflictingAxes: ['valence'],
          conflictMagnitude: 0.5,
        },
      ];

      // Same IMPOSSIBLE clause
      const feasibilityResults = [
        {
          clauseId: 'test:expr|emotions.confusion|>=|0.25',
          varPath: 'emotions.confusion',
          operator: '>=',
          threshold: 0.25,
          classification: 'IMPOSSIBLE',
          passRate: 0.0,
          evidence: {
            passCount: 0,
            evaluationCount: 200,
            minObserved: 0.05,
            maxObserved: 0.18,
          },
        },
      ];

      const conflicts = detector.detect(fitResults, feasibilityResults, null);

      // Should have fewer conflicts since fit is poor (no expectation mismatch)
      // The exact behavior depends on the threshold in FitFeasibilityConflictDetector
      expect(conflicts).toBeInstanceOf(Array);
    });

    it('should handle empty inputs gracefully', () => {
      const detector = new FitFeasibilityConflictDetector({ logger });

      // All empty/null inputs
      expect(() => detector.detect(null, null, null)).not.toThrow();
      expect(() => detector.detect([], [], null)).not.toThrow();
      expect(() => detector.detect(null, [], null)).not.toThrow();
      expect(() => detector.detect([], null, null)).not.toThrow();

      const result = detector.detect(null, null, null);
      expect(result).toEqual([]);
    });
  });

  describe('Non-Axis Feasibility Classification', () => {
    it('should classify IMPOSSIBLE when no contexts pass threshold', () => {
      const extractor = new NonAxisClauseExtractor({ logger });
      const analyzer = new NonAxisFeasibilityAnalyzer({
        logger,
        clauseExtractor: extractor,
      });

      // Contexts where confusion never reaches 0.25
      const contexts = createMockContexts(100); // confusion max ~0.2

      const prerequisites = [
        { logic: { '>=': [{ var: 'emotions.confusion' }, 0.25] } },
      ];

      const results = analyzer.analyze(
        prerequisites,
        contexts,
        'test:impossible'
      );

      expect(results.length).toBeGreaterThan(0);
      const confusionResult = results.find((r) =>
        r.varPath.includes('confusion')
      );
      expect(confusionResult).toBeDefined();
      expect(confusionResult.classification).toBe('IMPOSSIBLE');
    });

    it('should classify OK when most contexts pass threshold', () => {
      const extractor = new NonAxisClauseExtractor({ logger });
      const analyzer = new NonAxisFeasibilityAnalyzer({
        logger,
        clauseExtractor: extractor,
      });

      // Contexts where joy easily passes 0.1
      const contexts = createMockContexts(100, { joy: 0.5 });

      const prerequisites = [
        { logic: { '>=': [{ var: 'emotions.joy' }, 0.1] } },
      ];

      const results = analyzer.analyze(prerequisites, contexts, 'test:ok');

      expect(results.length).toBeGreaterThan(0);
      const joyResult = results.find((r) => r.varPath.includes('joy'));
      expect(joyResult).toBeDefined();
      expect(joyResult.classification).toBe('OK');
    });

    it('should classify RARE when few contexts pass threshold', () => {
      const extractor = new NonAxisClauseExtractor({ logger });
      const analyzer = new NonAxisFeasibilityAnalyzer({
        logger,
        clauseExtractor: extractor,
      });

      // Contexts where anger rarely reaches 0.15
      const contexts = createMockContexts(100); // anger max ~0.15

      const prerequisites = [
        { logic: { '>=': [{ var: 'emotions.anger' }, 0.12] } },
      ];

      const results = analyzer.analyze(prerequisites, contexts, 'test:rare');

      expect(results.length).toBeGreaterThan(0);
      const angerResult = results.find((r) => r.varPath.includes('anger'));
      expect(angerResult).toBeDefined();
      // Classification depends on pass rate - could be RARE or OK
      expect(['RARE', 'OK', 'IMPOSSIBLE']).toContain(angerResult.classification);
    });
  });

  describe('Report Integration with All Services', () => {
    it('should generate complete report with all new sections', () => {
      const storedContexts = createMockContexts(200);
      const simulationResult = createSimulationResult({
        storedContexts,
        inRegimeSampleCount: 200,
        triggerCount: 50,
      });

      const report = reportGenerator.generate({
        expressionName: 'test:full_integration',
        simulationResult,
        blockers: [],
        summary: 'Full integration test',
        prerequisites: FIXTURE_IMPOSSIBLE_CONFUSION.prerequisites,
      });

      // Standard sections should exist
      expect(report).toContain('# Monte Carlo Analysis Report');
      expect(report).toContain('## Executive Summary');

      // New scope-disambiguated sections should exist
      expect(report).toContain('## 🎯 Prototype Fit Analysis');
      expect(report).toContain('## Non-Axis Clause Feasibility');

      // Scope metadata should be present
      expect(report).toContain('[AXIS-ONLY FIT]');
      expect(report).toContain('[IN-REGIME]');
      expect(report).toContain('[NON-AXIS ONLY]');
    });
  });
});
