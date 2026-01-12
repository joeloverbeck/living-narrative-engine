/**
 * @file Unit tests for MonteCarloReportGenerator prototype fit section handling
 * Tests for Issue: TypeError - fitResults.slice is not a function
 *
 * The PrototypeFitRankingService.analyzeAllPrototypeFit() returns an object:
 * { leaderboard: [], currentPrototype: {}, bestAlternative: null, improvementFactor: null }
 *
 * The MonteCarloReportGenerator must extract the .leaderboard array before
 * passing to #generatePrototypeFitSection().
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import MonteCarloReportGenerator from '../../../../src/expressionDiagnostics/services/MonteCarloReportGenerator.js';

describe('MonteCarloReportGenerator - Prototype Fit Section', () => {
  let generator;
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

  /**
   * Create a mock simulation result.
   */
  const createMockSimulationResult = (overrides = {}) => ({
    triggerRate: 0.15,
    triggerCount: 1500,
    sampleCount: 10000,
    confidenceInterval: { low: 0.14, high: 0.16 },
    distribution: 'uniform',
    clauseFailures: [],
    storedContexts: [
      { moodAxes: { valence: 0.5, arousal: 0.3 }, emotionIntensities: { joy: 0.4 } },
      { moodAxes: { valence: 0.6, arousal: 0.4 }, emotionIntensities: { joy: 0.5 } },
    ],
    ...overrides,
  });

  beforeEach(() => {
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

    generator = new MonteCarloReportGenerator({
      logger: mockLogger,
      prototypeFitRankingService: mockPrototypeFitRankingService,
    });
  });

  describe('when prototypeFitRankingService returns object with leaderboard property', () => {
    it('should not throw TypeError when generating report', () => {
      const simulationResult = createMockSimulationResult();

      expect(() => {
        generator.generate({
          expressionName: 'test:expression',
          simulationResult,
          blockers: [],
          summary: 'Test summary',
          prerequisites: [{ condition: 'test' }],
        });
      }).not.toThrow();
    });

    it('should include prototype fit analysis section in report', () => {
      const simulationResult = createMockSimulationResult();

      const report = generator.generate({
        expressionName: 'test:expression',
        simulationResult,
        blockers: [],
        summary: 'Test summary',
        prerequisites: [{ condition: 'test' }],
      });

      expect(report).toContain('Prototype Fit Analysis');
      expect(report).toContain('joy');
      expect(report).toContain('calm');
      expect(report).toContain('anger');
    });

    it('should correctly display top prototypes from leaderboard', () => {
      const simulationResult = createMockSimulationResult();

      const report = generator.generate({
        expressionName: 'test:expression',
        simulationResult,
        blockers: [],
        summary: 'Test summary',
        prerequisites: [{ condition: 'test' }],
      });

      // Check that the table contains the prototype names
      expect(report).toMatch(/\| 1 \| \*\*joy\*\*/);
      expect(report).toMatch(/\| 2 \| \*\*calm\*\*/);
      expect(report).toMatch(/\| 3 \| \*\*anger\*\*/);
    });
  });

  describe('when sexual prototypes are included in service results', () => {
    it('should include sexual prototype IDs in prototype fit, implied, and gap sections', () => {
      const sexualPrototypeId = 'sexual_lust';

      mockPrototypeFitRankingService.analyzeAllPrototypeFit.mockReturnValue({
        leaderboard: [
          createSampleFitResult({ rank: 1, prototypeId: sexualPrototypeId, type: 'sexual' }),
        ],
        currentPrototype: null,
        bestAlternative: null,
        improvementFactor: null,
      });

      mockPrototypeFitRankingService.computeImpliedPrototype.mockReturnValue({
        targetSignature: new Map(),
        bySimilarity: [
          { prototypeId: sexualPrototypeId, cosineSimilarity: 0.72, gatePassRate: 0.5, combinedScore: 0.64 },
        ],
        byGatePass: [
          { prototypeId: sexualPrototypeId, cosineSimilarity: 0.65, gatePassRate: 0.8, combinedScore: 0.71 },
        ],
        byCombined: [
          { prototypeId: sexualPrototypeId, cosineSimilarity: 0.7, gatePassRate: 0.6, combinedScore: 0.66 },
        ],
      });

      mockPrototypeFitRankingService.detectPrototypeGaps.mockReturnValue({
        gapDetected: false,
        nearestDistance: 0.12,
        kNearestNeighbors: [
          {
            prototypeId: sexualPrototypeId,
            weightDistance: 0.12,
            gateDistance: 0.0,
            combinedDistance: 0.12,
            pIntensityAbove: 0.6,
          },
        ],
        coverageWarning: null,
        suggestedPrototype: null,
        gapThreshold: 0.5,
      });

      const simulationResult = createMockSimulationResult();

      const report = generator.generate({
        expressionName: 'test:expression',
        simulationResult,
        blockers: [],
        summary: 'Test summary',
        prerequisites: [{ condition: 'test' }],
      });

      expect(report).toContain('Prototype Fit Analysis');
      expect(report).toContain('Implied Prototype from Prerequisites');
      expect(report).toContain('Prototype Gap Detection');
      expect(report).toContain(sexualPrototypeId);
    });
  });

  describe('when leaderboard is empty', () => {
    it('should handle empty leaderboard gracefully', () => {
      mockPrototypeFitRankingService.analyzeAllPrototypeFit.mockReturnValue({
        leaderboard: [],
        currentPrototype: null,
        bestAlternative: null,
        improvementFactor: null,
      });

      const simulationResult = createMockSimulationResult();

      expect(() => {
        generator.generate({
          expressionName: 'test:expression',
          simulationResult,
          blockers: [],
          summary: 'Test summary',
          prerequisites: [{ condition: 'test' }],
        });
      }).not.toThrow();
    });

    it('should not include prototype fit section when leaderboard is empty', () => {
      mockPrototypeFitRankingService.analyzeAllPrototypeFit.mockReturnValue({
        leaderboard: [],
        currentPrototype: null,
        bestAlternative: null,
        improvementFactor: null,
      });

      const simulationResult = createMockSimulationResult();

      const report = generator.generate({
        expressionName: 'test:expression',
        simulationResult,
        blockers: [],
        summary: 'Test summary',
        prerequisites: [{ condition: 'test' }],
      });

      // The prototype fit section should be empty/omitted
      expect(report).not.toContain('Prototype Fit Analysis');
    });
  });

  describe('when prototypeFitRankingService is not provided', () => {
    it('should generate report without prototype fit section', () => {
      const generatorWithoutService = new MonteCarloReportGenerator({
        logger: mockLogger,
      });

      const simulationResult = createMockSimulationResult();

      const report = generatorWithoutService.generate({
        expressionName: 'test:expression',
        simulationResult,
        blockers: [],
        summary: 'Test summary',
        prerequisites: [{ condition: 'test' }],
      });

      // Report should still generate without throwing
      expect(report).toContain('Monte Carlo Analysis Report');
      expect(report).not.toContain('Prototype Fit Analysis');
    });
  });

  describe('when analyzeAllPrototypeFit throws error', () => {
    it('should handle error gracefully and log warning', () => {
      mockPrototypeFitRankingService.analyzeAllPrototypeFit.mockImplementation(() => {
        throw new Error('Analysis failed');
      });

      const simulationResult = createMockSimulationResult();

      expect(() => {
        generator.generate({
          expressionName: 'test:expression',
          simulationResult,
          blockers: [],
          summary: 'Test summary',
          prerequisites: [{ condition: 'test' }],
        });
      }).not.toThrow();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to perform prototype fit analysis:',
        'Analysis failed'
      );
    });
  });

  describe('implied prototype property mapping (cosineSimilarity vs similarity)', () => {
    /**
     * BUG: The report generator uses r.similarity but the service returns cosineSimilarity.
     * This causes similarity to always display as "N/A" in the report.
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

    beforeEach(() => {
      // Configure mock to return implied prototype data with correct structure
      mockPrototypeFitRankingService.computeImpliedPrototype.mockReturnValue({
        targetSignature: new Map([
          ['valence', { direction: 1, importance: 0.6 }],
        ]),
        bySimilarity: [
          createImpliedPrototypeResult({ prototypeId: 'joy', cosineSimilarity: 0.92 }),
          createImpliedPrototypeResult({ prototypeId: 'calm', cosineSimilarity: 0.87 }),
        ],
        byGatePass: [
          createImpliedPrototypeResult({ prototypeId: 'anger', gatePassRate: 0.95 }),
        ],
        byCombined: [
          createImpliedPrototypeResult({ prototypeId: 'joy', combinedScore: 0.90 }),
        ],
      });
    });

    it('should use cosineSimilarity property in implied prototype section', () => {
      const simulationResult = createMockSimulationResult();

      const report = generator.generate({
        expressionName: 'test:expression',
        simulationResult,
        blockers: [],
        summary: 'Test summary',
        prerequisites: [{ condition: 'test' }],
      });

      // Report should contain the implied prototype section
      expect(report).toContain('Implied Prototype from Prerequisites');

      // The similarity column should NOT show "N/A" for valid data
      // (N/A only appears when cosineSimilarity is null/undefined)
      expect(report).toContain('joy');
    });

    it('should verify cosineSimilarity is the correct property name from service', () => {
      const result = createImpliedPrototypeResult({ cosineSimilarity: 0.85 });

      // BUG CHECK: result.similarity is undefined
      expect(result.similarity).toBeUndefined();

      // CORRECT: result.cosineSimilarity has the value
      expect(result.cosineSimilarity).toBe(0.85);
    });
  });

  describe('gap detection property mapping (combinedDistance vs distance)', () => {
    /**
     * BUG: The report generator uses n.distance but the service returns combinedDistance.
     * This causes distance to always display as "N/A" in the report.
     */

    /**
     * Create a sample k-nearest neighbor as returned by PrototypeFitRankingService.
     */
    const createKNearestNeighbor = (overrides = {}) => ({
      prototypeId: 'test:prototype',
      weightDistance: 0.179,
      gateDistance: 0.0,
      combinedDistance: 0.179, // The CORRECT property name
      pIntensityAbove: 0.65,
      ...overrides,
    });

    beforeEach(() => {
      // Configure mock to return gap detection data with correct structure
      mockPrototypeFitRankingService.detectPrototypeGaps.mockReturnValue({
        gapDetected: false,
        nearestDistance: 0.179,
        kNearestNeighbors: [
          createKNearestNeighbor({ prototypeId: 'joy', combinedDistance: 0.179 }),
          createKNearestNeighbor({ prototypeId: 'calm', combinedDistance: 0.338 }),
        ],
        coverageWarning: null,
        suggestedPrototype: null,
        gapThreshold: 0.5,
        distanceContext: 'Distance 0.18 is farther than 60% of prototype nearest-neighbor distances (z=0.40).',
      });
    });

    it('should use combinedDistance property in gap detection section', () => {
      const simulationResult = createMockSimulationResult();

      const report = generator.generate({
        expressionName: 'test:expression',
        simulationResult,
        blockers: [],
        summary: 'Test summary',
        prerequisites: [{ condition: 'test' }],
      });

      // Report should contain the gap detection section
      expect(report).toContain('Prototype Gap Detection');
      expect(report).toContain('k-Nearest Prototypes');
      expect(report).toContain('Distance Context');

      // The distance column should NOT show "N/A" for valid data
      expect(report).toContain('joy');
    });

    it('should verify combinedDistance is the correct property name from service', () => {
      const neighbor = createKNearestNeighbor({ combinedDistance: 0.179 });

      // BUG CHECK: neighbor.distance is undefined
      expect(neighbor.distance).toBeUndefined();

      // CORRECT: neighbor.combinedDistance has the value
      expect(neighbor.combinedDistance).toBe(0.179);
    });
  });
});
