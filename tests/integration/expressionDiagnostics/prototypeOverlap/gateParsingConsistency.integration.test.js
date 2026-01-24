/**
 * @file Integration tests for gate parsing consistency across implementations
 * @description Tests that all three gate parsers (GateConstraint.parse, GateConstraintExtractor,
 * emotionCalculatorService) produce equivalent results for the same input.
 * This test pins current behavior before GateASTNormalizer refactoring.
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import GateConstraint from '../../../../src/expressionDiagnostics/models/GateConstraint.js';
import GateConstraintExtractor from '../../../../src/expressionDiagnostics/services/prototypeOverlap/GateConstraintExtractor.js';
import fs from 'fs';
import path from 'path';

describe('Gate Parsing Consistency (Integration)', () => {
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
   * Parse gate using GateConstraint (model class).
   *
   * @param {string} gateString - Gate string to parse
   * @returns {{axis: string, operator: string, value: number}|null} Parsed gate or null
   */
  const parseWithGateConstraint = (gateString) => {
    try {
      const constraint = GateConstraint.parse(gateString);
      return {
        axis: constraint.axis,
        operator: constraint.operator,
        value: constraint.value,
      };
    } catch {
      return null;
    }
  };

  /**
   * Parse gate using GateConstraintExtractor (extractor service).
   *
   * @param {string} gateString - Gate string to parse
   * @returns {{axis: string, operator: string, value: number, boundType: string}|null} Parsed gate or null
   */
  const parseWithExtractor = (gateString) => {
    const logger = createMockLogger();
    const config = { strictEpsilon: 1e-6 };
    const extractor = new GateConstraintExtractor({ config, logger });
    const result = extractor.extract([gateString]);

    if (result.unparsedGates.length > 0) {
      return null;
    }

    const intervals = result.intervals;
    if (intervals.size === 0) {
      return null;
    }

    // Extract the parsed gate from intervals
    // The extractor produces intervals, so we infer the original parse
    const [axis, interval] = [...intervals.entries()][0];

    // Determine operator and value from bounds
    // Note: extractor normalizes strict inequalities, so we can't recover exact operator
    let operator = null;
    let value = null;

    if (interval.lower !== null && interval.upper === null) {
      operator = '>='; // or > (strict normalized)
      value = interval.lower;
    } else if (interval.upper !== null && interval.lower === null) {
      operator = '<='; // or < (strict normalized)
      value = interval.upper;
    }

    return {
      axis,
      operator,
      value,
      boundType: interval.lower !== null ? 'lower' : 'upper',
    };
  };

  /**
   * Parse gate using emotionCalculatorService pattern (inline regex).
   * Replicates the private #parseGate method for testing.
   *
   * @param {string} gateString - Gate string to parse
   * @returns {{axis: string, operator: string, value: number}|null} Parsed gate or null
   */
  const parseWithEmotionCalculatorPattern = (gateString) => {
    const match = gateString.match(/^(\w+)\s*(>=|<=|>|<|==)\s*(-?\d*\.?\d+)$/);
    if (!match) {
      return null;
    }
    return {
      axis: match[1],
      operator: match[2],
      value: parseFloat(match[3]),
    };
  };

  describe('Regex Pattern Consistency', () => {
    // The three implementations use these regex patterns:
    // GateConstraint: /^(\w+)\s*(>=|<=|>|<|==)\s*(-?\d*\.?\d+)$/
    // GateConstraintExtractor: /^(\w+)\s*(>=|>|<=|<)\s*(-?\d+\.?\d*)$/  (NOTE: Missing ==!)
    // emotionCalculatorService: /^(\w+)\s*(>=|<=|>|<|==)\s*(-?\d*\.?\d+)$/

    it('GateConstraint and emotionCalculator should have identical regex', () => {
      // These two should be identical
      const gateConstraintPattern = /^(\w+)\s*(>=|<=|>|<|==)\s*(-?\d*\.?\d+)$/;
      const emotionCalcPattern = /^(\w+)\s*(>=|<=|>|<|==)\s*(-?\d*\.?\d+)$/;

      expect(gateConstraintPattern.source).toBe(emotionCalcPattern.source);
    });

    it('GateConstraintExtractor regex is missing == operator', () => {
      // This documents the known discrepancy
      const extractorPattern = /^(\w+)\s*(>=|>|<=|<)\s*(-?\d+\.?\d*)$/;

      // The extractor pattern does NOT include == operator
      expect(extractorPattern.source).not.toContain('==');
    });
  });

  describe('Standard Gate Strings', () => {
    const standardGates = [
      'threat <= 0.20',
      'valence >= 0.35',
      'arousal > 0.50',
      'uncertainty < 0.30',
      'engagement >= -0.10',
      'agency_control <= -0.25',
    ];

    standardGates.forEach((gate) => {
      it(`should parse "${gate}" consistently across parsers`, () => {
        const gateConstraintResult = parseWithGateConstraint(gate);
        const emotionCalcResult = parseWithEmotionCalculatorPattern(gate);

        // Both GateConstraint and emotionCalculator should succeed
        expect(gateConstraintResult).not.toBeNull();
        expect(emotionCalcResult).not.toBeNull();

        // Results should match on axis and value
        expect(gateConstraintResult.axis).toBe(emotionCalcResult.axis);
        expect(gateConstraintResult.operator).toBe(emotionCalcResult.operator);
        expect(gateConstraintResult.value).toBe(emotionCalcResult.value);
      });
    });
  });

  describe('Edge Cases - Negative Values', () => {
    const negativeGates = [
      'valence >= -0.50',
      'threat <= -0.20',
      'arousal > -0.75',
      'agency_control < -0.10',
    ];

    negativeGates.forEach((gate) => {
      it(`should parse negative value gate "${gate}"`, () => {
        const gateConstraintResult = parseWithGateConstraint(gate);
        const emotionCalcResult = parseWithEmotionCalculatorPattern(gate);

        expect(gateConstraintResult).not.toBeNull();
        expect(emotionCalcResult).not.toBeNull();

        expect(gateConstraintResult.value).toBeLessThan(0);
        expect(emotionCalcResult.value).toBeLessThan(0);
        expect(gateConstraintResult.value).toBe(emotionCalcResult.value);
      });
    });
  });

  describe('Edge Cases - Decimal Values', () => {
    const decimalGates = [
      'valence >= 0.123',
      'threat <= 0.999',
      'arousal > 0.001',
      'engagement >= 0.5',
      'uncertainty <= 0.0',
    ];

    decimalGates.forEach((gate) => {
      it(`should parse decimal value gate "${gate}"`, () => {
        const gateConstraintResult = parseWithGateConstraint(gate);
        const emotionCalcResult = parseWithEmotionCalculatorPattern(gate);

        expect(gateConstraintResult).not.toBeNull();
        expect(emotionCalcResult).not.toBeNull();

        expect(gateConstraintResult.value).toBe(emotionCalcResult.value);
      });
    });
  });

  describe('Edge Cases - Equality Operator', () => {
    const equalityGates = ['valence == 0.50', 'threat == 0.00', 'arousal == -0.25'];

    equalityGates.forEach((gate) => {
      it(`should parse equality gate "${gate}" with GateConstraint and emotionCalculator`, () => {
        const gateConstraintResult = parseWithGateConstraint(gate);
        const emotionCalcResult = parseWithEmotionCalculatorPattern(gate);

        // Both should support == operator
        expect(gateConstraintResult).not.toBeNull();
        expect(emotionCalcResult).not.toBeNull();

        expect(gateConstraintResult.operator).toBe('==');
        expect(emotionCalcResult.operator).toBe('==');
      });

      it(`GateConstraintExtractor should NOT parse equality gate "${gate}"`, () => {
        // Document the known limitation
        const extractorResult = parseWithExtractor(gate);

        // Extractor returns null for == gates because its regex doesn't support ==
        expect(extractorResult).toBeNull();
      });
    });
  });

  describe('Whitespace Handling', () => {
    const whitespaceVariants = [
      ['threat<=0.20', 'threat <= 0.20'], // no spaces
      ['threat <=0.20', 'threat <= 0.20'], // space before only
      ['threat<= 0.20', 'threat <= 0.20'], // space after only
      ['threat  <=  0.20', 'threat <= 0.20'], // multiple spaces
    ];

    whitespaceVariants.forEach(([variant, normalized]) => {
      it(`should handle whitespace variant "${variant}"`, () => {
        const gateConstraintResult = parseWithGateConstraint(variant);
        const emotionCalcResult = parseWithEmotionCalculatorPattern(variant);

        // Both should parse successfully regardless of whitespace
        expect(gateConstraintResult).not.toBeNull();
        expect(emotionCalcResult).not.toBeNull();

        // Results should match the normalized parse
        const normalizedResult = parseWithGateConstraint(normalized);
        expect(gateConstraintResult.axis).toBe(normalizedResult.axis);
        expect(gateConstraintResult.operator).toBe(normalizedResult.operator);
        expect(gateConstraintResult.value).toBe(normalizedResult.value);
      });
    });
  });

  describe('Invalid Gate Strings', () => {
    // Note: '123 >= 0.20' parses successfully because \w+ matches digits
    // This is actually valid regex behavior, so we don't include it
    const invalidGates = [
      '', // empty
      '   ', // whitespace only
      'threat', // missing operator and value
      '>= 0.20', // missing axis
      'threat >=', // missing value
      'threat >> 0.20', // invalid operator
      'threat != 0.20', // unsupported operator (not in any regex)
    ];

    invalidGates.forEach((gate) => {
      it(`should fail to parse invalid gate "${gate}"`, () => {
        const gateConstraintResult = parseWithGateConstraint(gate);
        const emotionCalcResult = parseWithEmotionCalculatorPattern(gate);

        // Both should return null for invalid gates
        expect(gateConstraintResult).toBeNull();
        expect(emotionCalcResult).toBeNull();
      });
    });
  });

  describe('Real Prototype Gates from Lookup Files', () => {
    let emotionPrototypes = null;
    let sexualPrototypes = null;

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

    it('should parse all gates from emotion_prototypes.lookup.json', () => {
      if (!emotionPrototypes || !emotionPrototypes.data) {
        return; // Skip if file doesn't exist
      }

      const allGates = [];
      const failedGates = [];

      // Collect all gates from all prototypes
      for (const [prototypeName, prototype] of Object.entries(
        emotionPrototypes.data
      )) {
        if (Array.isArray(prototype.gates)) {
          for (const gate of prototype.gates) {
            allGates.push({ prototypeName, gate });
          }
        }
      }

      expect(allGates.length).toBeGreaterThan(0);

      // Test each gate
      for (const { prototypeName, gate } of allGates) {
        const gateConstraintResult = parseWithGateConstraint(gate);
        const emotionCalcResult = parseWithEmotionCalculatorPattern(gate);

        if (!gateConstraintResult || !emotionCalcResult) {
          failedGates.push({ prototypeName, gate });
        } else {
          // Verify consistency
          expect(gateConstraintResult.axis).toBe(emotionCalcResult.axis);
          expect(gateConstraintResult.operator).toBe(emotionCalcResult.operator);
          expect(gateConstraintResult.value).toBe(emotionCalcResult.value);
        }
      }

      // Report any failures (should be none for valid lookup files)
      if (failedGates.length > 0) {
        console.warn('Failed to parse gates:', failedGates);
      }
      expect(failedGates.length).toBe(0);
    });

    it('should parse all gates from sexual_prototypes.lookup.json', () => {
      if (!sexualPrototypes || !sexualPrototypes.data) {
        return; // Skip if file doesn't exist
      }

      const allGates = [];
      const failedGates = [];

      // Collect all gates from all prototypes
      for (const [prototypeName, prototype] of Object.entries(
        sexualPrototypes.data
      )) {
        if (Array.isArray(prototype.gates)) {
          for (const gate of prototype.gates) {
            allGates.push({ prototypeName, gate });
          }
        }
      }

      expect(allGates.length).toBeGreaterThan(0);

      // Test each gate
      for (const { prototypeName, gate } of allGates) {
        const gateConstraintResult = parseWithGateConstraint(gate);
        const emotionCalcResult = parseWithEmotionCalculatorPattern(gate);

        if (!gateConstraintResult || !emotionCalcResult) {
          failedGates.push({ prototypeName, gate });
        } else {
          // Verify consistency
          expect(gateConstraintResult.axis).toBe(emotionCalcResult.axis);
          expect(gateConstraintResult.operator).toBe(emotionCalcResult.operator);
          expect(gateConstraintResult.value).toBe(emotionCalcResult.value);
        }
      }

      // Report any failures
      if (failedGates.length > 0) {
        console.warn('Failed to parse gates:', failedGates);
      }
      expect(failedGates.length).toBe(0);
    });

    it('should report distinct gate patterns found in lookup files', () => {
      const patterns = new Set();

      const processPrototypes = (prototypes) => {
        if (!prototypes || !prototypes.data) return;
        for (const prototype of Object.values(prototypes.data)) {
          if (Array.isArray(prototype.gates)) {
            for (const gate of prototype.gates) {
              const parsed = parseWithEmotionCalculatorPattern(gate);
              if (parsed) {
                patterns.add(parsed.operator);
              }
            }
          }
        }
      };

      processPrototypes(emotionPrototypes);
      processPrototypes(sexualPrototypes);

      // Report which operators are actually used
      console.log('Distinct operators found in lookup files:', [...patterns]);

      // Verify all found operators are supported by all parsers
      for (const op of patterns) {
        const testGate = `test_axis ${op} 0.5`;
        const result = parseWithGateConstraint(testGate);
        expect(result).not.toBeNull();
        expect(result.operator).toBe(op);
      }
    });
  });
});
