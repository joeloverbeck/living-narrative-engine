/**
 * @file Unit tests for prototypeNameGenerator utility
 */
import { describe, it, expect } from '@jest/globals';
import { generatePrototypeName } from '../../../src/expressionDiagnostics/utils/prototypeNameGenerator.js';

describe('prototypeNameGenerator', () => {
  describe('generatePrototypeName', () => {
    describe('basic name generation', () => {
      it('should generate name with up_ modifier for positive direction', () => {
        const targetSignature = {
          valence: { direction: 1, importance: 0.8 },
          arousal: { direction: -1, importance: 0.3 },
        };

        const result = generatePrototypeName(targetSignature, 'joy', new Set());

        expect(result).toBe('up_valence_joy');
      });

      it('should generate name with down_ modifier for negative direction', () => {
        const targetSignature = {
          valence: { direction: -1, importance: 0.9 },
          arousal: { direction: 1, importance: 0.2 },
        };

        const result = generatePrototypeName(targetSignature, 'sadness', new Set());

        expect(result).toBe('down_valence_sadness');
      });

      it('should use prototype as base when no anchor provided', () => {
        const targetSignature = {
          arousal: { direction: 1, importance: 0.7 },
        };

        const result = generatePrototypeName(targetSignature, null, new Set());

        expect(result).toBe('up_arousal_prototype');
      });

      it('should handle Map input for targetSignature', () => {
        const targetSignature = new Map([
          ['valence', { direction: 1, importance: 0.6 }],
        ]);

        const result = generatePrototypeName(targetSignature, 'test', new Set());

        expect(result).toBe('up_valence_test');
      });
    });

    describe('strongest axis selection', () => {
      it('should select axis with highest absolute importance', () => {
        const targetSignature = {
          valence: { direction: 1, importance: 0.3 },
          arousal: { direction: -1, importance: 0.8 },
          dominance: { direction: 1, importance: 0.5 },
        };

        const result = generatePrototypeName(targetSignature, 'base', new Set());

        expect(result).toBe('down_arousal_base');
      });

      it('should use alphabetical tie-breaker for equal importance', () => {
        const targetSignature = {
          valence: { direction: 1, importance: 0.5 },
          arousal: { direction: -1, importance: 0.5 },
          dominance: { direction: 1, importance: 0.5 },
        };

        const result = generatePrototypeName(targetSignature, 'base', new Set());

        // arousal comes before dominance and valence alphabetically
        expect(result).toBe('down_arousal_base');
      });

      it('should handle single axis', () => {
        const targetSignature = {
          threat: { direction: -1, importance: 0.6 },
        };

        const result = generatePrototypeName(targetSignature, 'fear', new Set());

        expect(result).toBe('down_threat_fear');
      });
    });

    describe('collision handling', () => {
      it('should append _v2 suffix on first collision', () => {
        const targetSignature = {
          valence: { direction: 1, importance: 0.8 },
        };
        const existingNames = new Set(['up_valence_joy']);

        const result = generatePrototypeName(targetSignature, 'joy', existingNames);

        expect(result).toBe('up_valence_joy_v2');
      });

      it('should increment suffix for multiple collisions', () => {
        const targetSignature = {
          valence: { direction: 1, importance: 0.8 },
        };
        const existingNames = new Set([
          'up_valence_joy',
          'up_valence_joy_v2',
          'up_valence_joy_v3',
        ]);

        const result = generatePrototypeName(targetSignature, 'joy', existingNames);

        expect(result).toBe('up_valence_joy_v4');
      });

      it('should handle array input for existingNames', () => {
        const targetSignature = {
          valence: { direction: 1, importance: 0.8 },
        };
        const existingNames = ['up_valence_joy', 'up_valence_joy_v2'];

        const result = generatePrototypeName(targetSignature, 'joy', existingNames);

        expect(result).toBe('up_valence_joy_v3');
      });

      it('should not append suffix when no collision', () => {
        const targetSignature = {
          valence: { direction: 1, importance: 0.8 },
        };
        const existingNames = new Set(['other_name', 'another_name']);

        const result = generatePrototypeName(targetSignature, 'joy', existingNames);

        expect(result).toBe('up_valence_joy');
      });
    });

    describe('edge cases', () => {
      it('should handle empty targetSignature', () => {
        const result = generatePrototypeName({}, 'base', new Set());

        expect(result).toBe('synthesized_base');
      });

      it('should handle null targetSignature', () => {
        const result = generatePrototypeName(null, 'base', new Set());

        expect(result).toBe('synthesized_base');
      });

      it('should handle undefined targetSignature', () => {
        const result = generatePrototypeName(undefined, 'base', new Set());

        expect(result).toBe('synthesized_base');
      });

      it('should handle empty Map', () => {
        const result = generatePrototypeName(new Map(), 'base', new Set());

        expect(result).toBe('synthesized_base');
      });

      it('should handle missing importance in entry', () => {
        const targetSignature = {
          valence: { direction: 1 },
        };

        const result = generatePrototypeName(targetSignature, 'base', new Set());

        // importance defaults to 0, so this axis won't win
        expect(result).toBe('synthesized_base');
      });

      it('should handle missing direction in entry', () => {
        const targetSignature = {
          valence: { importance: 0.8 },
        };

        const result = generatePrototypeName(targetSignature, 'base', new Set());

        // direction defaults to 1 (positive)
        expect(result).toBe('up_valence_base');
      });

      it('should handle zero importance', () => {
        const targetSignature = {
          valence: { direction: 1, importance: 0 },
        };

        const result = generatePrototypeName(targetSignature, 'base', new Set());

        expect(result).toBe('synthesized_base');
      });

      it('should handle no existingNames parameter', () => {
        const targetSignature = {
          valence: { direction: 1, importance: 0.5 },
        };

        const result = generatePrototypeName(targetSignature, 'base');

        expect(result).toBe('up_valence_base');
      });
    });

    describe('determinism', () => {
      it('should produce identical output for identical inputs', () => {
        const targetSignature = {
          valence: { direction: 1, importance: 0.7 },
          arousal: { direction: -1, importance: 0.4 },
        };
        const existingNames = new Set(['some_other_name']);

        const result1 = generatePrototypeName(targetSignature, 'joy', existingNames);
        const result2 = generatePrototypeName(targetSignature, 'joy', existingNames);
        const result3 = generatePrototypeName(targetSignature, 'joy', existingNames);

        expect(result1).toBe(result2);
        expect(result2).toBe(result3);
        expect(result1).toBe('up_valence_joy');
      });

      it('should maintain stable ordering when axes have equal importance', () => {
        // Run multiple times to verify determinism
        for (let i = 0; i < 10; i++) {
          const targetSignature = {
            zeta: { direction: 1, importance: 0.5 },
            alpha: { direction: -1, importance: 0.5 },
            beta: { direction: 1, importance: 0.5 },
          };

          const result = generatePrototypeName(targetSignature, 'base', new Set());

          // alpha should always win (alphabetically first)
          expect(result).toBe('down_alpha_base');
        }
      });
    });
  });
});
