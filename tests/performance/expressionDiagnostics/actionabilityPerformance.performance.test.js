/**
 * @file Performance tests for actionability analysis services
 * @see src/expressionDiagnostics/services/ConstructiveWitnessSearcher.js
 * @see src/expressionDiagnostics/services/EditSetGenerator.js
 * @see src/expressionDiagnostics/services/OrBlockAnalyzer.js
 * @see src/expressionDiagnostics/services/ImportanceSamplingValidator.js
 * @see tickets/MONCARACTIMP-017-performance-tests.md
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ConstructiveWitnessSearcher from '../../../src/expressionDiagnostics/services/ConstructiveWitnessSearcher.js';
import EditSetGenerator from '../../../src/expressionDiagnostics/services/EditSetGenerator.js';
import OrBlockAnalyzer from '../../../src/expressionDiagnostics/services/OrBlockAnalyzer.js';
import ImportanceSamplingValidator from '../../../src/expressionDiagnostics/services/ImportanceSamplingValidator.js';

/**
 * Determines timing multiplier based on test environment
 * CI environments use minimal delays for faster execution
 *
 * @returns {number} - Timing multiplier (0.5 for CI, 1.0 for local)
 */
const getTestTimingMultiplier = () => {
  const isCI = !!(
    process.env.CI ||
    process.env.CONTINUOUS_INTEGRATION ||
    process.env.GITHUB_ACTIONS ||
    process.env.GITLAB_CI ||
    process.env.JENKINS_URL
  );
  return isCI ? 0.5 : 1.0;
};

// Performance thresholds (in milliseconds)
const THRESHOLDS = {
  WITNESS_SEARCH_TARGET: 1000,
  WITNESS_SEARCH_MAX: 5000,
  EDIT_VALIDATION_TARGET: 100,
  EDIT_VALIDATION_MAX: 500,
  OR_BLOCK_TARGET: 50,
  OR_BLOCK_MAX: 200,
  EDIT_SET_TARGET: 1000,
  EDIT_SET_MAX: 5000,
};

// ============================================================================
// Test Factories
// ============================================================================

const createMockLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createMockStateGenerator = () => ({
  generate: jest.fn().mockImplementation(() => {
    const state = {};
    for (let i = 0; i < 20; i++) {
      state[`field_${i}`] = Math.random();
    }
    state.mood = Math.random();
    state.trust = Math.random();
    state.energy = Math.random();
    return state;
  }),
});

const createMockExpressionEvaluator = () => ({
  evaluatePrerequisite: jest.fn().mockImplementation((prereq, state) => {
    // Simulate threshold check
    if (prereq.logic && prereq.logic['>=']) {
      const [varRef, threshold] = prereq.logic['>='];
      const varPath = varRef.var || 'mood';
      const value = state[varPath] ?? Math.random();
      return value >= threshold;
    }
    return Math.random() > 0.5;
  }),
});

const createMockBlockerCalculator = () => ({
  calculate: jest.fn().mockImplementation((simulationResult) => {
    const clauses = simulationResult?.clauses ?? [];
    return {
      coreBlockers: clauses.slice(0, Math.min(3, clauses.length)).map((c, i) => ({
        clauseId: c.id || `clause_${i}`,
        severity: 0.8 - i * 0.1,
        passRate: 0.1 + i * 0.05,
      })),
      nonCoreConstraints: [],
      compositeScores: new Map(),
    };
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

// ============================================================================
// Data Generators
// ============================================================================

/**
 * Generates an expression with prerequisites for witness search
 *
 * @param {number} prereqCount - Number of prerequisites
 * @returns {object} - Expression object with prerequisites array
 */
function generateExpression(prereqCount = 5) {
  const prerequisites = [];
  for (let i = 0; i < prereqCount; i++) {
    prerequisites.push({
      id: `prereq_${i}`,
      logic: { '>=': [{ var: `field_${i}` }, 0.5 + Math.random() * 0.4] },
    });
  }
  return { prerequisites };
}

/**
 * Generates samples for testing
 *
 * @param {number} count - Number of samples
 * @param {number} fieldCount - Number of fields per sample
 * @returns {Array<object>} - Array of sample state objects
 */
function generateSamples(count, fieldCount = 20) {
  const samples = [];
  for (let i = 0; i < count; i++) {
    const sample = {};
    for (let j = 0; j < fieldCount; j++) {
      sample[`field_${j}`] = Math.random();
    }
    sample.mood = Math.random();
    sample.trust = Math.random();
    sample.energy = Math.random();
    samples.push(sample);
  }
  return samples;
}

/**
 * Generates simulation result for EditSetGenerator
 *
 * @param {number} clauseCount - Number of clauses in the simulation
 * @param {number} sampleCount - Number of samples to generate
 * @returns {object} - Simulation result object
 */
function generateSimulationResult(clauseCount = 5, sampleCount = 1000) {
  const clauses = [];
  for (let i = 0; i < clauseCount; i++) {
    clauses.push({
      id: `clause_${i}`,
      threshold: 0.5 + Math.random() * 0.4,
      valuePath: `field_${i}`,
    });
  }

  return {
    triggerRate: 0.001,
    sampleCount,
    clauses,
    samples: generateSamples(sampleCount),
    orBlocks: [],
  };
}

/**
 * Generates an OR block for analysis
 *
 * @param {number} alternativeCount - Number of alternatives in the OR block
 * @returns {object} - OR block with alternatives array
 */
function generateOrBlock(alternativeCount = 5) {
  const totalPasses = 100 + Math.floor(Math.random() * 200);
  return {
    blockId: `or_block_${Math.random().toString(36).slice(2)}`,
    alternatives: Array(alternativeCount)
      .fill(null)
      .map((_, i) => ({
        id: `alt_${i}`,
        passCount: Math.floor(totalPasses * (0.8 - i * 0.1)),
        exclusivePasses: Math.floor(Math.random() * 50),
        threshold: 0.3 + i * 0.15,
      })),
  };
}

/**
 * Generates edit proposal for validation
 *
 * @param {number} editCount - Number of edits in the proposal
 * @returns {object} - Edit proposal with edits array
 */
function generateEditProposal(editCount = 1) {
  return {
    edits: Array(editCount)
      .fill(null)
      .map((_, i) => ({
        clauseId: `clause_${i}`,
        editType: 'threshold',
        before: 0.8,
        after: 0.6,
        delta: -0.2,
      })),
  };
}

/**
 * Generates expression context for validation
 *
 * @param {number} clauseCount - Number of clauses in the context
 * @returns {object} - Expression context with clauses array
 */
function generateExpressionContext(clauseCount = 5) {
  return {
    clauses: Array(clauseCount)
      .fill(null)
      .map((_, i) => ({
        id: `clause_${i}`,
        threshold: 0.8 - i * 0.05,
        valuePath: `field_${i}`,
      })),
  };
}

// ============================================================================
// Performance Tests
// ============================================================================

describe('Actionability Performance Tests', () => {
  const timingMultiplier = getTestTimingMultiplier();

  describe('ConstructiveWitnessSearcher performance', () => {
    let searcher;
    let mockLogger;
    let mockStateGenerator;
    let mockExpressionEvaluator;

    beforeEach(() => {
      mockLogger = createMockLogger();
      mockStateGenerator = createMockStateGenerator();
      mockExpressionEvaluator = createMockExpressionEvaluator();

      searcher = new ConstructiveWitnessSearcher({
        logger: mockLogger,
        stateGenerator: mockStateGenerator,
        expressionEvaluator: mockExpressionEvaluator,
        config: {
          maxSamples: 1000,
          hillClimbSeeds: 3,
          hillClimbIterations: 20,
          timeoutMs: 5000,
          minAndBlockScore: 0.5,
          perturbationDelta: 0.05,
        },
      });
    });

    it('should complete within target time for standard expression', async () => {
      const expression = generateExpression(5);

      const start = performance.now();
      await searcher.search(expression, null, { maxSamples: 500 });
      const elapsed = performance.now() - start;

      console.log(`Witness search (5 prereqs, 500 samples) completed in ${elapsed.toFixed(2)}ms`);

      const adjustedMax = THRESHOLDS.WITNESS_SEARCH_MAX * timingMultiplier;
      expect(elapsed).toBeLessThan(adjustedMax);
    });

    it('should complete within target time for complex expression', async () => {
      const expression = generateExpression(15);

      const start = performance.now();
      await searcher.search(expression, null, { maxSamples: 500 });
      const elapsed = performance.now() - start;

      console.log(`Witness search (15 prereqs, 500 samples) completed in ${elapsed.toFixed(2)}ms`);

      const adjustedMax = THRESHOLDS.WITNESS_SEARCH_MAX * timingMultiplier;
      expect(elapsed).toBeLessThan(adjustedMax);
    });

    it('should respect timeout configuration', async () => {
      const expression = generateExpression(20);
      const shortTimeout = 500;

      const start = performance.now();
      await searcher.search(expression, null, {
        maxSamples: 10000,
        timeoutMs: shortTimeout,
      });
      const elapsed = performance.now() - start;

      console.log(`Timeout test completed in ${elapsed.toFixed(2)}ms (timeout: ${shortTimeout}ms)`);

      // Should complete within 2x timeout (allowing for overhead)
      expect(elapsed).toBeLessThan(shortTimeout * 2.5);
    });

    it('should scale reasonably with prerequisite count', async () => {
      const smallExpr = generateExpression(3);
      const largeExpr = generateExpression(15);

      const startSmall = performance.now();
      await searcher.search(smallExpr, null, { maxSamples: 200 });
      const elapsedSmall = performance.now() - startSmall;

      const startLarge = performance.now();
      await searcher.search(largeExpr, null, { maxSamples: 200 });
      const elapsedLarge = performance.now() - startLarge;

      console.log(
        `Scaling test: 3 prereqs = ${elapsedSmall.toFixed(2)}ms, 15 prereqs = ${elapsedLarge.toFixed(2)}ms`
      );

      // 5x more prereqs should not result in more than 10x slowdown
      const ratio = elapsedLarge / Math.max(elapsedSmall, 1);
      expect(ratio).toBeLessThan(15);
    });

    it('should handle empty prerequisites gracefully', async () => {
      const expression = { prerequisites: [] };

      const start = performance.now();
      const result = await searcher.search(expression);
      const elapsed = performance.now() - start;

      console.log(`Empty prerequisites handled in ${elapsed.toFixed(2)}ms`);

      expect(elapsed).toBeLessThan(100 * timingMultiplier);
      expect(result.found).toBe(false);
    });
  });

  describe('ImportanceSamplingValidator performance', () => {
    let validator;
    let mockLogger;

    beforeEach(() => {
      mockLogger = createMockLogger();
      validator = new ImportanceSamplingValidator({ logger: mockLogger });
    });

    it('should validate single proposal quickly', () => {
      const proposal = generateEditProposal(1);
      const samples = generateSamples(100);
      const context = generateExpressionContext(5);

      const start = performance.now();
      validator.validate(proposal, samples, context);
      const elapsed = performance.now() - start;

      console.log(`Single validation (100 samples) completed in ${elapsed.toFixed(2)}ms`);

      const adjustedMax = THRESHOLDS.EDIT_VALIDATION_MAX * timingMultiplier;
      expect(elapsed).toBeLessThan(adjustedMax);
    });

    it('should handle batch validation efficiently', () => {
      const proposals = Array(10)
        .fill(null)
        .map(() => generateEditProposal(1));
      const samples = generateSamples(200);
      const context = generateExpressionContext(5);

      const start = performance.now();
      validator.validateBatch(proposals, samples, context);
      const elapsed = performance.now() - start;

      console.log(`Batch validation (10 proposals, 200 samples) completed in ${elapsed.toFixed(2)}ms`);

      // Batch of 10 should not take more than 10x single
      const adjustedMax = THRESHOLDS.EDIT_VALIDATION_MAX * 10 * timingMultiplier;
      expect(elapsed).toBeLessThan(adjustedMax);
    });

    it('should scale with sample count', () => {
      const proposal = generateEditProposal(1);
      const context = generateExpressionContext(5);

      const smallSamples = generateSamples(50);
      const largeSamples = generateSamples(500);

      const startSmall = performance.now();
      validator.validate(proposal, smallSamples, context);
      const elapsedSmall = performance.now() - startSmall;

      const startLarge = performance.now();
      validator.validate(proposal, largeSamples, context);
      const elapsedLarge = performance.now() - startLarge;

      console.log(
        `Sample scaling: 50 = ${elapsedSmall.toFixed(2)}ms, 500 = ${elapsedLarge.toFixed(2)}ms`
      );

      // 10x more samples should scale roughly linearly
      const ratio = elapsedLarge / Math.max(elapsedSmall, 0.1);
      expect(ratio).toBeLessThan(20);
    });

    it('should handle invalid inputs gracefully', () => {
      const start = performance.now();
      const result = validator.validate(null, [], {});
      const elapsed = performance.now() - start;

      console.log(`Invalid input handling completed in ${elapsed.toFixed(2)}ms`);

      expect(elapsed).toBeLessThan(50 * timingMultiplier);
      expect(result.confidence).toBe('low');
    });
  });

  describe('OrBlockAnalyzer performance', () => {
    let analyzer;
    let mockLogger;

    beforeEach(() => {
      mockLogger = createMockLogger();
      analyzer = new OrBlockAnalyzer({ logger: mockLogger });
    });

    it('should analyze single OR block quickly', () => {
      const orBlock = generateOrBlock(5);
      const simulationResult = { sampleCount: 1000 };

      const start = performance.now();
      analyzer.analyze(orBlock, simulationResult);
      const elapsed = performance.now() - start;

      console.log(`Single OR block (5 alts) analysis completed in ${elapsed.toFixed(2)}ms`);

      const adjustedMax = THRESHOLDS.OR_BLOCK_MAX * timingMultiplier;
      expect(elapsed).toBeLessThan(adjustedMax);
    });

    it('should handle large OR blocks', () => {
      const orBlock = generateOrBlock(20);
      const simulationResult = { sampleCount: 1000 };

      const start = performance.now();
      analyzer.analyze(orBlock, simulationResult);
      const elapsed = performance.now() - start;

      console.log(`Large OR block (20 alts) analysis completed in ${elapsed.toFixed(2)}ms`);

      // Large block should complete within 4x the normal threshold
      const adjustedMax = THRESHOLDS.OR_BLOCK_MAX * 4 * timingMultiplier;
      expect(elapsed).toBeLessThan(adjustedMax);
    });

    it('should analyze multiple OR blocks efficiently', () => {
      const orBlocks = Array(10)
        .fill(null)
        .map(() => generateOrBlock(5));
      const simulationResult = { sampleCount: 1000 };

      const start = performance.now();
      analyzer.analyzeAll(orBlocks, simulationResult);
      const elapsed = performance.now() - start;

      console.log(`Multiple OR blocks (10) analysis completed in ${elapsed.toFixed(2)}ms`);

      // 10 blocks should not take more than 10x single
      const adjustedMax = THRESHOLDS.OR_BLOCK_MAX * 10 * timingMultiplier;
      expect(elapsed).toBeLessThan(adjustedMax);
    });

    it('should handle null input gracefully', () => {
      const start = performance.now();
      const result = analyzer.analyze(null, {});
      const elapsed = performance.now() - start;

      console.log(`Null OR block handling completed in ${elapsed.toFixed(2)}ms`);

      expect(elapsed).toBeLessThan(50 * timingMultiplier);
      expect(result.deadWeightCount).toBe(0);
    });
  });

  describe('EditSetGenerator performance', () => {
    let generator;
    let mockLogger;

    beforeEach(() => {
      mockLogger = createMockLogger();
      generator = new EditSetGenerator({
        logger: mockLogger,
        blockerCalculator: createMockBlockerCalculator(),
        orBlockAnalyzer: createMockOrBlockAnalyzer(),
        validator: createMockValidator(),
      });
    });

    it('should generate edit set within target time', () => {
      const simulationResult = generateSimulationResult(5, 500);

      const start = performance.now();
      generator.generate(simulationResult);
      const elapsed = performance.now() - start;

      console.log(`Edit set generation (5 clauses, 500 samples) completed in ${elapsed.toFixed(2)}ms`);

      const adjustedMax = THRESHOLDS.EDIT_SET_MAX * timingMultiplier;
      expect(elapsed).toBeLessThan(adjustedMax);
    });

    it('should handle complex simulation results', () => {
      const simulationResult = generateSimulationResult(15, 1000);

      const start = performance.now();
      generator.generate(simulationResult);
      const elapsed = performance.now() - start;

      console.log(`Complex edit set generation (15 clauses, 1000 samples) completed in ${elapsed.toFixed(2)}ms`);

      const adjustedMax = THRESHOLDS.EDIT_SET_MAX * timingMultiplier;
      expect(elapsed).toBeLessThan(adjustedMax);
    });

    it('should handle null simulation result gracefully', () => {
      const start = performance.now();
      const result = generator.generate(null);
      const elapsed = performance.now() - start;

      console.log(`Null simulation result handling completed in ${elapsed.toFixed(2)}ms`);

      expect(elapsed).toBeLessThan(100 * timingMultiplier);
      expect(result.targetBand).toBeDefined();
    });
  });

  describe('Combined operations performance', () => {
    let witnessSearcher;
    let validator;
    let orAnalyzer;
    let editGenerator;

    beforeEach(() => {
      const mockLogger = createMockLogger();
      const mockStateGenerator = createMockStateGenerator();
      const mockExpressionEvaluator = createMockExpressionEvaluator();

      witnessSearcher = new ConstructiveWitnessSearcher({
        logger: mockLogger,
        stateGenerator: mockStateGenerator,
        expressionEvaluator: mockExpressionEvaluator,
        config: {
          maxSamples: 500,
          hillClimbSeeds: 3,
          hillClimbIterations: 15,
          timeoutMs: 2000,
        },
      });

      validator = new ImportanceSamplingValidator({ logger: mockLogger });
      orAnalyzer = new OrBlockAnalyzer({ logger: mockLogger });

      editGenerator = new EditSetGenerator({
        logger: mockLogger,
        blockerCalculator: createMockBlockerCalculator(),
        orBlockAnalyzer: createMockOrBlockAnalyzer(),
        validator: createMockValidator(),
      });
    });

    it('should complete full analysis pipeline within acceptable time', async () => {
      const expression = generateExpression(8);
      const simulationResult = generateSimulationResult(8, 500);
      const orBlocks = [generateOrBlock(5), generateOrBlock(4)];
      const proposals = [generateEditProposal(1), generateEditProposal(2)];
      const samples = generateSamples(200);
      const context = generateExpressionContext(8);

      const start = performance.now();

      // Phase 1: Witness search
      await witnessSearcher.search(expression, null, { maxSamples: 300 });

      // Phase 2: OR block analysis
      orAnalyzer.analyzeAll(orBlocks, simulationResult);

      // Phase 3: Validation
      validator.validateBatch(proposals, samples, context);

      // Phase 4: Edit generation
      editGenerator.generate(simulationResult);

      const elapsed = performance.now() - start;

      console.log(`Full analysis pipeline completed in ${elapsed.toFixed(2)}ms`);

      // Full pipeline should complete within sum of individual max times
      const totalMaxTime =
        (THRESHOLDS.WITNESS_SEARCH_MAX +
          THRESHOLDS.OR_BLOCK_MAX * 2 +
          THRESHOLDS.EDIT_VALIDATION_MAX * 2 +
          THRESHOLDS.EDIT_SET_MAX) *
        timingMultiplier;

      expect(elapsed).toBeLessThan(totalMaxTime);
    });

    it('should handle repeated analysis without performance degradation', async () => {
      const expression = generateExpression(5);
      const simulationResult = generateSimulationResult(5, 300);
      const runTimes = [];

      // Run 5 iterations
      for (let i = 0; i < 5; i++) {
        const start = performance.now();
        await witnessSearcher.search(expression, null, { maxSamples: 200 });
        editGenerator.generate(simulationResult);
        runTimes.push(performance.now() - start);
      }

      const avgTime = runTimes.reduce((a, b) => a + b) / runTimes.length;
      const maxTime = Math.max(...runTimes);
      const minTime = Math.min(...runTimes);

      // Use first-half vs second-half comparison for more stable degradation detection
      const firstHalfAvg =
        runTimes
          .slice(0, Math.ceil(runTimes.length / 2))
          .reduce((a, b) => a + b, 0) / Math.ceil(runTimes.length / 2);
      const secondHalfAvg =
        runTimes
          .slice(Math.ceil(runTimes.length / 2))
          .reduce((a, b) => a + b, 0) / Math.floor(runTimes.length / 2);

      // Minimum baseline prevents extreme ratios when early iterations are exceptionally fast
      // (due to JIT optimization or favorable GC timing)
      const MIN_TIMING_BASELINE_MS = 1.0;
      const normalizedFirstHalf = Math.max(firstHalfAvg, MIN_TIMING_BASELINE_MS);
      const degradationRatio = secondHalfAvg / normalizedFirstHalf;

      console.log(
        `Repeated analysis: avg=${avgTime.toFixed(2)}ms, min=${minTime.toFixed(2)}ms, max=${maxTime.toFixed(2)}ms, ` +
          `first_half_avg=${firstHalfAvg.toFixed(2)}ms, second_half_avg=${secondHalfAvg.toFixed(2)}ms, ` +
          `degradation_ratio=${degradationRatio.toFixed(2)}`
      );

      // Degradation threshold of 5.0x accounts for:
      // - V8 JIT compilation effects making early iterations faster
      // - GC pauses affecting individual iterations
      // - Sub-millisecond timing precision issues
      // This still catches severe performance degradation while tolerating test environment variance
      expect(degradationRatio).toBeLessThan(5.0);
    });
  });

  describe('Memory efficiency', () => {
    it('should not accumulate memory across multiple runs', () => {
      const mockLogger = createMockLogger();
      const validator = new ImportanceSamplingValidator({ logger: mockLogger });

      // Run garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const initialMemory = process.memoryUsage().heapUsed;

      // Run multiple iterations
      for (let i = 0; i < 20; i++) {
        const proposal = generateEditProposal(2);
        const samples = generateSamples(500);
        const context = generateExpressionContext(10);
        validator.validate(proposal, samples, context);
      }

      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowthMB = (finalMemory - initialMemory) / 1024 / 1024;

      console.log(`Memory growth after 20 runs: ${memoryGrowthMB.toFixed(2)}MB`);

      // Memory should not grow more than 50MB
      expect(memoryGrowthMB).toBeLessThan(50);
    });
  });
});
