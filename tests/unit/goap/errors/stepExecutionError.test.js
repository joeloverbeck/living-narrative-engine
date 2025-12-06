/**
 * @file Tests for StepExecutionError class
 */

import { describe, it, expect } from '@jest/globals';
import StepExecutionError from '../../../../src/goap/errors/stepExecutionError.js';
import GoapError from '../../../../src/goap/errors/goapError.js';
import BaseError from '../../../../src/errors/baseError.js';

describe('StepExecutionError', () => {
  describe('Inheritance Chain', () => {
    it('should extend GoapError', () => {
      const error = new StepExecutionError('Step execution failed');
      expect(error).toBeInstanceOf(GoapError);
    });

    it('should extend BaseError', () => {
      const error = new StepExecutionError('Step execution failed');
      expect(error).toBeInstanceOf(BaseError);
    });

    it('should extend Error', () => {
      const error = new StepExecutionError('Step execution failed');
      expect(error).toBeInstanceOf(Error);
    });

    it('should have correct name property', () => {
      const error = new StepExecutionError('Step execution failed');
      expect(error.name).toBe('StepExecutionError');
    });
  });

  describe('Error Code', () => {
    it('should have GOAP_STEP_EXECUTION_ERROR code', () => {
      const error = new StepExecutionError('Step execution failed');
      expect(error.code).toBe('GOAP_STEP_EXECUTION_ERROR');
    });
  });

  describe('Constructor', () => {
    it('should create error with message only', () => {
      const error = new StepExecutionError('Step execution failed');
      expect(error.message).toBe('Step execution failed');
    });

    it('should create error with message and context', () => {
      const context = {
        stepIndex: 2,
        stepType: 'action',
        actionId: 'pickup_item',
        targetBindings: { item: 'item-123', target: 'floor' },
        reason: 'Item not accessible',
        methodId: 'acquire_item_method',
        taskId: 'get_food',
        actorId: 'actor-player',
      };
      const error = new StepExecutionError('Step execution failed', context);
      expect(error.message).toBe('Step execution failed');
      expect(error.context).toEqual(context);
    });

    it('should create error with correlation ID option', () => {
      const correlationId = 'custom-correlation-id';
      const error = new StepExecutionError(
        'Step execution failed',
        {},
        { correlationId }
      );
      expect(error.correlationId).toBe(correlationId);
    });
  });

  describe('Context Properties', () => {
    it('should preserve stepIndex in context', () => {
      const context = { stepIndex: 5 };
      const error = new StepExecutionError('Step execution failed', context);
      expect(error.context.stepIndex).toBe(5);
    });

    it('should preserve stepType in context', () => {
      const context = { stepType: 'subtask' };
      const error = new StepExecutionError('Step execution failed', context);
      expect(error.context.stepType).toBe('subtask');
    });

    it('should preserve actionId in context', () => {
      const context = { actionId: 'positioning:sit_down' };
      const error = new StepExecutionError('Step execution failed', context);
      expect(error.context.actionId).toBe('positioning:sit_down');
    });

    it('should preserve targetBindings in context', () => {
      const targetBindings = { actor: 'actor-123', target: 'chair-456' };
      const context = { targetBindings };
      const error = new StepExecutionError('Step execution failed', context);
      expect(error.context.targetBindings).toEqual(targetBindings);
    });

    it('should preserve reason in context', () => {
      const context = { reason: 'Precondition not satisfied' };
      const error = new StepExecutionError('Step execution failed', context);
      expect(error.context.reason).toBe('Precondition not satisfied');
    });

    it('should preserve methodId in context', () => {
      const context = { methodId: 'movement_method' };
      const error = new StepExecutionError('Step execution failed', context);
      expect(error.context.methodId).toBe('movement_method');
    });

    it('should preserve taskId in context', () => {
      const context = { taskId: 'move_to_location' };
      const error = new StepExecutionError('Step execution failed', context);
      expect(error.context.taskId).toBe('move_to_location');
    });

    it('should preserve actorId in context', () => {
      const context = { actorId: 'actor-npc-01' };
      const error = new StepExecutionError('Step execution failed', context);
      expect(error.context.actorId).toBe('actor-npc-01');
    });

    it('should preserve all context properties', () => {
      const context = {
        stepIndex: 3,
        stepType: 'action',
        actionId: 'test_action',
        targetBindings: { target: 'entity-1' },
        reason: 'Test failure',
        methodId: 'test_method',
        taskId: 'test_task',
        actorId: 'actor-test',
      };
      const error = new StepExecutionError('Step execution failed', context);
      expect(error.context).toEqual(context);
    });
  });

  describe('Severity and Recoverability', () => {
    it('should have error severity (inherited from GoapError)', () => {
      const error = new StepExecutionError('Step execution failed');
      expect(error.getSeverity()).toBe('error');
      expect(error.severity).toBe('error');
    });

    it('should be recoverable (inherited from GoapError)', () => {
      const error = new StepExecutionError('Step execution failed');
      expect(error.isRecoverable()).toBe(true);
      expect(error.recoverable).toBe(true);
    });
  });

  describe('Serialization', () => {
    it('should serialize to JSON with all fields', () => {
      const context = {
        stepIndex: 2,
        stepType: 'action',
        actionId: 'test_action',
        actorId: 'actor-123',
      };
      const error = new StepExecutionError('Step execution failed', context);
      const json = error.toJSON();

      expect(json).toHaveProperty('name', 'StepExecutionError');
      expect(json).toHaveProperty('message', 'Step execution failed');
      expect(json).toHaveProperty('code', 'GOAP_STEP_EXECUTION_ERROR');
      expect(json).toHaveProperty('context', context);
      expect(json).toHaveProperty('timestamp');
      expect(json).toHaveProperty('severity', 'error');
      expect(json).toHaveProperty('recoverable', true);
      expect(json).toHaveProperty('correlationId');
      expect(json).toHaveProperty('stack');
    });

    it('should be JSON-safe (no circular references)', () => {
      const context = { stepIndex: 1, stepType: 'action' };
      const error = new StepExecutionError('Step execution failed', context);
      expect(() => JSON.stringify(error.toJSON())).not.toThrow();
    });
  });

  describe('Stack Trace', () => {
    it('should capture stack trace', () => {
      const error = new StepExecutionError('Step execution failed');
      expect(error.stack).toBeDefined();
      expect(typeof error.stack).toBe('string');
      expect(error.stack).toContain('StepExecutionError');
    });
  });

  describe('Timestamp and Correlation', () => {
    it('should have ISO format timestamp', () => {
      const error = new StepExecutionError('Step execution failed');
      expect(error.timestamp).toBeDefined();
      expect(error.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
      );
    });

    it('should generate correlation ID automatically', () => {
      const error = new StepExecutionError('Step execution failed');
      expect(error.correlationId).toBeDefined();
      expect(typeof error.correlationId).toBe('string');
      expect(error.correlationId.length).toBeGreaterThan(0);
    });

    it('should use custom correlation ID if provided', () => {
      const correlationId = 'custom-id-101';
      const error = new StepExecutionError(
        'Step execution failed',
        {},
        { correlationId }
      );
      expect(error.correlationId).toBe(correlationId);
    });
  });

  describe('Real-World Usage Scenarios', () => {
    it('should handle action step execution failure', () => {
      const context = {
        stepIndex: 1,
        stepType: 'action',
        actionId: 'positioning:sit_down',
        targetBindings: { actor: 'actor-player', target: 'chair-123' },
        reason: 'Chair is occupied',
        methodId: 'sit_down_method',
        taskId: 'rest_in_chair',
        actorId: 'actor-player',
      };
      const error = new StepExecutionError(
        'Action step "sit_down" failed: Chair is occupied',
        context
      );

      expect(error.context.stepType).toBe('action');
      expect(error.context.actionId).toBe('positioning:sit_down');
      expect(error.context.reason).toBe('Chair is occupied');
      expect(error.recoverable).toBe(true);
    });

    it('should handle subtask step execution failure', () => {
      const context = {
        stepIndex: 3,
        stepType: 'subtask',
        targetBindings: { item: 'food-item-1' },
        reason: 'Subtask refinement failed',
        methodId: 'consume_food_method',
        taskId: 'reduce_hunger',
        actorId: 'actor-npc-01',
      };
      const error = new StepExecutionError(
        'Subtask step failed at index 3',
        context
      );

      expect(error.context.stepType).toBe('subtask');
      expect(error.context.stepIndex).toBe(3);
      expect(error.severity).toBe('error');
    });

    it('should handle condition step execution failure', () => {
      const context = {
        stepIndex: 0,
        stepType: 'condition',
        reason: 'Condition evaluation threw exception',
        methodId: 'check_resources_method',
        taskId: 'craft_item',
        actorId: 'actor-player',
      };
      const error = new StepExecutionError(
        'Condition check failed at step 0',
        context
      );

      expect(error.context.stepType).toBe('condition');
      expect(error.context.reason).toContain('exception');
    });

    it('should handle parameter binding failure', () => {
      const context = {
        stepIndex: 2,
        stepType: 'action',
        actionId: 'items:pickup_item',
        targetBindings: { actor: 'actor-123', item: null },
        reason: 'Failed to bind target parameter "item"',
        methodId: 'acquire_item_method',
        taskId: 'get_food',
        actorId: 'actor-123',
      };
      const error = new StepExecutionError(
        'Step execution failed due to parameter binding error',
        context
      );

      expect(error.context.targetBindings.item).toBeNull();
      expect(error.context.reason).toContain('bind target parameter');
    });

    it('should handle complex step execution failure', () => {
      const context = {
        stepIndex: 5,
        stepType: 'action',
        actionId: 'combat:attack_target',
        targetBindings: {
          actor: 'actor-warrior',
          target: 'enemy-goblin',
          weapon: 'sword-iron',
        },
        reason: 'Target out of range',
        methodId: 'melee_attack_method',
        taskId: 'defeat_enemy',
        actorId: 'actor-warrior',
      };
      const error = new StepExecutionError(
        'Attack action failed: Target out of range',
        context
      );

      expect(error.context.targetBindings.weapon).toBe('sword-iron');
      expect(error.context.actionId).toBe('combat:attack_target');
      expect(error.recoverable).toBe(true);
    });
  });
});
