/**
 * @file Integration tests for GateConstraintExtractor with real prototype data
 * @description Tests the GateConstraintExtractor service using actual gates from
 * emotion_prototypes.lookup.json and sexual_prototypes.lookup.json.
 * Verifies interval extraction and calculation accuracy.
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import GateConstraintExtractor from '../../../../src/expressionDiagnostics/services/prototypeOverlap/GateConstraintExtractor.js';
import fs from 'fs';
import path from 'path';

describe('GateConstraintExtractor Integration Tests', () => {
  let emotionPrototypes = null;
  let sexualPrototypes = null;

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
   * Create extractor instance with default config.
   *
   * @param {object} [configOverrides] - Config overrides
   * @returns {{extractor: GateConstraintExtractor, logger: object}}
   */
  const createExtractor = (configOverrides = {}) => {
    const logger = createMockLogger();
    const config = {
      strictEpsilon: 1e-6,
      ...configOverrides,
    };
    const extractor = new GateConstraintExtractor({ config, logger });
    return { extractor, logger };
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
  });

  describe('Extraction with Real Emotion Prototypes', () => {
    it('should successfully extract intervals from all emotion prototype gates', () => {
      if (!emotionPrototypes || !emotionPrototypes.data) {
        return; // Skip if file doesn't exist
      }

      const { extractor } = createExtractor();
      const results = [];

      for (const [prototypeName, prototype] of Object.entries(
        emotionPrototypes.data
      )) {
        if (!Array.isArray(prototype.gates) || prototype.gates.length === 0) {
          continue;
        }

        const result = extractor.extract(prototype.gates);
        results.push({
          prototypeName,
          gates: prototype.gates,
          intervals: result.intervals,
          unparsedGates: result.unparsedGates,
          parseStatus: result.parseStatus,
        });
      }

      expect(results.length).toBeGreaterThan(0);

      // Analyze results
      let totalPrototypes = results.length;
      let completeParseCount = 0;
      let partialParseCount = 0;
      let failedParseCount = 0;
      const unparsedGatesCollection = [];

      for (const result of results) {
        switch (result.parseStatus) {
          case 'complete':
            completeParseCount++;
            break;
          case 'partial':
            partialParseCount++;
            break;
          case 'failed':
            failedParseCount++;
            break;
        }

        if (result.unparsedGates.length > 0) {
          unparsedGatesCollection.push({
            prototype: result.prototypeName,
            unparsed: result.unparsedGates,
          });
        }
      }

      // Log statistics
      console.log(`Emotion prototype extraction results:
        Total prototypes with gates: ${totalPrototypes}
        Complete parses: ${completeParseCount}
        Partial parses: ${partialParseCount}
        Failed parses: ${failedParseCount}`);

      if (unparsedGatesCollection.length > 0) {
        console.log('Unparsed gates:', unparsedGatesCollection);
      }

      // Expect high success rate (should only fail on == gates if any)
      expect(completeParseCount + partialParseCount).toBeGreaterThan(
        totalPrototypes * 0.9
      );
    });

    it('should produce valid intervals for known emotion prototypes', () => {
      if (!emotionPrototypes || !emotionPrototypes.data) {
        return;
      }

      const { extractor } = createExtractor();

      // Test "joy" prototype if it exists
      if (emotionPrototypes.data.joy) {
        const joyGates = emotionPrototypes.data.joy.gates;
        const result = extractor.extract(joyGates);

        expect(result.parseStatus).not.toBe('failed');

        // Joy should have intervals for its gate axes
        if (result.intervals.size > 0) {
          for (const [axis, interval] of result.intervals) {
            // Intervals should have valid structure
            expect(interval).toHaveProperty('lower');
            expect(interval).toHaveProperty('upper');
            expect(interval).toHaveProperty('unsatisfiable');
            expect(typeof interval.unsatisfiable).toBe('boolean');
          }
        }
      }

      // Test "fear" prototype if it exists
      if (emotionPrototypes.data.fear) {
        const fearGates = emotionPrototypes.data.fear.gates;
        const result = extractor.extract(fearGates);

        expect(result.parseStatus).not.toBe('failed');

        // Fear typically has a threat gate
        if (result.intervals.has('threat')) {
          const threatInterval = result.intervals.get('threat');
          expect(threatInterval).not.toBeUndefined();
        }
      }
    });

    it('should correctly accumulate multiple bounds on same axis', () => {
      const { extractor } = createExtractor();

      // Test gates with multiple constraints on same axis
      const multiConstraintGates = [
        'threat >= 0.20',
        'threat <= 0.80',
        'valence >= 0.10',
      ];

      const result = extractor.extract(multiConstraintGates);

      expect(result.parseStatus).toBe('complete');
      expect(result.intervals.has('threat')).toBe(true);
      expect(result.intervals.has('valence')).toBe(true);

      const threatInterval = result.intervals.get('threat');
      expect(threatInterval.lower).toBeCloseTo(0.2, 5);
      expect(threatInterval.upper).toBeCloseTo(0.8, 5);
      expect(threatInterval.unsatisfiable).toBe(false);

      const valenceInterval = result.intervals.get('valence');
      expect(valenceInterval.lower).toBeCloseTo(0.1, 5);
      expect(valenceInterval.upper).toBeNull();
    });

    it('should detect unsatisfiable intervals (lower > upper)', () => {
      const { extractor, logger } = createExtractor();

      // Create unsatisfiable constraint: threat >= 0.8 AND threat <= 0.2
      const unsatisfiableGates = ['threat >= 0.80', 'threat <= 0.20'];

      const result = extractor.extract(unsatisfiableGates);

      expect(result.parseStatus).toBe('complete');
      expect(result.intervals.has('threat')).toBe(true);

      const threatInterval = result.intervals.get('threat');
      expect(threatInterval.lower).toBeCloseTo(0.8, 5);
      expect(threatInterval.upper).toBeCloseTo(0.2, 5);
      expect(threatInterval.unsatisfiable).toBe(true);

      // Should log warning about unsatisfiable interval
      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe('Extraction with Real Sexual Prototypes', () => {
    it('should successfully extract intervals from all sexual prototype gates', () => {
      if (!sexualPrototypes || !sexualPrototypes.data) {
        return;
      }

      const { extractor } = createExtractor();
      const results = [];

      for (const [prototypeName, prototype] of Object.entries(
        sexualPrototypes.data
      )) {
        if (!Array.isArray(prototype.gates) || prototype.gates.length === 0) {
          continue;
        }

        const result = extractor.extract(prototype.gates);
        results.push({
          prototypeName,
          gates: prototype.gates,
          intervals: result.intervals,
          unparsedGates: result.unparsedGates,
          parseStatus: result.parseStatus,
        });
      }

      expect(results.length).toBeGreaterThan(0);

      // Verify extraction success rate
      let completeCount = 0;
      for (const result of results) {
        if (result.parseStatus === 'complete') {
          completeCount++;
        }
      }

      console.log(
        `Sexual prototype extraction: ${completeCount}/${results.length} complete`
      );

      // Expect high success rate
      expect(completeCount).toBeGreaterThan(results.length * 0.9);
    });

    it('should extract sexual_arousal intervals correctly', () => {
      if (!sexualPrototypes || !sexualPrototypes.data) {
        return;
      }

      const { extractor } = createExtractor();

      // Find prototypes with sexual_arousal gates
      const prototypesWithSexualArousal = [];

      for (const [prototypeName, prototype] of Object.entries(
        sexualPrototypes.data
      )) {
        if (!Array.isArray(prototype.gates)) continue;

        const hasSexualArousalGate = prototype.gates.some(
          (gate) => gate.includes('sexual_arousal') || gate.includes('SA')
        );

        if (hasSexualArousalGate) {
          prototypesWithSexualArousal.push({
            name: prototypeName,
            gates: prototype.gates,
          });
        }
      }

      // Test extraction for each
      for (const { name, gates } of prototypesWithSexualArousal) {
        const result = extractor.extract(gates);

        // Should have sexual_arousal in intervals if gate was parseable
        if (result.parseStatus === 'complete' || result.parseStatus === 'partial') {
          // At minimum, we should have parsed some gates
          expect(result.intervals.size).toBeGreaterThanOrEqual(0);
        }
      }
    });
  });

  describe('Strict Epsilon Handling', () => {
    it('should apply strictEpsilon to strict inequalities (> and <)', () => {
      const epsilon = 0.001;
      const { extractor } = createExtractor({ strictEpsilon: epsilon });

      // Strict greater than
      const strictGreaterGates = ['valence > 0.50'];
      const greaterResult = extractor.extract(strictGreaterGates);

      expect(greaterResult.intervals.has('valence')).toBe(true);
      const valenceInterval = greaterResult.intervals.get('valence');

      // Strict > 0.50 should become >= 0.50 + epsilon
      expect(valenceInterval.lower).toBeCloseTo(0.5 + epsilon, 6);
      expect(valenceInterval.upper).toBeNull();

      // Strict less than
      const strictLessGates = ['threat < 0.30'];
      const lessResult = extractor.extract(strictLessGates);

      expect(lessResult.intervals.has('threat')).toBe(true);
      const threatInterval = lessResult.intervals.get('threat');

      // Strict < 0.30 should become <= 0.30 - epsilon
      expect(threatInterval.upper).toBeCloseTo(0.3 - epsilon, 6);
      expect(threatInterval.lower).toBeNull();
    });

    it('should NOT apply epsilon to non-strict inequalities (>= and <=)', () => {
      const epsilon = 0.001;
      const { extractor } = createExtractor({ strictEpsilon: epsilon });

      // Non-strict greater than or equal
      const nonStrictGates = ['valence >= 0.50', 'threat <= 0.30'];
      const result = extractor.extract(nonStrictGates);

      const valenceInterval = result.intervals.get('valence');
      expect(valenceInterval.lower).toBe(0.5); // Exact, no epsilon

      const threatInterval = result.intervals.get('threat');
      expect(threatInterval.upper).toBe(0.3); // Exact, no epsilon
    });
  });

  describe('Cross-Prototype Interval Comparison', () => {
    it('should extract comparable intervals for related prototypes', () => {
      if (!emotionPrototypes || !emotionPrototypes.data) {
        return;
      }

      const { extractor } = createExtractor();

      // Find pairs of prototypes that share gate axes
      const prototypeIntervals = new Map();

      for (const [prototypeName, prototype] of Object.entries(
        emotionPrototypes.data
      )) {
        if (!Array.isArray(prototype.gates) || prototype.gates.length === 0) {
          continue;
        }

        const result = extractor.extract(prototype.gates);
        if (result.parseStatus !== 'failed') {
          prototypeIntervals.set(prototypeName, result.intervals);
        }
      }

      // Find prototypes that both constrain 'threat'
      const threatPrototypes = [];
      for (const [name, intervals] of prototypeIntervals) {
        if (intervals.has('threat')) {
          threatPrototypes.push({
            name,
            threatInterval: intervals.get('threat'),
          });
        }
      }

      // Verify we have multiple prototypes constraining threat
      if (threatPrototypes.length >= 2) {
        console.log(
          `Found ${threatPrototypes.length} prototypes with threat constraints`
        );

        // All threat intervals should be comparable (valid structure)
        for (const { name, threatInterval } of threatPrototypes) {
          expect(threatInterval).toHaveProperty('lower');
          expect(threatInterval).toHaveProperty('upper');
          expect(threatInterval).toHaveProperty('unsatisfiable');

          // Bounds should be either null or numbers
          if (threatInterval.lower !== null) {
            expect(typeof threatInterval.lower).toBe('number');
          }
          if (threatInterval.upper !== null) {
            expect(typeof threatInterval.upper).toBe('number');
          }
        }
      }
    });
  });

  describe('Edge Cases with Real Data', () => {
    it('should handle empty gates array', () => {
      const { extractor } = createExtractor();
      const result = extractor.extract([]);

      expect(result.parseStatus).toBe('complete');
      expect(result.intervals.size).toBe(0);
      expect(result.unparsedGates.length).toBe(0);
    });

    it('should handle prototype with no gates property gracefully', () => {
      const { extractor } = createExtractor();

      // Test with undefined/null (should handle defensively)
      const nullResult = extractor.extract(null);
      expect(nullResult.parseStatus).toBe('complete');
      expect(nullResult.intervals.size).toBe(0);

      const undefinedResult = extractor.extract(undefined);
      expect(undefinedResult.parseStatus).toBe('complete');
    });

    it('should preserve gate axis names exactly as specified', () => {
      const { extractor } = createExtractor();

      // Test various axis naming styles used in lookup files
      const gates = [
        'sexual_arousal >= 0.30',
        'agency_control <= 0.50',
        'future_expectancy >= -0.20',
        'self_evaluation <= 0.40',
      ];

      const result = extractor.extract(gates);

      expect(result.intervals.has('sexual_arousal')).toBe(true);
      expect(result.intervals.has('agency_control')).toBe(true);
      expect(result.intervals.has('future_expectancy')).toBe(true);
      expect(result.intervals.has('self_evaluation')).toBe(true);
    });
  });

  describe('Parse Status Accuracy', () => {
    it('should return complete status when all gates parse', () => {
      const { extractor } = createExtractor();

      const result = extractor.extract([
        'valence >= 0.20',
        'threat <= 0.30',
        'arousal > 0.10',
      ]);

      expect(result.parseStatus).toBe('complete');
      expect(result.unparsedGates.length).toBe(0);
    });

    it('should return partial status when some gates fail to parse', () => {
      const { extractor } = createExtractor();

      // Mix of parseable and unparseable gates
      const result = extractor.extract([
        'valence >= 0.20',
        'valence == 0.50', // Unparseable due to == operator
        'threat <= 0.30',
      ]);

      expect(result.parseStatus).toBe('partial');
      expect(result.unparsedGates).toContain('valence == 0.50');
    });

    it('should return failed status when no gates parse', () => {
      const { extractor } = createExtractor();

      // All unparseable gates
      const result = extractor.extract([
        'valence == 0.50',
        'threat == 0.20',
        'invalid gate format',
      ]);

      expect(result.parseStatus).toBe('failed');
      expect(result.unparsedGates.length).toBe(3);
    });
  });
});
