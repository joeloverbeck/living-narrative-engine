/**
 * @file Unit tests for PrepareActionContextHandler
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import PrepareActionContextHandler from '../../../../src/logic/operationHandlers/prepareActionContextHandler.js';

describe('PrepareActionContextHandler', () => {
  let handler;
  let mockEntityManager;
  let mockLogger;

  beforeEach(() => {
    mockEntityManager = {
      getEntityInstance: jest.fn(),
      getComponentData: jest.fn(),
    };
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    handler = new PrepareActionContextHandler({
      entityManager: mockEntityManager,
      logger: mockLogger,
    });
  });

  describe('constructor validation', () => {
    it('should throw if entityManager is missing', () => {
      expect(
        () => new PrepareActionContextHandler({ logger: mockLogger })
      ).toThrow();
    });

    it('should throw if logger is missing', () => {
      expect(
        () =>
          new PrepareActionContextHandler({ entityManager: mockEntityManager })
      ).toThrow();
    });

    it('should create handler with valid dependencies', () => {
      expect(handler).toBeDefined();
    });
  });

  describe('execute - validation and initialization', () => {
    it('should log warning and return if event is missing', async () => {
      const parameters = {};
      const executionContext = {
        evaluationContext: {
          // event missing
          context: {},
        },
      };

      const result = await handler.execute(parameters, executionContext);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No event payload found')
      );
      expect(result).toBe(executionContext);
    });

    it('should log warning and return if event payload is missing', async () => {
      const parameters = {};
      const executionContext = {
        evaluationContext: {
          event: {}, // payload missing
          context: {},
        },
      };

      const result = await handler.execute(parameters, executionContext);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No event payload found')
      );
      expect(result).toBe(executionContext);
    });

    it('should initialize context if missing', async () => {
      mockEntityManager.getComponentData.mockReturnValue({ name: 'Test' });

      const parameters = {};
      const executionContext = {
        evaluationContext: {
          event: {
            payload: { actorId: 'a', targetId: 't' },
          },
          // context missing
        },
      };

      const result = await handler.execute(parameters, executionContext);

      expect(result.evaluationContext.context).toBeDefined();
      expect(result.evaluationContext.context.actorName).toBe('Test');
    });
    it('should handle null parameters using defaults', async () => {
      mockEntityManager.getComponentData.mockReturnValue({ name: 'Test' });

      const executionContext = {
        evaluationContext: {
          event: {
            payload: { actorId: 'a', targetId: 't' },
          },
          context: {},
        },
      };

      // Pass null as parameters
      const result = await handler.execute(null, executionContext);

      expect(result.evaluationContext.context.perceptionType).toBe(
        'action_target_general'
      );
    });
  });

  describe('execute - happy path', () => {
    it('should set actorName from core:actor component', async () => {
      // Arrange
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (entityId === 'actor-1' && componentType === 'core:actor') {
            return { name: 'Alice' };
          }
          if (entityId === 'target-1' && componentType === 'core:actor') {
            return { name: 'Bob' };
          }
          if (entityId === 'actor-1' && componentType === 'core:position') {
            return { locationId: 'location-1' };
          }
          return null;
        }
      );

      const parameters = {};
      const executionContext = {
        evaluationContext: {
          event: {
            payload: {
              actorId: 'actor-1',
              targetId: 'target-1',
            },
          },
          context: {},
        },
      };

      // Act
      const result = await handler.execute(parameters, executionContext);

      // Assert
      const context = result.evaluationContext.context;
      expect(context.actorName).toBe('Alice');
      expect(context.targetName).toBe('Bob');
      expect(context.locationId).toBe('location-1');
      expect(context.targetId).toBe('target-1');
      expect(context.perceptionType).toBe('action_target_general');
    });

    it('should use custom perception_type when provided', async () => {
      mockEntityManager.getComponentData.mockReturnValue({ name: 'Test' });

      const parameters = { perception_type: 'custom_type' };
      const executionContext = {
        evaluationContext: {
          event: {
            payload: { actorId: 'a', targetId: 't' },
          },
          context: {},
        },
      };

      const result = await handler.execute(parameters, executionContext);

      expect(result.evaluationContext.context.perceptionType).toBe(
        'custom_type'
      );
    });
  });

  describe('execute - name resolution fallbacks', () => {
    it('should resolve name from core:name component (primary source)', async () => {
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (componentType === 'core:name') {
            return { text: `NameFrom-${entityId}` };
          }
          if (componentType === 'core:actor') {
            // core:actor also has a name, but should be ignored in favor of core:name
            return { name: 'ShouldNotBeUsed' };
          }
          if (componentType === 'core:position') {
            return { locationId: 'loc-1' };
          }
          return null;
        }
      );

      const parameters = {};
      const executionContext = {
        evaluationContext: {
          event: {
            payload: { actorId: 'actor-1', targetId: 'target-1' },
          },
          context: {},
        },
      };

      const result = await handler.execute(parameters, executionContext);

      const context = result.evaluationContext.context;
      // Should use core:name.text, not core:actor.name
      expect(context.actorName).toBe('NameFrom-actor-1');
      expect(context.targetName).toBe('NameFrom-target-1');
    });

    it('should fallback to core:actor if core:name not found', async () => {
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (componentType === 'core:name') return null;
          if (componentType === 'core:actor')
            return { name: `Actor-${entityId}` };
          if (componentType === 'core:position') return { locationId: 'loc-1' };
          return null;
        }
      );

      const parameters = {};
      const executionContext = {
        evaluationContext: {
          event: {
            payload: { actorId: 'a1', targetId: 't1' },
          },
          context: {},
        },
      };

      const result = await handler.execute(parameters, executionContext);

      const context = result.evaluationContext.context;
      expect(context.actorName).toBe('Actor-a1');
      expect(context.targetName).toBe('Actor-t1');
    });

    it('should fallback to core:item if core:name and core:actor not found', async () => {
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (componentType === 'core:name') return null;
          if (componentType === 'core:actor') return null;
          if (componentType === 'core:item') return { name: 'Sword' };
          if (componentType === 'core:position') return { locationId: 'loc-1' };
          return null;
        }
      );

      const parameters = {};
      const executionContext = {
        evaluationContext: {
          event: {
            payload: { actorId: 'item-1', targetId: 'item-2' },
          },
          context: {},
        },
      };

      const result = await handler.execute(parameters, executionContext);

      const context = result.evaluationContext.context;
      expect(context.actorName).toBe('Sword');
      expect(context.targetName).toBe('Sword');
    });

    it('should fallback to entityId if no name components found', async () => {
      mockEntityManager.getComponentData.mockReturnValue(null);

      const parameters = {};
      const executionContext = {
        evaluationContext: {
          event: {
            payload: { actorId: 'entity-123', targetId: 'entity-456' },
          },
          context: {},
        },
      };

      const result = await handler.execute(parameters, executionContext);

      const context = result.evaluationContext.context;
      expect(context.actorName).toBe('entity-123');
      expect(context.targetName).toBe('entity-456');
    });

    it('should return "Unknown" for null entityId', async () => {
      const parameters = {};
      const executionContext = {
        evaluationContext: {
          event: {
            payload: { actorId: null, targetId: null },
          },
          context: {},
        },
      };

      const result = await handler.execute(parameters, executionContext);

      const context = result.evaluationContext.context;
      expect(context.actorName).toBe('Unknown');
      expect(context.targetName).toBe('Unknown');
    });
  });

  describe('execute - secondary entity handling', () => {
    it('should resolve secondary name when include_secondary is true', async () => {
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (componentType === 'core:actor') {
            return { name: `Name-${entityId}` };
          }
          if (componentType === 'core:position') {
            return { locationId: 'loc-1' };
          }
          return null;
        }
      );

      const parameters = {
        include_secondary: true,
      };
      const executionContext = {
        evaluationContext: {
          event: {
            payload: {
              actorId: 'actor-1',
              targetId: 'target-1',
              secondaryId: 'secondary-1',
            },
          },
          context: {},
        },
      };

      const result = await handler.execute(parameters, executionContext);

      expect(result.evaluationContext.context.secondaryName).toBe(
        'Name-secondary-1'
      );
    });

    it('should use custom secondary_name_variable', async () => {
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (componentType === 'core:actor') return { name: 'Test' };
          if (componentType === 'core:position') return { locationId: 'loc-1' };
          return null;
        }
      );

      const parameters = {
        include_secondary: true,
        secondary_name_variable: 'weaponName',
      };
      const executionContext = {
        evaluationContext: {
          event: {
            payload: {
              actorId: 'a',
              targetId: 't',
              secondaryId: 's',
            },
          },
          context: {},
        },
      };

      const result = await handler.execute(parameters, executionContext);

      const context = result.evaluationContext.context;
      expect(context.weaponName).toBe('Test');
      expect(context.secondaryName).toBeUndefined();
    });

    it('should not set secondary name when include_secondary is false', async () => {
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (componentType === 'core:actor') return { name: 'Test' };
          if (componentType === 'core:position') return { locationId: 'loc-1' };
          return null;
        }
      );

      const parameters = {
        include_secondary: false,
      };
      const executionContext = {
        evaluationContext: {
          event: {
            payload: {
              actorId: 'a',
              targetId: 't',
              secondaryId: 's',
            },
          },
          context: {},
        },
      };

      const result = await handler.execute(parameters, executionContext);

      expect(result.evaluationContext.context.secondaryName).toBeUndefined();
    });

    it('should not set secondary name when secondaryId is missing', async () => {
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (componentType === 'core:actor') return { name: 'Test' };
          if (componentType === 'core:position') return { locationId: 'loc-1' };
          return null;
        }
      );

      const parameters = {
        include_secondary: true,
      };
      const executionContext = {
        evaluationContext: {
          event: {
            payload: {
              actorId: 'a',
              targetId: 't',
              // no secondaryId
            },
          },
          context: {},
        },
      };

      const result = await handler.execute(parameters, executionContext);

      expect(result.evaluationContext.context.secondaryName).toBeUndefined();
    });
  });

  describe('execute - location handling', () => {
    it('should set locationId to null when position component missing', async () => {
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (componentType === 'core:actor') return { name: 'Test' };
          if (componentType === 'core:position') return null;
          return null;
        }
      );

      const parameters = {};
      const executionContext = {
        evaluationContext: {
          event: {
            payload: { actorId: 'a', targetId: 't' },
          },
          context: {},
        },
      };

      const result = await handler.execute(parameters, executionContext);

      expect(result.evaluationContext.context.locationId).toBeNull();
    });

    it('should handle position without locationId', async () => {
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentType) => {
          if (componentType === 'core:actor') return { name: 'Test' };
          if (componentType === 'core:position') return {}; // no locationId
          return null;
        }
      );

      const parameters = {};
      const executionContext = {
        evaluationContext: {
          event: {
            payload: { actorId: 'a', targetId: 't' },
          },
          context: {},
        },
      };

      const result = await handler.execute(parameters, executionContext);

      expect(result.evaluationContext.context.locationId).toBeNull();
    });
  });

  describe('execute - logging', () => {
    it('should log debug message on successful execution', async () => {
      mockEntityManager.getComponentData.mockReturnValue({ name: 'Test' });

      const parameters = {};
      const executionContext = {
        evaluationContext: {
          event: {
            payload: { actorId: 'a', targetId: 't' },
          },
          context: {},
        },
      };

      await handler.execute(parameters, executionContext);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Prepared context'),
        expect.objectContaining({
          actorId: 'a',
          targetId: 't',
        })
      );
    });
  });

  describe('execute - context preservation', () => {
    it('should preserve existing context properties', async () => {
      mockEntityManager.getComponentData.mockReturnValue({ name: 'Test' });

      const parameters = {};
      const executionContext = {
        evaluationContext: {
          event: {
            payload: { actorId: 'a', targetId: 't' },
          },
          context: {
            existingProperty: 'should-be-preserved',
            anotherProperty: 42,
          },
        },
      };

      const result = await handler.execute(parameters, executionContext);

      const context = result.evaluationContext.context;
      expect(context.existingProperty).toBe('should-be-preserved');
      expect(context.anotherProperty).toBe(42);
    });
  });
});
