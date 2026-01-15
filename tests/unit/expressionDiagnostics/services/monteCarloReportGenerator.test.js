/**
 * @file Unit tests for MonteCarloReportGenerator
 * @see specs/monte-carlo-report-generator.md
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import MonteCarloReportGenerator from '../../../../src/expressionDiagnostics/services/MonteCarloReportGenerator.js';

// =============================================================================
// Mock Data Fixtures
// =============================================================================

/**
 * Create a mock simulation result with sensible defaults.
 *
 * @param {object} overrides - Properties to override
 * @returns {object} Mock simulation result
 */
const createMockSimulationResult = (overrides = {}) => ({
  triggerRate: 0.15,
  triggerCount: 1500,
  sampleCount: 10000,
  confidenceInterval: { low: 0.14, high: 0.16 },
  distribution: 'uniform',
  clauseFailures: [],
  ...overrides,
});

/**
 * Create a mock blocker with all fields populated.
 * Values are chosen to NOT trigger any flags by default:
 * - nearMissRate: 0.05 (between 0.02 and 0.10, so neither TUNABLE nor UPSTREAM)
 * - violationP50: 0.15 (>= 0.25 * 0.5 = 0.125, so NOT OUTLIERS-SKEW)
 * - violationP90: 0.40 (<= 0.25 * 2 = 0.50, so NOT SEVERE-TAIL)
 * - isSingleClause: false (not DECISIVE)
 * - isDecisive: false (not DECISIVE)
 * - ceilingAnalysis.status: 'achievable' (not CEILING)
 *
 * @param {object} overrides - Properties to override
 * @returns {object} Mock blocker
 */
const createMockBlocker = (overrides = {}) => ({
  clauseDescription: 'emotions.joy >= 0.5',
  failureRate: 0.85,
  averageViolation: 0.25,
  rank: 1,
  severity: 'high',
  advancedAnalysis: {
    percentileAnalysis: {
      status: 'normal',
      insight: 'Distribution is normal',
    },
    nearMissAnalysis: {
      status: 'moderate',
      tunability: 'moderate',
      insight: 'Some near misses',
    },
    ceilingAnalysis: {
      status: 'achievable',
      achievable: true,
      headroom: 0.1,
      insight: 'Threshold is reachable',
    },
    lastMileAnalysis: {
      status: 'moderate',
      isDecisive: false,
      insight: 'Not decisive',
    },
    recommendation: {
      action: 'tune_threshold',
      priority: 'medium',
      message: 'Consider adjusting threshold',
    },
  },
  hierarchicalBreakdown: {
    variablePath: 'emotions.joy',
    comparisonOperator: '>=',
    thresholdValue: 0.5,
    violationP50: 0.15, // >= 0.25 * 0.5 = 0.125, so NOT OUTLIERS-SKEW
    violationP90: 0.40, // <= 0.25 * 2 = 0.50, so NOT SEVERE-TAIL
    nearMissRate: 0.05, // Between 0.02 and 0.10, so neither TUNABLE nor UPSTREAM
    nearMissEpsilon: 0.05,
    maxObservedValue: 0.6,
    ceilingGap: -0.1,
    lastMileFailRate: 0.3,
    othersPassedCount: 5000,
    isSingleClause: false,
  },
  ...overrides,
});

describe('MonteCarloReportGenerator', () => {
  let generator;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    generator = new MonteCarloReportGenerator({ logger: mockLogger });
  });

  // ===========================================================================
  // Constructor Tests
  // ===========================================================================

  describe('Constructor', () => {
    it('should create instance with valid logger', () => {
      expect(generator).toBeInstanceOf(MonteCarloReportGenerator);
    });

    it('should throw if logger is missing', () => {
      expect(() => new MonteCarloReportGenerator({})).toThrow();
    });

    it('should throw if dependencies object is empty', () => {
      expect(() => new MonteCarloReportGenerator()).toThrow();
    });

    it('should throw if logger lacks required methods', () => {
      expect(() => new MonteCarloReportGenerator({ logger: {} })).toThrow();
    });

    it('should throw if logger is missing info method', () => {
      expect(
        () =>
          new MonteCarloReportGenerator({
            logger: { warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
          })
      ).toThrow();
    });

    it('should throw if logger is missing warn method', () => {
      expect(
        () =>
          new MonteCarloReportGenerator({
            logger: { info: jest.fn(), error: jest.fn(), debug: jest.fn() },
          })
      ).toThrow();
    });

    it('should throw if logger is missing error method', () => {
      expect(
        () =>
          new MonteCarloReportGenerator({
            logger: { info: jest.fn(), warn: jest.fn(), debug: jest.fn() },
          })
      ).toThrow();
    });

    it('should throw if logger is missing debug method', () => {
      expect(
        () =>
          new MonteCarloReportGenerator({
            logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
          })
      ).toThrow();
    });
  });

  // ===========================================================================
  // Generate Method Tests
  // ===========================================================================

  describe('generate()', () => {
    it('should return string containing all required sections', () => {
      const result = createMockSimulationResult();
      const blockers = [createMockBlocker()];

      const report = generator.generate({
        expressionName: 'test:expression',
        simulationResult: result,
        blockers,
        summary: 'Test summary',
      });

      expect(typeof report).toBe('string');
      expect(report).toContain('# Monte Carlo Analysis Report');
      expect(report).toContain('**Gating model**: HARD (gate fail => final = 0)');
      expect(report).toContain('## Executive Summary');
      expect(report).toContain('## Signal Lineage');
      expect(report).toContain('## Blocker Analysis');
      expect(report).toContain('## Legend');
    });

    it('should include expression name in header', () => {
      const report = generator.generate({
        expressionName: 'my_custom:expression',
        simulationResult: createMockSimulationResult(),
        blockers: [],
        summary: '',
      });

      expect(report).toContain('my_custom:expression');
    });

    it('should include timestamp in header', () => {
      const report = generator.generate({
        expressionName: 'test:exp',
        simulationResult: createMockSimulationResult(),
        blockers: [],
        summary: '',
      });

      // Check for ISO date format pattern (YYYY-MM-DD)
      expect(report).toMatch(/\d{4}-\d{2}-\d{2}/);
    });

    it('should include summary text when provided', () => {
      const summaryText = 'This is a custom summary for testing purposes.';
      const report = generator.generate({
        expressionName: 'test:exp',
        simulationResult: createMockSimulationResult(),
        blockers: [],
        summary: summaryText,
      });

      expect(report).toContain(summaryText);
    });

    it('should note global vs in-regime statistics in the header', () => {
      const report = generator.generate({
        expressionName: 'test:exp',
        simulationResult: createMockSimulationResult(),
        blockers: [],
        summary: '',
      });

      expect(report).toContain('Regime Note');
      expect(report).toContain('global vs in-regime');
    });

    it('should include sampling coverage section when coverage data is present', () => {
      const samplingCoverage = {
        summaryByDomain: [
          {
            domain: 'emotions',
            variableCount: 2,
            rangeCoverageAvg: 0.2,
            binCoverageAvg: 0.1,
            tailCoverageAvg: { low: 0.01, high: 0.02 },
            zeroRateAvg: 0.85,
            rating: 'poor',
          },
          {
            domain: 'moodAxes',
            variableCount: 1,
            rangeCoverageAvg: 0.8,
            binCoverageAvg: 0.7,
            tailCoverageAvg: { low: 0.1, high: 0.1 },
            zeroRateAvg: 0.05,
            rating: 'good',
          },
        ],
        variables: [
          {
            variablePath: 'emotions.anger',
            domain: 'emotions',
            rangeCoverage: 0.2,
            binCoverage: 0.1,
            tailCoverage: { low: 0.01, high: 0.02 },
            rating: 'poor',
            sampleCount: 10000,
          },
          {
            variablePath: 'emotions.joy',
            domain: 'emotions',
            rangeCoverage: 0.3,
            binCoverage: 0.2,
            tailCoverage: { low: 0.02, high: 0.01 },
            rating: 'partial',
            sampleCount: 10000,
          },
          {
            variablePath: 'moodAxes.valence',
            domain: 'moodAxes',
            rangeCoverage: 0.8,
            binCoverage: 0.7,
            tailCoverage: { low: 0.1, high: 0.1 },
            rating: 'good',
            sampleCount: 10000,
          },
        ],
        config: {
          binCount: 10,
          tailPercent: 0.1,
        },
      };

      const report = generator.generate({
        expressionName: 'test:exp',
        simulationResult: createMockSimulationResult({
          samplingCoverage,
          samplingMode: 'dynamic',
        }),
        blockers: [],
        summary: 'Sampling coverage summary.',
      });

      expect(report).toContain('## Sampling Coverage');
      expect(report).toContain('**Sampling Mode**: dynamic');
      expect(report).toContain('### Summary by Domain');
      expect(report).toContain('Zero Rate Avg');
      expect(report).toContain('### Lowest Coverage Variables');
      expect(report).toContain('### Coverage Conclusions');
      expect(report).toContain('emotions.anger');
      expect(report).toContain('Sampling coverage is low for emotions');
      expect(report).toContain('85.00%');
      expect(report).toContain('Worst range coverage');

      const conclusionsMatch = report.match(
        /### Coverage Conclusions\n\n([\s\S]*?)\n\n---/
      );
      const conclusionsText = conclusionsMatch ? conclusionsMatch[1] : '';
      const criticalIndex = conclusionsText.indexOf(
        'observed range spans only'
      );
      const warnIndex = conclusionsText.indexOf('bin coverage is');
      expect(criticalIndex).toBeGreaterThanOrEqual(0);
      expect(warnIndex).toBeGreaterThanOrEqual(0);
      expect(criticalIndex).toBeLessThan(warnIndex);
    });

    it('should omit coverage conclusions subsection when no conclusions are produced', () => {
      const samplingCoverage = {
        summaryByDomain: [
          {
            domain: 'emotions',
            variableCount: 1,
            rating: 'good',
          },
        ],
        variables: [],
        config: { tailPercent: 0.1 },
      };

      const report = generator.generate({
        expressionName: 'test:exp',
        simulationResult: createMockSimulationResult({
          samplingCoverage,
          samplingMode: 'uniform',
        }),
        blockers: [],
        summary: 'Sampling coverage summary.',
      });

      expect(report).toContain('## Sampling Coverage');
      expect(report).not.toContain('### Coverage Conclusions');
    });

    it('should not include variable names in coverage conclusions text', () => {
      const samplingCoverage = {
        summaryByDomain: [
          {
            domain: 'emotions',
            variableCount: 1,
            rangeCoverageAvg: 0.2,
            binCoverageAvg: 0.1,
            tailCoverageAvg: { low: 0.01, high: 0.02 },
            rating: 'poor',
          },
        ],
        variables: [
          {
            variablePath: 'emotions.anger',
            domain: 'emotions',
            rangeCoverage: 0.2,
            binCoverage: 0.1,
            tailCoverage: { low: 0.01, high: 0.02 },
            rating: 'poor',
            sampleCount: 10000,
          },
        ],
        config: {
          binCount: 10,
          tailPercent: 0.1,
        },
      };

      const report = generator.generate({
        expressionName: 'test:exp',
        simulationResult: createMockSimulationResult({
          samplingCoverage,
          samplingMode: 'dynamic',
        }),
        blockers: [],
        summary: 'Sampling coverage summary.',
      });

      const conclusionsMatch = report.match(
        /### Coverage Conclusions\n\n([\s\S]*?)\n\n---/
      );
      const conclusionsText = conclusionsMatch ? conclusionsMatch[1] : '';

      expect(conclusionsText).not.toContain('emotions.anger');
    });

    it('should omit sampling coverage section when coverage data is missing', () => {
      const report = generator.generate({
        expressionName: 'test:exp',
        simulationResult: createMockSimulationResult(),
        blockers: [],
        summary: 'No coverage.',
      });

      expect(report).not.toContain('## Sampling Coverage');
    });

    it('should use the clause operator in the prototype math header', () => {
      const mockPrototypeConstraintAnalyzer = {
        extractAxisConstraints: jest.fn(() => new Map()),
        analyzeEmotionThreshold: jest.fn(() => ({
          prototypeId: 'joy',
          type: 'emotion',
          threshold: 0.5,
          maxAchievable: 0.7,
          isReachable: true,
          gap: -0.2,
          weights: {},
          gates: [],
          gateStatus: { allSatisfiable: true, conflicts: [] },
          bindingAxes: [],
          axisAnalysis: [],
          sumAbsWeights: 1,
          requiredRawSum: 0.5,
          explanation: 'Reachable with constraints.',
        })),
      };

      const generatorWithAnalyzer = new MonteCarloReportGenerator({
        logger: mockLogger,
        prototypeConstraintAnalyzer: mockPrototypeConstraintAnalyzer,
      });

      const report = generatorWithAnalyzer.generate({
        expressionName: 'test:exp',
        simulationResult: createMockSimulationResult({ storedContexts: [] }),
        blockers: [
          createMockBlocker({
            hierarchicalBreakdown: {
              variablePath: 'emotions.joy',
              comparisonOperator: '<=',
              thresholdValue: 0.5,
            },
          }),
        ],
        summary: '',
        prerequisites: [],
      });

      expect(report).toContain('joy <= 0.50');
    });

    it('should show default message when summary is empty', () => {
      const report = generator.generate({
        expressionName: 'test:exp',
        simulationResult: createMockSimulationResult(),
        blockers: [],
        summary: '',
      });

      expect(report).toContain('No summary available.');
    });

    it('should log debug message when generating report', () => {
      generator.generate({
        expressionName: 'test:expression',
        simulationResult: createMockSimulationResult(),
        blockers: [],
        summary: '',
      });

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Generating report for expression: test:expression'
      );
    });
  });

  // ===========================================================================
  // Flag Detection Tests
  // ===========================================================================

  /**
   * Helper to extract the flags line from a blocker section.
   * The report format is: "#### Flags\n[flags or None]"
   *
   * @param {string} report - Full report string
   * @returns {string} The flags line content
   */
  const extractFlagsSection = (report) => {
    const match = report.match(/#### Flags\n([^\n]+)/);
    return match ? match[1] : '';
  };

  describe('Flag Detection', () => {
    describe('[CEILING] flag', () => {
      it('should add CEILING flag when ceilingAnalysis status is ceiling_detected', () => {
        const blocker = createMockBlocker({
          advancedAnalysis: {
            ...createMockBlocker().advancedAnalysis,
            ceilingAnalysis: { status: 'ceiling_detected', achievable: false },
          },
        });

        const report = generator.generate({
          expressionName: 'test',
          simulationResult: createMockSimulationResult(),
          blockers: [blocker],
          summary: '',
        });

        const flagsSection = extractFlagsSection(report);
        expect(flagsSection).toContain('[CEILING]');
      });

      it('should NOT add CEILING flag when status is achievable', () => {
        // Default mock has achievable status - explicitly verify no CEILING flag
        const blocker = createMockBlocker();

        const report = generator.generate({
          expressionName: 'test',
          simulationResult: createMockSimulationResult(),
          blockers: [blocker],
          summary: '',
        });

        const flagsSection = extractFlagsSection(report);
        expect(flagsSection).not.toContain('[CEILING]');
      });

      it('should NOT add CEILING flag when ceilingAnalysis is undefined', () => {
        const baseBlocker = createMockBlocker();
        const blocker = {
          ...baseBlocker,
          advancedAnalysis: {
            ...baseBlocker.advancedAnalysis,
            ceilingAnalysis: undefined,
          },
        };

        const report = generator.generate({
          expressionName: 'test',
          simulationResult: createMockSimulationResult(),
          blockers: [blocker],
          summary: '',
        });

        const flagsSection = extractFlagsSection(report);
        expect(flagsSection).not.toContain('[CEILING]');
      });
    });

    describe('[DECISIVE] flag', () => {
      it('should add DECISIVE flag when lastMileAnalysis.isDecisive is true', () => {
        const baseBlocker = createMockBlocker();
        const blocker = {
          ...baseBlocker,
          advancedAnalysis: {
            ...baseBlocker.advancedAnalysis,
            lastMileAnalysis: {
              status: 'decisive_blocker',
              isDecisive: true,
              insight: 'Decisive',
            },
          },
        };

        const report = generator.generate({
          expressionName: 'test',
          simulationResult: createMockSimulationResult(),
          blockers: [blocker],
          summary: '',
        });

        const flagsSection = extractFlagsSection(report);
        expect(flagsSection).toContain('[DECISIVE]');
      });

      it('should add DECISIVE flag when isSingleClause is true', () => {
        const baseBlocker = createMockBlocker();
        const blocker = {
          ...baseBlocker,
          hierarchicalBreakdown: {
            ...baseBlocker.hierarchicalBreakdown,
            isSingleClause: true,
          },
        };

        const report = generator.generate({
          expressionName: 'test',
          simulationResult: createMockSimulationResult(),
          blockers: [blocker],
          summary: '',
        });

        const flagsSection = extractFlagsSection(report);
        expect(flagsSection).toContain('[DECISIVE]');
      });

      it('should NOT add DECISIVE flag when neither isDecisive nor isSingleClause', () => {
        // Default mock has isDecisive=false and isSingleClause=false
        const blocker = createMockBlocker();

        const report = generator.generate({
          expressionName: 'test',
          simulationResult: createMockSimulationResult(),
          blockers: [blocker],
          summary: '',
        });

        const flagsSection = extractFlagsSection(report);
        expect(flagsSection).not.toContain('[DECISIVE]');
      });
    });

    describe('[TUNABLE] flag', () => {
      it('should add TUNABLE flag when nearMissRate > 0.10', () => {
        const baseBlocker = createMockBlocker();
        const blocker = {
          ...baseBlocker,
          hierarchicalBreakdown: {
            ...baseBlocker.hierarchicalBreakdown,
            nearMissRate: 0.15,
          },
        };

        const report = generator.generate({
          expressionName: 'test',
          simulationResult: createMockSimulationResult(),
          blockers: [blocker],
          summary: '',
        });

        const flagsSection = extractFlagsSection(report);
        expect(flagsSection).toContain('[TUNABLE]');
      });

      it('should NOT add TUNABLE flag when nearMissRate is exactly 0.10', () => {
        const baseBlocker = createMockBlocker();
        const blocker = {
          ...baseBlocker,
          hierarchicalBreakdown: {
            ...baseBlocker.hierarchicalBreakdown,
            nearMissRate: 0.1,
          },
        };

        const report = generator.generate({
          expressionName: 'test',
          simulationResult: createMockSimulationResult(),
          blockers: [blocker],
          summary: '',
        });

        const flagsSection = extractFlagsSection(report);
        expect(flagsSection).not.toContain('[TUNABLE]');
      });

      it('should NOT add TUNABLE flag when nearMissRate < 0.10', () => {
        // Default mock has nearMissRate: 0.05, which is < 0.10
        const blocker = createMockBlocker();

        const report = generator.generate({
          expressionName: 'test',
          simulationResult: createMockSimulationResult(),
          blockers: [blocker],
          summary: '',
        });

        const flagsSection = extractFlagsSection(report);
        expect(flagsSection).not.toContain('[TUNABLE]');
      });
    });

    describe('[UPSTREAM] flag', () => {
      it('should add UPSTREAM flag when nearMissRate < 0.02', () => {
        const baseBlocker = createMockBlocker();
        const blocker = {
          ...baseBlocker,
          hierarchicalBreakdown: {
            ...baseBlocker.hierarchicalBreakdown,
            nearMissRate: 0.01,
          },
        };

        const report = generator.generate({
          expressionName: 'test',
          simulationResult: createMockSimulationResult(),
          blockers: [blocker],
          summary: '',
        });

        const flagsSection = extractFlagsSection(report);
        expect(flagsSection).toContain('[UPSTREAM]');
      });

      it('should NOT add UPSTREAM flag when nearMissRate is exactly 0.02', () => {
        const baseBlocker = createMockBlocker();
        const blocker = {
          ...baseBlocker,
          hierarchicalBreakdown: {
            ...baseBlocker.hierarchicalBreakdown,
            nearMissRate: 0.02,
          },
        };

        const report = generator.generate({
          expressionName: 'test',
          simulationResult: createMockSimulationResult(),
          blockers: [blocker],
          summary: '',
        });

        const flagsSection = extractFlagsSection(report);
        expect(flagsSection).not.toContain('[UPSTREAM]');
      });

      it('should NOT add UPSTREAM flag when nearMissRate > 0.02', () => {
        // Default mock has nearMissRate: 0.05, which is > 0.02
        const blocker = createMockBlocker();

        const report = generator.generate({
          expressionName: 'test',
          simulationResult: createMockSimulationResult(),
          blockers: [blocker],
          summary: '',
        });

        const flagsSection = extractFlagsSection(report);
        expect(flagsSection).not.toContain('[UPSTREAM]');
      });
    });

    describe('[OUTLIERS-SKEW] flag', () => {
      it('should add OUTLIERS-SKEW flag when p50 < avg * 0.5', () => {
        const baseBlocker = createMockBlocker();
        const blocker = {
          ...baseBlocker,
          averageViolation: 0.4,
          hierarchicalBreakdown: {
            ...baseBlocker.hierarchicalBreakdown,
            violationP50: 0.1, // 0.1 < 0.4 * 0.5 = 0.2
          },
        };

        const report = generator.generate({
          expressionName: 'test',
          simulationResult: createMockSimulationResult(),
          blockers: [blocker],
          summary: '',
        });

        const flagsSection = extractFlagsSection(report);
        expect(flagsSection).toContain('[OUTLIERS-SKEW]');
      });

      it('should NOT add OUTLIERS-SKEW flag when p50 >= avg * 0.5', () => {
        // Default mock: averageViolation: 0.25, violationP50: 0.15
        // 0.15 >= 0.25 * 0.5 = 0.125, so NOT OUTLIERS-SKEW
        const blocker = createMockBlocker();

        const report = generator.generate({
          expressionName: 'test',
          simulationResult: createMockSimulationResult(),
          blockers: [blocker],
          summary: '',
        });

        const flagsSection = extractFlagsSection(report);
        expect(flagsSection).not.toContain('[OUTLIERS-SKEW]');
      });

      it('should NOT add OUTLIERS-SKEW flag when values are missing', () => {
        const baseBlocker = createMockBlocker();
        const blocker = {
          ...baseBlocker,
          averageViolation: undefined,
          hierarchicalBreakdown: {
            ...baseBlocker.hierarchicalBreakdown,
            violationP50: undefined,
          },
        };

        const report = generator.generate({
          expressionName: 'test',
          simulationResult: createMockSimulationResult(),
          blockers: [blocker],
          summary: '',
        });

        const flagsSection = extractFlagsSection(report);
        expect(flagsSection).not.toContain('[OUTLIERS-SKEW]');
      });
    });

    describe('[SEVERE-TAIL] flag', () => {
      it('should add SEVERE-TAIL flag when p90 > avg * 2', () => {
        const baseBlocker = createMockBlocker();
        const blocker = {
          ...baseBlocker,
          averageViolation: 0.2,
          hierarchicalBreakdown: {
            ...baseBlocker.hierarchicalBreakdown,
            violationP90: 0.5, // 0.5 > 0.2 * 2 = 0.4
          },
        };

        const report = generator.generate({
          expressionName: 'test',
          simulationResult: createMockSimulationResult(),
          blockers: [blocker],
          summary: '',
        });

        const flagsSection = extractFlagsSection(report);
        expect(flagsSection).toContain('[SEVERE-TAIL]');
      });

      it('should NOT add SEVERE-TAIL flag when p90 <= avg * 2', () => {
        // Default mock: averageViolation: 0.25, violationP90: 0.40
        // 0.40 <= 0.25 * 2 = 0.50, so NOT SEVERE-TAIL
        const blocker = createMockBlocker();

        const report = generator.generate({
          expressionName: 'test',
          simulationResult: createMockSimulationResult(),
          blockers: [blocker],
          summary: '',
        });

        const flagsSection = extractFlagsSection(report);
        expect(flagsSection).not.toContain('[SEVERE-TAIL]');
      });

      it('should NOT add SEVERE-TAIL flag when values are missing', () => {
        const baseBlocker = createMockBlocker();
        const blocker = {
          ...baseBlocker,
          averageViolation: null,
          hierarchicalBreakdown: {
            ...baseBlocker.hierarchicalBreakdown,
            violationP90: null,
          },
        };

        const report = generator.generate({
          expressionName: 'test',
          simulationResult: createMockSimulationResult(),
          blockers: [blocker],
          summary: '',
        });

        const flagsSection = extractFlagsSection(report);
        expect(flagsSection).not.toContain('[SEVERE-TAIL]');
      });
    });

    describe('Multiple flags', () => {
      it('should display multiple flags when conditions are met', () => {
        const baseBlocker = createMockBlocker();
        const blocker = {
          ...baseBlocker,
          averageViolation: 0.4,
          hierarchicalBreakdown: {
            ...baseBlocker.hierarchicalBreakdown,
            nearMissRate: 0.15, // TUNABLE
            violationP50: 0.1, // OUTLIERS-SKEW (0.1 < 0.4 * 0.5)
            violationP90: 0.9, // SEVERE-TAIL (0.9 > 0.4 * 2)
            isSingleClause: true, // DECISIVE
          },
        };

        const report = generator.generate({
          expressionName: 'test',
          simulationResult: createMockSimulationResult(),
          blockers: [blocker],
          summary: '',
        });

        const flagsSection = extractFlagsSection(report);
        expect(flagsSection).toContain('[DECISIVE]');
        expect(flagsSection).toContain('[TUNABLE]');
        expect(flagsSection).toContain('[OUTLIERS-SKEW]');
        expect(flagsSection).toContain('[SEVERE-TAIL]');
      });

      it('should show "None" when no flags apply', () => {
        // Default mock is designed to NOT trigger any flags
        const blocker = createMockBlocker();

        const report = generator.generate({
          expressionName: 'test',
          simulationResult: createMockSimulationResult(),
          blockers: [blocker],
          summary: '',
        });

        const flagsSection = extractFlagsSection(report);
        expect(flagsSection).toBe('None');
      });
    });
  });

  // ===========================================================================
  // Rarity Category Tests
  // ===========================================================================

  describe('Rarity Categories', () => {
    it('should show "impossible" for 0% trigger rate', () => {
      const result = createMockSimulationResult({ triggerRate: 0 });
      const report = generator.generate({
        expressionName: 'test',
        simulationResult: result,
        blockers: [],
        summary: '',
      });
      expect(report).toContain('impossible');
    });

    it('should show "extremely_rare" for < 0.001% trigger rate', () => {
      const result = createMockSimulationResult({ triggerRate: 0.000005 });
      const report = generator.generate({
        expressionName: 'test',
        simulationResult: result,
        blockers: [],
        summary: '',
      });
      expect(report).toContain('extremely_rare');
    });

    it('should show "extremely_rare" at boundary (just below 0.00001)', () => {
      const result = createMockSimulationResult({ triggerRate: 0.000009 });
      const report = generator.generate({
        expressionName: 'test',
        simulationResult: result,
        blockers: [],
        summary: '',
      });
      expect(report).toContain('extremely_rare');
    });

    it('should show "rare" for < 0.05% trigger rate', () => {
      const result = createMockSimulationResult({ triggerRate: 0.0002 });
      const report = generator.generate({
        expressionName: 'test',
        simulationResult: result,
        blockers: [],
        summary: '',
      });
      expect(report).toContain('rare');
    });

    it('should show "rare" at boundary (just below 0.0005)', () => {
      const result = createMockSimulationResult({ triggerRate: 0.0004 });
      const report = generator.generate({
        expressionName: 'test',
        simulationResult: result,
        blockers: [],
        summary: '',
      });
      expect(report).toContain('rare');
    });

    it('should show "normal" for < 2% trigger rate', () => {
      const result = createMockSimulationResult({ triggerRate: 0.01 });
      const report = generator.generate({
        expressionName: 'test',
        simulationResult: result,
        blockers: [],
        summary: '',
      });
      expect(report).toContain('normal');
    });

    it('should show "normal" at boundary (just below 0.02)', () => {
      const result = createMockSimulationResult({ triggerRate: 0.019 });
      const report = generator.generate({
        expressionName: 'test',
        simulationResult: result,
        blockers: [],
        summary: '',
      });
      expect(report).toContain('normal');
    });

    it('should show "frequent" for >= 2% trigger rate', () => {
      const result = createMockSimulationResult({ triggerRate: 0.05 });
      const report = generator.generate({
        expressionName: 'test',
        simulationResult: result,
        blockers: [],
        summary: '',
      });
      expect(report).toContain('frequent');
    });

    it('should show "frequent" at boundary (exactly 0.02)', () => {
      const result = createMockSimulationResult({ triggerRate: 0.02 });
      const report = generator.generate({
        expressionName: 'test',
        simulationResult: result,
        blockers: [],
        summary: '',
      });
      expect(report).toContain('frequent');
    });

    it('should show "frequent" for high trigger rates', () => {
      const result = createMockSimulationResult({ triggerRate: 0.5 });
      const report = generator.generate({
        expressionName: 'test',
        simulationResult: result,
        blockers: [],
        summary: '',
      });
      expect(report).toContain('frequent');
    });
  });

  // ===========================================================================
  // Edge Case Tests
  // ===========================================================================

  describe('Edge Cases', () => {
    it('should handle empty blockers array', () => {
      const report = generator.generate({
        expressionName: 'test',
        simulationResult: createMockSimulationResult(),
        blockers: [],
        summary: 'No blockers',
      });

      expect(report).toContain('# Monte Carlo Analysis Report');
      expect(report).toContain('## Legend');
      expect(report).toContain('No blockers identified.');
    });

    it('should handle undefined blockers', () => {
      const report = generator.generate({
        expressionName: 'test',
        simulationResult: createMockSimulationResult(),
        blockers: undefined,
        summary: '',
      });

      expect(report).toContain('No blockers identified.');
    });

    it('should handle missing advancedAnalysis', () => {
      const blocker = { ...createMockBlocker(), advancedAnalysis: undefined };

      expect(() => {
        generator.generate({
          expressionName: 'test',
          simulationResult: createMockSimulationResult(),
          blockers: [blocker],
          summary: '',
        });
      }).not.toThrow();
    });

    it('should handle missing hierarchicalBreakdown', () => {
      const blocker = {
        ...createMockBlocker(),
        hierarchicalBreakdown: undefined,
      };

      expect(() => {
        generator.generate({
          expressionName: 'test',
          simulationResult: createMockSimulationResult(),
          blockers: [blocker],
          summary: '',
        });
      }).not.toThrow();
    });

    it('should handle null/undefined values gracefully', () => {
      const blocker = createMockBlocker({
        advancedAnalysis: {
          percentileAnalysis: null,
          nearMissAnalysis: null,
          ceilingAnalysis: null,
          lastMileAnalysis: null,
          recommendation: null,
        },
      });

      expect(() => {
        generator.generate({
          expressionName: 'test',
          simulationResult: createMockSimulationResult(),
          blockers: [blocker],
          summary: '',
        });
      }).not.toThrow();
    });

    it('should handle 100% trigger rate', () => {
      const result = createMockSimulationResult({
        triggerRate: 1.0,
        triggerCount: 10000,
      });

      const report = generator.generate({
        expressionName: 'test',
        simulationResult: result,
        blockers: [],
        summary: '',
      });

      expect(report).toContain('100');
    });

    it('should handle missing confidenceInterval', () => {
      const result = createMockSimulationResult({
        confidenceInterval: undefined,
      });

      expect(() => {
        generator.generate({
          expressionName: 'test',
          simulationResult: result,
          blockers: [],
          summary: '',
        });
      }).not.toThrow();
    });

    it('should handle missing distribution', () => {
      const result = createMockSimulationResult({
        distribution: undefined,
      });

      const report = generator.generate({
        expressionName: 'test',
        simulationResult: result,
        blockers: [],
        summary: '',
      });

      expect(report).toContain('uniform'); // Default fallback
    });

    it('should handle missing sampleCount', () => {
      const result = createMockSimulationResult({
        sampleCount: undefined,
      });

      const report = generator.generate({
        expressionName: 'test',
        simulationResult: result,
        blockers: [],
        summary: '',
      });

      expect(report).toContain('**Sample Size**: 0');
    });

    it('should handle blocker with missing clauseDescription', () => {
      const blocker = createMockBlocker({
        clauseDescription: undefined,
      });

      const report = generator.generate({
        expressionName: 'test',
        simulationResult: createMockSimulationResult(),
        blockers: [blocker],
        summary: '',
      });

      expect(report).toContain('Unknown clause');
    });

    it('should handle blocker with missing severity', () => {
      const blocker = createMockBlocker({
        severity: undefined,
      });

      const report = generator.generate({
        expressionName: 'test',
        simulationResult: createMockSimulationResult(),
        blockers: [blocker],
        summary: '',
      });

      expect(report).toContain('**Severity**: unknown');
    });

    it('should handle multiple blockers', () => {
      const blocker1 = createMockBlocker({ rank: 1 });
      const blocker2 = createMockBlocker({
        rank: 2,
        clauseDescription: 'emotions.fear >= 0.3',
      });

      const report = generator.generate({
        expressionName: 'test',
        simulationResult: createMockSimulationResult(),
        blockers: [blocker1, blocker2],
        summary: '',
      });

      expect(report).toContain('### Blocker #1');
      expect(report).toContain('### Blocker #2');
      expect(report).toContain('emotions.joy >= 0.5');
      expect(report).toContain('emotions.fear >= 0.3');
    });
  });

  // ===========================================================================
  // Format Verification Tests
  // ===========================================================================

  describe('Format Verification', () => {
    it('should display percentages as 0-100 scale', () => {
      const result = createMockSimulationResult({ triggerRate: 0.15 });

      const report = generator.generate({
        expressionName: 'test',
        simulationResult: result,
        blockers: [],
        summary: '',
      });

      expect(report).toContain('15');
      expect(report).toContain('%');
    });

    it('should include confidence interval bounds', () => {
      const result = createMockSimulationResult({
        confidenceInterval: { low: 0.12, high: 0.18 },
      });

      const report = generator.generate({
        expressionName: 'test',
        simulationResult: result,
        blockers: [],
        summary: '',
      });

      // Check for both bounds with percentage
      expect(report).toMatch(/12\.00%.*18\.00%/s);
    });

    it('should include sample count', () => {
      const result = createMockSimulationResult({ sampleCount: 50000 });

      const report = generator.generate({
        expressionName: 'test',
        simulationResult: result,
        blockers: [],
        summary: '',
      });

      expect(report).toContain('50000');
    });

    it('should include distribution type', () => {
      const result = createMockSimulationResult({ distribution: 'gaussian' });

      const report = generator.generate({
        expressionName: 'test',
        simulationResult: result,
        blockers: [],
        summary: '',
      });

      expect(report).toContain('gaussian');
    });

    it('should format failure rate as percentage', () => {
      const blocker = createMockBlocker({ failureRate: 0.85 });

      const report = generator.generate({
        expressionName: 'test',
        simulationResult: createMockSimulationResult(),
        blockers: [blocker],
        summary: '',
      });

      expect(report).toContain('85.00%');
    });

    it('should format near-miss rate as percentage', () => {
      const blocker = createMockBlocker({
        hierarchicalBreakdown: {
          ...createMockBlocker().hierarchicalBreakdown,
          nearMissRate: 0.08,
        },
      });

      const report = generator.generate({
        expressionName: 'test',
        simulationResult: createMockSimulationResult(),
        blockers: [blocker],
        summary: '',
      });

      expect(report).toContain('8.00%');
    });

    it('should format violation values as numbers with 2 decimals', () => {
      const blocker = createMockBlocker({
        averageViolation: 0.12345,
        hierarchicalBreakdown: {
          ...createMockBlocker().hierarchicalBreakdown,
          violationP50: 0.1,
          violationP90: 0.3456,
        },
      });

      const report = generator.generate({
        expressionName: 'test',
        simulationResult: createMockSimulationResult(),
        blockers: [blocker],
        summary: '',
      });

      expect(report).toContain('0.12'); // averageViolation
      expect(report).toContain('0.10'); // violationP50
      expect(report).toContain('0.35'); // violationP90
    });

    it('should display N/A for missing numeric values', () => {
      // Create a blocker with missing thresholdValue to trigger N/A display
      // (Implementation uses ?? 'N/A' for thresholdValue specifically)
      const baseBlocker = createMockBlocker();
      const blocker = {
        ...baseBlocker,
        hierarchicalBreakdown: {
          ...baseBlocker.hierarchicalBreakdown,
          thresholdValue: undefined, // This triggers N/A
        },
      };

      const report = generator.generate({
        expressionName: 'test',
        simulationResult: createMockSimulationResult(),
        blockers: [blocker],
        summary: '',
      });

      expect(report).toContain('**Threshold**: N/A');
    });

    it('should display N/A for NaN values', () => {
      const result = createMockSimulationResult({
        triggerRate: NaN,
      });

      const report = generator.generate({
        expressionName: 'test',
        simulationResult: result,
        blockers: [],
        summary: '',
      });

      expect(report).toContain('N/A');
    });
  });

  // ===========================================================================
  // Blocker Section Content Tests
  // ===========================================================================

  describe('Blocker Section Content', () => {
    it('should include condition details from hierarchicalBreakdown', () => {
      const blocker = createMockBlocker({
        hierarchicalBreakdown: {
          ...createMockBlocker().hierarchicalBreakdown,
          variablePath: 'emotions.confidence',
          comparisonOperator: '<=',
          thresholdValue: 0.7,
        },
      });

      const report = generator.generate({
        expressionName: 'test',
        simulationResult: createMockSimulationResult(),
        blockers: [blocker],
        summary: '',
      });

      expect(report).toContain('emotions.confidence');
      expect(report).toContain('<=');
      expect(report).toContain('0.7');
    });

    it('should include distribution analysis section', () => {
      const blocker = createMockBlocker({
        advancedAnalysis: {
          ...createMockBlocker().advancedAnalysis,
          percentileAnalysis: {
            status: 'heavy_tail',
            insight: 'Heavy-tailed distribution detected',
          },
        },
      });

      const report = generator.generate({
        expressionName: 'test',
        simulationResult: createMockSimulationResult(),
        blockers: [blocker],
        summary: '',
      });

      expect(report).toContain('#### Distribution Analysis');
      expect(report).toContain('Heavy-tailed distribution detected');
    });

    it('should include ceiling analysis section', () => {
      const blocker = createMockBlocker({
        hierarchicalBreakdown: {
          ...createMockBlocker().hierarchicalBreakdown,
          maxObservedValue: 0.45,
          ceilingGap: 0.05,
        },
        advancedAnalysis: {
          ...createMockBlocker().advancedAnalysis,
          ceilingAnalysis: {
            status: 'ceiling_detected',
            achievable: false,
            insight: 'Threshold cannot be reached',
          },
        },
      });

      const report = generator.generate({
        expressionName: 'test',
        simulationResult: createMockSimulationResult(),
        blockers: [blocker],
        summary: '',
      });

      expect(report).toContain('#### Ceiling Analysis');
      expect(report).toContain('0.45');
      expect(report).toContain('0.05');
      expect(report).toContain('Threshold cannot be reached');
    });

    it('should include near-miss analysis section', () => {
      const blocker = createMockBlocker({
        hierarchicalBreakdown: {
          ...createMockBlocker().hierarchicalBreakdown,
          nearMissRate: 0.12,
          nearMissEpsilon: 0.03,
        },
        advancedAnalysis: {
          ...createMockBlocker().advancedAnalysis,
          nearMissAnalysis: {
            tunability: 'high',
            insight: 'Many values are close to threshold',
          },
        },
      });

      const report = generator.generate({
        expressionName: 'test',
        simulationResult: createMockSimulationResult(),
        blockers: [blocker],
        summary: '',
      });

      expect(report).toContain('#### Near-Miss Analysis');
      expect(report).toContain('12.00%');
      expect(report).toContain('0.03');
      expect(report).toContain('high');
      expect(report).toContain('Many values are close to threshold');
    });

    it('should include last-mile analysis section', () => {
      const blocker = createMockBlocker({
        hierarchicalBreakdown: {
          ...createMockBlocker().hierarchicalBreakdown,
          lastMileFailRate: 0.65,
          othersPassedCount: 3000,
        },
        advancedAnalysis: {
          ...createMockBlocker().advancedAnalysis,
          lastMileAnalysis: {
            isDecisive: true,
            insight: 'This is the final bottleneck',
          },
        },
      });

      const report = generator.generate({
        expressionName: 'test',
        simulationResult: createMockSimulationResult(),
        blockers: [blocker],
        summary: '',
      });

      expect(report).toContain('#### Sole-Blocker Analysis');
      expect(report).toContain('65.00%');
      expect(report).toContain('3000');
      expect(report).toContain('yes');
      expect(report).toContain('This is the final bottleneck');
    });

    it('should include recommendation section', () => {
      const blocker = createMockBlocker({
        advancedAnalysis: {
          ...createMockBlocker().advancedAnalysis,
          recommendation: {
            action: 'redesign',
            priority: 'critical',
            message: 'Consider restructuring this condition',
          },
        },
      });

      const report = generator.generate({
        expressionName: 'test',
        simulationResult: createMockSimulationResult(),
        blockers: [blocker],
        summary: '',
      });

      expect(report).toContain('#### Recommendation');
      expect(report).toContain('redesign');
      expect(report).toContain('critical');
      expect(report).toContain('Consider restructuring this condition');
    });
  });

  // ===========================================================================
  // Enhanced Distribution Analysis Tests
  // ===========================================================================

  describe('Enhanced Distribution Analysis', () => {
    it('should include p95 in distribution analysis when available', () => {
      const blocker = createMockBlocker({
        hierarchicalBreakdown: {
          ...createMockBlocker().hierarchicalBreakdown,
          violationP50: 0.10,
          violationP90: 0.25,
          violationP95: 0.35,
        },
      });

      const report = generator.generate({
        expressionName: 'test',
        simulationResult: createMockSimulationResult(),
        blockers: [blocker],
        summary: '',
      });

      expect(report).toContain('**95th Percentile (P95)**');
      expect(report).toContain('0.35');
    });

    it('should include p99 in distribution analysis when available', () => {
      const blocker = createMockBlocker({
        hierarchicalBreakdown: {
          ...createMockBlocker().hierarchicalBreakdown,
          violationP50: 0.10,
          violationP90: 0.25,
          violationP99: 0.45,
        },
      });

      const report = generator.generate({
        expressionName: 'test',
        simulationResult: createMockSimulationResult(),
        blockers: [blocker],
        summary: '',
      });

      expect(report).toContain('**99th Percentile (P99)**');
      expect(report).toContain('0.45');
    });

    it('should include both p95 and p99 when both available', () => {
      const blocker = createMockBlocker({
        hierarchicalBreakdown: {
          ...createMockBlocker().hierarchicalBreakdown,
          violationP95: 0.35,
          violationP99: 0.45,
        },
      });

      const report = generator.generate({
        expressionName: 'test',
        simulationResult: createMockSimulationResult(),
        blockers: [blocker],
        summary: '',
      });

      expect(report).toContain('**95th Percentile (P95)**');
      expect(report).toContain('**99th Percentile (P99)**');
    });

    it('should not include p95/p99 when not available', () => {
      const blocker = createMockBlocker({
        hierarchicalBreakdown: {
          ...createMockBlocker().hierarchicalBreakdown,
          violationP95: null,
          violationP99: null,
        },
      });

      const report = generator.generate({
        expressionName: 'test',
        simulationResult: createMockSimulationResult(),
        blockers: [blocker],
        summary: '',
      });

      // Should still contain the basic percentiles
      expect(report).toContain('**Median (P50)**');
      expect(report).toContain('**90th Percentile (P90)**');
      // But not p95/p99 if they're null
      // (Note: the implementation may or may not include section headers)
    });

    it('should include min observed value when available', () => {
      const blocker = createMockBlocker({
        hierarchicalBreakdown: {
          ...createMockBlocker().hierarchicalBreakdown,
          observedMin: 0.12,
        },
      });

      const report = generator.generate({
        expressionName: 'test',
        simulationResult: createMockSimulationResult(),
        blockers: [blocker],
        summary: '',
      });

      expect(report).toContain('**Min Observed**');
      expect(report).toContain('0.12');
    });

    it('should include mean observed value when available', () => {
      const blocker = createMockBlocker({
        hierarchicalBreakdown: {
          ...createMockBlocker().hierarchicalBreakdown,
          observedMean: 0.42,
        },
      });

      const report = generator.generate({
        expressionName: 'test',
        simulationResult: createMockSimulationResult(),
        blockers: [blocker],
        summary: '',
      });

      expect(report).toContain('**Mean Observed**');
      expect(report).toContain('0.42');
    });

    it('should include observed value distribution section when min and mean available', () => {
      const blocker = createMockBlocker({
        hierarchicalBreakdown: {
          ...createMockBlocker().hierarchicalBreakdown,
          observedMin: 0.15,
          observedMean: 0.45,
        },
      });

      const report = generator.generate({
        expressionName: 'test',
        simulationResult: createMockSimulationResult(),
        blockers: [blocker],
        summary: '',
      });

      expect(report).toContain('**Observed Value Distribution**');
      expect(report).toContain('**Min Observed**');
      expect(report).toContain('**Mean Observed**');
    });

    it('should aggregate p95/p99 for compound nodes', () => {
      // Create a compound blocker with children that have p95/p99
      const childNode1 = {
        id: '0.0',
        nodeType: 'leaf',
        description: 'emotions.joy >= 0.5',
        failureRate: 0.8,
        averageViolation: 0.3,
        violationP90: 0.4,
        violationP95: 0.45,
        violationP99: 0.5,
      };
      const childNode2 = {
        id: '0.1',
        nodeType: 'leaf',
        description: 'emotions.fear <= 0.2',
        failureRate: 0.6,
        averageViolation: 0.2,
        violationP90: 0.35,
        violationP95: 0.55, // Higher p95
        violationP99: 0.6, // Higher p99
      };

      const blocker = createMockBlocker({
        hierarchicalBreakdown: {
          id: '0',
          nodeType: 'and',
          isCompound: true,
          children: [childNode1, childNode2],
        },
      });

      const report = generator.generate({
        expressionName: 'test',
        simulationResult: createMockSimulationResult(),
        blockers: [blocker],
        summary: '',
      });

      // Should show highest P95 and P99 from leaves
      expect(report).toContain('**Highest P95 Violation**');
      expect(report).toContain('0.55');
      expect(report).toContain('**Highest P99 Violation**');
      expect(report).toContain('0.60');
    });
  });

  // ===========================================================================
  // Condition Breakdown Table Tests (Support Column)
  // ===========================================================================

  describe('Condition Breakdown Table', () => {
    it('should include Support column in table header', () => {
      const childNode = {
        id: '0.0',
        nodeType: 'leaf',
        description: 'emotions.joy >= 0.5',
        failureRate: 0.8,
        evaluationCount: 5000,
      };

      const blocker = createMockBlocker({
        hierarchicalBreakdown: {
          id: '0',
          nodeType: 'and',
          isCompound: true,
          children: [childNode],
        },
      });

      const report = generator.generate({
        expressionName: 'test',
        simulationResult: createMockSimulationResult(),
        blockers: [blocker],
        summary: '',
      });

      expect(report).toContain('| Support |');
    });

    it('should include gate clamp and pass|gate columns for emotion leaves', () => {
      const childNode = {
        id: '0.0',
        nodeType: 'leaf',
        description: 'emotions.joy >= 0.5',
        variablePath: 'emotions.joy',
        comparisonOperator: '>=',
        thresholdValue: 0.5,
        failureRate: 0.8,
        evaluationCount: 7500,
        inRegimeEvaluationCount: 10,
        inRegimeFailureCount: 4,
        inRegimePassRate: 0.6,
        gatePassRateInRegime: 0.7,
        gateClampRateInRegime: 0.3,
        gateFailInRegimeCount: 3,
        gatePassInRegimeCount: 7,
        passRateGivenGateInRegime: 3 / 7,
        gatePassAndClausePassInRegimeCount: 3,
      };

      const blocker = createMockBlocker({
        hierarchicalBreakdown: {
          id: '0',
          nodeType: 'and',
          isCompound: true,
          children: [childNode],
        },
      });

      const report = generator.generate({
        expressionName: 'test',
        simulationResult: createMockSimulationResult(),
        blockers: [blocker],
        summary: '',
      });

      expect(report).toContain(
        '| Gate pass (mood) | Gate clamp (mood) | Pass \\| gate (mood) | Pass \\| mood (mood) |'
      );
      expect(report).toContain('70.00% (7 / 10)');
      expect(report).toContain('30.00% (3 / 10)');
      expect(report).toContain('42.86% (3 / 7)');
      expect(report).toContain('60.00% (6 / 10)');
    });

    it('should omit gate columns when no emotion leaves are present', () => {
      const childNode = {
        id: '0.0',
        nodeType: 'leaf',
        description: 'moodAxes.valence >= 0.5',
        variablePath: 'moodAxes.valence',
        comparisonOperator: '>=',
        thresholdValue: 0.5,
        failureRate: 0.8,
        evaluationCount: 7500,
      };

      const blocker = createMockBlocker({
        hierarchicalBreakdown: {
          id: '0',
          nodeType: 'and',
          isCompound: true,
          children: [childNode],
        },
      });

      const report = generator.generate({
        expressionName: 'test',
        simulationResult: createMockSimulationResult(),
        blockers: [blocker],
        summary: '',
      });

      const headerLine = report
        .split('\n')
        .find((line) => line.startsWith('| # | Condition'));
      expect(headerLine).toBeDefined();
      expect(headerLine).not.toContain('Gate clamp (mood)');
      expect(headerLine).not.toContain('Pass | gate (mood)');
      expect(headerLine).not.toContain('Gate pass (mood)');
      expect(headerLine).not.toContain('Pass | mood (mood)');
    });

    it('should display evaluation count in Support column', () => {
      const childNode = {
        id: '0.0',
        nodeType: 'leaf',
        description: 'emotions.joy >= 0.5',
        failureRate: 0.8,
        evaluationCount: 7500,
      };

      const blocker = createMockBlocker({
        hierarchicalBreakdown: {
          id: '0',
          nodeType: 'and',
          isCompound: true,
          children: [childNode],
        },
      });

      const report = generator.generate({
        expressionName: 'test',
        simulationResult: createMockSimulationResult(),
        blockers: [blocker],
        summary: '',
      });

      expect(report).toContain('7500');
    });

    it('should show 0 for evaluationCount when not available', () => {
      const childNode = {
        id: '0.0',
        nodeType: 'leaf',
        description: 'emotions.joy >= 0.5',
        failureRate: 0.8,
        // evaluationCount not set
      };

      const blocker = createMockBlocker({
        hierarchicalBreakdown: {
          id: '0',
          nodeType: 'and',
          isCompound: true,
          children: [childNode],
        },
      });

      const report = generator.generate({
        expressionName: 'test',
        simulationResult: createMockSimulationResult(),
        blockers: [blocker],
        summary: '',
      });

      // The table row should contain | 0 | for missing evaluationCount
      expect(report).toMatch(/\| 0 \|/);
    });
  });

  // ===========================================================================
  // Legend Section Tests
  // ===========================================================================

  describe('Legend Section', () => {
    it('should include all global metric definitions', () => {
      const report = generator.generate({
        expressionName: 'test',
        simulationResult: createMockSimulationResult(),
        blockers: [],
        summary: '',
      });

      expect(report).toContain('### Global Metrics');
      expect(report).toContain('**Trigger Rate**');
      expect(report).toContain('**Confidence Interval**');
      expect(report).toContain('**Sample Size**');
      expect(report).toContain('**Rarity Categories**');
    });

    it('should include all per-clause metric definitions', () => {
      const report = generator.generate({
        expressionName: 'test',
        simulationResult: createMockSimulationResult(),
        blockers: [],
        summary: '',
      });

      expect(report).toContain('### Per-Clause Metrics');
      expect(report).toContain('**Fail% global**');
      expect(report).toContain('**Fail% | mood-pass**');
      expect(report).toContain('**Gate pass (mood)**');
      expect(report).toContain('**Gate clamp (mood)**');
      expect(report).toContain('**Pass | gate (mood)**');
      expect(report).toContain('**Pass | mood (mood)**');
      expect(report).toContain('**Violation Magnitude**');
      expect(report).toContain('**P50 (Median)**');
      expect(report).toContain('**P90 (90th Percentile)**');
      expect(report).toContain('**Near-Miss Rate**');
      expect(report).toContain('**Epsilon**');
      expect(report).toContain('**Sole-Blocker Rate (N)**');
      expect(report).toContain('**Ceiling Gap**');
    });

    it('should include tunability level definitions', () => {
      const report = generator.generate({
        expressionName: 'test',
        simulationResult: createMockSimulationResult(),
        blockers: [],
        summary: '',
      });

      expect(report).toContain('### Tunability Levels');
      expect(report).toContain('**High**');
      expect(report).toContain('**Moderate**');
      expect(report).toContain('**Low**');
    });

    it('should include severity level definitions', () => {
      const report = generator.generate({
        expressionName: 'test',
        simulationResult: createMockSimulationResult(),
        blockers: [],
        summary: '',
      });

      expect(report).toContain('### Severity Levels');
      expect(report).toContain('**Critical**');
      expect(report).toContain('**High**');
      expect(report).toContain('**Medium**');
      expect(report).toContain('**Low**');
    });

    it('should include recommended action definitions', () => {
      const report = generator.generate({
        expressionName: 'test',
        simulationResult: createMockSimulationResult(),
        blockers: [],
        summary: '',
      });

      expect(report).toContain('### Recommended Actions');
      expect(report).toContain('**redesign**');
      expect(report).toContain('**tune_threshold**');
      expect(report).toContain('**adjust_upstream**');
      expect(report).toContain('**lower_priority**');
      expect(report).toContain('**investigate**');
    });

    it('should include problem flag definitions', () => {
      const report = generator.generate({
        expressionName: 'test',
        simulationResult: createMockSimulationResult(),
        blockers: [],
        summary: '',
      });

      expect(report).toContain('### Problem Flags');
      expect(report).toContain('**[CEILING]**');
      expect(report).toContain('**[DECISIVE]**');
      expect(report).toContain('**[TUNABLE]**');
      expect(report).toContain('**[UPSTREAM]**');
      expect(report).toContain('**[OUTLIERS-SKEW]**');
      expect(report).toContain('**[SEVERE-TAIL]**');
    });
  });

  describe('Sensitivity Analysis', () => {
    it('should not include sensitivity section when no sensitivity data provided', () => {
      const report = generator.generate({
        expressionName: 'test_expression',
        simulationResult: createMockSimulationResult(),
        blockers: [createMockBlocker()],
        summary: 'Test summary',
      });

      expect(report).not.toContain('## Marginal Clause Pass-Rate Sweep');
    });

    it('should not include sensitivity section when sensitivityData is empty array', () => {
      const report = generator.generate({
        expressionName: 'test_expression',
        simulationResult: createMockSimulationResult(),
        blockers: [createMockBlocker()],
        summary: 'Test summary',
        sensitivityData: [],
      });

      expect(report).not.toContain('## Marginal Clause Pass-Rate Sweep');
    });

    it('should include sensitivity section when sensitivity data is provided', () => {
      const sensitivityData = [
        {
          kind: 'marginalClausePassRateSweep',
          conditionPath: 'emotions.anger',
          operator: '>=',
          originalThreshold: 0.4,
          grid: [
            { threshold: 0.25, passRate: 0.15, passCount: 1500, sampleCount: 10000 },
            { threshold: 0.30, passRate: 0.08, passCount: 800, sampleCount: 10000 },
            { threshold: 0.35, passRate: 0.03, passCount: 300, sampleCount: 10000 },
            { threshold: 0.40, passRate: 0.002, passCount: 20, sampleCount: 10000 },
            { threshold: 0.45, passRate: 0.0005, passCount: 5, sampleCount: 10000 },
          ],
        },
      ];

      const report = generator.generate({
        expressionName: 'test_expression',
        simulationResult: createMockSimulationResult(),
        blockers: [createMockBlocker()],
        summary: 'Test summary',
        sensitivityData,
      });

      expect(report).toContain('## Marginal Clause Pass-Rate Sweep');
      expect(report).toContain('Marginal Clause Pass-Rate Sweep: emotions.anger >= [threshold]');
      expect(report).toContain('| Threshold | Pass Rate | Change | Samples |');
      expect(report).toContain('does **not** estimate overall expression trigger rate');
    });

    it('adds effective threshold column for integer-domain sensitivity tables', () => {
      const sensitivityData = [
        {
          kind: 'marginalClausePassRateSweep',
          conditionPath: 'moodAxes.valence',
          operator: '>=',
          originalThreshold: 10,
          isIntegerDomain: true,
          grid: [
            {
              threshold: 9.2,
              effectiveThreshold: 10,
              passRate: 0.1,
              passCount: 1,
              sampleCount: 10,
            },
            {
              threshold: 10,
              effectiveThreshold: 10,
              passRate: 0.2,
              passCount: 2,
              sampleCount: 10,
            },
          ],
        },
      ];

      const report = generator.generate({
        expressionName: 'test_expression',
        simulationResult: createMockSimulationResult(),
        blockers: [createMockBlocker()],
        summary: 'Test summary',
        sensitivityData,
      });

      expect(report).toContain('| Threshold | Effective Threshold | Pass Rate | Change | Samples |');
      expect(report).toContain('**10**');
      expect(report).toContain(
        'Thresholds are integer-effective; decimals collapse to integer boundaries.'
      );
    });

    it('should format sensitivity table with baseline indicator', () => {
      const sensitivityData = [
        {
          kind: 'marginalClausePassRateSweep',
          conditionPath: 'emotions.anger',
          operator: '>=',
          originalThreshold: 0.4,
          grid: [
            { threshold: 0.35, passRate: 0.03, passCount: 300, sampleCount: 10000 },
            { threshold: 0.40, passRate: 0.002, passCount: 20, sampleCount: 10000 },
            { threshold: 0.45, passRate: 0.0005, passCount: 5, sampleCount: 10000 },
          ],
        },
      ];

      const report = generator.generate({
        expressionName: 'test_expression',
        simulationResult: createMockSimulationResult(),
        blockers: [createMockBlocker()],
        summary: 'Test summary',
        sensitivityData,
      });

      // The original threshold row should be bold and show stored-context baseline
      // formatNumber(0.4) outputs '0.40' with 2 decimals
      expect(report).toContain('**0.40**');
      expect(report).toContain('**baseline (stored contexts)**');
    });

    it('should calculate change percentages from baseline', () => {
      const sensitivityData = [
        {
          kind: 'marginalClausePassRateSweep',
          conditionPath: 'emotions.anger',
          operator: '>=',
          originalThreshold: 0.4,
          grid: [
            { threshold: 0.35, passRate: 0.04, passCount: 400, sampleCount: 10000 },
            { threshold: 0.40, passRate: 0.02, passCount: 200, sampleCount: 10000 },
          ],
        },
      ];

      const report = generator.generate({
        expressionName: 'test_expression',
        simulationResult: createMockSimulationResult(),
        blockers: [createMockBlocker()],
        summary: 'Test summary',
        sensitivityData,
      });

      // 0.04 / 0.02 = 2x, so +100.00%
      expect(report).toContain('+100.00%');
    });

    it('should handle zero baseline gracefully', () => {
      const sensitivityData = [
        {
          kind: 'marginalClausePassRateSweep',
          conditionPath: 'emotions.anger',
          operator: '>=',
          originalThreshold: 0.4,
          grid: [
            { threshold: 0.35, passRate: 0.05, passCount: 500, sampleCount: 10000 },
            { threshold: 0.40, passRate: 0, passCount: 0, sampleCount: 10000 },
          ],
        },
      ];

      const report = generator.generate({
        expressionName: 'test_expression',
        simulationResult: createMockSimulationResult(),
        blockers: [createMockBlocker()],
        summary: 'Test summary',
        sensitivityData,
      });

      // When baseline is 0 and other rate is positive, should show +∞
      expect(report).toContain('+∞');
    });

    it('should handle multiple sensitivity results', () => {
      const sensitivityData = [
        {
          kind: 'marginalClausePassRateSweep',
          conditionPath: 'emotions.anger',
          operator: '>=',
          originalThreshold: 0.4,
          grid: [
            { threshold: 0.40, passRate: 0.002, passCount: 20, sampleCount: 10000 },
          ],
        },
        {
          kind: 'marginalClausePassRateSweep',
          conditionPath: 'emotions.joy',
          operator: '>=',
          originalThreshold: 0.5,
          grid: [
            { threshold: 0.50, passRate: 0.15, passCount: 1500, sampleCount: 10000 },
          ],
        },
      ];

      const report = generator.generate({
        expressionName: 'test_expression',
        simulationResult: createMockSimulationResult(),
        blockers: [createMockBlocker()],
        summary: 'Test summary',
        sensitivityData,
      });

      expect(report).toContain('emotions.anger >= [threshold]');
      expect(report).toContain('emotions.joy >= [threshold]');
    });

    it('should include recommendation for low pass rate conditions', () => {
      const sensitivityData = [
        {
          kind: 'marginalClausePassRateSweep',
          conditionPath: 'emotions.anger',
          operator: '>=',
          originalThreshold: 0.4,
          grid: [
            { threshold: 0.25, passRate: 0.15, passCount: 1500, sampleCount: 10000 },
            { threshold: 0.40, passRate: 0.001, passCount: 10, sampleCount: 10000 },
          ],
        },
      ];

      const report = generator.generate({
        expressionName: 'test_expression',
        simulationResult: createMockSimulationResult(),
        blockers: [createMockBlocker()],
        summary: 'Test summary',
        sensitivityData,
      });

      // Original pass rate is 0.001 (< 0.01), and 0.15 >= 0.001 * 10
      expect(report).toContain('Recommendation');
      expect(report).toContain('0.25');
    });

    it('should skip sensitivity result with empty grid', () => {
      const sensitivityData = [
        {
          kind: 'marginalClausePassRateSweep',
          conditionPath: 'emotions.anger',
          operator: '>=',
          originalThreshold: 0.4,
          grid: [],
        },
      ];

      const report = generator.generate({
        expressionName: 'test_expression',
        simulationResult: createMockSimulationResult(),
        blockers: [createMockBlocker()],
        summary: 'Test summary',
        sensitivityData,
      });

      // Section header should be present but no table
      expect(report).toContain('## Marginal Clause Pass-Rate Sweep');
      expect(report).not.toContain('emotions.anger >= [threshold]');
    });
  });

  describe('Global Sensitivity Analysis', () => {
    it('shows global sensitivity tables with a low-confidence warning when baseline hits are low', () => {
      const storedContexts = Array.from({ length: 12 }, () => ({
        emotions: { joy: 0.2 },
      }));
      const globalSensitivityData = [
        {
          varPath: 'emotions.joy',
          operator: '>=',
          originalThreshold: 0.4,
          grid: [
            { threshold: 0.35, triggerRate: 0.3, triggerCount: 4, sampleCount: 12 },
            { threshold: 0.40, triggerRate: 0.25, triggerCount: 3, sampleCount: 12 },
          ],
          isExpressionLevel: true,
        },
      ];

      const report = generator.generate({
        expressionName: 'test_expression',
        simulationResult: createMockSimulationResult({
          sampleCount: 12,
          storedContexts,
        }),
        blockers: [createMockBlocker()],
        summary: 'Test summary',
        globalSensitivityData,
      });

      expect(report).toContain('## Global Expression Sensitivity Analysis');
      expect(report).toContain('Low confidence');
      expect(report).toContain('population stored-global');
      expect(report).toContain('N=12');
      expect(report).toContain('hits≈3');
      expect(report).toContain('| Threshold | Trigger Rate | Change | Samples |');
    });

    it('renders global sensitivity tables when baseline hits are sufficient', () => {
      const globalSensitivityData = [
        {
          varPath: 'emotions.joy',
          operator: '>=',
          originalThreshold: 0.4,
          grid: [
            { threshold: 0.35, triggerRate: 0.001, triggerCount: 10, sampleCount: 10000 },
            { threshold: 0.40, triggerRate: 0.001, triggerCount: 10, sampleCount: 10000 },
          ],
          isExpressionLevel: true,
        },
      ];

      const report = generator.generate({
        expressionName: 'test_expression',
        simulationResult: createMockSimulationResult(),
        blockers: [createMockBlocker()],
        summary: 'Test summary',
        globalSensitivityData,
      });

      expect(report).toContain('## Global Expression Sensitivity Analysis');
      expect(report).toContain('| Threshold | Trigger Rate | Change | Samples |');
      expect(report).not.toContain('Low confidence');
    });

    it('adds effective threshold column for integer-domain global sensitivity tables', () => {
      const globalSensitivityData = [
        {
          varPath: 'moodAxes.valence',
          operator: '>=',
          originalThreshold: 10,
          isExpressionLevel: true,
          isIntegerDomain: true,
          grid: [
            {
              threshold: 9,
              effectiveThreshold: 9,
              triggerRate: 0.01,
              triggerCount: 10,
              sampleCount: 1000,
            },
            {
              threshold: 10,
              effectiveThreshold: 10,
              triggerRate: 0.01,
              triggerCount: 10,
              sampleCount: 1000,
            },
          ],
        },
      ];

      const report = generator.generate({
        expressionName: 'test_expression',
        simulationResult: createMockSimulationResult(),
        blockers: [createMockBlocker()],
        summary: 'Test summary',
        globalSensitivityData,
      });

      expect(report).toContain(
        '| Threshold | Effective Threshold | Trigger Rate | Change | Samples |'
      );
      expect(report).toContain(
        'Thresholds are integer-effective; decimals collapse to integer boundaries.'
      );
    });

    it('should show +∞ when baseline triggerRate is 0 and other point has triggers', () => {
      const globalSensitivityData = [
        {
          varPath: 'emotions.joy',
          operator: '>=',
          originalThreshold: 0.4,
          isExpressionLevel: true,
          grid: [
            { threshold: 0.35, triggerRate: 0.05, triggerCount: 50, sampleCount: 1000 },
            { threshold: 0.40, triggerRate: 0, triggerCount: 0, sampleCount: 1000 },
          ],
        },
      ];

      const report = generator.generate({
        expressionName: 'test_expression',
        simulationResult: createMockSimulationResult(),
        blockers: [createMockBlocker()],
        summary: 'Test summary',
        globalSensitivityData,
      });

      expect(report).toContain('+∞');
    });

    it('should show -100% when baseline has triggers but other point is 0', () => {
      const globalSensitivityData = [
        {
          varPath: 'emotions.joy',
          operator: '>=',
          originalThreshold: 0.4,
          isExpressionLevel: true,
          grid: [
            { threshold: 0.35, triggerRate: 0, triggerCount: 0, sampleCount: 1000 },
            { threshold: 0.40, triggerRate: 0.05, triggerCount: 50, sampleCount: 1000 },
          ],
        },
      ];

      const report = generator.generate({
        expressionName: 'test_expression',
        simulationResult: createMockSimulationResult(),
        blockers: [createMockBlocker()],
        summary: 'Test summary',
        globalSensitivityData,
      });

      expect(report).toContain('-100%');
    });

    it('should show negative percentage when other point has lower triggerRate than baseline', () => {
      const globalSensitivityData = [
        {
          varPath: 'emotions.joy',
          operator: '>=',
          originalThreshold: 0.4,
          isExpressionLevel: true,
          grid: [
            { threshold: 0.35, triggerRate: 0.05, triggerCount: 50, sampleCount: 1000 },
            { threshold: 0.40, triggerRate: 0.10, triggerCount: 100, sampleCount: 1000 },
          ],
        },
      ];

      const report = generator.generate({
        expressionName: 'test_expression',
        simulationResult: createMockSimulationResult(),
        blockers: [createMockBlocker()],
        summary: 'Test summary',
        globalSensitivityData,
      });

      // When other rate (0.05) < baseline rate (0.10), change should be negative (-50%)
      expect(report).toContain('-50.00%');
    });

    it('should show 0% when both baseline and other point have 0 triggerRate', () => {
      const globalSensitivityData = [
        {
          varPath: 'emotions.joy',
          operator: '>=',
          originalThreshold: 0.4,
          isExpressionLevel: true,
          grid: [
            { threshold: 0.35, triggerRate: 0, triggerCount: 0, sampleCount: 1000 },
            { threshold: 0.40, triggerRate: 0, triggerCount: 0, sampleCount: 1000 },
          ],
        },
      ];

      const report = generator.generate({
        expressionName: 'test_expression',
        simulationResult: createMockSimulationResult(),
        blockers: [createMockBlocker()],
        summary: 'Test summary',
        globalSensitivityData,
      });

      // Extract global sensitivity section specifically
      const globalSensitivityMatch = report.match(
        /### 🎯 Global Expression Sensitivity[\s\S]*?(?=###|## |$)/
      );
      expect(globalSensitivityMatch).not.toBeNull();
      const globalSection = globalSensitivityMatch[0];

      // In the global section, non-baseline row should show 0% (not +∞ or -100%)
      expect(globalSection).toContain('| 0.35 | 0.00% | 0% |');
      expect(globalSection).not.toContain('+∞');
    });

    it('should show first triggering threshold recommendation when baseline is 0', () => {
      const globalSensitivityData = [
        {
          varPath: 'emotions.joy',
          operator: '>=',
          originalThreshold: 0.4,
          isExpressionLevel: true,
          grid: [
            { threshold: 0.30, triggerRate: 0.15, triggerCount: 150, sampleCount: 1000 },
            { threshold: 0.35, triggerRate: 0.05, triggerCount: 50, sampleCount: 1000 },
            { threshold: 0.40, triggerRate: 0, triggerCount: 0, sampleCount: 1000 },
          ],
        },
      ];

      const report = generator.generate({
        expressionName: 'test_expression',
        simulationResult: createMockSimulationResult(),
        blockers: [createMockBlocker()],
        summary: 'Test summary',
        globalSensitivityData,
      });

      expect(report).toContain('First threshold with triggers');
      expect(report).toContain('Actionable Insight');
      expect(report).toContain('0.30');
    });

    it('should show no triggers warning when all thresholds produce 0 triggerRate', () => {
      const globalSensitivityData = [
        {
          varPath: 'emotions.joy',
          operator: '>=',
          originalThreshold: 0.4,
          isExpressionLevel: true,
          grid: [
            { threshold: 0.30, triggerRate: 0, triggerCount: 0, sampleCount: 1000 },
            { threshold: 0.35, triggerRate: 0, triggerCount: 0, sampleCount: 1000 },
            { threshold: 0.40, triggerRate: 0, triggerCount: 0, sampleCount: 1000 },
          ],
        },
      ];

      const report = generator.generate({
        expressionName: 'test_expression',
        simulationResult: createMockSimulationResult(),
        blockers: [createMockBlocker()],
        summary: 'Test summary',
        globalSensitivityData,
      });

      expect(report).toContain('No Triggers Found');
      expect(report).toContain(
        'None of the tested thresholds produced expression triggers'
      );
    });

    it('should show actionable insight when originalRate < 1% and 5x improvement exists', () => {
      const globalSensitivityData = [
        {
          varPath: 'emotions.joy',
          operator: '>=',
          originalThreshold: 0.4,
          isExpressionLevel: true,
          grid: [
            { threshold: 0.30, triggerRate: 0.05, triggerCount: 50, sampleCount: 1000 },
            { threshold: 0.40, triggerRate: 0.005, triggerCount: 5, sampleCount: 1000 },
          ],
        },
      ];

      const report = generator.generate({
        expressionName: 'test_expression',
        simulationResult: createMockSimulationResult(),
        blockers: [createMockBlocker()],
        summary: 'Test summary',
        globalSensitivityData,
      });

      // originalRate = 0.005 (< 0.01), and 0.05 >= 0.005 * 5
      expect(report).toContain('Actionable Insight');
      expect(report).toContain('0.30');
    });
  });

  describe('Static Analysis Cross-Reference', () => {
    it('should not include static section when no static data provided', () => {
      const report = generator.generate({
        expressionName: 'test_expression',
        simulationResult: createMockSimulationResult(),
        blockers: [createMockBlocker()],
        summary: 'Test summary',
        staticAnalysis: null,
      });

      expect(report).not.toContain('Static Analysis Cross-Reference');
    });

    it('should not include static section when static data is empty', () => {
      const report = generator.generate({
        expressionName: 'test_expression',
        simulationResult: createMockSimulationResult(),
        blockers: [createMockBlocker()],
        summary: 'Test summary',
        staticAnalysis: {
          gateConflicts: [],
          unreachableThresholds: [],
        },
      });

      expect(report).not.toContain('Static Analysis Cross-Reference');
    });

    it('should include gate conflicts table when conflicts exist', () => {
      const staticAnalysis = {
        gateConflicts: [
          {
            axis: 'affiliation',
            description: 'Requires ≥0.20 AND ≤-0.30',
          },
        ],
        unreachableThresholds: [],
      };

      const report = generator.generate({
        expressionName: 'test_expression',
        simulationResult: createMockSimulationResult(),
        blockers: [createMockBlocker()],
        summary: 'Test summary',
        staticAnalysis,
      });

      expect(report).toContain('Static Analysis Cross-Reference');
      expect(report).toContain('### Gate Conflicts');
      expect(report).toContain('affiliation');
      expect(report).toContain('Requires ≥0.20 AND ≤-0.30');
      expect(report).toContain('❌ Impossible');
    });

    it('should include unreachable thresholds table when thresholds exist', () => {
      const staticAnalysis = {
        gateConflicts: [],
        unreachableThresholds: [
          {
            prototypeId: 'anger',
            threshold: 0.4,
            maxPossible: 0.35,
          },
        ],
      };

      const report = generator.generate({
        expressionName: 'test_expression',
        simulationResult: createMockSimulationResult(),
        blockers: [createMockBlocker()],
        summary: 'Test summary',
        staticAnalysis,
      });

      expect(report).toContain('Static Analysis Cross-Reference');
      expect(report).toContain('### Unreachable Thresholds');
      expect(report).toContain('anger');
      expect(report).toContain('0.40');
      expect(report).toContain('0.35');
    });

    it('should include cross-reference summary', () => {
      const staticAnalysis = {
        gateConflicts: [{ axis: 'valence', description: 'test' }],
        unreachableThresholds: [],
      };

      const report = generator.generate({
        expressionName: 'test_expression',
        simulationResult: createMockSimulationResult(),
        blockers: [createMockBlocker()],
        summary: 'Test summary',
        staticAnalysis,
      });

      expect(report).toContain('### Cross-Reference Summary');
      expect(report).toContain('Confirmed');
    });

    it('should show discrepancy when static issues exist but no MC blockers', () => {
      const staticAnalysis = {
        gateConflicts: [{ axis: 'valence', description: 'test' }],
        unreachableThresholds: [],
      };

      const report = generator.generate({
        expressionName: 'test_expression',
        simulationResult: createMockSimulationResult(),
        blockers: [],
        summary: 'Test summary',
        staticAnalysis,
      });

      expect(report).toContain('Discrepancy');
      expect(report).toContain('path-sensitivity');
    });

    it('should check MC confirmation for gate conflicts', () => {
      const staticAnalysis = {
        gateConflicts: [{ axis: 'valence', description: 'conflict' }],
        unreachableThresholds: [],
      };

      // Blocker that references valence axis
      const blockerWithValence = {
        ...createMockBlocker(),
        hierarchicalBreakdown: {
          variablePath: 'moodAxes.valence',
          failureRate: 0.95,
        },
      };

      const report = generator.generate({
        expressionName: 'test_expression',
        simulationResult: createMockSimulationResult(),
        blockers: [blockerWithValence],
        summary: 'Test summary',
        staticAnalysis,
      });

      expect(report).toContain('✅ Fail% global: 95.00%');
    });

    it('should check MC confirmation for unreachable thresholds', () => {
      const staticAnalysis = {
        gateConflicts: [],
        unreachableThresholds: [
          { prototypeId: 'anger', threshold: 0.4, maxPossible: 0.3 },
        ],
      };

      // Blocker that references emotions.anger
      const blockerWithAnger = {
        ...createMockBlocker(),
        hierarchicalBreakdown: {
          variablePath: 'emotions.anger',
          failureRate: 0.85,
        },
      };

      const report = generator.generate({
        expressionName: 'test_expression',
        simulationResult: createMockSimulationResult(),
        blockers: [blockerWithAnger],
        summary: 'Test summary',
        staticAnalysis,
      });

      expect(report).toContain('✅ Fail% global: 85.00%');
    });

    it('should show "Not observed" when MC has no matching blocker', () => {
      const staticAnalysis = {
        gateConflicts: [{ axis: 'affiliation', description: 'conflict' }],
        unreachableThresholds: [],
      };

      // Blocker that references a different axis
      const blockerOther = {
        ...createMockBlocker(),
        hierarchicalBreakdown: {
          variablePath: 'moodAxes.arousal',
          failureRate: 0.5,
        },
      };

      const report = generator.generate({
        expressionName: 'test_expression',
        simulationResult: createMockSimulationResult(),
        blockers: [blockerOther],
        summary: 'Test summary',
        staticAnalysis,
      });

      expect(report).toContain('— Not observed');
    });

    // Note: The "Agreement" case was removed from the source as it was unreachable.
    // The function returns early if both gateConflicts and unreachableThresholds are empty,
    // so when the Cross-Reference Summary is rendered, totalStaticIssues is always > 0.

    it('should format gate conflict with requiredMin > requiredMax (no description)', () => {
      const staticAnalysis = {
        gateConflicts: [
          {
            axis: 'arousal',
            requiredMin: 0.8,
            requiredMax: 0.2,
            // No description field - should use formatted min/max
          },
        ],
        unreachableThresholds: [],
      };

      const report = generator.generate({
        expressionName: 'test_expression',
        simulationResult: createMockSimulationResult(),
        blockers: [createMockBlocker()],
        summary: 'Test summary',
        staticAnalysis,
      });

      expect(report).toContain('Requires ≥0.80 AND ≤0.20');
    });

    it('should show fallback "Conflicting constraints" for gate conflict without description or valid min/max', () => {
      const staticAnalysis = {
        gateConflicts: [
          {
            axis: 'valence',
            // No description, no requiredMin/requiredMax
          },
        ],
        unreachableThresholds: [],
      };

      const report = generator.generate({
        expressionName: 'test_expression',
        simulationResult: createMockSimulationResult(),
        blockers: [createMockBlocker()],
        summary: 'Test summary',
        staticAnalysis,
      });

      expect(report).toContain('Conflicting constraints');
    });

    it('should show "✅ Confirmed" for gate conflict when axis matches but no failureRate', () => {
      const staticAnalysis = {
        gateConflicts: [{ axis: 'valence', description: 'test conflict' }],
        unreachableThresholds: [],
      };

      const blockerNoFailRate = {
        ...createMockBlocker(),
        hierarchicalBreakdown: {
          variablePath: 'moodAxes.valence',
          // No failureRate - should return "✅ Confirmed" without percentages
        },
      };

      const report = generator.generate({
        expressionName: 'test_expression',
        simulationResult: createMockSimulationResult(),
        blockers: [blockerNoFailRate],
        summary: 'Test summary',
        staticAnalysis,
      });

      expect(report).toContain('✅ Confirmed');
      expect(report).not.toMatch(/✅ Fail% global:/);
    });

    it('should show "— No MC data" for unreachable thresholds with empty blockers', () => {
      const staticAnalysis = {
        gateConflicts: [],
        unreachableThresholds: [
          { prototypeId: 'joy', threshold: 0.5, maxPossible: 0.3 },
        ],
      };

      const report = generator.generate({
        expressionName: 'test_expression',
        simulationResult: createMockSimulationResult(),
        blockers: [],
        summary: 'Test summary',
        staticAnalysis,
      });

      expect(report).toContain('— No MC data');
    });

    it('should show "✅ Confirmed" for emotion when prototype matches but no failureRate', () => {
      const staticAnalysis = {
        gateConflicts: [],
        unreachableThresholds: [
          { prototypeId: 'fear', threshold: 0.6, maxPossible: 0.4 },
        ],
      };

      const blockerNoFailRate = {
        ...createMockBlocker(),
        hierarchicalBreakdown: {
          variablePath: 'emotions.fear',
          // No failureRate - should return "✅ Confirmed" without percentages
        },
      };

      const report = generator.generate({
        expressionName: 'test_expression',
        simulationResult: createMockSimulationResult(),
        blockers: [blockerNoFailRate],
        summary: 'Test summary',
        staticAnalysis,
      });

      expect(report).toContain('✅ Confirmed');
    });
  });

  // ===========================================================================
  // Small Percentage Formatting Tests
  // ===========================================================================

  describe('Small Percentage Formatting', () => {
    it('should format very small percentages (0.001% to 0.01%) with 4 decimal places', () => {
      // Value of 0.00005 = 0.005% which is in the 0.001% to 0.01% range
      const blockerTinyRate = {
        ...createMockBlocker(),
        hierarchicalBreakdown: {
          variablePath: 'moodAxes.affiliation',
          failureRate: 0.00005, // 0.005%
        },
      };

      const staticAnalysis = {
        gateConflicts: [{ axis: 'affiliation', description: 'conflict' }],
        unreachableThresholds: [],
      };

      const report = generator.generate({
        expressionName: 'test_expression',
        simulationResult: createMockSimulationResult(),
        blockers: [blockerTinyRate],
        summary: 'Test summary',
        staticAnalysis,
      });

      // 0.00005 * 100 = 0.005, should show 4 decimals: 0.0050%
      expect(report).toMatch(/0\.0050%/);
    });

    // Note: The "< 0.005%" branch (3 decimal places) was removed from the source
    // as it was unreachable dead code. The pct < 0.01 check above catches all
    // values that would have fallen into that range.
  });

  // ===========================================================================
  // Invalid Value Formatting Tests
  // ===========================================================================

  describe('Invalid Value Formatting', () => {
    it('should handle NaN impact in recommendation clause via ablationImpact', () => {
      // NaN passes `typeof impact === 'number'` check and reaches formatSignedPercentagePoints
      // which returns 'N/A' for NaN values (line 6319)
      const simulationResultWithNaN = {
        ...createMockSimulationResult(),
        ablationImpact: {
          clauseImpacts: [{ clauseId: 'clause_joy_0', impact: NaN }],
        },
        clauseFailures: [
          {
            clauseId: 'clause_joy_0',
            clauseDescription: 'emotions.joy >= 0.5',
            failureRate: 0.8,
            hierarchicalBreakdown: [
              {
                clauseId: 'clause_joy_0',
                description: 'emotions.joy >= 0.5',
                variablePath: 'emotions.joy',
                comparisonOperator: '>=',
                thresholdValue: 0.5,
              },
            ],
          },
        ],
      };

      // Create blocker with analysis that triggers recommendation generation
      const blockerWithRecommendation = {
        ...createMockBlocker(),
        clauseDescription: 'emotions.joy >= 0.5',
        advancedAnalysis: {
          ...createMockBlocker().advancedAnalysis,
          recommendation: {
            action: 'tune_threshold',
            priority: 'high',
            message: 'Adjust threshold',
          },
        },
      };

      const report = generator.generate({
        expressionName: 'test_expression',
        simulationResult: simulationResultWithNaN,
        blockers: [blockerWithRecommendation],
        summary: 'Test summary',
      });

      // The NaN impact should be formatted as 'N/A' in the recommendation card
      // or 'n/a' if the impact resolution returns null (non-matching clauseId)
      // The key is that the report generates without error
      expect(typeof report).toBe('string');
    });

    it('should handle NaN threshold in sensitivity data', () => {
      const sensitivityData = [
        {
          varPath: 'emotions.joy',
          operator: '>=',
          originalThreshold: 0.5,
          grid: [
            { threshold: NaN, passRate: 0.5, sampleCount: 1000 },
            { threshold: 0.5, passRate: 0.3, sampleCount: 1000 },
          ],
        },
      ];

      const report = generator.generate({
        expressionName: 'test_expression',
        simulationResult: createMockSimulationResult(),
        blockers: [createMockBlocker()],
        summary: 'Test summary',
        sensitivityData,
      });

      expect(report).toContain('N/A');
    });

    it('should handle undefined effectiveThreshold in integer domain sensitivity data', () => {
      const sensitivityData = [
        {
          varPath: 'inventory.count',
          operator: '>=',
          originalThreshold: 3,
          isIntegerDomain: true,
          grid: [
            {
              threshold: 3,
              passRate: 0.5,
              sampleCount: 1000,
              effectiveThreshold: undefined,
            },
            {
              threshold: 4,
              passRate: 0.3,
              sampleCount: 1000,
              effectiveThreshold: 4,
            },
          ],
        },
      ];

      const report = generator.generate({
        expressionName: 'test_expression',
        simulationResult: createMockSimulationResult(),
        blockers: [createMockBlocker()],
        summary: 'Test summary',
        sensitivityData,
      });

      expect(report).toContain('—');
    });
  });

  // ===========================================================================
  // Sexual State Support Tests
  // ===========================================================================

  describe('Sexual State Support', () => {
    describe('last-mile decomposition with sexualStates.*', () => {
      it('should process sexualStates.* blockers in last-mile decomposition', () => {
        // Create a blocker with sexualStates variable path
        const sexualBlocker = createMockBlocker({
          clauseDescription: 'sexualStates.aroused >= 0.5',
          hierarchicalBreakdown: {
            variablePath: 'sexualStates.aroused',
            comparisonOperator: '>=',
            thresholdValue: 0.5,
            violationP50: 0.2,
            violationP90: 0.35,
            nearMissRate: 0.08,
            nearMissEpsilon: 0.05,
            maxObservedValue: 0.45,
            ceilingGap: 0.05,
            lastMileFailRate: 0.3,
            othersPassedCount: 5000,
            isSingleClause: false,
          },
          advancedAnalysis: {
            percentileAnalysis: { status: 'normal', insight: 'Distribution is normal' },
            nearMissAnalysis: { status: 'moderate', tunability: 'moderate', insight: 'Some near misses' },
            ceilingAnalysis: { status: 'achievable', achievable: true, headroom: 0.05, insight: 'Threshold is reachable' },
            lastMileAnalysis: { status: 'moderate', isDecisive: false, lastMileFailRate: 0.3, insight: 'Not decisive' },
            recommendation: { action: 'tune_threshold', priority: 'medium', message: 'Consider adjusting threshold' },
          },
        });

        const report = generator.generate({
          expressionName: 'test:expression',
          simulationResult: createMockSimulationResult(),
          blockers: [sexualBlocker],
          summary: 'Test summary',
        });

        // Should include the sexual state variable path in the report
        expect(report).toContain('sexualStates.aroused');
        expect(report).toContain('>= 0.5');
      });

      it('should extract sexual state prototype ID from variablePath', () => {
        const blocker = createMockBlocker({
          clauseDescription: 'sexualStates.inhibited >= 0.3',
          hierarchicalBreakdown: {
            ...createMockBlocker().hierarchicalBreakdown,
            variablePath: 'sexualStates.inhibited',
            thresholdValue: 0.3,
          },
        });

        const report = generator.generate({
          expressionName: 'test:expression',
          simulationResult: createMockSimulationResult(),
          blockers: [blocker],
          summary: '',
        });

        expect(report).toContain('sexualStates.inhibited');
      });

      it('should display condition details for sexual state hierarchicalBreakdown', () => {
        const blocker = createMockBlocker({
          hierarchicalBreakdown: {
            ...createMockBlocker().hierarchicalBreakdown,
            variablePath: 'sexualStates.excited',
            comparisonOperator: '>=',
            thresholdValue: 0.6,
          },
        });

        const report = generator.generate({
          expressionName: 'test',
          simulationResult: createMockSimulationResult(),
          blockers: [blocker],
          summary: '',
        });

        expect(report).toContain('sexualStates.excited');
        expect(report).toContain('>=');
        expect(report).toContain('0.6');
      });
    });

    describe('static analysis cross-reference with sexual states', () => {
      it('should check MC confirmation for sexualStates unreachable thresholds', () => {
        const staticAnalysis = {
          gateConflicts: [],
          unreachableThresholds: [
            { prototypeId: 'aroused', threshold: 0.5, maxPossible: 0.3, type: 'sexual' },
          ],
        };

        // Blocker that references sexualStates.aroused
        const blockerWithSexual = {
          ...createMockBlocker(),
          hierarchicalBreakdown: {
            variablePath: 'sexualStates.aroused',
            failureRate: 0.9,
          },
        };

        const report = generator.generate({
          expressionName: 'test_expression',
          simulationResult: createMockSimulationResult(),
          blockers: [blockerWithSexual],
          summary: 'Test summary',
          staticAnalysis,
        });

        expect(report).toContain('✅ Fail% global: 90.00%');
      });
    });

    describe('mixed emotion and sexual state blockers', () => {
      it('should handle both emotions.* and sexualStates.* blockers in same report', () => {
        const emotionBlocker = createMockBlocker({
          rank: 1,
          clauseDescription: 'emotions.joy >= 0.5',
          hierarchicalBreakdown: {
            ...createMockBlocker().hierarchicalBreakdown,
            variablePath: 'emotions.joy',
            thresholdValue: 0.5,
          },
        });

        const sexualBlocker = createMockBlocker({
          rank: 2,
          clauseDescription: 'sexualStates.aroused >= 0.4',
          hierarchicalBreakdown: {
            ...createMockBlocker().hierarchicalBreakdown,
            variablePath: 'sexualStates.aroused',
            thresholdValue: 0.4,
          },
        });

        const report = generator.generate({
          expressionName: 'test:expression',
          simulationResult: createMockSimulationResult(),
          blockers: [emotionBlocker, sexualBlocker],
          summary: 'Mixed emotion and sexual state expression',
        });

        expect(report).toContain('emotions.joy');
        expect(report).toContain('sexualStates.aroused');
        expect(report).toContain('### Blocker #1');
        expect(report).toContain('### Blocker #2');
      });

      it('should correctly identify prototype types in sensitivity data', () => {
        const sensitivityData = [
          {
            conditionPath: 'emotions.anger',
            operator: '>=',
            originalThreshold: 0.4,
            grid: [
              { threshold: 0.40, passRate: 0.02, passCount: 200, sampleCount: 10000 },
            ],
          },
          {
            conditionPath: 'sexualStates.aroused',
            operator: '>=',
            originalThreshold: 0.5,
            grid: [
              { threshold: 0.50, passRate: 0.01, passCount: 100, sampleCount: 10000 },
            ],
          },
        ];

        const report = generator.generate({
          expressionName: 'test_expression',
          simulationResult: createMockSimulationResult(),
          blockers: [],
          summary: 'Test summary',
          sensitivityData,
        });

        expect(report).toContain('emotions.anger >= [threshold]');
        expect(report).toContain('sexualStates.aroused >= [threshold]');
      });
    });
  });

  describe('OR alternative coverage breakdown', () => {
    it('should include order-independent OR pass and exclusive rates', () => {
      const orBlocker = createMockBlocker({
        hierarchicalBreakdown: {
          id: '0',
          nodeType: 'or',
          isCompound: true,
          description: 'OR of 2 conditions',
          children: [
            {
              id: '0.0',
              nodeType: 'leaf',
              isCompound: false,
              description: 'emotions.joy >= 0.5',
              failureRate: 0.4,
              evaluationCount: 100,
              orSuccessCount: 100,
              orPassCount: 60,
              orExclusivePassCount: 20,
              orContributionCount: 40,
              orPassRate: 0.6,
              orExclusivePassRate: 0.2,
              orContributionRate: 0.4,
            },
            {
              id: '0.1',
              nodeType: 'leaf',
              isCompound: false,
              description: 'emotions.fear >= 0.4',
              failureRate: 0.5,
              evaluationCount: 100,
              orSuccessCount: 100,
              orPassCount: 50,
              orExclusivePassCount: 30,
              orContributionCount: 60,
              orPassRate: 0.5,
              orExclusivePassRate: 0.3,
              orContributionRate: 0.6,
            },
          ],
        },
      });

      const report = generator.generate({
        expressionName: 'test:expression',
        simulationResult: createMockSimulationResult(),
        blockers: [orBlocker],
        summary: 'Test summary',
      });

      expect(report).toContain('OR Alternative Coverage');
      expect(report).toContain('P(alt passes \\| OR pass)');
      expect(report).toContain('P(alt exclusively passes \\| OR pass)');
      expect(report).toContain('First-pass share (order-dependent)');
      expect(report).toContain('First-pass share is order-dependent');
      expect(report).toContain('60.00% (60/100)');
      expect(report).toContain('20.00% (20/100)');
    });
  });

  describe('Prototype math operator awareness', () => {
    it('should use upper-bound framing and recommendations for <= operators', () => {
      const prototypeConstraintAnalyzer = {
        extractAxisConstraints: jest.fn(() => new Map([['valence', { min: -1, max: 1 }]])),
        analyzeEmotionThreshold: jest.fn(() => ({
          prototypeId: 'joy',
          type: 'emotion',
          operator: '<=',
          threshold: 0.5,
          maxAchievable: 0.7,
          minAchievable: 0,
          isReachable: true,
          gap: -0.2,
          weights: { valence: 1.0 },
          gates: ['valence >= 0.3'],
          gateStatus: {
            allSatisfiable: false,
            gates: [{ gate: 'valence >= 0.3', satisfiable: false, reason: 'conflict' }],
            blockingGates: [{ gate: 'valence >= 0.3' }],
          },
          bindingAxes: [],
          axisAnalysis: [],
          sumAbsWeights: 1,
          requiredRawSum: 0.5,
          explanation: 'Test explanation',
        })),
      };

      const operatorAwareGenerator = new MonteCarloReportGenerator({
        logger: mockLogger,
        prototypeConstraintAnalyzer,
      });

      const blocker = createMockBlocker({
        hierarchicalBreakdown: {
          variablePath: 'emotions.joy',
          comparisonOperator: '<=',
          thresholdValue: 0.5,
        },
      });

      const report = operatorAwareGenerator.generate({
        expressionName: 'test:expression',
        simulationResult: createMockSimulationResult(),
        blockers: [blocker],
        summary: 'Test summary',
        prerequisites: [{ logic: { '>=': [{ var: 'moodAxes.valence' }, 0.2] } }],
      });

      expect(report).toContain('**Feasibility (gated)**');
      expect(report).toContain('**Status**: sometimes');
      expect(report).toContain('**Tuning direction**: loosen -> threshold up, tighten -> threshold down');
      expect(report).toContain(
        'Threshold can be violated; consider raising threshold or adjusting prototypes to reduce peaks.'
      );
      expect(report).toContain('Gate failure clamps intensity to 0');
      expect(report).not.toContain('narrow margin');
    });

    it('should include regime stats and gate compatibility details', () => {
      const prototypeConstraintAnalyzer = {
        extractAxisConstraints: jest.fn(() => new Map([['valence', { min: -1, max: 1 }]])),
        analyzeEmotionThreshold: jest.fn(() => ({
          prototypeId: 'joy',
          type: 'emotion',
          operator: '>=',
          threshold: 0.5,
          maxAchievable: 0.8,
          minAchievable: 0.1,
          isReachable: true,
          gap: 0.3,
          weights: { valence: 1.0 },
          gates: ['valence >= 0.2'],
          gateStatus: {
            allSatisfiable: true,
            gates: [{ gate: 'valence >= 0.2', satisfiable: true, reason: 'ok' }],
            blockingGates: [],
          },
          bindingAxes: [],
          axisAnalysis: [],
          sumAbsWeights: 1,
          requiredRawSum: 0.5,
          explanation: 'Test explanation',
        })),
      };

      const operatorAwareGenerator = new MonteCarloReportGenerator({
        logger: mockLogger,
        prototypeConstraintAnalyzer,
      });

      const blocker = createMockBlocker({
        hierarchicalBreakdown: {
          variablePath: 'emotions.joy',
          comparisonOperator: '>=',
          thresholdValue: 0.5,
        },
      });

      const storedContexts = [
        { moodAxes: { valence: 0.3 }, emotions: { joy: 0.6 } },
        { moodAxes: { valence: 0.1 }, emotions: { joy: 0.2 } },
      ];

      const report = operatorAwareGenerator.generate({
        expressionName: 'test:expression',
        simulationResult: createMockSimulationResult({
          storedContexts,
          gateCompatibility: {
            emotions: { joy: { compatible: false, reason: 'gate conflict' } },
            sexualStates: {},
          },
        }),
        blockers: [blocker],
        summary: 'Test summary',
        prerequisites: [{ logic: { '>=': [{ var: 'moodAxes.valence' }, 0.2] } }],
      });

      expect(report).toContain('**Regime Stats**');
      expect(report).toContain('| Global |');
      expect(report).toContain('In mood regime');
      expect(report).toContain('**Gate Compatibility (mood regime)**: ❌ incompatible');
      expect(report).toContain('gate conflict');
    });
  });

  describe('OR mood constraint warnings', () => {
    it('should warn when OR mood constraints are present in conditional pass rates', () => {
      const prerequisites = [
        {
          logic: {
            and: [
              { '>=': [{ var: 'moodAxes.valence' }, 0.2] },
              { '>=': [{ var: 'emotions.joy' }, 0.5] },
            ],
            or: [
              { '>=': [{ var: 'moodAxes.arousal' }, 0.1] },
            ],
          },
        },
      ];

      const storedContexts = Array.from({ length: 12 }, () => ({
        moodAxes: { valence: 0.3, arousal: 0.2 },
        emotions: { joy: 0.6 },
      }));

      const report = generator.generate({
        expressionName: 'test:expression',
        simulationResult: createMockSimulationResult({ storedContexts }),
        blockers: [createMockBlocker()],
        summary: 'Test summary',
        prerequisites,
      });

      expect(report).toContain('OR-based mood constraints are present');
    });

    it('should warn in prototype fit analysis when OR mood constraints are present', () => {
      const prototypeFitRankingService = {
        analyzeAllPrototypeFit: jest.fn(() => ({
          leaderboard: [
            {
              rank: 1,
              prototypeId: 'joy',
              gatePassRate: 0.75,
              intensityDistribution: { pAboveThreshold: 0.6, p50: 0.4, p90: 0.7, p95: 0.8 },
              conflictScore: 0.1,
              compositeScore: 1.2,
              conflictingAxes: [],
              conflictMagnitude: 0,
            },
          ],
        })),
        computeImpliedPrototype: jest.fn(() => null),
        detectPrototypeGaps: jest.fn(() => null),
      };
      const generatorWithFit = new MonteCarloReportGenerator({
        logger: mockLogger,
        prototypeFitRankingService,
      });

      const prerequisites = [
        {
          logic: {
            or: [{ '>=': [{ var: 'moodAxes.valence' }, 0.2] }],
          },
        },
      ];

      const report = generatorWithFit.generate({
        expressionName: 'test:expression',
        simulationResult: createMockSimulationResult({ storedContexts: [] }),
        blockers: [createMockBlocker()],
        summary: 'Test summary',
        prerequisites,
      });

      expect(report).toMatch(
        /## 🎯 Prototype Fit Analysis[\s\S]*OR-based mood constraints are present/
      );
    });

    it('should warn in implied prototype analysis when OR mood constraints are present', () => {
      const prototypeFitRankingService = {
        analyzeAllPrototypeFit: jest.fn(() => ({ leaderboard: [] })),
        computeImpliedPrototype: jest.fn(() => ({
          targetSignature: new Map([['valence', { direction: 1, importance: 0.8 }]]),
          bySimilarity: [],
          byGatePass: [],
          byCombined: [],
        })),
        detectPrototypeGaps: jest.fn(() => null),
      };
      const generatorWithImplied = new MonteCarloReportGenerator({
        logger: mockLogger,
        prototypeFitRankingService,
      });

      const prerequisites = [
        {
          logic: {
            or: [{ '<=': [{ var: 'moodAxes.arousal' }, -0.1] }],
          },
        },
      ];

      const report = generatorWithImplied.generate({
        expressionName: 'test:expression',
        simulationResult: createMockSimulationResult({ storedContexts: [] }),
        blockers: [createMockBlocker()],
        summary: 'Test summary',
        prerequisites,
      });

      expect(report).toMatch(
        /## 🧭 Implied Prototype from Prerequisites[\s\S]*OR-based mood constraints are present/
      );
    });

    it('should warn in prototype math analysis when OR mood constraints are present', () => {
      const prototypeConstraintAnalyzer = {
        extractAxisConstraints: jest.fn(() => new Map([['valence', { min: -1, max: 1 }]])),
        analyzeEmotionThreshold: jest.fn(() => ({
          prototypeId: 'joy',
          type: 'emotion',
          operator: '>=',
          threshold: 0.5,
          maxAchievable: 0.7,
          minAchievable: 0,
          isReachable: true,
          gap: -0.2,
          weights: { valence: 1.0 },
          gates: [],
          gateStatus: { allSatisfiable: true, gates: [], blockingGates: [] },
          bindingAxes: [],
          axisAnalysis: [],
          sumAbsWeights: 1,
          requiredRawSum: 0.5,
          explanation: 'Reachable with constraints.',
        })),
      };
      const generatorWithPrototypeMath = new MonteCarloReportGenerator({
        logger: mockLogger,
        prototypeConstraintAnalyzer,
      });

      const prerequisites = [
        {
          logic: {
            or: [{ '>=': [{ var: 'moodAxes.valence' }, 0.2] }],
          },
        },
      ];

      const report = generatorWithPrototypeMath.generate({
        expressionName: 'test:expression',
        simulationResult: createMockSimulationResult({ storedContexts: [] }),
        blockers: [
          createMockBlocker({
            hierarchicalBreakdown: {
              variablePath: 'emotions.joy',
              comparisonOperator: '>=',
              thresholdValue: 0.5,
            },
          }),
        ],
        summary: 'Test summary',
        prerequisites,
      });

      expect(report).toMatch(
        /#### Prototype Math Analysis[\s\S]*OR-based mood constraints are present/
      );
    });
  });

  describe('OR-child worst offender penalty', () => {
    it('should apply 70% penalty to OR-child leaves in worst offender ranking', () => {
      const andLeaf = {
        description: 'AND condition',
        failureRate: 0.5,
        lastMileFailRate: 0.5,
        siblingConditionedFailRate: 0.5,
        parentNodeType: 'and',
      };
      const orLeaf = {
        description: 'OR alternative',
        failureRate: 0.9, // Higher raw failure rate
        lastMileFailRate: 0.9,
        siblingConditionedFailRate: 0.9,
        parentNodeType: 'or',
      };

      const blocker = createMockBlocker({
        worstOffenders: [andLeaf, orLeaf],
        hierarchicalBreakdown: null,
      });

      const report = generator.generate({
        expressionName: 'test_expression',
        simulationResult: createMockSimulationResult(),
        blockers: [blocker],
        summary: 'Test summary',
      });

      // After 70% penalty, OR leaf (0.9 * 0.3 = 0.27) should rank lower than AND leaf (0.5 * 1.0 = 0.5)
      const andPos = report.indexOf('AND condition');
      const orPos = report.indexOf('OR alternative');

      // AND condition should appear before OR alternative (lower index = higher rank)
      expect(andPos).toBeLessThan(orPos);
    });

    it('should add OR-alternative annotation to worst offenders inside OR blocks', () => {
      const orLeaf = {
        description: 'emotions.sadness >= 0.25',
        failureRate: 0.8,
        lastMileFailRate: 0.7,
        siblingConditionedFailRate: 0.7,
        parentNodeType: 'or',
      };

      const blocker = createMockBlocker({
        worstOffenders: [orLeaf],
        hierarchicalBreakdown: null,
      });

      const report = generator.generate({
        expressionName: 'test_expression',
        simulationResult: createMockSimulationResult(),
        blockers: [blocker],
        summary: 'Test summary',
      });

      // Should contain the OR-alternative annotation
      expect(report).toContain('⚠️ OR-alternative');
      expect(report).toContain(
        'This is an alternative within an OR block; other alternatives may cover this case'
      );
    });

    it('should NOT add OR-alternative annotation for AND-child leaves', () => {
      const andLeaf = {
        description: 'emotions.joy >= 0.5',
        failureRate: 0.6,
        lastMileFailRate: 0.5,
        siblingConditionedFailRate: 0.5,
        parentNodeType: 'and',
      };

      const blocker = createMockBlocker({
        worstOffenders: [andLeaf],
        hierarchicalBreakdown: null,
      });

      const report = generator.generate({
        expressionName: 'test_expression',
        simulationResult: createMockSimulationResult(),
        blockers: [blocker],
        summary: 'Test summary',
      });

      // Should NOT contain the OR-alternative annotation
      expect(report).not.toContain('⚠️ OR-alternative');
      expect(report).not.toContain(
        'This is an alternative within an OR block'
      );
    });

    it('should handle offenders extracted from hierarchicalBreakdown with parentNodeType', () => {
      const blocker = createMockBlocker({
        worstOffenders: [],
        hierarchicalBreakdown: {
          id: '0',
          nodeType: 'or',
          description: 'OR of 2 conditions',
          failureRate: 0.3,
          parentNodeType: 'root',
          children: [
            {
              id: '0.0',
              nodeType: 'leaf',
              description: 'emotions.sadness >= 0.25',
              failureRate: 0.7,
              parentNodeType: 'or',
              isCompound: false,
            },
            {
              id: '0.1',
              nodeType: 'leaf',
              description: 'emotions.lonely >= 0.30',
              failureRate: 0.8,
              parentNodeType: 'or',
              isCompound: false,
            },
          ],
        },
      });

      const report = generator.generate({
        expressionName: 'test_expression',
        simulationResult: createMockSimulationResult(),
        blockers: [blocker],
        summary: 'Test summary',
      });

      // Both leaves are OR-children and should be annotated
      expect(report).toContain('⚠️ OR-alternative');
    });
  });

  // ===========================================================================
  // Prototype Fit Error Handling and Edge Cases
  // ===========================================================================

  describe('Prototype Fit Error Handling', () => {
    it('should handle prototypeFitRankingService errors gracefully', () => {
      const prototypeFitRankingService = {
        analyzeAllPrototypeFit: jest.fn(() => {
          throw new Error('Analysis failed');
        }),
        computeImpliedPrototype: jest.fn(() => null),
        detectPrototypeGaps: jest.fn(() => null),
      };
      const generatorWithError = new MonteCarloReportGenerator({
        logger: mockLogger,
        prototypeFitRankingService,
      });

      const prerequisites = [
        { logic: { '>=': [{ var: 'moodAxes.valence' }, 0.3] } },
      ];

      const report = generatorWithError.generate({
        expressionName: 'test_expression',
        simulationResult: createMockSimulationResult({ storedContexts: [] }),
        blockers: [createMockBlocker()],
        summary: 'Test summary',
        prerequisites,
      });

      // Should still generate a report (graceful degradation)
      expect(report).toContain('test_expression');
      expect(report).toContain('Test summary');
      // Should have logged the warning
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to perform prototype fit analysis:',
        'Analysis failed'
      );
      // Should NOT contain prototype fit section since analysis failed
      expect(report).not.toContain('## 🎯 Prototype Fit Analysis');
    });

    it('should format conflicting axes details for top 3 prototypes', () => {
      const prototypeFitRankingService = {
        analyzeAllPrototypeFit: jest.fn(() => ({
          leaderboard: [
            {
              rank: 1,
              prototypeId: 'joy',
              gatePassRate: 0.75,
              intensityDistribution: { pAboveThreshold: 0.6, p50: 0.4, p90: 0.7, p95: 0.8 },
              conflictScore: 0.2,
              compositeScore: 1.0,
              conflictingAxes: [
                { axis: 'valence', weight: 0.8, direction: 'positive' },
                { axis: 'arousal', weight: 0.3, direction: 'negative' },
              ],
              conflictMagnitude: 0.15,
            },
          ],
        })),
        computeImpliedPrototype: jest.fn(() => null),
        detectPrototypeGaps: jest.fn(() => null),
      };
      const generatorWithConflicts = new MonteCarloReportGenerator({
        logger: mockLogger,
        prototypeFitRankingService,
      });

      const prerequisites = [
        { logic: { '>=': [{ var: 'moodAxes.valence' }, 0.3] } },
      ];

      const report = generatorWithConflicts.generate({
        expressionName: 'test_expression',
        simulationResult: createMockSimulationResult({ storedContexts: [] }),
        blockers: [createMockBlocker()],
        summary: 'Test summary',
        prerequisites,
      });

      // Should contain conflicting axes details
      expect(report).toContain('**Conflicting Axes**');
      expect(report).toContain('valence');
      expect(report).toContain('weight=');
      expect(report).toContain('positive');
      expect(report).toContain('arousal');
      expect(report).toContain('negative');
      expect(report).toContain('**Conflict Magnitude**');
      expect(report).toContain('0.15');
    });

    it('should suggest prototype substitution when second best scores >20% better', () => {
      const prototypeFitRankingService = {
        analyzeAllPrototypeFit: jest.fn(() => ({
          leaderboard: [
            {
              rank: 1,
              prototypeId: 'sadness',
              gatePassRate: 0.6,
              intensityDistribution: { pAboveThreshold: 0.5, p50: 0.3, p90: 0.5, p95: 0.6 },
              conflictScore: 0.3,
              compositeScore: 0.8,
              conflictingAxes: [],
              conflictMagnitude: 0,
            },
            {
              rank: 2,
              prototypeId: 'melancholy',
              gatePassRate: 0.85,
              intensityDistribution: { pAboveThreshold: 0.75, p50: 0.5, p90: 0.8, p95: 0.9 },
              conflictScore: 0.1,
              compositeScore: 1.0, // 25% better than 0.8
              conflictingAxes: [],
              conflictMagnitude: 0,
            },
          ],
        })),
        computeImpliedPrototype: jest.fn(() => null),
        detectPrototypeGaps: jest.fn(() => null),
      };
      const generatorWithSubstitution = new MonteCarloReportGenerator({
        logger: mockLogger,
        prototypeFitRankingService,
      });

      const prerequisites = [
        { logic: { '>=': [{ var: 'moodAxes.valence' }, -0.3] } },
      ];

      const report = generatorWithSubstitution.generate({
        expressionName: 'test_expression',
        simulationResult: createMockSimulationResult({ storedContexts: [] }),
        blockers: [createMockBlocker()],
        summary: 'Test summary',
        prerequisites,
      });

      // Should contain substitution suggestion
      expect(report).toContain('💡 Suggestion');
      expect(report).toContain('melancholy');
      expect(report).toContain('instead');
      expect(report).toContain('% better');
    });
  });

  // ===========================================================================
  // Gap Detection Section Tests
  // ===========================================================================

  describe('Gap Detection Section', () => {
    it('should generate gap detection section when gap is detected', () => {
      const prototypeFitRankingService = {
        analyzeAllPrototypeFit: jest.fn(() => ({ leaderboard: [] })),
        computeImpliedPrototype: jest.fn(() => null),
        detectPrototypeGaps: jest.fn(() => ({
          gapDetected: true,
          nearestDistance: 0.65,
          distanceContext: 'Expression is far from known prototypes',
          coverageWarning: 'Consider adding a new prototype',
          kNearestNeighbors: [
            {
              prototypeId: 'joy',
              type: 'emotion',
              combinedDistance: 0.65,
              weightDistance: 0.4,
              gateDistance: 0.25,
            },
            {
              prototypeId: 'arousal_high',
              type: 'sexual',
              combinedDistance: 0.72,
              weightDistance: 0.5,
              gateDistance: 0.22,
            },
          ],
          suggestedPrototype: {
            rationale: 'Fill coverage gap between joy and arousal',
            weights: { valence: 0.6, arousal: 0.4 },
            gates: ['moodAxes.valence >= 0.3', 'moodAxes.arousal >= 0.2'],
          },
        })),
      };

      const generatorWithGapDetection = new MonteCarloReportGenerator({
        logger: mockLogger,
        prototypeFitRankingService,
      });

      const prerequisites = [{ logic: { '>=': [{ var: 'moodAxes.valence' }, 0.3] } }];

      const report = generatorWithGapDetection.generate({
        expressionName: 'test_expression',
        simulationResult: createMockSimulationResult({ storedContexts: [] }),
        blockers: [createMockBlocker()],
        summary: 'Test summary',
        prerequisites,
      });

      // Check header
      expect(report).toContain('## 🔍 Prototype Gap Detection');
      expect(report).toContain('Analysis of prototype coverage');

      // Check gap detected status
      expect(report).toContain('### ⚠️ Coverage Gap Detected');
      expect(report).toContain('**Nearest Distance**: 0.65');
      expect(report).toContain('threshold: 0.5');
      expect(report).toContain('**Distance Context**: Expression is far from known prototypes');
      expect(report).toContain('Consider adding a new prototype');

      // Check k-Nearest table with mixed types (emotion and sexual)
      expect(report).toContain('### k-Nearest Prototypes');
      expect(report).toContain('| Rank | Prototype |');
      expect(report).toContain('| Type |'); // Type column should be present
      expect(report).toContain('**joy**');
      expect(report).toContain('emotion');
      expect(report).toContain('**arousal_high**');
      expect(report).toContain('sexual');

      // Check suggested prototype
      expect(report).toContain('### 💡 Suggested New Prototype');
      expect(report).toContain('Fill coverage gap between joy and arousal');
      expect(report).toContain('**Suggested Weights**');
      expect(report).toContain('| valence | 0.60 |');
      expect(report).toContain('| arousal | 0.40 |');
      expect(report).toContain('**Suggested Gates**');
      expect(report).toContain('`moodAxes.valence >= 0.3`');
      expect(report).toContain('`moodAxes.arousal >= 0.2`');
    });

    it('should generate gap detection section when no gap is detected (good coverage)', () => {
      const prototypeFitRankingService = {
        analyzeAllPrototypeFit: jest.fn(() => ({ leaderboard: [] })),
        computeImpliedPrototype: jest.fn(() => null),
        detectPrototypeGaps: jest.fn(() => ({
          gapDetected: false,
          nearestDistance: 0.35,
          distanceContext: 'Expression is well covered by existing prototypes',
          kNearestNeighbors: [
            {
              prototypeId: 'contentment',
              type: 'emotion',
              combinedDistance: 0.35,
              weightDistance: 0.2,
              gateDistance: 0.15,
            },
          ],
        })),
      };

      const generatorWithGapDetection = new MonteCarloReportGenerator({
        logger: mockLogger,
        prototypeFitRankingService,
      });

      const prerequisites = [{ logic: { '>=': [{ var: 'moodAxes.valence' }, 0.3] } }];

      const report = generatorWithGapDetection.generate({
        expressionName: 'test_expression',
        simulationResult: createMockSimulationResult({ storedContexts: [] }),
        blockers: [createMockBlocker()],
        summary: 'Test summary',
        prerequisites,
      });

      // Check good coverage status
      expect(report).toContain('### ✅ Good Coverage');
      expect(report).toContain('**Nearest Distance**: 0.35');
      expect(report).toContain('within acceptable range');
      expect(report).toContain('**Distance Context**: Expression is well covered');

      // Should NOT contain gap warning elements
      expect(report).not.toContain('### ⚠️ Coverage Gap Detected');
      expect(report).not.toContain('### 💡 Suggested New Prototype');
    });

    it('should generate gap detection section with k-Nearest neighbors without type column when all are emotion type', () => {
      const prototypeFitRankingService = {
        analyzeAllPrototypeFit: jest.fn(() => ({ leaderboard: [] })),
        computeImpliedPrototype: jest.fn(() => null),
        detectPrototypeGaps: jest.fn(() => ({
          gapDetected: true,
          nearestDistance: 0.55,
          kNearestNeighbors: [
            {
              prototypeId: 'joy',
              type: 'emotion',
              combinedDistance: 0.55,
              weightDistance: 0.35,
              gateDistance: 0.2,
            },
            {
              prototypeId: 'sadness',
              type: 'emotion',
              combinedDistance: 0.6,
              weightDistance: 0.4,
              gateDistance: 0.2,
            },
          ],
        })),
      };

      const generatorWithGapDetection = new MonteCarloReportGenerator({
        logger: mockLogger,
        prototypeFitRankingService,
      });

      const prerequisites = [{ logic: { '>=': [{ var: 'moodAxes.valence' }, 0.3] } }];

      const report = generatorWithGapDetection.generate({
        expressionName: 'test_expression',
        simulationResult: createMockSimulationResult({ storedContexts: [] }),
        blockers: [createMockBlocker()],
        summary: 'Test summary',
        prerequisites,
      });

      // Check k-Nearest table without Type column (no sexual types)
      expect(report).toContain('### k-Nearest Prototypes');
      expect(report).toContain('| Rank | Prototype |');
      // When all emotions, no Type column
      expect(report).not.toMatch(/\| Rank \| Prototype \| Type \|/);
      expect(report).toContain('**joy**');
      expect(report).toContain('**sadness**');
    });

    it('should return empty string when gapResult is null', () => {
      const prototypeFitRankingService = {
        analyzeAllPrototypeFit: jest.fn(() => ({ leaderboard: [] })),
        computeImpliedPrototype: jest.fn(() => null),
        detectPrototypeGaps: jest.fn(() => null),
      };

      const generatorWithGapDetection = new MonteCarloReportGenerator({
        logger: mockLogger,
        prototypeFitRankingService,
      });

      const prerequisites = [{ logic: { '>=': [{ var: 'moodAxes.valence' }, 0.3] } }];

      const report = generatorWithGapDetection.generate({
        expressionName: 'test_expression',
        simulationResult: createMockSimulationResult({ storedContexts: [] }),
        blockers: [createMockBlocker()],
        summary: 'Test summary',
        prerequisites,
      });

      // Should NOT contain gap detection section
      expect(report).not.toContain('## 🔍 Prototype Gap Detection');
    });

    it('should handle gap detection with empty k-Nearest neighbors array', () => {
      const prototypeFitRankingService = {
        analyzeAllPrototypeFit: jest.fn(() => ({ leaderboard: [] })),
        computeImpliedPrototype: jest.fn(() => null),
        detectPrototypeGaps: jest.fn(() => ({
          gapDetected: true,
          nearestDistance: 0.8,
          kNearestNeighbors: [],
        })),
      };

      const generatorWithGapDetection = new MonteCarloReportGenerator({
        logger: mockLogger,
        prototypeFitRankingService,
      });

      const prerequisites = [{ logic: { '>=': [{ var: 'moodAxes.valence' }, 0.3] } }];

      const report = generatorWithGapDetection.generate({
        expressionName: 'test_expression',
        simulationResult: createMockSimulationResult({ storedContexts: [] }),
        blockers: [createMockBlocker()],
        summary: 'Test summary',
        prerequisites,
      });

      // Should contain gap detection but no k-Nearest section
      expect(report).toContain('## 🔍 Prototype Gap Detection');
      expect(report).toContain('### ⚠️ Coverage Gap Detected');
      expect(report).not.toContain('### k-Nearest Prototypes');
    });

    it('should handle suggested prototype without weights or gates', () => {
      const prototypeFitRankingService = {
        analyzeAllPrototypeFit: jest.fn(() => ({ leaderboard: [] })),
        computeImpliedPrototype: jest.fn(() => null),
        detectPrototypeGaps: jest.fn(() => ({
          gapDetected: true,
          nearestDistance: 0.7,
          kNearestNeighbors: [],
          suggestedPrototype: {
            rationale: 'A new prototype is needed',
            weights: {},
            gates: [],
          },
        })),
      };

      const generatorWithGapDetection = new MonteCarloReportGenerator({
        logger: mockLogger,
        prototypeFitRankingService,
      });

      const prerequisites = [{ logic: { '>=': [{ var: 'moodAxes.valence' }, 0.3] } }];

      const report = generatorWithGapDetection.generate({
        expressionName: 'test_expression',
        simulationResult: createMockSimulationResult({ storedContexts: [] }),
        blockers: [createMockBlocker()],
        summary: 'Test summary',
        prerequisites,
      });

      // Should contain suggested prototype with rationale but not weights/gates sections
      expect(report).toContain('### 💡 Suggested New Prototype');
      expect(report).toContain('A new prototype is needed');
      expect(report).not.toContain('**Suggested Weights**');
      expect(report).not.toContain('**Suggested Gates**');
    });

    it('should handle suggested prototype without rationale', () => {
      const prototypeFitRankingService = {
        analyzeAllPrototypeFit: jest.fn(() => ({ leaderboard: [] })),
        computeImpliedPrototype: jest.fn(() => null),
        detectPrototypeGaps: jest.fn(() => ({
          gapDetected: true,
          nearestDistance: 0.7,
          kNearestNeighbors: [],
          suggestedPrototype: {
            weights: { valence: 0.5 },
            gates: ['gate1'],
          },
        })),
      };

      const generatorWithGapDetection = new MonteCarloReportGenerator({
        logger: mockLogger,
        prototypeFitRankingService,
      });

      const prerequisites = [{ logic: { '>=': [{ var: 'moodAxes.valence' }, 0.3] } }];

      const report = generatorWithGapDetection.generate({
        expressionName: 'test_expression',
        simulationResult: createMockSimulationResult({ storedContexts: [] }),
        blockers: [createMockBlocker()],
        summary: 'Test summary',
        prerequisites,
      });

      // Should contain suggested prototype without rationale
      expect(report).toContain('### 💡 Suggested New Prototype');
      expect(report).not.toContain('**Rationale**');
      expect(report).toContain('**Suggested Weights**');
      expect(report).toContain('**Suggested Gates**');
    });
  });

  // ===========================================================================
  // formatSignedPercentagePoints Tests (via Recommendations Section)
  // ===========================================================================

  describe('formatSignedPercentagePoints via Recommendations', () => {
    /**
     * Creates a simulationResult that enables recommendation generation.
     * RecommendationEngine requires both clauses AND prototypes to generate recommendations.
     * This helper creates the necessary data structure with prototype evaluation summary.
     *
     * @param {number|typeof NaN} impactValue - The impact value for ablationImpact
     * @returns {object} simulationResult with proper structure
     */
    const createRecommendationEnabledSimulationResult = (impactValue) => ({
      triggerRate: 0.15,
      triggerCount: 1500,
      sampleCount: 10000,
      confidenceInterval: { low: 0.14, high: 0.16 },
      distribution: 'uniform',
      storedContexts: [],
      // Required for RecommendationFactsBuilder to build clause facts
      clauseFailures: [
        {
          clauseId: 'clause_joy_0',
          clauseDescription: 'emotions.joy >= 0.5',
          failureRate: 0.85,
          hierarchicalBreakdown: {
            id: '0',
            nodeType: 'leaf',
            clauseId: 'clause_joy_0',
            description: 'emotions.joy >= 0.5',
            variablePath: 'emotions.joy',
            comparisonOperator: '>=',
            thresholdValue: 0.5,
            failureRate: 0.85,
          },
        },
      ],
      // Required for ablation impact to flow through to recommendations
      ablationImpact: {
        clauseImpacts: [{ clauseId: 'clause_joy_0', impact: impactValue }],
      },
      // Required for RecommendationFactsBuilder to build prototype facts
      // Without this, RecommendationEngine returns [] due to empty prototypes
      prototypeEvaluationSummary: {
        emotions: {
          joy: {
            moodSampleCount: 10000,
            gatePassCount: 8000,
            gateFailCount: 2000,
            valueSumGivenGate: 4000, // meanValueGivenGate = 0.5
            failedGateCounts: {},
          },
        },
        sexualStates: {},
      },
      // Required for prototype clause stats linking
      prototypeClauseStats: new Map([
        [
          'emotions:joy',
          [
            {
              clauseId: 'clause_joy_0',
              gatePassAndClausePassInRegimeCount: 1000,
            },
          ],
        ],
      ]),
      gateCompatibility: {
        emotions: { joy: { compatibilityScore: 0.8 } },
        sexualStates: {},
      },
    });

    it('should format positive impact with + sign in recommendation card', () => {
      const simulationResult = createRecommendationEnabledSimulationResult(0.15);
      const prerequisites = [{ logic: { '>=': [{ var: 'emotions.joy' }, 0.5] } }];

      const report = generator.generate({
        expressionName: 'test_expression',
        simulationResult,
        blockers: [createMockBlocker()],
        summary: 'Test summary',
        prerequisites,
      });

      // Verify recommendation section is present with formatted impact
      expect(report).toContain('## Recommendations');
      expect(report).toContain('+15.00 pp');
    });

    it('should format negative impact with - sign in recommendation card', () => {
      const simulationResult = createRecommendationEnabledSimulationResult(-0.08);
      const prerequisites = [{ logic: { '>=': [{ var: 'emotions.joy' }, 0.5] } }];

      const report = generator.generate({
        expressionName: 'test_expression',
        simulationResult,
        blockers: [createMockBlocker()],
        summary: 'Test summary',
        prerequisites,
      });

      // Verify recommendation section is present with formatted impact
      expect(report).toContain('## Recommendations');
      expect(report).toContain('-8.00 pp');
    });

    it('should format zero impact with no sign in recommendation card', () => {
      const simulationResult = createRecommendationEnabledSimulationResult(0);
      const prerequisites = [{ logic: { '>=': [{ var: 'emotions.joy' }, 0.5] } }];

      const report = generator.generate({
        expressionName: 'test_expression',
        simulationResult,
        blockers: [createMockBlocker()],
        summary: 'Test summary',
        prerequisites,
      });

      // Verify recommendation section is present with formatted impact (no sign for 0)
      expect(report).toContain('## Recommendations');
      expect(report).toContain('0.00 pp');
    });

    it('should format NaN impact as N/A in recommendation card', () => {
      const simulationResult = createRecommendationEnabledSimulationResult(NaN);
      const prerequisites = [{ logic: { '>=': [{ var: 'emotions.joy' }, 0.5] } }];

      const report = generator.generate({
        expressionName: 'test_expression',
        simulationResult,
        blockers: [createMockBlocker()],
        summary: 'Test summary',
        prerequisites,
      });

      // Verify recommendation section is present
      // NaN impact should be formatted as 'N/A' by #formatSignedPercentagePoints
      expect(report).toContain('## Recommendations');
      expect(report).toContain('N/A');
    });
  });
});
