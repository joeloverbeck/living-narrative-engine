/**
 * @file Tests for multi-gate prototype handling in prototypeGateUtils.js
 * Tests deterministic constraint extraction when prototypes have multiple gates,
 * including same-axis constraints with different operators (e.g., arousal >= -25 AND arousal <= 70).
 */

import { describe, expect, it, beforeEach } from '@jest/globals';
import {
  extractConstraintsFromPrototypeGates,
  convertGateToMoodConstraint,
} from '../../../../src/expressionDiagnostics/utils/prototypeGateUtils.js';
import GateConstraint from '../../../../src/expressionDiagnostics/models/GateConstraint.js';

describe('prototypeGateUtils - multi-gate scenarios', () => {
  let mockDataRegistry;

  beforeEach(() => {
    // Mock data registry with realistic multi-gate prototypes
    // Based on actual emotion_prototypes.lookup.json
    mockDataRegistry = {
      getLookupData: (key) => {
        if (key === 'core:emotion_prototypes') {
          return {
            entries: {
              // Flow has 7 gates including same-axis constraints
              flow: {
                weights: {
                  engagement: 0.55,
                  agency_control: 0.25,
                  threat: -0.20,
                  arousal: 0.10,
                  valence: 0.15,
                  uncertainty: -0.10,
                },
                gates: [
                  'engagement >= 0.40',
                  'agency_control >= 0.25',
                  'threat <= 0.45',
                  'arousal <= 0.70',
                  'arousal >= -0.25', // Same axis, different operator!
                  'valence >= -0.55',
                  'uncertainty <= 0.10',
                ],
              },
              // Joy has simpler gates
              joy: {
                weights: { valence: 0.8, arousal: 0.3 },
                gates: ['valence >= 0.40'],
              },
              // Focused_absorption has arousal constraints too
              focused_absorption: {
                weights: { engagement: 0.7, arousal: 0.2 },
                gates: [
                  'engagement >= 0.35',
                  'arousal >= 0.10',
                  'arousal <= 0.60', // Same axis range constraint
                ],
              },
              // Anger for testing multiple prototypes with overlapping axes
              anger: {
                weights: { valence: -0.6, threat: 0.8, arousal: 0.5 },
                gates: [
                  'threat >= 0.30',
                  'valence <= 0.20',
                  'arousal >= 0.25',
                ],
              },
            },
          };
        }
        if (key === 'core:sexual_prototypes') {
          return {
            entries: {
              aroused: {
                weights: { sex_excitation: 0.9 },
                gates: [
                  'sex_excitation >= 0.30',
                  'sex_excitation <= 0.95', // Range constraint
                ],
              },
            },
          };
        }
        return null;
      },
    };
  });

  describe('extractConstraintsFromPrototypeGates - determinism with multi-gate prototypes', () => {
    it('should return identical results across 20 calls for single prototype with range constraints', () => {
      const prerequisites = [
        {
          logic: {
            '>=': [{ var: 'emotions.flow' }, 0.5],
          },
        },
      ];

      const results = [];
      for (let i = 0; i < 20; i++) {
        results.push(
          extractConstraintsFromPrototypeGates(prerequisites, mockDataRegistry)
        );
      }

      // All results should be deeply equal
      const firstJson = JSON.stringify(results[0]);
      for (let i = 1; i < results.length; i++) {
        expect(JSON.stringify(results[i])).toBe(firstJson);
      }
    });

    it('should return identical results for multiple prototypes with overlapping axes', () => {
      // flow has arousal constraints, focused_absorption also has arousal constraints
      const prerequisites = [
        {
          logic: {
            and: [
              { '>=': [{ var: 'emotions.flow' }, 0.6] },
              { '>=': [{ var: 'emotions.focused_absorption' }, 0.5] },
            ],
          },
        },
      ];

      const jsonStrings = new Set();
      for (let i = 0; i < 20; i++) {
        const result = extractConstraintsFromPrototypeGates(
          prerequisites,
          mockDataRegistry
        );
        jsonStrings.add(JSON.stringify(result));
      }

      // Should produce only ONE unique JSON string (deterministic)
      expect(jsonStrings.size).toBe(1);
    });

    it('should preserve both >= and <= constraints for same axis when not deduplicating', () => {
      const prerequisites = [
        {
          logic: {
            '>=': [{ var: 'emotions.flow' }, 0.5],
          },
        },
      ];

      const result = extractConstraintsFromPrototypeGates(
        prerequisites,
        mockDataRegistry,
        { deduplicateByAxis: false }
      );

      // flow has arousal >= -0.25 AND arousal <= 0.70
      // Both should be preserved when not deduplicating
      const arousalConstraints = result.filter(
        (c) => c.varPath === 'moodAxes.arousal'
      );
      expect(arousalConstraints.length).toBe(2);

      const operators = arousalConstraints.map((c) => c.operator).sort();
      expect(operators).toEqual(['<=', '>=']);
    });

    it('should keep most restrictive constraints per axis when deduplicating', () => {
      // Both flow and focused_absorption have arousal >= constraints
      // flow: arousal >= -0.25, focused_absorption: arousal >= 0.10
      // Should keep arousal >= 0.10 (the higher, more restrictive threshold)
      const prerequisites = [
        {
          logic: {
            and: [
              { '>=': [{ var: 'emotions.flow' }, 0.6] },
              { '>=': [{ var: 'emotions.focused_absorption' }, 0.5] },
            ],
          },
        },
      ];

      const result = extractConstraintsFromPrototypeGates(
        prerequisites,
        mockDataRegistry,
        { deduplicateByAxis: true }
      );

      // Find arousal >= constraint
      const arousalGe = result.find(
        (c) => c.varPath === 'moodAxes.arousal' && c.operator === '>='
      );
      expect(arousalGe).toBeDefined();
      // focused_absorption has arousal >= 0.10 which is 10 in scaled units
      // flow has arousal >= -0.25 which is -25 in scaled units
      // 10 > -25, so 10 should be kept
      expect(arousalGe.threshold).toBe(10);

      // Find arousal <= constraint
      const arousalLe = result.find(
        (c) => c.varPath === 'moodAxes.arousal' && c.operator === '<='
      );
      expect(arousalLe).toBeDefined();
      // flow: arousal <= 0.70 (70), focused_absorption: arousal <= 0.60 (60)
      // 60 < 70, so 60 should be kept (more restrictive upper bound)
      expect(arousalLe.threshold).toBe(60);
    });

    it('should produce sorted output by varPath, operator, threshold', () => {
      const prerequisites = [
        {
          logic: {
            and: [
              { '>=': [{ var: 'emotions.flow' }, 0.6] },
              { '>=': [{ var: 'emotions.anger' }, 0.3] },
            ],
          },
        },
      ];

      const result = extractConstraintsFromPrototypeGates(
        prerequisites,
        mockDataRegistry,
        { deduplicateByAxis: true }
      );

      // Verify sorted order - collect all comparison results first
      const sortViolations = [];
      for (let i = 1; i < result.length; i++) {
        const prev = result[i - 1];
        const curr = result[i];

        const pathCompare = prev.varPath.localeCompare(curr.varPath);
        if (pathCompare > 0) {
          sortViolations.push(
            `varPath out of order at index ${i}: ${prev.varPath} > ${curr.varPath}`
          );
        } else if (pathCompare === 0) {
          const opCompare = prev.operator.localeCompare(curr.operator);
          if (opCompare > 0) {
            sortViolations.push(
              `operator out of order at index ${i}: ${prev.operator} > ${curr.operator}`
            );
          } else if (opCompare === 0) {
            if (prev.threshold > curr.threshold) {
              sortViolations.push(
                `threshold out of order at index ${i}: ${prev.threshold} > ${curr.threshold}`
              );
            }
          }
        }
      }

      // Assert no violations
      expect(sortViolations).toEqual([]);
    });

    it('should handle sexual prototypes with range constraints', () => {
      const prerequisites = [
        {
          logic: {
            '>=': [{ var: 'sexualStates.aroused' }, 0.5],
          },
        },
      ];

      const results = [];
      for (let i = 0; i < 10; i++) {
        results.push(
          extractConstraintsFromPrototypeGates(prerequisites, mockDataRegistry)
        );
      }

      // All results should be identical
      const firstJson = JSON.stringify(results[0]);
      for (let i = 1; i < results.length; i++) {
        expect(JSON.stringify(results[i])).toBe(firstJson);
      }

      // Should have both >= and <= for sex_excitation
      const sexConstraints = results[0].filter(
        (c) => c.varPath === 'sexualAxes.sex_excitation'
      );
      expect(sexConstraints.length).toBe(2);
    });

    it('should handle complex flow_absorption-like expression', () => {
      // Simulate the actual flow_absorption expression structure
      const prerequisites = [
        {
          logic: {
            and: [
              { '>=': [{ var: 'emotions.flow' }, 0.62] },
              { '>=': [{ var: 'emotions.focused_absorption' }, 0.6] },
              {
                or: [
                  { '>=': [{ var: 'emotions.joy' }, 0.35] },
                ],
              },
            ],
          },
        },
      ];

      // Run 30 times to catch any non-determinism
      const jsonStrings = new Set();
      for (let i = 0; i < 30; i++) {
        const result = extractConstraintsFromPrototypeGates(
          prerequisites,
          mockDataRegistry
        );
        jsonStrings.add(JSON.stringify(result));
      }

      // Must be deterministic - only one unique result
      expect(jsonStrings.size).toBe(1);
    });
  });

  describe('edge cases', () => {
    it('should handle empty prerequisites', () => {
      const result = extractConstraintsFromPrototypeGates([], mockDataRegistry);
      expect(result).toEqual([]);
    });

    it('should handle null dataRegistry', () => {
      const prerequisites = [
        { logic: { '>=': [{ var: 'emotions.flow' }, 0.5] } },
      ];
      const result = extractConstraintsFromPrototypeGates(prerequisites, null);
      expect(result).toEqual([]);
    });

    it('should handle prototype with no gates', () => {
      const registryWithNoGates = {
        getLookupData: () => ({
          entries: {
            flow: {
              weights: { valence: 0.5 },
              // No gates property
            },
          },
        }),
      };

      const prerequisites = [
        { logic: { '>=': [{ var: 'emotions.flow' }, 0.5] } },
      ];
      const result = extractConstraintsFromPrototypeGates(
        prerequisites,
        registryWithNoGates
      );
      expect(result).toEqual([]);
    });

    it('should handle malformed gate strings gracefully', () => {
      const registryWithBadGates = {
        getLookupData: () => ({
          entries: {
            flow: {
              weights: { valence: 0.5 },
              gates: [
                'valid >= 0.5',
                'invalid gate string',
                'another_valid <= 0.8',
              ],
            },
          },
        }),
      };

      const prerequisites = [
        { logic: { '>=': [{ var: 'emotions.flow' }, 0.5] } },
      ];

      // Should not throw, should skip bad gates
      const result = extractConstraintsFromPrototypeGates(
        prerequisites,
        registryWithBadGates
      );

      // Should have constraints from valid gates only
      expect(result.length).toBe(2);
    });
  });

  describe('GateConstraint parsing', () => {
    it('should correctly parse gates with >= operator', () => {
      const constraint = GateConstraint.parse('arousal >= 0.25');
      expect(constraint.axis).toBe('arousal');
      expect(constraint.operator).toBe('>=');
      expect(constraint.value).toBe(0.25);
    });

    it('should correctly parse gates with <= operator', () => {
      const constraint = GateConstraint.parse('threat <= 0.45');
      expect(constraint.axis).toBe('threat');
      expect(constraint.operator).toBe('<=');
      expect(constraint.value).toBe(0.45);
    });

    it('should correctly parse gates with negative values', () => {
      const constraint = GateConstraint.parse('arousal >= -0.25');
      expect(constraint.axis).toBe('arousal');
      expect(constraint.operator).toBe('>=');
      expect(constraint.value).toBe(-0.25);
    });
  });

  describe('convertGateToMoodConstraint', () => {
    it('should scale values from [-1,1] to [-100,100]', () => {
      const gateConstraint = GateConstraint.parse('valence >= 0.35');
      const moodConstraint = convertGateToMoodConstraint(gateConstraint);

      expect(moodConstraint.varPath).toBe('moodAxes.valence');
      expect(moodConstraint.operator).toBe('>=');
      expect(moodConstraint.threshold).toBe(35);
    });

    it('should handle negative values correctly', () => {
      const gateConstraint = GateConstraint.parse('arousal >= -0.25');
      const moodConstraint = convertGateToMoodConstraint(gateConstraint);

      expect(moodConstraint.varPath).toBe('moodAxes.arousal');
      expect(moodConstraint.operator).toBe('>=');
      expect(moodConstraint.threshold).toBe(-25);
    });
  });
});
