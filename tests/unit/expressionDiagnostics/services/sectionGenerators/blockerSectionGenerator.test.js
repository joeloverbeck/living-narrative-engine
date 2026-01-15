/**
 * @file Unit tests for BlockerSectionGenerator
 */

import { describe, it, expect } from '@jest/globals';
import BlockerSectionGenerator from '../../../../../src/expressionDiagnostics/services/sectionGenerators/BlockerSectionGenerator.js';
import ReportFormattingService from '../../../../../src/expressionDiagnostics/services/ReportFormattingService.js';

const createHierarchy = () => ({
  nodeType: 'and',
  isCompound: true,
  children: [
    {
      nodeType: 'leaf',
      clauseId: 'clause-a',
      description: 'emotions.joy >= 0.5',
      comparisonOperator: '>=',
      thresholdValue: 0.5,
      variablePath: 'emotions.joy',
      gatePassInRegimeCount: 120,
      inRegimeEvaluationCount: 200,
      failureRate: 0.6,
      inRegimeFailureRate: 0.5,
      evaluationCount: 1000,
      minObservedValue: 0.1,
      maxObservedValue: 0.9,
      nearMissRate: 0.05,
      ceilingGap: 0,
    },
    {
      nodeType: 'or',
      id: 'or-1',
      isCompound: true,
      evaluationCount: 1000,
      failureCount: 600,
      inRegimeEvaluationCount: 200,
      inRegimeFailureCount: 120,
      orUnionPassCount: 400,
      orBlockExclusivePassCount: 300,
      orPairPassCounts: [{ leftId: 'alt-a', rightId: 'alt-b', passCount: 50 }],
      children: [
        {
          nodeType: 'leaf',
          id: 'alt-a',
          description: 'alt A',
          failureRate: 0.5,
          evaluationCount: 1000,
          inRegimeFailureRate: 0.4,
          orPassRate: 0.7,
          orPassCount: 70,
          orExclusivePassRate: 0.2,
          orExclusivePassCount: 20,
          orContributionRate: 0.4,
          orContributionCount: 40,
          orSuccessCount: 100,
          siblingConditionedFailRate: 0.1,
          lastMileFailRate: 0.2,
        },
        {
          nodeType: 'leaf',
          id: 'alt-b',
          description: 'alt B',
          failureRate: 0.5,
          evaluationCount: 1000,
          inRegimeFailureRate: 0.4,
          orPassRate: 0.6,
          orPassCount: 60,
          orExclusivePassRate: 0.1,
          orExclusivePassCount: 10,
          orContributionRate: 0.3,
          orContributionCount: 30,
          orSuccessCount: 100,
          siblingConditionedFailRate: 0.12,
          lastMileFailRate: 0.25,
        },
      ],
    },
  ],
});

const createMockBlocker = (overrides = {}) => ({
  clauseDescription: 'compound clause',
  failureRate: 0.2,
  rank: 1,
  severity: 'high',
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
  hierarchicalBreakdown: createHierarchy(),
  ...overrides,
});

describe('BlockerSectionGenerator', () => {
  it('requires a formatting service', () => {
    expect(() => new BlockerSectionGenerator()).toThrow(
      'BlockerSectionGenerator requires formattingService'
    );
  });

  it('returns a no-blockers section when blockers are missing', () => {
    const formattingService = new ReportFormattingService();
    const generator = new BlockerSectionGenerator({ formattingService });

    const section = generator.generateBlockerAnalysis([], 1000, null);

    expect(section).toContain('No blockers identified');
  });

  it('renders probability funnel and OR breakdowns for compound blockers', () => {
    const formattingService = new ReportFormattingService();
    const generator = new BlockerSectionGenerator({
      formattingService,
      prototypeSectionGenerator: {
        generatePrototypeMathSection: () => 'PROTO MATH',
      },
    });

    const simulationResult = {
      triggerCount: 40,
      sampleCount: 1000,
      inRegimeSampleCount: 200,
    };

    const section = generator.generateBlockerAnalysis(
      [createMockBlocker()],
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

    expect(section).toContain('### Probability Funnel');
    expect(section).toContain('OR Alternative Coverage');
    expect(section).toContain('OR Overlap (absolute rates)');
    expect(section).toContain('#### Condition Breakdown');
    expect(section).toContain('#### Worst Offender Analysis');
    expect(section).toContain('PROTO MATH');
  });
});
