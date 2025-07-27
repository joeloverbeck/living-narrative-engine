/**
 * @file Tests for MultiTargetEventBuilder class
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import MultiTargetEventBuilder from '../../../../src/entities/multiTarget/multiTargetEventBuilder.js';
import TargetManager from '../../../../src/entities/multiTarget/targetManager.js';
import TargetExtractionResult from '../../../../src/entities/multiTarget/targetExtractionResult.js';

describe('MultiTargetEventBuilder', () => {
  let testBed;
  let logger;
  let builder;

  beforeEach(() => {
    testBed = createTestBed();
    logger = testBed.mockLogger;
    builder = new MultiTargetEventBuilder({ logger });
  });

  describe('Construction and Reset', () => {
    it('should create builder with logger', () => {
      expect(builder).toBeInstanceOf(MultiTargetEventBuilder);
    });

    it('should reset to initial state', () => {
      builder.setActor('actor_123');
      builder.reset();

      const state = builder.getState();
      expect(state.eventData.actorId).toBe(undefined);
      expect(state.eventData.eventName).toBe('core:attempt_action');
      expect(state.eventData.timestamp).toBeGreaterThan(0);
    });

    it('should have default event name and timestamp', () => {
      const state = builder.getState();

      expect(state.eventData.eventName).toBe('core:attempt_action');
      expect(state.eventData.timestamp).toBeGreaterThan(0);
    });
  });

  describe('Fluent API', () => {
    it('should support method chaining', () => {
      const result = builder
        .setActor('actor_123')
        .setAction('core:attack')
        .setOriginalInput('attack goblin')
        .setLegacyTarget('goblin_456');

      expect(result).toBe(builder);
    });

    it('should build basic event payload', () => {
      const payload = builder
        .setActor('actor_123')
        .setAction('core:attack')
        .setOriginalInput('attack goblin')
        .setLegacyTarget('goblin_456')
        .build();

      expect(payload).toMatchObject({
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'core:attack',
        originalInput: 'attack goblin',
        targetId: 'goblin_456',
        timestamp: expect.any(Number),
      });
    });
  });

  describe('Setting Required Fields', () => {
    it('should set actor ID', () => {
      builder.setActor('actor_123');

      const state = builder.getState();
      expect(state.eventData.actorId).toBe('actor_123');
    });

    it('should set action ID', () => {
      builder.setAction('core:attack');

      const state = builder.getState();
      expect(state.eventData.actionId).toBe('core:attack');
    });

    it('should set original input', () => {
      builder.setOriginalInput('attack goblin with sword');

      const state = builder.getState();
      expect(state.eventData.originalInput).toBe('attack goblin with sword');
    });

    it('should throw error for empty actor ID', () => {
      expect(() => {
        builder.setActor('');
      }).toThrow();
    });

    it('should throw error for empty action ID', () => {
      expect(() => {
        builder.setAction('');
      }).toThrow();
    });

    it('should throw error for empty original input', () => {
      expect(() => {
        builder.setOriginalInput('');
      }).toThrow();
    });
  });

  describe('Target Setting', () => {
    let targetManager;
    let extractionResult;

    beforeEach(() => {
      targetManager = new TargetManager({
        targets: { item: 'sword_123', target: 'goblin_456' },
        logger,
      });
      extractionResult = new TargetExtractionResult({ targetManager });
    });

    describe('setTargetsFromExtraction', () => {
      it('should set targets from extraction result', () => {
        builder.setTargetsFromExtraction(extractionResult);

        const state = builder.getState();
        expect(state.eventData.targets).toEqual({
          item: 'sword_123',
          target: 'goblin_456',
        });
        expect(state.eventData.targetId).toBe('goblin_456');
      });

      it('should handle single target extraction', () => {
        const singleTargetManager = new TargetManager({
          targets: { item: 'sword_123' },
          logger,
        });
        const singleExtraction = new TargetExtractionResult({ targetManager: singleTargetManager });

        builder.setTargetsFromExtraction(singleExtraction);

        const state = builder.getState();
        expect(state.eventData.targets).toBe(undefined);
        expect(state.eventData.targetId).toBe('sword_123');
      });

      it('should throw error for invalid extraction result', () => {
        expect(() => {
          builder.setTargetsFromExtraction({});
        }).toThrow('extractionResult must be a TargetExtractionResult instance');
      });

      it('should throw error for missing extraction result', () => {
        expect(() => {
          builder.setTargetsFromExtraction(null);
        }).toThrow();
      });
    });

    describe('setTargets', () => {
      it('should set multiple targets', () => {
        const targets = { item: 'sword_123', target: 'goblin_456' };

        builder.setTargets(targets);

        const state = builder.getState();
        expect(state.eventData.targets).toEqual(targets);
        expect(state.eventData.targetId).toBe('goblin_456'); // 'target' has priority
      });

      it('should set single target without targets object', () => {
        const targets = { item: 'sword_123' };

        builder.setTargets(targets);

        const state = builder.getState();
        expect(state.eventData.targets).toBe(undefined);
        expect(state.eventData.targetId).toBe('sword_123');
      });

      it('should use explicit primary target', () => {
        const targets = { item: 'sword_123', target: 'goblin_456' };

        builder.setTargets(targets, 'sword_123');

        const state = builder.getState();
        expect(state.eventData.targetId).toBe('sword_123');
      });

      it('should prioritize primary target name', () => {
        const targets = { item: 'sword_123', primary: 'staff_789', target: 'goblin_456' };

        builder.setTargets(targets);

        const state = builder.getState();
        expect(state.eventData.targetId).toBe('staff_789');
      });

      it('should throw error for invalid targets object', () => {
        expect(() => {
          builder.setTargets(['invalid']);
        }).toThrow('Targets must be an object');
      });

      it('should throw error for missing targets', () => {
        expect(() => {
          builder.setTargets(null);
        }).toThrow();
      });
    });

    describe('setLegacyTarget', () => {
      it('should set legacy target', () => {
        builder.setLegacyTarget('goblin_123');

        const state = builder.getState();
        expect(state.eventData.targetId).toBe('goblin_123');
        expect(state.eventData.targets).toBe(undefined);
      });

      it('should handle null legacy target', () => {
        builder.setLegacyTarget(null);

        const state = builder.getState();
        expect(state.eventData.targetId).toBe(null);
      });

      it('should remove targets object', () => {
        builder.setTargets({ item: 'sword_123', target: 'goblin_456' });
        builder.setLegacyTarget('goblin_123');

        const state = builder.getState();
        expect(state.eventData.targets).toBe(undefined);
        expect(state.eventData.targetId).toBe('goblin_123');
      });

      it('should throw error for empty string legacy target', () => {
        expect(() => {
          builder.setLegacyTarget('');
        }).toThrow();
      });
    });
  });

  describe('Timestamp Management', () => {
    it('should set custom timestamp', () => {
      const customTime = 1234567890;

      builder.setTimestamp(customTime);

      const state = builder.getState();
      expect(state.eventData.timestamp).toBe(customTime);
    });

    it('should use current time as default', () => {
      const beforeTime = Date.now();
      builder.setTimestamp();
      const afterTime = Date.now();

      const state = builder.getState();
      expect(state.eventData.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(state.eventData.timestamp).toBeLessThanOrEqual(afterTime);
    });

    it('should throw error for invalid timestamp', () => {
      expect(() => {
        builder.setTimestamp(-1);
      }).toThrow('Timestamp must be a non-negative number');
    });

    it('should throw error for non-number timestamp', () => {
      expect(() => {
        builder.setTimestamp('invalid');
      }).toThrow('Timestamp must be a non-negative number');
    });
  });

  describe('Building and Validation', () => {
    beforeEach(() => {
      builder
        .setActor('actor_123')
        .setAction('core:attack')
        .setOriginalInput('attack goblin');
    });

    it('should build valid payload with target', () => {
      builder.setLegacyTarget('goblin_456');

      const payload = builder.build();

      expect(payload).toMatchObject({
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'core:attack',
        originalInput: 'attack goblin',
        targetId: 'goblin_456',
        timestamp: expect.any(Number),
      });
    });

    it('should build valid payload with multiple targets', () => {
      builder.setTargets({ item: 'sword_123', target: 'goblin_456' });

      const payload = builder.build();

      expect(payload.targets).toEqual({ item: 'sword_123', target: 'goblin_456' });
      expect(payload.targetId).toBe('goblin_456');
    });

    it('should throw error for missing required fields', () => {
      const incompleteBuilder = new MultiTargetEventBuilder({ logger });

      expect(() => {
        incompleteBuilder.build();
      }).toThrow('Missing required fields: actorId, actionId, originalInput');
    });

    it('should throw error for missing targets', () => {
      expect(() => {
        builder.build();
      }).toThrow('Event must have either targets object or targetId field');
    });

    it('should build unsafe payload without validation', () => {
      const payload = builder.buildUnsafe();

      expect(payload.actorId).toBe('actor_123');
      expect(payload.targetId).toBe(undefined);
    });

    it('should build payload without warnings for valid data', () => {
      const payload = builder
        .setActor('actor_123')
        .setAction('core:attack')
        .setOriginalInput('attack goblin')
        .setLegacyTarget('goblin_456')
        .build();

      expect(payload).toMatchObject({
        actorId: 'actor_123',
        actionId: 'core:attack',
        targetId: 'goblin_456',
      });
      
      // Should not have called warn for valid payload
      expect(logger.warn).not.toHaveBeenCalled();
    });
  });

  describe('State Inspection', () => {
    it('should provide current state', () => {
      builder
        .setActor('actor_123')
        .setAction('core:attack')
        .setOriginalInput('attack goblin')
        .setLegacyTarget('goblin_456');

      const state = builder.getState();

      expect(state).toEqual({
        eventData: {
          eventName: 'core:attempt_action',
          actorId: 'actor_123',
          actionId: 'core:attack',
          originalInput: 'attack goblin',
          targetId: 'goblin_456',
          timestamp: expect.any(Number),
        },
        hasRequiredFields: true,
        hasTargets: true,
      });
    });

    it('should show incomplete state', () => {
      builder.setActor('actor_123');

      const state = builder.getState();

      expect(state.hasRequiredFields).toBe(false);
      expect(state.hasTargets).toBe(false);
    });
  });

  describe('Static Factory Methods', () => {
    describe('fromPayload', () => {
      it('should create builder from existing payload', () => {
        const existingPayload = {
          eventName: 'core:attempt_action',
          actorId: 'actor_123',
          actionId: 'core:attack',
          originalInput: 'attack goblin',
          targetId: 'goblin_456',
          timestamp: 1234567890,
        };

        const newBuilder = MultiTargetEventBuilder.fromPayload(existingPayload, logger);
        const state = newBuilder.getState();

        expect(state.eventData).toEqual(existingPayload);
      });

      it('should throw error for missing payload', () => {
        expect(() => {
          MultiTargetEventBuilder.fromPayload(null, logger);
        }).toThrow();
      });
    });

    describe('fromTurnAction', () => {
      it('should create builder from turn action data', () => {
        const actor = { id: 'actor_123' };
        const turnAction = {
          actionDefinitionId: 'core:attack',
          commandString: 'attack goblin with sword',
        };
        const targetManager = new TargetManager({
          targets: { target: 'goblin_456' },
          logger,
        });
        const extractionResult = new TargetExtractionResult({ targetManager });

        const newBuilder = MultiTargetEventBuilder.fromTurnAction(
          actor,
          turnAction,
          extractionResult,
          logger
        );

        const payload = newBuilder.build();

        expect(payload).toMatchObject({
          actorId: 'actor_123',
          actionId: 'core:attack',
          originalInput: 'attack goblin with sword',
          targetId: 'goblin_456',
        });
      });

      it('should use action ID as fallback for originalInput', () => {
        const actor = { id: 'actor_123' };
        const turnAction = {
          actionDefinitionId: 'core:attack',
          // No commandString
        };
        const targetManager = new TargetManager({
          targets: { target: 'goblin_456' },
          logger,
        });
        const extractionResult = new TargetExtractionResult({ targetManager });

        const newBuilder = MultiTargetEventBuilder.fromTurnAction(
          actor,
          turnAction,
          extractionResult,
          logger
        );

        const state = newBuilder.getState();
        expect(state.eventData.originalInput).toBe('core:attack');
      });

      it('should throw error for missing parameters', () => {
        expect(() => {
          MultiTargetEventBuilder.fromTurnAction(null, {}, {}, logger);
        }).toThrow();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle logger validation gracefully', () => {
      // ensureValidLogger returns a fallback logger, doesn't throw
      const builder = new MultiTargetEventBuilder({ logger: null });
      expect(builder).toBeInstanceOf(MultiTargetEventBuilder);
    });

    it('should validate payload and throw detailed errors', () => {
      const incompleteBuilder = new MultiTargetEventBuilder({ logger });
      incompleteBuilder.setActor('actor_123');
      // Missing actionId and originalInput

      expect(() => {
        incompleteBuilder.build();
      }).toThrow('Missing required fields: actionId, originalInput');
    });
  });

  describe('Integration with Validation', () => {
    it('should pass validation for complete multi-target payload', () => {
      const payload = builder
        .setActor('actor_123')
        .setAction('core:attack')
        .setOriginalInput('attack goblin with sword')
        .setTargets({ item: 'sword_123', target: 'goblin_456' })
        .build();

      expect(payload.actorId).toBe('actor_123');
      expect(payload.actionId).toBe('core:attack');
      expect(payload.originalInput).toBe('attack goblin with sword');
      expect(payload.targets).toEqual({ item: 'sword_123', target: 'goblin_456' });
      expect(payload.targetId).toBe('goblin_456');
    });

    it('should pass validation for legacy single-target payload', () => {
      const payload = builder
        .setActor('actor_123')
        .setAction('core:attack')
        .setOriginalInput('attack goblin')
        .setLegacyTarget('goblin_456')
        .build();

      expect(payload.targets).toBe(undefined);
      expect(payload.targetId).toBe('goblin_456');
    });
  });
});