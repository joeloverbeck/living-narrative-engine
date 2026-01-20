/**
 * @file Unit tests for BlockerSectionGenerator
 */

import { describe, it, expect } from '@jest/globals';
import BlockerSectionGenerator from '../../../../../src/expressionDiagnostics/services/sectionGenerators/BlockerSectionGenerator.js';
import ReportFormattingService from '../../../../../src/expressionDiagnostics/services/ReportFormattingService.js';
import { SCOPE_METADATA } from '../../../../../src/expressionDiagnostics/models/AnalysisScopeMetadata.js';

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
      gatePassAndClausePassInRegimeCount: 60, // 50% of gate-passers also pass threshold
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

  describe('scope metadata header', () => {
    it('includes FULL PREREQS badge in blocker analysis', () => {
      const formattingService = new ReportFormattingService();
      const generator = new BlockerSectionGenerator({ formattingService });

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

      expect(section).toContain('[FULL PREREQS]');
    });

    it('includes GLOBAL badge in blocker analysis', () => {
      const formattingService = new ReportFormattingService();
      const generator = new BlockerSectionGenerator({ formattingService });

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

      expect(section).toContain('[GLOBAL]');
    });

    it('includes scope description about post-gate values', () => {
      const formattingService = new ReportFormattingService();
      const generator = new BlockerSectionGenerator({ formattingService });

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

      expect(section).toContain('post-gate (final) values');
    });

    it('positions scope header after Signal line and before Probability Funnel', () => {
      const formattingService = new ReportFormattingService();
      const generator = new BlockerSectionGenerator({ formattingService });

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

      const signalIndex = section.indexOf('Signal: final');
      const scopeIndex = section.indexOf('[FULL PREREQS]');
      const funnelIndex = section.indexOf('### Probability Funnel');

      expect(scopeIndex).toBeGreaterThan(signalIndex);
      expect(scopeIndex).toBeLessThan(funnelIndex);
    });
  });

  describe('import verification', () => {
    it('can import SCOPE_METADATA from models', () => {
      expect(SCOPE_METADATA.BLOCKER_GLOBAL).toBeDefined();
      expect(SCOPE_METADATA.BLOCKER_GLOBAL.scope).toBe('full_prereqs');
    });
  });

  // ============================================================================
  // Core Blocker Integration Tests (MONCARACTIMP-013)
  // ============================================================================

  describe('core blocker integration', () => {
    it('accepts optional blockerCalculator in constructor (backward compatibility)', () => {
      const formattingService = new ReportFormattingService();
      // Should not throw when blockerCalculator is omitted
      expect(
        () => new BlockerSectionGenerator({ formattingService })
      ).not.toThrow();
    });

    it('accepts blockerCalculator in constructor', () => {
      const formattingService = new ReportFormattingService();
      const mockBlockerCalculator = {
        calculate: () => ({
          coreBlockers: [],
          nonCoreConstraints: [],
          compositeScores: new Map(),
        }),
      };

      expect(
        () =>
          new BlockerSectionGenerator({
            formattingService,
            blockerCalculator: mockBlockerCalculator,
          })
      ).not.toThrow();
    });

    it('does not include core blocker section when blockerCalculator is not provided', () => {
      const formattingService = new ReportFormattingService();
      const generator = new BlockerSectionGenerator({ formattingService });

      const simulationResult = {
        triggerCount: 40,
        sampleCount: 1000,
        inRegimeSampleCount: 200,
        clauseTracking: [
          {
            clauseId: 'clause-1',
            passCount: 800,
            failCount: 200,
          },
        ],
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

      expect(section).not.toContain('### Core Blockers');
    });

    it('includes core blocker section when blockerCalculator returns blockers', () => {
      const formattingService = new ReportFormattingService();
      const mockBlockerCalculator = {
        calculate: () => ({
          coreBlockers: [
            {
              clauseId: 'clause-1',
              clauseDescription: 'emotions.joy >= 0.5',
              lastMileRate: 0.6,
              impactScore: 0.25,
              compositeScore: 0.425,
              classification: 'core',
            },
          ],
          nonCoreConstraints: [],
          compositeScores: new Map([['clause-1', 0.425]]),
        }),
      };

      const generator = new BlockerSectionGenerator({
        formattingService,
        blockerCalculator: mockBlockerCalculator,
      });

      const simulationResult = {
        triggerCount: 40,
        sampleCount: 1000,
        inRegimeSampleCount: 200,
        clauseTracking: [
          {
            clauseId: 'clause-1',
            passCount: 800,
            failCount: 200,
          },
        ],
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

      expect(section).toContain('### Core Blockers');
      expect(section).toContain('emotions.joy >= 0.5');
      expect(section).toContain('Last-Mile Rate');
      expect(section).toContain('Impact Score');
      expect(section).toContain('Composite Score');
    });

    it('does not include core blocker section when simulationResult is null', () => {
      const formattingService = new ReportFormattingService();
      const mockBlockerCalculator = {
        calculate: () => ({
          coreBlockers: [
            {
              clauseId: 'clause-1',
              clauseDescription: 'emotions.joy >= 0.5',
              lastMileRate: 0.6,
              impactScore: 0.25,
              compositeScore: 0.425,
            },
          ],
          nonCoreConstraints: [],
          compositeScores: new Map(),
        }),
      };

      const generator = new BlockerSectionGenerator({
        formattingService,
        blockerCalculator: mockBlockerCalculator,
      });

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
        null // No simulationResult
      );

      expect(section).not.toContain('### Core Blockers');
    });

    it('does not include core blocker section when clauseTracking is empty', () => {
      const formattingService = new ReportFormattingService();
      const mockBlockerCalculator = {
        calculate: () => ({
          coreBlockers: [],
          nonCoreConstraints: [],
          compositeScores: new Map(),
        }),
      };

      const generator = new BlockerSectionGenerator({
        formattingService,
        blockerCalculator: mockBlockerCalculator,
      });

      const simulationResult = {
        triggerCount: 40,
        sampleCount: 1000,
        inRegimeSampleCount: 200,
        clauseTracking: [], // Empty
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

      expect(section).not.toContain('### Core Blockers');
    });

    describe('blocker insight generation', () => {
      it('shows "final gatekeeper" insight for high lastMileRate (>0.8)', () => {
        const formattingService = new ReportFormattingService();
        const mockBlockerCalculator = {
          calculate: () => ({
            coreBlockers: [
              {
                clauseId: 'clause-1',
                clauseDescription: 'Critical blocker',
                lastMileRate: 0.85, // > 0.8
                impactScore: 0.1,
                compositeScore: 0.5,
              },
            ],
            nonCoreConstraints: [],
            compositeScores: new Map(),
          }),
        };

        const generator = new BlockerSectionGenerator({
          formattingService,
          blockerCalculator: mockBlockerCalculator,
        });

        const simulationResult = {
          triggerCount: 40,
          sampleCount: 1000,
          clauseTracking: [{ clauseId: 'clause-1' }],
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

        expect(section).toContain('Final gatekeeper');
      });

      it('shows "High impact" insight for impactScore > 0.3', () => {
        const formattingService = new ReportFormattingService();
        const mockBlockerCalculator = {
          calculate: () => ({
            coreBlockers: [
              {
                clauseId: 'clause-1',
                clauseDescription: 'High impact blocker',
                lastMileRate: 0.5, // <= 0.8
                impactScore: 0.35, // > 0.3
                compositeScore: 0.425,
              },
            ],
            nonCoreConstraints: [],
            compositeScores: new Map(),
          }),
        };

        const generator = new BlockerSectionGenerator({
          formattingService,
          blockerCalculator: mockBlockerCalculator,
        });

        const simulationResult = {
          triggerCount: 40,
          sampleCount: 1000,
          clauseTracking: [{ clauseId: 'clause-1' }],
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

        expect(section).toContain('High impact');
      });

      it('shows "Meaningful contribution" insight for impactScore > 0.1', () => {
        const formattingService = new ReportFormattingService();
        const mockBlockerCalculator = {
          calculate: () => ({
            coreBlockers: [
              {
                clauseId: 'clause-1',
                clauseDescription: 'Moderate blocker',
                lastMileRate: 0.5, // <= 0.8
                impactScore: 0.15, // > 0.1 but <= 0.3
                compositeScore: 0.325,
              },
            ],
            nonCoreConstraints: [],
            compositeScores: new Map(),
          }),
        };

        const generator = new BlockerSectionGenerator({
          formattingService,
          blockerCalculator: mockBlockerCalculator,
        });

        const simulationResult = {
          triggerCount: 40,
          sampleCount: 1000,
          clauseTracking: [{ clauseId: 'clause-1' }],
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

        expect(section).toContain('Meaningful contribution');
      });
    });

    it('shows non-core constraints count when present', () => {
      const formattingService = new ReportFormattingService();
      const mockBlockerCalculator = {
        calculate: () => ({
          coreBlockers: [
            {
              clauseId: 'clause-1',
              clauseDescription: 'Main blocker',
              lastMileRate: 0.6,
              impactScore: 0.25,
              compositeScore: 0.425,
            },
          ],
          nonCoreConstraints: [
            { clauseId: 'non-core-1', inRegimePassRate: 0.96 },
            { clauseId: 'non-core-2', inRegimePassRate: 0.98 },
          ],
          compositeScores: new Map(),
        }),
      };

      const generator = new BlockerSectionGenerator({
        formattingService,
        blockerCalculator: mockBlockerCalculator,
      });

      const simulationResult = {
        triggerCount: 40,
        sampleCount: 1000,
        clauseTracking: [
          { clauseId: 'clause-1' },
          { clauseId: 'non-core-1' },
          { clauseId: 'non-core-2' },
        ],
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

      expect(section).toContain('2 non-core constraints');
    });

    it('uses clauseId as fallback when clauseDescription is missing', () => {
      const formattingService = new ReportFormattingService();
      const mockBlockerCalculator = {
        calculate: () => ({
          coreBlockers: [
            {
              clauseId: 'fallback-clause-id',
              // clauseDescription is intentionally omitted
              lastMileRate: 0.6,
              impactScore: 0.25,
              compositeScore: 0.425,
            },
          ],
          nonCoreConstraints: [],
          compositeScores: new Map(),
        }),
      };

      const generator = new BlockerSectionGenerator({
        formattingService,
        blockerCalculator: mockBlockerCalculator,
      });

      const simulationResult = {
        triggerCount: 40,
        sampleCount: 1000,
        clauseTracking: [{ clauseId: 'fallback-clause-id' }],
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

      expect(section).toContain('fallback-clause-id');
    });
  });
});
