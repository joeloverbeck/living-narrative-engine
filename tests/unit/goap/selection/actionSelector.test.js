import { describe, it, expect, beforeEach } from '@jest/globals';
import ActionSelector from '../../../../src/goap/selection/actionSelector.js';

describe('ActionSelector', () => {
  let actionSelector;
  let mockLogger;
  let mockGoalStateEvaluator;
  let mockEntityManager;
  let mockAbstractPreconditionSimulator;

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

    mockAbstractPreconditionSimulator = {
      simulate: jest.fn()
    };

    actionSelector = new ActionSelector({
      logger: mockLogger,
      goalStateEvaluator: mockGoalStateEvaluator,
      entityManager: mockEntityManager,
      abstractPreconditionSimulator: mockAbstractPreconditionSimulator
    });
  });

  describe('constructor', () => {
    it('should validate dependencies', () => {
      expect(() => new ActionSelector({
        logger: null,
        goalStateEvaluator: mockGoalStateEvaluator,
        entityManager: mockEntityManager,
        abstractPreconditionSimulator: mockAbstractPreconditionSimulator
      })).toThrow();
    });
  });

  describe('selectAction', () => {
    it('should select action with highest positive progress (single action)', () => {
      const actions = [
        {
          id: 'test:action1',
          planningEffects: { effects: [] }
        }
      ];

      const goal = {
        id: 'test:goal',
        goalState: {}
      };

      const context = { entities: {} };

      mockGoalStateEvaluator.calculateDistance
        .mockReturnValueOnce(10) // current distance
        .mockReturnValueOnce(5);  // future distance

      const result = actionSelector.selectAction(actions, goal, 'actor1', context);

      expect(result).toBe(actions[0]);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Selected action test:action1')
      );
    });

    it('should select action with highest progress (multiple actions)', () => {
      const actions = [
        {
          id: 'test:action1',
          planningEffects: { effects: [] }
        },
        {
          id: 'test:action2',
          planningEffects: { effects: [] }
        },
        {
          id: 'test:action3',
          planningEffects: { effects: [] }
        }
      ];

      const goal = {
        id: 'test:goal',
        goalState: {}
      };

      const context = { entities: {} };

      // Action 1: progress = 10 - 8 = 2
      mockGoalStateEvaluator.calculateDistance
        .mockReturnValueOnce(10)
        .mockReturnValueOnce(8);

      // Action 2: progress = 10 - 3 = 7 (best)
      mockGoalStateEvaluator.calculateDistance
        .mockReturnValueOnce(10)
        .mockReturnValueOnce(3);

      // Action 3: progress = 10 - 7 = 3
      mockGoalStateEvaluator.calculateDistance
        .mockReturnValueOnce(10)
        .mockReturnValueOnce(7);

      const result = actionSelector.selectAction(actions, goal, 'actor1', context);

      expect(result).toBe(actions[1]);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('test:action2')
      );
    });

    it('should return null when no plannable actions available', () => {
      const actions = [
        { id: 'test:action1' }, // no planningEffects
        { id: 'test:action2' }  // no planningEffects
      ];

      const goal = {
        id: 'test:goal',
        goalState: {}
      };

      const context = { entities: {} };

      const result = actionSelector.selectAction(actions, goal, 'actor1', context);

      expect(result).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith('No plannable actions available');
    });

    it('should return null when no actions with positive progress', () => {
      const actions = [
        {
          id: 'test:action1',
          planningEffects: { effects: [] }
        },
        {
          id: 'test:action2',
          planningEffects: { effects: [] }
        }
      ];

      const goal = {
        id: 'test:goal',
        goalState: {}
      };

      const context = { entities: {} };

      // Both actions have zero or negative progress
      mockGoalStateEvaluator.calculateDistance
        .mockReturnValueOnce(10)
        .mockReturnValueOnce(10) // progress = 0
        .mockReturnValueOnce(10)
        .mockReturnValueOnce(12); // progress = -2

      const result = actionSelector.selectAction(actions, goal, 'actor1', context);

      expect(result).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith('No actions with positive progress');
    });

    it('should handle errors gracefully', () => {
      const actions = [
        {
          id: 'test:action1',
          planningEffects: { effects: [] }
        }
      ];

      const goal = {
        id: 'test:goal',
        goalState: {}
      };

      const context = { entities: {} };

      mockGoalStateEvaluator.calculateDistance.mockImplementation(() => {
        throw new Error('Test error');
      });

      const result = actionSelector.selectAction(actions, goal, 'actor1', context);

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should catch errors thrown during progress calculation', () => {
      const actions = [
        {
          id: 'test:error-action',
          planningEffects: { effects: [] }
        }
      ];

      const goal = {
        id: 'test:goal',
        goalState: {}
      };

      const context = { entities: {} };

      const progressSpy = jest
        .spyOn(actionSelector, 'calculateProgress')
        .mockImplementation(() => {
          throw new Error('Progress failed');
        });

      const result = actionSelector.selectAction(actions, goal, 'actor1', context);

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to select action',
        expect.any(Error)
      );

      progressSpy.mockRestore();
    });
  });

  describe('calculateProgress', () => {
    it('should calculate positive progress', () => {
      const action = {
        id: 'test:action',
        planningEffects: { effects: [] }
      };

      const goal = {
        id: 'test:goal',
        goalState: {}
      };

      const context = { entities: {} };

      mockGoalStateEvaluator.calculateDistance
        .mockReturnValueOnce(10) // current
        .mockReturnValueOnce(5);  // future

      const progress = actionSelector.calculateProgress(action, goal, 'actor1', context);

      expect(progress).toBe(5);
    });

    it('should calculate zero progress', () => {
      const action = {
        id: 'test:action',
        planningEffects: { effects: [] }
      };

      const goal = {
        id: 'test:goal',
        goalState: {}
      };

      const context = { entities: {} };

      mockGoalStateEvaluator.calculateDistance
        .mockReturnValue(10); // same distance

      const progress = actionSelector.calculateProgress(action, goal, 'actor1', context);

      expect(progress).toBe(0);
    });

    it('should calculate negative progress', () => {
      const action = {
        id: 'test:action',
        planningEffects: { effects: [] }
      };

      const goal = {
        id: 'test:goal',
        goalState: {}
      };

      const context = { entities: {} };

      mockGoalStateEvaluator.calculateDistance
        .mockReturnValueOnce(10) // current
        .mockReturnValueOnce(15); // future (worse)

      const progress = actionSelector.calculateProgress(action, goal, 'actor1', context);

      expect(progress).toBe(-5);
    });

    it('should return 0 on error', () => {
      const action = {
        id: 'test:action',
        planningEffects: { effects: [] }
      };

      const goal = {
        id: 'test:goal',
        goalState: {}
      };

      const context = { entities: {} };

      mockGoalStateEvaluator.calculateDistance.mockImplementation(() => {
        throw new Error('Test error');
      });

      const progress = actionSelector.calculateProgress(action, goal, 'actor1', context);

      expect(progress).toBe(0);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('simulateEffects', () => {
    it('should return current state when no planning effects', () => {
      const action = { id: 'test:action' };
      const context = { entities: {} };

      const result = actionSelector.simulateEffects(action, 'actor1', context);

      expect(result).toEqual(context);
    });

    it('should simulate ADD_COMPONENT', () => {
      const action = {
        id: 'test:action',
        planningEffects: {
          effects: [
            {
              operation: 'ADD_COMPONENT',
              entity: 'actor',
              component: 'test:new_component',
              data: { value: 42 }
            }
          ]
        }
      };

      const context = {
        entities: {
          actor1: { components: {} }
        }
      };

      const result = actionSelector.simulateEffects(action, 'actor1', context);

      expect(result.entities.actor1.components['test:new_component']).toEqual({ value: 42 });
    });

    it('should simulate REMOVE_COMPONENT', () => {
      const action = {
        id: 'test:action',
        planningEffects: {
          effects: [
            {
              operation: 'REMOVE_COMPONENT',
              entity: 'actor',
              component: 'test:old_component'
            }
          ]
        }
      };

      const context = {
        entities: {
          actor1: {
            components: {
              'test:old_component': { value: 1 }
            }
          }
        }
      };

      const result = actionSelector.simulateEffects(action, 'actor1', context);

      expect(result.entities.actor1.components['test:old_component']).toBeUndefined();
    });

    it('should simulate MODIFY_COMPONENT', () => {
      const action = {
        id: 'test:action',
        planningEffects: {
          effects: [
            {
              operation: 'MODIFY_COMPONENT',
              entity: 'actor',
              component: 'test:component',
              updates: { value: 100 }
            }
          ]
        }
      };

      const context = {
        entities: {
          actor1: {
            components: {
              'test:component': { value: 50, other: 'data' }
            }
          }
        }
      };

      const result = actionSelector.simulateEffects(action, 'actor1', context);

      expect(result.entities.actor1.components['test:component']).toEqual({
        value: 100,
        other: 'data'
      });
    });

    it('should simulate CONDITIONAL with true condition', () => {
      mockAbstractPreconditionSimulator.simulate.mockReturnValue(true);

      const action = {
        id: 'test:action',
        planningEffects: {
          effects: [
            {
              operation: 'CONDITIONAL',
              condition: {
                abstractPrecondition: 'testCondition',
                params: ['actor']
              },
              then: [
                {
                  operation: 'ADD_COMPONENT',
                  entity: 'actor',
                  component: 'test:then_component',
                  data: {}
                }
              ]
            }
          ]
        }
      };

      const context = {
        entities: {
          actor1: { components: {} }
        }
      };

      const result = actionSelector.simulateEffects(action, 'actor1', context);

      expect(result.entities.actor1.components['test:then_component']).toBeDefined();
      expect(mockAbstractPreconditionSimulator.simulate).toHaveBeenCalledWith(
        'testCondition',
        ['actor1'],
        expect.any(Object)
      );
    });

    it('should simulate CONDITIONAL with false condition and else branch', () => {
      mockAbstractPreconditionSimulator.simulate.mockReturnValue(false);

      const action = {
        id: 'test:action',
        planningEffects: {
          effects: [
            {
              operation: 'CONDITIONAL',
              condition: {
                abstractPrecondition: 'testCondition',
                params: ['actor']
              },
              then: [
                {
                  operation: 'ADD_COMPONENT',
                  entity: 'actor',
                  component: 'test:then_component',
                  data: {}
                }
              ],
              else: [
                {
                  operation: 'ADD_COMPONENT',
                  entity: 'actor',
                  component: 'test:else_component',
                  data: {}
                }
              ]
            }
          ]
        }
      };

      const context = {
        entities: {
          actor1: { components: {} }
        }
      };

      const result = actionSelector.simulateEffects(action, 'actor1', context);

      expect(result.entities.actor1.components['test:then_component']).toBeUndefined();
      expect(result.entities.actor1.components['test:else_component']).toBeDefined();
    });

    it('should handle abstract preconditions in conditions', () => {
      mockAbstractPreconditionSimulator.simulate.mockReturnValue(true);

      const action = {
        id: 'test:action',
        planningEffects: {
          effects: [
            {
              operation: 'CONDITIONAL',
              condition: {
                abstractPrecondition: 'hasInventoryCapacity',
                params: ['actor', 'item1']
              },
              then: [
                {
                  operation: 'ADD_COMPONENT',
                  entity: 'actor',
                  component: 'test:component',
                  data: {}
                }
              ]
            }
          ]
        }
      };

      const context = {
        entities: {
          actor1: { components: {} }
        }
      };

      actionSelector.simulateEffects(action, 'actor1', context);

      expect(mockAbstractPreconditionSimulator.simulate).toHaveBeenCalledWith(
        'hasInventoryCapacity',
        ['actor1', 'item1'],
        expect.any(Object)
      );
    });

    it('should warn and default to true when condition lacks abstract precondition', () => {
      const action = {
        id: 'test:action',
        planningEffects: {
          effects: [
            {
              operation: 'CONDITIONAL',
              condition: { custom: 'value' },
              then: [
                {
                  operation: 'ADD_COMPONENT',
                  entity: 'actor',
                  component: 'test:fallback_component',
                  data: { enabled: true }
                }
              ]
            }
          ]
        }
      };

      const context = {
        entities: {
          actor1: { components: {} }
        }
      };

      const result = actionSelector.simulateEffects(action, 'actor1', context);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Condition evaluation without abstract precondition not fully implemented'
      );
      expect(result.entities.actor1.components['test:fallback_component']).toEqual({
        enabled: true
      });
    });

    it('should handle unknown operations gracefully', () => {
      const action = {
        id: 'test:action',
        planningEffects: {
          effects: [
            {
              operation: 'INVALID_OPERATION'
            }
          ]
        }
      };

      const context = { entities: {} };

      const result = actionSelector.simulateEffects(action, 'actor1', context);

      // Should silently ignore unknown operations
      expect(result).toBeDefined();
    });

    it('should log error and return current state when cloning fails', () => {
      const action = {
        id: 'test:bigint-action',
        planningEffects: {
          effects: []
        }
      };

      const context = {
        entities: {},
        value: BigInt(1)
      };

      const result = actionSelector.simulateEffects(action, 'actor1', context);

      expect(result).toBe(context);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to simulate effects for test:bigint-action',
        expect.any(Error)
      );
    });

    it('should not mutate original state', () => {
      const action = {
        id: 'test:action',
        planningEffects: {
          effects: [
            {
              operation: 'ADD_COMPONENT',
              entity: 'actor',
              component: 'test:new_component',
              data: {}
            }
          ]
        }
      };

      const context = {
        entities: {
          actor1: { components: {} }
        }
      };

      const originalContext = JSON.parse(JSON.stringify(context));

      actionSelector.simulateEffects(action, 'actor1', context);

      expect(context).toEqual(originalContext);
    });

    it('should resolve entity references', () => {
      const action = {
        id: 'test:action',
        planningEffects: {
          effects: [
            {
              operation: 'ADD_COMPONENT',
              entity: 'target',
              component: 'test:component',
              data: {}
            }
          ]
        }
      };

      const context = {
        entities: {
          target1: { components: {} }
        },
        targetId: 'target1'
      };

      const result = actionSelector.simulateEffects(action, 'actor1', context);

      expect(result.entities.target1.components['test:component']).toBeDefined();
    });
  });
});
