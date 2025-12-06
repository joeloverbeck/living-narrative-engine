/**
 * @file Unit tests for GetDamageCapabilitiesHandler operation handler
 * @see src/logic/operationHandlers/getDamageCapabilitiesHandler.js
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import GetDamageCapabilitiesHandler from '../../../../src/logic/operationHandlers/getDamageCapabilitiesHandler.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../../src/constants/eventIds.js';

describe('GetDamageCapabilitiesHandler', () => {
  let handler;
  let mockEntityManager;
  let mockLogger;
  let mockSafeEventDispatcher;
  let mockJsonLogicService;
  let executionContext;

  beforeEach(() => {
    mockEntityManager = {
      getComponentData: jest.fn(),
    };

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockSafeEventDispatcher = {
      dispatch: jest.fn(),
    };

    mockJsonLogicService = {
      evaluate: jest.fn(),
    };

    executionContext = {
      evaluationContext: {
        context: {},
        actor: { id: 'actor-123' },
        target: { id: 'target-456' },
      },
      logger: mockLogger,
    };

    handler = new GetDamageCapabilitiesHandler({
      entityManager: mockEntityManager,
      logger: mockLogger,
      safeEventDispatcher: mockSafeEventDispatcher,
      jsonLogicService: mockJsonLogicService,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize successfully with valid dependencies', () => {
      expect(
        () =>
          new GetDamageCapabilitiesHandler({
            entityManager: mockEntityManager,
            logger: mockLogger,
            safeEventDispatcher: mockSafeEventDispatcher,
            jsonLogicService: mockJsonLogicService,
          })
      ).not.toThrow();
    });

    it('should throw error when entityManager is missing', () => {
      expect(
        () =>
          new GetDamageCapabilitiesHandler({
            logger: mockLogger,
            safeEventDispatcher: mockSafeEventDispatcher,
            jsonLogicService: mockJsonLogicService,
          })
      ).toThrow();
    });

    it('should throw error when logger is missing', () => {
      expect(
        () =>
          new GetDamageCapabilitiesHandler({
            entityManager: mockEntityManager,
            safeEventDispatcher: mockSafeEventDispatcher,
            jsonLogicService: mockJsonLogicService,
          })
      ).toThrow();
    });

    it('should throw error when safeEventDispatcher is missing', () => {
      expect(
        () =>
          new GetDamageCapabilitiesHandler({
            entityManager: mockEntityManager,
            logger: mockLogger,
            jsonLogicService: mockJsonLogicService,
          })
      ).toThrow();
    });

    it('should throw error when jsonLogicService is missing', () => {
      expect(
        () =>
          new GetDamageCapabilitiesHandler({
            entityManager: mockEntityManager,
            logger: mockLogger,
            safeEventDispatcher: mockSafeEventDispatcher,
          })
      ).toThrow();
    });

    it('should throw error when entityManager lacks required methods', () => {
      expect(
        () =>
          new GetDamageCapabilitiesHandler({
            entityManager: {},
            logger: mockLogger,
            safeEventDispatcher: mockSafeEventDispatcher,
          })
      ).toThrow();
    });

    it('should throw error when safeEventDispatcher lacks required methods', () => {
      expect(
        () =>
          new GetDamageCapabilitiesHandler({
            entityManager: mockEntityManager,
            logger: mockLogger,
            safeEventDispatcher: {},
          })
      ).toThrow();
    });
  });

  describe('Parameter Validation', () => {
    it('should dispatch error and return early when params is null', () => {
      handler.execute(null, executionContext);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: expect.stringContaining('params missing or invalid'),
        })
      );
      expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
    });

    it('should dispatch error and return early when params is undefined', () => {
      handler.execute(undefined, executionContext);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: expect.stringContaining('params missing or invalid'),
        })
      );
      expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
    });

    it('should dispatch error and return early when params is not an object', () => {
      handler.execute('string', executionContext);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: expect.stringContaining('params missing or invalid'),
        })
      );
      expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
    });

    it('should dispatch error when entity_ref is missing', () => {
      const params = {
        output_variable: 'testVar',
      };

      handler.execute(params, executionContext);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: expect.stringContaining('Could not resolve entity'),
        })
      );
      expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
    });

    it('should dispatch error when entity_ref is null', () => {
      const params = {
        entity_ref: null,
        output_variable: 'testVar',
      };

      handler.execute(params, executionContext);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: expect.stringContaining('Could not resolve entity'),
        })
      );
      expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
    });

    it('should dispatch error when output_variable is missing', () => {
      const params = {
        entity_ref: 'actor',
      };

      handler.execute(params, executionContext);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: expect.stringContaining('output_variable'),
        })
      );
      expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
    });

    it('should dispatch error when output_variable is empty string', () => {
      const params = {
        entity_ref: 'actor',
        output_variable: '',
      };

      handler.execute(params, executionContext);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: expect.stringContaining('output_variable'),
        })
      );
      expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
    });

    it('should dispatch error when output_variable is whitespace only', () => {
      const params = {
        entity_ref: 'actor',
        output_variable: '   ',
      };

      handler.execute(params, executionContext);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: expect.stringContaining('output_variable'),
        })
      );
      expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
    });

    it('should dispatch error when output_variable is not a string', () => {
      const params = {
        entity_ref: 'actor',
        output_variable: 123,
      };

      handler.execute(params, executionContext);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: expect.stringContaining('output_variable'),
        })
      );
      expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
    });
  });

  describe('Execution Context Validation', () => {
    const validParams = {
      entity_ref: 'actor',
      output_variable: 'testVar',
    };

    it('should dispatch error when execution context is null', () => {
      handler.execute(validParams, null);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: expect.stringContaining('evaluationContext'),
        })
      );
      expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
    });

    it('should dispatch error when execution context is undefined', () => {
      handler.execute(validParams, undefined);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: expect.stringContaining('evaluationContext'),
        })
      );
      expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
    });

    it('should dispatch error when evaluationContext is missing', () => {
      const invalidContext = {
        logger: mockLogger,
      };

      handler.execute(validParams, invalidContext);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: expect.stringContaining('evaluationContext'),
        })
      );
      expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
    });
  });

  describe('Entity Resolution', () => {
    const baseParams = {
      output_variable: 'damage_entries',
    };

    it('should resolve "actor" keyword to actor ID from execution context', () => {
      const params = { ...baseParams, entity_ref: 'actor' };
      mockEntityManager.getComponentData.mockReturnValue(null);

      handler.execute(params, executionContext);

      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'actor-123',
        'damage-types:damage_capabilities'
      );
    });

    it('should resolve "target" keyword to target ID from execution context', () => {
      const params = { ...baseParams, entity_ref: 'target' };
      mockEntityManager.getComponentData.mockReturnValue(null);

      handler.execute(params, executionContext);

      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'target-456',
        'damage-types:damage_capabilities'
      );
    });

    it('should use direct entity ID when provided as string', () => {
      const params = { ...baseParams, entity_ref: 'entity-789' };
      mockEntityManager.getComponentData.mockReturnValue(null);

      handler.execute(params, executionContext);

      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'entity-789',
        'damage-types:damage_capabilities'
      );
    });

    it('should handle EntityRefObject when provided', () => {
      const params = {
        ...baseParams,
        entity_ref: { entityId: 'ref-object-123' },
      };
      mockEntityManager.getComponentData.mockReturnValue(null);

      handler.execute(params, executionContext);

      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'ref-object-123',
        'damage-types:damage_capabilities'
      );
    });
  });

  describe('Returns existing damage capabilities unchanged', () => {
    const baseParams = {
      entity_ref: 'actor',
      output_variable: 'damage_entries',
    };

    it('should return existing damage_capabilities entries when component exists', () => {
      const existingEntries = [
        { name: 'slashing', amount: 15, penetration: 5 },
        { name: 'piercing', amount: 10, penetration: 8 },
      ];
      mockEntityManager.getComponentData.mockReturnValue({
        entries: existingEntries,
      });

      handler.execute(baseParams, executionContext);

      expect(executionContext.evaluationContext.context.damage_entries).toEqual(
        existingEntries
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Found existing damage capabilities')
      );
    });

    it('should not generate damage when existing capabilities found', () => {
      const existingEntries = [{ name: 'fire', amount: 20 }];
      mockEntityManager.getComponentData.mockReturnValue({
        entries: existingEntries,
      });

      handler.execute(baseParams, executionContext);

      // Should only check damage capabilities, not weight
      expect(mockEntityManager.getComponentData).toHaveBeenCalledTimes(1);
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'actor-123',
        'damage-types:damage_capabilities'
      );
    });
  });

  describe('Generates blunt damage from weight', () => {
    const baseParams = {
      entity_ref: 'actor',
      output_variable: 'damage_entries',
    };

    it('should generate blunt damage when no damage_capabilities but has weight', () => {
      mockEntityManager.getComponentData
        .mockReturnValueOnce(null) // damage_capabilities
        .mockReturnValueOnce({ weight: 1.0 }); // weight

      handler.execute(baseParams, executionContext);

      const result = executionContext.evaluationContext.context.damage_entries;
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('blunt');
      expect(result[0].amount).toBe(5); // 1.0 * 5 = 5
      expect(result[0].penetration).toBe(0);
      expect(result[0].flags).toContain('improvised');
    });

    it('should calculate damage correctly for various weights', () => {
      const testCases = [
        { weight: 0.1, expectedDamage: 1 }, // Very light - minimum 1
        { weight: 0.5, expectedDamage: 3 }, // Light
        { weight: 1.0, expectedDamage: 5 }, // Medium
        { weight: 5.0, expectedDamage: 25 }, // Heavy
        { weight: 10.0, expectedDamage: 50 }, // Very heavy - max cap
        { weight: 15.0, expectedDamage: 50 }, // Above max - capped at 50
      ];

      for (const { weight, expectedDamage } of testCases) {
        mockEntityManager.getComponentData
          .mockReturnValueOnce(null) // damage_capabilities
          .mockReturnValueOnce({ weight }); // weight

        handler.execute(baseParams, executionContext);

        const result =
          executionContext.evaluationContext.context.damage_entries;
        expect(result[0].amount).toBe(expectedDamage);

        // Reset for next iteration
        executionContext.evaluationContext.context = {};
        jest.clearAllMocks();
      }
    });

    it('should enable fracture for heavy objects (>= 1.0kg)', () => {
      mockEntityManager.getComponentData
        .mockReturnValueOnce(null) // damage_capabilities
        .mockReturnValueOnce({ weight: 2.0 }); // weight

      handler.execute(baseParams, executionContext);

      const result = executionContext.evaluationContext.context.damage_entries;
      expect(result[0].fracture.enabled).toBe(true);
      expect(result[0].fracture.thresholdFraction).toBeDefined();
      expect(result[0].fracture.stunChance).toBeDefined();
    });

    it('should disable fracture for light objects (< 1.0kg)', () => {
      mockEntityManager.getComponentData
        .mockReturnValueOnce(null) // damage_capabilities
        .mockReturnValueOnce({ weight: 0.5 }); // weight

      handler.execute(baseParams, executionContext);

      const result = executionContext.evaluationContext.context.damage_entries;
      expect(result[0].fracture.enabled).toBe(false);
    });

    it('should log debug message when generating from weight', () => {
      mockEntityManager.getComponentData
        .mockReturnValueOnce(null)
        .mockReturnValueOnce({ weight: 2.0 });

      handler.execute(baseParams, executionContext);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Generated blunt damage')
      );
    });
  });

  describe('Generates minimal fallback for weightless entities', () => {
    const baseParams = {
      entity_ref: 'actor',
      output_variable: 'damage_entries',
    };

    it('should generate fallback when neither damage_capabilities nor weight exist', () => {
      mockEntityManager.getComponentData.mockReturnValue(null);

      handler.execute(baseParams, executionContext);

      const result = executionContext.evaluationContext.context.damage_entries;
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('blunt');
      expect(result[0].amount).toBe(1);
      expect(result[0].penetration).toBe(0);
      expect(result[0].fracture.enabled).toBe(false);
      expect(result[0].flags).toContain('improvised');
      expect(result[0].flags).toContain('weightless');
    });

    it('should warn when using fallback', () => {
      mockEntityManager.getComponentData.mockReturnValue(null);

      handler.execute(baseParams, executionContext);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('neither damage capabilities nor weight')
      );
    });
  });

  describe('Resolves JSON Logic entity references', () => {
    it('should resolve JSON Logic expression for entity_ref', () => {
      const params = {
        entity_ref: { var: 'context.thrown_item' },
        output_variable: 'damage_entries',
      };

      // Set up context with the variable
      executionContext.evaluationContext.context.thrown_item =
        'item-entity-123';
      // Mock JSON Logic evaluation to return the entity ID
      mockJsonLogicService.evaluate.mockReturnValue('item-entity-123');
      mockEntityManager.getComponentData.mockReturnValue(null);

      handler.execute(params, executionContext);

      // Should have called JSON Logic evaluate with the expression
      expect(mockJsonLogicService.evaluate).toHaveBeenCalledWith(
        { var: 'context.thrown_item' },
        executionContext
      );
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'item-entity-123',
        'damage-types:damage_capabilities'
      );
    });

    it('should handle JSON Logic expression returning object with id', () => {
      const params = {
        entity_ref: { var: 'context.weapon' },
        output_variable: 'damage_entries',
      };

      // Mock JSON Logic evaluation to return an object with id
      mockJsonLogicService.evaluate.mockReturnValue({ id: 'weapon-456' });
      mockEntityManager.getComponentData.mockReturnValue(null);

      handler.execute(params, executionContext);

      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'weapon-456',
        'damage-types:damage_capabilities'
      );
    });

    it('should handle JSON Logic expression returning object with entityId', () => {
      const params = {
        entity_ref: { var: 'context.item' },
        output_variable: 'damage_entries',
      };

      // Mock JSON Logic evaluation to return an object with entityId
      mockJsonLogicService.evaluate.mockReturnValue({ entityId: 'item-789' });
      mockEntityManager.getComponentData.mockReturnValue(null);

      handler.execute(params, executionContext);

      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'item-789',
        'damage-types:damage_capabilities'
      );
    });

    it('should warn when JSON Logic evaluation fails', () => {
      const params = {
        entity_ref: { var: 'invalid.path' },
        output_variable: 'damage_entries',
      };

      // Mock JSON Logic evaluation to throw an error
      mockJsonLogicService.evaluate.mockImplementation(() => {
        throw new Error('Invalid variable path');
      });

      handler.execute(params, executionContext);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to evaluate entity ref'),
        expect.any(Object)
      );
    });
  });

  describe('Stores result in output_variable', () => {
    it('should store damage entries in the specified output_variable', () => {
      const params = {
        entity_ref: 'actor',
        output_variable: 'my_damage_results',
      };
      mockEntityManager.getComponentData
        .mockReturnValueOnce(null)
        .mockReturnValueOnce({ weight: 1.0 });

      handler.execute(params, executionContext);

      expect(
        executionContext.evaluationContext.context.my_damage_results
      ).toBeDefined();
      expect(
        executionContext.evaluationContext.context.my_damage_results
      ).toHaveLength(1);
    });

    it('should trim whitespace from output_variable', () => {
      const params = {
        entity_ref: 'actor',
        output_variable: '  trimmed_var  ',
      };
      mockEntityManager.getComponentData
        .mockReturnValueOnce(null)
        .mockReturnValueOnce({ weight: 1.0 });

      handler.execute(params, executionContext);

      expect(
        executionContext.evaluationContext.context.trimmed_var
      ).toBeDefined();
      expect(
        executionContext.evaluationContext.context['  trimmed_var  ']
      ).toBeUndefined();
    });

    it('should log success message after storing', () => {
      const params = {
        entity_ref: 'actor',
        output_variable: 'damage_entries',
      };
      const existingEntries = [{ name: 'slashing', amount: 10 }];
      mockEntityManager.getComponentData.mockReturnValue({
        entries: existingEntries,
      });

      handler.execute(params, executionContext);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Stored 1 damage entries')
      );
    });
  });

  describe('Dispatches error for invalid entity', () => {
    it('should dispatch error for non-existent entity reference', () => {
      const params = {
        entity_ref: '   ', // Empty string after trim
        output_variable: 'damage_entries',
      };

      handler.execute(params, executionContext);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: expect.stringContaining('Could not resolve entity'),
        })
      );
    });
  });

  describe('Error Handling', () => {
    const baseParams = {
      entity_ref: 'actor',
      output_variable: 'damage_entries',
    };

    it('should dispatch error when getComponentData throws', () => {
      const error = new Error('Database connection failed');
      mockEntityManager.getComponentData.mockImplementation(() => {
        throw error;
      });

      handler.execute(baseParams, executionContext);

      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: expect.stringContaining(
            'Error retrieving damage capabilities'
          ),
          details: expect.objectContaining({
            error: 'Database connection failed',
          }),
        })
      );
    });
  });

  describe('Edge Cases', () => {
    const baseParams = {
      entity_ref: 'actor',
      output_variable: 'damage_entries',
    };

    it('should handle damage_capabilities with empty entries array', () => {
      mockEntityManager.getComponentData.mockReturnValue({ entries: [] });

      handler.execute(baseParams, executionContext);

      // Empty entries array still counts as "having capabilities"
      expect(executionContext.evaluationContext.context.damage_entries).toEqual(
        []
      );
    });

    it('should handle weight of exactly 0', () => {
      mockEntityManager.getComponentData
        .mockReturnValueOnce(null) // damage_capabilities
        .mockReturnValueOnce({ weight: 0 }); // weight

      handler.execute(baseParams, executionContext);

      const result = executionContext.evaluationContext.context.damage_entries;
      expect(result[0].amount).toBe(1); // Minimum damage
    });

    it('should handle weight as undefined in weight component', () => {
      mockEntityManager.getComponentData
        .mockReturnValueOnce(null) // damage_capabilities
        .mockReturnValueOnce({ notWeight: 5 }); // weight component without weight property

      handler.execute(baseParams, executionContext);

      // Should use fallback since weight property is missing
      const result = executionContext.evaluationContext.context.damage_entries;
      expect(result[0].flags).toContain('weightless');
    });

    it('should overwrite existing context variable', () => {
      executionContext.evaluationContext.context.damage_entries = 'old value';
      mockEntityManager.getComponentData
        .mockReturnValueOnce(null)
        .mockReturnValueOnce({ weight: 1.0 });

      handler.execute(baseParams, executionContext);

      expect(
        executionContext.evaluationContext.context.damage_entries
      ).not.toBe('old value');
      expect(
        Array.isArray(executionContext.evaluationContext.context.damage_entries)
      ).toBe(true);
    });

    it('should handle primary/secondary/tertiary keywords via event payload', () => {
      // Primary/secondary/tertiary are resolved from evaluationContext.event.payload
      executionContext.evaluationContext.event = {
        payload: {
          primaryId: 'primary-123',
          secondaryId: 'secondary-456',
          tertiaryId: 'tertiary-789',
        },
      };
      const params = { ...baseParams, entity_ref: 'primary' };
      mockEntityManager.getComponentData.mockReturnValue(null);

      handler.execute(params, executionContext);

      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'primary-123',
        'damage-types:damage_capabilities'
      );
    });

    it('should handle secondary keyword via event payload', () => {
      executionContext.evaluationContext.event = {
        payload: {
          primaryId: 'primary-123',
          secondaryId: 'secondary-456',
        },
      };
      const params = { ...baseParams, entity_ref: 'secondary' };
      mockEntityManager.getComponentData.mockReturnValue(null);

      handler.execute(params, executionContext);

      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'secondary-456',
        'damage-types:damage_capabilities'
      );
    });
  });
});
