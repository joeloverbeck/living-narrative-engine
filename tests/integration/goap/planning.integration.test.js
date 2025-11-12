import { describe, it, expect, beforeEach } from '@jest/globals';
import SimplePlanner from '../../../src/goap/planning/simplePlanner.js';
import PlanCache from '../../../src/goap/planning/planCache.js';
import ActionSelector from '../../../src/goap/selection/actionSelector.js';
import GoalStateEvaluator from '../../../src/goap/goals/goalStateEvaluator.js';
import AbstractPreconditionSimulator from '../../../src/goap/simulation/abstractPreconditionSimulator.js';

describe('Planning Integration', () => {
  let simplePlanner;
  let planCache;
  let actionSelector;
  let goalStateEvaluator;
  let mockLogger;
  let mockGoalManager;
  let mockEntityManager;
  let mockJsonLogicEvaluator;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };

    mockEntityManager = {
      getEntityInstance: jest.fn(),
      hasComponent: jest.fn(),
      getComponentData: jest.fn()
    };

    mockJsonLogicEvaluator = {
      evaluate: jest.fn()
    };

    mockGoalManager = {
      isGoalSatisfied: jest.fn()
    };

    const abstractPreconditionSimulator = new AbstractPreconditionSimulator({
      logger: mockLogger
    });

    goalStateEvaluator = new GoalStateEvaluator({
      logger: mockLogger,
      jsonLogicEvaluator: mockJsonLogicEvaluator,
      entityManager: mockEntityManager
    });

    actionSelector = new ActionSelector({
      logger: mockLogger,
      goalStateEvaluator,
      entityManager: mockEntityManager,
      abstractPreconditionSimulator
    });

    simplePlanner = new SimplePlanner({
      logger: mockLogger,
      actionSelector,
      goalManager: mockGoalManager
    });

    planCache = new PlanCache({ logger: mockLogger });
  });

  describe('plan for find_food goal', () => {
    it('should create plan to pick up nearby food', () => {
      const goal = {
        id: 'survival:find_food',
        goalState: {
          requirements: [
            {
              entity: 'self',
              component: 'survival:has_food',
              mustExist: true
            }
          ]
        }
      };

      const actions = [
        {
          id: 'items:pick_up_food',
          planningEffects: {
            effects: [
              {
                operation: 'ADD_COMPONENT',
                entity: 'actor',
                component: 'survival:has_food',
                data: { amount: 1 }
              }
            ],
            cost: 1.0
          }
        },
        {
          id: 'movement:walk_around',
          planningEffects: {
            effects: [
              {
                operation: 'MODIFY_COMPONENT',
                entity: 'actor',
                component: 'positioning:location',
                updates: { x: 10, y: 10 }
              }
            ],
            cost: 2.0
          }
        }
      ];

      const context = {
        entities: {
          actor1: {
            components: {}
          }
        }
      };

      // Mock distance calculation
      // pick_up_food: 1 -> 0 (progress: 1)
      mockJsonLogicEvaluator.evaluate
        .mockReturnValueOnce(false) // current state
        .mockReturnValueOnce(true); // future state (after pick_up_food)

      // walk_around: 1 -> 1 (progress: 0)
      mockJsonLogicEvaluator.evaluate
        .mockReturnValueOnce(false) // current state
        .mockReturnValueOnce(false); // future state (after walk_around)

      const selectedAction = simplePlanner.plan(goal, actions, 'actor1', context);

      expect(selectedAction).toBeTruthy();
      expect(selectedAction.id).toBe('items:pick_up_food');
    });
  });

  describe('plan for rest_safely goal', () => {
    it('should create plan to sit down for resting', () => {
      const goal = {
        id: 'survival:rest_safely',
        goalState: {
          requirements: [
            {
              entity: 'self',
              component: 'positioning:sitting',
              mustExist: true
            }
          ]
        }
      };

      const actions = [
        {
          id: 'positioning:sit_down',
          planningEffects: {
            effects: [
              {
                operation: 'ADD_COMPONENT',
                entity: 'actor',
                component: 'positioning:sitting',
                data: {}
              },
              {
                operation: 'REMOVE_COMPONENT',
                entity: 'actor',
                component: 'positioning:standing'
              }
            ],
            cost: 1.0
          }
        },
        {
          id: 'positioning:stand_up',
          planningEffects: {
            effects: [
              {
                operation: 'ADD_COMPONENT',
                entity: 'actor',
                component: 'positioning:standing',
                data: {}
              },
              {
                operation: 'REMOVE_COMPONENT',
                entity: 'actor',
                component: 'positioning:sitting'
              }
            ],
            cost: 1.0
          }
        }
      ];

      const context = {
        entities: {
          actor1: {
            components: {
              'positioning:standing': {}
            }
          }
        }
      };

      // Mock distance calculation
      // sit_down: 1 -> 0 (progress: 1)
      mockJsonLogicEvaluator.evaluate
        .mockReturnValueOnce(false) // current state
        .mockReturnValueOnce(true); // future state (after sit_down)

      // stand_up: 1 -> 1 (progress: 0)
      mockJsonLogicEvaluator.evaluate
        .mockReturnValueOnce(false) // current state
        .mockReturnValueOnce(false); // future state (after stand_up)

      const selectedAction = simplePlanner.plan(goal, actions, 'actor1', context);

      expect(selectedAction).toBeTruthy();
      expect(selectedAction.id).toBe('positioning:sit_down');
    });
  });

  describe('plan caching across multiple turns', () => {
    it('should cache plan after first planning', () => {
      const goal = {
        id: 'test:goal',
        goalState: {}
      };

      const action = {
        id: 'test:action',
        planningEffects: {
          effects: [
            {
              operation: 'ADD_COMPONENT',
              entity: 'actor',
              component: 'test:component',
              data: {}
            }
          ]
        }
      };

      const actions = [action];
      const context = { entities: {} };

      // Mock for progress calculation
      mockJsonLogicEvaluator.evaluate
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true);

      // Plan and cache
      const selectedAction = simplePlanner.plan(goal, actions, 'actor1', context);
      const plan = simplePlanner.createPlan(selectedAction, goal);
      planCache.set('actor1', plan);

      // Verify cached
      expect(planCache.has('actor1')).toBe(true);
      const cachedPlan = planCache.get('actor1');
      expect(cachedPlan).toBe(plan);
      expect(cachedPlan.goalId).toBe('test:goal');
      expect(cachedPlan.steps[0].actionId).toBe('test:action');
    });

    it('should reuse cached plan on next turn', () => {
      const plan = {
        goalId: 'test:goal',
        steps: [{ actionId: 'test:action' }],
        createdAt: Date.now(),
        validUntil: null
      };

      planCache.set('actor1', plan);

      // Check cache first (simulating turn logic)
      const cachedPlan = planCache.get('actor1');
      const isValid = simplePlanner.validatePlan(cachedPlan, { entities: {} });

      expect(isValid).toBe(true);
      expect(cachedPlan.steps[0].actionId).toBe('test:action');
    });
  });

  describe('plan invalidation on state change', () => {
    it('should invalidate plan when actor state changes', () => {
      const plan = {
        goalId: 'test:goal',
        steps: [{ actionId: 'test:action' }],
        createdAt: Date.now(),
        validUntil: null
      };

      planCache.set('actor1', plan);

      // Simulate state change event
      planCache.invalidate('actor1');

      expect(planCache.has('actor1')).toBe(false);
    });

    it('should invalidate all plans for goal when goal conditions change', () => {
      const plan1 = {
        goalId: 'survival:find_food',
        steps: [{ actionId: 'test:action1' }]
      };
      const plan2 = {
        goalId: 'survival:find_food',
        steps: [{ actionId: 'test:action2' }]
      };
      const plan3 = {
        goalId: 'survival:rest',
        steps: [{ actionId: 'test:action3' }]
      };

      planCache.set('actor1', plan1);
      planCache.set('actor2', plan2);
      planCache.set('actor3', plan3);

      // Invalidate all plans for find_food goal
      planCache.invalidateGoal('survival:find_food');

      expect(planCache.has('actor1')).toBe(false);
      expect(planCache.has('actor2')).toBe(false);
      expect(planCache.has('actor3')).toBe(true);
    });
  });

  describe('no plan when goal satisfied', () => {
    it('should not create plan when goal already satisfied', () => {
      const actions = [
        {
          id: 'test:action',
          planningEffects: {
            effects: []
          }
        }
      ];

      const goal = {
        id: 'test:goal',
        goalState: {}
      };

      const context = { entities: {} };

      // Mock: goal already satisfied (distance = 0)
      mockJsonLogicEvaluator.evaluate
        .mockReturnValueOnce(true) // current state (satisfied)
        .mockReturnValueOnce(true); // future state (still satisfied)

      const selectedAction = simplePlanner.plan(goal, actions, 'actor1', context);

      // Action selector returns null when no progress is made
      expect(selectedAction).toBeNull();
    });
  });

  describe('no plan when no actions available', () => {
    it('should return null when no actions available', () => {
      const goal = {
        id: 'test:goal',
        goalState: {}
      };

      const actions = [];
      const context = { entities: {} };

      const selectedAction = simplePlanner.plan(goal, actions, 'actor1', context);

      expect(selectedAction).toBeNull();
    });

    it('should return null when actions have no planning effects', () => {
      const goal = {
        id: 'test:goal',
        goalState: {}
      };

      const actions = [
        { id: 'test:action1' }, // no planningEffects
        { id: 'test:action2' }  // no planningEffects
      ];

      const context = { entities: {} };

      const selectedAction = simplePlanner.plan(goal, actions, 'actor1', context);

      expect(selectedAction).toBeNull();
    });
  });

  describe('complete workflow: plan, cache, validate, execute', () => {
    it('should handle complete planning workflow', () => {
      const goal = {
        id: 'test:goal',
        goalState: {}
      };

      const action = {
        id: 'test:action',
        targetId: 'target1',
        planningEffects: {
          effects: [
            {
              operation: 'ADD_COMPONENT',
              entity: 'actor',
              component: 'test:component',
              data: { value: 1 }
            }
          ]
        }
      };

      const actions = [action];
      const context = { entities: {} };

      // Mock for progress calculation
      mockJsonLogicEvaluator.evaluate
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true);

      // Step 1: Check cache (miss)
      expect(planCache.has('actor1')).toBe(false);

      // Step 2: Plan
      const selectedAction = simplePlanner.plan(goal, actions, 'actor1', context);
      expect(selectedAction).toBe(action);

      // Step 3: Create plan
      const plan = simplePlanner.createPlan(selectedAction, goal);
      expect(plan.goalId).toBe('test:goal');
      expect(plan.steps[0].actionId).toBe('test:action');
      expect(plan.steps[0].targetId).toBe('target1');

      // Step 4: Cache plan
      planCache.set('actor1', plan);
      expect(planCache.has('actor1')).toBe(true);

      // Step 5: Validate plan
      const isValid = simplePlanner.validatePlan(plan, context);
      expect(isValid).toBe(true);

      // Step 6: Next turn - reuse cached plan
      const cachedPlan = planCache.get('actor1');
      expect(cachedPlan).toBe(plan);

      // Step 7: Execute action (simulated)
      // In real system, action would be executed here

      // Step 8: Invalidate after execution
      planCache.invalidate('actor1');
      expect(planCache.has('actor1')).toBe(false);
    });
  });
});
