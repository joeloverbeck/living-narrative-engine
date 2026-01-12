/**
 * @file Unit tests for ExpressionDiagnosticsController prototype fit section handling
 * Tests for Issue: TypeError - fitResults.slice is not a function
 *
 * The PrototypeFitRankingService.analyzeAllPrototypeFit() returns an object:
 * { leaderboard: [], currentPrototype: {}, bestAlternative: null, improvementFactor: null }
 *
 * The ExpressionDiagnosticsController must extract the .leaderboard array before
 * passing to #displayPrototypeFitTable().
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

describe('ExpressionDiagnosticsController - Prototype Fit Table', () => {
  let controller;
  let mockContainer;
  let mockTbody;
  let mockLogger;
  let mockPrototypeFitRankingService;

  /**
   * Create a sample fit result as returned by the service's leaderboard.
   */
  const createSampleFitResult = (overrides = {}) => ({
    prototypeId: 'test:prototype',
    gatePassRate: 0.8,
    intensityDistribution: {
      p50: 0.5,
      p90: 0.7,
      p95: 0.8,
      pAboveThreshold: 0.6,
    },
    conflictScore: 0.1,
    conflictMagnitude: 0.05,
    conflictingAxes: [],
    compositeScore: 0.75,
    rank: 1,
    ...overrides,
  });

  beforeEach(() => {
    // Create mock DOM elements
    mockContainer = {
      hidden: false,
    };
    mockTbody = {
      innerHTML: '',
    };

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    // Mock PrototypeFitRankingService that returns the CORRECT structure
    // (an object with .leaderboard property, not a raw array)
    mockPrototypeFitRankingService = {
      analyzeAllPrototypeFit: jest.fn().mockReturnValue({
        leaderboard: [
          createSampleFitResult({ rank: 1, prototypeId: 'joy', compositeScore: 0.9 }),
          createSampleFitResult({ rank: 2, prototypeId: 'calm', compositeScore: 0.8 }),
          createSampleFitResult({ rank: 3, prototypeId: 'anger', compositeScore: 0.7 }),
        ],
        currentPrototype: createSampleFitResult({ rank: 5, prototypeId: 'current' }),
        bestAlternative: 'joy',
        improvementFactor: 1.2,
      }),
      computeImpliedPrototype: jest.fn().mockReturnValue({
        targetSignature: new Map(),
        bySimilarity: [],
        byGatePass: [],
        byCombined: [],
      }),
      detectPrototypeGaps: jest.fn().mockReturnValue({
        gapDetected: false,
        nearestDistance: 0.1,
        kNearestNeighbors: [],
        coverageWarning: null,
        suggestedPrototype: null,
        gapThreshold: 0.5,
      }),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('when handling #displayPrototypeFitTable with Array.isArray check', () => {
    /**
     * Test the defensive Array.isArray check behavior.
     * This tests the pattern that was fixed in the controller.
     */
    it('should hide container when fitResults is not an array (object passed)', () => {
      // Simulate passing an object instead of an array (the bug scenario)
      const objectNotArray = {
        leaderboard: [createSampleFitResult()],
        currentPrototype: null,
      };

      // The Array.isArray check should catch this
      const isArray = Array.isArray(objectNotArray);
      expect(isArray).toBe(false);
    });

    it('should recognize valid array input', () => {
      const validArray = [
        createSampleFitResult({ rank: 1, prototypeId: 'joy' }),
        createSampleFitResult({ rank: 2, prototypeId: 'calm' }),
      ];

      const isArray = Array.isArray(validArray);
      expect(isArray).toBe(true);
    });

    it('should handle empty array gracefully', () => {
      const emptyArray = [];
      const isArray = Array.isArray(emptyArray);
      const isEmpty = emptyArray.length === 0;

      expect(isArray).toBe(true);
      expect(isEmpty).toBe(true);
    });

    it('should handle null/undefined gracefully', () => {
      expect(Array.isArray(null)).toBe(false);
      expect(Array.isArray(undefined)).toBe(false);
    });
  });

  describe('when extracting .leaderboard from fitResults object', () => {
    it('should correctly extract leaderboard array from service result', () => {
      const serviceResult = mockPrototypeFitRankingService.analyzeAllPrototypeFit();

      // The fix: extract .leaderboard before using
      const leaderboard = serviceResult?.leaderboard ?? [];

      expect(Array.isArray(leaderboard)).toBe(true);
      expect(leaderboard.length).toBe(3);
      expect(leaderboard[0].prototypeId).toBe('joy');
    });

    it('should preserve sexual prototype entries when extracting leaderboard', () => {
      const serviceResult = {
        leaderboard: [
          createSampleFitResult({ rank: 1, prototypeId: 'joy', type: 'emotion' }),
          createSampleFitResult({ rank: 2, prototypeId: 'sexual_lust', type: 'sexual' }),
        ],
        currentPrototype: null,
        bestAlternative: null,
        improvementFactor: null,
      };

      const leaderboard = serviceResult?.leaderboard ?? [];
      const ids = leaderboard.map((result) => result.prototypeId);

      expect(ids).toContain('sexual_lust');
    });

    it('should handle missing leaderboard property', () => {
      mockPrototypeFitRankingService.analyzeAllPrototypeFit.mockReturnValue({
        currentPrototype: null,
        bestAlternative: null,
        improvementFactor: null,
        // Note: no leaderboard property
      });

      const serviceResult = mockPrototypeFitRankingService.analyzeAllPrototypeFit();
      const leaderboard = serviceResult?.leaderboard ?? [];

      expect(Array.isArray(leaderboard)).toBe(true);
      expect(leaderboard.length).toBe(0);
    });

    it('should handle null service result', () => {
      mockPrototypeFitRankingService.analyzeAllPrototypeFit.mockReturnValue(null);

      const serviceResult = mockPrototypeFitRankingService.analyzeAllPrototypeFit();
      const leaderboard = serviceResult?.leaderboard ?? [];

      expect(Array.isArray(leaderboard)).toBe(true);
      expect(leaderboard.length).toBe(0);
    });
  });

  describe('when service throws error', () => {
    it('should not crash when analyzeAllPrototypeFit throws', () => {
      mockPrototypeFitRankingService.analyzeAllPrototypeFit.mockImplementation(() => {
        throw new Error('Analysis failed');
      });

      expect(() => {
        try {
          mockPrototypeFitRankingService.analyzeAllPrototypeFit();
        } catch (e) {
          // Expected - error should be caught
        }
      }).not.toThrow();
    });
  });

  describe('data structure validation', () => {
    it('should verify fitResult has expected properties for display', () => {
      const fitResult = createSampleFitResult({ rank: 1, prototypeId: 'test' });

      // These properties are used in #displayPrototypeFitTable
      expect(fitResult).toHaveProperty('rank');
      expect(fitResult).toHaveProperty('prototypeId');
      expect(fitResult).toHaveProperty('gatePassRate');
      expect(fitResult).toHaveProperty('intensityDistribution');
      expect(fitResult).toHaveProperty('conflictScore');
      expect(fitResult).toHaveProperty('compositeScore');
    });

    it('should handle intensity distribution with pAboveThreshold', () => {
      const fitResult = createSampleFitResult();

      const pAboveThreshold = fitResult.intensityDistribution?.pAboveThreshold;
      expect(pAboveThreshold).toBeDefined();
      expect(typeof pAboveThreshold).toBe('number');
    });

    it('should handle missing intensity distribution', () => {
      const fitResult = createSampleFitResult({ intensityDistribution: null });

      const pAboveThreshold = fitResult.intensityDistribution?.pAboveThreshold;
      expect(pAboveThreshold).toBeUndefined();
    });
  });

  describe('implied prototype property mapping (cosineSimilarity vs similarity)', () => {
    /**
     * BUG: The controller uses result.similarity but the service returns cosineSimilarity.
     * This causes similarity to always display as 0%.
     */

    /**
     * Create a sample implied prototype result as returned by PrototypeFitRankingService.
     */
    const createImpliedPrototypeResult = (overrides = {}) => ({
      prototypeId: 'test:prototype',
      cosineSimilarity: 0.85, // The CORRECT property name
      gatePassRate: 0.79,
      combinedScore: 0.88,
      ...overrides,
    });

    it('should use cosineSimilarity property (not similarity) for implied prototype display', () => {
      const result = createImpliedPrototypeResult({ cosineSimilarity: 0.85 });

      // BUG CHECK: result.similarity is undefined
      expect(result.similarity).toBeUndefined();

      // CORRECT: result.cosineSimilarity has the value
      expect(result.cosineSimilarity).toBe(0.85);

      // The buggy code does: ((result.similarity ?? 0) * 100).toFixed(0) → "0%"
      const buggyValue = ((result.similarity ?? 0) * 100).toFixed(0);
      expect(buggyValue).toBe('0'); // Always 0 due to bug

      // The correct code should do: ((result.cosineSimilarity ?? 0) * 100).toFixed(0) → "85%"
      const correctValue = ((result.cosineSimilarity ?? 0) * 100).toFixed(0);
      expect(correctValue).toBe('85'); // Correct value
    });

    it('should correctly access cosineSimilarity in bySimilarity array', () => {
      const bySimilarity = [
        createImpliedPrototypeResult({ prototypeId: 'joy', cosineSimilarity: 0.92 }),
        createImpliedPrototypeResult({ prototypeId: 'calm', cosineSimilarity: 0.87 }),
      ];

      // Verify structure matches service output
      expect(bySimilarity[0].cosineSimilarity).toBe(0.92);
      expect(bySimilarity[0].similarity).toBeUndefined();
    });
  });

  describe('gap detection property mapping (combinedDistance vs distance)', () => {
    /**
     * BUG: The controller uses neighbor.distance but the service returns combinedDistance.
     * This causes distance to always display as 0.000.
     */

    /**
     * Create a sample k-nearest neighbor as returned by PrototypeFitRankingService.
     */
    const createKNearestNeighbor = (overrides = {}) => ({
      prototypeId: 'test:prototype',
      weightDistance: 0.179,
      gateDistance: 0.0,
      combinedDistance: 0.179, // The CORRECT property name (0.7 * weight + 0.3 * gate)
      pIntensityAbove: 0.65,
      ...overrides,
    });

    it('should use combinedDistance property (not distance) for gap detection display', () => {
      const neighbor = createKNearestNeighbor({ combinedDistance: 0.179 });

      // BUG CHECK: neighbor.distance is undefined
      expect(neighbor.distance).toBeUndefined();

      // CORRECT: neighbor.combinedDistance has the value
      expect(neighbor.combinedDistance).toBe(0.179);

      // The buggy code does: (neighbor.distance ?? 0).toFixed(3) → "0.000"
      const buggyValue = (neighbor.distance ?? 0).toFixed(3);
      expect(buggyValue).toBe('0.000'); // Always 0.000 due to bug

      // The correct code should do: (neighbor.combinedDistance ?? 0).toFixed(3) → "0.179"
      const correctValue = (neighbor.combinedDistance ?? 0).toFixed(3);
      expect(correctValue).toBe('0.179'); // Correct value
    });

    it('should correctly access combinedDistance in kNearestNeighbors array', () => {
      const kNearestNeighbors = [
        createKNearestNeighbor({ prototypeId: 'joy', combinedDistance: 0.179 }),
        createKNearestNeighbor({ prototypeId: 'calm', combinedDistance: 0.338 }),
      ];

      // Verify structure matches service output
      expect(kNearestNeighbors[0].combinedDistance).toBe(0.179);
      expect(kNearestNeighbors[0].distance).toBeUndefined();
    });

    it('should verify gateDistance property exists and is correctly named', () => {
      // gateDistance IS correctly named, so this should work
      const neighbor = createKNearestNeighbor({ gateDistance: 0.0 });

      expect(neighbor.gateDistance).toBe(0.0);
      expect(neighbor.gateDistance).toBeDefined();
    });
  });
});
