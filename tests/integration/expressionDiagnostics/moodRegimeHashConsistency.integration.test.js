/**
 * @file Integration tests for mood regime hash consistency between
 * MonteCarloSimulator.populationMeta and MonteCarloReportGenerator.storedPopulations.
 *
 * Verifies that I5_MOOD_REGIME_HASH_MISMATCH warning is not generated when
 * expressions use emotions.* references (prototype-based constraints).
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import MonteCarloSimulator from '../../../src/expressionDiagnostics/services/MonteCarloSimulator.js';
import MonteCarloReportGenerator from '../../../src/expressionDiagnostics/services/MonteCarloReportGenerator.js';
import EmotionCalculatorAdapter from '../../../src/expressionDiagnostics/adapters/EmotionCalculatorAdapter.js';
import EmotionCalculatorService from '../../../src/emotions/emotionCalculatorService.js';
import CoreSectionGenerator from '../../../src/expressionDiagnostics/services/sectionGenerators/CoreSectionGenerator.js';
import ReportIntegrityAnalyzer from '../../../src/expressionDiagnostics/services/ReportIntegrityAnalyzer.js';

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createMockFormattingService = () => ({
  formatClauseTrackingAsList: jest.fn(() => ''),
  formatClauseAblationImpact: jest.fn(() => ''),
  formatPercentage: jest.fn((v) => `${(v * 100).toFixed(1)}%`),
  formatConfidenceInterval: jest.fn(() => '[0.0%, 100.0%]'),
  formatCount: jest.fn((n) => String(n)),
  formatTriggerProbability: jest.fn(() => '50.0%'),
  formatTriggersPerScenario: jest.fn(() => '0.50'),
  formatStoredContextPopulationLabel: jest.fn(() => 'test-label'),
  formatMonteCarloSummary: jest.fn(() => 'summary'),
});

const createMockPrototypeSectionGenerator = () => ({
  generateImpliedPrototypeSection: jest.fn(() => ''),
  generatePrototypeFitAnalysis: jest.fn(() => null),
});

const createMockWitnessFormatter = () => ({
  format: jest.fn(() => ''),
  formatWitnessList: jest.fn(() => ''),
});

const createMockStatisticalService = () => ({
  computeConfidenceInterval: jest.fn(() => ({ lower: 0, upper: 1 })),
  computeTriggersPerScenario: jest.fn(() => 0.5),
  getNestedValue: jest.fn((obj, path) => {
    if (!obj || !path) return undefined;
    return path.split('.').reduce((acc, key) => acc?.[key], obj);
  }),
  computeDistributionStats: jest.fn(() => ({ min: 0, max: 1, mean: 0.5, median: 0.5, p90: 0.9, count: 4 })),
  computeConditionalPassRates: jest.fn(() => []),
  computeAxisContributions: jest.fn(() => ({})),
});

const createMockDataExtractor = () => ({
  extractMoodAxesFromContext: jest.fn(() => ({})),
  extractEmotionsFromContext: jest.fn(() => ({})),
  extractBaselineTriggerRate: jest.fn(() => null),
});

const createMockTreeTraversal = () => ({
  traverse: jest.fn(() => []),
  find: jest.fn(() => null),
  isAndOnlyBlockers: jest.fn(() => true),
  flattenLeaves: jest.fn(() => []),
  findDominantSuppressor: jest.fn(() => ({ axis: null, contribution: 0 })),
});

describe('Mood regime hash consistency', () => {
  let logger;
  let dataRegistry;
  let emotionCalculatorAdapter;
  let randomStateGenerator;
  let monteCarloSimulator;

  beforeEach(() => {
    logger = createLogger();
    dataRegistry = {
      get: jest.fn((category, lookupId) => {
        if (category !== 'lookups') return null;
        if (lookupId === 'core:emotion_prototypes') {
          return {
            entries: {
              flow: {
                weights: { valence: 0.6, arousal: 0.3 },
                gates: ['valence >= 0.35'],
              },
              joy: {
                weights: { valence: 0.8, arousal: 0.4 },
                gates: ['valence >= 0.40'],
              },
            },
          };
        }
        if (lookupId === 'core:sexual_prototypes') {
          return { entries: {} };
        }
        return null;
      }),
      getLookupData: jest.fn((key) => {
        if (key === 'core:emotion_prototypes') {
          return {
            entries: {
              flow: {
                weights: { valence: 0.6, arousal: 0.3 },
                gates: ['valence >= 0.35'],
              },
              joy: {
                weights: { valence: 0.8, arousal: 0.4 },
                gates: ['valence >= 0.40'],
              },
            },
          };
        }
        if (key === 'core:sexual_prototypes') {
          return { entries: {} };
        }
        return null;
      }),
    };

    const emotionCalculatorService = new EmotionCalculatorService({
      dataRegistry,
      logger,
    });

    emotionCalculatorAdapter = new EmotionCalculatorAdapter({
      emotionCalculatorService,
      logger,
    });

    // Create deterministic samples with varying valence
    const samples = [
      { current: { mood: { valence: 10 }, sexual: {} }, previous: { mood: { valence: 10 }, sexual: {} }, affectTraits: null },
      { current: { mood: { valence: 40 }, sexual: {} }, previous: { mood: { valence: 40 }, sexual: {} }, affectTraits: null },
      { current: { mood: { valence: 50 }, sexual: {} }, previous: { mood: { valence: 50 }, sexual: {} }, affectTraits: null },
      { current: { mood: { valence: 60 }, sexual: {} }, previous: { mood: { valence: 60 }, sexual: {} }, affectTraits: null },
    ];
    let sampleIndex = 0;

    randomStateGenerator = {
      generate: jest.fn(() => {
        const sample = samples[sampleIndex % samples.length];
        sampleIndex++;
        return sample;
      }),
    };

    monteCarloSimulator = new MonteCarloSimulator({
      logger,
      dataRegistry,
      emotionCalculatorAdapter,
      randomStateGenerator,
    });
  });

  it('should produce matching population hashes for expression with only emotions.* references', async () => {
    // Expression uses emotions.flow which has gate "valence >= 0.35"
    // Previously, the simulator would not derive constraints from prototype gates,
    // but the report generator would, causing hash mismatch
    const expression = {
      id: 'test:emotions-only-expression',
      prerequisites: [
        {
          logic: {
            '>=': [{ var: 'emotions.flow' }, 0.5],
          },
        },
      ],
    };

    const simulationResult = await monteCarloSimulator.simulate(expression, {
      sampleCount: 4,
      storeSamplesForSensitivity: true,
      sensitivitySampleLimit: 4,
    });

    // Verify populationMeta has storedMoodRegime with a hash
    expect(simulationResult.populationMeta).toBeDefined();
    expect(simulationResult.populationMeta.storedMoodRegime).toBeDefined();
    expect(simulationResult.populationMeta.storedMoodRegime.hash).toBeDefined();

    // Create report generator with real dependencies
    const formattingService = createMockFormattingService();
    const coreSectionGenerator = new CoreSectionGenerator({
      formattingService,
      witnessFormatter: createMockWitnessFormatter(),
      statisticalService: createMockStatisticalService(),
      dataExtractor: createMockDataExtractor(),
    });
    const integrityAnalyzer = new ReportIntegrityAnalyzer({
      formattingService,
      statisticalService: createMockStatisticalService(),
      treeTraversal: createMockTreeTraversal(),
      dataExtractor: createMockDataExtractor(),
      prototypeConstraintAnalyzer: null,
      logger,
    });

    const reportGenerator = new MonteCarloReportGenerator({
      logger,
      dataRegistry,
      formattingService,
      prototypeSectionGenerator: createMockPrototypeSectionGenerator(),
      coreSectionGenerator,
      integrityAnalyzer,
    });

    // Collect integrity warnings
    const warnings = reportGenerator.collectReportIntegrityWarnings({
      simulationResult,
      blockers: [],
      prerequisites: expression.prerequisites,
    });

    // Verify no I5_MOOD_REGIME_HASH_MISMATCH warning
    const hashMismatchWarning = warnings.find(
      (w) => w.code === 'I5_MOOD_REGIME_HASH_MISMATCH'
    );

    expect(hashMismatchWarning).toBeUndefined();
  });

  it('should produce matching hashes for mixed moodAxes.* and emotions.* references', async () => {
    // Expression uses both direct moodAxes constraints and emotion refs
    const expression = {
      id: 'test:mixed-constraint-expression',
      prerequisites: [
        {
          logic: {
            and: [
              { '>=': [{ var: 'moodAxes.arousal' }, 30] },
              { '>=': [{ var: 'emotions.flow' }, 0.5] },
            ],
          },
        },
      ],
    };

    const simulationResult = await monteCarloSimulator.simulate(expression, {
      sampleCount: 4,
      storeSamplesForSensitivity: true,
      sensitivitySampleLimit: 4,
    });

    expect(simulationResult.populationMeta).toBeDefined();
    expect(simulationResult.populationMeta.storedMoodRegime).toBeDefined();

    const formattingService = createMockFormattingService();
    const coreSectionGenerator = new CoreSectionGenerator({
      formattingService,
      witnessFormatter: createMockWitnessFormatter(),
      statisticalService: createMockStatisticalService(),
      dataExtractor: createMockDataExtractor(),
    });
    const integrityAnalyzer = new ReportIntegrityAnalyzer({
      formattingService,
      statisticalService: createMockStatisticalService(),
      treeTraversal: createMockTreeTraversal(),
      dataExtractor: createMockDataExtractor(),
      prototypeConstraintAnalyzer: null,
      logger,
    });

    const reportGenerator = new MonteCarloReportGenerator({
      logger,
      dataRegistry,
      formattingService,
      prototypeSectionGenerator: createMockPrototypeSectionGenerator(),
      coreSectionGenerator,
      integrityAnalyzer,
    });

    const warnings = reportGenerator.collectReportIntegrityWarnings({
      simulationResult,
      blockers: [],
      prerequisites: expression.prerequisites,
    });

    const hashMismatchWarning = warnings.find(
      (w) => w.code === 'I5_MOOD_REGIME_HASH_MISMATCH'
    );

    expect(hashMismatchWarning).toBeUndefined();
  });

  it('should produce matching hashes when direct constraint overrides prototype gate', async () => {
    // Expression has direct valence >= 60 which should override prototype's valence >= 35
    const expression = {
      id: 'test:direct-override-expression',
      prerequisites: [
        {
          logic: {
            and: [
              { '>=': [{ var: 'moodAxes.valence' }, 60] },
              { '>=': [{ var: 'emotions.flow' }, 0.5] },
            ],
          },
        },
      ],
    };

    const simulationResult = await monteCarloSimulator.simulate(expression, {
      sampleCount: 4,
      storeSamplesForSensitivity: true,
      sensitivitySampleLimit: 4,
    });

    expect(simulationResult.populationMeta).toBeDefined();
    expect(simulationResult.populationMeta.storedMoodRegime).toBeDefined();

    const formattingService = createMockFormattingService();
    const coreSectionGenerator = new CoreSectionGenerator({
      formattingService,
      witnessFormatter: createMockWitnessFormatter(),
      statisticalService: createMockStatisticalService(),
      dataExtractor: createMockDataExtractor(),
    });
    const integrityAnalyzer = new ReportIntegrityAnalyzer({
      formattingService,
      statisticalService: createMockStatisticalService(),
      treeTraversal: createMockTreeTraversal(),
      dataExtractor: createMockDataExtractor(),
      prototypeConstraintAnalyzer: null,
      logger,
    });

    const reportGenerator = new MonteCarloReportGenerator({
      logger,
      dataRegistry,
      formattingService,
      prototypeSectionGenerator: createMockPrototypeSectionGenerator(),
      coreSectionGenerator,
      integrityAnalyzer,
    });

    const warnings = reportGenerator.collectReportIntegrityWarnings({
      simulationResult,
      blockers: [],
      prerequisites: expression.prerequisites,
    });

    const hashMismatchWarning = warnings.find(
      (w) => w.code === 'I5_MOOD_REGIME_HASH_MISMATCH'
    );

    expect(hashMismatchWarning).toBeUndefined();
  });

  it('should produce consistent hashes for expressions with multiple prototype references', async () => {
    // Simulate flow_absorption-like expression with many emotion refs
    // This tests the deterministic ordering fix for non-deterministic Map iteration
    const expression = {
      id: 'test:multi-prototype-expression',
      prerequisites: [
        {
          logic: {
            and: [
              { '>=': [{ var: 'emotions.flow' }, 0.6] },
              { '>=': [{ var: 'emotions.joy' }, 0.3] },
            ],
          },
        },
      ],
    };

    // Run simulation multiple times to verify hash consistency
    const hashes = [];
    for (let i = 0; i < 5; i++) {
      const simulationResult = await monteCarloSimulator.simulate(expression, {
        sampleCount: 4,
        storeSamplesForSensitivity: true,
        sensitivitySampleLimit: 4,
      });

      expect(simulationResult.populationMeta).toBeDefined();
      expect(simulationResult.populationMeta.storedMoodRegime).toBeDefined();
      hashes.push(simulationResult.populationMeta.storedMoodRegime.hash);
    }

    // All hashes should be identical (deterministic ordering)
    const uniqueHashes = new Set(hashes);
    expect(uniqueHashes.size).toBe(1);
  });

  it('should produce matching hashes even when expressions reference same axis via different prototypes', async () => {
    // Both flow and joy have valence gates - tests deduplication determinism
    const expression = {
      id: 'test:same-axis-multiple-prototypes',
      prerequisites: [
        {
          logic: {
            and: [
              { '>=': [{ var: 'emotions.flow' }, 0.5] },
              { '>=': [{ var: 'emotions.joy' }, 0.4] },
            ],
          },
        },
      ],
    };

    const simulationResult = await monteCarloSimulator.simulate(expression, {
      sampleCount: 4,
      storeSamplesForSensitivity: true,
      sensitivitySampleLimit: 4,
    });

    expect(simulationResult.populationMeta).toBeDefined();
    expect(simulationResult.populationMeta.storedMoodRegime).toBeDefined();

    const formattingService = createMockFormattingService();
    const coreSectionGenerator = new CoreSectionGenerator({
      formattingService,
      witnessFormatter: createMockWitnessFormatter(),
      statisticalService: createMockStatisticalService(),
      dataExtractor: createMockDataExtractor(),
    });
    const integrityAnalyzer = new ReportIntegrityAnalyzer({
      formattingService,
      statisticalService: createMockStatisticalService(),
      treeTraversal: createMockTreeTraversal(),
      dataExtractor: createMockDataExtractor(),
      prototypeConstraintAnalyzer: null,
      logger,
    });

    const reportGenerator = new MonteCarloReportGenerator({
      logger,
      dataRegistry,
      formattingService,
      prototypeSectionGenerator: createMockPrototypeSectionGenerator(),
      coreSectionGenerator,
      integrityAnalyzer,
    });

    const warnings = reportGenerator.collectReportIntegrityWarnings({
      simulationResult,
      blockers: [],
      prerequisites: expression.prerequisites,
    });

    const hashMismatchWarning = warnings.find(
      (w) => w.code === 'I5_MOOD_REGIME_HASH_MISMATCH'
    );

    expect(hashMismatchWarning).toBeUndefined();
  });
});
