import { describe, it, expect, beforeEach } from '@jest/globals';
import ActionSelector from '../../../src/goap/selection/actionSelector.js';
import AbstractPreconditionSimulator from '../../../src/goap/simulation/abstractPreconditionSimulator.js';

describe('ActionSelection Integration', () => {
  let actionSelector;
  let abstractPreconditionSimulator;
  let mockLogger;
  let mockGoalStateEvaluator;
  let mockEntityManager;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };

    mockGoalStateEvaluator = {
      evaluate: jest.fn(),
      calculateDistance: jest.fn()
    };

    mockEntityManager = {
      getEntityInstance: jest.fn(),
      hasComponent: jest.fn(),
      getComponentData: jest.fn()
    };

    abstractPreconditionSimulator = new AbstractPreconditionSimulator({
      logger: mockLogger
    });

    actionSelector = new ActionSelector({
      logger: mockLogger,
      goalStateEvaluator: mockGoalStateEvaluator,
      entityManager: mockEntityManager,
      abstractPreconditionSimulator
    });
  });

  describe('action selection with progress calculation', () => {
    it('should select action with highest progress toward goal', () => {
      const goal = {
        id: 'test:goal',
        goalState: {}
      };

      const actions = [
        {
          id: 'action:low_progress',
          planningEffects: { effects: [] }
        },
        {
          id: 'action:high_progress',
          planningEffects: { effects: [] }
        }
      ];

      const context = { entities: {} };

      // Mock calculateDistance to return different values for current vs future state
      // Action 1: progress = 10 - 8 = 2
      mockGoalStateEvaluator.calculateDistance
        .mockReturnValueOnce(10) // current for action1
        .mockReturnValueOnce(8)  // future for action1
        // Action 2: progress = 10 - 3 = 7 (best)
        .mockReturnValueOnce(10) // current for action2
        .mockReturnValueOnce(3);  // future for action2

      const selected = actionSelector.selectAction(actions, goal, 'actor1', context);

      expect(selected.id).toBe('action:high_progress');
    });

    it('should log and return null when action selection fails unexpectedly', () => {
      const goal = {
        id: 'test:goal:error',
        goalState: {}
      };

      const brokenAction = {
        id: 'action:broken',
        get planningEffects() {
          throw new Error('planning effects misconfigured');
        }
      };

      const context = { entities: {} };

      const result = actionSelector.selectAction([brokenAction], goal, 'actor1', context);

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to select action',
        expect.objectContaining({ message: 'planning effects misconfigured' })
      );
    });
  });

  describe('progress calculation error handling', () => {
    it('should log and return zero progress when future distance calculation fails', () => {
      const goal = {
        id: 'test:goal:progress-error',
        goalState: {}
      };

      const action = {
        id: 'action:failing_progress',
        planningEffects: { effects: [] }
      };

      const context = { entities: {} };

      mockGoalStateEvaluator.calculateDistance
        .mockReturnValueOnce(10)
        .mockImplementationOnce(() => {
          throw new Error('distance calculation failed');
        });

      const progress = actionSelector.calculateProgress(action, goal, 'actor1', context);

      expect(progress).toBe(0);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to calculate progress for action:failing_progress',
        expect.objectContaining({ message: 'distance calculation failed' })
      );
    });
  });

  describe('effect simulation on real world state', () => {
    it('should accurately simulate multiple effects', () => {
      const action = {
        id: 'complex:action',
        planningEffects: {
          effects: [
            {
              operation: 'ADD_COMPONENT',
              entity: 'actor',
              component: 'test:new_component',
              data: { value: 100 }
            },
            {
              operation: 'REMOVE_COMPONENT',
              entity: 'actor',
              component: 'test:old_component'
            },
            {
              operation: 'MODIFY_COMPONENT',
              entity: 'actor',
              component: 'test:existing_component',
              updates: { count: 5 }
            }
          ]
        }
      };

      const context = {
        entities: {
          actor1: {
            components: {
              'test:old_component': {},
              'test:existing_component': { count: 0, name: 'test' }
            }
          }
        }
      };

      const result = actionSelector.simulateEffects(action, 'actor1', context);

      expect(result.entities.actor1.components['test:new_component']).toEqual({ value: 100 });
      expect(result.entities.actor1.components['test:old_component']).toBeUndefined();
      expect(result.entities.actor1.components['test:existing_component']).toEqual({
        count: 5,
        name: 'test'
      });
    });

    it('should handle nested conditional effects', () => {
      const action = {
        id: 'nested:conditional',
        planningEffects: {
          effects: [
            {
              operation: 'CONDITIONAL',
              condition: {
                abstractPrecondition: 'hasComponent',
                params: ['actor', 'test:component1']
              },
              then: [
                {
                  operation: 'CONDITIONAL',
                  condition: {
                    abstractPrecondition: 'hasComponent',
                    params: ['actor', 'test:component2']
                  },
                  then: [
                    {
                      operation: 'ADD_COMPONENT',
                      entity: 'actor',
                      component: 'test:result',
                      data: {}
                    }
                  ]
                }
              ]
            }
          ]
        }
      };

      const context = {
        entities: {
          actor1: {
            components: {
              'test:component1': {},
              'test:component2': {}
            }
          }
        }
      };

      const result = actionSelector.simulateEffects(action, 'actor1', context);

      expect(result.entities.actor1.components['test:result']).toBeDefined();
    });

    it('should return current state unchanged when action has no planning effects', () => {
      const action = {
        id: 'noop:action'
      };

      const context = { entities: { actor1: { components: {} } } };

      const result = actionSelector.simulateEffects(action, 'actor1', context);

      expect(result).toBe(context);
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should log and return current state when effect application throws', () => {
      const action = {
        id: 'conditional:malformed_then',
        planningEffects: {
          effects: [
            {
              operation: 'CONDITIONAL',
              condition: {
                abstractPrecondition: 'hasComponent',
                params: ['actor', 'items:inventory']
              },
              then: {
                operation: 'ADD_COMPONENT',
                entity: 'actor',
                component: 'test:should_not_add',
                data: {}
              }
            }
          ]
        }
      };

      const context = {
        entities: {
          actor1: {
            components: {
              'items:inventory': {}
            }
          }
        }
      };

      const result = actionSelector.simulateEffects(action, 'actor1', context);

      expect(result).toBe(context);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to simulate effects for conditional:malformed_then',
        expect.any(Error)
      );
      expect(context.entities.actor1.components['test:should_not_add']).toBeUndefined();
    });

    it('should warn and default to true when evaluating non-abstract conditions', () => {
      const action = {
        id: 'conditional:legacy_condition',
        planningEffects: {
          effects: [
            {
              operation: 'CONDITIONAL',
              condition: { field: 'status', equals: 'active' },
              then: [
                {
                  operation: 'ADD_COMPONENT',
                  entity: 'actor',
                  component: 'test:legacy_then',
                  data: { triggered: true }
                }
              ],
              else: [
                {
                  operation: 'ADD_COMPONENT',
                  entity: 'actor',
                  component: 'test:legacy_else',
                  data: { triggered: false }
                }
              ]
            }
          ]
        }
      };

      const context = {
        entities: {
          actor1: {
            components: {}
          }
        }
      };

      const result = actionSelector.simulateEffects(action, 'actor1', context);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Condition evaluation without abstract precondition not fully implemented'
      );
      expect(result.entities.actor1.components['test:legacy_then']).toEqual({ triggered: true });
      expect(result.entities.actor1.components['test:legacy_else']).toBeUndefined();
    });
  });

  describe('abstract preconditions integration', () => {
    it('should use abstract preconditions in conditional planning', () => {
      const action = {
        id: 'items:transfer_item',
        planningEffects: {
          effects: [
            {
              operation: 'CONDITIONAL',
              condition: {
                abstractPrecondition: 'hasInventoryCapacity',
                params: ['target', 'item1']
              },
              then: [
                {
                  operation: 'ADD_COMPONENT',
                  entity: 'target',
                  component: 'items:received_item',
                  data: {}
                }
              ],
              else: [
                {
                  operation: 'ADD_COMPONENT',
                  entity: 'actor',
                  component: 'items:transfer_failed',
                  data: {}
                }
              ]
            }
          ]
        }
      };

      const contextWithCapacity = {
        entities: {
          actor1: { components: {} },
          target1: {
            components: {
              'items:inventory': {
                max_weight: 100,
                items: []
              }
            }
          },
          item1: {
            components: {
              'items:item': { weight: 10 }
            }
          }
        },
        targetId: 'target1'
      };

      const resultSuccess = actionSelector.simulateEffects(action, 'actor1', contextWithCapacity);
      expect(resultSuccess.entities.target1.components['items:received_item']).toBeDefined();
      expect(resultSuccess.entities.actor1.components['items:transfer_failed']).toBeUndefined();

      const contextNoCapacity = {
        entities: {
          actor1: { components: {} },
          target1: {
            components: {
              'items:inventory': {
                max_weight: 20,
                items: ['existing_item']
              }
            }
          },
          existing_item: {
            components: {
              'items:item': { weight: 15 }
            }
          },
          item1: {
            components: {
              'items:item': { weight: 10 }
            }
          }
        },
        targetId: 'target1'
      };

      const resultFail = actionSelector.simulateEffects(action, 'actor1', contextNoCapacity);
      expect(resultFail.entities.target1.components['items:received_item']).toBeUndefined();
      expect(resultFail.entities.actor1.components['items:transfer_failed']).toBeDefined();
    });
  });

});
