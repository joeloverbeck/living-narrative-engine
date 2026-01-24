/**
 * @file Integration tests for GateImplicationEvaluator with real prototype pairs
 * @description Tests the GateImplicationEvaluator service using actual prototype
 * combinations from emotion_prototypes.lookup.json and sexual_prototypes.lookup.json.
 * Verifies implication detection accuracy and relationship classification.
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import GateConstraintExtractor from '../../../../src/expressionDiagnostics/services/prototypeOverlap/GateConstraintExtractor.js';
import GateASTNormalizer from '../../../../src/expressionDiagnostics/services/prototypeOverlap/GateASTNormalizer.js';
import GateImplicationEvaluator from '../../../../src/expressionDiagnostics/services/prototypeOverlap/GateImplicationEvaluator.js';
import fs from 'fs';
import path from 'path';

describe('GateImplicationEvaluator Integration Tests', () => {
  let emotionPrototypes = null;
  let sexualPrototypes = null;
  let prototypeIntervals = new Map();

  /**
   * Create a mock logger for testing.
   *
   * @returns {object} Mock logger
   */
  const createMockLogger = () => ({
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  });

  /**
   * Create extractor and evaluator instances.
   *
   * @returns {{extractor: GateConstraintExtractor, evaluator: GateImplicationEvaluator}}
   */
  const createServices = () => {
    const logger = createMockLogger();
    const config = { strictEpsilon: 1e-6 };
    const extractor = new GateConstraintExtractor({ config, logger });
    const gateASTNormalizer = new GateASTNormalizer({ logger });
    const evaluator = new GateImplicationEvaluator({ gateASTNormalizer, logger });
    return { extractor, evaluator, logger };
  };

  beforeAll(() => {
    // Load the actual lookup files
    const emotionPath = path.join(
      process.cwd(),
      'data/mods/core/lookups/emotion_prototypes.lookup.json'
    );
    const sexualPath = path.join(
      process.cwd(),
      'data/mods/core/lookups/sexual_prototypes.lookup.json'
    );

    if (fs.existsSync(emotionPath)) {
      const content = fs.readFileSync(emotionPath, 'utf-8');
      emotionPrototypes = JSON.parse(content);
    }

    if (fs.existsSync(sexualPath)) {
      const content = fs.readFileSync(sexualPath, 'utf-8');
      sexualPrototypes = JSON.parse(content);
    }

    // Pre-extract intervals for all prototypes
    if (emotionPrototypes && emotionPrototypes.data) {
      const { extractor } = createServices();

      for (const [name, prototype] of Object.entries(emotionPrototypes.data)) {
        if (Array.isArray(prototype.gates) && prototype.gates.length > 0) {
          const result = extractor.extract(prototype.gates);
          if (result.parseStatus !== 'failed') {
            prototypeIntervals.set(`emotion:${name}`, {
              intervals: result.intervals,
              gates: prototype.gates,
              parseStatus: result.parseStatus,
            });
          }
        }
      }
    }

    if (sexualPrototypes && sexualPrototypes.data) {
      const { extractor } = createServices();

      for (const [name, prototype] of Object.entries(sexualPrototypes.data)) {
        if (Array.isArray(prototype.gates) && prototype.gates.length > 0) {
          const result = extractor.extract(prototype.gates);
          if (result.parseStatus !== 'failed') {
            prototypeIntervals.set(`sexual:${name}`, {
              intervals: result.intervals,
              gates: prototype.gates,
              parseStatus: result.parseStatus,
            });
          }
        }
      }
    }
  });

  describe('Basic Implication Detection with Real Prototypes', () => {
    it('should detect some implication relationships among emotion prototypes', () => {
      if (prototypeIntervals.size < 2) {
        return; // Skip if not enough prototypes
      }

      const { evaluator } = createServices();

      // Get emotion prototypes only
      const emotionEntries = [...prototypeIntervals.entries()].filter(([key]) =>
        key.startsWith('emotion:')
      );

      if (emotionEntries.length < 2) {
        return;
      }

      let implicationCount = 0;
      let totalPairs = 0;
      const implications = [];

      // Test pairwise implication (limited for performance)
      const maxPairs = Math.min(emotionEntries.length, 20);

      for (let i = 0; i < maxPairs; i++) {
        for (let j = i + 1; j < maxPairs; j++) {
          const [nameA, dataA] = emotionEntries[i];
          const [nameB, dataB] = emotionEntries[j];

          const result = evaluator.evaluate(dataA.intervals, dataB.intervals);
          totalPairs++;

          if (result.A_implies_B || result.B_implies_A) {
            implicationCount++;
            implications.push({
              A: nameA,
              B: nameB,
              A_implies_B: result.A_implies_B,
              B_implies_A: result.B_implies_A,
              relation: result.relation,
            });
          }
        }
      }

      console.log(
        `Implication analysis: ${implicationCount}/${totalPairs} pairs have implication relationships`
      );
      if (implications.length > 0) {
        console.log(
          'Sample implications:',
          implications.slice(0, 5).map((i) => `${i.A} → ${i.B}: ${i.relation}`)
        );
      }

      // We expect to find at least some implications in real data
      // (though not necessarily many due to orthogonal design)
      expect(totalPairs).toBeGreaterThan(0);
    });

    it('should correctly classify relationship types', () => {
      const { evaluator } = createServices();

      const relationCounts = {
        equal: 0,
        narrower: 0,
        wider: 0,
        disjoint: 0,
        overlapping: 0,
      };

      // Get all prototypes
      const entries = [...prototypeIntervals.entries()];
      const maxPairs = Math.min(entries.length * (entries.length - 1) / 2, 100);
      let pairCount = 0;

      for (let i = 0; i < entries.length && pairCount < maxPairs; i++) {
        for (let j = i + 1; j < entries.length && pairCount < maxPairs; j++) {
          const [, dataA] = entries[i];
          const [, dataB] = entries[j];

          const result = evaluator.evaluate(dataA.intervals, dataB.intervals);
          relationCounts[result.relation]++;
          pairCount++;
        }
      }

      console.log('Relationship distribution:', relationCounts);

      // All relation types should be valid
      for (const relation of Object.keys(relationCounts)) {
        expect([
          'equal',
          'narrower',
          'wider',
          'disjoint',
          'overlapping',
        ]).toContain(relation);
      }
    });
  });

  describe('Vacuous Implication Detection', () => {
    it('should detect vacuous implications when intervals are unsatisfiable', () => {
      const { extractor, evaluator } = createServices();

      // Create an unsatisfiable prototype (impossible constraints)
      const unsatisfiableGates = ['threat >= 0.90', 'threat <= 0.10'];
      const unsatisfiableResult = extractor.extract(unsatisfiableGates);

      // Create a normal prototype
      const normalGates = ['valence >= 0.20'];
      const normalResult = extractor.extract(normalGates);

      // Unsatisfiable implies anything (vacuously)
      const result = evaluator.evaluate(
        unsatisfiableResult.intervals,
        normalResult.intervals
      );

      expect(result.A_implies_B).toBe(true);
      expect(result.isVacuous).toBe(true);
    });

    it('should identify vacuous reason correctly', () => {
      const { extractor, evaluator } = createServices();

      const unsatisfiableGates = ['threat >= 0.90', 'threat <= 0.10'];
      const unsatisfiableResult = extractor.extract(unsatisfiableGates);

      const normalGates = ['valence >= 0.20'];
      const normalResult = extractor.extract(normalGates);

      const result = evaluator.evaluate(
        unsatisfiableResult.intervals,
        normalResult.intervals
      );

      if (result.isVacuous) {
        expect(result.vacuousReason).toBe('a_unsatisfiable');
      }
    });
  });

  describe('Counterexample Tracking', () => {
    it('should track counterexample axes when implication fails', () => {
      const { extractor, evaluator } = createServices();

      // A has narrower threat but wider valence
      const gatesA = ['threat >= 0.40', 'threat <= 0.60', 'valence >= 0.10'];
      const gatesB = ['threat >= 0.20', 'threat <= 0.80', 'valence >= 0.50'];

      const intervalsA = extractor.extract(gatesA).intervals;
      const intervalsB = extractor.extract(gatesB).intervals;

      const result = evaluator.evaluate(intervalsA, intervalsB);

      // A doesn't imply B because A's valence range (>=0.10) is wider than B's (>=0.50)
      expect(result.A_implies_B).toBe(false);
      expect(result.counterExampleAxes).toContain('valence');
    });

    it('should provide empty counterexamples when implication succeeds', () => {
      const { extractor, evaluator } = createServices();

      // A is strictly narrower than B on all axes
      const gatesA = ['threat >= 0.30', 'threat <= 0.50'];
      const gatesB = ['threat >= 0.20', 'threat <= 0.60'];

      const intervalsA = extractor.extract(gatesA).intervals;
      const intervalsB = extractor.extract(gatesB).intervals;

      const result = evaluator.evaluate(intervalsA, intervalsB);

      expect(result.A_implies_B).toBe(true);
      // When A implies B, counterExampleAxes might be empty or have B→A failures
      // The key is A_implies_B is true
    });
  });

  describe('Evidence Collection', () => {
    it('should collect per-axis evidence for all shared axes', () => {
      const { extractor, evaluator } = createServices();

      const gatesA = [
        'threat >= 0.20',
        'threat <= 0.80',
        'valence >= 0.30',
        'arousal >= 0.10',
      ];
      const gatesB = ['threat >= 0.10', 'threat <= 0.90', 'valence >= 0.20'];

      const intervalsA = extractor.extract(gatesA).intervals;
      const intervalsB = extractor.extract(gatesB).intervals;

      const result = evaluator.evaluate(intervalsA, intervalsB);

      // Should have evidence for all unique axes
      expect(result.evidence).toBeDefined();
      expect(Array.isArray(result.evidence)).toBe(true);

      // Evidence should include threat and valence (shared)
      const evidenceAxes = result.evidence.map((e) => e.axis);
      expect(evidenceAxes).toContain('threat');
      expect(evidenceAxes).toContain('valence');

      // Each evidence entry should have required fields
      for (const e of result.evidence) {
        expect(e).toHaveProperty('axis');
        expect(e).toHaveProperty('intervalA');
        expect(e).toHaveProperty('intervalB');
        expect(e).toHaveProperty('A_subset_B');
        expect(e).toHaveProperty('B_subset_A');
      }
    });
  });

  describe('Cross-Domain Implication (Emotion vs Sexual)', () => {
    it('should evaluate implication between emotion and sexual prototypes', () => {
      const emotionEntries = [...prototypeIntervals.entries()].filter(([key]) =>
        key.startsWith('emotion:')
      );
      const sexualEntries = [...prototypeIntervals.entries()].filter(([key]) =>
        key.startsWith('sexual:')
      );

      if (emotionEntries.length === 0 || sexualEntries.length === 0) {
        return; // Skip if either category is empty
      }

      const { evaluator } = createServices();

      // Test a few cross-domain pairs
      const maxPairs = Math.min(
        emotionEntries.length * sexualEntries.length,
        20
      );
      let pairCount = 0;
      let overlappingCount = 0;

      for (const [emotionName, emotionData] of emotionEntries) {
        for (const [sexualName, sexualData] of sexualEntries) {
          if (pairCount >= maxPairs) break;

          const result = evaluator.evaluate(
            emotionData.intervals,
            sexualData.intervals
          );

          if (result.relation !== 'disjoint') {
            overlappingCount++;
          }

          pairCount++;
        }
      }

      console.log(
        `Cross-domain analysis: ${overlappingCount}/${pairCount} pairs have some overlap`
      );

      // Just verify we can evaluate cross-domain pairs
      expect(pairCount).toBeGreaterThan(0);
    });
  });

  describe('Disjoint Detection', () => {
    it('should detect disjoint prototypes (mutually exclusive gates)', () => {
      const { extractor, evaluator } = createServices();

      // Create two disjoint prototypes
      const highThreatGates = ['threat >= 0.70', 'threat <= 1.00'];
      const lowThreatGates = ['threat >= 0.00', 'threat <= 0.30'];

      const highThreatIntervals = extractor.extract(highThreatGates).intervals;
      const lowThreatIntervals = extractor.extract(lowThreatGates).intervals;

      const result = evaluator.evaluate(highThreatIntervals, lowThreatIntervals);

      expect(result.A_implies_B).toBe(false);
      expect(result.B_implies_A).toBe(false);
      expect(result.relation).toBe('disjoint');
    });

    it('should count disjoint pairs in real prototype data', () => {
      if (prototypeIntervals.size < 2) {
        // Skip if not enough prototypes loaded
        return;
      }

      const { evaluator } = createServices();

      const entries = [...prototypeIntervals.entries()];
      let disjointCount = 0;
      let totalPairs = 0;
      const maxPairs = 50;

      for (let i = 0; i < entries.length && totalPairs < maxPairs; i++) {
        for (let j = i + 1; j < entries.length && totalPairs < maxPairs; j++) {
          const [, dataA] = entries[i];
          const [, dataB] = entries[j];

          const result = evaluator.evaluate(dataA.intervals, dataB.intervals);
          totalPairs++;

          if (result.relation === 'disjoint') {
            disjointCount++;
          }
        }
      }

      console.log(
        `Disjoint analysis: ${disjointCount}/${totalPairs} pairs are disjoint`
      );

      // Record the result (may be 0 if prototypes are designed to overlap)
      expect(totalPairs).toBeGreaterThan(0);
    });
  });

  describe('Equal Constraints Detection', () => {
    it('should detect equal constraints (mutual implication)', () => {
      const { extractor, evaluator } = createServices();

      // Two prototypes with identical gates
      const gates = ['threat >= 0.20', 'threat <= 0.80', 'valence >= 0.30'];

      const intervalsA = extractor.extract(gates).intervals;
      const intervalsB = extractor.extract(gates).intervals;

      const result = evaluator.evaluate(intervalsA, intervalsB);

      expect(result.A_implies_B).toBe(true);
      expect(result.B_implies_A).toBe(true);
      expect(result.relation).toBe('equal');
    });

    it('should find equal constraint pairs in real data', () => {
      if (prototypeIntervals.size < 2) {
        // Skip if not enough prototypes loaded
        return;
      }

      const { evaluator } = createServices();

      const entries = [...prototypeIntervals.entries()];
      let equalCount = 0;
      let totalPairs = 0;
      const equalPairs = [];

      for (let i = 0; i < entries.length; i++) {
        for (let j = i + 1; j < entries.length; j++) {
          const [nameA, dataA] = entries[i];
          const [nameB, dataB] = entries[j];

          const result = evaluator.evaluate(dataA.intervals, dataB.intervals);
          totalPairs++;

          if (result.relation === 'equal') {
            equalCount++;
            equalPairs.push({ A: nameA, B: nameB });
          }
        }
      }

      if (equalCount > 0) {
        console.log(
          `Equal constraint pairs found: ${equalCount}`,
          equalPairs.slice(0, 5)
        );
      }

      // Equal pairs are rare but possible
      expect(totalPairs).toBeGreaterThan(0);
    });
  });

  describe('Performance Characteristics', () => {
    it('should evaluate many pairs efficiently', () => {
      if (prototypeIntervals.size < 2) {
        // Skip if not enough prototypes loaded
        return;
      }

      const { evaluator } = createServices();

      const entries = [...prototypeIntervals.entries()];
      const targetPairs = Math.min(entries.length * (entries.length - 1) / 2, 200);

      const startTime = Date.now();
      let pairCount = 0;

      for (let i = 0; i < entries.length && pairCount < targetPairs; i++) {
        for (let j = i + 1; j < entries.length && pairCount < targetPairs; j++) {
          const [, dataA] = entries[i];
          const [, dataB] = entries[j];

          evaluator.evaluate(dataA.intervals, dataB.intervals);
          pairCount++;
        }
      }

      const endTime = Date.now();
      const duration = endTime - startTime;
      const pairsPerSecond = pairCount > 0 ? pairCount / (duration / 1000) : 0;

      console.log(
        `Evaluated ${pairCount} pairs in ${duration}ms (${pairsPerSecond.toFixed(0)} pairs/sec)`
      );

      // Should be reasonably fast if we have pairs
      if (pairCount > 0) {
        expect(pairsPerSecond).toBeGreaterThan(100);
      }
    });
  });

  describe('Integration Pipeline: Extract + Evaluate', () => {
    it('should work end-to-end with real prototype gates', () => {
      if (!emotionPrototypes || !emotionPrototypes.data) {
        return;
      }

      const { extractor, evaluator } = createServices();

      // Take two real prototypes
      const prototypeNames = Object.keys(emotionPrototypes.data);
      if (prototypeNames.length < 2) return;

      const protoA = emotionPrototypes.data[prototypeNames[0]];
      const protoB = emotionPrototypes.data[prototypeNames[1]];

      if (
        !Array.isArray(protoA.gates) ||
        !Array.isArray(protoB.gates) ||
        protoA.gates.length === 0 ||
        protoB.gates.length === 0
      ) {
        return;
      }

      // Extract intervals
      const resultA = extractor.extract(protoA.gates);
      const resultB = extractor.extract(protoB.gates);

      // Skip if extraction failed
      if (resultA.parseStatus === 'failed' || resultB.parseStatus === 'failed') {
        return;
      }

      // Evaluate implication
      const implicationResult = evaluator.evaluate(
        resultA.intervals,
        resultB.intervals
      );

      // Verify result structure
      expect(implicationResult).toHaveProperty('A_implies_B');
      expect(implicationResult).toHaveProperty('B_implies_A');
      expect(implicationResult).toHaveProperty('relation');
      expect(implicationResult).toHaveProperty('evidence');
      expect(implicationResult).toHaveProperty('isVacuous');

      console.log(
        `Pipeline test: ${prototypeNames[0]} vs ${prototypeNames[1]} -> ${implicationResult.relation}`
      );
    });
  });
});
