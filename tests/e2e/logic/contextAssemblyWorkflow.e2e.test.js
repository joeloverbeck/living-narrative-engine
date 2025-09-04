/**
 * @file contextAssemblyWorkflow.e2e.test.js
 * @description End-to-end tests for context assembly pipeline workflow
 *
 * Tests the complete context assembly workflow including:
 * - Full context creation from events
 * - Actor/target resolution edge cases
 * - Component accessor functionality
 * - Nested context preservation
 * - Integration with operation execution pipeline
 *
 * Priority 1: CRITICAL - Core System Integrity
 * Has indirect coverage through JSON Logic tests but needs direct workflow testing
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  jest,
} from '@jest/globals';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { configureContainer } from '../../../src/dependencyInjection/containerConfig.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import {
  createEntityContext,
  populateParticipant,
  createEvaluationContext,
} from '../../../src/logic/contextAssembler.js';
import { createComponentAccessor } from '../../../src/logic/componentAccessor.js';
import EntityDefinition from '../../../src/entities/entityDefinition.js';

describe('Context Assembly Pipeline E2E', () => {
  let container;
  let entityManager;
  let eventBus;
  let logger;
  let jsonLogic;
  let systemLogicInterpreter;
  let operationInterpreter;

  // Test entities
  let testActor;
  let testTarget;
  let testLocation;

  beforeAll(async () => {
    // Initialize container with full system configuration
    container = new AppContainer();
    await configureContainer(container, {
      outputDiv: document.createElement('div'),
      inputElement: document.createElement('input'),
      titleElement: document.createElement('h1'),
      document,
    });

    // Register core entity definitions manually for testing
    const dataRegistry = container.resolve(tokens.IDataRegistry);
    
    // Register core:location definition
    dataRegistry.store('entityDefinitions', 'core:location', 
      new EntityDefinition('core:location', {
        id: 'core:location',
        components: {
          'core:description': { name: '', description: '' },
          'core:exits': []
        }
      })
    );
    
    // Register core:actor definition 
    dataRegistry.store('entityDefinitions', 'core:actor',
      new EntityDefinition('core:actor', {
        id: 'core:actor',
        components: {
          'core:actor': {},
          'core:description': { name: '' },
          'core:position': { locationId: null },
          'core:inventory': { items: [] },
          'core:stats': { health: 100, maxHealth: 100 }
        }
      })
    );

    // Register core:item definition
    dataRegistry.store('entityDefinitions', 'core:item',
      new EntityDefinition('core:item', { 
        id: 'core:item',
        components: {
          'core:description': { name: '' },
          'core:item': { value: 0, type: '' }
        }
      })
    );

    // Resolve core services
    entityManager = container.resolve(tokens.IEntityManager);
    eventBus = container.resolve(tokens.IEventBus);
    logger = container.resolve(tokens.ILogger);
    jsonLogic = container.resolve(tokens.JsonLogicEvaluationService);
    systemLogicInterpreter = container.resolve(tokens.SystemLogicInterpreter);
    operationInterpreter = container.resolve(tokens.OperationInterpreter);

    // Create test entities using core definitions
    testLocation = await entityManager.createEntityInstance('core:location', {
      components: {
        'core:description': { name: 'Test Room', description: 'A test location' },
      },
    });

    testActor = await entityManager.createEntityInstance('core:actor', {
      components: {
        'core:description': { name: 'Test Actor' },
        'core:position': { locationId: testLocation.id },
        'core:inventory': { items: [] },
        'core:stats': { health: 100, maxHealth: 100 },
      },
    });

    testTarget = await entityManager.createEntityInstance('core:actor', {
      components: {
        'core:description': { name: 'Test Target' },
        'core:position': { locationId: testLocation.id },
        'core:stats': { health: 50, maxHealth: 50 },
      },
    });
  });

  afterAll(async () => {
    // Cleanup
    if (container && typeof container.dispose === 'function') {
      await container.dispose();
    }
  });

  beforeEach(() => {
    // Reset any modified entity states
  });

  describe('Happy Path Scenarios', () => {
    it('should create complete evaluation context from event', () => {
      // Arrange
      const event = {
        type: 'TEST_EVENT',
        payload: {
          actorId: testActor.id,
          targetId: testTarget.id,
          customData: { value: 42 },
        },
      };

      // Act
      const context = createEvaluationContext(event, entityManager, logger);

      // Assert basic structure
      expect(context).toBeDefined();
      expect(context.event).toEqual(event);
      expect(context.actor).toBeDefined();
      expect(context.target).toBeDefined();

      // Assert actor context
      expect(context.actor.id).toBe(testActor.id);
      expect(context.actor.components).toBeDefined();
      expect(typeof context.actor.components).toBe('function');

      // Assert target context
      expect(context.target.id).toBe(testTarget.id);
      expect(context.target.components).toBeDefined();

      // Assert custom data preservation
      expect(context.customData).toEqual({ value: 42 });
    });

    it('should provide functional component accessor', () => {
      // Arrange
      const entityContext = createEntityContext(testActor.id, entityManager, logger);

      // Act - Access components through accessor
      const description = entityContext.components('core:description');
      const position = entityContext.components('core:position');
      const stats = entityContext.components('core:stats');

      // Assert
      expect(description).toEqual({ name: 'Test Actor' });
      expect(position).toEqual({ locationId: testLocation.id });
      expect(stats).toEqual({ health: 100, maxHealth: 100 });
    });

    it('should handle nested component access', () => {
      // Arrange
      const context = createEvaluationContext(
        {
          type: 'TEST',
          payload: { actorId: testActor.id },
        },
        entityManager,
        logger
      );

      // Act - Access nested properties
      const actorName = context.actor.components('core:description').name;
      const actorHealth = context.actor.components('core:stats').health;
      const actorLocation = context.actor.components('core:position').locationId;

      // Assert
      expect(actorName).toBe('Test Actor');
      expect(actorHealth).toBe(100);
      expect(actorLocation).toBe(testLocation.id);
    });

    it('should populate participants correctly', () => {
      // Arrange
      const evaluationContext = { event: { type: 'TEST' } };

      // Act
      populateParticipant('actor', testActor.id, evaluationContext, entityManager, logger);
      populateParticipant('target', testTarget.id, evaluationContext, entityManager, logger);

      // Assert
      expect(evaluationContext.actor).toBeDefined();
      expect(evaluationContext.actor.id).toBe(testActor.id);
      expect(evaluationContext.target).toBeDefined();
      expect(evaluationContext.target.id).toBe(testTarget.id);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing actor gracefully', () => {
      // Arrange
      const event = {
        type: 'TEST_EVENT',
        payload: {
          targetId: testTarget.id,
        },
      };

      // Act
      const context = createEvaluationContext(event, entityManager, logger);

      // Assert
      expect(context.actor).toBeUndefined();
      expect(context.target).toBeDefined();
      expect(context.target.id).toBe(testTarget.id);
    });

    it('should handle non-existent entity IDs', () => {
      // Arrange
      const event = {
        type: 'TEST_EVENT',
        payload: {
          actorId: 'non-existent-entity',
          targetId: testTarget.id,
        },
      };

      // Act & Assert - Should not throw
      const context = createEvaluationContext(event, entityManager, logger);
      
      expect(context.actor).toBeDefined();
      expect(context.actor.id).toBe('non-existent-entity');
      expect(context.actor.components('core:description')).toBeUndefined();
    });

    it('should handle missing components on entities', () => {
      // Arrange - Create entity without some components
      let sparseEntity;

      beforeAll(async () => {
        sparseEntity = await entityManager.createEntityInstance('core:actor', {
          components: {
            'core:description': { name: 'Sparse Entity' },
          },
        });
      });

      // Act
      const context = createEntityContext(sparseEntity.id, entityManager, logger);
      const missingComponent = context.components('core:nonexistent');
      const existingComponent = context.components('core:description');

      // Assert
      expect(missingComponent).toBeUndefined();
      expect(existingComponent).toEqual({ name: 'Sparse Entity' });
    });

    it('should handle null and undefined entity IDs', () => {
      // Arrange
      const nullContext = createEntityContext(null, entityManager, logger);
      const undefinedContext = createEntityContext(undefined, entityManager, logger);

      // Assert - Should create context with null/undefined ID
      expect(nullContext).toBeDefined();
      expect(nullContext.id).toBeNull();
      expect(nullContext.components).toBeDefined();

      expect(undefinedContext).toBeDefined();
      expect(undefinedContext.id).toBeUndefined();
      expect(undefinedContext.components).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should preserve context through nested operations', async () => {
      // Arrange
      const initialContext = {
        evaluationContext: {
          event: { type: 'NESTED_TEST' },
          actor: createEntityContext(testActor.id, entityManager, logger),
          target: createEntityContext(testTarget.id, entityManager, logger),
          customValue: 'preserved',
        },
        entityManager,
        eventBus,
        logger,
        jsonLogic,
      };

      // Create nested operation
      const operation = {
        type: 'IF',
        parameters: {
          condition: { '===': [{ var: 'customValue' }, 'preserved'] },
          then_actions: [
            {
              type: 'SET_VARIABLE',
              parameters: {
                name: 'nestedValue',
                value: 'nested',
              },
            },
          ],
        },
      };

      // Act
      const result = await operationInterpreter.execute(operation, initialContext);

      // Assert - Original context values should be preserved
      expect(initialContext.evaluationContext.customValue).toBe('preserved');
      expect(initialContext.evaluationContext.actor.id).toBe(testActor.id);
      expect(initialContext.evaluationContext.target.id).toBe(testTarget.id);
    });

    it('should handle deeply nested component access paths', () => {
      // Arrange - Create entity with nested data
      let nestedEntity;

      beforeAll(async () => {
        nestedEntity = await entityManager.createEntityInstance('core:actor', {
          components: {
            'core:custom': {
              level1: {
                level2: {
                  level3: {
                    value: 'deep-value',
                  },
                },
              },
            },
          },
        });
      });

      // Act
      const context = createEntityContext(nestedEntity.id, entityManager, logger);
      const deepValue = context.components('core:custom').level1.level2.level3.value;

      // Assert
      expect(deepValue).toBe('deep-value');
    });

    it('should handle circular references in context data', () => {
      // Arrange
      const circularObj = { name: 'circular' };
      circularObj.self = circularObj;

      const event = {
        type: 'CIRCULAR_TEST',
        payload: {
          actorId: testActor.id,
          circular: circularObj,
        },
      };

      // Act - Should not throw on circular reference
      const context = createEvaluationContext(event, entityManager, logger);

      // Assert
      expect(context).toBeDefined();
      expect(context.circular).toBe(circularObj);
      expect(context.circular.self).toBe(circularObj);
    });

    it('should handle special entity IDs correctly', () => {
      // Arrange
      const specialIds = ['self', 'none', '0', '', null];
      
      specialIds.forEach(id => {
        // Act
        const context = createEntityContext(id, entityManager, logger);
        
        // Assert
        expect(context).toBeDefined();
        expect(context.id).toBe(id);
        expect(context.components).toBeDefined();
      });
    });
  });

  describe('Performance Characteristics', () => {
    it('should efficiently create contexts for many entities', () => {
      // Arrange
      const numEntities = 1000;
      const entityIds = [];
      
      // Create test entities
      beforeAll(async () => {
        for (let i = 0; i < numEntities; i++) {
          const entity = await entityManager.createEntityInstance('core:actor', {
            components: {
              'core:description': { name: `Entity ${i}` },
            },
          });
          entityIds.push(entity.id);
        }
      });

      // Act
      const startTime = performance.now();
      const contexts = entityIds.map(id => 
        createEntityContext(id, entityManager, logger)
      );
      const endTime = performance.now();

      // Assert
      expect(contexts).toHaveLength(numEntities);
      expect(endTime - startTime).toBeLessThan(100); // Should create 1000 contexts in < 100ms
    });

    it('should cache component accessors efficiently', () => {
      // Arrange
      const context = createEntityContext(testActor.id, entityManager, logger);
      
      // Act - Access same component multiple times
      const startTime = performance.now();
      for (let i = 0; i < 10000; i++) {
        context.components('core:description');
      }
      const endTime = performance.now();

      // Assert - Should be very fast due to caching
      expect(endTime - startTime).toBeLessThan(50);
    });

    it('should handle large evaluation contexts', () => {
      // Arrange - Create event with large payload
      const largeArray = new Array(1000).fill(null).map((_, i) => ({
        index: i,
        data: `item-${i}`,
      }));

      const event = {
        type: 'LARGE_EVENT',
        payload: {
          actorId: testActor.id,
          targetId: testTarget.id,
          largeData: largeArray,
          metadata: {
            nested: {
              deeply: {
                value: 'test',
              },
            },
          },
        },
      };

      // Act
      const startTime = performance.now();
      const context = createEvaluationContext(event, entityManager, logger);
      const endTime = performance.now();

      // Assert
      expect(context).toBeDefined();
      expect(context.largeData).toHaveLength(1000);
      expect(endTime - startTime).toBeLessThan(10); // Should be nearly instant
    });
  });

  describe('Integration with Operation Execution', () => {
    it('should provide context for JSON Logic evaluation', async () => {
      // Arrange
      const context = createEvaluationContext(
        {
          type: 'TEST',
          payload: { actorId: testActor.id, targetId: testTarget.id },
        },
        entityManager,
        logger
      );

      // Create JSON Logic expression using context
      const expression = {
        '===': [
          { var: 'actor.components("core:description").name' },
          'Test Actor',
        ],
      };

      // Act
      const result = jsonLogic.apply(expression, context);

      // Assert
      expect(result).toBe(true);
    });

    it('should maintain context through rule execution', async () => {
      // Arrange
      let capturedContext;
      
      // Register test rule
      const testRule = {
        id: 'test:context_capture',
        condition: { '===': [{ var: 'event.type' }, 'CONTEXT_TEST'] },
        actions: [
          {
            type: 'CUSTOM_ACTION',
            parameters: {},
          },
        ],
      };

      // Register custom handler to capture context
      const operationRegistry = container.resolve(tokens.OperationRegistry);
      operationRegistry.register('CUSTOM_ACTION', async (params, ctx) => {
        capturedContext = ctx.evaluationContext;
        return { success: true };
      });

      // Act - Dispatch event to trigger rule
      await eventBus.dispatch({
        type: 'CONTEXT_TEST',
        payload: {
          actorId: testActor.id,
          targetId: testTarget.id,
          customField: 'test-value',
        },
      });

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Assert - Context should be preserved through rule execution
      expect(capturedContext).toBeDefined();
      expect(capturedContext.actor.id).toBe(testActor.id);
      expect(capturedContext.target.id).toBe(testTarget.id);
      expect(capturedContext.customField).toBe('test-value');
    });

    it('should support dynamic context modification', () => {
      // Arrange
      const baseContext = createEvaluationContext(
        {
          type: 'TEST',
          payload: { actorId: testActor.id },
        },
        entityManager,
        logger
      );

      // Act - Modify context
      baseContext.dynamicValue = 'added';
      baseContext.actor.customProp = 'modified';
      populateParticipant('target', testTarget.id, baseContext, entityManager, logger);

      // Assert
      expect(baseContext.dynamicValue).toBe('added');
      expect(baseContext.actor.customProp).toBe('modified');
      expect(baseContext.target.id).toBe(testTarget.id);
    });
  });
});