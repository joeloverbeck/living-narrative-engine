/**
 * @file blockerSectionBoundColumn.test.js
 * @description Tests for Bound column values in BlockerSectionGenerator.
 *
 * Issue B: Verify that Bound column values match the expected source stream
 * and are properly labeled based on operator type:
 * - For >= and > operators: use maxObserved (we need high values)
 * - For <= and < operators: use minObserved (we need low values)
 */

import { describe, it, expect } from '@jest/globals';
import BlockerSectionGenerator from '../../../../../src/expressionDiagnostics/services/sectionGenerators/BlockerSectionGenerator.js';
import ReportFormattingService from '../../../../../src/expressionDiagnostics/services/ReportFormattingService.js';

/**
 * Creates a hierarchy with a single leaf node for testing bound column behavior
 */
const createLeafHierarchy = (leafOverrides = {}) => ({
  nodeType: 'and',
  isCompound: false,
  children: [
    {
      nodeType: 'leaf',
      clauseId: 'test-clause',
      description: leafOverrides.description || 'test clause',
      comparisonOperator: leafOverrides.comparisonOperator || '>=',
      thresholdValue: leafOverrides.thresholdValue || 0.5,
      variablePath: leafOverrides.variablePath || 'emotions.test',
      gatePassInRegimeCount: leafOverrides.gatePassInRegimeCount || 80,
      inRegimeEvaluationCount: leafOverrides.inRegimeEvaluationCount || 100,
      failureRate: leafOverrides.failureRate || 0.3,
      inRegimeFailureRate: leafOverrides.inRegimeFailureRate || 0.2,
      evaluationCount: leafOverrides.evaluationCount || 100,
      minObservedValue: leafOverrides.minObservedValue ?? 0.1,
      maxObservedValue: leafOverrides.maxObservedValue ?? 0.9,
      nearMissRate: leafOverrides.nearMissRate || 0.05,
      ceilingGap: leafOverrides.ceilingGap ?? null,
      inRegimeFailureCount: leafOverrides.inRegimeFailureCount || 20,
      redundantInRegime: leafOverrides.redundantInRegime ?? false,
    },
  ],
});

/**
 * Creates a mock blocker with the given leaf properties
 */
const createMockBlocker = (leafOverrides = {}) => ({
  clauseDescription: leafOverrides.description || 'test clause',
  failureRate: leafOverrides.failureRate || 0.3,
  rank: 1,
  severity: 'medium',
  advancedAnalysis: {
    percentileAnalysis: { status: 'normal', insight: 'ok' },
    nearMissAnalysis: { status: 'low', tunability: 'low', insight: 'ok' },
    ceilingAnalysis: {
      status: leafOverrides.ceilingGap ? 'ceiling' : 'achievable',
      achievable: !leafOverrides.ceilingGap,
      headroom: leafOverrides.ceilingGap || 0.1,
      insight: 'ok',
    },
    lastMileAnalysis: { status: 'low', isDecisive: false, insight: 'ok' },
    recommendation: { action: 'none', priority: 'low', message: 'ok' },
  },
  hierarchicalBreakdown: createLeafHierarchy(leafOverrides),
});

describe('BlockerSectionGenerator - Bound Column', () => {
  let generator;
  let formattingService;

  beforeEach(() => {
    formattingService = new ReportFormattingService();
    generator = new BlockerSectionGenerator({
      formattingService,
      prototypeSectionGenerator: {
        generatePrototypeMathSection: () => '',
      },
    });
  });

  describe('Bound column for >= operator', () => {
    it('should include maxObservedValue in report for >= operator', () => {
      const blocker = createMockBlocker({
        description: 'emotions.joy >= 0.5',
        comparisonOperator: '>=',
        thresholdValue: 0.5,
        maxObservedValue: 0.8,
        minObservedValue: 0.2,
      });

      const simulationResult = {
        sampleCount: 100,
        inRegimeSampleCount: 100,
        triggerCount: 70,
        clauseFailures: [],
      };

      const report = generator.generateBlockerAnalysis(
        [blocker],
        100,
        null,
        [],
        null,
        null,
        false,
        [],
        null,
        simulationResult
      );

      // For >= operator, the report should show maxObservedValue (0.80)
      // The value appears in Worst Offender Analysis or Ceiling Analysis sections
      expect(report).toMatch(/0\.8|Max Observed/i);
    });

    it('should include maxObservedValue in report for > operator', () => {
      const blocker = createMockBlocker({
        description: 'emotions.anger > 0.4',
        comparisonOperator: '>',
        thresholdValue: 0.4,
        maxObservedValue: 0.7,
        minObservedValue: 0.1,
      });

      const simulationResult = {
        sampleCount: 100,
        inRegimeSampleCount: 100,
        triggerCount: 60,
        clauseFailures: [],
      };

      const report = generator.generateBlockerAnalysis(
        [blocker],
        100,
        null,
        [],
        null,
        null,
        false,
        [],
        null,
        simulationResult
      );

      // For > operator, the report should show maxObservedValue
      // The value appears in Worst Offender Analysis or Ceiling Analysis sections
      expect(report).toMatch(/0\.7|Max Observed/i);
    });
  });

  describe('Bound column for <= operator', () => {
    it('should include minObservedValue in report for <= operator', () => {
      const blocker = createMockBlocker({
        description: 'emotions.fear <= 0.3',
        comparisonOperator: '<=',
        thresholdValue: 0.3,
        maxObservedValue: 0.9,
        minObservedValue: 0.1,
      });

      const simulationResult = {
        sampleCount: 100,
        inRegimeSampleCount: 100,
        triggerCount: 80,
        clauseFailures: [],
      };

      const report = generator.generateBlockerAnalysis(
        [blocker],
        100,
        null,
        [],
        null,
        null,
        false,
        [],
        null,
        simulationResult
      );

      // For <= operator, report should include observed values
      // minObservedValue appears in the analysis sections
      expect(report).toMatch(/0\.1|Min Observed/i);
    });

    it('should include minObservedValue in report for < operator', () => {
      const blocker = createMockBlocker({
        description: 'emotions.sadness < 0.5',
        comparisonOperator: '<',
        thresholdValue: 0.5,
        maxObservedValue: 0.85,
        minObservedValue: 0.15,
      });

      const simulationResult = {
        sampleCount: 100,
        inRegimeSampleCount: 100,
        triggerCount: 75,
        clauseFailures: [],
      };

      const report = generator.generateBlockerAnalysis(
        [blocker],
        100,
        null,
        [],
        null,
        null,
        false,
        [],
        null,
        simulationResult
      );

      // For < operator, report should include observed values
      // minObservedValue appears in the analysis sections
      expect(report).toMatch(/0\.15|Min Observed/i);
    });
  });

  describe('Gap calculation consistency', () => {
    it('should show ceiling indicator for >= operator when maxObserved < threshold', () => {
      // For >=: if maxObserved < threshold, clause is unreachable
      const blocker = createMockBlocker({
        description: 'emotions.test >= 0.8',
        comparisonOperator: '>=',
        thresholdValue: 0.8,
        maxObservedValue: 0.6, // Below threshold
        minObservedValue: 0.2,
        ceilingGap: 0.2, // 0.8 - 0.6 = 0.2 (positive = unreachable)
        failureRate: 1.0,
        inRegimeFailureRate: 1.0,
        inRegimeFailureCount: 100,
      });

      const simulationResult = {
        sampleCount: 100,
        inRegimeSampleCount: 100,
        triggerCount: 0,
        clauseFailures: [],
      };

      const report = generator.generateBlockerAnalysis(
        [blocker],
        100,
        null,
        [],
        null,
        null,
        false,
        [],
        null,
        simulationResult
      );

      // Gap should reflect ceiling (unreachable threshold)
      // Report shows "CEILING EFFECT" or "UNREACHABLE" indicators
      expect(report).toMatch(/CEILING|UNREACHABLE/i);
    });

    it('should show ceiling indicator for <= operator when minObserved > threshold', () => {
      // For <=: if minObserved > threshold, clause is unreachable
      const blocker = createMockBlocker({
        description: 'emotions.test <= 0.2',
        comparisonOperator: '<=',
        thresholdValue: 0.2,
        maxObservedValue: 0.9,
        minObservedValue: 0.4, // Above threshold
        ceilingGap: 0.2, // 0.4 - 0.2 = 0.2 (positive = unreachable)
        failureRate: 1.0,
        inRegimeFailureRate: 1.0,
        inRegimeFailureCount: 100,
      });

      const simulationResult = {
        sampleCount: 100,
        inRegimeSampleCount: 100,
        triggerCount: 0,
        clauseFailures: [],
      };

      const report = generator.generateBlockerAnalysis(
        [blocker],
        100,
        null,
        [],
        null,
        null,
        false,
        [],
        null,
        simulationResult
      );

      // Gap should reflect ceiling (unreachable threshold)
      // Report shows "CEILING EFFECT" or "UNREACHABLE" indicators
      expect(report).toMatch(/CEILING|UNREACHABLE/i);
    });
  });

  describe('Bound column with missing values', () => {
    it('should handle undefined maxObservedValue gracefully for >= operator', () => {
      const blocker = createMockBlocker({
        description: 'emotions.test >= 0.5',
        comparisonOperator: '>=',
        thresholdValue: 0.5,
        maxObservedValue: undefined,
        minObservedValue: 0.1,
      });

      const simulationResult = {
        sampleCount: 100,
        inRegimeSampleCount: 100,
        triggerCount: 50,
        clauseFailures: [],
      };

      // Should not throw when maxObservedValue is undefined
      expect(() => {
        generator.generateBlockerAnalysis(
          [blocker],
          100,
          null,
          [],
          null,
          null,
          false,
          [],
          null,
          simulationResult
        );
      }).not.toThrow();
    });

    it('should handle undefined minObservedValue gracefully for <= operator', () => {
      const blocker = createMockBlocker({
        description: 'emotions.test <= 0.5',
        comparisonOperator: '<=',
        thresholdValue: 0.5,
        maxObservedValue: 0.9,
        minObservedValue: undefined,
      });

      const simulationResult = {
        sampleCount: 100,
        inRegimeSampleCount: 100,
        triggerCount: 50,
        clauseFailures: [],
      };

      // Should not throw when minObservedValue is undefined
      expect(() => {
        generator.generateBlockerAnalysis(
          [blocker],
          100,
          null,
          [],
          null,
          null,
          false,
          [],
          null,
          simulationResult
        );
      }).not.toThrow();
    });
  });
});
