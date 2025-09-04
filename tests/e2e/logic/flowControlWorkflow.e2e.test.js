/**
 * @file flowControlWorkflow.e2e.test.js
 * @description End-to-end tests for flow control execution workflow
 *
 * Tests the complete flow control workflow including:
 * - Nested IF/ELSE branches
 * - FOR_EACH with large collections
 * - Variable scoping and restoration
 * - Error propagation in nested flows
 * - Integration with operation interpreter and action sequences
 *
 * Priority 1: CRITICAL - Core System Integrity
 * Currently has zero e2e tests
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
import { createEvaluationContext } from '../../../src/logic/contextAssembler.js';
import EntityDefinition from '../../../src/entities/entityDefinition.js';

describe('Flow Control Execution E2E', () => {
  let container;
  let operationInterpreter;
  let operationRegistry;
  let entityManager;
  let eventBus;
  let logger;
  let jsonLogic;
  let actionSequence;

  // Test entities
  let testActor;
  let testItems;
  let executionLog;

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
    
    // Register core:actor definition
    dataRegistry.store('entityDefinitions', 'core:actor',
      new EntityDefinition('core:actor', {
        id: 'core:actor',
        components: {
          'core:actor': {},
          'core:description': { name: '' },
          'core:stats': { health: 100, maxHealth: 100, mana: 0 },
          'core:inventory': { items: [] },
        }
      })
    );
    
    // Register core:item definition
    dataRegistry.store('entityDefinitions', 'core:item',
      new EntityDefinition('core:item', {
        id: 'core:item',
        components: {
          'core:description': { name: '' },
          'core:item': { value: 0, type: '' },
        }
      })
    );

    // Resolve core services
    operationInterpreter = container.resolve(tokens.OperationInterpreter);
    operationRegistry = container.resolve(tokens.OperationRegistry);
    entityManager = container.resolve(tokens.IEntityManager);
    eventBus = container.resolve(tokens.IEventBus);
    logger = container.resolve(tokens.ILogger);
    jsonLogic = container.resolve(tokens.JsonLogicEvaluationService);
    actionSequence = container.resolve(tokens.ActionSequence);

    // Create test actor using core definition
    testActor = await entityManager.createEntityInstance('core:actor', {
      components: {
        'core:description': { name: 'Test Actor' },
        'core:stats': { health: 75, maxHealth: 100, mana: 30 },
        'core:inventory': { items: [] },
      },
    });

    // Create test items using core item definition
    testItems = [];
    for (let i = 0; i < 5; i++) {
      const item = await entityManager.createEntityInstance('core:item', {
        components: {
          'core:description': { name: `Item ${i}` },
          'core:item': { value: i * 10, type: i % 2 === 0 ? 'weapon' : 'armor' },
        },
      });
      testItems.push(item);
    }

    // Register custom test handlers
    executionLog = [];
    
    operationRegistry.register('LOG_ACTION', async (params, ctx) => {
      executionLog.push(params.message);
      return { logged: params.message };
    });

    operationRegistry.register('INCREMENT_VALUE', async (params, ctx) => {
      const currentValue = ctx.evaluationContext[params.variable] || 0;
      ctx.evaluationContext[params.variable] = currentValue + (params.amount || 1);
      executionLog.push(`${params.variable}=${ctx.evaluationContext[params.variable]}`);
      return { value: ctx.evaluationContext[params.variable] };
    });

    operationRegistry.register('COLLECT_ITEM', async (params, ctx) => {
      const itemId = params.itemId || ctx.evaluationContext.currentItem?.id;
      executionLog.push(`collected:${itemId}`);
      return { collected: itemId };
    });
  });

  afterAll(async () => {
    // Cleanup
    if (container && typeof container.dispose === 'function') {
      await container.dispose();
    }
  });

  beforeEach(() => {
    // Clear execution log
    executionLog = [];
  });

  describe('IF/ELSE Branching', () => {
    it('should execute THEN branch when condition is true', async () => {
      // Arrange
      const operation = {
        type: 'IF',
        parameters: {
          condition: { '>': [{ var: 'actor.components("core:stats").health' }, 50] },
          then_actions: [
            {
              type: 'LOG_ACTION',
              parameters: { message: 'Health is good' },
            },
          ],
          else_actions: [
            {
              type: 'LOG_ACTION',
              parameters: { message: 'Health is low' },
            },
          ],
        },
      };

      const context = {
        evaluationContext: createEvaluationContext(
          { type: 'TEST', payload: { actorId: testActor.id } },
          entityManager,
          logger
        ),
        entityManager,
        eventBus,
        logger,
        jsonLogic,
      };

      // Act
      await operationInterpreter.execute(operation, context);

      // Assert
      expect(executionLog).toEqual(['Health is good']);
    });

    it('should execute ELSE branch when condition is false', async () => {
      // Arrange
      const operation = {
        type: 'IF',
        parameters: {
          condition: { '>': [{ var: 'actor.components("core:stats").health' }, 100] },
          then_actions: [
            {
              type: 'LOG_ACTION',
              parameters: { message: 'Over max health' },
            },
          ],
          else_actions: [
            {
              type: 'LOG_ACTION',
              parameters: { message: 'Normal health' },
            },
          ],
        },
      };

      const context = {
        evaluationContext: createEvaluationContext(
          { type: 'TEST', payload: { actorId: testActor.id } },
          entityManager,
          logger
        ),
        entityManager,
        eventBus,
        logger,
        jsonLogic,
      };

      // Act
      await operationInterpreter.execute(operation, context);

      // Assert
      expect(executionLog).toEqual(['Normal health']);
    });

    it('should handle nested IF statements', async () => {
      // Arrange
      const operation = {
        type: 'IF',
        parameters: {
          condition: { '>': [{ var: 'actor.components("core:stats").health' }, 50] },
          then_actions: [
            {
              type: 'LOG_ACTION',
              parameters: { message: 'Outer IF: true' },
            },
            {
              type: 'IF',
              parameters: {
                condition: { '>': [{ var: 'actor.components("core:stats").mana' }, 20] },
                then_actions: [
                  {
                    type: 'LOG_ACTION',
                    parameters: { message: 'Inner IF: true' },
                  },
                ],
                else_actions: [
                  {
                    type: 'LOG_ACTION',
                    parameters: { message: 'Inner IF: false' },
                  },
                ],
              },
            },
          ],
          else_actions: [
            {
              type: 'LOG_ACTION',
              parameters: { message: 'Outer IF: false' },
            },
          ],
        },
      };

      const context = {
        evaluationContext: createEvaluationContext(
          { type: 'TEST', payload: { actorId: testActor.id } },
          entityManager,
          logger
        ),
        entityManager,
        eventBus,
        logger,
        jsonLogic,
      };

      // Act
      await operationInterpreter.execute(operation, context);

      // Assert - Both health > 50 and mana > 20 are true
      expect(executionLog).toEqual(['Outer IF: true', 'Inner IF: true']);
    });

    it('should handle complex nested branching logic', async () => {
      // Arrange - Multi-level nested IF with different conditions
      const operation = {
        type: 'IF',
        parameters: {
          condition: { '===': [{ var: 'testValue' }, 1] },
          then_actions: [
            {
              type: 'LOG_ACTION',
              parameters: { message: 'Level 1: value is 1' },
            },
            {
              type: 'IF',
              parameters: {
                condition: { '>': [{ var: 'actor.components("core:stats").health' }, 70] },
                then_actions: [
                  {
                    type: 'LOG_ACTION',
                    parameters: { message: 'Level 2: health > 70' },
                  },
                  {
                    type: 'IF',
                    parameters: {
                      condition: { '<': [{ var: 'actor.components("core:stats").mana' }, 50] },
                      then_actions: [
                        {
                          type: 'LOG_ACTION',
                          parameters: { message: 'Level 3: mana < 50' },
                        },
                      ],
                    },
                  },
                ],
              },
            },
          ],
        },
      };

      const context = {
        evaluationContext: {
          ...createEvaluationContext(
            { type: 'TEST', payload: { actorId: testActor.id } },
            entityManager,
            logger
          ),
          testValue: 1,
        },
        entityManager,
        eventBus,
        logger,
        jsonLogic,
      };

      // Act
      await operationInterpreter.execute(operation, context);

      // Assert - All conditions should be true
      expect(executionLog).toEqual([
        'Level 1: value is 1',
        'Level 2: health > 70',
        'Level 3: mana < 50',
      ]);
    });
  });

  describe('FOR_EACH Iteration', () => {
    it('should iterate over array of items', async () => {
      // Arrange
      const operation = {
        type: 'FOR_EACH',
        parameters: {
          items: testItems.map(item => item.id),
          variable: 'currentItemId',
          actions: [
            {
              type: 'LOG_ACTION',
              parameters: { message: { var: 'currentItemId' } },
            },
          ],
        },
      };

      const context = {
        evaluationContext: {},
        entityManager,
        eventBus,
        logger,
        jsonLogic,
      };

      // Act
      await operationInterpreter.execute(operation, context);

      // Assert
      expect(executionLog).toEqual(testItems.map(item => item.id));
    });

    it('should handle nested FOR_EACH loops', async () => {
      // Arrange
      const operation = {
        type: 'FOR_EACH',
        parameters: {
          items: ['A', 'B'],
          variable: 'outerItem',
          actions: [
            {
              type: 'FOR_EACH',
              parameters: {
                items: [1, 2],
                variable: 'innerItem',
                actions: [
                  {
                    type: 'LOG_ACTION',
                    parameters: { 
                      message: { 
                        concat: [{ var: 'outerItem' }, '-', { var: 'innerItem' }] 
                      },
                    },
                  },
                ],
              },
            },
          ],
        },
      };

      const context = {
        evaluationContext: {},
        entityManager,
        eventBus,
        logger,
        jsonLogic,
      };

      // Act
      await operationInterpreter.execute(operation, context);

      // Assert - Should produce cartesian product
      expect(executionLog).toEqual(['A-1', 'A-2', 'B-1', 'B-2']);
    });

    it('should handle large collections efficiently', async () => {
      // Arrange - Create large array
      const largeArray = Array.from({ length: 100 }, (_, i) => i);
      let counter = 0;

      operationRegistry.register('COUNT_ACTION', async () => {
        counter++;
        return { count: counter };
      });

      const operation = {
        type: 'FOR_EACH',
        parameters: {
          items: largeArray,
          variable: 'index',
          actions: [
            {
              type: 'COUNT_ACTION',
              parameters: {},
            },
          ],
        },
      };

      const context = {
        evaluationContext: {},
        entityManager,
        eventBus,
        logger,
        jsonLogic,
      };

      // Act
      const startTime = performance.now();
      await operationInterpreter.execute(operation, context);
      const endTime = performance.now();

      // Assert
      expect(counter).toBe(100);
      expect(endTime - startTime).toBeLessThan(500); // Should complete in < 500ms
    });

    it('should preserve variable scope in iterations', async () => {
      // Arrange
      const operation = {
        type: 'FOR_EACH',
        parameters: {
          items: [1, 2, 3],
          variable: 'num',
          actions: [
            {
              type: 'INCREMENT_VALUE',
              parameters: { variable: 'total', amount: { var: 'num' } },
            },
          ],
        },
      };

      const context = {
        evaluationContext: { total: 0 },
        entityManager,
        eventBus,
        logger,
        jsonLogic,
      };

      // Act
      await operationInterpreter.execute(operation, context);

      // Assert - Should sum 1+2+3 = 6
      expect(context.evaluationContext.total).toBe(6);
      expect(executionLog).toContain('total=6');
    });

    it('should handle conditional logic within FOR_EACH', async () => {
      // Arrange - Filter even items
      const operation = {
        type: 'FOR_EACH',
        parameters: {
          items: testItems.map(item => item.id),
          variable: 'itemId',
          actions: [
            {
              type: 'IF',
              parameters: {
                condition: { 
                  '===': [
                    { var: 'entityManager.getEntityInstance(itemId).getComponentData("core:item").type' },
                    'weapon',
                  ],
                },
                then_actions: [
                  {
                    type: 'COLLECT_ITEM',
                    parameters: { itemId: { var: 'itemId' } },
                  },
                ],
              },
            },
          ],
        },
      };

      const context = {
        evaluationContext: { entityManager },
        entityManager,
        eventBus,
        logger,
        jsonLogic,
      };

      // Act
      await operationInterpreter.execute(operation, context);

      // Assert - Should only collect weapons (items 0, 2, 4)
      const weaponItems = testItems.filter((_, i) => i % 2 === 0);
      expect(executionLog).toEqual(weaponItems.map(item => `collected:${item.id}`));
    });
  });

  describe('Variable Scoping and Context', () => {
    it('should maintain separate scope for nested operations', async () => {
      // Arrange
      const operation = {
        type: 'IF',
        parameters: {
          condition: { '===': [1, 1] },
          then_actions: [
            {
              type: 'SET_VARIABLE',
              parameters: { name: 'scopedVar', value: 'outer' },
            },
            {
              type: 'LOG_ACTION',
              parameters: { message: { var: 'scopedVar' } },
            },
            {
              type: 'IF',
              parameters: {
                condition: { '===': [1, 1] },
                then_actions: [
                  {
                    type: 'SET_VARIABLE',
                    parameters: { name: 'scopedVar', value: 'inner' },
                  },
                  {
                    type: 'LOG_ACTION',
                    parameters: { message: { var: 'scopedVar' } },
                  },
                ],
              },
            },
            {
              type: 'LOG_ACTION',
              parameters: { message: { var: 'scopedVar' } },
            },
          ],
        },
      };

      const context = {
        evaluationContext: {},
        entityManager,
        eventBus,
        logger,
        jsonLogic,
      };

      // Act
      await operationInterpreter.execute(operation, context);

      // Assert - Variable should be modified in nested scope
      expect(executionLog).toEqual(['outer', 'inner', 'inner']);
    });

    it('should restore context after FOR_EACH iteration', async () => {
      // Arrange
      const operation = {
        type: 'SEQUENCE',
        parameters: {
          actions: [
            {
              type: 'SET_VARIABLE',
              parameters: { name: 'persistentVar', value: 'before' },
            },
            {
              type: 'FOR_EACH',
              parameters: {
                items: ['a', 'b'],
                variable: 'letter',
                actions: [
                  {
                    type: 'SET_VARIABLE',
                    parameters: { name: 'persistentVar', value: { var: 'letter' } },
                  },
                ],
              },
            },
            {
              type: 'LOG_ACTION',
              parameters: { message: { var: 'persistentVar' } },
            },
          ],
        },
      };

      const context = {
        evaluationContext: {},
        entityManager,
        eventBus,
        logger,
        jsonLogic,
      };

      // Act
      await operationInterpreter.execute(operation, context);

      // Assert - persistentVar should be 'b' after loop
      expect(executionLog[executionLog.length - 1]).toBe('b');
    });

    it('should handle variable shadowing correctly', async () => {
      // Arrange
      const operation = {
        type: 'FOR_EACH',
        parameters: {
          items: [1, 2],
          variable: 'value',
          actions: [
            {
              type: 'FOR_EACH',
              parameters: {
                items: ['a', 'b'],
                variable: 'value', // Same variable name
                actions: [
                  {
                    type: 'LOG_ACTION',
                    parameters: { message: { var: 'value' } },
                  },
                ],
              },
            },
            {
              type: 'LOG_ACTION',
              parameters: { message: { var: 'value' } },
            },
          ],
        },
      };

      const context = {
        evaluationContext: {},
        entityManager,
        eventBus,
        logger,
        jsonLogic,
      };

      // Act
      await operationInterpreter.execute(operation, context);

      // Assert - Inner loop should shadow outer, but outer should be restored
      expect(executionLog).toEqual(['a', 'b', '1', 'a', 'b', '2']);
    });
  });

  describe('Error Handling and Propagation', () => {
    it('should propagate errors from nested operations', async () => {
      // Arrange
      operationRegistry.register('FAILING_ACTION', async () => {
        throw new Error('Deliberate failure');
      });

      const operation = {
        type: 'IF',
        parameters: {
          condition: { '===': [1, 1] },
          then_actions: [
            {
              type: 'LOG_ACTION',
              parameters: { message: 'Before error' },
            },
            {
              type: 'FAILING_ACTION',
              parameters: {},
            },
            {
              type: 'LOG_ACTION',
              parameters: { message: 'After error' },
            },
          ],
        },
      };

      const context = {
        evaluationContext: {},
        entityManager,
        eventBus,
        logger,
        jsonLogic,
      };

      // Act & Assert
      await expect(
        operationInterpreter.execute(operation, context)
      ).rejects.toThrow('Deliberate failure');

      // Only the first log should have executed
      expect(executionLog).toEqual(['Before error']);
    });

    it('should handle errors in FOR_EACH iterations', async () => {
      // Arrange
      let iterationCount = 0;
      operationRegistry.register('FAIL_ON_THIRD', async () => {
        iterationCount++;
        if (iterationCount === 3) {
          throw new Error('Failed on third iteration');
        }
        executionLog.push(`iteration-${iterationCount}`);
        return { iteration: iterationCount };
      });

      const operation = {
        type: 'FOR_EACH',
        parameters: {
          items: [1, 2, 3, 4, 5],
          variable: 'num',
          actions: [
            {
              type: 'FAIL_ON_THIRD',
              parameters: {},
            },
          ],
        },
      };

      const context = {
        evaluationContext: {},
        entityManager,
        eventBus,
        logger,
        jsonLogic,
      };

      // Act & Assert
      await expect(
        operationInterpreter.execute(operation, context)
      ).rejects.toThrow('Failed on third iteration');

      // Should have processed first two iterations
      expect(executionLog).toEqual(['iteration-1', 'iteration-2']);
    });

    it('should handle invalid condition in IF statement', async () => {
      // Arrange - Condition that references non-existent data
      const operation = {
        type: 'IF',
        parameters: {
          condition: { '>': [{ var: 'nonexistent.nested.property' }, 0] },
          then_actions: [
            {
              type: 'LOG_ACTION',
              parameters: { message: 'Should not execute' },
            },
          ],
          else_actions: [
            {
              type: 'LOG_ACTION',
              parameters: { message: 'Handled undefined' },
            },
          ],
        },
      };

      const context = {
        evaluationContext: {},
        entityManager,
        eventBus,
        logger,
        jsonLogic,
      };

      // Act
      await operationInterpreter.execute(operation, context);

      // Assert - undefined > 0 is false, so else branch executes
      expect(executionLog).toEqual(['Handled undefined']);
    });
  });

  describe('Performance Characteristics', () => {
    it('should handle deeply nested IF statements efficiently', async () => {
      // Arrange - Create deeply nested IF structure
      let operation = {
        type: 'LOG_ACTION',
        parameters: { message: 'deepest' },
      };

      // Nest 50 levels deep
      for (let i = 0; i < 50; i++) {
        operation = {
          type: 'IF',
          parameters: {
            condition: { '===': [1, 1] },
            then_actions: [operation],
          },
        };
      }

      const context = {
        evaluationContext: {},
        entityManager,
        eventBus,
        logger,
        jsonLogic,
      };

      // Act
      const startTime = performance.now();
      await operationInterpreter.execute(operation, context);
      const endTime = performance.now();

      // Assert
      expect(executionLog).toEqual(['deepest']);
      expect(endTime - startTime).toBeLessThan(100); // Should complete quickly
    });

    it('should handle large FOR_EACH with complex operations', async () => {
      // Arrange
      const items = Array.from({ length: 100 }, (_, i) => i);
      
      const operation = {
        type: 'FOR_EACH',
        parameters: {
          items,
          variable: 'index',
          actions: [
            {
              type: 'IF',
              parameters: {
                condition: { '===': [{ '%': [{ var: 'index' }, 10] }, 0] },
                then_actions: [
                  {
                    type: 'INCREMENT_VALUE',
                    parameters: { variable: 'tenthCount', amount: 1 },
                  },
                ],
              },
            },
          ],
        },
      };

      const context = {
        evaluationContext: { tenthCount: 0 },
        entityManager,
        eventBus,
        logger,
        jsonLogic,
      };

      // Act
      const startTime = performance.now();
      await operationInterpreter.execute(operation, context);
      const endTime = performance.now();

      // Assert
      expect(context.evaluationContext.tenthCount).toBe(10); // 0, 10, 20, ..., 90
      expect(endTime - startTime).toBeLessThan(200);
    });
  });

  describe('Integration with Action Sequences', () => {
    it('should execute flow control within action sequences', async () => {
      // Arrange
      const sequence = {
        actions: [
          {
            type: 'SET_VARIABLE',
            parameters: { name: 'sequenceVar', value: 'start' },
          },
          {
            type: 'IF',
            parameters: {
              condition: { '===': [{ var: 'sequenceVar' }, 'start'] },
              then_actions: [
                {
                  type: 'LOG_ACTION',
                  parameters: { message: 'Sequence condition met' },
                },
                {
                  type: 'FOR_EACH',
                  parameters: {
                    items: ['a', 'b', 'c'],
                    variable: 'letter',
                    actions: [
                      {
                        type: 'LOG_ACTION',
                        parameters: { message: { var: 'letter' } },
                      },
                    ],
                  },
                },
              ],
            },
          },
          {
            type: 'LOG_ACTION',
            parameters: { message: 'Sequence complete' },
          },
        ],
      };

      const context = {
        evaluationContext: {},
        entityManager,
        eventBus,
        logger,
        jsonLogic,
        operationInterpreter,
      };

      // Act
      await actionSequence.execute(sequence, context);

      // Assert
      expect(executionLog).toEqual([
        'Sequence condition met',
        'a',
        'b',
        'c',
        'Sequence complete',
      ]);
    });

    it('should handle mixed flow control and entity operations', async () => {
      // Arrange
      const operation = {
        type: 'FOR_EACH',
        parameters: {
          items: testItems.slice(0, 3).map(item => item.id),
          variable: 'itemId',
          actions: [
            {
              type: 'IF',
              parameters: {
                condition: { 
                  '===': [
                    { 
                      var: 'entityManager.getEntityInstance(itemId).getComponentData("core:item").type',
                    },
                    'weapon',
                  ],
                },
                then_actions: [
                  {
                    type: 'MODIFY_COMPONENT',
                    parameters: {
                      entityId: { var: 'itemId' },
                      componentTypeId: 'core:item',
                      data: { enhanced: true },
                    },
                  },
                  {
                    type: 'LOG_ACTION',
                    parameters: { message: { concat: ['Enhanced: ', { var: 'itemId' }] } },
                  },
                ],
              },
            },
          ],
        },
      };

      const context = {
        evaluationContext: { entityManager },
        entityManager,
        eventBus,
        logger,
        jsonLogic,
      };

      // Act
      await operationInterpreter.execute(operation, context);

      // Assert - Should enhance weapons (items 0 and 2)
      expect(executionLog).toContain(`Enhanced: ${testItems[0].id}`);
      expect(executionLog).toContain(`Enhanced: ${testItems[2].id}`);
      expect(executionLog).not.toContain(`Enhanced: ${testItems[1].id}`);

      // Verify component modifications
      const item0 = await entityManager.getEntityInstance(testItems[0].id);
      const item0Data = item0.getComponentData('core:item');
      expect(item0Data.enhanced).toBe(true);
    });
  });
});