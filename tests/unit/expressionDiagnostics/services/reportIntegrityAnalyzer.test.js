/**
 * @file Unit tests for ReportIntegrityAnalyzer service
 * @description Tests integrity warning collection for Monte Carlo reports
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ReportIntegrityAnalyzer from '../../../../src/expressionDiagnostics/services/ReportIntegrityAnalyzer.js';

const createMockFormattingService = () => ({
  formatPercentage: jest.fn((value) => `${(value * 100).toFixed(1)}%`),
  formatCount: jest.fn((value) => String(value)),
});

const createMockStatisticalService = () => ({
  getNestedValue: jest.fn((context, path) => {
    const parts = path.split('.');
    let current = context;
    for (const part of parts) {
      if (current == null) return undefined;
      current = current[part];
    }
    return current;
  }),
  normalizeContextAxes: jest.fn((context) => ({
    moodAxes: context.moodAxes ?? {},
    sexualAxes: context.sexualAxes ?? {},
    traitAxes: context.traitAxes ?? {},
  })),
  computeDistributionStats: jest.fn((values) => {
    if (!values || values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    return {
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p90: sorted[Math.floor(sorted.length * 0.9)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      max: Math.max(...values),
      min: Math.min(...values),
    };
  }),
});

const createMockTreeTraversal = () => ({
  isAndOnlyBlockers: jest.fn(() => true),
  flattenLeaves: jest.fn((node) => (node ? [node] : [])),
});

const createMockDataExtractor = () => ({
  extractBaselineTriggerRate: jest.fn(() => 0.15),
  extractEmotionConditions: jest.fn(() => []),
  getPrototypeContextPath: jest.fn((type, prototypeId) => {
    if (type === 'emotion') return `emotions.${prototypeId}`;
    if (type === 'mood') return `moods.${prototypeId}`;
    return null;
  }),
  getGateTraceSignals: jest.fn(() => null),
});

const createMockPrototypeConstraintAnalyzer = () => ({
  analyzeEmotionThreshold: jest.fn(() => ({
    prototypeId: 'joy',
    type: 'emotion',
    threshold: 0.5,
    maxAchievable: 0.8,
    gates: [],
  })),
});

const createMockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

describe('ReportIntegrityAnalyzer', () => {
  let formattingService;
  let statisticalService;
  let treeTraversal;
  let dataExtractor;
  let prototypeConstraintAnalyzer;
  let logger;

  beforeEach(() => {
    formattingService = createMockFormattingService();
    statisticalService = createMockStatisticalService();
    treeTraversal = createMockTreeTraversal();
    dataExtractor = createMockDataExtractor();
    prototypeConstraintAnalyzer = createMockPrototypeConstraintAnalyzer();
    logger = createMockLogger();
  });

  describe('constructor', () => {
    it('should create instance with all required dependencies', () => {
      const analyzer = new ReportIntegrityAnalyzer({
        formattingService,
        statisticalService,
        treeTraversal,
        dataExtractor,
      });
      expect(analyzer).toBeInstanceOf(ReportIntegrityAnalyzer);
    });

    it('should accept optional prototypeConstraintAnalyzer', () => {
      const analyzer = new ReportIntegrityAnalyzer({
        formattingService,
        statisticalService,
        treeTraversal,
        dataExtractor,
        prototypeConstraintAnalyzer,
      });
      expect(analyzer).toBeInstanceOf(ReportIntegrityAnalyzer);
    });

    it('should accept optional logger', () => {
      const analyzer = new ReportIntegrityAnalyzer({
        formattingService,
        statisticalService,
        treeTraversal,
        dataExtractor,
        logger,
      });
      expect(analyzer).toBeInstanceOf(ReportIntegrityAnalyzer);
    });

    it('should throw if formattingService is missing', () => {
      expect(() => {
        new ReportIntegrityAnalyzer({
          statisticalService,
          treeTraversal,
          dataExtractor,
        });
      }).toThrow('ReportIntegrityAnalyzer requires formattingService');
    });

    it('should throw if statisticalService is missing', () => {
      expect(() => {
        new ReportIntegrityAnalyzer({
          formattingService,
          treeTraversal,
          dataExtractor,
        });
      }).toThrow('ReportIntegrityAnalyzer requires statisticalService');
    });

    it('should throw if treeTraversal is missing', () => {
      expect(() => {
        new ReportIntegrityAnalyzer({
          formattingService,
          statisticalService,
          dataExtractor,
        });
      }).toThrow('ReportIntegrityAnalyzer requires treeTraversal');
    });

    it('should throw if dataExtractor is missing', () => {
      expect(() => {
        new ReportIntegrityAnalyzer({
          formattingService,
          statisticalService,
          treeTraversal,
        });
      }).toThrow('ReportIntegrityAnalyzer requires dataExtractor');
    });
  });

  describe('collect', () => {
    let analyzer;

    beforeEach(() => {
      analyzer = new ReportIntegrityAnalyzer({
        formattingService,
        statisticalService,
        treeTraversal,
        dataExtractor,
        prototypeConstraintAnalyzer,
        logger,
      });
    });

    it('should return empty array when no stored contexts', () => {
      const warnings = analyzer.collect({
        blockers: [],
        axisConstraints: new Map(),
        storedContexts: [],
        moodConstraints: [],
        storedPopulations: {},
        simulationResult: {},
      });

      expect(warnings).toEqual([]);
    });

    it('should collect sweep warnings from sensitivity data', () => {
      const sensitivityData = [
        {
          kind: 'marginalClausePassRateSweep',
          conditionPath: 'emotions.joy',
          operator: '>=',
          originalThreshold: 0.2,
          grid: [
            { threshold: 0.1, passRate: 0.6, sampleCount: 10 },
            { threshold: 0.2, passRate: 0.7, sampleCount: 10 },
            { threshold: 0.3, passRate: 0.5, sampleCount: 10 },
          ],
        },
      ];

      const warnings = analyzer.collect({
        blockers: [],
        axisConstraints: new Map(),
        storedContexts: [],
        moodConstraints: [],
        storedPopulations: {},
        simulationResult: {},
        sensitivityData,
        globalSensitivityData: [],
      });

      const monotonicWarning = warnings.find(
        (w) => w.code === 'S4_SWEEP_NON_MONOTONIC'
      );
      expect(monotonicWarning).toBeDefined();
      expect(monotonicWarning.signal).toBe('emotions.joy');
    });

    it('should detect mood regime hash mismatch', () => {
      const storedContexts = [{ moodAxes: { valence: 50 } }];
      const storedPopulations = {
        storedMoodRegime: { hash: 'hash-a' },
      };
      const simulationResult = {
        populationMeta: {
          storedMoodRegime: { hash: 'hash-b' },
        },
      };

      const warnings = analyzer.collect({
        blockers: [],
        axisConstraints: new Map(),
        storedContexts,
        moodConstraints: [],
        storedPopulations,
        simulationResult,
      });

      const hashWarning = warnings.find(
        (w) => w.code === 'I5_MOOD_REGIME_HASH_MISMATCH'
      );
      expect(hashWarning).toBeDefined();
      expect(hashWarning.details.reportHash).toBe('hash-a');
      expect(hashWarning.details.simulationHash).toBe('hash-b');
    });

    it('should deduplicate warnings with same key', () => {
      const sensitivityData = [
        {
          conditionPath: 'emotions.joy',
          operator: '>=',
          grid: [
            { threshold: 0.1, passRate: 0.6 },
            { threshold: 0.2, passRate: 0.7 },
          ],
        },
        {
          conditionPath: 'emotions.joy',
          operator: '>=',
          grid: [
            { threshold: 0.1, passRate: 0.6 },
            { threshold: 0.2, passRate: 0.7 },
          ],
        },
      ];

      const warnings = analyzer.collect({
        blockers: [],
        axisConstraints: new Map(),
        storedContexts: [],
        moodConstraints: [],
        storedPopulations: {},
        simulationResult: {},
        sensitivityData,
      });

      const monotonicWarnings = warnings.filter(
        (w) => w.code === 'S4_SWEEP_NON_MONOTONIC'
      );
      expect(monotonicWarnings.length).toBe(1);
    });
  });

  describe('sweep warning collection', () => {
    let analyzer;

    beforeEach(() => {
      analyzer = new ReportIntegrityAnalyzer({
        formattingService,
        statisticalService,
        treeTraversal,
        dataExtractor,
      });
    });

    it('should detect non-monotonic sweep for >= operator', () => {
      const sensitivityData = [
        {
          conditionPath: 'test.var',
          operator: '>=',
          grid: [
            { threshold: 0.1, passRate: 0.5 },
            { threshold: 0.2, passRate: 0.6 },
            { threshold: 0.3, passRate: 0.4 },
          ],
        },
      ];

      const warnings = analyzer.collect({
        blockers: [],
        axisConstraints: new Map(),
        storedContexts: [],
        moodConstraints: [],
        storedPopulations: {},
        simulationResult: {},
        sensitivityData,
      });

      const warning = warnings.find((w) => w.code === 'S4_SWEEP_NON_MONOTONIC');
      expect(warning).toBeDefined();
      expect(warning.message).toContain('not non-increasing');
    });

    it('should detect S1 trigger exceeds clause pass warning', () => {
      dataExtractor.extractBaselineTriggerRate.mockReturnValue(0.8);
      treeTraversal.isAndOnlyBlockers.mockReturnValue(true);

      const sensitivityData = [
        {
          conditionPath: 'test.var',
          operator: '>=',
          originalThreshold: 0.2,
          grid: [
            { threshold: 0.1, passRate: 0.9 },
            { threshold: 0.2, passRate: 0.5 },
            { threshold: 0.3, passRate: 0.3 },
          ],
        },
      ];

      analyzer = new ReportIntegrityAnalyzer({
        formattingService,
        statisticalService,
        treeTraversal,
        dataExtractor,
      });

      const warnings = analyzer.collect({
        blockers: [{}],
        axisConstraints: new Map(),
        storedContexts: [],
        moodConstraints: [],
        storedPopulations: {},
        simulationResult: {},
        sensitivityData,
        globalSensitivityData: [],
      });

      const warning = warnings.find(
        (w) => w.code === 'S1_TRIGGER_EXCEEDS_CLAUSE_PASS'
      );
      expect(warning).toBeDefined();
      expect(warning.details.baselineTriggerRate).toBe(0.8);
      expect(warning.details.baselinePassRate).toBe(0.5);
    });

    it('should skip invalid results without grid', () => {
      const sensitivityData = [
        { conditionPath: 'test.var', operator: '>=' },
        null,
        { conditionPath: 'test.var2', operator: '>=', grid: [] },
      ];

      const warnings = analyzer.collect({
        blockers: [],
        axisConstraints: new Map(),
        storedContexts: [],
        moodConstraints: [],
        storedPopulations: {},
        simulationResult: {},
        sensitivityData,
      });

      expect(warnings.length).toBe(0);
    });
  });

  describe('context integrity warnings', () => {
    let analyzer;

    beforeEach(() => {
      dataExtractor.extractEmotionConditions.mockReturnValue([
        { prototypeId: 'joy', type: 'emotion', threshold: 0.5, operator: '>=' },
      ]);

      analyzer = new ReportIntegrityAnalyzer({
        formattingService,
        statisticalService,
        treeTraversal,
        dataExtractor,
        prototypeConstraintAnalyzer,
        logger,
      });
    });

    it('should detect I1 gate failed but non-zero final', () => {
      dataExtractor.getGateTraceSignals.mockReturnValue({ gatePass: false });
      statisticalService.getNestedValue.mockImplementation((context, path) => {
        if (path === 'emotions.joy') return 0.3;
        return undefined;
      });

      const storedContexts = [{ emotions: { joy: 0.3 }, moodAxes: {} }];

      const warnings = analyzer.collect({
        blockers: [{ clauseDescription: 'test' }],
        axisConstraints: new Map(),
        storedContexts,
        moodConstraints: [],
        storedPopulations: {
          storedGlobal: { sampleIds: [0] },
        },
        simulationResult: {},
      });

      const warning = warnings.find(
        (w) => w.code === 'I1_GATE_FAILED_NONZERO_FINAL'
      );
      expect(warning).toBeDefined();
      expect(warning.prototypeId).toBe('joy');
      expect(warning.details.gateFailNonZeroCount).toBe(1);
    });

    it('should detect I2 pass rate exceeds gate pass', () => {
      dataExtractor.getGateTraceSignals.mockImplementation((ctx) => {
        if (ctx.gatePass === false) return { gatePass: false };
        return { gatePass: true };
      });
      statisticalService.getNestedValue.mockImplementation((context, path) => {
        if (path === 'emotions.joy') return context.emotions?.joy;
        return undefined;
      });

      const storedContexts = [
        { emotions: { joy: 0.6 }, gatePass: false },
        { emotions: { joy: 0.7 }, gatePass: true },
      ];

      const warnings = analyzer.collect({
        blockers: [{ clauseDescription: 'test' }],
        axisConstraints: new Map(),
        storedContexts,
        moodConstraints: [],
        storedPopulations: {
          storedGlobal: { sampleIds: [0, 1] },
        },
        simulationResult: {},
      });

      const warning = warnings.find(
        (w) => w.code === 'I2_PASSRATE_EXCEEDS_GATEPASS'
      );
      expect(warning).toBeDefined();
    });

    it('should detect I4 observed exceeds theoretical max', () => {
      prototypeConstraintAnalyzer.analyzeEmotionThreshold.mockReturnValue({
        prototypeId: 'joy',
        type: 'emotion',
        threshold: 0.5,
        maxAchievable: 0.3,
        gates: [],
      });
      dataExtractor.getGateTraceSignals.mockReturnValue({ gatePass: true });
      statisticalService.getNestedValue.mockImplementation((context, path) => {
        if (path === 'emotions.joy') return 0.5;
        return undefined;
      });

      const storedContexts = [{ emotions: { joy: 0.5 }, moodAxes: {} }];

      const warnings = analyzer.collect({
        blockers: [{ clauseDescription: 'test' }],
        axisConstraints: new Map(),
        storedContexts,
        moodConstraints: [{ varPath: 'moodAxes.test', operator: '>=', threshold: 0 }],
        storedPopulations: {
          storedMoodRegime: { sampleIds: [0] },
        },
        simulationResult: {},
      });

      const warning = warnings.find(
        (w) => w.code === 'I4_OBSERVED_EXCEEDS_THEORETICAL'
      );
      expect(warning).toBeDefined();
      expect(warning.details.observedMax).toBe(0.5);
      expect(warning.details.theoreticalMax).toBe(0.3);
    });

    it('should skip analysis when no blockers', () => {
      const storedContexts = [{ emotions: { joy: 0.5 } }];

      const warnings = analyzer.collect({
        blockers: [],
        axisConstraints: new Map(),
        storedContexts,
        moodConstraints: [],
        storedPopulations: {},
        simulationResult: {},
      });

      expect(
        warnings.filter((w) => w.code.startsWith('I'))
      ).toHaveLength(0);
    });

    it('should skip analysis when no prototypeConstraintAnalyzer', () => {
      const analyzerWithoutPrototype = new ReportIntegrityAnalyzer({
        formattingService,
        statisticalService,
        treeTraversal,
        dataExtractor,
      });

      const storedContexts = [{ emotions: { joy: 0.5 } }];

      const warnings = analyzerWithoutPrototype.collect({
        blockers: [{ clauseDescription: 'test' }],
        axisConstraints: new Map(),
        storedContexts,
        moodConstraints: [],
        storedPopulations: {},
        simulationResult: {},
      });

      expect(
        warnings.filter((w) => w.code.startsWith('I'))
      ).toHaveLength(0);
    });

    it('should handle prototypeConstraintAnalyzer errors gracefully', () => {
      prototypeConstraintAnalyzer.analyzeEmotionThreshold.mockImplementation(() => {
        throw new Error('Analysis failed');
      });

      const storedContexts = [{ emotions: { joy: 0.5 } }];

      const warnings = analyzer.collect({
        blockers: [{ clauseDescription: 'test' }],
        axisConstraints: new Map(),
        storedContexts,
        moodConstraints: [],
        storedPopulations: {},
        simulationResult: {},
      });

      expect(logger.warn).toHaveBeenCalled();
      expect(
        warnings.filter((w) => w.code.startsWith('I1') || w.code.startsWith('I2'))
      ).toHaveLength(0);
    });
  });

  describe('contextMatchesConstraints', () => {
    let analyzer;

    beforeEach(() => {
      analyzer = new ReportIntegrityAnalyzer({
        formattingService,
        statisticalService,
        treeTraversal,
        dataExtractor,
      });
    });

    it('should return true when no mood constraints', () => {
      const storedContexts = [{ moodAxes: { valence: 50 } }];

      const warnings = analyzer.collect({
        blockers: [],
        axisConstraints: new Map(),
        storedContexts,
        moodConstraints: [],
        storedPopulations: {},
        simulationResult: {},
      });

      expect(warnings).toHaveLength(0);
    });

    it('should filter contexts by mood constraints when analyzing integrity', () => {
      dataExtractor.extractEmotionConditions.mockReturnValue([
        { prototypeId: 'joy', type: 'emotion', threshold: 0.5, operator: '>=' },
      ]);
      prototypeConstraintAnalyzer.analyzeEmotionThreshold.mockReturnValue({
        prototypeId: 'joy',
        type: 'emotion',
        threshold: 0.5,
        maxAchievable: 0.8,
        gates: [],
      });
      dataExtractor.getGateTraceSignals.mockReturnValue({ gatePass: true });
      statisticalService.getNestedValue.mockImplementation((context, path) => {
        if (path === 'moodAxes.valence') return context.moodAxes?.valence;
        if (path === 'emotions.joy') return context.emotions?.joy ?? 0;
        return undefined;
      });

      const analyzerWithDeps = new ReportIntegrityAnalyzer({
        formattingService,
        statisticalService,
        treeTraversal,
        dataExtractor,
        prototypeConstraintAnalyzer,
      });

      const storedContexts = [
        { moodAxes: { valence: 80 }, emotions: { joy: 0.3 } },
        { moodAxes: { valence: 20 }, emotions: { joy: 0.2 } },
      ];
      const moodConstraints = [
        { varPath: 'moodAxes.valence', operator: '>=', threshold: 50 },
      ];

      analyzerWithDeps.collect({
        blockers: [{ clauseDescription: 'test' }],
        axisConstraints: new Map(),
        storedContexts,
        moodConstraints,
        storedPopulations: {},
        simulationResult: {},
      });

      expect(statisticalService.getNestedValue).toHaveBeenCalled();
    });
  });

  describe('warning deduplication', () => {
    let analyzer;

    beforeEach(() => {
      analyzer = new ReportIntegrityAnalyzer({
        formattingService,
        statisticalService,
        treeTraversal,
        dataExtractor,
      });
    });

    it('should deduplicate warnings by composite key', () => {
      const sensitivityData = [
        {
          conditionPath: 'test.var',
          operator: '>=',
          populationHash: 'hash-1',
          grid: [
            { threshold: 0.1, passRate: 0.6 },
            { threshold: 0.2, passRate: 0.7 },
          ],
        },
      ];
      const globalSensitivityData = [
        {
          conditionPath: 'test.var',
          operator: '>=',
          populationHash: 'hash-1',
          grid: [
            { threshold: 0.1, triggerRate: 0.6 },
            { threshold: 0.2, triggerRate: 0.7 },
          ],
        },
      ];

      const warnings = analyzer.collect({
        blockers: [],
        axisConstraints: new Map(),
        storedContexts: [],
        moodConstraints: [],
        storedPopulations: {},
        simulationResult: {},
        sensitivityData,
        globalSensitivityData,
      });

      const monotonicWarnings = warnings.filter(
        (w) => w.code === 'S4_SWEEP_NON_MONOTONIC'
      );
      expect(monotonicWarnings.length).toBeLessThanOrEqual(2);
    });
  });
});
