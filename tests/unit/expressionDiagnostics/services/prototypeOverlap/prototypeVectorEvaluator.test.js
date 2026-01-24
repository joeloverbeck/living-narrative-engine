/**
 * @file Unit tests for PrototypeVectorEvaluator
 * @see src/expressionDiagnostics/services/prototypeOverlap/PrototypeVectorEvaluator.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import PrototypeVectorEvaluator from '../../../../../src/expressionDiagnostics/services/prototypeOverlap/PrototypeVectorEvaluator.js';

describe('PrototypeVectorEvaluator', () => {
  let mockLogger;
  let mockGateChecker;
  let mockIntensityCalculator;
  let mockContextAxisNormalizer;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    mockGateChecker = {
      checkAllGatesPass: jest.fn((gates, ctx) => ctx.pass ?? true),
      preParseGates: jest.fn((gates) => gates.map((g) => ({ gate: g }))),
      checkParsedGatesPass: jest.fn((parsedGates, normalizedCtx) => normalizedCtx.pass ?? true),
    };
    mockIntensityCalculator = {
      computeIntensity: jest.fn((weights, ctx) => ctx.intensity ?? 0),
      computeIntensityFromNormalized: jest.fn((weights, normalizedCtx) => normalizedCtx.intensity ?? 0),
    };
    mockContextAxisNormalizer = {
      getNormalizedAxes: jest.fn((ctx) => ({
        moodAxes: {},
        sexualAxes: {},
        traitAxes: {},
        pass: ctx.pass,
        intensity: ctx.intensity,
      })),
    };
  });

  describe('constructor', () => {
    it('creates instance with valid dependencies', () => {
      const evaluator = new PrototypeVectorEvaluator({
        prototypeGateChecker: mockGateChecker,
        prototypeIntensityCalculator: mockIntensityCalculator,
        contextAxisNormalizer: mockContextAxisNormalizer,
        logger: mockLogger,
      });

      expect(evaluator).toBeInstanceOf(PrototypeVectorEvaluator);
    });

    it('throws when logger is missing', () => {
      expect(() => {
        new PrototypeVectorEvaluator({
          prototypeGateChecker: mockGateChecker,
          prototypeIntensityCalculator: mockIntensityCalculator,
          contextAxisNormalizer: mockContextAxisNormalizer,
          logger: null,
        });
      }).toThrow();
    });

    it('throws when gate checker is missing required methods', () => {
      expect(() => {
        new PrototypeVectorEvaluator({
          prototypeGateChecker: {},
          prototypeIntensityCalculator: mockIntensityCalculator,
          contextAxisNormalizer: mockContextAxisNormalizer,
          logger: mockLogger,
        });
      }).toThrow();
    });

    it('throws when intensity calculator is missing required methods', () => {
      expect(() => {
        new PrototypeVectorEvaluator({
          prototypeGateChecker: mockGateChecker,
          prototypeIntensityCalculator: {},
          contextAxisNormalizer: mockContextAxisNormalizer,
          logger: mockLogger,
        });
      }).toThrow();
    });

    it('throws when context axis normalizer is missing required methods', () => {
      expect(() => {
        new PrototypeVectorEvaluator({
          prototypeGateChecker: mockGateChecker,
          prototypeIntensityCalculator: mockIntensityCalculator,
          contextAxisNormalizer: {},
          logger: mockLogger,
        });
      }).toThrow();
    });
  });

  describe('evaluateAll', () => {
    it('evaluates a single prototype and returns output vectors', async () => {
      const evaluator = new PrototypeVectorEvaluator({
        prototypeGateChecker: mockGateChecker,
        prototypeIntensityCalculator: mockIntensityCalculator,
        contextAxisNormalizer: mockContextAxisNormalizer,
        logger: mockLogger,
      });

      const prototype = { id: 'proto-a', gates: [], weights: { valence: 1 } };
      const contextPool = [
        { pass: true, intensity: 0.2 },
        { pass: false, intensity: 0.9 },
        { pass: true, intensity: 0.6 },
        { pass: false, intensity: 0.4 },
      ];

      const result = await evaluator.evaluateAll([prototype], contextPool);
      const vector = result.get('proto-a');

      expect(vector.prototypeId).toBe('proto-a');
      expect(vector.gateResults).toBeInstanceOf(Float32Array);
      expect(vector.intensities).toBeInstanceOf(Float32Array);
      expect(Array.from(vector.gateResults)).toEqual([1, 0, 1, 0]);
      const intensities = Array.from(vector.intensities);
      expect(intensities[0]).toBeCloseTo(0.2, 5);
      expect(intensities[1]).toBeCloseTo(0, 5);
      expect(intensities[2]).toBeCloseTo(0.6, 5);
      expect(intensities[3]).toBeCloseTo(0, 5);
      expect(vector.activationRate).toBeCloseTo(0.5, 5);
      expect(vector.meanIntensity).toBeCloseTo(0.4, 5);
      expect(vector.stdIntensity).toBeCloseTo(0.2, 5);
    });

    it('evaluates multiple prototypes in a batch', async () => {
      const evaluator = new PrototypeVectorEvaluator({
        prototypeGateChecker: mockGateChecker,
        prototypeIntensityCalculator: mockIntensityCalculator,
        contextAxisNormalizer: mockContextAxisNormalizer,
        logger: mockLogger,
      });

      const prototypes = [
        { id: 'proto-a', gates: [], weights: { valence: 1 } },
        { id: 'proto-b', gates: [], weights: { valence: 1 } },
      ];
      const contextPool = [
        { pass: true, intensity: 0.3 },
        { pass: true, intensity: 0.7 },
      ];

      const result = await evaluator.evaluateAll(prototypes, contextPool);

      expect(result.size).toBe(2);
      expect(result.get('proto-a')).toBeDefined();
      expect(result.get('proto-b')).toBeDefined();
    });

    it('returns empty vectors for an empty context pool', async () => {
      const evaluator = new PrototypeVectorEvaluator({
        prototypeGateChecker: mockGateChecker,
        prototypeIntensityCalculator: mockIntensityCalculator,
        contextAxisNormalizer: mockContextAxisNormalizer,
        logger: mockLogger,
      });

      const prototype = { id: 'proto-a', gates: [], weights: { valence: 1 } };

      const result = await evaluator.evaluateAll([prototype], []);
      const vector = result.get('proto-a');

      expect(vector.gateResults.length).toBe(0);
      expect(vector.intensities.length).toBe(0);
      expect(vector.activationRate).toBe(0);
      expect(vector.meanIntensity).toBe(0);
      expect(vector.stdIntensity).toBe(0);
    });

    it('throws when a prototype is missing id', async () => {
      const evaluator = new PrototypeVectorEvaluator({
        prototypeGateChecker: mockGateChecker,
        prototypeIntensityCalculator: mockIntensityCalculator,
        contextAxisNormalizer: mockContextAxisNormalizer,
        logger: mockLogger,
      });

      await expect(
        evaluator.evaluateAll([{ gates: [], weights: {} }], [{ pass: true }])
      ).rejects.toThrow('invalid prototype');
    });

    it('yields to the event loop during long evaluations', async () => {
      const evaluator = new PrototypeVectorEvaluator({
        prototypeGateChecker: mockGateChecker,
        prototypeIntensityCalculator: mockIntensityCalculator,
        contextAxisNormalizer: mockContextAxisNormalizer,
        logger: mockLogger,
      });

      const originalRequestIdleCallback = globalThis.requestIdleCallback;
      const idleSpy = jest.fn((cb) => cb());
      globalThis.requestIdleCallback = idleSpy;

      const prototype = { id: 'proto-a', gates: [], weights: { valence: 1 } };
      const contextPool = Array.from({ length: 501 }, () => ({
        pass: true,
        intensity: 0.4,
      }));

      await evaluator.evaluateAll([prototype], contextPool);

      expect(idleSpy).toHaveBeenCalled();

      globalThis.requestIdleCallback = originalRequestIdleCallback;
    });

    it('calls onProgress callback for each prototype evaluated', async () => {
      const evaluator = new PrototypeVectorEvaluator({
        prototypeGateChecker: mockGateChecker,
        prototypeIntensityCalculator: mockIntensityCalculator,
        contextAxisNormalizer: mockContextAxisNormalizer,
        logger: mockLogger,
      });

      const prototypes = [
        { id: 'proto-a', gates: [], weights: {} },
        { id: 'proto-b', gates: [], weights: {} },
        { id: 'proto-c', gates: [], weights: {} },
      ];
      const contextPool = [{ pass: true, intensity: 0.5 }];
      const progressCalls = [];

      await evaluator.evaluateAll(prototypes, contextPool, (current, total) => {
        progressCalls.push({ current, total });
      });

      expect(progressCalls).toEqual([
        { current: 1, total: 3 },
        { current: 2, total: 3 },
        { current: 3, total: 3 },
      ]);
    });

    it('calls onProgress callback for empty context pool', async () => {
      const evaluator = new PrototypeVectorEvaluator({
        prototypeGateChecker: mockGateChecker,
        prototypeIntensityCalculator: mockIntensityCalculator,
        contextAxisNormalizer: mockContextAxisNormalizer,
        logger: mockLogger,
      });

      const prototypes = [
        { id: 'proto-a', gates: [], weights: {} },
        { id: 'proto-b', gates: [], weights: {} },
      ];
      const contextPool = [];
      const progressCalls = [];

      await evaluator.evaluateAll(prototypes, contextPool, (current, total) => {
        progressCalls.push({ current, total });
      });

      expect(progressCalls).toEqual([
        { current: 1, total: 2 },
        { current: 2, total: 2 },
      ]);
    });

    it('does not throw when onProgress is null', async () => {
      const evaluator = new PrototypeVectorEvaluator({
        prototypeGateChecker: mockGateChecker,
        prototypeIntensityCalculator: mockIntensityCalculator,
        contextAxisNormalizer: mockContextAxisNormalizer,
        logger: mockLogger,
      });

      const prototypes = [{ id: 'proto-a', gates: [], weights: {} }];
      const contextPool = [{ pass: true, intensity: 0.5 }];

      await expect(
        evaluator.evaluateAll(prototypes, contextPool, null)
      ).resolves.not.toThrow();
    });
  });
});
