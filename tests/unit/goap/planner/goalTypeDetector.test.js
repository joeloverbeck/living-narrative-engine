/**
 * @file goalTypeDetector.test.js
 * @description Unit tests for goalTypeDetector utility
 */

import { describe, it, expect } from '@jest/globals';
import {
  detectGoalType,
  allowsOvershoot,
  extractEqualityTarget,
} from '../../../../src/goap/planner/goalTypeDetector.js';

describe('goalTypeDetector', () => {
  describe('detectGoalType()', () => {
    describe('equality goals', () => {
      it('should detect == operator as equality', () => {
        const goal = { '==': [{ var: 'hunger' }, 10] };
        expect(detectGoalType(goal)).toBe('equality');
      });

      it('should detect === operator as equality', () => {
        const goal = { '===': [{ var: 'hunger' }, 10] };
        expect(detectGoalType(goal)).toBe('equality');
      });
    });

    describe('inequality goals', () => {
      it('should detect <= operator as inequality', () => {
        const goal = { '<=': [{ var: 'hunger' }, 10] };
        expect(detectGoalType(goal)).toBe('inequality');
      });

      it('should detect >= operator as inequality', () => {
        const goal = { '>=': [{ var: 'health' }, 80] };
        expect(detectGoalType(goal)).toBe('inequality');
      });

      it('should detect < operator as inequality', () => {
        const goal = { '<': [{ var: 'hunger' }, 10] };
        expect(detectGoalType(goal)).toBe('inequality');
      });

      it('should detect > operator as inequality', () => {
        const goal = { '>': [{ var: 'health' }, 80] };
        expect(detectGoalType(goal)).toBe('inequality');
      });

      it('should detect != operator as inequality', () => {
        const goal = { '!=': [{ var: 'status' }, 'dead'] };
        expect(detectGoalType(goal)).toBe('inequality');
      });

      it('should detect !== operator as inequality', () => {
        const goal = { '!==': [{ var: 'status' }, 'dead'] };
        expect(detectGoalType(goal)).toBe('inequality');
      });
    });

    describe('complex goals', () => {
      it('should detect and operator as complex', () => {
        const goal = {
          and: [
            { '<=': [{ var: 'hunger' }, 10] },
            { '>=': [{ var: 'health' }, 80] },
          ],
        };
        expect(detectGoalType(goal)).toBe('complex');
      });

      it('should detect or operator as complex', () => {
        const goal = {
          or: [
            { '<=': [{ var: 'hunger' }, 10] },
            { '>=': [{ var: 'health' }, 80] },
          ],
        };
        expect(detectGoalType(goal)).toBe('complex');
      });

      it('should detect not operator as complex', () => {
        const goal = {
          not: { '==': [{ var: 'status' }, 'dead'] },
        };
        expect(detectGoalType(goal)).toBe('complex');
      });
    });

    describe('invalid input', () => {
      it('should return unknown for null', () => {
        expect(detectGoalType(null)).toBe('unknown');
      });

      it('should return unknown for undefined', () => {
        expect(detectGoalType(undefined)).toBe('unknown');
      });

      it('should return unknown for empty object', () => {
        expect(detectGoalType({})).toBe('unknown');
      });

      it('should return unknown for non-object', () => {
        expect(detectGoalType('string')).toBe('unknown');
        expect(detectGoalType(42)).toBe('unknown');
        expect(detectGoalType(true)).toBe('unknown');
      });

      it('should return unknown for unrecognized operator', () => {
        const goal = { 'custom-op': [{ var: 'x' }, 10] };
        expect(detectGoalType(goal)).toBe('unknown');
      });
    });
  });

  describe('allowsOvershoot()', () => {
    describe('inequality goals allow overshoot', () => {
      it('should allow overshoot for <= goals', () => {
        const goal = { '<=': [{ var: 'hunger' }, 10] };
        expect(allowsOvershoot(goal)).toBe(true);
      });

      it('should allow overshoot for >= goals', () => {
        const goal = { '>=': [{ var: 'health' }, 80] };
        expect(allowsOvershoot(goal)).toBe(true);
      });

      it('should allow overshoot for < goals', () => {
        const goal = { '<': [{ var: 'hunger' }, 10] };
        expect(allowsOvershoot(goal)).toBe(true);
      });

      it('should allow overshoot for > goals', () => {
        const goal = { '>': [{ var: 'health' }, 80] };
        expect(allowsOvershoot(goal)).toBe(true);
      });

      it('should allow overshoot for != goals', () => {
        const goal = { '!=': [{ var: 'status' }, 'dead'] };
        expect(allowsOvershoot(goal)).toBe(true);
      });
    });

    describe('equality goals do not allow overshoot', () => {
      it('should not allow overshoot for == goals', () => {
        const goal = { '==': [{ var: 'gold' }, 100] };
        expect(allowsOvershoot(goal)).toBe(false);
      });

      it('should not allow overshoot for === goals', () => {
        const goal = { '===': [{ var: 'gold' }, 100] };
        expect(allowsOvershoot(goal)).toBe(false);
      });
    });

    describe('complex goals do not allow overshoot', () => {
      it('should not allow overshoot for and goals', () => {
        const goal = {
          and: [{ '<=': [{ var: 'hunger' }, 10] }],
        };
        expect(allowsOvershoot(goal)).toBe(false);
      });

      it('should not allow overshoot for or goals', () => {
        const goal = {
          or: [{ '<=': [{ var: 'hunger' }, 10] }],
        };
        expect(allowsOvershoot(goal)).toBe(false);
      });

      it('should not allow overshoot for not goals', () => {
        const goal = {
          not: { '==': [{ var: 'status' }, 'dead'] },
        };
        expect(allowsOvershoot(goal)).toBe(false);
      });
    });

    describe('unknown goals allow overshoot (conservative)', () => {
      it('should allow overshoot for null', () => {
        expect(allowsOvershoot(null)).toBe(true);
      });

      it('should allow overshoot for empty object', () => {
        expect(allowsOvershoot({})).toBe(true);
      });

      it('should allow overshoot for unrecognized operators', () => {
        const goal = { 'custom-op': [{ var: 'x' }, 10] };
        expect(allowsOvershoot(goal)).toBe(true);
      });
    });
  });

  describe('extractEqualityTarget()', () => {
    describe('successful extraction', () => {
      it('should extract numeric target from == operator', () => {
        const goal = { '==': [{ var: 'hunger' }, 10] };
        expect(extractEqualityTarget(goal)).toBe(10);
      });

      it('should extract numeric target from === operator', () => {
        const goal = { '===': [{ var: 'gold' }, 100] };
        expect(extractEqualityTarget(goal)).toBe(100);
      });

      it('should extract zero value', () => {
        const goal = { '==': [{ var: 'hunger' }, 0] };
        expect(extractEqualityTarget(goal)).toBe(0);
      });

      it('should extract negative value', () => {
        const goal = { '==': [{ var: 'temperature' }, -10] };
        expect(extractEqualityTarget(goal)).toBe(-10);
      });

      it('should extract decimal value', () => {
        const goal = { '==': [{ var: 'ratio' }, 0.75] };
        expect(extractEqualityTarget(goal)).toBe(0.75);
      });
    });

    describe('returns null for non-equality goals', () => {
      it('should return null for <= operator', () => {
        const goal = { '<=': [{ var: 'hunger' }, 10] };
        expect(extractEqualityTarget(goal)).toBeNull();
      });

      it('should return null for >= operator', () => {
        const goal = { '>=': [{ var: 'health' }, 80] };
        expect(extractEqualityTarget(goal)).toBeNull();
      });

      it('should return null for < operator', () => {
        const goal = { '<': [{ var: 'hunger' }, 10] };
        expect(extractEqualityTarget(goal)).toBeNull();
      });

      it('should return null for > operator', () => {
        const goal = { '>': [{ var: 'health' }, 80] };
        expect(extractEqualityTarget(goal)).toBeNull();
      });

      it('should return null for != operator', () => {
        const goal = { '!=': [{ var: 'status' }, 'dead'] };
        expect(extractEqualityTarget(goal)).toBeNull();
      });

      it('should return null for complex goals', () => {
        const goal = {
          and: [{ '==': [{ var: 'hunger' }, 10] }],
        };
        expect(extractEqualityTarget(goal)).toBeNull();
      });
    });

    describe('returns null for non-numeric targets', () => {
      it('should return null for string target', () => {
        const goal = { '==': [{ var: 'status' }, 'alive'] };
        expect(extractEqualityTarget(goal)).toBeNull();
      });

      it('should return null for boolean target', () => {
        const goal = { '==': [{ var: 'alive' }, true] };
        expect(extractEqualityTarget(goal)).toBeNull();
      });

      it('should return null for object target', () => {
        const goal = { '==': [{ var: 'config' }, { key: 'value' }] };
        expect(extractEqualityTarget(goal)).toBeNull();
      });

      it('should return null for array target', () => {
        const goal = { '==': [{ var: 'items' }, ['item1', 'item2']] };
        expect(extractEqualityTarget(goal)).toBeNull();
      });

      it('should return null for null target', () => {
        const goal = { '==': [{ var: 'value' }, null] };
        expect(extractEqualityTarget(goal)).toBeNull();
      });
    });

    describe('invalid input', () => {
      it('should return null for null goal', () => {
        expect(extractEqualityTarget(null)).toBeNull();
      });

      it('should return null for undefined goal', () => {
        expect(extractEqualityTarget(undefined)).toBeNull();
      });

      it('should return null for empty object', () => {
        expect(extractEqualityTarget({})).toBeNull();
      });
    });
  });

  describe('integration scenarios', () => {
    it('should handle overshoot scenario for inequality goal', () => {
      // State: hunger = 15, task: -60 hunger, goal: hunger ≤ 10
      // After: 15 - 60 = -45 → clamped to 0
      // Goal check: 0 ≤ 10 → TRUE
      const goal = { '<=': [{ var: 'actor.state.hunger' }, 10] };

      expect(detectGoalType(goal)).toBe('inequality');
      expect(allowsOvershoot(goal)).toBe(true);
      expect(extractEqualityTarget(goal)).toBeNull();
    });

    it('should handle exact match scenario for equality goal', () => {
      // State: gold = 75, task: +25 gold, goal: gold = 100
      // After: 75 + 25 = 100 (exact)
      const goal = { '==': [{ var: 'actor.state.gold' }, 100] };

      expect(detectGoalType(goal)).toBe('equality');
      expect(allowsOvershoot(goal)).toBe(false);
      expect(extractEqualityTarget(goal)).toBe(100);
    });

    it('should handle complex multi-constraint goal', () => {
      // Goal: hunger ≤ 10 AND health ≥ 80
      const goal = {
        and: [
          { '<=': [{ var: 'actor.state.hunger' }, 10] },
          { '>=': [{ var: 'actor.state.health' }, 80] },
        ],
      };

      expect(detectGoalType(goal)).toBe('complex');
      expect(allowsOvershoot(goal)).toBe(false);
      expect(extractEqualityTarget(goal)).toBeNull();
    });
  });
});
