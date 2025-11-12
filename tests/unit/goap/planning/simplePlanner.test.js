import { describe, it, expect, beforeEach } from '@jest/globals';
import SimplePlanner from '../../../../src/goap/planning/simplePlanner.js';

describe('SimplePlanner', () => {
  let simplePlanner;
  let mockLogger;
  let mockActionSelector;
  let mockGoalManager;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };

    mockActionSelector = {
      selectAction: jest.fn(),
      calculateProgress: jest.fn()
    };

    mockGoalManager = {
      isGoalSatisfied: jest.fn()
    };

    simplePlanner = new SimplePlanner({
      logger: mockLogger,
      actionSelector: mockActionSelector,
      goalManager: mockGoalManager
    });
  });

  describe('constructor', () => {
    it('should validate dependencies', () => {
      expect(() => new SimplePlanner({
        logger: null,
        actionSelector: mockActionSelector,
        goalManager: mockGoalManager
      })).toThrow();
    });

    it('should validate actionSelector dependency', () => {
      expect(() => new SimplePlanner({
        logger: mockLogger,
        actionSelector: null,
        goalManager: mockGoalManager
      })).toThrow();
    });

    it('should validate goalManager dependency', () => {
      expect(() => new SimplePlanner({
        logger: mockLogger,
        actionSelector: mockActionSelector,
        goalManager: null
      })).toThrow();
    });
  });

  describe('plan', () => {
    it('should plan with single action', () => {
      const goal = { id: 'test:goal' };
      const action = { id: 'test:action1' };
      const availableActions = [action];
      const actorId = 'actor1';
      const context = { entities: {} };

      mockActionSelector.selectAction.mockReturnValue(action);

      const result = simplePlanner.plan(goal, availableActions, actorId, context);

      expect(result).toBe(action);
      expect(mockActionSelector.selectAction).toHaveBeenCalledWith(
        availableActions,
        goal,
        actorId,
        context
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Planned action test:action1')
      );
    });

    it('should plan with multiple actions (selects best)', () => {
      const goal = { id: 'test:goal' };
      const action1 = { id: 'test:action1' };
      const action2 = { id: 'test:action2' };
      const availableActions = [action1, action2];
      const actorId = 'actor1';
      const context = { entities: {} };

      mockActionSelector.selectAction.mockReturnValue(action2);

      const result = simplePlanner.plan(goal, availableActions, actorId, context);

      expect(result).toBe(action2);
      expect(mockActionSelector.selectAction).toHaveBeenCalledWith(
        availableActions,
        goal,
        actorId,
        context
      );
    });

    it('should return null when no applicable actions', () => {
      const goal = { id: 'test:goal' };
      const availableActions = [];
      const actorId = 'actor1';
      const context = { entities: {} };

      mockActionSelector.selectAction.mockReturnValue(null);

      const result = simplePlanner.plan(goal, availableActions, actorId, context);

      expect(result).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('No action selected')
      );
    });

    it('should validate goal parameter', () => {
      expect(() => {
        simplePlanner.plan(null, [], 'actor1', {});
      }).toThrow('Goal is required');
    });

    it('should validate availableActions parameter', () => {
      expect(() => {
        simplePlanner.plan({ id: 'test:goal' }, null, 'actor1', {});
      }).toThrow('Available actions required');
    });

    it('should validate actorId parameter', () => {
      expect(() => {
        simplePlanner.plan({ id: 'test:goal' }, [], '', {});
      }).toThrow();
    });

    it('should handle errors during planning', () => {
      const goal = { id: 'test:goal' };
      const availableActions = [{ id: 'test:action1' }];
      const actorId = 'actor1';
      const context = { entities: {} };

      mockActionSelector.selectAction.mockImplementation(() => {
        throw new Error('Planning error');
      });

      const result = simplePlanner.plan(goal, availableActions, actorId, context);

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to plan'),
        expect.any(Error)
      );
    });
  });

  describe('createPlan', () => {
    it('should create plan with valid action and goal', () => {
      const action = {
        id: 'test:action1',
        targetId: 'target1',
        tertiaryTargetId: 'tertiary1',
        planningEffects: {
          effects: [
            { operation: 'ADD_COMPONENT' },
            { operation: 'REMOVE_COMPONENT' }
          ]
        }
      };
      const goal = { id: 'test:goal' };

      const plan = simplePlanner.createPlan(action, goal);

      expect(plan).toMatchObject({
        goalId: 'test:goal',
        steps: [
          {
            actionId: 'test:action1',
            targetId: 'target1',
            tertiaryTargetId: 'tertiary1',
            reasoning: expect.stringContaining('2 effects')
          }
        ],
        validUntil: null
      });
      expect(plan.createdAt).toBeGreaterThan(0);
    });

    it('should create plan with null targets', () => {
      const action = {
        id: 'test:action1',
        planningEffects: {
          effects: []
        }
      };
      const goal = { id: 'test:goal' };

      const plan = simplePlanner.createPlan(action, goal);

      expect(plan.steps[0]).toMatchObject({
        actionId: 'test:action1',
        targetId: null,
        tertiaryTargetId: null
      });
    });

    it('should validate action parameter', () => {
      expect(() => {
        simplePlanner.createPlan(null, { id: 'test:goal' });
      }).toThrow('Action is required');
    });

    it('should validate goal parameter', () => {
      expect(() => {
        simplePlanner.createPlan({ id: 'test:action' }, null);
      }).toThrow('Goal is required');
    });

    it('should generate reasoning for action', () => {
      const action = {
        id: 'test:action1',
        planningEffects: {
          effects: [
            { operation: 'ADD_COMPONENT' },
            { operation: 'REMOVE_COMPONENT' },
            { operation: 'MODIFY_COMPONENT' }
          ]
        }
      };
      const goal = { id: 'test:goal' };

      const plan = simplePlanner.createPlan(action, goal);

      expect(plan.steps[0].reasoning).toContain('3 effects');
      expect(plan.steps[0].reasoning).toContain('test:goal');
    });

    it('should handle action without planning effects', () => {
      const action = { id: 'test:action1' };
      const goal = { id: 'test:goal' };

      const plan = simplePlanner.createPlan(action, goal);

      expect(plan.steps[0].reasoning).toContain('0 effects');
    });
  });

  describe('validatePlan', () => {
    it('should validate valid plan', () => {
      const plan = {
        goalId: 'test:goal',
        steps: [{ actionId: 'test:action1' }],
        createdAt: Date.now(),
        validUntil: null
      };
      const context = { entities: {} };

      const result = simplePlanner.validatePlan(plan, context);

      expect(result).toBe(true);
    });

    it('should invalidate expired plan', () => {
      const plan = {
        goalId: 'test:goal',
        steps: [{ actionId: 'test:action1' }],
        createdAt: Date.now() - 10000,
        validUntil: Date.now() - 5000 // expired 5 seconds ago
      };
      const context = { entities: {} };

      const result = simplePlanner.validatePlan(plan, context);

      expect(result).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith('Plan expired');
    });

    it('should validate non-expired plan', () => {
      const plan = {
        goalId: 'test:goal',
        steps: [{ actionId: 'test:action1' }],
        createdAt: Date.now(),
        validUntil: Date.now() + 5000 // expires in 5 seconds
      };
      const context = { entities: {} };

      const result = simplePlanner.validatePlan(plan, context);

      expect(result).toBe(true);
    });

    it('should invalidate plan with no steps', () => {
      const plan = {
        goalId: 'test:goal',
        steps: [],
        createdAt: Date.now(),
        validUntil: null
      };
      const context = { entities: {} };

      const result = simplePlanner.validatePlan(plan, context);

      expect(result).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith('Plan has no steps');
    });

    it('should invalidate plan with undefined steps', () => {
      const plan = {
        goalId: 'test:goal',
        createdAt: Date.now(),
        validUntil: null
      };
      const context = { entities: {} };

      const result = simplePlanner.validatePlan(plan, context);

      expect(result).toBe(false);
    });

    it('should validate plan parameter', () => {
      expect(() => {
        simplePlanner.validatePlan(null, {});
      }).toThrow('Plan is required');
    });

    it('should validate context parameter', () => {
      const plan = {
        goalId: 'test:goal',
        steps: [{ actionId: 'test:action1' }]
      };

      expect(() => {
        simplePlanner.validatePlan(plan, null);
      }).toThrow('Context is required');
    });

    it('should handle errors during validation', () => {
      const plan = {
        goalId: 'test:goal',
        steps: [{ actionId: 'test:action1' }],
        get validUntil() {
          throw new Error('Validation error');
        }
      };
      const context = { entities: {} };

      const result = simplePlanner.validatePlan(plan, context);

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to validate plan',
        expect.any(Error)
      );
    });
  });
});
