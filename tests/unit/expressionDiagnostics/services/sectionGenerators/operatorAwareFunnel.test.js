/**
 * @file operatorAwareFunnel.test.js
 * @description Tests for operator-aware probability funnel in BlockerSectionGenerator.
 *
 * Issue D: Test that <= clauses show appropriate metrics (Gate Closed Rate)
 * while >= clauses show Gate Open Rate as the beneficial metric.
 */

import { describe, it, expect } from '@jest/globals';
import BlockerSectionGenerator from '../../../../../src/expressionDiagnostics/services/sectionGenerators/BlockerSectionGenerator.js';
import ReportFormattingService from '../../../../../src/expressionDiagnostics/services/ReportFormattingService.js';

/**
 * Creates a hierarchy with a single leaf node for funnel testing
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
      gatePassInRegimeCount: leafOverrides.gatePassInRegimeCount || 600,
      inRegimeEvaluationCount: leafOverrides.inRegimeEvaluationCount || 800,
      failureRate: leafOverrides.failureRate || 0.25,
      inRegimeFailureRate: leafOverrides.inRegimeFailureRate || 0.25,
      inRegimeFailureCount: leafOverrides.inRegimeFailureCount || 200,
      evaluationCount: leafOverrides.evaluationCount || 1000,
      minObservedValue: leafOverrides.minObservedValue ?? 0.1,
      maxObservedValue: leafOverrides.maxObservedValue ?? 0.8,
      nearMissRate: leafOverrides.nearMissRate || 0.05,
      ceilingGap: leafOverrides.ceilingGap ?? null,
      redundantInRegime: leafOverrides.redundantInRegime ?? false,
    },
  ],
});

/**
 * Creates OR hierarchy for testing OR union metrics
 */
const createOrHierarchy = () => ({
  nodeType: 'and',
  isCompound: true,
  children: [
    {
      nodeType: 'or',
      id: 'or-1',
      isCompound: true,
      evaluationCount: 1000,
      failureCount: 200,
      inRegimeEvaluationCount: 800,
      inRegimeFailureCount: 160,
      orUnionPassCount: 500,
      orBlockExclusivePassCount: 400,
      orPairPassCounts: [{ leftId: 'alt-a', rightId: 'alt-b', passCount: 100 }],
      children: [
        {
          nodeType: 'leaf',
          id: 'alt-a',
          description: 'option A',
          failureRate: 0.4,
          evaluationCount: 1000,
          inRegimeFailureRate: 0.3,
          orPassRate: 0.7,
          orPassCount: 300,
          orExclusivePassRate: 0.3,
          orExclusivePassCount: 200,
          orContributionRate: 0.5,
          orContributionCount: 250,
          orSuccessCount: 100,
          siblingConditionedFailRate: 0.15,
          lastMileFailRate: 0.2,
        },
        {
          nodeType: 'leaf',
          id: 'alt-b',
          description: 'option B',
          failureRate: 0.5,
          evaluationCount: 1000,
          inRegimeFailureRate: 0.4,
          orPassRate: 0.6,
          orPassCount: 400,
          orExclusivePassRate: 0.2,
          orExclusivePassCount: 200,
          orContributionRate: 0.4,
          orContributionCount: 200,
          orSuccessCount: 100,
          siblingConditionedFailRate: 0.12,
          lastMileFailRate: 0.25,
        },
      ],
    },
  ],
});

/**
 * Creates a mock blocker with given leaf properties
 */
const createMockBlocker = (leafOverrides = {}) => ({
  clauseDescription: leafOverrides.description || 'test clause',
  failureRate: leafOverrides.failureRate || 0.25,
  rank: 1,
  severity: 'medium',
  advancedAnalysis: {
    percentileAnalysis: { status: 'normal', insight: 'ok' },
    nearMissAnalysis: { status: 'low', tunability: 'low', insight: 'ok' },
    ceilingAnalysis: {
      status: 'achievable',
      achievable: true,
      headroom: 0.1,
      insight: 'ok',
    },
    lastMileAnalysis: { status: 'low', isDecisive: false, insight: 'ok' },
    recommendation: { action: 'none', priority: 'low', message: 'ok' },
  },
  hierarchicalBreakdown: createLeafHierarchy(leafOverrides),
});

/**
 * Creates a mock blocker with OR alternatives
 */
const createOrBlocker = () => ({
  clauseDescription: 'OR clause',
  failureRate: 0.2,
  rank: 1,
  severity: 'medium',
  advancedAnalysis: {
    percentileAnalysis: { status: 'normal', insight: 'ok' },
    nearMissAnalysis: { status: 'low', tunability: 'low', insight: 'ok' },
    ceilingAnalysis: {
      status: 'achievable',
      achievable: true,
      headroom: 0.1,
      insight: 'ok',
    },
    lastMileAnalysis: { status: 'low', isDecisive: false, insight: 'ok' },
    recommendation: { action: 'none', priority: 'low', message: 'ok' },
  },
  hierarchicalBreakdown: createOrHierarchy(),
});

describe('BlockerSectionGenerator - Operator-Aware Funnel', () => {
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

  describe('Probability Funnel structure', () => {
    it('should generate probability funnel with mood-regime pass rate', () => {
      const blocker = createMockBlocker({
        description: 'emotions.joy >= 0.5',
      });

      const simulationResult = {
        sampleCount: 1000,
        inRegimeSampleCount: 800,
        triggerCount: 200,
        clauseFailures: [],
      };

      const report = generator.generateBlockerAnalysis(
        [blocker],
        1000,
        null,
        [],
        null,
        null,
        false,
        [],
        null,
        simulationResult
      );

      expect(report).toContain('Probability Funnel');
      expect(report).toContain('Full sample');
      expect(report).toContain('Mood-regime pass');
      // Should show mood pass rate: 800/1000 = 80%
      expect(report).toContain('80');
    });

    it('should generate probability funnel with final trigger rate', () => {
      const blocker = createMockBlocker({
        description: 'emotions.joy >= 0.5',
      });

      const simulationResult = {
        sampleCount: 1000,
        inRegimeSampleCount: 800,
        triggerCount: 150,
        clauseFailures: [],
      };

      const report = generator.generateBlockerAnalysis(
        [blocker],
        1000,
        null,
        [],
        null,
        null,
        false,
        [],
        null,
        simulationResult
      );

      expect(report).toContain('Final trigger');
      // Should show final trigger rate: 150/1000 = 15%
      expect(report).toContain('15');
    });
  });

  describe('Gate pass metrics for >= operator', () => {
    it('should show gate pass rate for >= operator clauses', () => {
      const blocker = createMockBlocker({
        description: 'emotions.joy >= 0.5',
        comparisonOperator: '>=',
        thresholdValue: 0.5,
        gatePassInRegimeCount: 600,
        inRegimeEvaluationCount: 800,
        failureRate: 0.25,
        inRegimeFailureRate: 0.25,
        inRegimeFailureCount: 200,
        maxObservedValue: 0.8,
        minObservedValue: 0.1,
      });

      const simulationResult = {
        sampleCount: 1000,
        inRegimeSampleCount: 800,
        triggerCount: 600,
        clauseFailures: [],
      };

      const report = generator.generateBlockerAnalysis(
        [blocker],
        1000,
        null,
        [],
        null,
        null,
        false,
        [],
        null,
        simulationResult
      );

      expect(report).toContain('Gate pass');
      // Gate pass rate for >= should use gatePassInRegimeCount / inRegimeEvaluationCount
      // 600/800 = 0.75 = 75%
      expect(report).toContain('75');
    });
  });

  describe('Gate pass metrics for <= operator', () => {
    it('should show appropriate metrics for <= operator clauses', () => {
      const blocker = createMockBlocker({
        description: 'emotions.fear <= 0.3',
        comparisonOperator: '<=',
        thresholdValue: 0.3,
        gatePassInRegimeCount: 500, // Gate "passes" when fear is low
        inRegimeEvaluationCount: 800,
        failureRate: 0.375, // 300/800 contexts have fear > 0.3
        inRegimeFailureRate: 0.375,
        inRegimeFailureCount: 300,
        maxObservedValue: 0.9,
        minObservedValue: 0.05,
      });

      const simulationResult = {
        sampleCount: 1000,
        inRegimeSampleCount: 800,
        triggerCount: 500,
        clauseFailures: [],
      };

      const report = generator.generateBlockerAnalysis(
        [blocker],
        1000,
        null,
        [],
        null,
        null,
        false,
        [],
        null,
        simulationResult
      );

      // For <= operator, the "gate pass" metric should still be shown
      // but the interpretation is different (lower values are better)
      expect(report).toContain('Gate pass');
    });
  });

  describe('OR block union metrics', () => {
    it('should show OR union pass rate in funnel', () => {
      const orBlocker = createOrBlocker();

      const simulationResult = {
        sampleCount: 1000,
        inRegimeSampleCount: 800,
        triggerCount: 400,
        clauseFailures: [],
      };

      const report = generator.generateBlockerAnalysis(
        [orBlocker],
        1000,
        null,
        [],
        null,
        null,
        false,
        [],
        null,
        simulationResult
      );

      // OR blockers should show alternative coverage
      expect(report).toContain('OR Alternative Coverage');
    });
  });

  describe('Funnel with missing data', () => {
    it('should handle missing inRegimeSampleCount gracefully', () => {
      const blockers = [];
      const simulationResult = {
        sampleCount: 1000,
        inRegimeSampleCount: undefined,
        triggerCount: 200,
        clauseFailures: [],
      };

      expect(() => {
        generator.generateBlockerAnalysis(
          blockers,
          1000,
          {},
          null,
          null,
          null,
          false,
          [],
          null,
          simulationResult
        );
      }).not.toThrow();
    });

    it('should handle missing triggerCount gracefully', () => {
      const blockers = [];
      const simulationResult = {
        sampleCount: 1000,
        inRegimeSampleCount: 800,
        triggerCount: undefined,
        clauseFailures: [],
      };

      expect(() => {
        generator.generateBlockerAnalysis(
          blockers,
          1000,
          {},
          null,
          null,
          null,
          false,
          [],
          null,
          simulationResult
        );
      }).not.toThrow();
    });

    it('should handle null simulationResult gracefully', () => {
      const blockers = [];

      expect(() => {
        generator.generateBlockerAnalysis(
          blockers,
          1000,
          {},
          null,
          null,
          null,
          false,
          [],
          null,
          null
        );
      }).not.toThrow();
    });
  });

  describe('Funnel with zero samples', () => {
    it('should handle zero sampleCount gracefully', () => {
      const blockers = [];
      const simulationResult = {
        sampleCount: 0,
        inRegimeSampleCount: 0,
        triggerCount: 0,
        clauseFailures: [],
      };

      const report = generator.generateBlockerAnalysis(
        blockers,
        0,
        {},
        null,
        null,
        null,
        false,
        [],
        null,
        simulationResult
      );

      // Should not throw and should produce valid output
      expect(report).toBeDefined();
    });
  });

  describe('Key threshold clause selection', () => {
    it('should select key threshold clauses for funnel display', () => {
      // Create two blockers with different operators and threshold characteristics
      const blocker1 = createMockBlocker({
        description: 'emotions.joy >= 0.7',
        comparisonOperator: '>=',
        thresholdValue: 0.7,
        gatePassInRegimeCount: 200,
        inRegimeEvaluationCount: 800,
        failureRate: 0.75,
        inRegimeFailureRate: 0.75,
        inRegimeFailureCount: 600,
        evaluationCount: 1000,
        maxObservedValue: 0.65,
        minObservedValue: 0.1,
      });

      const blocker2 = createMockBlocker({
        description: 'emotions.anger <= 0.3',
        comparisonOperator: '<=',
        thresholdValue: 0.3,
        gatePassInRegimeCount: 500,
        inRegimeEvaluationCount: 800,
        failureRate: 0.375,
        inRegimeFailureRate: 0.375,
        inRegimeFailureCount: 300,
        evaluationCount: 1000,
        maxObservedValue: 0.8,
        minObservedValue: 0.05,
      });

      const simulationResult = {
        sampleCount: 1000,
        inRegimeSampleCount: 800,
        triggerCount: 100,
        clauseFailures: [],
      };

      const report = generator.generateBlockerAnalysis(
        [blocker1, blocker2],
        1000,
        null,
        [],
        null,
        null,
        false,
        [],
        null,
        simulationResult
      );

      // Should include funnel entries for key threshold clauses
      expect(report).toContain('Gate pass');
    });
  });

  describe('Funnel format consistency', () => {
    it('should format all funnel steps consistently', () => {
      const blocker = createMockBlocker({
        description: 'emotions.test >= 0.5',
        comparisonOperator: '>=',
        thresholdValue: 0.5,
        gatePassInRegimeCount: 600,
        inRegimeEvaluationCount: 800,
        failureRate: 0.25,
        inRegimeFailureRate: 0.25,
        inRegimeFailureCount: 200,
        evaluationCount: 1000,
        maxObservedValue: 0.8,
        minObservedValue: 0.1,
      });

      const simulationResult = {
        sampleCount: 1000,
        inRegimeSampleCount: 800,
        triggerCount: 500,
        clauseFailures: [],
      };

      const report = generator.generateBlockerAnalysis(
        [blocker],
        1000,
        null,
        [],
        null,
        null,
        false,
        [],
        null,
        simulationResult
      );

      // Report should be defined and contain expected sections
      expect(report).toBeDefined();
      expect(typeof report).toBe('string');

      // Funnel should contain consistently formatted rates (percentages)
      expect(report).toContain('Probability Funnel');

      // Should contain percentage values (formatted rates)
      // Sample rate: 1000/1000 = 100%
      expect(report).toContain('100');
      // Mood regime rate: 800/1000 = 80%
      expect(report).toContain('80');
      // Final trigger rate: 500/1000 = 50%
      expect(report).toContain('50');
    });
  });
});
