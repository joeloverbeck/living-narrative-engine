/**
 * @file Unit tests for BehavioralOverlapEvaluator partial parse handling
 * Tests that gate implication is NOT evaluated when parseStatus is 'partial',
 * preventing false deterministic nesting claims based on incomplete data.
 * @see src/expressionDiagnostics/services/prototypeOverlap/BehavioralOverlapEvaluator.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import BehavioralOverlapEvaluator from '../../../../../src/expressionDiagnostics/services/prototypeOverlap/BehavioralOverlapEvaluator.js';

describe('BehavioralOverlapEvaluator - partial parse handling', () => {
  let mockLogger;
  let mockRandomStateGenerator;
  let mockContextBuilder;
  let mockGateChecker;
  let mockIntensityCalculator;
  let mockGateImplicationEvaluator;
  let mockConfig;

  /**
   * Creates a basic state generator mock.
   * @returns {object} Mock state generator
   */
  function createMockStateGenerator() {
    return {
      generate: jest.fn(() => ({
        current: { mood: { happiness: 50 }, sexual: {} },
        previous: { mood: { happiness: 40 }, sexual: {} },
        affectTraits: { affective_empathy: 50 },
      })),
    };
  }

  /**
   * Creates a basic context builder mock.
   * @returns {object} Mock context builder
   */
  function createMockContextBuilder() {
    return {
      buildContext: jest.fn((current, previous, traits) => ({
        moodAxes: current.mood,
        sexualAxes: current.sexual,
        affectTraits: traits,
        emotions: {},
        sexualStates: {},
      })),
    };
  }

  /**
   * Creates a gate constraint extractor mock with configurable parse status.
   * @param {string} parseStatusA - Parse status for prototype A
   * @param {string} parseStatusB - Parse status for prototype B
   * @param {string[]} [unparsedGatesA=[]] - Unparsed gates for A
   * @param {string[]} [unparsedGatesB=[]] - Unparsed gates for B
   * @returns {object} Mock gate constraint extractor
   */
  function createMockGateConstraintExtractor(
    parseStatusA,
    parseStatusB,
    unparsedGatesA = [],
    unparsedGatesB = []
  ) {
    let callCount = 0;
    return {
      extract: jest.fn(() => {
        callCount++;
        // First call is for prototypeA, second for prototypeB
        if (callCount === 1) {
          return {
            parseStatus: parseStatusA,
            intervals: new Map(),
            unparsedGates: unparsedGatesA,
          };
        }
        return {
          parseStatus: parseStatusB,
          intervals: new Map(),
          unparsedGates: unparsedGatesB,
        };
      }),
    };
  }

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockConfig = {
      sampleCountPerPair: 100,
      divergenceExamplesK: 5,
      dominanceDelta: 0.05,
      minCoPassSamples: 1,
    };

    mockRandomStateGenerator = createMockStateGenerator();
    mockContextBuilder = createMockContextBuilder();
    mockGateChecker = { checkAllGatesPass: jest.fn(() => true) };
    mockIntensityCalculator = { computeIntensity: jest.fn(() => 0.5) };

    mockGateImplicationEvaluator = {
      evaluate: jest.fn(() => ({
        A_implies_B: true,
        B_implies_A: false,
        counterExampleAxes: [],
        evidence: [],
        relation: 'narrower',
        isVacuous: false,
      })),
    };
  });

  // ==========================================================================
  // Partial parse status tests
  // ==========================================================================
  describe('gateImplication evaluation guards', () => {
    it('should NOT evaluate gateImplication when prototypeA parseStatus is partial', async () => {
      const mockExtractor = createMockGateConstraintExtractor(
        'partial',
        'complete',
        ['unparsed_gate_1'],
        []
      );

      const evaluator = new BehavioralOverlapEvaluator({
        prototypeIntensityCalculator: mockIntensityCalculator,
        randomStateGenerator: mockRandomStateGenerator,
        contextBuilder: mockContextBuilder,
        prototypeGateChecker: mockGateChecker,
        gateConstraintExtractor: mockExtractor,
        gateImplicationEvaluator: mockGateImplicationEvaluator,
        config: mockConfig,
        logger: mockLogger,
      });

      const protoA = { gates: ['gate1', 'gate2'], weights: { axis1: 1.0 } };
      const protoB = { gates: ['gate1'], weights: { axis1: 1.0 } };

      const result = await evaluator.evaluate(protoA, protoB, 10);

      // gateImplication should be null because A has partial parse status
      expect(result.gateImplication).toBeNull();
      expect(mockGateImplicationEvaluator.evaluate).not.toHaveBeenCalled();
    });

    it('should NOT evaluate gateImplication when prototypeB parseStatus is partial', async () => {
      const mockExtractor = createMockGateConstraintExtractor(
        'complete',
        'partial',
        [],
        ['unparsed_gate_2']
      );

      const evaluator = new BehavioralOverlapEvaluator({
        prototypeIntensityCalculator: mockIntensityCalculator,
        randomStateGenerator: mockRandomStateGenerator,
        contextBuilder: mockContextBuilder,
        prototypeGateChecker: mockGateChecker,
        gateConstraintExtractor: mockExtractor,
        gateImplicationEvaluator: mockGateImplicationEvaluator,
        config: mockConfig,
        logger: mockLogger,
      });

      const protoA = { gates: ['gate1'], weights: { axis1: 1.0 } };
      const protoB = { gates: ['gate1', 'gate2'], weights: { axis1: 1.0 } };

      const result = await evaluator.evaluate(protoA, protoB, 10);

      // gateImplication should be null because B has partial parse status
      expect(result.gateImplication).toBeNull();
      expect(mockGateImplicationEvaluator.evaluate).not.toHaveBeenCalled();
    });

    it('should NOT evaluate gateImplication when both have partial parseStatus', async () => {
      const mockExtractor = createMockGateConstraintExtractor(
        'partial',
        'partial',
        ['unparsed_gate_1'],
        ['unparsed_gate_2']
      );

      const evaluator = new BehavioralOverlapEvaluator({
        prototypeIntensityCalculator: mockIntensityCalculator,
        randomStateGenerator: mockRandomStateGenerator,
        contextBuilder: mockContextBuilder,
        prototypeGateChecker: mockGateChecker,
        gateConstraintExtractor: mockExtractor,
        gateImplicationEvaluator: mockGateImplicationEvaluator,
        config: mockConfig,
        logger: mockLogger,
      });

      const protoA = { gates: ['gate1', 'gate2'], weights: { axis1: 1.0 } };
      const protoB = { gates: ['gate1', 'gate2'], weights: { axis1: 1.0 } };

      const result = await evaluator.evaluate(protoA, protoB, 10);

      expect(result.gateImplication).toBeNull();
      expect(mockGateImplicationEvaluator.evaluate).not.toHaveBeenCalled();
    });

    it('should NOT evaluate gateImplication when parseStatus is failed', async () => {
      const mockExtractor = createMockGateConstraintExtractor(
        'failed',
        'complete',
        ['all_gates_failed'],
        []
      );

      const evaluator = new BehavioralOverlapEvaluator({
        prototypeIntensityCalculator: mockIntensityCalculator,
        randomStateGenerator: mockRandomStateGenerator,
        contextBuilder: mockContextBuilder,
        prototypeGateChecker: mockGateChecker,
        gateConstraintExtractor: mockExtractor,
        gateImplicationEvaluator: mockGateImplicationEvaluator,
        config: mockConfig,
        logger: mockLogger,
      });

      const protoA = { gates: ['gate1'], weights: { axis1: 1.0 } };
      const protoB = { gates: ['gate1'], weights: { axis1: 1.0 } };

      const result = await evaluator.evaluate(protoA, protoB, 10);

      expect(result.gateImplication).toBeNull();
      expect(mockGateImplicationEvaluator.evaluate).not.toHaveBeenCalled();
    });

    it('should evaluate gateImplication when both have complete parseStatus', async () => {
      const mockExtractor = createMockGateConstraintExtractor(
        'complete',
        'complete'
      );

      const evaluator = new BehavioralOverlapEvaluator({
        prototypeIntensityCalculator: mockIntensityCalculator,
        randomStateGenerator: mockRandomStateGenerator,
        contextBuilder: mockContextBuilder,
        prototypeGateChecker: mockGateChecker,
        gateConstraintExtractor: mockExtractor,
        gateImplicationEvaluator: mockGateImplicationEvaluator,
        config: mockConfig,
        logger: mockLogger,
      });

      const protoA = { gates: ['gate1'], weights: { axis1: 1.0 } };
      const protoB = { gates: ['gate1'], weights: { axis1: 1.0 } };

      const result = await evaluator.evaluate(protoA, protoB, 10);

      expect(result.gateImplication).not.toBeNull();
      expect(mockGateImplicationEvaluator.evaluate).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // gateParseInfo field tests
  // ==========================================================================
  describe('gateParseInfo output', () => {
    it('should include gateParseInfo with correct parseStatus values', async () => {
      const mockExtractor = createMockGateConstraintExtractor(
        'partial',
        'complete',
        ['gate2'],
        []
      );

      const evaluator = new BehavioralOverlapEvaluator({
        prototypeIntensityCalculator: mockIntensityCalculator,
        randomStateGenerator: mockRandomStateGenerator,
        contextBuilder: mockContextBuilder,
        prototypeGateChecker: mockGateChecker,
        gateConstraintExtractor: mockExtractor,
        gateImplicationEvaluator: mockGateImplicationEvaluator,
        config: mockConfig,
        logger: mockLogger,
      });

      const protoA = { gates: ['gate1', 'gate2'], weights: { axis1: 1.0 } };
      const protoB = { gates: ['gate1'], weights: { axis1: 1.0 } };

      const result = await evaluator.evaluate(protoA, protoB, 10);

      expect(result.gateParseInfo).toBeDefined();
      expect(result.gateParseInfo.prototypeA.parseStatus).toBe('partial');
      expect(result.gateParseInfo.prototypeB.parseStatus).toBe('complete');
    });

    it('should include correct gate counts in gateParseInfo', async () => {
      const mockExtractor = createMockGateConstraintExtractor(
        'partial',
        'complete',
        ['gate3'], // 1 unparsed out of 3
        [] // 0 unparsed out of 2
      );

      const evaluator = new BehavioralOverlapEvaluator({
        prototypeIntensityCalculator: mockIntensityCalculator,
        randomStateGenerator: mockRandomStateGenerator,
        contextBuilder: mockContextBuilder,
        prototypeGateChecker: mockGateChecker,
        gateConstraintExtractor: mockExtractor,
        gateImplicationEvaluator: mockGateImplicationEvaluator,
        config: mockConfig,
        logger: mockLogger,
      });

      const protoA = {
        gates: ['gate1', 'gate2', 'gate3'],
        weights: { axis1: 1.0 },
      };
      const protoB = { gates: ['gate1', 'gate2'], weights: { axis1: 1.0 } };

      const result = await evaluator.evaluate(protoA, protoB, 10);

      // A has 3 total gates, 1 unparsed → 2 parsed
      expect(result.gateParseInfo.prototypeA.totalGateCount).toBe(3);
      expect(result.gateParseInfo.prototypeA.parsedGateCount).toBe(2);

      // B has 2 total gates, 0 unparsed → 2 parsed
      expect(result.gateParseInfo.prototypeB.totalGateCount).toBe(2);
      expect(result.gateParseInfo.prototypeB.parsedGateCount).toBe(2);
    });

    it('should include unparsedGates arrays in gateParseInfo', async () => {
      const unparsedA = ['complex_gate_1', 'complex_gate_2'];
      const unparsedB = ['complex_gate_3'];
      const mockExtractor = createMockGateConstraintExtractor(
        'partial',
        'partial',
        unparsedA,
        unparsedB
      );

      const evaluator = new BehavioralOverlapEvaluator({
        prototypeIntensityCalculator: mockIntensityCalculator,
        randomStateGenerator: mockRandomStateGenerator,
        contextBuilder: mockContextBuilder,
        prototypeGateChecker: mockGateChecker,
        gateConstraintExtractor: mockExtractor,
        gateImplicationEvaluator: mockGateImplicationEvaluator,
        config: mockConfig,
        logger: mockLogger,
      });

      const protoA = {
        gates: ['gate1', 'complex_gate_1', 'complex_gate_2'],
        weights: { axis1: 1.0 },
      };
      const protoB = { gates: ['gate1', 'complex_gate_3'], weights: {} };

      const result = await evaluator.evaluate(protoA, protoB, 10);

      expect(result.gateParseInfo.prototypeA.unparsedGates).toEqual(unparsedA);
      expect(result.gateParseInfo.prototypeB.unparsedGates).toEqual(unparsedB);
    });

    it('should return empty unparsedGates arrays when all gates are parsed', async () => {
      const mockExtractor = createMockGateConstraintExtractor(
        'complete',
        'complete',
        [],
        []
      );

      const evaluator = new BehavioralOverlapEvaluator({
        prototypeIntensityCalculator: mockIntensityCalculator,
        randomStateGenerator: mockRandomStateGenerator,
        contextBuilder: mockContextBuilder,
        prototypeGateChecker: mockGateChecker,
        gateConstraintExtractor: mockExtractor,
        gateImplicationEvaluator: mockGateImplicationEvaluator,
        config: mockConfig,
        logger: mockLogger,
      });

      const protoA = { gates: ['gate1', 'gate2'], weights: { axis1: 1.0 } };
      const protoB = { gates: ['gate1'], weights: { axis1: 1.0 } };

      const result = await evaluator.evaluate(protoA, protoB, 10);

      expect(result.gateParseInfo.prototypeA.unparsedGates).toEqual([]);
      expect(result.gateParseInfo.prototypeB.unparsedGates).toEqual([]);
    });
  });
});
