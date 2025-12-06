/**
 * @file Tests for PlanningError class
 */

import { describe, it, expect } from '@jest/globals';
import PlanningError from '../../../../src/goap/errors/planningError.js';
import GoapError from '../../../../src/goap/errors/goapError.js';
import BaseError from '../../../../src/errors/baseError.js';

describe('PlanningError', () => {
  describe('Inheritance Chain', () => {
    it('should extend GoapError', () => {
      const error = new PlanningError('Planning failed');
      expect(error).toBeInstanceOf(GoapError);
    });

    it('should extend BaseError', () => {
      const error = new PlanningError('Planning failed');
      expect(error).toBeInstanceOf(BaseError);
    });

    it('should extend Error', () => {
      const error = new PlanningError('Planning failed');
      expect(error).toBeInstanceOf(Error);
    });

    it('should have correct name property', () => {
      const error = new PlanningError('Planning failed');
      expect(error.name).toBe('PlanningError');
    });
  });

  describe('Error Code', () => {
    it('should have GOAP_PLANNING_ERROR code', () => {
      const error = new PlanningError('Planning failed');
      expect(error.code).toBe('GOAP_PLANNING_ERROR');
    });
  });

  describe('Constructor', () => {
    it('should create error with message only', () => {
      const error = new PlanningError('Planning failed');
      expect(error.message).toBe('Planning failed');
    });

    it('should create error with message and context', () => {
      const context = {
        goalId: 'reduce_hunger',
        actorId: 'actor-123',
        worldState: { hunger: 80, hasFood: false },
        reason: 'No path to goal state',
      };
      const error = new PlanningError('Planning failed', context);
      expect(error.message).toBe('Planning failed');
      expect(error.context).toEqual(context);
    });

    it('should create error with correlation ID option', () => {
      const correlationId = 'custom-correlation-id';
      const error = new PlanningError('Planning failed', {}, { correlationId });
      expect(error.correlationId).toBe(correlationId);
    });
  });

  describe('Context Properties', () => {
    it('should preserve goalId in context', () => {
      const context = { goalId: 'reduce_hunger' };
      const error = new PlanningError('Planning failed', context);
      expect(error.context.goalId).toBe('reduce_hunger');
    });

    it('should preserve actorId in context', () => {
      const context = { actorId: 'actor-player' };
      const error = new PlanningError('Planning failed', context);
      expect(error.context.actorId).toBe('actor-player');
    });

    it('should preserve worldState in context', () => {
      const worldState = { hunger: 80, hasFood: false, inLocation: 'kitchen' };
      const context = { worldState };
      const error = new PlanningError('Planning failed', context);
      expect(error.context.worldState).toEqual(worldState);
    });

    it('should preserve reason in context', () => {
      const context = { reason: 'No applicable actions available' };
      const error = new PlanningError('Planning failed', context);
      expect(error.context.reason).toBe('No applicable actions available');
    });

    it('should preserve all context properties', () => {
      const context = {
        goalId: 'reduce_hunger',
        actorId: 'actor-123',
        worldState: { hunger: 80 },
        reason: 'No path to goal',
      };
      const error = new PlanningError('Planning failed', context);
      expect(error.context).toEqual(context);
    });
  });

  describe('Severity and Recoverability', () => {
    it('should have warning severity (overridden from GoapError)', () => {
      const error = new PlanningError('Planning failed');
      expect(error.getSeverity()).toBe('warning');
      expect(error.severity).toBe('warning');
    });

    it('should be recoverable (inherited from GoapError)', () => {
      const error = new PlanningError('Planning failed');
      expect(error.isRecoverable()).toBe(true);
      expect(error.recoverable).toBe(true);
    });
  });

  describe('Serialization', () => {
    it('should serialize to JSON with all fields', () => {
      const context = {
        goalId: 'reduce_hunger',
        actorId: 'actor-123',
        reason: 'No path to goal',
      };
      const error = new PlanningError('Planning failed', context);
      const json = error.toJSON();

      expect(json).toHaveProperty('name', 'PlanningError');
      expect(json).toHaveProperty('message', 'Planning failed');
      expect(json).toHaveProperty('code', 'GOAP_PLANNING_ERROR');
      expect(json).toHaveProperty('context', context);
      expect(json).toHaveProperty('timestamp');
      expect(json).toHaveProperty('severity', 'warning');
      expect(json).toHaveProperty('recoverable', true);
      expect(json).toHaveProperty('correlationId');
      expect(json).toHaveProperty('stack');
    });

    it('should be JSON-safe (no circular references)', () => {
      const context = { goalId: 'reduce_hunger', actorId: 'actor-123' };
      const error = new PlanningError('Planning failed', context);
      expect(() => JSON.stringify(error.toJSON())).not.toThrow();
    });
  });

  describe('Stack Trace', () => {
    it('should capture stack trace', () => {
      const error = new PlanningError('Planning failed');
      expect(error.stack).toBeDefined();
      expect(typeof error.stack).toBe('string');
      expect(error.stack).toContain('PlanningError');
    });
  });

  describe('Timestamp and Correlation', () => {
    it('should have ISO format timestamp', () => {
      const error = new PlanningError('Planning failed');
      expect(error.timestamp).toBeDefined();
      expect(error.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
      );
    });

    it('should generate correlation ID automatically', () => {
      const error = new PlanningError('Planning failed');
      expect(error.correlationId).toBeDefined();
      expect(typeof error.correlationId).toBe('string');
      expect(error.correlationId.length).toBeGreaterThan(0);
    });

    it('should use custom correlation ID if provided', () => {
      const correlationId = 'custom-id-456';
      const error = new PlanningError('Planning failed', {}, { correlationId });
      expect(error.correlationId).toBe(correlationId);
    });
  });

  describe('Real-World Usage Scenarios', () => {
    it('should handle no path to goal scenario', () => {
      const context = {
        goalId: 'reduce_hunger',
        actorId: 'actor-player',
        worldState: { hunger: 90, hasFood: false, inKitchen: false },
        reason: 'No path from current state to goal state',
      };
      const error = new PlanningError(
        'Cannot plan for goal "reduce_hunger": No path to goal state',
        context
      );

      expect(error.message).toContain('reduce_hunger');
      expect(error.context.goalId).toBe('reduce_hunger');
      expect(error.context.reason).toContain('No path from current state');
      expect(error.severity).toBe('warning');
    });

    it('should handle no applicable actions scenario', () => {
      const context = {
        goalId: 'open_locked_door',
        actorId: 'actor-npc-01',
        worldState: { hasKey: false, doorLocked: true },
        reason: 'No applicable actions available',
      };
      const error = new PlanningError(
        'Failed to plan for goal "open_locked_door": No applicable actions',
        context
      );

      expect(error.context.worldState.hasKey).toBe(false);
      expect(error.context.reason).toBe('No applicable actions available');
      expect(error.recoverable).toBe(true);
    });

    it('should handle resource constraints scenario', () => {
      const context = {
        goalId: 'craft_item',
        actorId: 'actor-player',
        worldState: { materials: 0, toolAvailable: false },
        reason: 'Insufficient resources to achieve goal',
      };
      const error = new PlanningError(
        'Cannot plan for "craft_item": Insufficient resources',
        context
      );

      expect(error.context.reason).toBe(
        'Insufficient resources to achieve goal'
      );
      expect(error.code).toBe('GOAP_PLANNING_ERROR');
    });

    it('should handle goal state already satisfied', () => {
      const context = {
        goalId: 'be_in_kitchen',
        actorId: 'actor-player',
        worldState: { inKitchen: true },
        reason: 'Goal state already satisfied',
      };
      const error = new PlanningError(
        'Planning unnecessary for "be_in_kitchen": Already satisfied',
        context
      );

      expect(error.context.worldState.inKitchen).toBe(true);
      expect(error.severity).toBe('warning');
    });

    it('should handle complex world state', () => {
      const context = {
        goalId: 'complete_quest',
        actorId: 'actor-player',
        worldState: {
          questAccepted: true,
          itemsCollected: 2,
          requiredItems: 5,
          bossDefeated: false,
          hasWeapon: true,
        },
        reason: 'Missing quest items and boss not defeated',
      };
      const error = new PlanningError(
        'Cannot complete quest: Missing preconditions',
        context
      );

      expect(error.context.worldState.itemsCollected).toBe(2);
      expect(error.context.worldState.requiredItems).toBe(5);
      expect(error.recoverable).toBe(true);
    });
  });
});
