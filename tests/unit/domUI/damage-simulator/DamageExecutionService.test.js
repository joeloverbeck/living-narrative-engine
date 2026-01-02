/**
 * @file DamageExecutionService.test.js
 * @description Unit tests for DamageExecutionService
 */

import DamageExecutionService from '../../../../src/domUI/damage-simulator/DamageExecutionService.js';
import { jest } from '@jest/globals';

describe('DamageExecutionService', () => {
  let mockLogger;
  let mockOperationInterpreter;
  let mockEntityManager;
  let mockEventBus;
  let damageExecutionService;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockOperationInterpreter = {
      execute: jest.fn().mockResolvedValue(undefined),
    };

    mockEntityManager = {
      getEntityInstance: jest.fn(),
      getComponentData: jest.fn(),
    };

    mockEventBus = {
      dispatch: jest.fn(),
      subscribe: jest.fn().mockReturnValue(() => {}),
    };

    damageExecutionService = new DamageExecutionService({
      operationInterpreter: mockOperationInterpreter,
      entityManager: mockEntityManager,
      eventBus: mockEventBus,
      logger: mockLogger,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should validate required dependencies in constructor', () => {
      expect(
        () =>
          new DamageExecutionService({
            entityManager: mockEntityManager,
            eventBus: mockEventBus,
            logger: mockLogger,
          })
      ).toThrow();
    });

    it('should throw if entityManager is missing', () => {
      expect(
        () =>
          new DamageExecutionService({
            operationInterpreter: mockOperationInterpreter,
            eventBus: mockEventBus,
            logger: mockLogger,
          })
      ).toThrow();
    });

    it('should throw if eventBus is missing', () => {
      expect(
        () =>
          new DamageExecutionService({
            operationInterpreter: mockOperationInterpreter,
            entityManager: mockEntityManager,
            logger: mockLogger,
          })
      ).toThrow();
    });

    it('should throw if logger is missing', () => {
      expect(
        () =>
          new DamageExecutionService({
            operationInterpreter: mockOperationInterpreter,
            entityManager: mockEntityManager,
            eventBus: mockEventBus,
          })
      ).toThrow();
    });

    it('should create service with all valid dependencies', () => {
      expect(damageExecutionService).toBeInstanceOf(DamageExecutionService);
    });
  });

  describe('applyDamage', () => {
    const entityId = 'entity-123';
    const damageEntry = {
      baseAmount: 10,
      damageType: 'slashing',
    };

    it('should construct valid operation parameters', async () => {
      await damageExecutionService.applyDamage({
        entityId,
        damageEntry,
      });

      expect(mockOperationInterpreter.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'APPLY_DAMAGE',
          parameters: expect.objectContaining({
            entity_ref: entityId,
            damage_entry: damageEntry,
            damage_multiplier: 1,
          }),
        }),
        expect.any(Object)
      );
    });

    it('should include entity_ref from current entity', async () => {
      await damageExecutionService.applyDamage({
        entityId: 'my-entity-id',
        damageEntry,
      });

      expect(mockOperationInterpreter.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          parameters: expect.objectContaining({
            entity_ref: 'my-entity-id',
          }),
        }),
        expect.any(Object)
      );
    });

    it('should include damage_entry from composer', async () => {
      const customDamageEntry = {
        baseAmount: 25,
        damageType: 'piercing',
        effects: ['bleed'],
      };

      await damageExecutionService.applyDamage({
        entityId,
        damageEntry: customDamageEntry,
      });

      expect(mockOperationInterpreter.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          parameters: expect.objectContaining({
            damage_entry: customDamageEntry,
          }),
        }),
        expect.any(Object)
      );
    });

    it('should include damage_multiplier when specified', async () => {
      await damageExecutionService.applyDamage({
        entityId,
        damageEntry,
        multiplier: 2.5,
      });

      expect(mockOperationInterpreter.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          parameters: expect.objectContaining({
            damage_multiplier: 2.5,
          }),
        }),
        expect.any(Object)
      );
    });

    it('should omit part_ref for random targeting (null)', async () => {
      await damageExecutionService.applyDamage({
        entityId,
        damageEntry,
        targetPartId: null,
      });

      const operationArg = mockOperationInterpreter.execute.mock.calls[0][0];
      expect(operationArg.parameters).not.toHaveProperty('part_ref');
    });

    it('should omit part_ref for random targeting (undefined)', async () => {
      await damageExecutionService.applyDamage({
        entityId,
        damageEntry,
      });

      const operationArg = mockOperationInterpreter.execute.mock.calls[0][0];
      expect(operationArg.parameters).not.toHaveProperty('part_ref');
    });

    it('should include part_ref for specific targeting', async () => {
      await damageExecutionService.applyDamage({
        entityId,
        damageEntry,
        targetPartId: 'part-head-123',
      });

      expect(mockOperationInterpreter.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          parameters: expect.objectContaining({
            part_ref: 'part-head-123',
          }),
        }),
        expect.any(Object)
      );
    });

    it('should execute via operationInterpreter', async () => {
      await damageExecutionService.applyDamage({
        entityId,
        damageEntry,
      });

      expect(mockOperationInterpreter.execute).toHaveBeenCalledTimes(1);
    });

    it('should subscribe to damage_applied events before execution', async () => {
      await damageExecutionService.applyDamage({
        entityId,
        damageEntry,
      });

      expect(mockEventBus.subscribe).toHaveBeenCalledWith(
        DamageExecutionService.DAMAGE_APPLIED_EVENT,
        expect.any(Function)
      );
    });

    it('should capture damage_applied events as results', async () => {
      let eventHandler;
      mockEventBus.subscribe.mockImplementation((eventType, handler) => {
        eventHandler = handler;
        return () => {};
      });

      mockOperationInterpreter.execute.mockImplementation(() => {
        // Simulate damage event being emitted during execution
        eventHandler({
          payload: {
            partId: 'head-123',
            partType: 'head',
            amount: 10,
            damageType: 'slashing',
            severity: 'moderate',
          },
        });
        return Promise.resolve();
      });

      const result = await damageExecutionService.applyDamage({
        entityId,
        damageEntry,
      });

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(1);
      expect(result.results[0]).toEqual({
        success: true,
        targetPartId: 'head-123',
        targetPartName: 'head',
        damageDealt: 10,
        damageType: 'slashing',
        severity: 'moderate',
        error: null,
      });
    });

    it('should fallback to partId when partType is missing in damage event', async () => {
      // Test the FALSE branch of: payload.partType || payload.partId
      let eventHandler;
      mockEventBus.subscribe.mockImplementation((eventType, handler) => {
        eventHandler = handler;
        return () => {};
      });

      mockOperationInterpreter.execute.mockImplementation(() => {
        eventHandler({
          payload: {
            partId: 'arm-456',
            // partType is missing/undefined
            amount: 15,
            damageType: 'bludgeoning',
            severity: 'minor',
          },
        });
        return Promise.resolve();
      });

      const result = await damageExecutionService.applyDamage({
        entityId,
        damageEntry,
      });

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].targetPartName).toBe('arm-456');
    });

    it('should emit execution started event', async () => {
      await damageExecutionService.applyDamage({
        entityId,
        damageEntry,
        multiplier: 1.5,
        targetPartId: 'arm-123',
      });

      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        DamageExecutionService.EXECUTION_EVENTS.EXECUTION_STARTED,
        {
          entityId,
          damageEntry,
          multiplier: 1.5,
          targetPartId: 'arm-123',
        }
      );
    });

    it('should emit execution complete event on success', async () => {
      await damageExecutionService.applyDamage({
        entityId,
        damageEntry,
      });

      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        DamageExecutionService.EXECUTION_EVENTS.EXECUTION_COMPLETE,
        {
          entityId,
          results: [],
        }
      );
    });

    it('should handle handler errors gracefully', async () => {
      mockOperationInterpreter.execute.mockRejectedValue(
        new Error('Handler error')
      );

      const result = await damageExecutionService.applyDamage({
        entityId,
        damageEntry,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Handler error');
    });

    it('should emit execution error event on failure', async () => {
      mockOperationInterpreter.execute.mockRejectedValue(
        new Error('Handler error')
      );

      await damageExecutionService.applyDamage({
        entityId,
        damageEntry,
      });

      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        DamageExecutionService.EXECUTION_EVENTS.EXECUTION_ERROR,
        {
          entityId,
          error: 'Handler error',
        }
      );
    });

    it('should return damage results array', async () => {
      const result = await damageExecutionService.applyDamage({
        entityId,
        damageEntry,
      });

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('results');
      expect(result).toHaveProperty('error');
      expect(Array.isArray(result.results)).toBe(true);
    });

    it('should unsubscribe from events after execution completes', async () => {
      const unsubscribeMock = jest.fn();
      mockEventBus.subscribe.mockReturnValue(unsubscribeMock);

      await damageExecutionService.applyDamage({
        entityId,
        damageEntry,
      });

      expect(unsubscribeMock).toHaveBeenCalledTimes(1);
    });

    it('should unsubscribe from events even on error', async () => {
      const unsubscribeMock = jest.fn();
      mockEventBus.subscribe.mockReturnValue(unsubscribeMock);
      mockOperationInterpreter.execute.mockRejectedValue(new Error('fail'));

      await damageExecutionService.applyDamage({
        entityId,
        damageEntry,
      });

      expect(unsubscribeMock).toHaveBeenCalledTimes(1);
    });

    it('should handle non-function unsubscribe return value gracefully', async () => {
      // Test the FALSE branch of: if (typeof unsubscribe === 'function')
      mockEventBus.subscribe.mockReturnValue(null);

      const result = await damageExecutionService.applyDamage({
        entityId,
        damageEntry,
      });

      // Should still complete successfully without calling unsubscribe
      expect(result.success).toBe(true);
    });

    it('should handle sync operation interpreter results', async () => {
      mockOperationInterpreter.execute.mockReturnValue(undefined);

      const result = await damageExecutionService.applyDamage({
        entityId,
        damageEntry,
      });

      expect(result.success).toBe(true);
    });

    it('should include suppressPerceptibleEvents in execution context', async () => {
      await damageExecutionService.applyDamage({
        entityId,
        damageEntry,
      });

      // Verify the execution context passed to operationInterpreter.execute
      const executionContext = mockOperationInterpreter.execute.mock.calls[0][1];
      expect(executionContext).toHaveProperty(
        'suppressPerceptibleEvents',
        true
      );
    });

    it('should prevent perceptible event dispatch errors with suppressPerceptibleEvents', async () => {
      // This test documents the fix for the damage simulator error:
      // "APPLY_DAMAGE: Cannot dispatch perceptible event - no location found"
      // By setting suppressPerceptibleEvents: true, the damage resolution service
      // skips the perceptible event dispatch entirely.
      await damageExecutionService.applyDamage({
        entityId,
        damageEntry,
      });

      const executionContext = mockOperationInterpreter.execute.mock.calls[0][1];

      // The suppressPerceptibleEvents flag should be true
      expect(executionContext.suppressPerceptibleEvents).toBe(true);

      // The actor should be null (simulator context has no actor)
      expect(executionContext.evaluationContext.actor).toBeNull();

      // Despite null actor, no error should be logged because suppressPerceptibleEvents
      // prevents the code path that would check for actor/target location
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should build entity context with components when entity has getComponentIds', async () => {
      const mockEntity = {
        id: 'entity-123',
        getComponentIds: jest.fn().mockReturnValue(['comp:a', 'comp:b']),
      };

      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      mockEntityManager.getComponentData.mockImplementation((entId, compId) => {
        if (compId === 'comp:a') return { value: 'a' };
        if (compId === 'comp:b') return { value: 'b' };
        return null;
      });

      await damageExecutionService.applyDamage({
        entityId: 'entity-123',
        damageEntry,
      });

      const executionContext = mockOperationInterpreter.execute.mock.calls[0][1];
      expect(executionContext.evaluationContext.target).toEqual({
        id: 'entity-123',
        components: {
          'comp:a': { value: 'a' },
          'comp:b': { value: 'b' },
        },
      });
    });

    it('should build entity context with empty components when entity lacks getComponentIds', async () => {
      const mockEntity = {
        id: 'entity-456',
        // No getComponentIds method - tests the FALSE branch of the ternary
      };

      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

      await damageExecutionService.applyDamage({
        entityId: 'entity-456',
        damageEntry,
      });

      const executionContext = mockOperationInterpreter.execute.mock.calls[0][1];
      expect(executionContext.evaluationContext.target).toEqual({
        id: 'entity-456',
        components: {},
      });
    });

    it('should handle entity with empty component list', async () => {
      const mockEntity = {
        id: 'entity-789',
        getComponentIds: jest.fn().mockReturnValue([]),
      };

      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

      await damageExecutionService.applyDamage({
        entityId: 'entity-789',
        damageEntry,
      });

      const executionContext = mockOperationInterpreter.execute.mock.calls[0][1];
      expect(executionContext.evaluationContext.target).toEqual({
        id: 'entity-789',
        components: {},
      });
    });
  });

  describe('getTargetableParts', () => {
    it('should return array of parts with id, name, weight', () => {
      const mockEntity = {
        id: 'entity-123',
        getComponentIds: jest.fn().mockReturnValue([]),
      };

      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === DamageExecutionService.COMPONENT_IDS.BODY) {
            return { parts: ['part-head', 'part-arm'] };
          }
          if (componentId === DamageExecutionService.COMPONENT_IDS.PART) {
            return { subType: 'head', targetWeight: 2 };
          }
          if (componentId === DamageExecutionService.COMPONENT_IDS.NAME) {
            return { name: 'Head' };
          }
          return null;
        }
      );

      const parts = damageExecutionService.getTargetableParts('entity-123');

      expect(Array.isArray(parts)).toBe(true);
      expect(parts.length).toBeGreaterThan(0);
      expect(parts[0]).toHaveProperty('id');
      expect(parts[0]).toHaveProperty('name');
      expect(parts[0]).toHaveProperty('weight');
    });

    it('should return empty array if entity not found', () => {
      mockEntityManager.getEntityInstance.mockReturnValue(null);

      const parts = damageExecutionService.getTargetableParts('nonexistent');

      expect(parts).toEqual([]);
    });

    it('should return empty array if entity has no body component', () => {
      mockEntityManager.getEntityInstance.mockReturnValue({ id: 'entity-123' });
      mockEntityManager.getComponentData.mockReturnValue(null);

      const parts = damageExecutionService.getTargetableParts('entity-123');

      expect(parts).toEqual([]);
    });

    it('should return empty array if body has no parts', () => {
      mockEntityManager.getEntityInstance.mockReturnValue({ id: 'entity-123' });
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === DamageExecutionService.COMPONENT_IDS.BODY) {
            return { parts: [] };
          }
          return null;
        }
      );

      const parts = damageExecutionService.getTargetableParts('entity-123');

      expect(parts).toEqual([]);
    });

    it('should use subType as name if no name component', () => {
      mockEntityManager.getEntityInstance.mockReturnValue({ id: 'entity-123' });
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === DamageExecutionService.COMPONENT_IDS.BODY) {
            return { parts: ['part-head'] };
          }
          if (componentId === DamageExecutionService.COMPONENT_IDS.PART) {
            return { subType: 'head', targetWeight: 2 };
          }
          return null;
        }
      );

      const parts = damageExecutionService.getTargetableParts('entity-123');

      expect(parts[0].name).toBe('head');
    });

    it('should default weight to 1 if not specified', () => {
      mockEntityManager.getEntityInstance.mockReturnValue({ id: 'entity-123' });
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === DamageExecutionService.COMPONENT_IDS.BODY) {
            return { parts: ['part-head'] };
          }
          if (componentId === DamageExecutionService.COMPONENT_IDS.PART) {
            return { subType: 'head' };
          }
          return null;
        }
      );

      const parts = damageExecutionService.getTargetableParts('entity-123');

      expect(parts[0].weight).toBe(1);
    });

    it('should skip parts with no part data', () => {
      // Test the FALSE branch of: if (partData)
      mockEntityManager.getEntityInstance.mockReturnValue({ id: 'entity-123' });
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === DamageExecutionService.COMPONENT_IDS.BODY) {
            return { parts: ['part-head', 'part-missing', 'part-arm'] };
          }
          // Return null for part-missing to test the falsy branch
          if (entityId === 'part-missing') {
            return null;
          }
          if (componentId === DamageExecutionService.COMPONENT_IDS.PART) {
            return { subType: 'head', targetWeight: 2 };
          }
          if (componentId === DamageExecutionService.COMPONENT_IDS.NAME) {
            return { name: 'Head' };
          }
          return null;
        }
      );

      const parts = damageExecutionService.getTargetableParts('entity-123');

      // Should only have 2 parts (part-head and part-arm), not part-missing
      expect(parts.length).toBe(2);
      expect(parts.map((p) => p.id)).toEqual(['part-head', 'part-arm']);
    });

    it('should fallback to partId when name and subType are missing', () => {
      mockEntityManager.getEntityInstance.mockReturnValue({ id: 'entity-123' });
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === DamageExecutionService.COMPONENT_IDS.BODY) {
            return { parts: ['part-xyz'] };
          }
          if (componentId === DamageExecutionService.COMPONENT_IDS.PART) {
            // No subType property
            return { targetWeight: 1 };
          }
          // No name component
          return null;
        }
      );

      const parts = damageExecutionService.getTargetableParts('entity-123');

      expect(parts[0].name).toBe('part-xyz');
    });
  });

  describe('Static constants', () => {
    it('should expose EXECUTION_EVENTS', () => {
      expect(DamageExecutionService.EXECUTION_EVENTS).toBeDefined();
      expect(
        DamageExecutionService.EXECUTION_EVENTS.EXECUTION_STARTED
      ).toBeDefined();
      expect(
        DamageExecutionService.EXECUTION_EVENTS.EXECUTION_COMPLETE
      ).toBeDefined();
      expect(
        DamageExecutionService.EXECUTION_EVENTS.EXECUTION_ERROR
      ).toBeDefined();
    });

    it('should expose DAMAGE_APPLIED_EVENT', () => {
      expect(DamageExecutionService.DAMAGE_APPLIED_EVENT).toBe(
        'anatomy:damage_applied'
      );
    });

    it('should expose COMPONENT_IDS', () => {
      expect(DamageExecutionService.COMPONENT_IDS).toBeDefined();
      expect(DamageExecutionService.COMPONENT_IDS.PART).toBeDefined();
      expect(DamageExecutionService.COMPONENT_IDS.BODY).toBeDefined();
    });
  });
});
