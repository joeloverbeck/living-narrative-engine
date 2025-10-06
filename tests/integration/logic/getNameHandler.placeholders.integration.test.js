/**
 * @file Integration tests for GetNameHandler placeholder resolution
 * @description Tests the GetNameHandler's interaction with placeholder resolution system
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import GetNameHandler from '../../../src/logic/operationHandlers/getNameHandler.js';
import { NAME_COMPONENT_ID } from '../../../src/constants/componentIds.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/eventIds.js';
import { PlaceholderTestUtils } from '../../helpers/placeholderTestUtils.js';

describe('GetNameHandler placeholder resolution integration', () => {
  let handler;
  let mockEntityManager;
  let mockLogger;
  let mockSafeEventDispatcher;
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

    handler = new GetNameHandler({
      entityManager: mockEntityManager,
      logger: mockLogger,
      safeEventDispatcher: mockSafeEventDispatcher,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Placeholder resolution with enhanced event payload', () => {
    it('should resolve primary placeholder from enhanced event payload', () => {
      // Setup execution context with enhanced event payload
      executionContext = {
        evaluationContext: {
          context: {},
          actor: { id: 'actor_123' },
          target: { id: 'target_456' },
          event: {
            type: 'core:attempt_action',
            payload: {
              actorId: 'actor_123',
              actionId: 'caressing:adjust_clothing',
              targetId: 'target_456',
              primaryId: 'iker_aguirre',
              secondaryId: 'jacket_789',
              targets: {
                primary: { entityId: 'iker_aguirre' },
                secondary: { entityId: 'jacket_789' },
              },
            },
          },
        },
        logger: mockLogger,
      };

      // Mock entity manager to return name for primary entity
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (
            entityId === 'iker_aguirre' &&
            componentId === NAME_COMPONENT_ID
          ) {
            return { text: 'Iker Aguirre' };
          }
          return null;
        }
      );

      // Execute GET_NAME with primary placeholder
      const params = {
        entity_ref: 'primary',
        result_variable: 'targetName',
      };

      handler.execute(params, executionContext);

      // Verify entity was resolved correctly
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'iker_aguirre',
        NAME_COMPONENT_ID
      );
      expect(executionContext.evaluationContext.context.targetName).toBe(
        'Iker Aguirre'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Resolved placeholder 'primary' to entity ID 'iker_aguirre'"
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "GET_NAME: Resolved name for 'iker_aguirre' -> 'Iker Aguirre'."
      );
    });

    it('should resolve secondary placeholder from enhanced event payload', () => {
      executionContext = {
        evaluationContext: {
          context: {},
          actor: { id: 'actor_123' },
          event: {
            type: 'core:attempt_action',
            payload: {
              primaryId: 'person_123',
              secondaryId: 'garment_456',
              targets: {
                primary: { entityId: 'person_123' },
                secondary: { entityId: 'garment_456' },
              },
            },
          },
        },
        logger: mockLogger,
      };

      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (entityId === 'garment_456' && componentId === NAME_COMPONENT_ID) {
            return { text: 'denim trucker jacket' };
          }
          return null;
        }
      );

      const params = {
        entity_ref: 'secondary',
        result_variable: 'garmentName',
      };

      handler.execute(params, executionContext);

      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'garment_456',
        NAME_COMPONENT_ID
      );
      expect(executionContext.evaluationContext.context.garmentName).toBe(
        'denim trucker jacket'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Resolved placeholder 'secondary' to entity ID 'garment_456'"
      );
    });

    it('should handle tertiary placeholder', () => {
      executionContext = {
        evaluationContext: {
          context: {},
          event: {
            payload: {
              tertiaryId: 'extra_entity',
            },
          },
        },
        logger: mockLogger,
      };

      mockEntityManager.getComponentData.mockImplementation((entityId) => {
        if (entityId === 'extra_entity') {
          return { text: 'Extra Entity Name' };
        }
        return null;
      });

      const params = {
        entity_ref: 'tertiary',
        result_variable: 'extraName',
      };

      handler.execute(params, executionContext);

      expect(executionContext.evaluationContext.context.extraName).toBe(
        'Extra Entity Name'
      );
    });

    it('should use fallback when placeholder cannot be resolved', () => {
      executionContext = {
        evaluationContext: {
          context: {},
          event: {
            payload: {
              // No primaryId or targets
            },
          },
        },
        logger: mockLogger,
      };

      const params = {
        entity_ref: 'primary',
        result_variable: 'targetName',
        default_value: 'Unknown Target',
      };

      handler.execute(params, executionContext);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Failed to resolve placeholder 'primary' - no matching target in event payload",
        expect.objectContaining({
          placeholder: 'primary',
          availableTargets: [],
          suggestion: 'No targets available in event payload',
        })
      );
      expect(executionContext.evaluationContext.context.targetName).toBe(
        'Unknown Target'
      );
      expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
    });

    it('should work with mixed payload formats', () => {
      executionContext = {
        evaluationContext: {
          context: {},
          event: {
            payload: {
              primaryId: 'legacy_format_id', // Legacy format
              targets: {
                secondary: 'new_format_string', // New format as string
                tertiary: { entityId: 'new_format_object' }, // New format as object
              },
            },
          },
        },
        logger: mockLogger,
      };

      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          const names = {
            legacy_format_id: 'Legacy Name',
            new_format_string: 'New String Name',
            new_format_object: 'New Object Name',
          };
          if (componentId === NAME_COMPONENT_ID && names[entityId]) {
            return { text: names[entityId] };
          }
          return null;
        }
      );

      // Test primary (legacy format)
      handler.execute(
        { entity_ref: 'primary', result_variable: 'name1' },
        executionContext
      );
      expect(executionContext.evaluationContext.context.name1).toBe(
        'Legacy Name'
      );

      // Test secondary (new format string)
      handler.execute(
        { entity_ref: 'secondary', result_variable: 'name2' },
        executionContext
      );
      expect(executionContext.evaluationContext.context.name2).toBe(
        'New String Name'
      );

      // Test tertiary (new format object)
      handler.execute(
        { entity_ref: 'tertiary', result_variable: 'name3' },
        executionContext
      );
      expect(executionContext.evaluationContext.context.name3).toBe(
        'New Object Name'
      );
    });

    it('should prefer targets object over flattened format', () => {
      executionContext = {
        evaluationContext: {
          context: {},
          event: {
            payload: {
              primaryId: 'legacy_id',
              targets: {
                primary: { entityId: 'preferred_id' },
              },
            },
          },
        },
        logger: mockLogger,
      };

      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (
            entityId === 'preferred_id' &&
            componentId === NAME_COMPONENT_ID
          ) {
            return { text: 'Preferred Name' };
          }
          if (entityId === 'legacy_id' && componentId === NAME_COMPONENT_ID) {
            return { text: 'Legacy Name' };
          }
          return null;
        }
      );

      const params = {
        entity_ref: 'primary',
        result_variable: 'name',
      };

      handler.execute(params, executionContext);

      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'preferred_id',
        NAME_COMPONENT_ID
      );
      expect(executionContext.evaluationContext.context.name).toBe(
        'Preferred Name'
      );
    });

    it('should still support actor and target keywords alongside placeholders', () => {
      executionContext = {
        evaluationContext: {
          context: {},
          actor: { id: 'actor_entity' },
          target: { id: 'target_entity' },
          event: {
            payload: {
              primaryId: 'primary_entity',
            },
          },
        },
        logger: mockLogger,
      };

      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          const names = {
            actor_entity: 'Actor Name',
            target_entity: 'Target Name',
            primary_entity: 'Primary Name',
          };
          if (componentId === NAME_COMPONENT_ID && names[entityId]) {
            return { text: names[entityId] };
          }
          return null;
        }
      );

      // Test actor keyword
      handler.execute(
        { entity_ref: 'actor', result_variable: 'actorName' },
        executionContext
      );
      expect(executionContext.evaluationContext.context.actorName).toBe(
        'Actor Name'
      );

      // Test target keyword
      handler.execute(
        { entity_ref: 'target', result_variable: 'targetName' },
        executionContext
      );
      expect(executionContext.evaluationContext.context.targetName).toBe(
        'Target Name'
      );

      // Test primary placeholder
      handler.execute(
        { entity_ref: 'primary', result_variable: 'primaryName' },
        executionContext
      );
      expect(executionContext.evaluationContext.context.primaryName).toBe(
        'Primary Name'
      );
    });

    it('should log available targets when resolution fails', () => {
      executionContext = {
        evaluationContext: {
          context: {},
          event: {
            payload: {
              primaryId: 'id1',
              tertiaryId: 'id3',
              targets: {
                custom: 'custom_id',
              },
            },
          },
        },
        logger: mockLogger,
      };

      const params = {
        entity_ref: 'secondary',
        result_variable: 'name',
        default_value: 'Fallback',
      };

      handler.execute(params, executionContext);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Failed to resolve placeholder 'secondary' - no matching target in event payload",
        expect.objectContaining({
          placeholder: 'secondary',
          availableTargets: expect.arrayContaining([
            'primary',
            'tertiary',
            'custom',
          ]),
          suggestion: expect.stringContaining('Available targets:'),
        })
      );
    });
  });
});
