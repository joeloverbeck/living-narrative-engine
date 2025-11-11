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
