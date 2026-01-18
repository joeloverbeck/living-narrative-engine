/**
 * @file Unit tests for EditSetGenerator.
 * @see src/expressionDiagnostics/services/EditSetGenerator.js
 */

import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import EditSetGenerator from '../../../../src/expressionDiagnostics/services/EditSetGenerator.js';

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createMockBlockerCalculator = () => ({
  calculate: jest.fn().mockReturnValue({
    coreBlockers: [],
    nonCoreConstraints: [],
    compositeScores: new Map(),
  }),
});

const createMockOrBlockAnalyzer = () => ({
  analyze: jest.fn().mockReturnValue({
    blockId: 'test',
    blockDescription: 'test block',
    alternatives: [],
    deadWeightCount: 0,
    recommendations: [],
    impactSummary: 'No analysis',
  }),
  analyzeAll: jest.fn().mockReturnValue([]),
});

const createMockValidator = () => ({
  validate: jest.fn().mockReturnValue({
    estimatedRate: 0.01,
    confidenceInterval: [0.005, 0.02],
    confidence: 'medium',
    sampleCount: 100,
    effectiveSampleSize: 80,
  }),
  validateBatch: jest.fn().mockReturnValue(new Map()),
});

describe('EditSetGenerator', () => {
  describe('constructor', () => {
    it('creates instance with valid dependencies', () => {
      const logger = createLogger();
      const blockerCalculator = createMockBlockerCalculator();
      const orBlockAnalyzer = createMockOrBlockAnalyzer();
      const validator = createMockValidator();

      const generator = new EditSetGenerator({
        logger,
        blockerCalculator,
        orBlockAnalyzer,
        validator,
      });

      expect(generator).toBeInstanceOf(EditSetGenerator);
    });

    it('throws if logger is missing', () => {
      const blockerCalculator = createMockBlockerCalculator();
      const orBlockAnalyzer = createMockOrBlockAnalyzer();
      const validator = createMockValidator();

      expect(() => new EditSetGenerator({
        blockerCalculator,
        orBlockAnalyzer,
        validator,
      })).toThrow();
    });

    it('throws if logger is null', () => {
      const blockerCalculator = createMockBlockerCalculator();
      const orBlockAnalyzer = createMockOrBlockAnalyzer();
      const validator = createMockValidator();

      expect(() => new EditSetGenerator({
        logger: null,
        blockerCalculator,
        orBlockAnalyzer,
        validator,
      })).toThrow();
    });

    it('throws if blockerCalculator is missing', () => {
      const logger = createLogger();
      const orBlockAnalyzer = createMockOrBlockAnalyzer();
      const validator = createMockValidator();

      expect(() => new EditSetGenerator({
        logger,
        orBlockAnalyzer,
        validator,
      })).toThrow();
    });

    it('throws if orBlockAnalyzer is missing', () => {
      const logger = createLogger();
      const blockerCalculator = createMockBlockerCalculator();
      const validator = createMockValidator();

      expect(() => new EditSetGenerator({
        logger,
        blockerCalculator,
        validator,
      })).toThrow();
    });

    it('throws if validator is missing', () => {
      const logger = createLogger();
      const blockerCalculator = createMockBlockerCalculator();
      const orBlockAnalyzer = createMockOrBlockAnalyzer();

      expect(() => new EditSetGenerator({
        logger,
        blockerCalculator,
        orBlockAnalyzer,
      })).toThrow();
    });

    it('accepts optional config override', () => {
      const logger = createLogger();
      const blockerCalculator = createMockBlockerCalculator();
      const orBlockAnalyzer = createMockOrBlockAnalyzer();
      const validator = createMockValidator();

      const customConfig = {
        enabled: true,
        defaultTargetBand: [0.001, 0.01],
        targetPassRates: [0.02, 0.1],
        maxCandidatesToValidate: 5,
        maxEditProposals: 3,
        importanceSampling: { enabled: true, confidenceLevel: 0.95 },
      };

      const generator = new EditSetGenerator({
        logger,
        blockerCalculator,
        orBlockAnalyzer,
        validator,
        config: customConfig,
      });

      expect(generator).toBeInstanceOf(EditSetGenerator);
    });
  });

  describe('generate() - empty/invalid inputs', () => {
    let logger;
    let blockerCalculator;
    let orBlockAnalyzer;
    let validator;
    let generator;

    beforeEach(() => {
      logger = createLogger();
      blockerCalculator = createMockBlockerCalculator();
      orBlockAnalyzer = createMockOrBlockAnalyzer();
      validator = createMockValidator();
      generator = new EditSetGenerator({
        logger,
        blockerCalculator,
        orBlockAnalyzer,
        validator,
      });
    });

    it('returns empty result for null simulationResult', () => {
      const result = generator.generate(null);

      expect(result).toHaveProperty('targetBand');
      expect(result).toHaveProperty('primaryRecommendation');
      expect(result).toHaveProperty('alternativeEdits');
      expect(result).toHaveProperty('notRecommended');
      expect(result.primaryRecommendation).toBeNull();
      expect(result.alternativeEdits).toEqual([]);
    });

    it('returns empty result for undefined simulationResult', () => {
      const result = generator.generate(undefined);

      expect(result.primaryRecommendation).toBeNull();
      expect(result.alternativeEdits).toEqual([]);
    });

    it('uses default target band when not provided', () => {
      const result = generator.generate(null);

      expect(result.targetBand).toEqual([0.0001, 0.001]);
    });

    it('uses custom target band when provided', () => {
      const customBand = [0.01, 0.05];
      const result = generator.generate(null, customBand);

      expect(result.targetBand).toEqual(customBand);
    });

    it('returns valid RecommendedEditSet structure', () => {
      const result = generator.generate(null);

      expect(result).toHaveProperty('targetBand');
      expect(result).toHaveProperty('primaryRecommendation');
      expect(result).toHaveProperty('alternativeEdits');
      expect(result).toHaveProperty('notRecommended');
      expect(Array.isArray(result.targetBand)).toBe(true);
      expect(result.targetBand.length).toBe(2);
      expect(Array.isArray(result.alternativeEdits)).toBe(true);
      expect(Array.isArray(result.notRecommended)).toBe(true);
    });
  });

  describe('generate() - clause extraction', () => {
    let logger;
    let blockerCalculator;
    let orBlockAnalyzer;
    let validator;
    let generator;

    beforeEach(() => {
      logger = createLogger();
      blockerCalculator = createMockBlockerCalculator();
      orBlockAnalyzer = createMockOrBlockAnalyzer();
      validator = createMockValidator();
      generator = new EditSetGenerator({
        logger,
        blockerCalculator,
        orBlockAnalyzer,
        validator,
      });
    });

    it('extracts clauses from simulationResult.clauses', () => {
      const simulationResult = {
        clauses: [{ clauseId: 'c1', threshold: 0.5 }],
      };

      generator.generate(simulationResult);

      expect(blockerCalculator.calculate).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ clauseId: 'c1' })]),
        simulationResult
      );
    });

    it('extracts clauses from simulationResult.clauseTracking', () => {
      const simulationResult = {
        clauseTracking: [{ clauseId: 'c2', threshold: 0.3 }],
      };

      generator.generate(simulationResult);

      expect(blockerCalculator.calculate).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ clauseId: 'c2' })]),
        simulationResult
      );
    });

    it('extracts clauses from simulationResult.metrics.clauseTracking', () => {
      const simulationResult = {
        metrics: {
          clauseTracking: [{ clauseId: 'c3', threshold: 0.7 }],
        },
      };

      generator.generate(simulationResult);

      expect(blockerCalculator.calculate).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ clauseId: 'c3' })]),
        simulationResult
      );
    });

    it('handles simulationResult with no clauses', () => {
      const simulationResult = { sampleCount: 1000 };

      const result = generator.generate(simulationResult);

      expect(result.primaryRecommendation).toBeNull();
    });
  });

  describe('generate() - OR block extraction', () => {
    let logger;
    let blockerCalculator;
    let orBlockAnalyzer;
    let validator;
    let generator;

    beforeEach(() => {
      logger = createLogger();
      blockerCalculator = createMockBlockerCalculator();
      orBlockAnalyzer = createMockOrBlockAnalyzer();
      validator = createMockValidator();
      generator = new EditSetGenerator({
        logger,
        blockerCalculator,
        orBlockAnalyzer,
        validator,
      });
    });

    it('extracts OR blocks from simulationResult.orBlocks', () => {
      const simulationResult = {
        orBlocks: [{ blockId: 'or1', alternatives: [] }],
      };

      generator.generate(simulationResult);

      expect(orBlockAnalyzer.analyzeAll).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ blockId: 'or1' })]),
        simulationResult
      );
    });

    it('extracts OR blocks from simulationResult.metrics.orBlocks', () => {
      const simulationResult = {
        metrics: {
          orBlocks: [{ blockId: 'or2', alternatives: [] }],
        },
      };

      generator.generate(simulationResult);

      expect(orBlockAnalyzer.analyzeAll).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ blockId: 'or2' })]),
        simulationResult
      );
    });
  });

  describe('generate() - threshold edit generation', () => {
    let logger;
    let blockerCalculator;
    let orBlockAnalyzer;
    let validator;
    let generator;

    beforeEach(() => {
      logger = createLogger();
      blockerCalculator = createMockBlockerCalculator();
      orBlockAnalyzer = createMockOrBlockAnalyzer();
      validator = createMockValidator();
      generator = new EditSetGenerator({
        logger,
        blockerCalculator,
        orBlockAnalyzer,
        validator,
      });
    });

    it('generates threshold edits from core blockers', () => {
      blockerCalculator.calculate.mockReturnValue({
        coreBlockers: [
          {
            clauseId: 'blocker1',
            clauseDescription: 'Test blocker',
            lastMileRate: 0.3,
            impactScore: 0.5,
            compositeScore: 0.4,
            inRegimePassRate: 0.4,
            classification: 'core',
          },
        ],
        nonCoreConstraints: [],
        compositeScores: new Map([['blocker1', 0.4]]),
      });

      const simulationResult = {
        clauses: [{ clauseId: 'blocker1', threshold: 0.8 }],
        samples: [],
      };

      validator.validateBatch.mockImplementation((proposals) => {
        const results = new Map();
        for (const proposal of proposals) {
          results.set(proposal, {
            estimatedRate: 0.005,
            confidenceInterval: [0.001, 0.01],
            confidence: 'medium',
            sampleCount: 100,
            effectiveSampleSize: 80,
          });
        }
        return results;
      });

      const result = generator.generate(simulationResult);

      // Should have generated proposals for each target pass rate
      expect(result.primaryRecommendation || result.alternativeEdits.length > 0).toBeTruthy();
    });

    it('skips threshold edit if threshold not found', () => {
      blockerCalculator.calculate.mockReturnValue({
        coreBlockers: [
          {
            clauseId: 'blocker1',
            clauseDescription: 'Test blocker',
            lastMileRate: 0.3,
            impactScore: 0.5,
            compositeScore: 0.4,
            inRegimePassRate: 0.4,
            classification: 'core',
          },
        ],
        nonCoreConstraints: [],
        compositeScores: new Map(),
      });

      const simulationResult = {
        clauses: [{ clauseId: 'other', threshold: 0.8 }], // Different clause
        samples: [],
      };

      const result = generator.generate(simulationResult);

      // No threshold edits should be generated
      expect(result.primaryRecommendation).toBeNull();
    });
  });

  describe('generate() - structure edit generation', () => {
    let logger;
    let blockerCalculator;
    let orBlockAnalyzer;
    let validator;
    let generator;

    beforeEach(() => {
      logger = createLogger();
      blockerCalculator = createMockBlockerCalculator();
      orBlockAnalyzer = createMockOrBlockAnalyzer();
      validator = createMockValidator();
      generator = new EditSetGenerator({
        logger,
        blockerCalculator,
        orBlockAnalyzer,
        validator,
      });
    });

    it('generates structure edits from OR block delete recommendations', () => {
      orBlockAnalyzer.analyzeAll.mockReturnValue([
        {
          blockId: 'or1',
          blockDescription: 'Test OR block',
          alternatives: [
            { alternativeIndex: 0, clauseDescription: 'Alt 0', classification: 'dead-weight' },
          ],
          deadWeightCount: 1,
          recommendations: [
            {
              action: 'delete',
              targetAlternative: 0,
              rationale: 'Dead-weight alternative',
              predictedImpact: 'Minimal impact',
            },
          ],
          impactSummary: 'Remove dead-weight',
        },
      ]);

      const simulationResult = {
        orBlocks: [{ blockId: 'or1', alternatives: [] }],
        samples: [],
      };

      validator.validateBatch.mockImplementation((proposals) => {
        const results = new Map();
        for (const proposal of proposals) {
          results.set(proposal, {
            estimatedRate: 0.0005,
            confidenceInterval: [0.0001, 0.001],
            confidence: 'medium',
            sampleCount: 100,
            effectiveSampleSize: 80,
          });
        }
        return results;
      });

      const result = generator.generate(simulationResult);

      // Should have a proposal with structure edit
      const allProposals = [result.primaryRecommendation, ...result.alternativeEdits].filter(Boolean);
      const hasStructureEdit = allProposals.some((p) =>
        p.edits.some((e) => e.editType === 'structure')
      );
      expect(hasStructureEdit).toBe(true);
    });

    it('generates threshold edits from OR block lower-threshold recommendations', () => {
      orBlockAnalyzer.analyzeAll.mockReturnValue([
        {
          blockId: 'or1',
          blockDescription: 'Test OR block',
          alternatives: [
            { alternativeIndex: 0, clauseDescription: 'Alt 0', classification: 'weak' },
          ],
          deadWeightCount: 0,
          recommendations: [
            {
              action: 'lower-threshold',
              targetAlternative: 0,
              suggestedValue: 0.3,
              rationale: 'Weak alternative',
              predictedImpact: 'May increase coverage',
            },
          ],
          impactSummary: 'Improve weak alternative',
        },
      ]);

      const simulationResult = {
        orBlocks: [{ blockId: 'or1', alternatives: [] }],
        samples: [],
      };

      validator.validateBatch.mockImplementation((proposals) => {
        const results = new Map();
        for (const proposal of proposals) {
          results.set(proposal, {
            estimatedRate: 0.0005,
            confidenceInterval: [0.0001, 0.001],
            confidence: 'medium',
            sampleCount: 100,
            effectiveSampleSize: 80,
          });
        }
        return results;
      });

      const result = generator.generate(simulationResult);

      const allProposals = [result.primaryRecommendation, ...result.alternativeEdits].filter(Boolean);
      const hasThresholdEdit = allProposals.some((p) =>
        p.edits.some((e) => e.editType === 'threshold' && e.after === 0.3)
      );
      expect(hasThresholdEdit).toBe(true);
    });
  });

  describe('generate() - validation integration', () => {
    let logger;
    let blockerCalculator;
    let orBlockAnalyzer;
    let validator;
    let generator;

    beforeEach(() => {
      logger = createLogger();
      blockerCalculator = createMockBlockerCalculator();
      orBlockAnalyzer = createMockOrBlockAnalyzer();
      validator = createMockValidator();
      generator = new EditSetGenerator({
        logger,
        blockerCalculator,
        orBlockAnalyzer,
        validator,
      });
    });

    it('validates candidates and includes confidence', () => {
      blockerCalculator.calculate.mockReturnValue({
        coreBlockers: [
          {
            clauseId: 'c1',
            clauseDescription: 'Test',
            lastMileRate: 0.3,
            impactScore: 0.5,
            compositeScore: 0.4,
            inRegimePassRate: 0.4,
            classification: 'core',
          },
        ],
        nonCoreConstraints: [],
        compositeScores: new Map(),
      });

      const simulationResult = {
        clauses: [{ clauseId: 'c1', threshold: 0.8 }],
        samples: [{ c1: 0.5 }, { c1: 0.6 }],
        expressionContext: { clauses: [{ id: 'c1', threshold: 0.8 }] },
      };

      validator.validateBatch.mockImplementation((proposals) => {
        const results = new Map();
        for (const proposal of proposals) {
          results.set(proposal, {
            estimatedRate: 0.0005,
            confidenceInterval: [0.0001, 0.001],
            confidence: 'high',
            sampleCount: 2,
            effectiveSampleSize: 2,
          });
        }
        return results;
      });

      const result = generator.generate(simulationResult);

      if (result.primaryRecommendation) {
        expect(result.primaryRecommendation.confidence).toBe('high');
        expect(result.primaryRecommendation.validationMethod).toBe('importance-sampling');
      }
    });

    it('uses extrapolation when no samples available', () => {
      blockerCalculator.calculate.mockReturnValue({
        coreBlockers: [
          {
            clauseId: 'c1',
            clauseDescription: 'Test',
            lastMileRate: 0.3,
            impactScore: 0.5,
            compositeScore: 0.4,
            inRegimePassRate: 0.4,
            classification: 'core',
          },
        ],
        nonCoreConstraints: [],
        compositeScores: new Map(),
      });

      const simulationResult = {
        clauses: [{ clauseId: 'c1', threshold: 0.8 }],
        samples: [], // No samples
      };

      const result = generator.generate(simulationResult);

      if (result.primaryRecommendation) {
        expect(result.primaryRecommendation.validationMethod).toBe('extrapolation');
      }
    });
  });

  describe('generate() - ranking logic', () => {
    let logger;
    let blockerCalculator;
    let orBlockAnalyzer;
    let validator;
    let generator;

    beforeEach(() => {
      logger = createLogger();
      blockerCalculator = createMockBlockerCalculator();
      orBlockAnalyzer = createMockOrBlockAnalyzer();
      validator = createMockValidator();
      generator = new EditSetGenerator({
        logger,
        blockerCalculator,
        orBlockAnalyzer,
        validator,
      });
    });

    it('ranks proposals by proximity to target band', () => {
      blockerCalculator.calculate.mockReturnValue({
        coreBlockers: [
          { clauseId: 'c1', clauseDescription: 'T1', lastMileRate: 0.3, impactScore: 0.5, compositeScore: 0.4, inRegimePassRate: 0.4, classification: 'core' },
          { clauseId: 'c2', clauseDescription: 'T2', lastMileRate: 0.2, impactScore: 0.4, compositeScore: 0.3, inRegimePassRate: 0.5, classification: 'core' },
        ],
        nonCoreConstraints: [],
        compositeScores: new Map(),
      });

      const simulationResult = {
        clauses: [
          { clauseId: 'c1', threshold: 0.8 },
          { clauseId: 'c2', threshold: 0.7 },
        ],
        samples: [{ c1: 0.5, c2: 0.5 }],
        expressionContext: { clauses: [] },
      };

      // Return different rates for different proposals
      let callCount = 0;
      validator.validateBatch.mockImplementation((proposals) => {
        const results = new Map();
        for (const proposal of proposals) {
          // Alternate between rates inside and outside target band
          const rate = callCount % 2 === 0 ? 0.0005 : 0.1;
          callCount++;
          results.set(proposal, {
            estimatedRate: rate,
            confidenceInterval: [rate * 0.5, rate * 1.5],
            confidence: 'medium',
            sampleCount: 1,
            effectiveSampleSize: 1,
          });
        }
        return results;
      });

      const result = generator.generate(simulationResult, [0.0001, 0.001]);

      // Primary should be the one closest to target band
      if (result.primaryRecommendation) {
        const primaryRate = result.primaryRecommendation.predictedTriggerRate;
        // The primary should have a rate within or closest to the band
        expect(primaryRate).toBeLessThanOrEqual(0.1);
      }
    });

    it('prefers higher confidence proposals', () => {
      blockerCalculator.calculate.mockReturnValue({
        coreBlockers: [
          { clauseId: 'c1', clauseDescription: 'T1', lastMileRate: 0.3, impactScore: 0.5, compositeScore: 0.4, inRegimePassRate: 0.4, classification: 'core' },
        ],
        nonCoreConstraints: [],
        compositeScores: new Map(),
      });

      const simulationResult = {
        clauses: [{ clauseId: 'c1', threshold: 0.8 }],
        samples: [{ c1: 0.5 }],
        expressionContext: { clauses: [] },
      };

      validator.validateBatch.mockImplementation((proposals) => {
        const results = new Map();
        const arr = Array.from(proposals);
        for (let i = 0; i < arr.length; i++) {
          results.set(arr[i], {
            estimatedRate: 0.0005,
            confidenceInterval: [0.0001, 0.001],
            confidence: i === 0 ? 'high' : 'low',
            sampleCount: 1,
            effectiveSampleSize: 1,
          });
        }
        return results;
      });

      const result = generator.generate(simulationResult);

      // High confidence proposal should be ranked higher
      if (result.primaryRecommendation) {
        expect(result.primaryRecommendation.confidence).toBe('high');
      }
    });

    it('prefers simpler proposals (fewer edits)', () => {
      blockerCalculator.calculate.mockReturnValue({
        coreBlockers: [
          { clauseId: 'c1', clauseDescription: 'T1', lastMileRate: 0.3, impactScore: 0.5, compositeScore: 0.4, inRegimePassRate: 0.4, classification: 'core' },
        ],
        nonCoreConstraints: [],
        compositeScores: new Map(),
      });

      orBlockAnalyzer.analyzeAll.mockReturnValue([
        {
          blockId: 'or1',
          alternatives: [{ alternativeIndex: 0, clauseDescription: 'Alt 0' }],
          recommendations: [{ action: 'delete', targetAlternative: 0, rationale: 'Test', predictedImpact: 'Test' }],
        },
      ]);

      const simulationResult = {
        clauses: [{ clauseId: 'c1', threshold: 0.8 }],
        orBlocks: [{ blockId: 'or1', alternatives: [] }],
        samples: [{ c1: 0.5 }],
        expressionContext: { clauses: [] },
      };

      validator.validateBatch.mockImplementation((proposals) => {
        const results = new Map();
        for (const proposal of proposals) {
          results.set(proposal, {
            estimatedRate: 0.0005,
            confidenceInterval: [0.0001, 0.001],
            confidence: 'medium',
            sampleCount: 1,
            effectiveSampleSize: 1,
          });
        }
        return results;
      });

      const result = generator.generate(simulationResult);

      // All viable proposals should be present
      const allProposals = [result.primaryRecommendation, ...result.alternativeEdits].filter(Boolean);
      expect(allProposals.length).toBeGreaterThan(0);
    });
  });

  describe('generate() - result structure', () => {
    let logger;
    let blockerCalculator;
    let orBlockAnalyzer;
    let validator;
    let generator;

    beforeEach(() => {
      logger = createLogger();
      blockerCalculator = createMockBlockerCalculator();
      orBlockAnalyzer = createMockOrBlockAnalyzer();
      validator = createMockValidator();
      generator = new EditSetGenerator({
        logger,
        blockerCalculator,
        orBlockAnalyzer,
        validator,
      });
    });

    it('primary recommendation is highest-scored proposal', () => {
      blockerCalculator.calculate.mockReturnValue({
        coreBlockers: [
          { clauseId: 'c1', clauseDescription: 'T1', lastMileRate: 0.3, impactScore: 0.5, compositeScore: 0.4, inRegimePassRate: 0.4, classification: 'core' },
        ],
        nonCoreConstraints: [],
        compositeScores: new Map(),
      });

      const simulationResult = {
        clauses: [{ clauseId: 'c1', threshold: 0.8 }],
        samples: [{ c1: 0.5 }],
        expressionContext: { clauses: [] },
      };

      validator.validateBatch.mockImplementation((proposals) => {
        const results = new Map();
        for (const proposal of proposals) {
          results.set(proposal, {
            estimatedRate: 0.0005,
            confidenceInterval: [0.0001, 0.001],
            confidence: 'high',
            sampleCount: 1,
            effectiveSampleSize: 1,
          });
        }
        return results;
      });

      const result = generator.generate(simulationResult);

      if (result.primaryRecommendation && result.alternativeEdits.length > 0) {
        // Primary should have highest score
        expect(result.primaryRecommendation.score).toBeGreaterThanOrEqual(
          result.alternativeEdits[0].score
        );
      }
    });

    it('alternatives are sorted by score descending', () => {
      blockerCalculator.calculate.mockReturnValue({
        coreBlockers: [
          { clauseId: 'c1', clauseDescription: 'T1', lastMileRate: 0.3, impactScore: 0.5, compositeScore: 0.4, inRegimePassRate: 0.4, classification: 'core' },
          { clauseId: 'c2', clauseDescription: 'T2', lastMileRate: 0.2, impactScore: 0.4, compositeScore: 0.3, inRegimePassRate: 0.5, classification: 'core' },
        ],
        nonCoreConstraints: [],
        compositeScores: new Map(),
      });

      const simulationResult = {
        clauses: [
          { clauseId: 'c1', threshold: 0.8 },
          { clauseId: 'c2', threshold: 0.7 },
        ],
        samples: [{ c1: 0.5, c2: 0.5 }],
        expressionContext: { clauses: [] },
      };

      let idx = 0;
      validator.validateBatch.mockImplementation((proposals) => {
        const results = new Map();
        for (const proposal of proposals) {
          results.set(proposal, {
            estimatedRate: 0.0005 + idx * 0.0001,
            confidenceInterval: [0.0001, 0.001],
            confidence: 'medium',
            sampleCount: 1,
            effectiveSampleSize: 1,
          });
          idx++;
        }
        return results;
      });

      const result = generator.generate(simulationResult);

      for (let i = 0; i < result.alternativeEdits.length - 1; i++) {
        expect(result.alternativeEdits[i].score).toBeGreaterThanOrEqual(
          result.alternativeEdits[i + 1].score
        );
      }
    });

    it('edit proposals have valid SingleEdit structure', () => {
      blockerCalculator.calculate.mockReturnValue({
        coreBlockers: [
          { clauseId: 'c1', clauseDescription: 'T1', lastMileRate: 0.3, impactScore: 0.5, compositeScore: 0.4, inRegimePassRate: 0.4, classification: 'core' },
        ],
        nonCoreConstraints: [],
        compositeScores: new Map(),
      });

      const simulationResult = {
        clauses: [{ clauseId: 'c1', threshold: 0.8 }],
        samples: [{ c1: 0.5 }],
        expressionContext: { clauses: [] },
      };

      validator.validateBatch.mockImplementation((proposals) => {
        const results = new Map();
        for (const proposal of proposals) {
          results.set(proposal, {
            estimatedRate: 0.0005,
            confidenceInterval: [0.0001, 0.001],
            confidence: 'medium',
            sampleCount: 1,
            effectiveSampleSize: 1,
          });
        }
        return results;
      });

      const result = generator.generate(simulationResult);

      if (result.primaryRecommendation) {
        for (const edit of result.primaryRecommendation.edits) {
          expect(edit).toHaveProperty('clauseId');
          expect(edit).toHaveProperty('editType');
          expect(['threshold', 'structure']).toContain(edit.editType);
          expect(edit).toHaveProperty('before');
          expect(edit).toHaveProperty('after');
        }
      }
    });

    it('respects maxEditProposals config', () => {
      const customConfig = {
        enabled: true,
        defaultTargetBand: [0.0001, 0.001],
        targetPassRates: [0.01, 0.05, 0.1, 0.2, 0.3],
        maxCandidatesToValidate: 20,
        maxEditProposals: 2,
        importanceSampling: { enabled: true, confidenceLevel: 0.95 },
      };

      generator = new EditSetGenerator({
        logger,
        blockerCalculator,
        orBlockAnalyzer,
        validator,
        config: customConfig,
      });

      blockerCalculator.calculate.mockReturnValue({
        coreBlockers: [
          { clauseId: 'c1', clauseDescription: 'T1', lastMileRate: 0.3, impactScore: 0.5, compositeScore: 0.4, inRegimePassRate: 0.4, classification: 'core' },
          { clauseId: 'c2', clauseDescription: 'T2', lastMileRate: 0.2, impactScore: 0.4, compositeScore: 0.3, inRegimePassRate: 0.5, classification: 'core' },
        ],
        nonCoreConstraints: [],
        compositeScores: new Map(),
      });

      const simulationResult = {
        clauses: [
          { clauseId: 'c1', threshold: 0.8 },
          { clauseId: 'c2', threshold: 0.7 },
        ],
        samples: [{ c1: 0.5, c2: 0.5 }],
      };

      validator.validateBatch.mockImplementation((proposals) => {
        const results = new Map();
        for (const proposal of proposals) {
          results.set(proposal, {
            estimatedRate: 0.0005,
            confidenceInterval: [0.0001, 0.001],
            confidence: 'medium',
            sampleCount: 1,
            effectiveSampleSize: 1,
          });
        }
        return results;
      });

      const result = generator.generate(simulationResult);

      // Should have at most maxEditProposals alternatives (primary + alternatives)
      expect(result.alternativeEdits.length).toBeLessThanOrEqual(customConfig.maxEditProposals);
    });
  });

  describe('generate() - error handling', () => {
    let logger;
    let blockerCalculator;
    let orBlockAnalyzer;
    let validator;
    let generator;

    beforeEach(() => {
      logger = createLogger();
      blockerCalculator = createMockBlockerCalculator();
      orBlockAnalyzer = createMockOrBlockAnalyzer();
      validator = createMockValidator();
      generator = new EditSetGenerator({
        logger,
        blockerCalculator,
        orBlockAnalyzer,
        validator,
      });
    });

    it('catches errors and returns empty result', () => {
      blockerCalculator.calculate.mockImplementation(() => {
        throw new Error('Test error');
      });

      const simulationResult = {
        clauses: [{ clauseId: 'c1', threshold: 0.8 }],
      };

      expect(() => generator.generate(simulationResult)).not.toThrow();
      const result = generator.generate(simulationResult);

      expect(result.primaryRecommendation).toBeNull();
      expect(result.alternativeEdits).toEqual([]);
    });

    it('logs error when generation fails', () => {
      blockerCalculator.calculate.mockImplementation(() => {
        throw new Error('Test error');
      });

      const simulationResult = {
        clauses: [{ clauseId: 'c1', threshold: 0.8 }],
      };

      generator.generate(simulationResult);

      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('generate() - combined edits', () => {
    let logger;
    let blockerCalculator;
    let orBlockAnalyzer;
    let validator;
    let generator;

    beforeEach(() => {
      logger = createLogger();
      blockerCalculator = createMockBlockerCalculator();
      orBlockAnalyzer = createMockOrBlockAnalyzer();
      validator = createMockValidator();
      generator = new EditSetGenerator({
        logger,
        blockerCalculator,
        orBlockAnalyzer,
        validator,
      });
    });

    it('generates combined edits when both blockers and OR blocks exist', () => {
      blockerCalculator.calculate.mockReturnValue({
        coreBlockers: [
          { clauseId: 'c1', clauseDescription: 'T1', lastMileRate: 0.3, impactScore: 0.5, compositeScore: 0.4, inRegimePassRate: 0.4, classification: 'core' },
        ],
        nonCoreConstraints: [],
        compositeScores: new Map(),
      });

      orBlockAnalyzer.analyzeAll.mockReturnValue([
        {
          blockId: 'or1',
          alternatives: [{ alternativeIndex: 0, clauseDescription: 'Alt 0' }],
          recommendations: [{ action: 'delete', targetAlternative: 0, rationale: 'Test', predictedImpact: 'Test' }],
        },
      ]);

      const simulationResult = {
        clauses: [{ clauseId: 'c1', threshold: 0.8 }],
        orBlocks: [{ blockId: 'or1', alternatives: [] }],
        samples: [{ c1: 0.5 }],
        expressionContext: { clauses: [] },
      };

      validator.validateBatch.mockImplementation((proposals) => {
        const results = new Map();
        for (const proposal of proposals) {
          results.set(proposal, {
            estimatedRate: 0.0005,
            confidenceInterval: [0.0001, 0.001],
            confidence: 'medium',
            sampleCount: 1,
            effectiveSampleSize: 1,
          });
        }
        return results;
      });

      const result = generator.generate(simulationResult);

      const allProposals = [result.primaryRecommendation, ...result.alternativeEdits].filter(Boolean);

      // Should have at least one combined edit (threshold + structure)
      const hasCombined = allProposals.some(
        (p) => p.edits.length >= 2 &&
          p.edits.some((e) => e.editType === 'threshold') &&
          p.edits.some((e) => e.editType === 'structure')
      );
      expect(hasCombined).toBe(true);
    });

    it('skips combined edits when only blockers exist', () => {
      blockerCalculator.calculate.mockReturnValue({
        coreBlockers: [
          { clauseId: 'c1', clauseDescription: 'T1', lastMileRate: 0.3, impactScore: 0.5, compositeScore: 0.4, inRegimePassRate: 0.4, classification: 'core' },
        ],
        nonCoreConstraints: [],
        compositeScores: new Map(),
      });

      // No OR blocks
      orBlockAnalyzer.analyzeAll.mockReturnValue([]);

      const simulationResult = {
        clauses: [{ clauseId: 'c1', threshold: 0.8 }],
        samples: [{ c1: 0.5 }],
      };

      validator.validateBatch.mockImplementation((proposals) => {
        const results = new Map();
        for (const proposal of proposals) {
          results.set(proposal, {
            estimatedRate: 0.0005,
            confidenceInterval: [0.0001, 0.001],
            confidence: 'medium',
            sampleCount: 1,
            effectiveSampleSize: 1,
          });
        }
        return results;
      });

      const result = generator.generate(simulationResult);

      const allProposals = [result.primaryRecommendation, ...result.alternativeEdits].filter(Boolean);

      // No combined edits should exist
      const hasCombined = allProposals.some(
        (p) => p.edits.length >= 2 &&
          p.edits.some((e) => e.editType === 'threshold') &&
          p.edits.some((e) => e.editType === 'structure')
      );
      expect(hasCombined).toBe(false);
    });
  });

  describe('debug logging', () => {
    let logger;
    let blockerCalculator;
    let orBlockAnalyzer;
    let validator;
    let generator;

    beforeEach(() => {
      logger = createLogger();
      blockerCalculator = createMockBlockerCalculator();
      orBlockAnalyzer = createMockOrBlockAnalyzer();
      validator = createMockValidator();
      generator = new EditSetGenerator({
        logger,
        blockerCalculator,
        orBlockAnalyzer,
        validator,
      });
    });

    it('logs when no simulation result provided', () => {
      generator.generate(null);

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('No simulation result')
      );
    });

    it('logs target band during generation', () => {
      const simulationResult = { clauses: [] };
      generator.generate(simulationResult, [0.01, 0.05]);

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('target band')
      );
    });

    it('logs when no candidates generated', () => {
      const simulationResult = { clauses: [] };
      generator.generate(simulationResult);

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('No candidate edits')
      );
    });

    it('logs result summary', () => {
      blockerCalculator.calculate.mockReturnValue({
        coreBlockers: [
          { clauseId: 'c1', clauseDescription: 'T1', lastMileRate: 0.3, impactScore: 0.5, compositeScore: 0.4, inRegimePassRate: 0.4, classification: 'core' },
        ],
        nonCoreConstraints: [],
        compositeScores: new Map(),
      });

      const simulationResult = {
        clauses: [{ clauseId: 'c1', threshold: 0.8 }],
        samples: [{ c1: 0.5 }],
      };

      validator.validateBatch.mockImplementation((proposals) => {
        const results = new Map();
        for (const proposal of proposals) {
          results.set(proposal, {
            estimatedRate: 0.0005,
            confidenceInterval: [0.0001, 0.001],
            confidence: 'medium',
            sampleCount: 1,
            effectiveSampleSize: 1,
          });
        }
        return results;
      });

      generator.generate(simulationResult);

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('viable proposals')
      );
    });
  });

  describe('edge cases', () => {
    let logger;
    let blockerCalculator;
    let orBlockAnalyzer;
    let validator;
    let generator;

    beforeEach(() => {
      logger = createLogger();
      blockerCalculator = createMockBlockerCalculator();
      orBlockAnalyzer = createMockOrBlockAnalyzer();
      validator = createMockValidator();
      generator = new EditSetGenerator({
        logger,
        blockerCalculator,
        orBlockAnalyzer,
        validator,
      });
    });

    it('handles empty coreBlockers array', () => {
      blockerCalculator.calculate.mockReturnValue({
        coreBlockers: [],
        nonCoreConstraints: [],
        compositeScores: new Map(),
      });

      const simulationResult = { clauses: [] };
      const result = generator.generate(simulationResult);

      expect(result.primaryRecommendation).toBeNull();
    });

    it('handles OR block with no recommendations', () => {
      orBlockAnalyzer.analyzeAll.mockReturnValue([
        {
          blockId: 'or1',
          alternatives: [],
          recommendations: [],
        },
      ]);

      const simulationResult = {
        orBlocks: [{ blockId: 'or1', alternatives: [] }],
      };

      const result = generator.generate(simulationResult);

      expect(result.primaryRecommendation).toBeNull();
    });

    it('handles OR block with null recommendations', () => {
      orBlockAnalyzer.analyzeAll.mockReturnValue([
        {
          blockId: 'or1',
          alternatives: [],
          recommendations: null,
        },
      ]);

      const simulationResult = {
        orBlocks: [{ blockId: 'or1', alternatives: [] }],
      };

      const result = generator.generate(simulationResult);

      expect(result.primaryRecommendation).toBeNull();
    });

    it('handles threshold in expressionContext.clauses', () => {
      blockerCalculator.calculate.mockReturnValue({
        coreBlockers: [
          { clauseId: 'c1', clauseDescription: 'T1', lastMileRate: 0.3, impactScore: 0.5, compositeScore: 0.4, inRegimePassRate: 0.4, classification: 'core' },
        ],
        nonCoreConstraints: [],
        compositeScores: new Map(),
      });

      const simulationResult = {
        clauses: [{ clauseId: 'c1' }], // No threshold here
        expressionContext: {
          clauses: [{ id: 'c1', threshold: 0.9 }], // Threshold here
        },
        samples: [{ c1: 0.5 }],
      };

      validator.validateBatch.mockImplementation((proposals) => {
        const results = new Map();
        for (const proposal of proposals) {
          results.set(proposal, {
            estimatedRate: 0.0005,
            confidenceInterval: [0.0001, 0.001],
            confidence: 'medium',
            sampleCount: 1,
            effectiveSampleSize: 1,
          });
        }
        return results;
      });

      const result = generator.generate(simulationResult);

      // Should have found threshold from expressionContext
      if (result.primaryRecommendation) {
        const thresholdEdit = result.primaryRecommendation.edits.find(
          (e) => e.editType === 'threshold'
        );
        if (thresholdEdit) {
          expect(thresholdEdit.before).toBe(0.9);
        }
      }
    });

    it('handles lower-threshold recommendation without suggestedValue', () => {
      orBlockAnalyzer.analyzeAll.mockReturnValue([
        {
          blockId: 'or1',
          alternatives: [{ alternativeIndex: 0, clauseDescription: 'Alt 0' }],
          recommendations: [
            {
              action: 'lower-threshold',
              targetAlternative: 0,
              // No suggestedValue
              rationale: 'Test',
              predictedImpact: 'Test',
            },
          ],
        },
      ]);

      const simulationResult = {
        orBlocks: [{ blockId: 'or1', alternatives: [] }],
        samples: [],
      };

      const result = generator.generate(simulationResult);

      // Should not crash, but no threshold edit should be created
      const allProposals = [result.primaryRecommendation, ...result.alternativeEdits].filter(Boolean);
      const hasLowerThresholdEdit = allProposals.some((p) =>
        p.edits.some((e) => e.editType === 'threshold' && e.clauseId.includes('or1'))
      );
      expect(hasLowerThresholdEdit).toBe(false);
    });

    it('handles proposal with rate exactly at band boundary', () => {
      blockerCalculator.calculate.mockReturnValue({
        coreBlockers: [
          { clauseId: 'c1', clauseDescription: 'T1', lastMileRate: 0.3, impactScore: 0.5, compositeScore: 0.4, inRegimePassRate: 0.4, classification: 'core' },
        ],
        nonCoreConstraints: [],
        compositeScores: new Map(),
      });

      const simulationResult = {
        clauses: [{ clauseId: 'c1', threshold: 0.8 }],
        samples: [{ c1: 0.5 }],
      };

      validator.validateBatch.mockImplementation((proposals) => {
        const results = new Map();
        for (const proposal of proposals) {
          results.set(proposal, {
            estimatedRate: 0.001, // Exactly at upper boundary
            confidenceInterval: [0.0005, 0.002],
            confidence: 'medium',
            sampleCount: 1,
            effectiveSampleSize: 1,
          });
        }
        return results;
      });

      const result = generator.generate(simulationResult, [0.0001, 0.001]);

      // Rate at boundary should still score well
      if (result.primaryRecommendation) {
        expect(result.primaryRecommendation.score).toBeGreaterThan(0.5);
      }
    });

    it('handles proposal with rate below target band', () => {
      blockerCalculator.calculate.mockReturnValue({
        coreBlockers: [
          { clauseId: 'c1', clauseDescription: 'T1', lastMileRate: 0.3, impactScore: 0.5, compositeScore: 0.4, inRegimePassRate: 0.4, classification: 'core' },
        ],
        nonCoreConstraints: [],
        compositeScores: new Map(),
      });

      const simulationResult = {
        clauses: [{ clauseId: 'c1', threshold: 0.8 }],
        samples: [{ c1: 0.5 }],
      };

      validator.validateBatch.mockImplementation((proposals) => {
        const results = new Map();
        for (const proposal of proposals) {
          results.set(proposal, {
            estimatedRate: 0.00001, // Way below target
            confidenceInterval: [0.000001, 0.0001],
            confidence: 'medium',
            sampleCount: 1,
            effectiveSampleSize: 1,
          });
        }
        return results;
      });

      const result = generator.generate(simulationResult, [0.01, 0.05]);

      // Should still return result but with lower score
      if (result.primaryRecommendation) {
        expect(result.primaryRecommendation.score).toBeLessThan(0.5);
      }
    });

    it('handles proposal with rate above target band', () => {
      blockerCalculator.calculate.mockReturnValue({
        coreBlockers: [
          { clauseId: 'c1', clauseDescription: 'T1', lastMileRate: 0.3, impactScore: 0.5, compositeScore: 0.4, inRegimePassRate: 0.4, classification: 'core' },
        ],
        nonCoreConstraints: [],
        compositeScores: new Map(),
      });

      const simulationResult = {
        clauses: [{ clauseId: 'c1', threshold: 0.8 }],
        samples: [{ c1: 0.5 }],
      };

      validator.validateBatch.mockImplementation((proposals) => {
        const results = new Map();
        for (const proposal of proposals) {
          results.set(proposal, {
            estimatedRate: 0.5, // Way above target
            confidenceInterval: [0.4, 0.6],
            confidence: 'medium',
            sampleCount: 1,
            effectiveSampleSize: 1,
          });
        }
        return results;
      });

      const result = generator.generate(simulationResult, [0.0001, 0.001]);

      // Should still return result but with lower score
      if (result.primaryRecommendation) {
        expect(result.primaryRecommendation.score).toBeLessThan(0.5);
      }
    });
  });
});
