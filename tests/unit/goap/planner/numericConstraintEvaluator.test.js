import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import NumericConstraintEvaluator from '../../../../src/goap/planner/numericConstraintEvaluator.js';
import { clearNumericConstraintDiagnostics, getNumericConstraintDiagnostics } from '../../../../src/goap/planner/numericConstraintDiagnostics.js';
import { GOAP_EVENTS } from '../../../../src/goap/events/goapEvents.js';

describe('NumericConstraintEvaluator', () => {
  let testBed;
  let evaluator;
  let mockJsonLogicEvaluator;
  let mockLogger;
  let originalAdapterEnv;
  let originalStrictEnv;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();
    mockJsonLogicEvaluator = testBed.createMock('JsonLogicEvaluationService', ['evaluate']);
    originalAdapterEnv = process.env.GOAP_NUMERIC_ADAPTER;
    originalStrictEnv = process.env.GOAP_NUMERIC_STRICT;

    evaluator = new NumericConstraintEvaluator({
      jsonLogicEvaluator: mockJsonLogicEvaluator,
      logger: mockLogger,
    });
  });

  afterEach(() => {
    testBed.cleanup();
    clearNumericConstraintDiagnostics();
    if (typeof originalAdapterEnv === 'undefined') {
      delete process.env.GOAP_NUMERIC_ADAPTER;
    } else {
      process.env.GOAP_NUMERIC_ADAPTER = originalAdapterEnv;
    }
    if (typeof originalStrictEnv === 'undefined') {
      delete process.env.GOAP_NUMERIC_STRICT;
    } else {
      process.env.GOAP_NUMERIC_STRICT = originalStrictEnv;
    }
  });

  describe('Constructor', () => {
    it('should validate jsonLogicEvaluator dependency', () => {
      expect(() => {
        new NumericConstraintEvaluator({
          jsonLogicEvaluator: {},
          logger: mockLogger,
        });
      }).toThrow();
    });

    it('should validate logger dependency', () => {
      expect(() => {
        new NumericConstraintEvaluator({
          jsonLogicEvaluator: mockJsonLogicEvaluator,
          logger: null,
        });
      }).not.toThrow(); // ensureValidLogger provides fallback
    });
  });

  describe('Dual-Format State Extraction', () => {
    describe('Component IDs with Colons', () => {
      it('should extract from nested format with component ID containing colon', () => {
        // State: state.actor.components['core:needs'].hunger
        const context = {
          state: {
            actor: {
              id: 'test_actor',
              components: {
                'core:needs': { hunger: 80 },
              },
            },
          },
        };

        const distance = evaluator.calculateDistance(
          { '<=': [{ var: 'state.actor.components.core:needs.hunger' }, 30] },
          context
        );

        expect(distance).toBe(50); // 80 - 30 = 50
      });

      it('should extract from flat format with component ID containing colon', () => {
        // State: state['test_actor:core:needs'].hunger
        const context = {
          state: {
            'test_actor:core:needs': { hunger: 80 },
            actor: {
              id: 'test_actor',
              components: {}, // Nested format empty
            },
          },
        };

        const distance = evaluator.calculateDistance(
          { '<=': [{ var: 'state.actor.components.core:needs.hunger' }, 30] },
          context
        );

        expect(distance).toBe(50); // Should fall back to flat format
      });

      it('should extract from dual-format state (both formats present)', () => {
        // Both nested and flat formats present (planner sync scenario)
        const context = {
          state: {
            actor: {
              id: 'test_actor',
              components: {
                'core:needs': { hunger: 80 },
              },
            },
            'test_actor:core:needs': { hunger: 80 },
          },
        };

        const distance = evaluator.calculateDistance(
          { '<=': [{ var: 'state.actor.components.core:needs.hunger' }, 30] },
          context
        );

        expect(distance).toBe(50);
      });

      it('should handle multiple colons in component ID', () => {
        const context = {
          state: {
            actor: {
              id: 'test_actor',
              components: {
                'mod:category:component': { value: 100 },
              },
            },
          },
        };

        const distance = evaluator.calculateDistance(
          { '>=': [{ var: 'state.actor.components.mod:category:component.value' }, 50] },
          context
        );

        expect(distance).toBe(0); // 100 >= 50, distance = 0
      });
    });

    describe('Different Component Types', () => {
      it('should extract from core:stats component', () => {
        const context = {
          state: {
            actor: {
              id: 'test_actor',
              components: {
                'core:stats': { health: 40 },
              },
            },
          },
        };

        const distance = evaluator.calculateDistance(
          { '>=': [{ var: 'state.actor.components.core:stats.health' }, 80] },
          context
        );

        expect(distance).toBe(40); // Need 40 more health
      });

      it('should extract from core:inventory component', () => {
        const context = {
          state: {
            actor: {
              id: 'test_actor',
              components: {
                'core:inventory': { gold: 30 },
              },
            },
          },
        };

        const distance = evaluator.calculateDistance(
          { '>=': [{ var: 'state.actor.components.core:inventory.gold' }, 100] },
          context
        );

        expect(distance).toBe(70); // Need 70 more gold
      });
    });

    describe('Flat Format Inference', () => {
      it('should infer actor ID from flat keys when actor.id not available', () => {
        // Scenario: Only flat format available, actor object minimal
        const context = {
          state: {
            'inferred_actor:core:needs': { hunger: 80 },
            actor: {
              components: {}, // Empty nested
            },
          },
        };

        const distance = evaluator.calculateDistance(
          { '<=': [{ var: 'state.actor.components.core:needs.hunger' }, 30] },
          context
        );

        expect(distance).toBe(50); // Should infer actor ID and extract
      });

      it('should handle multiple entities in flat format', () => {
        const context = {
          state: {
            'actor1:core:needs': { hunger: 50 },
            'actor2:core:needs': { hunger: 90 },
            actor: {
              id: 'actor1',
              components: {},
            },
          },
        };

        const distance = evaluator.calculateDistance(
          { '<=': [{ var: 'state.actor.components.core:needs.hunger' }, 30] },
          context
        );

        expect(distance).toBe(20); // Should use actor1's hunger (50)
      });
    });

    describe('Fallback Behavior', () => {
      it('should return null when value not found in either format', () => {
        const context = {
          state: {
            actor: {
              id: 'test_actor',
              components: {},
            },
          },
        };

        const distance = evaluator.calculateDistance(
          { '<=': [{ var: 'state.actor.components.core:needs.hunger' }, 30] },
          context
        );

        expect(distance).toBeNull(); // No value found
      });

      it('should return null for malformed component path', () => {
        const context = {
          state: {
            actor: {
              components: {
                'core:needs': { hunger: 80 },
              },
            },
          },
        };

        const distance = evaluator.calculateDistance(
          { '<=': [{ var: 'state.actor.components' }, 30] }, // Missing field
          context
        );

        expect(distance).toBeNull();
      });
    });

    describe('Logging', () => {
      it('should log debug message when extraction fails', () => {
        const context = {
          state: {
            actor: {
              components: {},
            },
          },
        };

        evaluator.calculateDistance(
          { '<=': [{ var: 'state.actor.components.missing:component.field' }, 30] },
          context
        );

        expect(mockLogger.debug).toHaveBeenCalled();
      });
    });

    describe('Diagnostics & Strict Mode', () => {
      it('emits fallback diagnostics and event when adapter flag enabled', () => {
        process.env.GOAP_NUMERIC_ADAPTER = '1';
        const dispatcher = { dispatch: jest.fn() };
        evaluator = new NumericConstraintEvaluator({
          jsonLogicEvaluator: mockJsonLogicEvaluator,
          logger: mockLogger,
          goapEventDispatcher: dispatcher,
        });

        const context = {
          state: {
            actor: {
              id: 'actor-diag',
              components: {},
            },
          },
        };

        const result = evaluator.calculateDistance(
          { '<=': [{ var: 'state.actor.components.core:needs.hunger' }, 10] },
          context,
          { metadata: { goalId: 'goal-diag' } }
        );

        expect(result).toBeNull();
        const diagnostics = getNumericConstraintDiagnostics('actor-diag');
        expect(diagnostics?.totalFallbacks).toBe(1);
        expect(dispatcher.dispatch).toHaveBeenCalledWith(
          GOAP_EVENTS.NUMERIC_CONSTRAINT_FALLBACK,
          expect.objectContaining({ goalId: 'goal-diag', actorId: 'actor-diag' })
        );
      });

      it('throws when GOAP_NUMERIC_STRICT is enabled', () => {
        process.env.GOAP_NUMERIC_ADAPTER = '1';
        process.env.GOAP_NUMERIC_STRICT = '1';
        const context = {
          state: {
            actor: {
              id: 'actor-strict',
              components: {},
            },
          },
        };

        expect(() =>
          evaluator.calculateDistance(
            { '<=': [{ var: 'state.actor.components.core:needs.hunger' }, 5] },
            context,
            { metadata: { goalId: 'goal-strict' } }
          )
        ).toThrow(/\[GOAP_NUMERIC_STRICT]/);
      });
    });
  });

  describe('calculateDistance', () => {
    describe('Greater Than (>) Operator', () => {
      it('should calculate distance for > constraint when current < target', () => {
        // Current: 30, Goal: > 50, Distance: 20
        const context = { hunger: 30 };
        const distance = evaluator.calculateDistance(
          { '>': [{ var: 'hunger' }, 50] },
          context
        );

        expect(distance).toBe(20);
      });

      it('should return 0 when > constraint already satisfied', () => {
        // Current: 60, Goal: > 50, Distance: 0
        const context = { hunger: 60 };
        const distance = evaluator.calculateDistance(
          { '>': [{ var: 'hunger' }, 50] },
          context
        );

        expect(distance).toBe(0);
      });
    });

    describe('Greater Than or Equal (>=) Operator', () => {
      it('should calculate distance for >= constraint when current < target', () => {
        // Current: 30, Goal: >= 50, Distance: 20
        const context = { health: 30 };
        const distance = evaluator.calculateDistance(
          { '>=': [{ var: 'health' }, 50] },
          context
        );

        expect(distance).toBe(20);
      });

      it('should return 0 when >= constraint already satisfied', () => {
        // Current: 50, Goal: >= 50, Distance: 0
        const context = { health: 50 };
        const distance = evaluator.calculateDistance(
          { '>=': [{ var: 'health' }, 50] },
          context
        );

        expect(distance).toBe(0);
      });
    });

    describe('Less Than (<) Operator', () => {
      it('should calculate distance for < constraint when current > target', () => {
        // Current: 80, Goal: < 30, Distance: 50
        const context = { hunger: 80 };
        const distance = evaluator.calculateDistance(
          { '<': [{ var: 'hunger' }, 30] },
          context
        );

        expect(distance).toBe(50);
      });

      it('should return 0 when < constraint already satisfied', () => {
        // Current: 20, Goal: < 30, Distance: 0
        const context = { hunger: 20 };
        const distance = evaluator.calculateDistance(
          { '<': [{ var: 'hunger' }, 30] },
          context
        );

        expect(distance).toBe(0);
      });
    });

    describe('Less Than or Equal (<=) Operator', () => {
      it('should calculate distance for <= constraint when current > target', () => {
        // Current: 80, Goal: <= 30, Distance: 50
        const context = { hunger: 80 };
        const distance = evaluator.calculateDistance(
          { '<=': [{ var: 'hunger' }, 30] },
          context
        );

        expect(distance).toBe(50);
      });

      it('should return 0 when <= constraint already satisfied', () => {
        // Current: 30, Goal: <= 30, Distance: 0
        const context = { hunger: 30 };
        const distance = evaluator.calculateDistance(
          { '<=': [{ var: 'hunger' }, 30] },
          context
        );

        expect(distance).toBe(0);
      });
    });

    describe('Equal (==) Operator', () => {
      it('should calculate distance for == constraint', () => {
        // Current: 80, Goal: == 30, Distance: 50
        const context = { value: 80 };
        const distance = evaluator.calculateDistance(
          { '==': [{ var: 'value' }, 30] },
          context
        );

        expect(distance).toBe(50);
      });

      it('should return 0 when == constraint already satisfied', () => {
        // Current: 30, Goal: == 30, Distance: 0
        const context = { value: 30 };
        const distance = evaluator.calculateDistance(
          { '==': [{ var: 'value' }, 30] },
          context
        );

        expect(distance).toBe(0);
      });
    });

    describe('Edge Cases', () => {
      it('should return null for non-numeric constraints', () => {
        const distance = evaluator.calculateDistance(
          { has_component: ['core:actor'] },
          { actor: {} }
        );

        expect(distance).toBeNull();
      });

      it('should return null when field missing from context', () => {
        const distance = evaluator.calculateDistance(
          { '<=': [{ var: 'missing' }, 30] },
          {}
        );

        expect(distance).toBeNull();
      });

      it('should return null when field is not a number', () => {
        const distance = evaluator.calculateDistance(
          { '<=': [{ var: 'field' }, 30] },
          { field: 'string' }
        );

        expect(distance).toBeNull();
      });

      it('should return null when target value is not a number', () => {
        const distance = evaluator.calculateDistance(
          { '<=': [{ var: 'field' }, 'not-a-number'] },
          { field: 50 }
        );

        expect(distance).toBeNull();
      });

      it('should handle deeply nested var paths', () => {
        const context = {
          actor: {
            components: {
              'core:needs': { hunger: 80 },
            },
          },
        };

        const distance = evaluator.calculateDistance(
          { '<=': [{ var: 'actor.components.core:needs.hunger' }, 30] },
          context
        );

        expect(distance).toBe(50);
      });

      it('should return null when constraint is null', () => {
        const distance = evaluator.calculateDistance(null, { hunger: 50 });
        expect(distance).toBeNull();
      });

      it('should return null when context is null', () => {
        const distance = evaluator.calculateDistance({ '<=': [{ var: 'hunger' }, 30] }, null);
        expect(distance).toBeNull();
      });

      it('should handle malformed context gracefully', () => {
        // Pass a context where the path doesn't exist
        const distance = evaluator.calculateDistance(
          { '<=': [{ var: 'nonexistent.path' }, 30] },
          { hunger: 80 }
        );

        // Should return null because extracted value is undefined (not a number)
        expect(distance).toBeNull();
      });
    });
  });

  describe('isNumericConstraint', () => {
    it('should identify > operator as numeric', () => {
      const result = evaluator.isNumericConstraint({ '>': [{ var: 'x' }, 10] });
      expect(result).toBe(true);
    });

    it('should identify < operator as numeric', () => {
      const result = evaluator.isNumericConstraint({ '<': [{ var: 'x' }, 10] });
      expect(result).toBe(true);
    });

    it('should identify >= operator as numeric', () => {
      const result = evaluator.isNumericConstraint({ '>=': [{ var: 'x' }, 10] });
      expect(result).toBe(true);
    });

    it('should identify <= operator as numeric', () => {
      const result = evaluator.isNumericConstraint({ '<=': [{ var: 'x' }, 10] });
      expect(result).toBe(true);
    });

    it('should identify == operator as numeric', () => {
      const result = evaluator.isNumericConstraint({ '==': [{ var: 'x' }, 10] });
      expect(result).toBe(true);
    });

    it('should reject and operator as non-numeric', () => {
      const result = evaluator.isNumericConstraint({ and: [true, true] });
      expect(result).toBe(false);
    });

    it('should reject or operator as non-numeric', () => {
      const result = evaluator.isNumericConstraint({ or: [false, true] });
      expect(result).toBe(false);
    });

    it('should reject has_component as non-numeric', () => {
      const result = evaluator.isNumericConstraint({ has_component: ['core:actor'] });
      expect(result).toBe(false);
    });

    it('should return false for null constraint', () => {
      const result = evaluator.isNumericConstraint(null);
      expect(result).toBe(false);
    });

    it('should return false for empty object', () => {
      const result = evaluator.isNumericConstraint({});
      expect(result).toBe(false);
    });

    it('should return false for non-object constraint', () => {
      const result = evaluator.isNumericConstraint('not an object');
      expect(result).toBe(false);
    });
  });

  describe('evaluateConstraint', () => {
    it('should delegate to jsonLogicEvaluator', () => {
      mockJsonLogicEvaluator.evaluate.mockReturnValue(true);

      const result = evaluator.evaluateConstraint({ '<=': [{ var: 'hunger' }, 30] }, { hunger: 25 });

      expect(result).toBe(true);
      expect(mockJsonLogicEvaluator.evaluate).toHaveBeenCalledWith(
        { '<=': [{ var: 'hunger' }, 30] },
        { hunger: 25 }
      );
    });

    it('should pass correct constraint and context', () => {
      mockJsonLogicEvaluator.evaluate.mockReturnValue(false);

      const constraint = { '>=': [{ var: 'health' }, 50] };
      const context = { health: 30 };

      evaluator.evaluateConstraint(constraint, context);

      expect(mockJsonLogicEvaluator.evaluate).toHaveBeenCalledWith(constraint, context);
    });

    it('should handle evaluation errors gracefully', () => {
      mockJsonLogicEvaluator.evaluate.mockImplementation(() => {
        throw new Error('Evaluation error');
      });

      const result = evaluator.evaluateConstraint({ '<=': [{ var: 'hunger' }, 30] }, { hunger: 25 });

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should return false when evaluation throws', () => {
      mockJsonLogicEvaluator.evaluate.mockImplementation(() => {
        throw new Error('Test error');
      });

      const result = evaluator.evaluateConstraint({ '<=': [{ var: 'x' }, 10] }, { x: 5 });

      expect(result).toBe(false);
    });
  });
});
