/**
 * @file Unit tests for ContextAssemblyService
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import ContextAssemblyService from '../../../../src/goap/services/contextAssemblyService.js';
import ContextAssemblyError from '../../../../src/goap/errors/contextAssemblyError.js';

describe('ContextAssemblyService', () => {
  let service;
  let mockEntityManager;
  let mockLogger;
  let mockEntity;

  beforeEach(() => {
    // Create mock entity
    mockEntity = {
      id: 'actor-123',
      components: {
        'core:actor': { name: 'Test Actor' },
        'core:position': { location: 'room-1' },
      },
    };

    // Create mock entity manager
    mockEntityManager = {
      getEntity: jest.fn((id) => {
        if (id === 'actor-123') return mockEntity;
        if (id === 'other-entity') return { id: 'other-entity', components: {} };
        return null;
      }),
      getComponent: jest.fn(),
      entities: new Set([mockEntity, { id: 'other-entity', components: {} }]),
    };

    // Create mock logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Create service instance
    service = new ContextAssemblyService({
      entityManager: mockEntityManager,
      logger: mockLogger,
    });
  });

  describe('constructor', () => {
    it('should create service with required dependencies', () => {
      expect(service).toBeInstanceOf(ContextAssemblyService);
    });

    it('should throw error if entityManager is missing', () => {
      expect(() => {
        new ContextAssemblyService({
          entityManager: null,
          logger: mockLogger,
        });
      }).toThrow();
    });

    it('should throw error if logger is missing', () => {
      expect(() => {
        new ContextAssemblyService({
          entityManager: mockEntityManager,
          logger: null,
        });
      }).toThrow();
    });

    it('should log warning when knowledge limitation is enabled', () => {
      new ContextAssemblyService({
        entityManager: mockEntityManager,
        logger: mockLogger,
        enableKnowledgeLimitation: true,
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Knowledge limitation enabled but full knowledge filtering not yet integrated')
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('GOAPIMPL-023')
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('omniscient mode')
      );
    });

    it('should not log warning when knowledge limitation is disabled', () => {
      new ContextAssemblyService({
        entityManager: mockEntityManager,
        logger: mockLogger,
        enableKnowledgeLimitation: false,
      });

      expect(mockLogger.warn).not.toHaveBeenCalled();
    });
  });

  describe('assemblePlanningContext', () => {
    it('should assemble planning context for valid actor', () => {
      const context = service.assemblePlanningContext('actor-123');

      expect(context).toEqual({
        actor: {
          id: 'actor-123',
          components: {
            'core:actor': { name: 'Test Actor' },
            'core:position': { location: 'room-1' },
          },
        },
        world: {
          locations: {},
          time: {},
        },
      });
    });

    it('should call entityManager.getEntity with correct actor ID', () => {
      service.assemblePlanningContext('actor-123');

      expect(mockEntityManager.getEntity).toHaveBeenCalledWith('actor-123');
    });

    it('should log debug messages during assembly', () => {
      service.assemblePlanningContext('actor-123');

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Assembling planning context')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('assembled successfully')
      );
    });

    it('should throw error if actor ID is empty', () => {
      expect(() => {
        service.assemblePlanningContext('');
      }).toThrow();
    });

    it('should throw ContextAssemblyError if actor ID is null', () => {
      expect(() => {
        service.assemblePlanningContext(null);
      }).toThrow();
    });

    it('should throw ContextAssemblyError if actor ID is undefined', () => {
      expect(() => {
        service.assemblePlanningContext(undefined);
      }).toThrow();
    });

    it('should throw ContextAssemblyError if actor does not exist', () => {
      expect(() => {
        service.assemblePlanningContext('nonexistent-actor');
      }).toThrow(ContextAssemblyError);
    });

    it('should log error when actor does not exist', () => {
      try {
        service.assemblePlanningContext('nonexistent-actor');
      } catch {
        // Expected error - swallow it
      }

      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should include knowledge array when knowledge limitation is enabled', () => {
      const serviceWithKnowledge = new ContextAssemblyService({
        entityManager: mockEntityManager,
        logger: mockLogger,
        enableKnowledgeLimitation: true,
      });

      const context = serviceWithKnowledge.assemblePlanningContext('actor-123');

      expect(context.actor.knowledge).toBeDefined();
      expect(Array.isArray(context.actor.knowledge)).toBe(true);
    });

    it('should not include knowledge array when knowledge limitation is disabled', () => {
      const context = service.assemblePlanningContext('actor-123');

      expect(context.actor.knowledge).toBeUndefined();
    });

    it('should return known entity IDs from core:known_to component', () => {
      // Add core:known_to component to mock entity
      mockEntity.components['core:known_to'] = {
        entities: ['actor-123', 'other-entity'],
      };

      const serviceWithKnowledge = new ContextAssemblyService({
        entityManager: mockEntityManager,
        logger: mockLogger,
        enableKnowledgeLimitation: true,
      });

      const context = serviceWithKnowledge.assemblePlanningContext('actor-123');

      expect(context.actor.knowledge).toContain('actor-123');
      expect(context.actor.knowledge).toContain('other-entity');
      expect(context.actor.knowledge).toHaveLength(2);
    });

    it('should return minimal knowledge when core:known_to component is missing', () => {
      // mockEntity doesn't have core:known_to component
      const serviceWithKnowledge = new ContextAssemblyService({
        entityManager: mockEntityManager,
        logger: mockLogger,
        enableKnowledgeLimitation: true,
      });

      const context = serviceWithKnowledge.assemblePlanningContext('actor-123');

      // Should fallback to minimal knowledge (self only)
      expect(context.actor.knowledge).toEqual(['actor-123']);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Actor missing core:known_to component'),
        expect.any(Object)
      );
    });
  });

  describe('assembleRefinementContext', () => {
    const validTask = {
      id: 'core:consume_nourishing_item',
      params: {
        item: 'entity-456',
      },
    };

    it('should assemble refinement context for valid actor and task', () => {
      const context = service.assembleRefinementContext('actor-123', validTask);

      expect(context).toEqual({
        actor: {
          id: 'actor-123',
          components: {
            'core:actor': { name: 'Test Actor' },
            'core:position': { location: 'room-1' },
          },
        },
        world: {
          locations: {},
          time: {},
        },
        task: {
          id: 'core:consume_nourishing_item',
          params: {
            item: 'entity-456',
          },
        },
        refinement: {
          localState: {},
        },
      });
    });

    it('should include provided localState in refinement context', () => {
      const localState = {
        stepResults: ['step1-result', 'step2-result'],
      };

      const context = service.assembleRefinementContext(
        'actor-123',
        validTask,
        localState
      );

      expect(context.refinement.localState).toEqual(localState);
    });

    it('should use empty object for localState when not provided', () => {
      const context = service.assembleRefinementContext('actor-123', validTask);

      expect(context.refinement.localState).toEqual({});
    });

    it('should use empty object for localState when null is provided', () => {
      const context = service.assembleRefinementContext(
        'actor-123',
        validTask,
        null
      );

      expect(context.refinement.localState).toEqual({});
    });

    it('should call entityManager.getEntity with correct actor ID', () => {
      service.assembleRefinementContext('actor-123', validTask);

      expect(mockEntityManager.getEntity).toHaveBeenCalledWith('actor-123');
    });

    it('should log debug messages during assembly', () => {
      service.assembleRefinementContext('actor-123', validTask);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Assembling refinement context')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('assembled successfully')
      );
    });

    it('should throw error if actor ID is empty', () => {
      expect(() => {
        service.assembleRefinementContext('', validTask);
      }).toThrow();
    });

    it('should throw ContextAssemblyError if task is null', () => {
      expect(() => {
        service.assembleRefinementContext('actor-123', null);
      }).toThrow(ContextAssemblyError);
    });

    it('should throw ContextAssemblyError if task is not an object', () => {
      expect(() => {
        service.assembleRefinementContext('actor-123', 'invalid-task');
      }).toThrow(ContextAssemblyError);
    });

    it('should throw error if task.id is missing', () => {
      const invalidTask = {
        params: { item: 'entity-456' },
      };

      expect(() => {
        service.assembleRefinementContext('actor-123', invalidTask);
      }).toThrow();
    });

    it('should throw error if task.id is empty', () => {
      const invalidTask = {
        id: '',
        params: { item: 'entity-456' },
      };

      expect(() => {
        service.assembleRefinementContext('actor-123', invalidTask);
      }).toThrow();
    });

    it('should throw ContextAssemblyError if task.params is missing', () => {
      const invalidTask = {
        id: 'core:consume_nourishing_item',
      };

      expect(() => {
        service.assembleRefinementContext('actor-123', invalidTask);
      }).toThrow(ContextAssemblyError);
    });

    it('should throw ContextAssemblyError if task.params is not an object', () => {
      const invalidTask = {
        id: 'core:consume_nourishing_item',
        params: 'invalid',
      };

      expect(() => {
        service.assembleRefinementContext('actor-123', invalidTask);
      }).toThrow(ContextAssemblyError);
    });

    it('should throw ContextAssemblyError if actor does not exist', () => {
      expect(() => {
        service.assembleRefinementContext('nonexistent-actor', validTask);
      }).toThrow(ContextAssemblyError);
    });

    it('should log error when actor does not exist', () => {
      try {
        service.assembleRefinementContext('nonexistent-actor', validTask);
      } catch {
        // Expected error - swallow it
      }

      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should include knowledge array when knowledge limitation is enabled', () => {
      const serviceWithKnowledge = new ContextAssemblyService({
        entityManager: mockEntityManager,
        logger: mockLogger,
        enableKnowledgeLimitation: true,
      });

      const context = serviceWithKnowledge.assembleRefinementContext(
        'actor-123',
        validTask
      );

      expect(context.actor.knowledge).toBeDefined();
      expect(Array.isArray(context.actor.knowledge)).toBe(true);
    });
  });

  describe('assembleConditionContext', () => {
    it('should assemble condition context from planning context', () => {
      const planningContext = {
        actor: {
          id: 'actor-123',
          components: { 'core:actor': { name: 'Test Actor' } },
        },
        world: {
          locations: {},
          time: {},
        },
      };

      const conditionContext =
        service.assembleConditionContext(planningContext);

      expect(conditionContext).toEqual({
        actor: planningContext.actor,
        world: planningContext.world,
      });
    });

    it('should assemble condition context from refinement context', () => {
      const refinementContext = {
        actor: {
          id: 'actor-123',
          components: { 'core:actor': { name: 'Test Actor' } },
        },
        world: {
          locations: {},
          time: {},
        },
        task: {
          id: 'core:consume_nourishing_item',
          params: { item: 'entity-456' },
        },
        refinement: {
          localState: { step1: 'result1' },
        },
      };

      const conditionContext =
        service.assembleConditionContext(refinementContext);

      expect(conditionContext).toEqual({
        actor: refinementContext.actor,
        world: refinementContext.world,
        task: refinementContext.task,
        refinement: refinementContext.refinement,
      });
    });

    it('should not include task or refinement for planning context', () => {
      const planningContext = {
        actor: {
          id: 'actor-123',
          components: {},
        },
        world: {},
      };

      const conditionContext =
        service.assembleConditionContext(planningContext);

      expect(conditionContext.task).toBeUndefined();
      expect(conditionContext.refinement).toBeUndefined();
    });

    it('should log debug messages during assembly', () => {
      const planningContext = {
        actor: { id: 'actor-123', components: {} },
        world: {},
      };

      service.assembleConditionContext(planningContext);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Assembling condition evaluation context')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Condition context assembled successfully')
      );
    });

    it('should throw ContextAssemblyError if context is null', () => {
      expect(() => {
        service.assembleConditionContext(null);
      }).toThrow(ContextAssemblyError);
    });

    it('should throw ContextAssemblyError if context is not an object', () => {
      expect(() => {
        service.assembleConditionContext('invalid');
      }).toThrow(ContextAssemblyError);
    });

    it('should log error when context is invalid', () => {
      try {
        service.assembleConditionContext(null);
      } catch {
        // Expected error - swallow it
      }

      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should include actorId in error details for planning context failures', () => {
      expect(() => {
        service.assemblePlanningContext('nonexistent-actor');
      }).toThrow(ContextAssemblyError);

      // Verify details separately
      let thrownError;
      try {
        service.assemblePlanningContext('nonexistent-actor');
      } catch (err) {
        thrownError = err;
      }
      expect(thrownError.details.actorId).toBe('nonexistent-actor');
    });

    it('should include actorId and taskId in error details for refinement context failures', () => {
      const task = { id: 'core:test_task', params: {} };

      expect(() => {
        service.assembleRefinementContext('nonexistent-actor', task);
      }).toThrow(ContextAssemblyError);

      // Verify details separately
      let thrownError;
      try {
        service.assembleRefinementContext('nonexistent-actor', task);
      } catch (err) {
        thrownError = err;
      }
      expect(thrownError.details.actorId).toBe('nonexistent-actor');
      expect(thrownError.details.taskId).toBe('core:test_task');
    });

    it('should include cause in error details when wrapping underlying errors', () => {
      // Create entity manager that throws an error
      const failingEntityManager = {
        getEntity: jest.fn(() => {
          throw new Error('Database connection failed');
        }),
        getComponent: jest.fn(),
        entities: new Set(),
      };

      const failingService = new ContextAssemblyService({
        entityManager: failingEntityManager,
        logger: mockLogger,
      });

      expect(() => {
        failingService.assemblePlanningContext('actor-123');
      }).toThrow(ContextAssemblyError);

      // Verify details separately
      let thrownError;
      try {
        failingService.assemblePlanningContext('actor-123');
      } catch (err) {
        thrownError = err;
      }
      expect(thrownError.details.cause).toBeDefined();
      expect(thrownError.details.cause.message).toBe('Database connection failed');
    });

    it('should have proper error name', () => {
      let thrownError;
      try {
        service.assemblePlanningContext('nonexistent-actor');
      } catch (err) {
        thrownError = err;
      }
      expect(thrownError.name).toBe('ContextAssemblyError');
    });

    it('should maintain stack trace', () => {
      let thrownError;
      try {
        service.assemblePlanningContext('nonexistent-actor');
      } catch (err) {
        thrownError = err;
      }
      expect(thrownError.stack).toBeDefined();
      expect(thrownError.stack).toContain('ContextAssemblyError');
    });
  });

  describe('world state assembly', () => {
    it('should include locations in world state', () => {
      const context = service.assemblePlanningContext('actor-123');

      expect(context.world.locations).toBeDefined();
      expect(typeof context.world.locations).toBe('object');
    });

    it('should include time in world state', () => {
      const context = service.assemblePlanningContext('actor-123');

      expect(context.world.time).toBeDefined();
      expect(typeof context.world.time).toBe('object');
    });

    it('should return consistent world state across multiple calls', () => {
      const context1 = service.assemblePlanningContext('actor-123');
      const context2 = service.assemblePlanningContext('actor-123');

      expect(context1.world).toEqual(context2.world);
    });
  });

  describe('ContextAssemblyService - Knowledge Integration', () => {
    describe('getActorKnowledge', () => {
      it('should return entities array from core:known_to component', () => {
        const actor = {
          id: 'actor-123',
          components: {
            'core:position': { location: 'room-1' },
            'core:known_to': { entities: ['actor-123', 'entity-1', 'entity-2'] },
          },
        };

        mockEntityManager.getEntity = jest.fn((id) => {
          if (id === 'actor-123') return actor;
          return null;
        });

        const serviceWithKnowledge = new ContextAssemblyService({
          entityManager: mockEntityManager,
          logger: mockLogger,
          enableKnowledgeLimitation: true,
        });

        const context = serviceWithKnowledge.assemblePlanningContext('actor-123');

        expect(context.actor.knowledge).toEqual(['actor-123', 'entity-1', 'entity-2']);
        expect(context.actor.knowledge).toHaveLength(3);
      });

      it('should return self-knowledge when core:known_to component is missing', () => {
        const actor = {
          id: 'actor-123',
          components: {
            'core:position': { location: 'room-1' },
          },
        };

        mockEntityManager.getEntity = jest.fn((id) => {
          if (id === 'actor-123') return actor;
          return null;
        });

        const serviceWithKnowledge = new ContextAssemblyService({
          entityManager: mockEntityManager,
          logger: mockLogger,
          enableKnowledgeLimitation: true,
        });

        const context = serviceWithKnowledge.assemblePlanningContext('actor-123');

        expect(context.actor.knowledge).toEqual(['actor-123']);
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Actor missing core:known_to component'),
          expect.any(Object)
        );
      });

      it('should log warning when component is missing', () => {
        const actor = {
          id: 'actor-123',
          components: {
            'core:position': { location: 'room-1' },
          },
        };

        mockEntityManager.getEntity = jest.fn((id) => {
          if (id === 'actor-123') return actor;
          return null;
        });

        const serviceWithKnowledge = new ContextAssemblyService({
          entityManager: mockEntityManager,
          logger: mockLogger,
          enableKnowledgeLimitation: true,
        });

        serviceWithKnowledge.assemblePlanningContext('actor-123');

        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Actor missing core:known_to component: actor-123'),
          expect.objectContaining({
            actorId: 'actor-123',
            fallback: 'self-knowledge only',
          })
        );
      });

      it('should handle empty entities array gracefully', () => {
        const actor = {
          id: 'actor-123',
          components: {
            'core:position': { location: 'room-1' },
            'core:known_to': { entities: [] },
          },
        };

        mockEntityManager.getEntity = jest.fn((id) => {
          if (id === 'actor-123') return actor;
          return null;
        });

        const serviceWithKnowledge = new ContextAssemblyService({
          entityManager: mockEntityManager,
          logger: mockLogger,
          enableKnowledgeLimitation: true,
        });

        const context = serviceWithKnowledge.assemblePlanningContext('actor-123');

        expect(context.actor.knowledge).toEqual([]);
        expect(Array.isArray(context.actor.knowledge)).toBe(true);
      });

      it('should handle malformed core:known_to component gracefully', () => {
        const actor = {
          id: 'actor-123',
          components: {
            'core:position': { location: 'room-1' },
            'core:known_to': {}, // Missing entities array
          },
        };

        mockEntityManager.getEntity = jest.fn((id) => {
          if (id === 'actor-123') return actor;
          return null;
        });

        const serviceWithKnowledge = new ContextAssemblyService({
          entityManager: mockEntityManager,
          logger: mockLogger,
          enableKnowledgeLimitation: true,
        });

        const context = serviceWithKnowledge.assemblePlanningContext('actor-123');

        // Should fallback to self-knowledge
        expect(context.actor.knowledge).toEqual(['actor-123']);
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Actor missing core:known_to component'),
          expect.any(Object)
        );
      });
    });

    describe('knowledge limitation flag', () => {
      it('should include knowledge array when flag is enabled', () => {
        const actor = {
          id: 'actor-123',
          components: {
            'core:position': { location: 'room-1' },
            'core:known_to': { entities: ['actor-123', 'entity-1'] },
          },
        };

        mockEntityManager.getEntity = jest.fn((id) => {
          if (id === 'actor-123') return actor;
          return null;
        });

        const serviceWithKnowledge = new ContextAssemblyService({
          entityManager: mockEntityManager,
          logger: mockLogger,
          enableKnowledgeLimitation: true,
        });

        const context = serviceWithKnowledge.assemblePlanningContext('actor-123');

        expect(context.actor.knowledge).toBeDefined();
        expect(Array.isArray(context.actor.knowledge)).toBe(true);
      });

      it('should not include knowledge array when flag is disabled', () => {
        const actor = {
          id: 'actor-123',
          components: {
            'core:position': { location: 'room-1' },
            'core:known_to': { entities: ['actor-123', 'entity-1'] },
          },
        };

        mockEntityManager.getEntity = jest.fn((id) => {
          if (id === 'actor-123') return actor;
          return null;
        });

        const serviceWithoutKnowledge = new ContextAssemblyService({
          entityManager: mockEntityManager,
          logger: mockLogger,
          enableKnowledgeLimitation: false,
        });

        const context = serviceWithoutKnowledge.assemblePlanningContext('actor-123');

        expect(context.actor.knowledge).toBeUndefined();
      });
    });
  });
});
